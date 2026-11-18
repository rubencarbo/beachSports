import Phaser from 'phaser';
import { COURT, PHYS, PPM, depthFor, project } from '../config';
import type { Side } from '../sports/types';

export type ShotKind = 'serve' | 'normal' | 'drive' | 'lob' | 'smash' | 'special';
export type Theme = 'sun' | 'wave';

export type BallEvent = { type: 'ground'; x: number; z: number } | { type: 'net' } | { type: 'fence' } | null;

const TRAIL_COLORS: Record<string, number[]> = {
  normal: [0xffffff, 0xffffff],
  sun: [0xfff2a8, 0xff7a00],
  wave: [0xdffcff, 0x18c8e8],
};

export class Ball {
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

  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  trailG: Phaser.GameObjects.Graphics;
  comet: Phaser.GameObjects.Image;
  private trail: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(99).setScale(0.45, 0.6);
    this.trailG = scene.add.graphics().setDepth(240).setBlendMode(Phaser.BlendModes.ADD);
    this.sprite = scene.add.image(0, 0, 'ball').setDepth(250).setScale(0.5);
    this.comet = scene.add.image(0, 0, 'comet_sun').setOrigin(0.08, 0.5).setDepth(249).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  launch(vx: number, vy: number, vz: number, hitter: Side, kind: ShotKind, theme: Theme) {
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.lastHitter = hitter;
    this.kind = kind;
    this.theme = theme;
    this.live = true;
    this.held = false;
    this.crossedNet = false;
    this.trail.length = 0;
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
      if (this.y < COURT.netH) {
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

  render() {
    const p = project(this.x, this.y, this.z);
    const g = project(this.x, 0, this.z);
    this.sprite.setPosition(p.x, p.y).setScale(0.74 * p.k).setRotation(this.spin);
    this.sprite.setDepth(depthFor(this.z) + 0.5);
    const hScale = Math.max(0.3, 1 - this.y * 0.08);
    this.shadow.setPosition(g.x, g.y).setScale(0.7 * p.k * hScale, 0.75 * p.k * hScale).setAlpha(0.8 * hScale);

    // cometa de fuego/agua en el especial: orientado según la velocidad en pantalla
    if (this.kind === 'special' && this.live && !this.held && this.speed > 8) {
      const q = project(this.x + this.vx * 0.03, this.y + this.vy * 0.03, this.z + this.vz * 0.03);
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const fl = 0.9 + Math.random() * 0.25;
      this.comet.setTexture(this.theme === 'wave' ? 'comet_wave' : 'comet_sun').setVisible(true)
        .setPosition(p.x, p.y).setRotation(ang + Math.PI).setScale(1.25 * p.k * fl, 0.9 * p.k * (0.9 + Math.random() * 0.2));
    } else this.comet.setVisible(false);

    // estela: más larga y coloreada en golpes potentes
    const sp = this.speed;
    const fast = this.kind === 'special' || this.kind === 'smash' || this.kind === 'drive' || sp > 17;
    if (this.live && !this.held) this.trail.push({ x: p.x, y: p.y });
    const maxLen = this.kind === 'special' ? 16 : fast ? 10 : 5;
    while (this.trail.length > maxLen) this.trail.shift();
    this.trailG.clear();
    if (this.trail.length > 1 && sp > 6) {
      const cols = this.kind === 'special' || this.kind === 'smash' ? TRAIL_COLORS[this.theme] : TRAIL_COLORS.normal;
      const width = (this.kind === 'special' ? 30 : this.kind === 'smash' ? 17 : 9) * p.k;
      for (let i = 1; i < this.trail.length; i++) {
        const t = i / this.trail.length;
        const a = this.trail[i - 1], b = this.trail[i];
        this.trailG.lineStyle(width * t, cols[1], 0.55 * t);
        this.trailG.lineBetween(a.x, a.y, b.x, b.y);
        this.trailG.lineStyle(width * t * 0.45, cols[0], 0.8 * t);
        this.trailG.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  clearTrail() { this.trail.length = 0; this.trailG.clear(); }

  screenPos() { return project(this.x, this.y, this.z); }
  static pxPerM = PPM;
}
