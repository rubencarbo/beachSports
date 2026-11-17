import Phaser from 'phaser';
import { ART_SCALE, COURT, PHYS, depthFor, project } from '../config';
import { ATH_FOOT_Y, ATH_H } from '../core/characters';
import type { Side } from '../sports/types';
import type { Theme } from './Ball';

export interface Intent {
  mx: number; // -1..1 en pantalla (derecha +)
  mz: number; // -1..1 (fondo +)
  hit: boolean;
  jump: boolean;
  special: boolean;
}

type SwingType = 'fore' | 'over' | 'serve';


export class Player {
  x: number; z: number; y = 0;
  vx = 0; vz = 0; vy = 0;
  facing: number;
  swingT = 1;
  swingDur = 0.28;
  swingType: SwingType = 'fore';
  hitBuffer = 0; // ventana de golpe tras pulsar
  lastBallDist = 99;
  meter = 0;
  powered = false;
  runPhase = 0;
  mood: 'none' | 'happy' | 'sad' = 'none';
  moodT = 0;
  serving = false;
  stunned = 0; // tras recibir un especial sin devolverlo
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, public side: Side, public theme: Theme, public name: string) {
    this.x = side * 5.5;
    this.z = 4;
    this.facing = -side;
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(98);
    this.sprite = scene.add.sprite(0, 0, `ath_${theme}`, 'idle0').setOrigin(0.5, ATH_FOOT_Y / ATH_H);
  }

  get airborne() { return this.y > 0.05; }

  /** Punto ideal de contacto (delante del jugador, a la altura del pecho). */
  sweetSpot() {
    return { x: this.x + this.facing * 0.45, y: 1.15 + this.y, z: this.z - 0.15 };
  }

  startSwing(type: SwingType) {
    this.swingType = type;
    this.swingT = 0;
    this.swingDur = type === 'over' ? 0.32 : type === 'serve' ? 0.4 : 0.26;
  }

  update(dt: number, intent: Intent, allowMove: boolean) {
    // movimiento
    let mx = allowMove ? intent.mx : 0;
    let mz = allowMove ? intent.mz : 0;
    if (this.stunned > 0) { this.stunned -= dt; mx = mz = 0; }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const sp = PHYS.playerSpeed * (this.airborne ? 0.6 : 1);
    const ax = 30;
    this.vx = Phaser.Math.Linear(this.vx, mx * sp, Math.min(1, ax * dt / sp));
    this.vz = Phaser.Math.Linear(this.vz, mz * sp * 0.85, Math.min(1, ax * dt / sp));
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // limitar a su mitad (se puede salir un poco de pista)
    const minX = this.side < 0 ? -COURT.fenceX + 0.5 : 0.45;
    const maxX = this.side < 0 ? -0.45 : COURT.fenceX - 0.5;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    this.z = Phaser.Math.Clamp(this.z, -0.6, COURT.width + 0.8);
    // salto
    if (intent.jump && !this.airborne && this.stunned <= 0) {
      this.vy = PHYS.jumpV;
      this.y = 0.06;
    }
    if (this.airborne || this.vy > 0) {
      this.vy -= PHYS.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.swingT = Math.min(1, this.swingT + dt / this.swingDur);
    if (this.hitBuffer > 0) this.hitBuffer -= dt;
    const speed = Math.hypot(this.vx, this.vz);
    this.runPhase += dt * (4 + speed * 2.4);
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 'none'; }
  }

  render(time: number) {
    const p = project(this.x, this.y, this.z);
    const g0 = project(this.x, 0, this.z);
    const s = p.k * ART_SCALE;
    const hs = Math.max(0.4, 1 - this.y * 0.25);
    this.shadow.setPosition(g0.x, g0.y).setScale(0.9 * p.k * hs, 0.9 * p.k * hs).setAlpha(0.9 * hs);
    this.sprite.setPosition(p.x, p.y).setScale(s).setDepth(depthFor(this.z)).setFlipX(this.facing < 0);
    this.sprite.setFrame(this.pickFrame(time));
  }

  /** Elige el frame de la hoja de sprites según el estado. */
  private pickFrame(time: number): string {
    const t = this.swingT;
    if (this.stunned > 0) return 'stun0';
    if (t < 1) {
      if (this.swingType === 'over') return t < 0.2 ? 'over0' : t < 0.38 ? 'over1' : t < 0.68 ? 'over2' : 'over3';
      if (this.swingType === 'serve') return t < 0.45 ? 'serve0' : t < 0.75 ? 'serve1' : 'serve2';
      return t < 0.18 ? 'fore0' : t < 0.36 ? 'fore1' : t < 0.66 ? 'fore2' : 'fore3';
    }
    if (this.mood === 'happy') return Math.floor(time / 180) % 2 ? 'cele1' : 'cele0';
    if (this.mood === 'sad') return 'sad0';
    if (this.airborne) return 'jump0';
    const speed = Math.hypot(this.vx, this.vz);
    if (speed > 0.6) return `run${Math.floor((this.runPhase / (Math.PI * 2)) * 6) % 6}`;
    if (this.powered) return 'power0';
    return Math.floor(time / 420) % 2 ? 'idle1' : 'idle0';
  }

  destroy() { this.sprite.destroy(); this.shadow.destroy(); }
}
