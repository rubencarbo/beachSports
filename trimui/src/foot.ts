// FUTVÓLEY 1 vs 1 (2 toques) y 2 vs 2 (3 toques). Port de src/scenes/FootScene.ts sin Phaser.
import { COURT, PHYS, PPM, project } from '../../src/config';
import { BallPhysics, ShotKind } from '../../src/entities/ballPhysics';
import { Intent, PlayerCore } from '../../src/entities/playerCore';
import { getChar } from '../../src/game/charData';
import { rallyScoring } from '../../src/sports/types';
import type { Side } from '../../src/sports/types';
import { sfx } from './audio';
import { play } from './input';
import { settings } from './settings';
import { Sim, Zone } from './sim';
import { BallView, CAM_BASE_Y, RigView } from './world';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const NET_H = 2.05, REACH = 0.95, G = PHYS.gravity;
type Action = 'control' | 'set' | 'attack';
type Part = 'kick' | 'chest' | 'head' | 'shark';
interface Plan { t: number; x: number; z: number; bx: number; by: number; bz: number; high: boolean }
interface AiSkill { react: number; speed: number; q: [number, number]; shark: number; special: number; early: number; save: number; dig: number }
const SKILL: Record<string, AiSkill> = {
  facil: { react: 0.35, speed: 0.78, q: [0.3, 0.75], shark: 0.15, special: 0.3, early: 0.05, save: 0.0, dig: 0.62 },
  normal: { react: 0.22, speed: 0.9, q: [0.45, 0.9], shark: 0.45, special: 0.55, early: 0.12, save: 0.1, dig: 0.74 },
  dificil: { react: 0.12, speed: 1.0, q: [0.65, 1.0], shark: 0.8, special: 0.85, early: 0.2, save: 0.3, dig: 0.84 },
};
interface Member { p: PlayerCore; human: boolean; skill: AiSkill; react: number; plan: Plan | null; wantShark: boolean; jumped: boolean; q: number; was: boolean; digOk: number }

export interface FootConfig { mode: 'play' | 'attract'; difficulty: 'facil' | 'normal' | 'dificil'; points: number; format: '1v1' | '2v2'; team1: string[]; team2: string[]; venue: string }

export class Foot extends Sim {
  teams: Record<Side, Member[]> = { [-1]: [], [1]: [] } as Record<Side, Member[]>;
  all: Member[] = [];
  private isOver: (a: number, b: number) => Side | 0;
  private server: Side = -1;
  private serverIdx: Record<Side, number> = { [-1]: 0, [1]: 0 } as Record<Side, number>;
  private serveTimer = -1; private aiServeAt = 0; private aiServeTarget = 0.9; private prevMeter = 0;
  touches = 0; lastTeam: Side | 0 = 0; lastToucher: PlayerCore | null = null; lastAction: Action | null = null;
  rallyTouches = 0; receiver: Member | null = null;
  private pressLead = 0.15; private humanPressed = false; private specialFlight = false; private lastWinner: Side = -1;

  constructor(public cfg: FootConfig) {
    super(cfg.venue, cfg.mode);
    this.isOver = rallyScoring(cfg.points, 2);
    this.stage.netH = NET_H;
    this.ball = new BallPhysics();
    this.ball.netH = NET_H; this.ball.size = 1.15;
    this.ballView = new BallView(this.ball);
    this.ballView.tex = 'tex_football'; this.ballView.texW = 64;
    const mk = (side: Side, id: string, human: boolean) => {
      const p = new PlayerCore(side, getChar(id));
      const skill = SKILL[human ? 'normal' : side === -1 ? 'dificil' : cfg.difficulty];
      const m: Member = { p, human, skill, react: 0, plan: null, wantShark: false, jumped: false, q: 0.7, was: false, digOk: -1 };
      this.teams[side].push(m); this.all.push(m);
      this.views.push(new RigView(p, true));
    };
    cfg.team1.forEach((id, i) => mk(-1, id, cfg.mode === 'play' && i === 0));
    cfg.team2.forEach((id) => mk(1, id, false));
    this.hud.names = [cfg.team1.map((i) => getChar(i).name).join(' & ').slice(0, 13), cfg.team2.map((i) => getChar(i).name).join(' & ').slice(0, 13)];
    play.reset();
    this.setupServe(Math.random() < 0.5 ? -1 : 1);
    this.updateCamera(); this.cam.snap();
    if (cfg.mode === 'play') this.later(0.5, () => this.banner(cfg.format === '2v2' ? 'FUTVÓLEY 2 VS 2' : 'FUTVÓLEY 1 VS 1'));
  }
  players() { return this.all.map((m) => m.p); }
  get human() { return this.all.find((m) => m.human); }
  get maxTouches() { return this.cfg.format === '1v1' ? 2 : 3; }

  decide(m: Member, n: number, forward: boolean, roll = Math.random()): Action {
    const p = m.p;
    if (p.powered || n >= this.maxTouches) return 'attack';
    const setForMe = this.lastAction === 'set' && this.lastTeam === p.side && n >= 2;
    if (m.human) return forward || setForMe ? 'attack' : n === 1 ? 'control' : 'set';
    if (this.cfg.format === '1v1') return roll < m.skill.early ? 'attack' : 'control';
    const humanMate = this.teams[p.side].some((o) => o.human && o !== m);
    if (humanMate && roll < 0.85) return 'set';
    if (setForMe) return 'attack';
    return roll < m.skill.early * (n === 2 ? 2 : 1) ? 'attack' : n === 1 ? 'control' : 'set';
  }
  nextTouch(side: Side) { return (this.lastTeam === side ? this.touches : 0) + 1; }

  private setupServe(side: Side) {
    this.hud.rally = 0; this.hud.serve.phase = 'hide';
    const n = this.cfg.points, sa = this.score[-1], sb = this.score[1];
    if (this.mode === 'play' && ((sa >= n - 1 && sa > sb) || (sb >= n - 1 && sb > sa))) this.later(0.3, () => this.banner('¡PUNTO DE PARTIDO!'));
    this.server = side; this.state = 'serve'; this.stateT = 0; this.serveTimer = -1;
    this.aiServeAt = 1.1 + Math.random() * 0.5;
    this.touches = 0; this.lastTeam = 0; this.lastToucher = null; this.rallyTouches = 0; this.lastAction = null; this.specialFlight = false;
    const b = this.ball;
    b.live = false; b.held = true; b.hitNet = false; b.lastHitter = 0; b.kind = 'normal';
    this.ballView.clearTrail();
    const srv = this.teams[side][this.serverIdx[side] % this.teams[side].length];
    for (const s of [-1, 1] as Side[]) {
      this.teams[s].forEach((m, i) => {
        const p = m.p;
        p.mood = 'none'; p.stunned = 0; p.vy = 0; p.y = 0; p.vx = 0; p.vz = 0; p.stage = 'none';
        if (m === srv) { p.x = s * 7.6; p.z = 4; }
        else if (this.teams[s].length === 2) { p.x = s * (s === side ? 3.2 : 5.0); p.z = i === 0 ? 2.3 : 5.7; }
        else { p.x = s * 5.2; p.z = 4; }
        m.plan = null; m.jumped = false; m.wantShark = false;
      });
    }
  }
  serverMember() { return this.teams[this.server][this.serverIdx[this.server] % this.teams[this.server].length]; }
  private serveMeter() { const ph = this.serveTimer / 0.45, f = ph % 1; return Math.floor(ph) % 2 === 0 ? f : 1 - f; }
  private startServe(m: Member) {
    this.serveTimer = 0; this.prevMeter = 0;
    m.p.startSwing('fkserve');
    const sigma = this.cfg.difficulty === 'facil' ? 0.2 : this.cfg.difficulty === 'dificil' ? 0.05 : 0.11;
    this.aiServeTarget = clamp(0.9 + (Math.random() + Math.random() + Math.random() - 1.5) * 1.4 * sigma, 0.2, 0.995);
  }
  private kickServe(m: Member) {
    const v = this.serveMeter();
    let zone: Zone, q: number, pow: number;
    if (v > 0.97) { zone = 'over'; q = 0.3; pow = 1; } else if (v >= 0.82) { zone = 'perfect'; q = 1; pow = 1; } else if (v >= 0.6) { zone = 'good'; q = 0.8; pow = 0.6; } else { zone = 'weak'; q = 0.6; pow = 0.25; }
    const p = m.p, b = this.ball, opp = this.teams[this.other(p.side)];
    const aimZ = m.human && Math.abs(play.my) > 0.3 ? (play.my + 1) / 2 : opp[0].p.z > COURT.width / 2 ? 0.15 : 0.85;
    const tx = -p.side * (4.5 + Math.random() * 2.8), tz = 0.8 + aimZ * (COURT.width - 1.6);
    this.shoot(b, p, tx, tz, 0, (1.55 - 0.45 * pow) * p.powerMul, q + p.controlBonus, 'drive');
    p.contact('fkserve', pow > 0.9);
    this.state = 'rally'; this.serveTimer = -1;
    this.lastTeam = p.side; this.touches = 3; this.lastToucher = p; this.rallyTouches = 1;
    sfx.hit(0.5 + pow * 0.4);
    const bp = project(b.x, b.y, b.z);
    this.fx.hitSpark(bp.x, bp.y, pow > 0.9);
    const g = project(b.x, 0, b.z); this.fx.sandPuff(g.x, g.y, 10);
    if (m.human) {
      this.hud.serve = { phase: 'done', v, zone, t: 0 };
      const sp = project(p.x, 2.6, p.z);
      const txt = { perfect: '¡SAQUE PERFECTO!', good: '¡BUEN SAQUE!', weak: 'SAQUE FLOJO', over: '¡DEMASIADO FUERTE!' }[zone];
      this.fx.floatText(sp.x, sp.y - 50, txt, zone === 'perfect' ? '#ffe14d' : zone === 'over' ? '#ff8a6a' : '#ffffff', zone === 'perfect' ? 36 : 30);
      if (zone === 'perfect') this.stats.perfects++;
    }
  }
  private shoot(b: BallPhysics, p: PlayerCore, tx: number, tz: number, yT: number, T: number, quality: number, kind: ShotKind) {
    const err = Math.pow(1 - clamp(quality, 0, 1), 1.6);
    tx += -p.side * (Math.random() * 2 - 0.6) * err * 3;
    tz += (Math.random() * 2 - 1) * err * 3.2;
    const crosses = Math.sign(tx) !== Math.sign(b.x);
    const clear = quality < 0.3 && Math.random() < 0.5 ? NET_H - 0.3 : NET_H + 0.3;
    let vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < 40; i++) {
      vx = (tx - b.x) / T; vz = (tz - b.z) / T; vy = (yT - b.y + 0.5 * G * T * T) / T;
      if (!crosses) break;
      const tn = (0 - b.x) / vx;
      if (tn <= 0 || b.y + vy * tn - 0.5 * G * tn * tn >= clear) break;
      T += 0.05;
    }
    b.launch(vx, vy, vz, p.side, kind, p.theme);
  }
  private planFor(p: PlayerCore, wantHigh: boolean): Plan | null {
    let found: Plan | null = null;
    const mk = (t: number, x: number, y: number, z: number, high: boolean): Plan => {
      let px = x - p.facing * 0.3;
      px = p.side < 0 ? Math.min(px, -0.5) : Math.max(px, 0.5);
      return { t, x: px, z: z + 0.05, bx: x, by: y, bz: z, high };
    };
    if (wantHigh) this.ball.predict(3, 1 / 60, (t, x, y, z, vy) => { if (x * p.side > 0.6 && x * p.side < 5.5 && vy < 0 && y > 2.0 && y < 2.9) { found = mk(t, x, y, z, true); return true; } return false; });
    if (!found) this.ball.predict(3, 1 / 60, (t, x, y, z, vy) => { if (x * p.side > 0.4 && vy < 0 && y < 1.3) { found = mk(t, x, y, z, false); return true; } return false; });
    return found;
  }
  private playingSide(): Side | 0 {
    let s: Side | 0 = 0;
    this.ball.predict(3, 1 / 60, (_t, x, y, _z, vy) => { if (vy < 0 && y < 1.3) { s = x < 0 ? -1 : 1; return true; } return false; });
    return s;
  }
  private pickReceiver(side: Side): Member | null {
    const team = this.teams[side];
    let cands = team;
    if (team.length === 2 && this.lastTeam === side && this.lastToucher) cands = team.filter((m) => m.p !== this.lastToucher);
    let best: Member | null = null, bd = 1e9;
    for (const m of cands) { const pl = this.planFor(m.p, false); const d = pl ? Math.hypot(pl.x - m.p.x, pl.z - m.p.z) : 99; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  protected tick(dt: number) {
    const b = this.ball;
    this.receiver = null;
    if (this.state === 'rally' && b.live && !b.held) { const ps = this.playingSide(); if (ps) this.receiver = this.pickReceiver(ps); }
    if (this.mode === 'play') play.read();
    const hit = play.consumeHit(), jump = play.consumeJump(), special = play.consumeSpecial();
    for (const m of this.all) {
      const it = m.human ? this.humanIntent(m, hit, jump, special) : this.aiIntent(m, dt);
      const wasAir = m.p.airborne;
      const serving = this.state === 'serve' && m === this.serverMember();
      m.p.update(dt, this.state === 'serve' ? { ...it, mx: 0, mz: serving ? it.mz * 0.6 : 0, jump: false } : it, this.state !== 'over');
      if (!wasAir && m.p.airborne) sfx.jump();
      if (wasAir && !m.p.airborne) { sfx.land(); const g = project(m.p.x, 0, m.p.z); this.fx.sandPuff(g.x, g.y, 10); }
      m.p.events.length = 0;
      if (it.special) this.activateSpecial(m);
      if (it.hit) {
        if (serving && b.held && this.serveTimer < 0) this.startServe(m);
        else if (serving && b.held && this.serveTimer >= 0.12 && m.human) this.kickServe(m);
        else if (this.state === 'rally' && m.human) {
          this.humanPressed = true;
          this.pressLead = m.plan ? m.plan.t : 0.15;
          m.p.hitBuffer = settings.movement !== 'manual' && m.plan ? Math.min(0.7, m.plan.t + 0.2) : 0.3;
          sfx.whoosh();
        }
      }
      if (m.p.powered) { const pp = project(m.p.x, m.p.y, m.p.z); this.fx.moveAura(m.p.theme, pp.x, pp.y, pp.k); }
    }
    for (const s of [-1, 1] as Side[]) {
      const t = this.teams[s];
      if (t.length === 2) {
        const a = t[0].p, c = t[1].p, dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d < 0.9 && d > 0.001) { const k = (0.9 - d) / 2; a.x -= (dx / d) * k; a.z -= (dz / d) * k; c.x += (dx / d) * k; c.z += (dz / d) * k; }
      }
    }
    if (this.state === 'serve') {
      const sm = this.serverMember(), s = sm.p;
      b.x = s.x + s.facing * 0.45; b.z = s.z - 0.05; b.y = 0.16;
      if (this.serveTimer >= 0) {
        this.serveTimer += dt;
        const v = this.serveMeter();
        if (sm.human) { this.hud.serve.phase = 'run'; this.hud.serve.v = v; }
        else if (this.serveTimer > 0.3 && (this.prevMeter - this.aiServeTarget) * (v - this.aiServeTarget) <= 0) this.kickServe(sm);
        this.prevMeter = v;
      } else if (!sm.human && this.stateT > this.aiServeAt) this.startServe(sm);
    }
    if (this.state === 'rally') for (const m of this.all) this.tryTouch(m);
    const ev = b.update(dt);
    if (ev) this.onBallEvent(ev);
    this.updateCamera();
    this.footprints();
    this.updateRing();
    if (this.state === 'point' && this.stateT > 2.6) {
      const over = this.isOver(this.score[-1], this.score[1]);
      if (over) this.endMatch(over); else this.setupServe(this.lastWinner);
    }
    const hum = this.human?.p ?? this.teams[-1][0].p, opp = this.teams[1][0].p;
    this.hud.meters = [hum.meter, opp.meter]; this.hud.powered = [hum.powered, opp.powered];
    this.hud.serving = this.state === 'serve' && this.serverMember().human && this.serveTimer < 0;
    this.hud.serveText = 'A: PREPARAR EL SAQUE · A OTRA VEZ: CHUTAR';
  }

  private humanIntent(m: Member, hit: boolean, jump: boolean, special: boolean): Intent {
    const it: Intent = { mx: play.mx, mz: play.my, hit, jump, special };
    const p = m.p, mine = this.receiver === m;
    m.plan = mine ? this.planFor(p, this.wantsHigh(m)) : null;
    if (this.state !== 'rally') return it;
    const tgt = m.plan ?? (mine ? null : this.supportSpot(m));
    if (settings.movement === 'assist' && tgt) {
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { const sp = Math.min(1, d / 0.5) * (m.plan ? 1 : 0.7); it.mx = (dx / d) * sp; it.mz = ((dz / d) * sp) / 0.85; } else { it.mx = 0; it.mz = 0; }
    } else if (settings.movement === 'semi' && m.plan) {
      const dx = m.plan.x - p.x, dz = m.plan.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.08 && d < 2.6) {
        const stick = Math.hypot(it.mx, it.mz);
        const pull = stick < 0.3 ? Math.min(1, d / 0.5) : 0.35 + 0.45 * (1 - d / 2.6);
        let mx = (stick < 0.3 ? 0 : it.mx) + (dx / d) * pull, mz = (stick < 0.3 ? 0 : it.mz) + ((dz / d) * pull) / 0.85;
        const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
        it.mx = mx; it.mz = mz;
      }
    }
    if (m.plan?.high && settings.autoSmash && this.humanPressed && !p.airborne && m.plan.t < (PHYS.jumpV / G) * 0.95 + 0.05) it.jump = true;
    if (!mine) this.humanPressed = false;
    return it;
  }
  private supportSpot(m: Member): { x: number; z: number } {
    const s = m.p.side, team = this.teams[s];
    if (team.length === 1) return { x: s * 5.0, z: 4 + (this.ball.z - 4) * 0.35 };
    const mate = team.find((o) => o !== m)!;
    const ours = this.receiver && this.receiver.p.side === s;
    if (ours && this.receiver === mate) return { x: s * (this.lastTeam === s && this.touches >= 1 ? 2.2 : 3.4), z: clamp(8 - mate.p.z, 1.5, 6.5) };
    const i = team.indexOf(m);
    return { x: s * 5.2, z: i === 0 ? 2.3 : 5.7 };
  }
  private wantsHigh(m: Member): boolean {
    const n = this.nextTouch(m.p.side);
    const attackNext = n >= this.maxTouches || (this.lastAction === 'set' && this.lastTeam === m.p.side);
    if (m.human && this.decide(m, n, false) !== 'attack') return false;
    return attackNext && (m.human ? settings.autoSmash : Math.random() < m.skill.shark);
  }
  private aiIntent(m: Member, dt: number): Intent {
    const it: Intent = { mx: 0, mz: 0, hit: false, jump: false, special: false };
    const p = m.p;
    if (this.state !== 'rally') { m.plan = null; m.react = m.skill.react * (0.6 + Math.random() * 0.8); return it; }
    const mine = this.receiver === m;
    if (mine && !m.was) {
      m.react = m.skill.react * (0.6 + Math.random() * 0.8);
      const b = this.ball;
      const attack = b.lastHitter !== p.side && (b.kind === 'drive' || b.kind === 'smash' || b.kind === 'lob');
      const chance = m.skill.dig * (b.kind === 'smash' ? 0.7 : b.kind === 'lob' ? 1.1 : 1);
      m.digOk = attack ? (Math.random() < chance ? 1 : 0) : 1;
    }
    m.was = mine;
    if (mine) {
      if (m.react > 0) m.react -= dt;
      if (!m.plan || Math.random() < 0.08) { m.wantShark = m.wantShark || this.wantsHigh(m); m.plan = this.planFor(p, m.wantShark); }
    } else { m.plan = null; m.wantShark = false; m.jumped = false; }
    const late = mine && m.digOk === 0;
    const tgt = mine && m.react <= 0 ? (late && m.plan ? { x: (m.plan.x + p.x) / 2, z: (m.plan.z + p.z) / 2 } : m.plan) : mine ? null : this.supportSpot(m);
    if (tgt) { const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz); if (d > 0.12) { const sp = Math.min(1, d / 0.6) * m.skill.speed; it.mx = (dx / d) * sp; it.mz = (dz / d) * sp; } }
    if (mine && m.plan) {
      it.hit = !late;
      if (m.plan.high && !m.jumped && !p.airborne && m.plan.t < (PHYS.jumpV / G) * 0.95) { it.jump = true; m.jumped = true; }
      if (p.meter >= 1 && !p.powered && this.lastTeam === p.side && this.touches >= 1 && Math.random() < m.skill.special * dt * 3) it.special = true;
    }
    return it;
  }

  private tryTouch(m: Member) {
    const b = this.ball, p = m.p;
    if (!b.live || b.held || this.receiver !== m) return;
    if (m.human && p.hitBuffer <= 0) return;
    if (!m.human && (m.react > 0 || m.digOk === 0)) return;
    if (b.x * p.side < -0.2) return;
    const fx = p.x + p.facing * 0.3, horiz = Math.hypot(b.x - fx, b.z - p.z), yRel = b.y - p.y;
    if (horiz > REACH || yRel < 0.08 || yRel > 2.3) return;
    if (!(b.vy < 0 || yRel < 0.5 || (p.airborne && yRel > 1.2))) return;
    if (b.kind === 'special' && b.lastHitter !== p.side) {
      if (m.human || Math.random() > m.skill.save) {
        p.stunned = 0.9; p.contact('chest');
        const bp = project(b.x, b.y, b.z); this.fx.hitSpark(bp.x, bp.y, true); this.cam.shake(180, 0.006);
        this.fx.floatText(bp.x, bp.y - 80, '¡NO PUEDE!', '#ffffff', 30);
        this.receiver = null;
        return;
      }
    }
    if (this.lastTeam !== p.side) { this.lastTeam = p.side; this.touches = 0; }
    this.touches++; this.rallyTouches++; this.lastToucher = p; p.hitBuffer = 0;
    if (m.human) this.humanPressed = false;
    if (this.touches > this.maxTouches) { this.pointWon(this.other(p.side), 'touches'); return; }
    let q: number;
    if (m.human) {
      const timing = clamp(1 - Math.abs(this.pressLead - 0.15) / 0.45, 0, 1);
      q = settings.movement === 'manual' ? clamp(0.4 + 0.6 * (1 - horiz / REACH), 0, 1) : 0.3 + 0.7 * timing;
      if (p.airborne) q = Math.max(q, 0.75);
    } else q = m.skill.q[0] + Math.random() * (m.skill.q[1] - m.skill.q[0]);
    q = clamp(q + p.controlBonus, 0, 1);
    const team = this.teams[p.side], mate = team.find((o) => o !== m);
    const action = this.decide(m, this.touches, play.mx * p.facing > 0.45);
    this.lastAction = action;
    const part: Part = p.airborne && yRel > 1.3 ? (action === 'attack' ? 'shark' : 'head') : yRel > 1.45 ? 'head' : yRel > 0.85 ? 'chest' : 'kick';
    p.contact(part, part === 'shark' || action === 'attack');
    const bp0 = project(b.x, b.y, b.z);
    if (action !== 'attack') {
      let tx: number, tz: number;
      if (action === 'control') { if (mate) { tx = mate.p.x; tz = mate.p.z; } else { tx = p.side * 2.6; tz = clamp(p.z, 1, 7); } }
      else { const atk = mate ?? m; tx = p.side * 1.7; tz = clamp(atk.p.z, 1.2, 6.8); }
      const T = action === 'control' ? 1.05 : 1.15;
      this.shoot(b, p, tx, tz, action === 'set' ? 2.2 : mate ? 1.1 : 1.5, T, Math.min(1, q + 0.2), 'normal');
      sfx.hit(0.25);
      this.fx.hitSpark(bp0.x, bp0.y, false);
      if (m.human && q > 0.85) { this.fx.floatText(bp0.x, bp0.y - 70, action === 'control' ? '¡BUEN CONTROL!' : '¡GRAN LEVANTADA!', '#ffe14d', 26); this.stats.perfects++; }
      p.meter = Math.min(1, p.meter + 0.08 + (q > 0.85 ? 0.06 : 0));
    } else {
      const opp = this.teams[this.other(p.side)];
      const human = m.human;
      const aimZ = human && Math.abs(play.my) > 0.3 ? (play.my + 1) / 2 : opp.reduce((s, o) => s + o.p.z, 0) / opp.length > COURT.width / 2 ? 0.12 : 0.88;
      const lob = human ? play.mx * p.facing < -0.45 : Math.random() < 0.15;
      const tz = 0.7 + aimZ * (COURT.width - 1.4);
      let tx = -p.side * (2.5 + Math.random() * 4.2), T = 1.0, kind: ShotKind = 'drive';
      if (p.powered) { T = 0.5; kind = 'special'; tx = -p.side * (3 + Math.random() * 3); }
      else if (part === 'shark') { T = 0.55; kind = 'smash'; tx = -p.side * (2 + Math.random() * 3.5); }
      else if (lob) { T = 1.7; kind = 'lob'; tx = -p.side * (6 + Math.random() * 1.4); }
      else if (part === 'head') T = 1.05;
      else if (part === 'chest') { T = 1.25; q *= 0.8; }
      this.shoot(b, p, tx, tz, 0, T * (p.powered ? 1 : p.powerMul), p.powered ? 1 : q, kind);
      p.meter = Math.min(1, p.meter + 0.12);
      if (p.powered) this.fireSpecial(m);
      else {
        sfx.hit(part === 'shark' ? 1 : 0.65);
        this.fx.hitSpark(bp0.x, bp0.y, part === 'shark');
        if (part === 'shark') {
          this.cam.kick(0.05); this.cam.shake(140, 0.004); this.slowmo(0.45, 0.25); this.stage.cheer(0.5);
          this.fx.floatText(bp0.x, bp0.y - 80, '¡SHARK ATTACK!', '#ffb020', 34);
        }
      }
    }
    if (this.rallyTouches >= 6) this.stage.cheer(Math.min(0.7, 0.1 + this.rallyTouches * 0.03));
    this.hud.rally = this.rallyTouches;
    const tp = project(p.x, p.y + 2.6, p.z);
    if (this.touches <= 3 && action !== 'attack') this.fx.floatText(tp.x, tp.y, `${this.touches}.º TOQUE`, '#fff3d6', 20);
  }

  private activateSpecial(m: Member) {
    const p = m.p;
    if (p.meter < 1 || p.powered || this.state === 'over') return;
    p.meter = 0; p.powered = true;
    const pp = project(p.x, p.y, p.z);
    this.fx.startAura(p.theme); this.fx.powerBurst(p.theme, pp.x, pp.y - 60);
    sfx.powerUp();
    this.slowmo(0.3, 0.45);
    this.cam.cut({ x: pp.x + p.facing * 60, y: pp.y - 70, zoom: 1.36 * 1.18, panTime: 0.2, zoomTime: 0.18, priority: 2, duration: 0.5 }, this.now);
    this.fx.floatText(pp.x, pp.y - 150, '¡PODER!', p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 36);
  }
  private fireSpecial(m: Member) {
    const p = m.p, b = this.ball;
    p.powered = false; this.fx.stopAura(p.theme);
    if (m.human) this.stats.specials++;
    this.specialFlight = true;
    sfx.fireShot();
    const bp = project(b.x, b.y, b.z);
    this.fx.hitSpark(bp.x, bp.y, true); this.fx.powerBurst(p.theme, bp.x, bp.y + 50);
    this.freezeUntil = this.now + 0.13; this.slowmo(0.35, 0.6);
    this.cam.cut({ x: bp.x + p.facing * 40, y: bp.y + 10, zoom: 1.36 * 1.27, panTime: 0.1, zoomTime: 0.1, priority: 3, duration: 0.42 }, this.now);
    this.cam.kick(0.08); this.cam.flash(90, 255, 220, 160); this.stage.cheer(0.8);
    this.fx.floatText(bp.x, bp.y - 90, p.theme === 'sun' ? '¡CHILENA DE FUEGO!' : '¡CHILENA TSUNAMI!', p.theme === 'sun' ? '#ffb020' : '#5ff0ff', 40);
  }
  private onBallEvent(ev: NonNullable<ReturnType<BallPhysics['update']>>) {
    const b = this.ball;
    if (this.state !== 'rally') { if (ev.type === 'ground') { const g = project(ev.x, 0, ev.z); this.fx.sandPuff(g.x, g.y, 5); } return; }
    const hitter = (this.lastTeam || b.lastHitter) as Side;
    if (ev.type === 'net') { sfx.netHit(); return; }
    if (ev.type === 'fence') { sfx.bounce(); this.pointWon(this.other(hitter), 'out'); return; }
    const g = project(ev.x, 0, ev.z);
    this.fx.decal('mark', g.x, g.y, g.k * 1.3);
    const inCourt = Math.abs(ev.x) <= COURT.halfLen + 0.05 && ev.z >= -0.05 && ev.z <= COURT.width + 0.05;
    const landed: Side = ev.x < 0 ? -1 : 1;
    if (b.kind === 'special' && inCourt && landed !== hitter) {
      this.fx.explosion(b.theme, g.x, g.y); sfx.explosion();
      this.cam.shake(420, 0.014); this.cam.kick(0.07); this.cam.flash(160, 255, 240, 200);
      this.freezeUntil = this.now + 0.08; this.specialFlight = false;
      b.vy = 6; b.vx *= 0.3; b.vz *= 0.3;
      this.pointWon(hitter, 'unstoppable');
      return;
    }
    sfx.bounce(); this.fx.sandPuff(g.x, g.y, 14); this.specialFlight = false;
    if (!inCourt) this.pointWon(this.other(hitter), 'out');
    else this.pointWon(this.other(landed), landed === hitter ? 'own-side' : 'in');
  }
  private pointWon(winner: Side, reason: 'in' | 'out' | 'own-side' | 'unstoppable' | 'touches') {
    if (this.state !== 'rally') return;
    this.state = 'point'; this.stateT = 0;
    this.stats.longestRally = Math.max(this.stats.longestRally, this.rallyTouches);
    this.score[winner]++;
    if (winner !== this.server) this.serverIdx[winner]++;
    this.lastWinner = winner;
    for (const m of this.all) { m.p.mood = m.p.side === winner ? 'happy' : 'sad'; m.p.moodT = 2.2; }
    sfx.whistle(); sfx.cheer(reason === 'unstoppable' ? 1.4 : 0.8);
    this.stage.cheer(reason === 'unstoppable' ? 1 : 0.6);
    const labels = { in: '¡PUNTO!', out: '¡FUERA!', 'own-side': '¡AL SUELO!', unstoppable: '¡IMPARABLE!', touches: `¡${this.maxTouches + 1} TOQUES!` };
    const bp = project(this.ball.x, this.ball.y, this.ball.z);
    this.fx.floatText(bp.x, Math.min(bp.y, 520) - 60, labels[reason], reason === 'in' || reason === 'unstoppable' ? '#ffe14d' : '#ffffff', 40);
    const w = this.teams[winner][0].p, wp = project(w.x, 1, w.z);
    this.later(0.45, () => this.cam.cut({ x: wp.x - w.side * 120, y: wp.y - 40, zoom: 1.36 * 1.18, panTime: 0.7, zoomTime: 0.8, priority: 1, duration: 1.7 }, this.now));
    this.later(0.7, () => { this.stage.score = [this.score[-1], this.score[1]]; });
  }
  private endMatch(winner: Side) {
    const w = this.teams[winner][0].p, pp = project(w.x, 1, w.z);
    this.slowmo(0.35, 1.2);
    this.cam.cut({ x: pp.x, y: pp.y - 40, zoom: 1.36 * 1.3, panTime: 0.5, zoomTime: 0.6, priority: 4, duration: 4 }, this.now);
    this.state = 'over'; this.stateT = 0;
    for (const m of this.teams[winner]) { m.p.mood = 'happy'; m.p.moodT = 99; }
    sfx.cheer(2); this.stage.cheer(1);
    this.result = { winner, score: { a: this.score[-1], b: this.score[1] }, mode: this.mode, stats: { ...this.stats } };
  }
  private updateCamera() {
    const d = this.cam, bz = 1.36, b = this.ball;
    if (this.state === 'serve') {
      const s = this.serverMember().p, sp = project(s.x, 1, s.z);
      d.followX = sp.x - s.side * 330; d.followY = CAM_BASE_Y + 10; d.followZoom = bz * 1.04; d.panTime = 0.85; d.zoomTime = 0.9;
      return;
    }
    const bp = project(b.x, b.y, b.z), lead = b.vx * 0.38 * PPM;
    let fx = bp.x + lead;
    if (this.receiver && this.state === 'rally') { const rp = project(this.receiver.p.x, 1, this.receiver.p.z); fx = (bp.x + lead) * 0.6 + rp.x * 0.4; }
    d.followX = fx;
    d.followY = CAM_BASE_Y + Math.min(0, bp.y - 330) * 0.5;
    d.followZoom = bz * (1.0 - clamp((b.y - 3) / 5, 0, 1) * 0.07);
    d.panTime = this.specialFlight ? 0.16 : b.kind === 'smash' || b.kind === 'drive' ? 0.38 : 0.55;
    d.zoomTime = 0.7;
  }
  private updateRing() {
    const hum = this.human, plan = hum?.plan;
    this.target = null;
    if (!hum || !plan || this.mode !== 'play' || this.state !== 'rally') { this.ring = null; this.hud.ringLabel = ''; return; }
    const perfect = Math.abs(plan.t - 0.15) < 0.09;
    const n = this.nextTouch(hum.p.side) - 1;
    const act = this.decide(hum, n + 1, play.mx * hum.p.facing > 0.45);
    const col = plan.high ? '#ff8a1f' : perfect ? '#4dff6a' : '#ffffff';
    this.ring = { x: plan.bx, z: plan.bz, r: 30 + Math.min(1.2, plan.t) * 90, col, fillA: perfect ? 0.35 : 0.15, inner: 30 };
    const txt = act === 'attack' ? (plan.high ? 'SHARK ATTACK' : 'ATAQUE') : act === 'control' ? 'CONTROL' : 'LEVANTADA';
    this.hud.ringLabel = `${n + 1}.º · ${txt}`;
  }
}
