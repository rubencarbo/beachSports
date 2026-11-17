import Phaser from 'phaser';
import { Pose, athletePoses } from '../core/characters';

/**
 * Personaje "recortable" (cut-out) animado por esqueleto a partir de piezas de arte de alta calidad
 * (importadas con art/tools/ingest_parts.py). Las poses se interpolan de forma continua,
 * así que el movimiento es fluido aunque sólo exista una ilustración por pieza.
 */

export interface RigFrame { x: number; y: number; w: number; h: number; top: [number, number]; bot: [number, number] }
export interface RigData { pixel: number; frames: Record<string, RigFrame> }

const POSES: Record<string, Pose> = Object.fromEntries(athletePoses().map((p) => [p.name, p.pose]));

/** Registra los frames del atlas en la textura cargada. */
export function registerRigFrames(scene: Phaser.Scene, key: string, data: RigData) {
  const tex = scene.textures.get(key);
  for (const [name, f] of Object.entries(data.frames)) if (!tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const L2 = (x: [number, number], y: [number, number]): [number, number] => [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
  return {
    lean: lerp(a.lean, b.lean, t), bob: lerp(a.bob ?? 0, b.bob ?? 0, t),
    legF: L2(a.legF, b.legF), legB: L2(a.legB, b.legB), armF: L2(a.armF, b.armF), armB: L2(a.armB, b.armB),
    pad: lerp(a.pad ?? 0, b.pad ?? 0, t), headDy: lerp(a.headDy ?? 0, b.headDy ?? 0, t),
    expr: t < 0.5 ? a.expr : b.expr, air: t < 0.5 ? a.air : b.air,
  };
}
function keyframes(names: string[], t: number): Pose {
  const n = names.length - 1;
  const f = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(f);
  const k = f - i;
  const e = k * k * (3 - 2 * k);
  return lerpPose(POSES[names[i]], POSES[names[i + 1]], e);
}

export type RigState =
  | { kind: 'idle'; time: number; powered: boolean }
  | { kind: 'run'; phase: number; speed: number }
  | { kind: 'swing'; type: 'fore' | 'over' | 'serve'; t: number }
  | { kind: 'air' }
  | { kind: 'happy'; time: number }
  | { kind: 'sad' }
  | { kind: 'stun' };

function runPose(ph: number): Pose {
  const leg = (p: number): [number, number] => [0.85 * Math.sin(p), 0.35 + 1.3 * Math.max(0, -Math.sin(p - 0.9))];
  return {
    lean: 0.3, bob: Math.abs(Math.sin(ph)) * -2,
    legF: leg(ph), legB: leg(ph + Math.PI),
    armF: [0.45 - 0.35 * Math.sin(ph), 1.4], armB: [0.8 * Math.sin(ph), 1.4], pad: 0.2, expr: 'normal',
  };
}

export function targetPose(s: RigState): { pose: Pose; snap: boolean } {
  switch (s.kind) {
    case 'run': return { pose: lerpPose(POSES.idle0, runPose(s.phase), Math.min(1, s.speed / 3)), snap: false };
    case 'swing': {
      const seq = s.type === 'over' ? ['over0', 'over1', 'over2', 'over3'] : s.type === 'serve' ? ['serve0', 'serve1', 'serve2'] : ['fore0', 'fore1', 'fore2', 'fore3'];
      return { pose: keyframes(seq, s.t), snap: true };
    }
    case 'air': return { pose: POSES.jump0, snap: false };
    case 'happy': return { pose: lerpPose(POSES.cele0, POSES.cele1, (Math.sin(s.time * 0.018) + 1) / 2), snap: false };
    case 'sad': return { pose: POSES.sad0, snap: false };
    case 'stun': return { pose: POSES.stun0, snap: false };
    default: {
      const base = s.powered ? POSES.power0 : POSES.idle0;
      return { pose: lerpPose(base, POSES.idle1, (Math.sin(s.time * 0.006) + 1) / 2), snap: false };
    }
  }
}

export class Rig {
  container: Phaser.GameObjects.Container;
  private parts: Record<string, Phaser.GameObjects.Image> = {};
  private cur: Pose = { ...POSES.idle0 };
  private F: Record<string, RigFrame>;
  /** altura total aproximada del personaje en px de arte */
  height: number;

  constructor(scene: Phaser.Scene, private key: string, data: RigData) {
    this.F = data.frames;
    this.height = data.frames.full?.h ?? 120;
    this.container = scene.add.container(0, 0);
    const mk = (name: string, frame: string, back = false) => {
      const f = this.F[frame];
      const im = scene.add.image(0, 0, key, frame).setOrigin(f.w / 2 / f.w, f.top[1] / f.h);
      if (back) im.setTint(0xb4b0c4);
      this.parts[name] = im;
      return im;
    };
    // orden de dibujo: fondo -> delante
    this.container.add([
      mk('upperB', 'upperarm', true), mk('foreB', 'forearm', true),
      mk('thighB', 'thigh', true), mk('lowerB', 'lowerleg', true),
      mk('torso', 'torso'), mk('pelvis', 'pelvis'),
      mk('thighF', 'thigh'), mk('lowerF', 'lowerleg'),
      mk('head', 'head'),
      mk('upperF', 'upperarm'), mk('foreF', 'forearm'), mk('paddle', 'paddlehand'),
    ]);
    // antebrazo con pala: se recorta el puño (lo sustituye la mano con la pala)
    const fa = this.F.forearm;
    this.parts.foreF.setCrop(0, 0, fa.w, fa.h * 0.8);
    // torso: anclado por la cadera
    this.parts.torso.setOrigin(this.F.torso.bot[0] / this.F.torso.w, this.F.torso.bot[1] / this.F.torso.h);
    // cabeza: anclada por el cuello
    this.parts.head.setOrigin(this.F.head.bot[0] / this.F.head.w, this.F.head.bot[1] / this.F.head.h);
  }

  /** Avanza la animación hacia la pose objetivo y coloca todas las piezas. */
  update(dt: number, st: RigState) {
    const { pose, snap } = targetPose(st);
    const k = snap ? 1 : 1 - Math.exp(-dt * 16);
    this.cur = lerpPose(this.cur, pose, k);
    this.cur.expr = pose.expr;
    this.layout(this.cur);
  }

  private layout(p: Pose) {
    const F = this.F;
    const P = this.parts;
    const len = (f: RigFrame) => f.bot[1] - f.top[1];
    const dir = (a: number) => ({ x: Math.sin(a), y: Math.cos(a) });
    const THIGH = len(F.thigh) - 1, SHIN = len(F.lowerleg) - 3, TORSO = F.torso.bot[1] - F.torso.top[1];
    const UPPER = len(F.upperarm) - 2, FORE = F.forearm.h * 0.72;

    // altura de cadera: el pie más bajo toca el suelo (y = 0)
    const footY = (lg: [number, number]) => Math.cos(lg[0]) * THIGH + Math.cos(lg[0] - lg[1]) * SHIN;
    const hipH = p.air ? THIGH + SHIN - 6 : Math.max(footY(p.legF), footY(p.legB)) + 3;
    const hip = { x: -p.lean * 4, y: -hipH + (p.bob ?? 0) };

    const placeLeg = (thigh: Phaser.GameObjects.Image, lower: Phaser.GameObjects.Image, lg: [number, number], dx: number) => {
      const h0 = { x: hip.x + dx, y: hip.y + 4 };
      thigh.setPosition(h0.x, h0.y).setRotation(-lg[0]);
      const d = dir(lg[0]);
      const knee = { x: h0.x + d.x * THIGH, y: h0.y + d.y * THIGH };
      lower.setPosition(knee.x, knee.y).setRotation(-(lg[0] - lg[1]));
    };
    placeLeg(P.thighB, P.lowerB, p.legB, -2);
    placeLeg(P.thighF, P.lowerF, p.legF, 2);

    // pelvis y torso
    P.pelvis.setPosition(hip.x, hip.y - 4).setRotation(-p.lean * 0.3);
    P.torso.setPosition(hip.x, hip.y + 1).setRotation(-p.lean);
    const up = { x: Math.sin(p.lean), y: -Math.cos(p.lean) };
    const neck = { x: hip.x + up.x * (TORSO - 1), y: hip.y + 1 + up.y * (TORSO - 1) };
    // hombro: en la zona de la manga del torso (coordenadas locales relativas a la cadera, rotadas)
    const T = F.torso;
    const lx = T.w * 0.26 - T.bot[0], ly = T.h * 0.3 - T.bot[1];
    const r = -p.lean;
    const sh = { x: hip.x + lx * Math.cos(r) - ly * Math.sin(r), y: hip.y + 1 + lx * Math.sin(r) + ly * Math.cos(r) };
    P.head.setPosition(neck.x, neck.y + 3 + (p.headDy ?? 0)).setRotation(-p.lean * 0.45);
    const headFrame = p.expr === 'happy' ? 'head_happy' : p.expr === 'effort' || p.expr === 'shock' ? 'head_angry' : 'head';
    if (P.head.frame.name !== headFrame && this.F[headFrame]) {
      P.head.setFrame(headFrame);
      const hf = this.F[headFrame];
      P.head.setOrigin(hf.bot[0] / hf.w, hf.bot[1] / hf.h);
    }

    // brazos
    const placeArm = (upper: Phaser.GameObjects.Image, fore: Phaser.GameObjects.Image, a: [number, number], dx: number) => {
      const s0 = { x: sh.x + dx, y: sh.y };
      upper.setPosition(s0.x, s0.y).setRotation(-a[0]);
      const d = dir(a[0]);
      const el = { x: s0.x + d.x * UPPER, y: s0.y + d.y * UPPER };
      fore.setPosition(el.x, el.y).setRotation(-(a[0] + a[1]));
      const d2 = dir(a[0] + a[1]);
      return { x: el.x + d2.x * FORE, y: el.y + d2.y * FORE };
    };
    placeArm(P.upperB, P.foreB, p.armB, -1);
    const wrist = placeArm(P.upperF, P.foreF, p.armF, 1);
    P.paddle.setPosition(wrist.x, wrist.y).setRotation(-(p.armF[0] + p.armF[1] + (p.pad ?? 0)));
  }

  destroy() { this.container.destroy(); }
}
