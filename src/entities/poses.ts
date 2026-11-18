/**
 * Poses y cálculo del esqueleto por piezas, SIN dependencias de Phaser: lo usan la versión web (Rig.ts)
 * y la edición de consola TrimUI (dibujo en Canvas 2D).
 */

export interface RigFrame { x: number; y: number; w: number; h: number; top: [number, number]; bot: [number, number] }
export interface RigData { pixel: number; frames: Record<string, RigFrame>; scale?: { head?: number; leg?: number } }

// ------------------------------------------------------------------------------- poses
export interface Pose {
  lean: number; // inclinación del torso (rad, + hacia delante)
  bob: number; // desplazamiento vertical de la cadera (px de arte, + abajo)
  legF: [number, number]; // [muslo, flexión de rodilla]
  legB: [number, number];
  armF: [number, number]; // [brazo, codo relativo] brazo de la pala
  armB: [number, number];
  pad: number; // giro de la pala respecto al antebrazo
  head: number; // giro extra de la cabeza
}

export const P = (lean: number, bob: number, legF: [number, number], legB: [number, number], armF: [number, number], armB: [number, number], pad = 0, head = 0): Pose =>
  ({ lean, bob, legF, legB, armF, armB, pad, head });

/** Biblioteca de poses (ajustables desde el laboratorio de animación). */
export const POSES = {
  // guardia de tenista: piernas abiertas, peso delante, pala arriba delante y mano libre en el cuello de la pala
  ready: P(0.3, 3, [0.55, 1.0], [-0.4, 0.85], [0.55, 1.05], [0.8, 0.85], 1.05),
  readyLow: P(0.34, 5, [0.65, 1.2], [-0.45, 1.05], [0.6, 1.0], [0.85, 0.8], 1.0),
  jumpUp: P(0.08, -2, [0.3, 0.3], [-0.3, 0.5], [1.4, 1.0], [2.2, 0.5], 0.8),
  tuck: P(0.15, -6, [1.2, 1.9], [0.4, 1.8], [0.9, 1.0], [1.2, 0.8], 0.9),
  land: P(0.4, 7, [0.7, 1.4], [-0.5, 1.2], [0.6, 1.0], [0.9, 0.8], 1.0),
  // derecha: brazo libre señala la bola, pala atrás con la muñeca echada; impacto delante; final por encima del hombro
  foreWind: P(0.05, 3, [0.6, 0.9], [-0.55, 0.8], [-1.0, -0.4], [1.45, 0.1], -0.8, -0.05),
  foreHit: P(0.3, 2, [0.65, 0.7], [-0.5, 0.5], [0.95, 0.5], [0.6, 1.2], 0.25, 0.08),
  foreFollow: P(0.36, 2, [0.65, 0.7], [-0.5, 0.5], [2.1, 1.55], [0.4, 1.6], 0.5, 0.12),
  // remate: "postura de trofeo" en el aire con tijera de piernas
  overWind: P(-0.3, 0, [1.3, 1.7], [-0.4, 0.9], [2.4, 1.8], [3.0, 0.05], 1.6, -0.3),
  overHit: P(0.2, 0, [0.8, 1.2], [0.2, 1.3], [2.75, 0.05], [0.9, 1.5], 0.05, 0.05),
  overFollow: P(0.55, 0, [-0.2, 0.9], [1.0, 1.5], [0.5, 0.3], [-0.3, 0.9], 0.3, 0.15),
  // saque
  serveToss: P(-0.05, 3, [0.35, 0.5], [-0.35, 0.45], [-1.2, 0.6], [3.0, 0.0], -0.4, -0.35),
  serveCock: P(-0.25, 5, [0.4, 0.8], [-0.3, 0.7], [2.4, 1.8], [3.05, 0.0], 1.6, -0.35),
  serveHit: P(0.25, 0, [0.45, 0.3], [-0.6, 0.4], [2.75, 0.05], [0.9, 1.5], 0.05, 0.05),
  serveFollow: P(0.5, 1, [0.6, 0.5], [-0.4, 0.6], [0.5, 0.3], [-0.2, 1.0], 0.3, 0.1),
  // estados de ánimo
  cheerA: P(-0.05, 0, [0.25, 0.2], [-0.2, 0.2], [3.0, 0.2], [1.0, 2.2], 0, -0.15),
  cheerB: P(-0.05, -4, [0.9, 1.5], [0.1, 1.5], [3.1, 0.1], [3.3, 0.0], 0, -0.2),
  sad: P(0.45, 1, [0.15, 0.1], [-0.1, 0.1], [0.05, 0.1], [-0.05, 0.1], 0.0, 0.3),
  stun: P(-0.5, 2, [0.75, 0.35], [0.1, 0.65], [-2.0, 0.5], [2.4, 0.6], 0.6, -0.3),
  power: P(0.1, 5, [0.6, 1.1], [-0.55, 0.95], [2.9, 1.0], [1.5, 0.3], 0.4, -0.1),
  // ---- futvóley (sin pala): guardia con brazos sueltos para equilibrio
  footReady: P(0.22, 3, [0.45, 0.9], [-0.35, 0.8], [0.5, 0.6], [0.35, 0.7], 0, 0),
  footReadyLow: P(0.3, 6, [0.6, 1.25], [-0.45, 1.1], [0.7, 0.5], [0.5, 0.6], 0, 0),
  // patada de empeine: pierna atrás -> latigazo hacia delante y arriba
  kickWind: P(-0.05, 2, [-0.75, 1.5], [0.15, 0.35], [1.0, 0.4], [0.9, 0.5], 0, -0.1),
  kickHit: P(-0.25, 2, [1.35, 0.1], [0.05, 0.3], [1.3, 0.3], [1.2, 0.4], 0, 0.1),
  kickFollow: P(-0.3, 2, [1.8, 0.35], [0.0, 0.3], [1.5, 0.3], [1.0, 0.5], 0, 0.1),
  // cabezazo: echar la cabeza atrás y golpear hacia delante
  headWind: P(-0.35, 4, [0.5, 1.1], [-0.4, 0.9], [1.3, 0.5], [1.4, 0.5], 0, -0.35),
  headHit: P(0.35, 2, [0.5, 0.7], [-0.5, 0.6], [0.9, 0.6], [1.0, 0.6], 0, 0.3),
  headFollow: P(0.25, 2, [0.5, 0.7], [-0.5, 0.6], [0.6, 0.8], [0.7, 0.8], 0, 0.15),
  // control con el pecho: cuerpo atrás y brazos abiertos
  chestWind: P(-0.5, 4, [0.55, 1.2], [-0.35, 1.0], [1.7, 0.2], [1.9, 0.2], 0, -0.25),
  chestHit: P(-0.6, 3, [0.5, 1.0], [-0.4, 0.9], [1.9, 0.1], [2.1, 0.1], 0, -0.3),
  chestFollow: P(-0.2, 3, [0.5, 0.9], [-0.4, 0.8], [1.2, 0.3], [1.4, 0.3], 0, -0.1),
  // "shark attack": remate en tijera en el aire
  sharkWind: P(-0.45, 0, [-0.5, 1.6], [0.9, 1.6], [2.2, 0.3], [2.6, 0.2], 0, -0.3),
  sharkHit: P(-0.55, 0, [2.5, 0.05], [-0.3, 1.2], [1.4, 0.3], [2.5, 0.3], 0, 0.2),
  sharkFollow: P(-0.2, 0, [1.9, 0.4], [0.2, 1.0], [1.0, 0.4], [1.6, 0.4], 0, 0.2),
  // saque de futvóley: patada desde el suelo
  fkWind: P(0.1, 3, [-0.9, 1.7], [0.2, 0.4], [1.2, 0.3], [0.8, 0.5], 0, 0.2),
  fkHit: P(-0.15, 2, [1.2, 0.05], [0.1, 0.3], [1.4, 0.3], [1.0, 0.4], 0, 0.25),
  fkFollow: P(-0.25, 2, [1.6, 0.3], [0.05, 0.3], [1.5, 0.3], [0.9, 0.5], 0, 0.15),
};
export type PoseName = keyof typeof POSES;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const L2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    lean: lerp(a.lean, b.lean, t), bob: lerp(a.bob, b.bob, t), legF: L2(a.legF, b.legF, t), legB: L2(a.legB, b.legB, t),
    armF: L2(a.armF, b.armF, t), armB: L2(a.armB, b.armB, t), pad: lerp(a.pad, b.pad, t), head: lerp(a.head, b.head, t),
  };
}
/** Mezcla sólo la parte superior (brazos y torso) de b sobre a. */
export function upper(a: Pose, b: Pose, t: number): Pose {
  return { ...a, lean: lerp(a.lean, b.lean, t), armF: L2(a.armF, b.armF, t), armB: L2(a.armB, b.armB, t), pad: lerp(a.pad, b.pad, t), head: lerp(a.head, b.head, t) };
}

export type SwingKind = 'fore' | 'over' | 'serve' | 'kick' | 'head' | 'chest' | 'shark' | 'fkserve';

export interface RigInput {
  time: number; // s
  speed: number; // m/s
  fwd: number; // velocidad hacia la red (m/s, signo)
  runPhase: number;
  airborne: boolean;
  vy: number;
  swing: { type: SwingKind; stage: 'none' | 'windup' | 'snap' | 'follow' | 'recover'; t: number };
  mood: 'none' | 'happy' | 'sad';
  powered: boolean;
  stunned: boolean;
  prep: number; // 0..1 anticipación (bola acercándose)
  crouch: number; // 0..1 agachado previo al salto / aterrizaje
  expr: 'normal' | 'effort' | 'happy' | 'sad';
}

/** Parámetros de animación (el laboratorio los modifica en vivo). */
export const ANIM = {
  stride: 1.9, // m por ciclo de carrera
  runBob: 3.2, // px de arte
  runLean: 0.38,
  idleBobHz: 2.2,
  idleBob: 1.4,
  blendFast: 30,
  blendNormal: 16,
  blendSlow: 10,
  headScale: 1.0, // la hoja chibi ya trae la cabeza grande
  legScale: 1.0,
  paddleWobble: 0.3,
};

export function runPose(ph: number, back: boolean, noPaddle = false): Pose {
  const amp = back ? 0.65 : 1.0;
  const leg = (p: number): [number, number] => [amp * Math.sin(p), 0.45 + 1.55 * Math.max(0, -Math.sin(p - 0.9))];
  return {
    lean: back ? -0.05 : ANIM.runLean, bob: -Math.abs(Math.sin(ph)) * ANIM.runBob + 1.5,
    legF: leg(ph), legB: leg(ph + Math.PI),
    // corre con la pala arriba delante (en guardia) y el brazo libre bombeando
    armF: noPaddle ? [0.2 - 0.9 * Math.sin(ph), 1.4] : [0.6 - 0.15 * Math.sin(ph), 1.0], armB: [0.2 + 0.9 * Math.sin(ph), 1.4], pad: 1.0, head: 0,
  };
}

/** Calcula la pose objetivo y la velocidad de mezcla. */
export function targetPose(s: RigInput, noPaddle: boolean): { pose: Pose; rate: number; snap?: boolean } {
  // locomoción base
  let base: Pose;
  if (s.airborne) base = s.vy > 0.5 ? POSES.jumpUp : lerpPose(POSES.jumpUp, POSES.tuck, Math.min(1, (0.5 - s.vy) / 2));
  else {
    const bob = Math.sin(s.time * Math.PI * 2 * ANIM.idleBobHz) * ANIM.idleBob;
    const R0 = noPaddle ? POSES.footReady : POSES.ready, R1 = noPaddle ? POSES.footReadyLow : POSES.readyLow;
    const idle = { ...lerpPose(R0, R1, s.prep * 0.6), bob: R0.bob + bob };
    base = s.speed > 0.3 ? lerpPose(idle, runPose(s.runPhase, s.fwd < -1, noPaddle), Math.min(1, s.speed / 3)) : idle;
    if (s.powered && s.speed < 0.3) base = POSES.power;
  }
  if (s.crouch > 0) base = lerpPose(base, POSES.land, s.crouch);
  if (s.stunned) return { pose: POSES.stun, rate: ANIM.blendNormal };
  if (s.mood === 'happy') return { pose: lerpPose(POSES.cheerA, POSES.cheerB, (Math.sin(s.time * 11) + 1) / 2), rate: ANIM.blendNormal };
  if (s.mood === 'sad') return { pose: POSES.sad, rate: ANIM.blendSlow };

  const sw = s.swing;
  const FOOT: Record<string, Pose[]> = {
    kick: [POSES.kickWind, POSES.kickHit, POSES.kickFollow],
    head: [POSES.headWind, POSES.headHit, POSES.headFollow],
    chest: [POSES.chestWind, POSES.chestHit, POSES.chestFollow],
    shark: [POSES.sharkWind, POSES.sharkHit, POSES.sharkFollow],
    fkserve: [POSES.fkWind, POSES.fkHit, POSES.fkFollow],
  };
  const seq = FOOT[sw.type] ?? (sw.type === 'over'
    ? [POSES.overWind, POSES.overHit, POSES.overFollow]
    : sw.type === 'serve' ? [sw.t > 0.22 ? POSES.serveCock : POSES.serveToss, POSES.serveHit, POSES.serveFollow]
      : [POSES.foreWind, POSES.foreHit, POSES.foreFollow]);
  const legsOwn = sw.type === 'kick' || sw.type === 'shark' || sw.type === 'fkserve';
  const full = sw.type === 'serve' || !!FOOT[sw.type] || (sw.type === 'over' && s.airborne);
  const mix = (p: Pose) => (full ? (s.airborne && !legsOwn ? { ...p, legF: base.legF, legB: base.legB, bob: base.bob } : p) : upper(base, p, 1));
  switch (sw.stage) {
    case 'windup': return { pose: mix(seq[0]), rate: ANIM.blendFast };
    case 'snap': return { pose: mix(seq[1]), rate: 60, snap: sw.t < 0.02 };
    case 'follow': {
      const p = mix(seq[2]);
      // rebote de la pala tras el latigazo
      p.pad += Math.sin(sw.t * 38) * ANIM.paddleWobble * Math.exp(-sw.t * 10);
      return { pose: p, rate: 34 };
    }
    case 'recover': return { pose: base, rate: ANIM.blendNormal };
  }
  // anticipación: la pala se prepara sola cuando la bola se acerca
  if (s.prep > 0 && !noPaddle) return { pose: upper(base, POSES.foreWind, s.prep * 0.45), rate: ANIM.blendNormal };
  return { pose: base, rate: s.airborne ? ANIM.blendFast : ANIM.blendNormal };
}


// ------------------------------------------------------------------------------- piezas
/** Orden de dibujo: [nombre de la pieza, frame del atlas, ¿lado del fondo (más oscuro)?] */
export function partOrder(F: Record<string, RigFrame>): [string, string, boolean][] {
  return [
    ['upperB', 'upperarm', true], ['foreB', 'forearm', true], ['thighB', 'thigh', true], ['lowerB', 'lowerleg', true],
    ['torso', 'torso', false], ['thighF', 'thigh', false], ['lowerF', 'lowerleg', false], ['head', 'head', false],
    ...(F.paddlehand
      ? [['upperF', 'upperarm', false], ['foreF', 'forearm', false], ['paddle', 'paddlehand', false]] as [string, string, boolean][]
      // sin mano con pala: la pala suelta va DETRÁS del antebrazo para que el puño tape el mango
      : [['upperF', 'upperarm', false], ['paddle', 'paddle', false], ['foreF', 'forearm', false]] as [string, string, boolean][]),
  ];
}

/** Anclajes anatómicos dentro de cada pieza (px de arte), medidos sobre la hoja importada. */
export function rigAnchors(F: Record<string, RigFrame>) {
  const T = F.torso;
  return {
    hip: [T.w * 0.5, T.h * 0.8] as [number, number],
    shoulder: [T.w * 0.24, T.h * 0.14] as [number, number],
    neck: [T.w * 0.56, T.h * 0.03] as [number, number],
    wrist: F.forearm.h * (F.paddlehand ? 0.62 : 0.8), // sin mano de pala: centro del puño
  };
}

/** Origen (0..1) de cada pieza: el punto sobre el que gira. */
export function partOrigin(F: Record<string, RigFrame>, name: string, frame: string): [number, number] {
  const f = F[frame];
  if (name === 'torso') { const A = rigAnchors(F); return [A.hip[0] / f.w, A.hip[1] / f.h]; }
  if (name === 'head') return [f.bot[0] / f.w, f.bot[1] / f.h];
  if (name === 'paddle' && !F.paddlehand) return [0.5, 0.84];
  return [f.top[0] / f.w, f.top[1] / f.h];
}

export interface PartXf { x: number; y: number; rot: number; sy: number }

/** Posición/rotación de cada pieza para una pose (coordenadas locales del personaje, pies en 0,0, mirando a la derecha). */
export function layoutParts(F: Record<string, RigFrame>, p: Pose, hk = 1, lk = 1): Record<string, PartXf> {
  const A = rigAnchors(F);
  const LS = ANIM.legScale * lk;
  const len = (f: RigFrame) => f.bot[1] - f.top[1];
  const dir = (a: number) => ({ x: Math.sin(a), y: Math.cos(a) });
  const THIGH = (len(F.thigh) - 1) * LS, SHIN = (F.lowerleg.h - F.lowerleg.top[1] - 2) * LS;
  const UPPER = len(F.upperarm) - 1, FORE = A.wrist - F.forearm.top[1];
  const out: Record<string, PartXf> = {};
  const footY = (lg: [number, number]) => Math.cos(lg[0]) * THIGH + Math.cos(lg[0] - lg[1]) * SHIN;
  const hipH = Math.max(footY(p.legF), footY(p.legB));
  const hip = { x: -p.lean * 3, y: -hipH + p.bob };
  const leg = (tn: string, ln: string, lg: [number, number], dx: number) => {
    const h0 = { x: hip.x + dx, y: hip.y };
    out[tn] = { x: h0.x, y: h0.y, rot: -lg[0], sy: LS };
    const d = dir(lg[0]);
    out[ln] = { x: h0.x + d.x * THIGH, y: h0.y + d.y * THIGH, rot: -(lg[0] - lg[1]) * 0.85 - lg[0] * 0.15, sy: LS };
  };
  leg('thighB', 'lowerB', p.legB, -2);
  leg('thighF', 'lowerF', p.legF, 2);
  const r = -p.lean;
  out.torso = { x: hip.x, y: hip.y, rot: r, sy: 1 };
  const local = (lx: number, ly: number) => {
    const dx = lx - A.hip[0], dy = ly - A.hip[1];
    return { x: hip.x + dx * Math.cos(r) - dy * Math.sin(r), y: hip.y + dx * Math.sin(r) + dy * Math.cos(r) };
  };
  const neck = local(A.neck[0], A.neck[1] + 3);
  const sh = local(A.shoulder[0], A.shoulder[1]);
  out.head = { x: neck.x, y: neck.y, rot: r * 0.5 - p.head, sy: ANIM.headScale * hk };
  const arm = (un: string, fn: string, a: [number, number], dx: number) => {
    const s0 = { x: sh.x + dx, y: sh.y };
    out[un] = { x: s0.x, y: s0.y, rot: -a[0], sy: 1 };
    const d = dir(a[0]);
    const el = { x: s0.x + d.x * UPPER, y: s0.y + d.y * UPPER };
    out[fn] = { x: el.x, y: el.y, rot: -(a[0] + a[1]), sy: 1 };
    const d2 = dir(a[0] + a[1]);
    return { x: el.x + d2.x * FORE, y: el.y + d2.y * FORE };
  };
  arm('upperB', 'foreB', p.armB, -1);
  const wrist = arm('upperF', 'foreF', p.armF, 1);
  const pa = p.armF[0] + p.armF[1] + p.pad;
  out.paddle = { x: wrist.x, y: wrist.y, rot: F.paddlehand ? -pa : Math.PI - pa, sy: 1 };
  return out;
}

/** Frame de cabeza según la expresión. */
export function headFrame(F: Record<string, RigFrame>, s: { expr: RigInput['expr']; mood: RigInput['mood']; time: number }) {
  const f = s.expr === 'happy' ? (s.mood === 'happy' && F.head_laugh && Math.sin(s.time * 6) > 0 ? 'head_laugh' : 'head_happy')
    : s.expr === 'effort' ? 'head_angry' : s.expr === 'sad' ? 'head_sad' : 'head';
  return F[f] ? f : 'head';
}
