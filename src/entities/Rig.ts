import Phaser from 'phaser';

/**
 * Personaje "recortable" (cut-out) animado por esqueleto a partir de piezas de arte
 * (importadas con art/tools/ingest_parts.py).
 *
 * Animación basada en el vídeo de referencia:
 *  - guardia agachada con la pala delante y botecitos continuos,
 *  - carrera con rebote, rodillas altas y cadencia ligada a la velocidad (los pies no patinan),
 *  - golpes en 4 fases: preparación rápida -> LATIGAZO casi instantáneo -> gesto final sostenido -> recuperación,
 *  - salto: agachado previo, estiramiento al subir, piernas recogidas arriba, aplastamiento al caer,
 *  - movimiento secundario: mechón de pelo con muelle, rebote de la pala tras el golpe.
 */

export interface RigFrame { x: number; y: number; w: number; h: number; top: [number, number]; bot: [number, number] }
export interface RigData { pixel: number; frames: Record<string, RigFrame>; scale?: { head?: number; leg?: number } }

export function registerRigFrames(scene: Phaser.Scene, key: string, data: RigData) {
  const tex = scene.textures.get(key);
  for (const [name, f] of Object.entries(data.frames)) if (!tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

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

const P = (lean: number, bob: number, legF: [number, number], legB: [number, number], armF: [number, number], armB: [number, number], pad = 0, head = 0): Pose =>
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
function upper(a: Pose, b: Pose, t: number): Pose {
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

function runPose(ph: number, back: boolean, noPaddle = false): Pose {
  const amp = back ? 0.65 : 1.0;
  const leg = (p: number): [number, number] => [amp * Math.sin(p), 0.45 + 1.55 * Math.max(0, -Math.sin(p - 0.9))];
  return {
    lean: back ? -0.05 : ANIM.runLean, bob: -Math.abs(Math.sin(ph)) * ANIM.runBob + 1.5,
    legF: leg(ph), legB: leg(ph + Math.PI),
    // corre con la pala arriba delante (en guardia) y el brazo libre bombeando
    armF: noPaddle ? [0.2 - 0.9 * Math.sin(ph), 1.4] : [0.6 - 0.15 * Math.sin(ph), 1.0], armB: [0.2 + 0.9 * Math.sin(ph), 1.4], pad: 1.0, head: 0,
  };
}

// ------------------------------------------------------------------------------- rig
export class Rig {
  container: Phaser.GameObjects.Container;
  private parts: Record<string, Phaser.GameObjects.Image> = {};
  private cur: Pose = { ...POSES.ready };
  private F: Record<string, RigFrame>;
  private tuftAng = 0;
  private tuftVel = 0;
  private lastHeadX = 0;
  private lastHeadY = 0;
  height: number;

  private hk = 1;
  private lk = 1;

  noPaddle = false;

  constructor(scene: Phaser.Scene, key: string, data: RigData, opts: { noPaddle?: boolean } = {}) {
    this.noPaddle = !!opts.noPaddle;
    this.hk = data.scale?.head ?? 1;
    this.lk = data.scale?.leg ?? 1;
    this.F = data.frames;
    this.height = data.frames.full?.h ?? 120;
    this.container = scene.add.container(0, 0);
    const mk = (name: string, frame: string, back = false) => {
      const f = this.F[frame];
      const im = scene.add.image(0, 0, key, frame).setOrigin(f.top[0] / f.w, f.top[1] / f.h);
      if (back) im.setTint(0xb8b2c8);
      this.parts[name] = im;
      return im;
    };
    const has = (n: string) => !!this.F[n];
    this.container.add([
      mk('upperB', 'upperarm', true), mk('foreB', 'forearm', true),
      mk('thighB', 'thigh', true), mk('lowerB', 'lowerleg', true),
      mk('torso', 'torso'),
      mk('thighF', 'thigh'), mk('lowerF', 'lowerleg'),
      mk('head', 'head'),
      ...(this.F.paddlehand
        ? [mk('upperF', 'upperarm'), mk('foreF', 'forearm'), mk('paddle', 'paddlehand')]
        // sin mano con pala: la pala suelta va DETRÁS del antebrazo para que el puño tape el mango
        : [mk('upperF', 'upperarm'), mk('paddle', 'paddle'), mk('foreF', 'forearm')]),
    ]);
    if (!this.F.paddlehand) this.parts.paddle.setOrigin(0.5, 0.84);
    if (this.noPaddle) this.parts.paddle.setVisible(false);
    // el antebrazo con pala se recorta en la muñeca (la mano la pone la pieza de la pala)
    const fa = this.F.forearm;
    if (this.F.paddlehand) this.parts.foreF.setCrop(0, 0, fa.w, Math.round(fa.h * 0.66));
    this.parts.torso.setOrigin(this.A.hip[0] / this.F.torso.w, this.A.hip[1] / this.F.torso.h);
    this.setHead('head');
  }

  /** Anclajes anatómicos dentro de cada pieza (px de arte), medidos sobre la hoja importada. */
  private get A() {
    const T = this.F.torso;
    return {
      hip: [T.w * 0.5, T.h * 0.8] as [number, number],
      shoulder: [T.w * 0.24, T.h * 0.14] as [number, number],
      neck: [T.w * 0.56, T.h * 0.03] as [number, number],
      wrist: this.F.forearm.h * (this.F.paddlehand ? 0.62 : 0.8), // sin mano de pala: centro del puño
    };
  }

  private setHead(frame: string) {
    const P_ = this.parts.head;
    if (!this.F[frame]) frame = 'head';
    if (P_.frame.name === frame && P_.getData('ok')) return;
    P_.setData('ok', true);
    const hf = this.F[frame];
    P_.setFrame(frame).setOrigin(hf.bot[0] / hf.w, hf.bot[1] / hf.h).setScale(ANIM.headScale * this.hk);
  }

  /** Calcula la pose objetivo y la velocidad de mezcla. */
  private target(s: RigInput): { pose: Pose; rate: number; snap?: boolean } {
    // locomoción base
    let base: Pose;
    if (s.airborne) base = s.vy > 0.5 ? POSES.jumpUp : lerpPose(POSES.jumpUp, POSES.tuck, Math.min(1, (0.5 - s.vy) / 2));
    else {
      const bob = Math.sin(s.time * Math.PI * 2 * ANIM.idleBobHz) * ANIM.idleBob;
      const R0 = this.noPaddle ? POSES.footReady : POSES.ready, R1 = this.noPaddle ? POSES.footReadyLow : POSES.readyLow;
      const idle = { ...lerpPose(R0, R1, s.prep * 0.6), bob: R0.bob + bob };
      base = s.speed > 0.3 ? lerpPose(idle, runPose(s.runPhase, s.fwd < -1, this.noPaddle), Math.min(1, s.speed / 3)) : idle;
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
    if (s.prep > 0 && !this.noPaddle) return { pose: upper(base, POSES.foreWind, s.prep * 0.45), rate: ANIM.blendNormal };
    return { pose: base, rate: s.airborne ? ANIM.blendFast : ANIM.blendNormal };
  }

  update(dt: number, s: RigInput) {
    const { pose, rate, snap } = this.target(s);
    const k = snap ? 1 : 1 - Math.exp(-dt * rate);
    this.cur = lerpPose(this.cur, pose, k);
    this.setHead(s.expr === 'happy' ? (s.mood === 'happy' && this.F.head_laugh && Math.sin(s.time * 6) > 0 ? 'head_laugh' : 'head_happy') : s.expr === 'effort' ? 'head_angry' : s.expr === 'sad' ? 'head_sad' : 'head');
    this.layout(this.cur, dt);
  }

  private layout(p: Pose, dt: number) {
    const F = this.F, Q = this.parts, A = this.A;
    const LS = ANIM.legScale * this.lk;
    const len = (f: RigFrame) => f.bot[1] - f.top[1];
    const dir = (a: number) => ({ x: Math.sin(a), y: Math.cos(a) });
    const THIGH = (len(F.thigh) - 1) * LS, SHIN = (F.lowerleg.h - F.lowerleg.top[1] - 2) * LS;
    const UPPER = len(F.upperarm) - 1, FORE = A.wrist - F.forearm.top[1];

    for (const n of ['thighB', 'thighF', 'lowerB', 'lowerF']) Q[n].setScale(1, LS);

    // altura de la cadera: el pie más bajo toca el suelo (y = 0)
    const footY = (lg: [number, number]) => Math.cos(lg[0]) * THIGH + Math.cos(lg[0] - lg[1]) * SHIN;
    const hipH = Math.max(footY(p.legF), footY(p.legB));
    const hip = { x: -p.lean * 3, y: -hipH + p.bob };

    const leg = (thigh: Phaser.GameObjects.Image, lower: Phaser.GameObjects.Image, lg: [number, number], dx: number) => {
      const h0 = { x: hip.x + dx, y: hip.y };
      thigh.setPosition(h0.x, h0.y).setRotation(-lg[0]);
      const d = dir(lg[0]);
      lower.setPosition(h0.x + d.x * THIGH, h0.y + d.y * THIGH).setRotation(-(lg[0] - lg[1]) * 0.85 - lg[0] * 0.15);
    };
    leg(Q.thighB, Q.lowerB, p.legB, -2);
    leg(Q.thighF, Q.lowerF, p.legF, 2);

    // torso (pivota en la cadera)
    const r = -p.lean;
    const T = F.torso;
    Q.torso.setPosition(hip.x, hip.y).setRotation(r);
    const local = (lx: number, ly: number) => {
      const dx = lx - A.hip[0], dy = ly - A.hip[1];
      return { x: hip.x + dx * Math.cos(r) - dy * Math.sin(r), y: hip.y + dx * Math.sin(r) + dy * Math.cos(r) };
    };
    const neck = local(A.neck[0], A.neck[1] + 3);
    const sh = local(A.shoulder[0], A.shoulder[1]);
    void T;
    Q.head.setPosition(neck.x, neck.y).setRotation(r * 0.5 - p.head);

    // mechón de pelo con muelle (reacciona al movimiento de la cabeza)
    if (Q.tuft) {
      const hx = neck.x, hy = neck.y;
      const vx = (hx - this.lastHeadX) / Math.max(dt, 1e-3), vy = (hy - this.lastHeadY) / Math.max(dt, 1e-3);
      this.lastHeadX = hx; this.lastHeadY = hy;
      const force = -this.tuftAng * 180 - this.tuftVel * 14 + (vx * 0.02 + vy * 0.03);
      this.tuftVel += force * dt;
      this.tuftAng = Phaser.Math.Clamp(this.tuftAng + this.tuftVel * dt, -0.5, 0.5);
      const hr = r * 0.5 - p.head;
      const back = { x: -10 * ANIM.headScale * this.hk, y: -20 * ANIM.headScale * this.hk };
      Q.tuft.setPosition(neck.x + back.x * Math.cos(hr) - back.y * Math.sin(hr), neck.y + back.x * Math.sin(hr) + back.y * Math.cos(hr))
        .setRotation(hr + this.tuftAng).setScale(ANIM.headScale * this.hk);
    }

    // brazos
    const arm = (u: Phaser.GameObjects.Image, f: Phaser.GameObjects.Image, a: [number, number], dx: number) => {
      const s0 = { x: sh.x + dx, y: sh.y };
      u.setPosition(s0.x, s0.y).setRotation(-a[0]);
      const d = dir(a[0]);
      const el = { x: s0.x + d.x * UPPER, y: s0.y + d.y * UPPER };
      f.setPosition(el.x, el.y).setRotation(-(a[0] + a[1]));
      const d2 = dir(a[0] + a[1]);
      return { x: el.x + d2.x * FORE, y: el.y + d2.y * FORE };
    };
    arm(Q.upperB, Q.foreB, p.armB, -1);
    const wrist = arm(Q.upperF, Q.foreF, p.armF, 1);
    const pa = p.armF[0] + p.armF[1] + p.pad;
    if (this.F.paddlehand) Q.paddle.setPosition(wrist.x, wrist.y).setRotation(-pa);
    else Q.paddle.setPosition(wrist.x, wrist.y).setRotation(Math.PI - pa); // la pala suelta apunta hacia arriba en la imagen
  }

  destroy() { this.container.destroy(); }
}
