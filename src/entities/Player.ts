import Phaser from 'phaser';
import { COURT, PHYS, PPM, depthFor, project } from '../config';
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

const LOOK: Record<Theme, { shirt: number; shirtDark: number; shorts: number; hair: number; skin: number; paddle: number; paddleRim: number; band: number }> = {
  sun: { shirt: 0xff8a1f, shirtDark: 0xc95a10, shorts: 0x2a2a35, hair: 0xff9a2a, skin: 0xf3c29a, paddle: 0xe8553a, paddleRim: 0x7a2416, band: 0xffd23a },
  wave: { shirt: 0x26c6c6, shirtDark: 0x13858c, shorts: 0x1f3550, hair: 0x2a1c18, skin: 0xd9a27a, paddle: 0x1fa8c0, paddleRim: 0x0b4a5a, band: 0x1fd0d0 },
};

const OUT = 0x2a1a12;

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
  gfx: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Image;
  look: (typeof LOOK)['sun'];

  constructor(scene: Phaser.Scene, public side: Side, public theme: Theme, public name: string) {
    this.x = side * 5.5;
    this.z = 4;
    this.facing = -side;
    this.look = LOOK[theme];
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(98);
    this.gfx = scene.add.graphics();
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
    const s = p.k * (PPM / 58) * 1.18;
    const hs = Math.max(0.4, 1 - this.y * 0.25);
    this.shadow.setPosition(g0.x, g0.y).setScale(0.9 * s * hs, 0.9 * s * hs).setAlpha(0.9 * hs);
    this.gfx.setPosition(p.x, p.y).setScale(s).setDepth(depthFor(this.z));
    this.draw(time);
  }

  private draw(time: number) {
    const g = this.gfx;
    const f = this.facing;
    const L = this.look;
    g.clear();
    const speed = Math.hypot(this.vx, this.vz);
    const run = Math.min(1, speed / 5);
    const ph = this.runPhase;
    const air = this.airborne;
    const happy = this.mood === 'happy';
    const sad = this.mood === 'sad';
    const hop = happy ? Math.abs(Math.sin(time * 0.012)) * 10 : 0;
    const bob = air ? 0 : Math.abs(Math.sin(ph)) * 3 * run + Math.sin(time * 0.004) * 1;
    const by = -hop - bob; // desplazamiento vertical del cuerpo
    const lean = f * run * 4;

    // ---- piernas
    const hipY = -36 + by;
    const legLen = 34;
    const legs = air
      ? [[-6, -12], [8, -18]]
      : [[Math.sin(ph) * 13 * run - 4, 0], [-Math.sin(ph) * 13 * run + 4, 0]];
    g.lineStyle(9, OUT, 1);
    for (const [lx, ly] of legs) g.lineBetween(f * (lx * 0.3), hipY, f * lx, ly + (air ? hipY + legLen - 6 : 0));
    g.lineStyle(6, L.skin, 1);
    for (const [lx, ly] of legs) g.lineBetween(f * (lx * 0.3), hipY, f * lx, ly + (air ? hipY + legLen - 6 : 0));
    // zapatillas
    for (const [lx, ly] of legs) {
      const fy = ly + (air ? hipY + legLen - 6 : 0);
      g.fillStyle(0xffffff, 1).fillEllipse(f * (lx + 3), fy, 13, 6);
      g.lineStyle(1.5, OUT, 1).strokeEllipse(f * (lx + 3), fy, 13, 6);
    }
    // shorts
    g.fillStyle(L.shorts, 1);
    g.fillRoundedRect(-11 + lean * 0.3, hipY - 6, 22, 13, 4);

    // ---- torso
    const chestY = hipY - 26;
    g.fillStyle(L.shirt, 1);
    g.lineStyle(2, OUT, 1);
    g.beginPath();
    g.moveTo(-11 + lean * 0.4, hipY - 3);
    g.lineTo(11 + lean * 0.4, hipY - 3);
    g.lineTo(10 + lean, chestY);
    g.lineTo(-10 + lean, chestY);
    g.closePath();
    g.fillPath(); g.strokePath();
    g.fillStyle(L.shirtDark, 1);
    g.fillRect(-11 + lean * 0.4, hipY - 8, 22, 4);

    // ---- brazo de la pala
    const shX = f * 8 + lean, shY = chestY + 5;
    let ang: number; // ángulo en espacio "mirando hacia delante"
    const t = this.swingT;
    const e = 1 - Math.pow(1 - t, 3);
    if (t < 1) {
      if (this.swingType === 'over') ang = Phaser.Math.Linear(-2.5, 1.0, e);
      else if (this.swingType === 'serve') ang = Phaser.Math.Linear(-2.2, 0.8, e);
      else ang = Phaser.Math.Linear(2.7, -0.8, e);
    } else if (happy) ang = -1.4 + Math.sin(time * 0.012) * 0.3;
    else if (sad) ang = 1.3;
    else ang = 0.55 + Math.sin(time * 0.005) * 0.08 + (this.powered ? -1.2 : 0);
    const armLen = 20;
    const hx = shX + f * Math.cos(ang) * armLen;
    const hy = shY + Math.sin(ang) * armLen;
    const pdx = f * Math.cos(ang) * 16, pdy = Math.sin(ang) * 16;
    // pala
    g.lineStyle(5, 0x3a2a20, 1).lineBetween(hx, hy, hx + pdx * 0.5, hy + pdy * 0.5);
    g.fillStyle(L.paddle, 1);
    g.fillCircle(hx + pdx, hy + pdy, 12.5);
    g.lineStyle(2.5, L.paddleRim, 1).strokeCircle(hx + pdx, hy + pdy, 12.5);
    g.fillStyle(0xffffff, 0.25).fillCircle(hx + pdx - 3, hy + pdy - 4, 5);
    // brazo
    g.lineStyle(8, OUT, 1).lineBetween(shX, shY, hx, hy);
    g.lineStyle(5, L.skin, 1).lineBetween(shX, shY, hx, hy);
    // otro brazo
    let oAng = happy ? -1.7 : sad ? 1.5 : air ? -0.8 : 1.9 - Math.sin(ph) * 0.5 * run;
    if (t < 1) oAng = Phaser.Math.Linear(-0.6, 1.8, e);
    const ox = -f * 7 + lean, oy = shY;
    const oX2 = ox + f * Math.cos(oAng) * 17, oey = oy + Math.sin(oAng) * 17;
    g.lineStyle(7, OUT, 1).lineBetween(ox, oy, oX2, oey);
    g.lineStyle(4.5, L.skin, 1).lineBetween(ox, oy, oX2, oey);

    // ---- cabeza (chibi: grande)
    const headX = f * 2 + lean * 1.2;
    const headY = chestY - 16 + (sad ? 4 : 0);
    const R = 17;
    g.fillStyle(L.skin, 1).fillCircle(headX, headY, R);
    g.lineStyle(2, OUT, 1).strokeCircle(headX, headY, R);
    if (this.theme === 'sun') {
      // pelo de pinchos tipo "sol" + visera
      g.fillStyle(L.hair, 1);
      g.lineStyle(2, 0xb85a10, 1);
      g.beginPath();
      const spikes = 9;
      for (let i = 0; i <= spikes * 2; i++) {
        const a = Math.PI * 0.95 + (i / (spikes * 2)) * Math.PI * 1.25 - (f < 0 ? 0.25 : 0);
        const r = i % 2 === 0 ? R + 9 + Math.sin(time * 0.01 + i) * 1.2 : R + 1;
        const px = headX + Math.cos(a) * r * (f < 0 ? 1 : 1);
        const py = headY - 2 + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.lineTo(headX, headY - 2);
      g.closePath();
      g.fillPath(); g.strokePath();
      // visera
      g.fillStyle(L.band, 1).fillRect(headX - R, headY - 8, R * 2, 5);
      g.fillStyle(0xff6a00, 1).fillEllipse(headX + f * (R + 3), headY - 5, 16, 5);
    } else {
      g.fillStyle(L.hair, 1);
      g.beginPath();
      g.arc(headX, headY - 2, R + 2, Math.PI * 0.95, Math.PI * 2.05);
      g.closePath();
      g.fillPath();
      g.fillRect(headX - f * R - 3, headY - 4, 7, 14);
      // cinta
      g.fillStyle(L.band, 1).fillRect(headX - R - 1, headY - 9, R * 2 + 2, 6);
      g.fillStyle(L.band, 1).fillTriangle(headX - f * (R + 1), headY - 8, headX - f * (R + 11), headY - 12 + Math.sin(time * 0.015) * 3, headX - f * (R + 9), headY - 2);
    }
    // cara
    const eyeX = headX + f * 7;
    if (happy) {
      g.lineStyle(2.5, OUT, 1);
      g.beginPath(); g.arc(eyeX - 4, headY + 2, 3, Math.PI, 0); g.strokePath();
      g.beginPath(); g.arc(eyeX + 5, headY + 2, 3, Math.PI, 0); g.strokePath();
      g.fillStyle(0x8a2020, 1).fillCircle(eyeX + f * 1, headY + 9, 4);
    } else {
      g.fillStyle(0xffffff, 1).fillEllipse(eyeX - 4, headY + 2, 6, 8).fillEllipse(eyeX + 5, headY + 2, 6, 8);
      g.fillStyle(0x1a1a2a, 1).fillEllipse(eyeX - 4 + f, headY + 3, 3.6, 5.5).fillEllipse(eyeX + 5 + f, headY + 3, 3.6, 5.5);
      g.lineStyle(2, OUT, 1);
      if (sad) g.lineBetween(eyeX - 2, headY + 11, eyeX + 4, headY + 10);
      else if (this.powered || this.swingT < 1) { g.lineBetween(eyeX - 7, headY - 4, eyeX - 1, headY - 2); g.lineBetween(eyeX + 8, headY - 4, eyeX + 2, headY - 2); g.fillStyle(0x8a2020, 1).fillEllipse(eyeX + f, headY + 10, 6, 4); }
      else g.lineBetween(eyeX - 1, headY + 10, eyeX + 4, headY + 9);
    }
    g.fillStyle(0xff8080, 0.5).fillCircle(eyeX - f * 9, headY + 7, 3);
  }

  destroy() { this.gfx.destroy(); this.shadow.destroy(); }
}
