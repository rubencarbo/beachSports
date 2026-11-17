import Phaser from 'phaser';
import { COURT, PHYS, PPM, RETRO_ROWS, VIEW_W, project, view } from '../config';
import { applyRetro } from '../fx/RetroPipeline';
import { sfx } from '../core/audio';
import { playerInput } from '../core/input';
import { AI_LEVELS, AiController, InterceptPlan, planIntercept } from '../entities/Ai';
import { getSettings } from '../core/settings';
import { Ball, ShotKind } from '../entities/Ball';
import { Intent, Player } from '../entities/Player';
import { computeShot } from '../entities/shots';
import { CAM_BASE_Y, CameraDirector } from '../fx/CameraDirector';
import { Effects } from '../fx/Effects';
import { saveMatch } from '../services/backend';
import { beachPaddle } from '../sports';
import type { Side, SportRules } from '../sports/types';
import { BeachStage } from '../stage/BeachStage';

export interface MatchConfig {
  mode: 'play' | 'attract';
  difficulty: keyof typeof AI_LEVELS;
  points: number;
}

type State = 'serve' | 'rally' | 'point' | 'over';

const SPECIAL_NAME = { sun: '¡METEORO SOLAR!', wave: '¡TSUNAMI!' };

export class MatchScene extends Phaser.Scene {
  cfg!: MatchConfig;
  rules!: SportRules;
  stage!: BeachStage;
  ball!: Ball;
  p1!: Player;
  p2!: Player;
  ai: Map<Side, AiController> = new Map();
  dir!: CameraDirector;
  fx!: Effects;
  state: State = 'serve';
  server: Side = -1;
  score: Record<Side, number> = { [-1]: 0, [1]: 0 } as Record<Side, number>;
  private now = 0;
  private freezeUntil = 0;
  private slowUntil = 0;
  private slowScale = 1;
  private timeScale = 1;
  private stateT = 0;
  private serveTimer = -1;
  private rallyHits = 0;
  private specialFlight = false;
  private auraOn: Record<string, boolean> = {};
  private stats = { specials: 0, perfects: 0, longestRally: 0 };

  constructor() { super('Match'); }

  init(data: Partial<MatchConfig>) {
    this.cfg = { mode: data.mode ?? 'attract', difficulty: data.difficulty ?? 'normal', points: data.points ?? 7 };
    this.rules = beachPaddle(this.cfg.points);
    this.score = { [-1]: 0, [1]: 0 } as Record<Side, number>;
    this.ai = new Map();
    this.now = 0; this.freezeUntil = 0; this.slowUntil = 0; this.timeScale = 1;
    this.stats = { specials: 0, perfects: 0, longestRally: 0 };
  }

  create() {
    this.stage = new BeachStage(this);
    this.stage.buildNet();
    this.ball = new Ball(this);
    this.p1 = new Player(this, -1, 'sun', this.cfg.mode === 'play' ? 'TU' : 'SOL');
    this.p2 = new Player(this, 1, 'wave', 'CPU');
    const lvl = AI_LEVELS[this.cfg.difficulty];
    if (this.cfg.mode === 'attract') this.ai.set(-1, new AiController(this.p1, AI_LEVELS.dificil));
    this.ai.set(1, new AiController(this.p2, this.cfg.mode === 'attract' ? AI_LEVELS.dificil : lvl));
    if (this.cfg.mode === 'attract') { this.p1.meter = 0.6; this.p2.meter = 0.8; }
    this.fx = new Effects(this);
    this.dir = new CameraDirector(this.cameras.main);
    this.cameras.main.setBackgroundColor('#5c8ad1');
    applyRetro(this.cameras.main, RETRO_ROWS);
    this.stage.setScore(0, 0);
    this.setupServe(Math.random() < 0.5 ? -1 : 1);
    playerInput.reset();
    this.emitHud();
    this.game.events.emit('match-start', this.cfg);
  }

  // ------------------------------------------------------------------ flujo
  private setupServe(server: Side) {
    this.server = server;
    this.state = 'serve';
    this.stateT = 0;
    this.serveTimer = -1;
    this.rallyHits = 0;
    this.specialFlight = false;
    this.ball.live = false;
    this.ball.held = true;
    this.ball.hitNet = false;
    this.ball.lastHitter = 0;
    this.ball.kind = 'normal';
    this.ball.clearTrail();
    this.fx.stopTrails();
    for (const p of [this.p1, this.p2]) {
      p.mood = 'none'; p.stunned = 0; p.vy = 0; p.y = 0;
      p.x = p.side * (p.side === server ? 7.6 : 5.6);
      p.z = p.side === server ? 3.2 + Math.random() * 1.6 : 4;
    }
  }

  private face(side: Side, expr: number, dur = 1.2) { this.game.events.emit('face', { side, expr, dur }); }

  private pointWon(winner: Side, reason: 'in' | 'out' | 'net' | 'own-side' | 'unstoppable') {
    if (this.state !== 'rally') return;
    this.face(winner, 2, 2.4);
    this.face(winner === -1 ? 1 : -1, 5, 2.4);
    this.state = 'point';
    this.stateT = 0;
    this.stats.longestRally = Math.max(this.stats.longestRally, this.rallyHits);
    this.score[winner]++;
    const w = winner === -1 ? this.p1 : this.p2;
    const l = winner === -1 ? this.p2 : this.p1;
    w.mood = 'happy'; w.moodT = 2.2;
    l.mood = 'sad'; l.moodT = 2.2;
    sfx.whistle();
    sfx.cheer(reason === 'unstoppable' || this.ball.kind === 'special' ? 1.4 : 0.8);
    this.stage.cheer(this.ball.kind === 'special' ? 1 : 0.6);
    const labels = { in: '¡PUNTO!', out: '¡FUERA!', net: '¡RED!', 'own-side': '¡FALTA!', unstoppable: '¡IMPARABLE!' };
    const bp = this.ball.screenPos();
    this.fx.floatText(bp.x, Math.min(bp.y, 520) - 60, labels[reason], reason === 'in' || reason === 'unstoppable' ? '#ffe14d' : '#ffffff', 40);
    // plano de celebración: zoom suave al ganador
    const wp = project(w.x, 1, w.z);
    this.time.delayedCall(450, () => {
      this.dir.cut({ x: wp.x - w.side * 120, y: wp.y - 40, zoom: this.baseZoom() * 1.18, panTime: 0.7, zoomTime: 0.8, priority: 1, duration: 1.7 }, this.now);
    });
    this.time.delayedCall(700, () => {
      this.stage.setScore(this.score[-1], this.score[1]);
      this.game.events.emit('point', { score: { a: this.score[-1], b: this.score[1] }, winner, reason });
    });
  }

  // ------------------------------------------------------------------ cámara
  private baseZoom() { return (this.cameras.main.width / VIEW_W) * 1.32; }

  private updateCameraTargets() {
    const d = this.dir;
    const bz = this.baseZoom();
    const b = this.ball;
    if (this.state === 'serve') {
      const s = this.server === -1 ? this.p1 : this.p2;
      const sp = project(s.x, 1, s.z);
      d.followX = sp.x - s.side * 330;
      d.followY = CAM_BASE_Y + 10;
      d.followZoom = bz * 1.06;
      d.panTime = 0.85;
      d.zoomTime = 0.9;
      return;
    }
    const bp = b.screenPos();
    const receiver = b.lastHitter === -1 ? this.p2 : b.lastHitter === 1 ? this.p1 : null;
    const lead = b.vx * 0.38 * PPM;
    let fx = bp.x + lead;
    if (receiver && this.state === 'rally') {
      const rp = project(receiver.x, 1, receiver.z);
      fx = (bp.x + lead) * 0.62 + rp.x * 0.38;
    }
    d.followX = fx;
    // la cámara "levanta la vista" con los globos
    d.followY = CAM_BASE_Y + Math.min(0, bp.y - 330) * 0.5;
    const high = Phaser.Math.Clamp((b.y - 3) / 5, 0, 1);
    d.followZoom = bz * (1.02 - high * 0.12);
    d.panTime = this.specialFlight ? 0.16 : b.kind === 'smash' || b.kind === 'drive' ? 0.38 : 0.55;
    d.zoomTime = 0.7;
    if (this.specialFlight) d.followZoom = bz * 1.07;
  }

  // ------------------------------------------------------------------ tiempo
  private slowmo(scale: number, realSeconds: number) {
    this.slowScale = scale;
    this.slowUntil = this.now + realSeconds;
  }
  private hitstop(realSeconds: number) { this.freezeUntil = this.now + realSeconds; }

  private computeTimeScale(realDt: number) {
    let target = 1;
    if (this.now < this.freezeUntil) target = 0.02;
    else if (this.now < this.slowUntil) target = this.slowScale;
    // al salir de la cámara lenta, recupera velocidad de forma progresiva
    if (target < this.timeScale) this.timeScale = target;
    else this.timeScale = Math.min(target, this.timeScale + realDt * 2.5);
    return this.timeScale;
  }

  // ------------------------------------------------------------------ bucle
  update(time: number, delta: number) {
    const realDt = Math.min(delta / 1000, 1 / 20);
    this.now += realDt;
    const ts = this.computeTimeScale(realDt);
    const dt = realDt * ts;
    this.fx.setTimeScale(ts);
    this.tweens.timeScale = Math.max(0.25, ts);
    this.stateT += realDt;

    const intents = new Map<Side, Intent>();
    for (const p of [this.p1, this.p2]) {
      const ai = this.ai.get(p.side);
      const opp = p === this.p1 ? this.p2 : this.p1;
      if (ai) intents.set(p.side, ai.think(dt, this.ball, opp, this.state === 'serve' && this.server === p.side));
      else intents.set(p.side, this.humanIntent(p));
    }

    for (const p of [this.p1, this.p2]) {
      const it = intents.get(p.side)!;
      const wasAir = p.airborne;
      const serving = this.state === 'serve' && this.server === p.side;
      if (this.state === 'serve') {
        // en el saque: el que saca sólo se mueve a lo largo de la línea de fondo
        p.update(dt, { ...it, mx: 0, jump: false, mz: serving ? it.mz : 0 }, serving);
      } else p.update(dt, it, this.state !== 'over');
      if (!wasAir && p.airborne) sfx.jump();
      if (wasAir && !p.airborne) { sfx.land(); const g = project(p.x, 0, p.z); this.fx.sandPuff(g.x, g.y, 10); }
      for (const e of p.events) if (e === 'skid') { const g = project(p.x + p.vx * 0.05, 0, p.z); this.fx.sandPuff(g.x, g.y, 6); }
      p.events.length = 0;
      // anticipación: la pala se prepara sola cuando la bola viene hacia este jugador
      const b = this.ball;
      if (b.live && !b.held && b.lastHitter !== p.side && Math.abs(b.vx) > 0.5) {
        const tReach = Math.abs((p.x - b.x) / b.vx);
        p.prep = Phaser.Math.Clamp(1 - (tReach - 0.15) / 0.45, 0, 1);
      } else p.prep = Math.max(0, p.prep - realDt * 4);
      if (!this.ai.has(p.side)) this.runAutoSmash(p);
      if (it.special) this.activateSpecial(p);
      if (it.hit) {
        if (serving && this.ball.held && this.serveTimer < 0) this.startServe(p);
        else if (this.state === 'rally' && p.swingT >= 0.7) {
          const plan = this.ai.has(p.side) ? null : this.humanPlan;
          if (plan && plan.smash && !p.airborne && getSettings().autoSmash) {
            // remate automático: salta en el momento justo y remata en el aire
            this.smashQueued = true;
          } else {
            p.hitBuffer = 0.24;
            p.lastBallDist = 99;
            this.pressLead = plan ? plan.t : 0.12;
            // con asistencia el golpe espera a la bola (la calidad depende del momento de pulsar)
            if (plan && getSettings().assist) p.hitBuffer = Math.min(0.6, plan.t + 0.15);
            p.startSwing(p.airborne && this.ball.y > 1.9 ? 'over' : 'fore');
            sfx.whoosh();
          }
        }
      }
      if (p.powered) {
        const pp = project(p.x, p.y, p.z);
        this.fx.moveAura(p.theme, pp.x, pp.y, pp.k);
      }
    }

    // saque: bola en la mano / lanzamiento
    if (this.state === 'serve') {
      const s = this.server === -1 ? this.p1 : this.p2;
      if (this.serveTimer >= 0) {
        this.serveTimer += dt;
        const t = this.serveTimer;
        this.ball.x = s.x + s.facing * 0.35; this.ball.z = s.z - 0.1;
        this.ball.y = 1.0 + Math.sin(Math.min(1, t / 0.5) * Math.PI * 0.8) * 1.6;
        if (t > 0.42) this.launchServe(s);
      } else {
        this.ball.x = s.x + s.facing * 0.35; this.ball.y = 0.95 + Math.sin(this.now * 3) * 0.05; this.ball.z = s.z - 0.1;
      }
    }

    // golpeo
    if (this.state === 'rally') {
      for (const p of [this.p1, this.p2]) this.tryContact(p);
    }

    // física de la bola
    const ev = this.ball.update(dt);
    if (ev) this.onBallEvent(ev);

    // cámara primero: el punto de fuga de la perspectiva sigue a la cámara
    this.updateCameraTargets();
    const cam = this.dir.update(realDt, this.now);
    view.vpx = cam.x;
    this.stage.applyParallax(cam.x, cam.y, cam.zoom);
    this.stage.drawCourt();
    this.stage.drawNet();
    this.stage.update(realDt, time);
    // remate automático: arma el brazo al subir
    if (this.autoOver && this.p1.airborne && this.p1.vy < 2.8 && this.p1.stage === 'none') { this.p1.startSwing('over'); sfx.whoosh(); }
    if (!this.p1.airborne && this.p1.stage === 'none') this.autoOver = false;
    this.drawRing();
    // render
    this.p1.render(time);
    this.p2.render(time);
    this.ball.render();

    // fin de punto
    if (this.state === 'point' && this.stateT > 2.6) {
      const over = this.rules.isMatchOver(this.score[-1], this.score[1]);
      if (over) this.endMatch(over);
      else this.setupServe(this.lastWinnerSide); // saca quien gana el punto
    }
    if (this.state === 'over' && this.cfg.mode === 'attract' && this.stateT > 3) this.scene.restart(this.cfg);
    this.emitHudThrottled();
  }

  private lastWinnerSide: Side = -1;

  private startServe(p: Player) {
    this.serveTimer = 0;
    p.startSwing('serve');
  }

  private launchServe(p: Player) {
    const ai = this.ai.get(p.side);
    const aimZ = ai ? ai.wantShot.aimZ : Math.abs(playerInput.my) > 0.3 ? (playerInput.my + 1) / 2 : Math.random();
    const from = { x: this.ball.x, y: 2.3, z: this.ball.z };
    this.ball.y = 2.3;
    const v = computeShot(from, p.side, 'serve', aimZ, 0.92);
    this.ball.launch(v.vx, v.vy, v.vz, p.side, 'serve', p.theme);
    this.state = 'rally';
    this.serveTimer = -1;
    this.rallyHits = 1;
    p.contact('serve', true);
    { const sp = project(p.x, 2, p.z); this.fx.swoosh(sp.x, sp.y, p.facing, true, sp.k, null); }
    sfx.hit(0.6);
    const bp = this.ball.screenPos();
    this.fx.hitSpark(bp.x, bp.y);
  }

  private humanPlan: InterceptPlan | null = null;
  private smashQueued = false;
  private pressLead = 0.12;
  private ring?: Phaser.GameObjects.Graphics;

  /** Entrada del jugador humano, con movimiento asistido opcional (como en el vídeo: siempre llega a la bola). */
  private humanIntent(p: Player): Intent {
    const it: Intent = {
      mx: playerInput.mx, mz: playerInput.my,
      hit: playerInput.consumeHit(), jump: playerInput.consumeJump(), special: playerInput.consumeSpecial(),
    };
    const b = this.ball;
    const st = getSettings();
    this.humanPlan = this.state === 'rally' && b.live && !b.held && b.lastHitter !== p.side ? planIntercept(b, p, st.autoSmash) : null;
    if (st.assist && this.state === 'rally' && Math.hypot(it.mx, it.mz) < 0.55) {
      const tgt = this.humanPlan ?? { x: p.side * 5.2, z: 4 + (b.z - 4) * 0.35 };
      const dx = tgt.x - p.x, dz = tgt.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const sp = Math.min(1, dist / 0.5) * (this.humanPlan ? 1 : 0.7);
        it.mx = (dx / dist) * sp;
        it.mz = ((dz / dist) * sp) / 0.85;
      } else { it.mx = 0; it.mz = 0; }
    }
    if (!this.humanPlan) this.smashQueued = false;
    return it;
  }

  /** Remate automático: salta cuando falta lo justo para que la bola llegue arriba. */
  private runAutoSmash(p: Player) {
    const plan = this.humanPlan;
    if (!this.smashQueued || !plan) return;
    const jumpTime = PHYS.jumpV / PHYS.gravity * 0.9 + 0.05;
    if (!p.airborne && plan.smash && plan.t <= jumpTime) {
      p.update(0, { mx: 0, mz: 0, hit: false, jump: true, special: false }, true);
      p.hitBuffer = 0.9;
      p.lastBallDist = 99;
      this.pressLead = 0.12;
      this.smashQueued = false;
      this.autoOver = true;
    }
  }
  private autoOver = false;

  /** Anillo de golpeo en la arena: se cierra hasta el contacto y se pone verde en el momento perfecto. */
  private drawRing() {
    if (!this.ring) this.ring = this.add.graphics().setDepth(97);
    const g = this.ring;
    g.clear();
    const plan = this.humanPlan;
    const human = this.ai.has(-1) ? null : this.p1;
    if (!plan || !human || this.cfg.mode !== 'play') return;
    const c = project(plan.bx, 0, plan.bz);
    const perfect = Math.abs(plan.t - 0.12) < 0.08;
    const col = plan.smash ? 0xff8a1f : perfect ? 0x4dff6a : 0xffffff;
    const r = (26 + Math.min(1.2, plan.t) * 90) * c.k;
    g.lineStyle(4 * c.k, col, 0.9).strokeEllipse(c.x, c.y, r * 2, r * 0.7);
    g.lineStyle(3 * c.k, col, 0.6).strokeEllipse(c.x, c.y, 26 * c.k * 2, 26 * c.k * 0.7);
    g.fillStyle(col, perfect ? 0.35 : 0.15).fillEllipse(c.x, c.y, 26 * c.k * 2, 26 * c.k * 0.7);
  }

  private activateSpecial(p: Player) {
    if (p.meter < 1 || p.powered || this.state === 'over') return;
    p.meter = 0;
    p.powered = true;
    const pp = project(p.x, p.y, p.z);
    this.fx.startAura(p.theme, pp.x, pp.y);
    this.fx.powerBurst(p.theme, pp.x, pp.y);
    sfx.powerUp();
    this.stage.cheer(0.5);
    this.face(p.side, 3, 1.6);
    this.face(p.side === -1 ? 1 : -1, 4, 1.6);
    // mini-cinemática: punch-in sobre el jugador + cámara lenta breve
    this.slowmo(0.3, 0.45);
    this.dir.cut({ x: pp.x + p.facing * 60, y: pp.y - 70, zoom: this.baseZoom() * 1.18, panTime: 0.2, zoomTime: 0.18, priority: 2, duration: 0.5 }, this.now);
    this.dir.kick(0.05);
    this.fx.floatText(pp.x, pp.y - 150, '¡PODER!', p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 36);
    this.emitHud();
  }

  private tryContact(p: Player) {
    const b = this.ball;
    if (p.hitBuffer <= 0 || !b.live || b.held || b.lastHitter === p.side) return;
    if (b.x * p.side < -0.25) return;
    const ss = p.sweetSpot();
    const d = Math.hypot(b.x - ss.x, (b.y - ss.y) * 0.75, b.z - ss.z);
    const inReach = d < PHYS.reach && b.y > 0.08 && b.y < PHYS.reachUp + p.y + 0.4;
    const contact = inReach && (d < PHYS.reach * 0.42 || d > p.lastBallDist);
    p.lastBallDist = d;
    if (!contact) return;
    p.hitBuffer = 0;

    const ai = this.ai.get(p.side);
    let q = Phaser.Math.Clamp(0.3 + 0.75 * (1 - d / PHYS.reach), 0, 1);
    if (ai) q = ai.qualityRoll;
    else if (getSettings().assist) {
      // calidad por el momento de pulsar: ideal ~0,12 s antes del contacto (el anillo se pone verde)
      const timing = Phaser.Math.Clamp(1 - Math.abs(this.pressLead - 0.12) / 0.4, 0, 1);
      q = Phaser.Math.Clamp(0.25 + 0.75 * timing, 0, 1);
      if (p.airborne) q = Math.max(q, 0.75);
    }

    // bola especial: sólo se devuelve con un golpe perfecto
    if (b.kind === 'special' && q < 0.86) {
      p.stunned = 0.9;
      p.contact('fore');
      const bp = b.screenPos();
      this.fx.hitSpark(bp.x, bp.y, true);
      this.dir.shake(180, 0.006);
      b.lastHitter = p.side === -1 ? 1 : -1; // sigue su camino
      this.fx.floatText(bp.x, bp.y - 80, '¡NO PUEDE!', '#ffffff', 30);
      this.face(p.side, 4, 1.4);
      return;
    }

    const it = ai ? null : { mx: playerInput.mx, mz: playerInput.my };
    let kind: ShotKind = 'normal';
    let aimZ = 0.5;
    if (ai) { kind = ai.wantShot.kind; aimZ = ai.wantShot.aimZ; }
    else if (it) {
      const fwd = it.mx * p.facing;
      kind = fwd > 0.45 ? 'drive' : fwd < -0.45 ? 'lob' : 'normal';
      aimZ = Math.abs(it.mz) > 0.3 ? (it.mz + 1) / 2 : 0.2 + Math.random() * 0.6;
    }
    if (p.airborne && b.y > 1.9) kind = 'smash';
    const special = p.powered;
    if (special) kind = 'special';

    const v = computeShot({ x: b.x, y: b.y, z: b.z }, p.side, kind, aimZ, special ? 1 : q);
    b.launch(v.vx, v.vy, v.vz, p.side, kind, p.theme);
    this.rallyHits++;
    const over = kind === 'smash' || (special && p.airborne);
    p.contact(over ? 'over' : 'fore', kind === 'smash' || special);
    { const sp = project(p.x, p.y + 1.1, p.z); this.fx.swoosh(sp.x, sp.y, p.facing, over, sp.k, special ? p.theme : null); }

    const bp = b.screenPos();
    const perfect = q > 0.85;
    p.meter = Math.min(1, p.meter + (kind === 'smash' ? 0.22 : 0.13) + (perfect ? 0.18 : 0));
    if (perfect) this.stats.perfects += ai ? 0 : 1;

    if (special) {
      p.powered = false;
      this.fx.stopAura(p.theme);
      this.stats.specials += ai ? 0 : 1;
      this.specialFlight = true;
      sfx.fireShot();
      this.fx.hitSpark(bp.x, bp.y, true);
      this.fx.powerBurst(p.theme, bp.x, bp.y + 50);
      this.fx.startTrail(p.theme, b.sprite);
      // CINEMÁTICA: congelado + zoom fuerte al impacto, luego barrido rápido siguiendo la bola
      this.hitstop(0.13);
      this.slowmo(0.35, 0.6);
      this.dir.cut({ x: bp.x + p.facing * 40, y: bp.y + 10, zoom: this.baseZoom() * 1.27, panTime: 0.1, zoomTime: 0.1, priority: 3, duration: 0.42 }, this.now);
      this.dir.kick(0.08);
      this.dir.flash(90, p.theme === 'sun' ? 255 : 160, p.theme === 'sun' ? 200 : 255, p.theme === 'sun' ? 120 : 255);
      this.dir.shake(160, 0.004);
      this.stage.cheer(0.8);
      this.fx.floatText(bp.x, bp.y - 90, SPECIAL_NAME[p.theme], p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 42);
      this.face(p.side, 3, 1.4);
    } else {
      sfx.hit(kind === 'smash' ? 1 : kind === 'drive' ? 0.7 : 0.4);
      this.fx.hitSpark(bp.x, bp.y, kind === 'smash' || perfect);
      if (kind === 'smash' || perfect) this.face(p.side, 1, 0.8);
      if (kind === 'smash') {
        this.dir.kick(0.045);
        this.dir.shake(120, 0.003);
        this.slowmo(0.55, 0.12);
        this.stage.cheer(0.35);
      }
      if (perfect && !ai) this.fx.floatText(bp.x, bp.y - 70, '¡PERFECTO!', '#ffe14d', 28);
    }
    this.emitHud();
  }

  private onBallEvent(ev: NonNullable<ReturnType<Ball['update']>>) {
    const b = this.ball;
    if (ev.type === 'net') {
      sfx.netHit();
      if (this.state === 'rally') this.resolve(b.lastHitter === -1 ? 1 : -1, 'net');
      return;
    }
    if (ev.type === 'fence') { sfx.bounce(); if (this.state === 'rally') this.resolve(b.lastHitter === -1 ? 1 : -1, 'out'); return; }
    // suelo
    const g = project(ev.x, 0, ev.z);
    if (this.state !== 'rally') { this.fx.sandPuff(g.x, g.y, 5); return; }
    const inCourt = Math.abs(ev.x) <= COURT.halfLen + 0.05 && ev.z >= -0.05 && ev.z <= COURT.width + 0.05;
    const landedSide: Side = ev.x < 0 ? -1 : 1;
    const hitter = b.lastHitter as Side;
    if (b.kind === 'special' && inCourt && landedSide !== hitter) {
      // IMPACTO del especial
      this.fx.explosion(b.theme, g.x, g.y);
      sfx.explosion();
      this.dir.shake(420, 0.014);
      this.dir.kick(0.07);
      this.dir.flash(160, 255, 240, 200);
      this.hitstop(0.08);
      this.fx.stopTrails();
      this.specialFlight = false;
      const loser = hitter === -1 ? this.p2 : this.p1;
      const lp = project(loser.x, 0, loser.z);
      if (Math.abs(lp.x - g.x) < 120) { loser.stunned = 1; loser.vy = 3; loser.y = 0.05; }
      b.vy = 6; b.vx *= 0.3; b.vz *= 0.3;
      this.resolve(hitter, 'unstoppable');
      return;
    }
    sfx.bounce();
    this.fx.sandPuff(g.x, g.y, 12);
    this.fx.stopTrails();
    this.specialFlight = false;
    if (landedSide === hitter) this.resolve(hitter === -1 ? 1 : -1, 'own-side');
    else if (inCourt) this.resolve(hitter, 'in');
    else this.resolve(hitter === -1 ? 1 : -1, 'out');
  }

  private resolve(winner: Side, reason: Parameters<MatchScene['pointWon']>[1]) {
    this.lastWinnerSide = winner;
    this.pointWon(winner, reason);
  }

  private endMatch(winner: Side) {
    this.state = 'over';
    this.stateT = 0;
    const w = winner === -1 ? this.p1 : this.p2;
    w.mood = 'happy'; w.moodT = 99;
    sfx.cheer(2);
    this.stage.cheer(1);
    this.game.events.emit('match-over', { winner, score: { a: this.score[-1], b: this.score[1] }, mode: this.cfg.mode, stats: { ...this.stats } });
    if (this.cfg.mode === 'play') {
      saveMatch({
        sport: this.rules.id, difficulty: this.cfg.difficulty, points: this.cfg.points,
        scoreA: this.score[-1], scoreB: this.score[1], won: winner === -1, ...this.stats,
      });
    }
  }

  private hudT = 0;
  private emitHudThrottled() {
    this.hudT += 1;
    if (this.hudT % 6 === 0) this.emitHud();
  }
  private emitHud() {
    this.game.events.emit('hud', {
      meterA: this.p1.meter, meterB: this.p2.meter, poweredA: this.p1.powered, poweredB: this.p2.powered,
      score: { a: this.score[-1], b: this.score[1] }, serving: this.state === 'serve' && this.server === -1 && !this.ai.has(-1),
      names: [this.p1.name, this.p2.name],
    });
  }
}
