import Phaser from 'phaser';
import { COURT, PHYS, RIG_SCALE, depthFor, project } from '../config';
import { ANIM, Rig, RigInput, SwingKind } from './Rig';
import type { Side } from '../sports/types';
import type { Theme } from './Ball';
import type { CharDef } from '../game/roster';

export interface Intent {
  mx: number; // -1..1 en pantalla (derecha +)
  mz: number; // -1..1 (fondo +)
  hit: boolean;
  jump: boolean;
  special: boolean;
}

export type SwingType = SwingKind;
type Stage = 'none' | 'windup' | 'snap' | 'follow' | 'recover';

/** Tiempos del golpe (s), medidos sobre el vídeo de referencia. */
export const SWING_TIMES = { windupMax: 0.3, serveWindup: 0.42, snap: 0.06, follow: 0.16, recover: 0.14 };

/** Movimiento: arranque y frenada casi instantáneos (como en el vídeo). */
export const MOVE = { accel: 95, decel: 80, airControl: 0.55, jumpPrep: 0.05, landTime: 0.12 };

export class Player {
  x: number; z: number; y = 0;
  vx = 0; vz = 0; vy = 0;
  facing: number;
  swingType: SwingType = 'fore';
  stage: Stage = 'none';
  stageT = 0;
  hitBuffer = 0; // ventana de golpe tras pulsar
  lastBallDist = 99;
  meter = 0;
  powered = false;
  runPhase = 0;
  mood: 'none' | 'happy' | 'sad' = 'none';
  moodT = 0;
  serving = false;
  stunned = 0; // tras recibir un especial sin devolverlo
  prep = 0; // anticipación visual (la escena la fija según la bola)
  expr: RigInput['expr'] = 'normal';
  exprT = 0;
  /** eventos para la escena (polvo al derrapar/aterrizar) */
  events: ('skid' | 'land' | 'takeoff')[] = [];
  rig: Rig;
  shadow: Phaser.GameObjects.Image;
  private jumpPrepT = 0;
  private landT = 0;
  // estiramiento / aplastamiento (muelle)
  private sq = 0;
  private sqV = 0;
  private lastT = 0;

  theme: Theme;
  name: string;
  /** multiplicadores por estadísticas del personaje (3 = normal) */
  speedMul = 1;
  powerMul = 1;
  controlBonus = 0;

  constructor(scene: Phaser.Scene, public side: Side, public char: CharDef, opts: { noPaddle?: boolean } = {}) {
    this.x = side * 5.5;
    this.z = 4;
    this.facing = -side;
    this.theme = char.element;
    this.name = char.name;
    this.speedMul = 1 + (char.stats.speed - 3) * 0.06;
    this.powerMul = 1 - (char.stats.power - 3) * 0.05; // <1 = vuelo más corto = golpe más rápido
    this.controlBonus = (char.stats.control - 3) * 0.05;
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(98);
    this.rig = new Rig(scene, char.tex, char.data, opts);
  }

  get airborne() { return this.y > 0.05; }

  /** Compatibilidad: 1 = libre para golpear. */
  get swingT() {
    return { none: 1, windup: 0.1, snap: 0.45, follow: 0.75, recover: 0.95 }[this.stage];
  }

  /** Punto ideal de contacto (delante del jugador, a la altura del pecho). */
  sweetSpot() {
    return { x: this.x + this.facing * 0.45, y: 1.0 + this.y, z: this.z - 0.15 };
  }

  /** Pulsar golpe: arranca la preparación (se mantiene hasta el contacto). */
  startSwing(type: SwingType) {
    this.swingType = type;
    this.stage = 'windup';
    this.stageT = 0;
  }

  /** Contacto con la bola: latigazo inmediato. */
  contact(type: SwingType, strong = false) {
    this.swingType = type;
    this.stage = 'snap';
    this.stageT = 0;
    this.kick(strong ? 0.12 : 0.06);
    this.face('effort', 0.35);
  }

  face(e: RigInput['expr'], t: number) { this.expr = e; this.exprT = t; }

  /** Impulso de estiramiento (+) o aplastamiento (-). */
  kick(v: number) { this.sqV += v * 40; }

  update(dt: number, intent: Intent, allowMove: boolean) {
    let mx = allowMove ? intent.mx : 0;
    let mz = allowMove ? intent.mz : 0;
    if (this.stunned > 0) { this.stunned -= dt; mx = mz = 0; }
    if (this.jumpPrepT > 0 || this.landT > 0.06) { mx *= 0.3; mz *= 0.3; }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // velocidad: aceleración/frenada lineales muy altas => respuesta inmediata
    const max = PHYS.playerSpeed * this.speedMul * (this.airborne ? MOVE.airControl : 1);
    const tx = mx * max, tz = mz * max * 0.85;
    const before = Math.hypot(this.vx, this.vz);
    const approach = (v: number, t: number) => {
      const speedingUp = Math.abs(t) > Math.abs(v) && (v === 0 || Math.sign(t) === Math.sign(v));
      const a = speedingUp ? MOVE.accel : MOVE.decel;
      const d = t - v;
      return v + Math.sign(d) * Math.min(Math.abs(d), a * dt);
    };
    this.vx = approach(this.vx, tx);
    this.vz = approach(this.vz, tz);
    if (!this.airborne && before > 5 && len < 0.2) this.events.push('skid');
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const minX = this.side < 0 ? -COURT.fenceX + 0.5 : 0.45;
    const maxX = this.side < 0 ? -0.45 : COURT.fenceX - 0.5;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    this.z = Phaser.Math.Clamp(this.z, -0.6, COURT.width + 0.8);

    // salto con agachado previo
    if (intent.jump && !this.airborne && this.jumpPrepT <= 0 && this.stunned <= 0) this.jumpPrepT = MOVE.jumpPrep;
    if (this.jumpPrepT > 0) {
      this.jumpPrepT -= dt;
      if (this.jumpPrepT <= 0) {
        this.vy = PHYS.jumpV;
        this.y = 0.06;
        this.kick(0.22);
        this.events.push('takeoff');
      }
    }
    if (this.airborne || this.vy > 0) {
      this.vy -= PHYS.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        this.landT = MOVE.landTime;
        this.kick(-0.28);
        this.events.push('land');
      }
    }
    if (this.landT > 0) this.landT -= dt;

    // fases del golpe
    if (this.stage !== 'none') {
      this.stageT += dt;
      const T = SWING_TIMES;
      const wmax = this.swingType === 'serve' || this.swingType === 'fkserve' ? 3 : T.windupMax; // en el saque espera al segundo toque
      if (this.stage === 'windup' && this.stageT > wmax) { this.stage = 'snap'; this.stageT = 0; }
      else if (this.stage === 'snap' && this.stageT > T.snap) { this.stage = 'follow'; this.stageT = 0; }
      else if (this.stage === 'follow' && this.stageT > T.follow) { this.stage = 'recover'; this.stageT = 0; }
      else if (this.stage === 'recover' && this.stageT > T.recover) { this.stage = 'none'; this.stageT = 0; }
    }
    if (this.hitBuffer > 0) this.hitBuffer -= dt;

    // carrera: la cadencia sigue a la distancia recorrida (sin patinar)
    const speed = Math.hypot(this.vx, this.vz);
    if (!this.airborne) this.runPhase += (dt * speed / ANIM.stride) * Math.PI * 2;
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 'none'; }
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.expr = 'normal'; }

    // muelle de estiramiento
    this.sqV += (-this.sq * 260 - this.sqV * 16) * dt;
    this.sq += this.sqV * dt;
  }

  render(time: number) {
    const p = project(this.x, this.y, this.z);
    const g0 = project(this.x, 0, this.z);
    const s = p.k * RIG_SCALE;
    const hs = Math.max(0.4, 1 - this.y * 0.25);
    this.shadow.setPosition(g0.x, g0.y).setScale(1.0 * p.k * hs, 0.9 * p.k * hs).setAlpha(0.9 * hs);
    const dt = this.lastT ? Math.min(0.05, (time - this.lastT) / 1000) : 0.016;
    this.lastT = time;
    const crouch = this.jumpPrepT > 0 ? 1 : this.landT > 0 ? this.landT / MOVE.landTime : 0;
    let expr = this.expr;
    if (this.mood === 'happy') expr = 'happy';
    else if (this.mood === 'sad') expr = 'sad';
    else if (this.stage === 'windup' || this.stage === 'snap' || this.powered) expr = 'effort';
    this.rig.update(dt, {
      time: time / 1000, speed: Math.hypot(this.vx, this.vz), fwd: this.vx * this.facing, runPhase: this.runPhase,
      airborne: this.airborne, vy: this.vy,
      swing: { type: this.swingType, stage: this.stage, t: this.stageT },
      mood: this.mood, powered: this.powered, stunned: this.stunned > 0, prep: this.prep, crouch, expr,
    });
    const sq = Phaser.Math.Clamp(this.sq, -0.3, 0.3);
    const hop = this.mood === 'happy' ? Math.abs(Math.sin(time * 0.011)) * 14 * p.k : 0;
    this.rig.container.setPosition(p.x, p.y - hop).setScale(s * this.facing * (1 - sq * 0.6), s * (1 + sq)).setDepth(depthFor(this.z));
  }

  destroy() { this.rig.destroy(); this.shadow.destroy(); }
}
