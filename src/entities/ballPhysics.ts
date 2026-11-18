import { COURT, PHYS } from '../config';
import type { Side } from '../sports/types';

export type ShotKind = 'serve' | 'normal' | 'drive' | 'lob' | 'smash' | 'special';
export type Theme = 'sun' | 'wave';

export type BallEvent = { type: 'ground'; x: number; z: number } | { type: 'net' } | { type: 'fence' } | null;

/** Física de la bola sin dibujo (web y consola). */
export class BallPhysics {
  x = 0; y = 1; z = 4;
  vx = 0; vy = 0; vz = 0;
  lastHitter: Side | 0 = 0;
  kind: ShotKind = 'normal';
  theme: Theme = 'sun';
  live = false;
  held = true; // sostenida en el saque
  crossedNet = false;
  hitNet = false;
  spin = 0;
  /** altura de la red (palas 1,7 m; futvóley 2,1 m) y tamaño visual de la bola */
  netH = COURT.netH;
  size = 1;

  launch(vx: number, vy: number, vz: number, hitter: Side, kind: ShotKind, theme: Theme) {
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.lastHitter = hitter;
    this.kind = kind;
    this.theme = theme;
    this.live = true;
    this.held = false;
    this.crossedNet = false;
    this.onLaunch();
  }

  get speed() { return Math.hypot(this.vx, this.vy, this.vz); }

  update(dt: number): BallEvent {
    if (this.held || !this.live) return null;
    const px = this.x;
    this.vy -= PHYS.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.spin += dt * this.speed * 1.5;

    // cruce de red
    if (Math.sign(px) !== Math.sign(this.x) && px !== 0 && this.z > -0.3 && this.z < COURT.width + 0.3) {
      if (this.y < this.netH) {
        this.x = px > 0 ? 0.12 : -0.12;
        this.vx *= -0.15; this.vz *= 0.3; this.vy = Math.min(this.vy, 0) * 0.3;
        this.hitNet = true;
        return { type: 'net' };
      }
      this.crossedNet = true;
    }
    // vallas de cristal
    if (Math.abs(this.x) > COURT.fenceX && this.y < 4) {
      this.x = Math.sign(this.x) * COURT.fenceX;
      this.vx *= -0.45;
      return { type: 'fence' };
    }
    if (this.z > COURT.fenceZ && this.y < 4) { this.z = COURT.fenceZ; this.vz *= -0.45; return { type: 'fence' }; }
    if (this.y <= 0) {
      this.y = 0;
      const ev: BallEvent = { type: 'ground', x: this.x, z: this.z };
      this.vy = -this.vy * 0.45;
      this.vx *= 0.55; this.vz *= 0.55;
      if (Math.abs(this.vy) < 1) this.vy = 0;
      return ev;
    }
    return null;
  }

  /** Simula la trayectoria hacia delante (para la IA y la cámara). */
  predict(maxT: number, step: number, cb: (t: number, x: number, y: number, z: number, vy: number) => boolean) {
    let x = this.x, y = this.y, z = this.z, vx = this.vx, vy = this.vy, vz = this.vz;
    for (let t = 0; t < maxT; t += step) {
      vy -= PHYS.gravity * step;
      x += vx * step; y += vy * step; z += vz * step;
      if (cb(t + step, x, y, z, vy)) return;
      if (y <= 0) return;
    }
  }

  protected onLaunch() {}
}
