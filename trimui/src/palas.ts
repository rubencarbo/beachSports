// PALAS DE PLAYA 1 vs 1 (port de src/scenes/MatchScene.ts sin Phaser).
import { COURT, PHYS, PPM, project } from '../../src/config';
import { AI_LEVELS, AiController, InterceptPlan, planIntercept } from '../../src/entities/Ai';
import { BallPhysics, ShotKind } from '../../src/entities/ballPhysics';
import { Intent, PlayerCore } from '../../src/entities/playerCore';
import { DEPTH, computeShot } from '../../src/entities/shots';
import { getChar } from '../../src/game/charData';
import { rallyScoring } from '../../src/sports/types';
import type { Side } from '../../src/sports/types';
import { sfx } from './audio';
import { play } from './input';
import { settings } from './settings';
import { Sim, Zone } from './sim';
import { BallView, CAM_BASE_Y, RigView } from './world';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const SPECIAL_NAME = { sun: '¡METEORO SOLAR!', wave: '¡TSUNAMI!' };
const SERVE_VY = 6.6;

export interface PalasConfig { mode: 'play' | 'attract'; difficulty: 'facil' | 'normal' | 'dificil'; points: number; p1: string; p2: string; venue: string }

export class Palas extends Sim {
  p1: PlayerCore; p2: PlayerCore;
  ai = new Map<Side, AiController>();
  server: Side = -1;
  private serveTimer = -1;
  rallyHits = 0;
  private specialFlight = false;
  private lastWinnerSide: Side = -1;
  private aiServeTarget = 0.9;
  private prevMeter = 0;
  humanPlan: InterceptPlan | null = null;
  private smashQueued = false;
  private pressLead = 0.12;
  private autoOver = false;
  private isOver: (a: number, b: number) => Side | 0;

  constructor(public cfg: PalasConfig) {
    super(cfg.venue, cfg.mode);
    this.isOver = rallyScoring(cfg.points, 2);
    this.ball = new BallPhysics();
    this.ballView = new BallView(this.ball);
    this.p1 = new PlayerCore(-1, getChar(cfg.p1));
    this.p2 = new PlayerCore(1, getChar(cfg.p2));
    this.views = [new RigView(this.p1), new RigView(this.p2)];
    const lvl = AI_LEVELS[cfg.difficulty];
    if (cfg.mode === 'attract') this.ai.set(-1, new AiController(this.p1 as any, AI_LEVELS.dificil));
    this.ai.set(1, new AiController(this.p2 as any, cfg.mode === 'attract' ? AI_LEVELS.dificil : lvl));
    if (cfg.mode === 'attract') { this.p1.meter = 0.6; this.p2.meter = 0.8; }
    this.hud.names = [this.p1.name, this.p2.name];
    this.setupServe(Math.random() < 0.5 ? -1 : 1);
    this.updateCameraTargets(); this.cam.snap();
    play.reset();
  }
  players() { return [this.p1, this.p2]; }
  private baseZoom() { return 1.4; }

  private matchPoint() { const a = this.score[-1], b = this.score[1], n = this.cfg.points; return (a >= n - 1 && a > b) || (b >= n - 1 && b > a); }

  private setupServe(server: Side) {
    this.hud.rally = 0; this.hud.serve.phase = 'hide';
    if (this.mode === 'play' && this.matchPoint()) this.later(0.3, () => this.banner('¡PUNTO DE PARTIDO!'));
    this.server = server; this.state = 'serve'; this.stateT = 0; this.serveTimer = -1; this.rallyHits = 0; this.specialFlight = false;
    const b = this.ball;
    b.live = false; b.held = true; b.hitNet = false; b.lastHitter = 0; b.kind = 'normal';
    this.ballView.clearTrail();
    for (const p of [this.p1, this.p2]) {
      p.mood = 'none'; p.stunned = 0; p.vy = 0; p.y = 0;
      p.x = p.side * (p.side === server ? 7.6 : 5.6);
      p.z = p.side === server ? 3.2 + Math.random() * 1.6 : 4;
    }
  }

  private pointWon(winner: Side, reason: 'in' | 'out' | 'net' | 'own-side' | 'unstoppable') {
    if (this.state !== 'rally') return;
    this.state = 'point'; this.stateT = 0;
    this.stats.longestRally = Math.max(this.stats.longestRally, this.rallyHits);
    this.score[winner]++;
    const w = winner === -1 ? this.p1 : this.p2, l = winner === -1 ? this.p2 : this.p1;
    w.mood = 'happy'; w.moodT = 2.2; l.mood = 'sad'; l.moodT = 2.2;
    sfx.whistle();
    sfx.cheer(reason === 'unstoppable' || this.ball.kind === 'special' ? 1.4 : 0.8);
    this.stage.cheer(this.ball.kind === 'special' ? 1 : 0.6);
    const labels = { in: '¡PUNTO!', out: '¡FUERA!', net: '¡RED!', 'own-side': '¡FALTA!', unstoppable: '¡IMPARABLE!' };
    const bp = project(this.ball.x, this.ball.y, this.ball.z);
    this.fx.floatText(bp.x, Math.min(bp.y, 520) - 60, labels[reason], reason === 'in' || reason === 'unstoppable' ? '#ffe14d' : '#ffffff', 40);
    const wp = project(w.x, 1, w.z);
    this.later(0.45, () => this.cam.cut({ x: wp.x - w.side * 120, y: wp.y - 40, zoom: this.baseZoom() * 1.18, panTime: 0.7, zoomTime: 0.8, priority: 1, duration: 1.7 }, this.now));
    this.later(0.7, () => { this.stage.score = [this.score[-1], this.score[1]]; });
  }

  private updateCameraTargets() {
    const d = this.cam, bz = this.baseZoom(), b = this.ball;
    if (this.state === 'serve') {
      const s = this.server === -1 ? this.p1 : this.p2;
      const sp = project(s.x, 1, s.z);
      d.followX = sp.x - s.side * 330; d.followY = CAM_BASE_Y + 10; d.followZoom = bz * 1.06; d.panTime = 0.85; d.zoomTime = 0.9;
      return;
    }
    const bp = project(b.x, b.y, b.z);
    const receiver = b.lastHitter === -1 ? this.p2 : b.lastHitter === 1 ? this.p1 : null;
    const lead = b.vx * 0.38 * PPM;
    let fx = bp.x + lead;
    if (receiver && this.state === 'rally') { const rp = project(receiver.x, 1, receiver.z); fx = (bp.x + lead) * 0.62 + rp.x * 0.38; }
    d.followX = fx;
    d.followY = CAM_BASE_Y + Math.min(0, bp.y - 330) * 0.5;
    const high = clamp((b.y - 3) / 5, 0, 1);
    d.followZoom = bz * (1.02 - high * 0.07);
    d.panTime = this.specialFlight ? 0.16 : b.kind === 'smash' || b.kind === 'drive' ? 0.38 : 0.55;
    d.zoomTime = 0.7;
    if (this.specialFlight) d.followZoom = bz * 1.07;
  }

  protected tick(dt: number, realDt: number) {
    const intents = new Map<Side, Intent>();
    if (this.mode === 'play') play.read();
    for (const p of [this.p1, this.p2]) {
      const ai = this.ai.get(p.side), opp = p === this.p1 ? this.p2 : this.p1;
      intents.set(p.side, ai ? ai.think(dt, this.ball as any, opp as any, this.state === 'serve' && this.server === p.side) : this.humanIntent(p));
    }
    for (const p of [this.p1, this.p2]) {
      const it = intents.get(p.side)!;
      const wasAir = p.airborne;
      const serving = this.state === 'serve' && this.server === p.side;
      if (this.state === 'serve') p.update(dt, { ...it, mx: 0, jump: false, mz: serving ? it.mz : 0 }, serving);
      else p.update(dt, it, this.state !== 'over');
      if (!wasAir && p.airborne) sfx.jump();
      if (wasAir && !p.airborne) { sfx.land(); const g = project(p.x, 0, p.z); this.fx.sandPuff(g.x, g.y, 10); }
      for (const e of p.events) if (e === 'skid') { const g = project(p.x + p.vx * 0.05, 0, p.z); this.fx.sandPuff(g.x, g.y, 6); }
      p.events.length = 0;
      const b = this.ball;
      if (b.live && !b.held && b.lastHitter !== p.side && Math.abs(b.vx) > 0.5) {
        const tReach = Math.abs((p.x - b.x) / b.vx);
        p.prep = clamp(1 - (tReach - 0.15) / 0.45, 0, 1);
      } else p.prep = Math.max(0, p.prep - realDt * 4);
      if (!this.ai.has(p.side)) this.runAutoSmash(p);
      if (it.special) this.activateSpecial(p);
      if (it.hit) {
        if (serving && this.ball.held && this.serveTimer < 0) this.startServe(p);
        else if (serving && this.ball.held && this.serveTimer >= 0.12 && !this.ai.has(p.side)) this.hitServe(p);
        else if (this.state === 'rally' && p.swingT >= 0.7) {
          const plan = this.ai.has(p.side) ? null : this.humanPlan;
          if (plan && plan.smash && !p.airborne && settings.autoSmash) this.smashQueued = true;
          else {
            p.hitBuffer = 0.24; p.lastBallDist = 99;
            this.pressLead = plan ? plan.t : 0.12;
            if (plan && settings.movement !== 'manual') p.hitBuffer = Math.min(0.6, plan.t + 0.15);
            p.startSwing(p.airborne && this.ball.y > 1.9 ? 'over' : 'fore');
            sfx.whoosh();
          }
        }
      }
      if (p.powered) { const pp = project(p.x, p.y, p.z); this.fx.moveAura(p.theme, pp.x, pp.y, pp.k); }
    }

    if (this.state === 'serve') {
      const s = this.server === -1 ? this.p1 : this.p2;
      if (this.serveTimer >= 0) {
        this.serveTimer += dt;
        const t = this.serveTimer;
        this.ball.x = s.x + s.facing * 0.35; this.ball.z = s.z - 0.1;
        this.ball.y = 1.0 + SERVE_VY * t - 0.5 * PHYS.gravity * t * t;
        const v = this.serveMeter(), human = !this.ai.has(s.side);
        if (human) { this.hud.serve.phase = 'run'; this.hud.serve.v = v; }
        else if (t > 0.3 && (this.prevMeter - this.aiServeTarget) * (v - this.aiServeTarget) <= 0) this.hitServe(s);
        this.prevMeter = v;
        if (this.state === 'serve' && this.ball.y < 1.0 && t > 0.3) {
          this.serveTimer = -1; s.stage = 'none';
          this.ai.get(s.side)?.resetServe();
          if (human) { this.hud.serve.phase = 'hide'; const sp = project(s.x, 2.4, s.z); this.fx.floatText(sp.x, sp.y - 40, '¡OTRA VEZ!', '#ffffff', 34); }
        }
      } else { this.ball.x = s.x + s.facing * 0.35; this.ball.y = 0.95 + Math.sin(this.now * 3) * 0.05; this.ball.z = s.z - 0.1; }
    }
    if (this.state === 'rally') for (const p of [this.p1, this.p2]) this.tryContact(p);
    const ev = this.ball.update(dt);
    if (ev) this.onBallEvent(ev);
    this.updateCameraTargets();
    this.footprints();
    if (this.autoOver && this.p1.airborne && this.p1.vy < 2.8 && this.p1.stage === 'none') { this.p1.startSwing('over'); sfx.whoosh(); }
    if (!this.p1.airborne && this.p1.stage === 'none') this.autoOver = false;
    this.updateRing();
    if (this.state === 'point' && this.stateT > 2.6) {
      const over = this.isOver(this.score[-1], this.score[1]);
      if (over) this.endMatch(over); else this.setupServe(this.lastWinnerSide);
    }
    const h = this.hud;
    h.meters = [this.p1.meter, this.p2.meter]; h.powered = [this.p1.powered, this.p2.powered];
    h.serving = this.mode === 'play' && this.state === 'serve' && this.server === -1 && this.serveTimer < 0;
    h.serveText = 'A: LANZAR LA BOLA · A OTRA VEZ: GOLPEAR';
  }

  private serveMeter() { const ph = this.serveTimer / 0.45, f = ph % 1; return Math.floor(ph) % 2 === 0 ? f : 1 - f; }

  private startServe(p: PlayerCore) {
    this.serveTimer = 0; this.prevMeter = 0;
    p.startSwing('serve'); sfx.whoosh();
    const sigma = this.cfg.difficulty === 'facil' ? 0.2 : this.cfg.difficulty === 'dificil' ? 0.05 : 0.11;
    const g = (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
    this.aiServeTarget = clamp(0.9 + g * sigma, 0.2, 0.995);
  }

  private hitServe(p: PlayerCore) {
    const v = this.serveMeter();
    let zone: Zone, q: number, pow: number;
    if (v > 0.97) { zone = 'over'; q = 0.28; pow = 1; } else if (v >= 0.82) { zone = 'perfect'; q = 1; pow = 1; } else if (v >= 0.6) { zone = 'good'; q = 0.82; pow = 0.65; } else { zone = 'weak'; q = 0.62; pow = 0.3; }
    if (this.ball.y < 2.0) q *= 0.75;
    this.launchServe(p, q, pow);
    if (!this.ai.has(p.side)) {
      this.hud.serve = { phase: 'done', v, zone, t: 0 };
      const sp = project(p.x, 2.6, p.z);
      const txt = { perfect: '¡SAQUE PERFECTO!', good: '¡BUEN SAQUE!', weak: 'SAQUE FLOJO', over: '¡DEMASIADO FUERTE!' }[zone];
      this.fx.floatText(sp.x, sp.y - 50, txt, zone === 'perfect' ? '#ffe14d' : zone === 'over' ? '#ff8a6a' : '#ffffff', zone === 'perfect' ? 36 : 30);
      if (zone === 'perfect') { this.stats.perfects++; this.cam.kick(0.04); }
    }
  }

  private launchServe(p: PlayerCore, quality = 0.92, power = 0.6) {
    const ai = this.ai.get(p.side);
    const aimZ = ai ? ai.wantShot.aimZ : Math.abs(play.my) > 0.3 ? (play.my + 1) / 2 : Math.random();
    const from = { x: this.ball.x, y: Math.max(1.2, this.ball.y), z: this.ball.z };
    const v = computeShot(from, p.side, 'serve', aimZ, clamp(quality + p.controlBonus, 0, 1), (1 - 0.36 * power) * p.powerMul);
    this.ball.launch(v.vx, v.vy, v.vz, p.side, 'serve', p.theme);
    this.state = 'rally'; this.serveTimer = -1; this.rallyHits = 1;
    p.contact('serve', true);
    sfx.hit(0.4 + power * 0.5);
    const bp = project(this.ball.x, this.ball.y, this.ball.z);
    this.fx.hitSpark(bp.x, bp.y, power > 0.9);
  }

  private humanIntent(p: PlayerCore): Intent {
    const it: Intent = { mx: play.mx, mz: play.my, hit: play.consumeHit(), jump: play.consumeJump(), special: play.consumeSpecial() };
    const b = this.ball;
    this.humanPlan = this.state === 'rally' && b.live && !b.held && b.lastHitter !== p.side ? planIntercept(b as any, p as any, settings.autoSmash) : null;
    if (settings.movement === 'semi' && this.state === 'rally' && this.humanPlan) {
      const plan = this.humanPlan, dx = plan.x - p.x, dz = plan.z - p.z, dist = Math.hypot(dx, dz), R = 2.6;
      if (dist > 0.08 && dist < R) {
        const stick = Math.hypot(it.mx, it.mz);
        const pull = stick < 0.3 ? Math.min(1, dist / 0.5) : 0.35 + 0.45 * (1 - dist / R);
        let mx = (stick < 0.3 ? 0 : it.mx) + (dx / dist) * pull, mz = (stick < 0.3 ? 0 : it.mz) + ((dz / dist) * pull) / 0.85;
        const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        it.mx = mx; it.mz = mz;
      }
    } else if (settings.movement === 'assist' && this.state === 'rally' && (this.humanPlan || Math.hypot(it.mx, it.mz) < 0.55)) {
      const tgt = this.humanPlan ?? { x: p.side * 5.2, z: 4 + (b.z - 4) * 0.35 };
      const dx = tgt.x - p.x, dz = tgt.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 0.1) { const sp = Math.min(1, dist / 0.5) * (this.humanPlan ? 1 : 0.7); it.mx = (dx / dist) * sp; it.mz = ((dz / dist) * sp) / 0.85; }
      else { it.mx = 0; it.mz = 0; }
    }
    if (!this.humanPlan) this.smashQueued = false;
    return it;
  }

  private runAutoSmash(p: PlayerCore) {
    const plan = this.humanPlan;
    if (!this.smashQueued || !plan) return;
    const jumpTime = (PHYS.jumpV / PHYS.gravity) * 0.9 + 0.05;
    if (!p.airborne && plan.smash && plan.t <= jumpTime) {
      p.update(0, { mx: 0, mz: 0, hit: false, jump: true, special: false }, true);
      p.hitBuffer = 0.9; p.lastBallDist = 99; this.pressLead = 0.12; this.smashQueued = false; this.autoOver = true;
    }
  }

  private humanAim(p: PlayerCore): { kind: ShotKind; aimZ: number } {
    const fwd = play.mx * p.facing;
    const kind: ShotKind = fwd > 0.45 ? 'drive' : fwd < -0.45 ? 'lob' : 'normal';
    const opp = p === this.p1 ? this.p2 : this.p1;
    const aimZ = Math.abs(play.my) > 0.3 ? (play.my + 1) / 2 : opp.z > COURT.width / 2 ? 0.15 : 0.85;
    return { kind, aimZ };
  }

  private updateRing() {
    const plan = this.humanPlan, human = this.ai.has(-1) ? null : this.p1;
    if (!plan || !human || this.mode !== 'play') { this.ring = null; this.target = null; this.hud.ringLabel = ''; return; }
    const perfect = Math.abs(plan.t - 0.12) < 0.08;
    const col = plan.smash ? '#ff8a1f' : perfect ? '#4dff6a' : '#ffffff';
    this.ring = { x: plan.bx, z: plan.bz, r: 26 + Math.min(1.2, plan.t) * 90, col, fillA: perfect ? 0.35 : 0.15, inner: 26 };
    const aim = plan.smash ? { kind: 'smash' as ShotKind, aimZ: this.humanAim(human).aimZ } : this.humanAim(human);
    if (human.powered) aim.kind = 'special';
    const [d0, d1] = DEPTH[aim.kind];
    const tc = aim.kind === 'lob' ? '#5fd0ff' : aim.kind === 'drive' ? '#ff5a3a' : aim.kind === 'smash' || aim.kind === 'special' ? '#ffb020' : '#ffffff';
    const names: Record<string, string> = { normal: 'NORMAL', drive: 'PLANO', lob: 'GLOBO', smash: 'REMATE', special: 'ESPECIAL', serve: '' };
    this.target = { x: (-human.side * (d0 + d1)) / 2, z: 0.7 + aim.aimZ * (COURT.width - 1.4), col: tc, label: names[aim.kind] };
    this.hud.ringLabel = names[aim.kind];
  }

  private activateSpecial(p: PlayerCore) {
    if (p.meter < 1 || p.powered || this.state === 'over') return;
    p.meter = 0; p.powered = true;
    const pp = project(p.x, p.y, p.z);
    this.fx.startAura(p.theme); this.fx.powerBurst(p.theme, pp.x, pp.y - 60);
    sfx.powerUp(); this.stage.cheer(0.5);
    this.slowmo(0.3, 0.45);
    this.cam.cut({ x: pp.x + p.facing * 60, y: pp.y - 70, zoom: this.baseZoom() * 1.18, panTime: 0.2, zoomTime: 0.18, priority: 2, duration: 0.5 }, this.now);
    this.cam.kick(0.05);
    this.fx.floatText(pp.x, pp.y - 150, '¡PODER!', p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 36);
  }

  private tryContact(p: PlayerCore) {
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
    let q = clamp(0.3 + 0.75 * (1 - d / PHYS.reach), 0, 1);
    if (ai) q = ai.qualityRoll;
    else if (settings.movement !== 'manual') {
      const timing = clamp(1 - Math.abs(this.pressLead - 0.12) / 0.4, 0, 1);
      q = clamp(0.25 + 0.75 * timing, 0, 1);
      if (p.airborne) q = Math.max(q, 0.75);
    }
    if (b.kind === 'special' && q < 0.86) {
      p.stunned = 0.9; p.contact('fore');
      const bp = project(b.x, b.y, b.z);
      this.fx.hitSpark(bp.x, bp.y, true); this.cam.shake(180, 0.006);
      b.lastHitter = p.side === -1 ? 1 : -1;
      this.fx.floatText(bp.x, bp.y - 80, '¡NO PUEDE!', '#ffffff', 30);
      return;
    }
    let kind: ShotKind = 'normal', aimZ = 0.5;
    if (ai) { kind = ai.wantShot.kind; aimZ = ai.wantShot.aimZ; } else ({ kind, aimZ } = this.humanAim(p));
    if (p.airborne && b.y > 1.9) kind = 'smash';
    const special = p.powered;
    if (special) kind = 'special';
    const v = computeShot({ x: b.x, y: b.y, z: b.z }, p.side, kind, aimZ, special ? 1 : clamp(q + p.controlBonus, 0, 1), special ? 1 : p.powerMul);
    b.launch(v.vx, v.vy, v.vz, p.side, kind, p.theme);
    this.rallyHits++;
    if (this.rallyHits >= 4) {
      this.stage.cheer(Math.min(0.75, 0.15 + this.rallyHits * 0.04));
      p.meter = Math.min(1, p.meter + Math.min(0.1, (this.rallyHits - 3) * 0.015));
      if (this.rallyHits % 2 === 0) sfx.cheer(Math.min(1, 0.3 + this.rallyHits * 0.05));
    }
    this.hud.rally = this.rallyHits;
    const over = kind === 'smash' || (special && p.airborne);
    p.contact(over ? 'over' : 'fore', kind === 'smash' || special);
    const bp = project(b.x, b.y, b.z);
    const perfect = q > 0.85;
    p.meter = Math.min(1, p.meter + (kind === 'smash' ? 0.22 : 0.13) + (perfect ? 0.18 : 0));
    if (perfect) this.stats.perfects += ai ? 0 : 1;
    if (special) {
      p.powered = false; this.fx.stopAura(p.theme);
      this.stats.specials += ai ? 0 : 1;
      this.specialFlight = true;
      sfx.fireShot();
      this.fx.hitSpark(bp.x, bp.y, true); this.fx.powerBurst(p.theme, bp.x, bp.y + 50);
      this.hitstop(0.13); this.slowmo(0.35, 0.6);
      this.cam.cut({ x: bp.x + p.facing * 40, y: bp.y + 10, zoom: this.baseZoom() * 1.27, panTime: 0.1, zoomTime: 0.1, priority: 3, duration: 0.42 }, this.now);
      this.cam.kick(0.08);
      this.cam.flash(90, p.theme === 'sun' ? 255 : 160, p.theme === 'sun' ? 200 : 255, p.theme === 'sun' ? 120 : 255);
      this.cam.shake(160, 0.004);
      this.stage.cheer(0.8);
      this.fx.floatText(bp.x, bp.y - 90, SPECIAL_NAME[p.theme], p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 42);
    } else {
      sfx.hit(kind === 'smash' ? 1 : kind === 'drive' ? 0.7 : 0.4);
      this.fx.hitSpark(bp.x, bp.y, kind === 'smash' || perfect);
      if (kind === 'smash') { this.cam.kick(0.045); this.cam.shake(120, 0.003); this.slowmo(0.55, 0.12); this.stage.cheer(0.35); }
      if (perfect && !ai) this.fx.floatText(bp.x, bp.y - 70, '¡PERFECTO!', '#ffe14d', 28);
    }
  }

  private onBallEvent(ev: NonNullable<ReturnType<BallPhysics['update']>>) {
    const b = this.ball;
    if (ev.type === 'net') { sfx.netHit(); if (this.state === 'rally') this.resolve(b.lastHitter === -1 ? 1 : -1, 'net'); return; }
    if (ev.type === 'fence') { sfx.bounce(); if (this.state === 'rally') this.resolve(b.lastHitter === -1 ? 1 : -1, 'out'); return; }
    const g = project(ev.x, 0, ev.z);
    this.fx.decal('mark', g.x, g.y, g.k);
    if (this.state !== 'rally') { this.fx.sandPuff(g.x, g.y, 5); return; }
    const inCourt = Math.abs(ev.x) <= COURT.halfLen + 0.05 && ev.z >= -0.05 && ev.z <= COURT.width + 0.05;
    const landedSide: Side = ev.x < 0 ? -1 : 1;
    const hitter = b.lastHitter as Side;
    if (b.kind === 'special' && inCourt && landedSide !== hitter) {
      this.fx.explosion(b.theme, g.x, g.y); sfx.explosion();
      this.cam.shake(420, 0.014); this.cam.kick(0.07); this.cam.flash(160, 255, 240, 200);
      this.hitstop(0.08); this.specialFlight = false;
      const loser = hitter === -1 ? this.p2 : this.p1, lp = project(loser.x, 0, loser.z);
      if (Math.abs(lp.x - g.x) < 120) { loser.stunned = 1; loser.vy = 3; loser.y = 0.05; }
      b.vy = 6; b.vx *= 0.3; b.vz *= 0.3;
      this.resolve(hitter, 'unstoppable');
      return;
    }
    sfx.bounce(); this.fx.sandPuff(g.x, g.y, 12); this.specialFlight = false;
    if (landedSide === hitter) this.resolve(hitter === -1 ? 1 : -1, 'own-side');
    else if (inCourt) this.resolve(hitter, 'in');
    else this.resolve(hitter === -1 ? 1 : -1, 'out');
  }

  private resolve(winner: Side, reason: 'in' | 'out' | 'net' | 'own-side' | 'unstoppable') { this.lastWinnerSide = winner; this.pointWon(winner, reason); }

  private endMatch(winner: Side) {
    const w = winner === -1 ? this.p1 : this.p2, pp = project(w.x, 1, w.z);
    this.slowmo(0.35, 1.2);
    this.cam.cut({ x: pp.x, y: pp.y - 40, zoom: this.baseZoom() * 1.3, panTime: 0.5, zoomTime: 0.6, priority: 4, duration: 4 }, this.now);
    this.state = 'over'; this.stateT = 0;
    w.mood = 'happy'; w.moodT = 99;
    sfx.cheer(2); this.stage.cheer(1);
    this.result = { winner, score: { a: this.score[-1], b: this.score[1] }, mode: this.mode, stats: { ...this.stats } };
  }
}
