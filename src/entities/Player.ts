import Phaser from 'phaser';
import { COURT, PHYS, RIG_SCALE, depthFor, project } from '../config';
import { Rig, RigData, RigState } from './Rig';
import rigSunJson from '../assets/rig_sun.json';
import rigWaveJson from '../assets/rig_wave.json';

const rigSun = rigSunJson as unknown as RigData;
const rigWave = rigWaveJson as unknown as RigData;
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
  rig: Rig;
  shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, public side: Side, public theme: Theme, public name: string) {
    this.x = side * 5.5;
    this.z = 4;
    this.facing = -side;
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(98);
    this.rig = new Rig(scene, `rig_${theme}`, theme === 'sun' ? rigSun : rigWave);
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

  private lastT = 0;

  render(time: number) {
    const p = project(this.x, this.y, this.z);
    const g0 = project(this.x, 0, this.z);
    const s = p.k * RIG_SCALE;
    const hs = Math.max(0.4, 1 - this.y * 0.25);
    this.shadow.setPosition(g0.x, g0.y).setScale(0.9 * p.k * hs, 0.9 * p.k * hs).setAlpha(0.9 * hs);
    const dt = this.lastT ? Math.min(0.05, (time - this.lastT) / 1000) : 0.016;
    this.lastT = time;
    this.rig.update(dt, this.rigState(time));
    this.rig.container.setPosition(p.x, p.y).setScale(s * this.facing, s).setDepth(depthFor(this.z));
  }

  /** Estado de animación para el esqueleto. */
  private rigState(time: number): RigState {
    if (this.stunned > 0) return { kind: 'stun' };
    if (this.swingT < 1) return { kind: 'swing', type: this.swingType, t: this.swingT };
    if (this.mood === 'happy') return { kind: 'happy', time };
    if (this.mood === 'sad') return { kind: 'sad' };
    if (this.airborne) return { kind: 'air' };
    const speed = Math.hypot(this.vx, this.vz);
    if (speed > 0.6) return { kind: 'run', phase: this.runPhase, speed };
    return { kind: 'idle', time, powered: this.powered };
  }

  destroy() { this.rig.destroy(); this.shadow.destroy(); }
}
