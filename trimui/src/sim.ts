// Base común de los partidos de consola: tiempo (cámara lenta / congelado), cámara, decorado, efectos y dibujo.
import { COURT, project } from '../../src/config';
import type { BallPhysics } from '../../src/entities/ballPhysics';
import type { PlayerCore } from '../../src/entities/playerCore';
import { getVenue } from '../../src/game/venues';
import type { Side } from '../../src/sports/types';
import { Ctx, H, W } from './gfx';
import { BallView, Camera, Fx, RigView, Stage, drawShadow } from './world';

export type Zone = 'perfect' | 'good' | 'weak' | 'over';
export interface SimHud {
  serve: { phase: 'hide' | 'run' | 'done'; v: number; zone?: Zone; t: number };
  rally: number;
  banner: string; bannerT: number;
  serving: boolean; serveText: string;
  names: [string, string];
  meters: [number, number]; powered: [boolean, boolean];
  ringLabel: string;
}
export interface MatchResult { winner: Side; score: { a: number; b: number }; mode: 'play' | 'attract'; stats: { specials: number; perfects: number; longestRally: number } }

export abstract class Sim {
  cam = new Camera();
  fx = new Fx();
  stage: Stage;
  now = 0; stateT = 0;
  freezeUntil = 0; slowUntil = 0; slowScale = 1; timeScale = 1;
  state: 'serve' | 'rally' | 'point' | 'over' = 'serve';
  score: Record<Side, number> = { [-1]: 0, [1]: 0 } as Record<Side, number>;
  stats = { specials: 0, perfects: 0, longestRally: 0 };
  views: RigView[] = [];
  ball!: BallPhysics;
  ballView!: BallView;
  result: MatchResult | null = null;
  hud: SimHud = { serve: { phase: 'hide', v: 0, t: 0 }, rally: 0, banner: '', bannerT: 0, serving: false, serveText: '', names: ['', ''], meters: [0, 0], powered: [false, false], ringLabel: '' };
  private timers: { at: number; fn: () => void }[] = [];
  ring: { x: number; z: number; r: number; col: string; fillA: number; inner: number } | null = null;
  target: { x: number; z: number; col: string; label: string } | null = null;

  constructor(venueId: string, public mode: 'play' | 'attract') {
    this.stage = new Stage(getVenue(venueId));
  }
  later(sec: number, fn: () => void) { this.timers.push({ at: this.now + sec, fn }); }
  banner(s: string) { this.hud.banner = s; this.hud.bannerT = 2.2; }
  slowmo(scale: number, s: number) { this.slowScale = scale; this.slowUntil = this.now + s; }
  hitstop(s: number) { this.freezeUntil = this.now + s; }
  other(s: Side): Side { return s === -1 ? 1 : -1; }

  /** Un paso fijo de simulación (realDt = 1/60). */
  step(realDt: number) {
    this.now += realDt;
    let target = 1;
    if (this.now < this.freezeUntil) target = 0.02; else if (this.now < this.slowUntil) target = this.slowScale;
    this.timeScale = target < this.timeScale ? target : Math.min(target, this.timeScale + realDt * 2.5);
    const dt = realDt * this.timeScale;
    this.stateT += realDt;
    for (let i = 0; i < this.timers.length; i++) if (this.timers[i].at <= this.now) { const t = this.timers.splice(i--, 1)[0]; t.fn(); }
    this.tick(dt, realDt);
    this.fx.update(dt);
    this.stage.update(realDt);
    for (const v of this.views) v.update(realDt, this.now);
    if (this.hud.bannerT > 0) this.hud.bannerT -= realDt;
    if (this.hud.serve.phase === 'done') { this.hud.serve.t += realDt; if (this.hud.serve.t > 1.2) this.hud.serve.phase = 'hide'; }
    this.cam.update(realDt, this.now);
  }
  protected abstract tick(dt: number, realDt: number): void;
  abstract players(): PlayerCore[];

  footprints() {
    for (const v of this.views) {
      const p = v.p as any;
      const st = Math.floor(p.runPhase / Math.PI);
      if (p._step === undefined) p._step = st;
      if (st !== p._step) {
        p._step = st;
        if (!p.airborne && Math.hypot(p.vx, p.vz) > 1.5) { const g = project(p.x - p.facing * 0.1, 0, p.z + (st % 2 ? 0.12 : -0.12)); this.fx.decal('foot', g.x, g.y, g.k); }
      }
    }
  }

  render(c: Ctx) {
    const cam = this.cam;
    this.stage.drawBack(c, cam);
    this.fx.drawDecals(c, cam);
    // sombras
    for (const v of this.views) {
      const p = v.p, hs = Math.max(0.4, 1 - p.y * 0.25);
      drawShadow(c, cam, p.x, p.z, 64, 24, 0.9 * hs);
    }
    const b = this.ball;
    { const hs = Math.max(0.3, 1 - b.y * 0.08); drawShadow(c, cam, b.x, b.z, 45 * hs * b.size, 18 * hs * b.size, 0.8 * hs); }
    this.drawRing(c);
    // entidades ordenadas en profundidad (z mayor = más lejos = antes)
    const ents: { z: number; d: () => void }[] = [];
    for (const v of this.views) ents.push({ z: v.p.z, d: () => v.draw(c, cam, this.now) });
    ents.push({ z: COURT.width / 2 + 0.01, d: () => this.stage.drawNet(c, cam) });
    ents.push({ z: b.z - 0.05, d: () => this.ballView.draw(c, cam) });
    ents.sort((a, q) => q.z - a.z);
    this.fx.drawAuras(c, cam, this.now);
    for (const e of ents) e.d();
    this.fx.draw(c, cam);
    this.stage.drawFront(c, cam);
    if (cam.flashA > 0) { c.globalAlpha = cam.flashA * 0.6; c.fillStyle = cam.flashCol; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }

  private drawRing(c: Ctx) {
    const cam = this.cam, r = this.ring;
    if (r) {
      const g = project(r.x, 0, r.z), x = cam.sx(g.x), y = cam.sy(g.y), k = g.k * cam.Q;
      c.strokeStyle = r.col; c.lineWidth = 1;
      c.globalAlpha = 0.9; c.beginPath(); c.ellipse(x, y, r.r * k, r.r * k * 0.35, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = r.fillA; c.fillStyle = r.col; c.beginPath(); c.ellipse(x, y, r.inner * k, r.inner * k * 0.35, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    const t = this.target;
    if (t) {
      const g = project(t.x, 0, t.z), x = cam.sx(g.x), y = cam.sy(g.y), k = g.k * cam.Q, R = 30 * k * (1 + Math.sin(this.now * 10) * 0.08);
      c.strokeStyle = t.col; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, y, R, R * 0.35, 0, 0, Math.PI * 2);
      c.moveTo(x - R * 1.25, y); c.lineTo(x - R * 0.55, y); c.moveTo(x + R * 0.55, y); c.lineTo(x + R * 1.25, y); c.stroke();
    }
  }
}
