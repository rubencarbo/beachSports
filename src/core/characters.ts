import Phaser from 'phaser';
import { Material, PixGrid, bakeSheet, mat, tint } from './pixelArt';

// ---------------------------------------------------------------------------------------------
// Deportistas (sprite 48x64 px de arte). Origen de los pies en (24, 61).
// Ángulos medidos desde la vertical hacia abajo; positivo = hacia delante (hacia la derecha).
// ---------------------------------------------------------------------------------------------

export const ATH_W = 48;
export const ATH_H = 64;
export const ATH_FOOT_Y = 61;

type Expr = 'normal' | 'effort' | 'happy' | 'sad' | 'shock';

interface Pose {
  lean: number;
  bob?: number;
  legF: [number, number]; // [muslo, flexión rodilla]
  legB: [number, number];
  armF: [number, number]; // [brazo, codo relativo] (brazo de la pala, delante)
  armB: [number, number];
  pad?: number; // ángulo de la pala relativo al antebrazo
  headDy?: number;
  expr?: Expr;
  air?: boolean;
}

export interface AthleteLook {
  skin: RGB3;
  hair: RGB3;
  hairStyle: 'spiky' | 'sun';
  band: RGB3; // cinta o visera
  shirt: RGB3;
  trim: number;
  tank: boolean;
  shorts: RGB3;
  stripe: number;
  sock: number;
  shoe: number;
  shoeAccent: number;
  paddle: RGB3;
  paddleRim: number;
}
type RGB3 = number;

// índices de materiales
const SK = 0, HR = 1, BD = 2, SH = 3, TR = 4, ST = 5, SP = 6, SO = 7, SE = 8, SA = 9, PD = 10, PR = 11, HD = 12, WB = 13;

function athleteMats(L: AthleteLook): Material[] {
  const m: Material[] = [];
  m[SK] = mat(L.skin, tint(L.skin, 1.12), tint(L.skin, 0.78), tint(L.skin, 0.38));
  m[HR] = mat(L.hair, tint(L.hair, 1.6), tint(L.hair, 0.65), tint(L.hair, 0.3), { highlight: true });
  m[BD] = mat(L.band, tint(L.band, 1.3), tint(L.band, 0.7), tint(L.band, 0.35));
  m[SH] = mat(L.shirt, tint(L.shirt, 1.2), tint(L.shirt, 0.72), tint(L.shirt, 0.32), { highlight: true });
  m[TR] = mat(L.trim, undefined, undefined, tint(L.trim, 0.4));
  m[ST] = mat(L.shorts, tint(L.shorts, 1.5), tint(L.shorts, 0.7), 0x0b0b12);
  m[SP] = mat(L.stripe, undefined, undefined, 0x0b0b12, { shade: false });
  m[SO] = mat(L.sock, undefined, undefined, 0x0b0b12);
  m[SE] = mat(L.shoe, 0xffffff, tint(L.shoe, 0.75), 0x1a1a24);
  m[SA] = mat(L.shoeAccent, undefined, undefined, 0x1a1a24, { shade: false });
  m[PD] = mat(L.paddle, tint(L.paddle, 1.3), tint(L.paddle, 0.75), tint(L.paddle, 0.35), { highlight: true });
  m[PR] = mat(L.paddleRim, undefined, undefined, tint(L.paddleRim, 0.4), { shade: false });
  m[HD] = mat(0x5a3a22, undefined, undefined, 0x24160c);
  m[WB] = mat(L.band, undefined, undefined, tint(L.band, 0.35), { shade: false });
  return m;
}

const P = (x: number, y: number, len: number, a: number) => ({ x: x + Math.sin(a) * len, y: y + Math.cos(a) * len });

function drawAthlete(pose: Pose, L: AthleteLook, t: number): PixGrid {
  const g = new PixGrid(ATH_W, ATH_H);
  const THIGH = 8, SHIN = 8, TORSO = 12;
  // calcula cadera para que el pie más bajo toque el suelo
  const legEnd = (lg: [number, number]) => {
    const k = P(0, 0, THIGH, lg[0]);
    return P(k.x, k.y, SHIN, lg[0] - lg[1]);
  };
  const footLow = Math.max(legEnd(pose.legF).y, legEnd(pose.legB).y);
  const hipY = (pose.air ? ATH_FOOT_Y - 2 - 16 : ATH_FOOT_Y - 1.5 - footLow) + (pose.bob ?? 0);
  const hip = { x: 23 - pose.lean * 2, y: hipY };
  const neck = { x: hip.x + Math.sin(pose.lean) * TORSO, y: hip.y - Math.cos(pose.lean) * TORSO };
  const sh = { x: neck.x + Math.sin(pose.lean) * -2, y: neck.y + 2 };
  const head = { x: neck.x + 1 + pose.lean * 2, y: neck.y - 6 + (pose.headDy ?? 0) };

  const leg = (lg: [number, number], back: boolean) => {
    const knee = P(hip.x, hip.y, THIGH, lg[0]);
    const ank = P(knee.x, knee.y, SHIN, lg[0] - lg[1]);
    g.capsule(hip.x, hip.y, knee.x, knee.y, 2.6, SK, back);
    // pantalón hasta medio muslo
    const mid = { x: (hip.x + knee.x * 1.2) / 2.2, y: (hip.y + knee.y * 1.2) / 2.2 };
    g.capsule(hip.x, hip.y, mid.x, mid.y, 3.1, ST, back);
    g.capsule(knee.x, knee.y, ank.x, ank.y, 2.1, SK, back);
    const sockTop = { x: ank.x + (knee.x - ank.x) * 0.35, y: ank.y + (knee.y - ank.y) * 0.35 };
    g.capsule(sockTop.x, sockTop.y, ank.x, ank.y, 2.1, SO, back);
    // zapatilla
    const toe = { x: ank.x + 4, y: ank.y + 1.2 };
    g.capsule(ank.x - 1, ank.y + 0.5, toe.x, toe.y, 1.9, SE, back);
    g.set(ank.x + 1, ank.y + 1, SA, back);
    g.set(ank.x + 2, ank.y + 1, SA, back);
  };
  const arm = (a: [number, number], back: boolean, paddle: boolean) => {
    const el = P(sh.x, sh.y, 6, a[0]);
    const hand = P(el.x, el.y, 6, a[0] + a[1]);
    g.capsule(sh.x, sh.y, el.x, el.y, 1.9, SK, back);
    g.capsule(el.x, el.y, hand.x, hand.y, 1.7, SK, back);
    const wb = P(el.x, el.y, 4.2, a[0] + a[1]);
    g.capsule(wb.x, wb.y, P(el.x, el.y, 5, a[0] + a[1]).x, P(el.x, el.y, 5, a[0] + a[1]).y, 1.9, WB, back);
    if (!L.tank) g.capsule(sh.x, sh.y, P(sh.x, sh.y, 2.6, a[0]).x, P(sh.x, sh.y, 2.6, a[0]).y, 2.5, SH, back);
    if (paddle) {
      const pa = a[0] + a[1] + (pose.pad ?? 0);
      const hEnd = P(hand.x, hand.y, 3, pa);
      g.capsule(hand.x, hand.y, hEnd.x, hEnd.y, 1.1, HD, back);
      const c = P(hand.x, hand.y, 7.5, pa);
      g.circle(c.x, c.y, 4.6, PR, back);
      g.circle(c.x, c.y, 3.6, PD, back);
      // agujeros de la pala
      g.px(c.x - 1, c.y - 1, tint(L.paddle, 0.55));
      g.px(c.x + 1, c.y + 1, tint(L.paddle, 0.55));
      g.px(c.x + 1, c.y - 1, tint(L.paddle, 0.55));
    }
    g.circle(hand.x, hand.y, 1.7, SK, back);
  };

  // orden de pintado: fondo -> delante
  arm(pose.armB, true, false);
  leg(pose.legB, true);
  // torso
  g.capsule(hip.x, hip.y - 1, neck.x, neck.y + 1.5, 4.6, SH);
  if (L.tank) {
    // camiseta de tirantes: hombro descubierto
    g.circle(sh.x + 0.5, sh.y, 1.8, SK);
  } else {
    // ribete del cuello
    g.set(neck.x + 1, neck.y, TR); g.set(neck.x + 2, neck.y + 1, TR); g.set(neck.x, neck.y, TR);
  }
  // franja lateral camiseta
  g.capsule(hip.x + 0.5, hip.y - 3, neck.x - 0.5, neck.y + 4, 0.6, TR);
  // pantalón
  g.capsule(hip.x - 0.5, hip.y - 1, hip.x + 0.5, hip.y + 1.5, 4.4, ST);
  g.capsule(hip.x - 4, hip.y - 1, hip.x - 3.5, hip.y + 3, 0.6, SP);
  leg(pose.legF, false);

  // cabeza
  const hx = head.x, hy = head.y;
  g.circle(hx, hy, 6.3, SK);
  g.ellipse(hx + 5.2, hy + 1.5, 1.3, 1.6, SK); // nariz/mejilla en 3/4
  g.circle(hx - 3, hy + 1, 1.4, SK); // oreja
  if (L.hairStyle === 'spiky') {
    g.circle(hx - 1, hy - 1.5, 6.8, HR, false, (x, y) => y <= hy - 3 || x <= hx - 3);
    const tips: [number, number][] = [[-9, -5], [-8, -10], [-4, -12], [0, -13], [4, -11], [7, -8]];
    for (const [tx, ty] of tips) g.tri(hx - 2 + tx * 0.25, hy - 4, hx + 2 + tx * 0.3, hy - 4, hx + tx, hy + ty, HR);
    g.tri(hx - 6, hy - 2, hx - 6, hy + 3, hx - 11, hy + 1, HR);
    // flequillo
    g.tri(hx + 1, hy - 4, hx + 5, hy - 4, hx + 4, hy - 1, HR);
    g.tri(hx + 4, hy - 5, hx + 8, hy - 4, hx + 7, hy - 1, HR);
    // cinta
    for (let x = Math.floor(hx - 7); x <= hx + 6; x++) for (const y of [hy - 4, hy - 3]) if (g.get(x, Math.round(y)) >= 0) g.set(x, y, BD);
    const wav = Math.sin(t) * 1.2;
    g.capsule(hx - 7, hy - 3, hx - 12, hy - 1 + wav, 0.9, BD);
    g.capsule(hx - 7, hy - 3, hx - 11, hy + 2 + wav, 0.8, BD);
  } else {
    // pelo "sol": pinchos en abanico + visera
    g.circle(hx - 1, hy - 1.5, 6.8, HR, false, (x, y) => y <= hy - 3 || x <= hx - 3);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.05 - (i / 8) * Math.PI * 1.15;
      const bx = hx - 1 + Math.cos(a) * 5.5, by = hy - 1.5 + Math.sin(a) * 5.5;
      const tx = hx - 1 + Math.cos(a) * 11, ty = hy - 1.5 + Math.sin(a) * 10.5;
      const nx = -Math.sin(a) * 2.2, ny = Math.cos(a) * 2.2;
      g.tri(bx + nx, by + ny, bx - nx, by - ny, tx, ty, HR);
    }
    for (let x = Math.floor(hx - 6); x <= hx + 6; x++) for (const y of [hy - 4, hy - 3]) if (g.get(x, Math.round(y)) >= 0) g.set(x, y, BD);
    g.rect(Math.round(hx + 4), Math.round(hy - 4), 6, 2, BD); // visera
  }

  // brazo delantero con pala (por delante de la cabeza en remates)
  arm(pose.armF, false, true);

  // cara (detalles píxel a píxel)
  const ex = Math.round(hx + 2), ey = Math.round(hy);
  const EYE = 0x1a1420, WHITE = 0xffffff, MOUTH = 0x7a2a22, BROW = tint(L.hair, 0.5);
  const e = pose.expr ?? 'normal';
  if (e === 'happy') {
    for (const ox of [0, 3]) { g.px(ex + ox - 1, ey, EYE); g.px(ex + ox, ey - 1, EYE); g.px(ex + ox + 1, ey, EYE); }
    g.px(ex + 1, ey + 3, MOUTH); g.px(ex + 2, ey + 3, MOUTH); g.px(ex + 3, ey + 3, MOUTH); g.px(ex + 2, ey + 4, MOUTH);
    g.px(ex + 1, ey + 2, WHITE); g.px(ex + 2, ey + 2, WHITE); g.px(ex + 3, ey + 2, WHITE);
  } else {
    const shock = e === 'shock';
    for (const ox of [0, 3]) {
      g.px(ex + ox, ey, EYE); g.px(ex + ox, ey + 1, EYE);
      if (shock) { g.px(ex + ox - 1, ey, WHITE); g.px(ex + ox - 1, ey + 1, EYE); }
      else g.px(ex + ox - 1, ey, WHITE);
    }
    if (e === 'effort') {
      g.px(ex - 1, ey - 2, BROW); g.px(ex, ey - 1, BROW); g.px(ex + 4, ey - 1, BROW); g.px(ex + 5, ey - 2, BROW);
      g.px(ex + 1, ey + 3, WHITE); g.px(ex + 2, ey + 3, WHITE); g.px(ex + 3, ey + 3, WHITE);
      g.px(ex + 1, ey + 4, MOUTH); g.px(ex + 2, ey + 4, MOUTH); g.px(ex + 3, ey + 4, MOUTH);
    } else if (e === 'sad') {
      g.px(ex - 1, ey - 1, BROW); g.px(ex + 4, ey - 2, BROW);
      g.px(ex + 1, ey + 4, MOUTH); g.px(ex + 2, ey + 3, MOUTH); g.px(ex + 3, ey + 4, MOUTH);
      g.px(ex - 2, ey + 2, 0x9ad8ff); g.px(ex - 2, ey + 3, 0x5ab0f0); // gota
    } else if (shock) {
      g.px(ex + 2, ey + 3, MOUTH); g.px(ex + 2, ey + 4, MOUTH); g.px(ex + 3, ey + 3, MOUTH); g.px(ex + 3, ey + 4, MOUTH);
    } else {
      g.px(ex + 2, ey + 3, MOUTH); g.px(ex + 3, ey + 3, MOUTH);
    }
  }
  g.px(hx - 3, hy + 1, tint(L.skin, 0.7)); // oreja
  return g;
}

/** Definición de todas las animaciones. */
function athletePoses(): { name: string; pose: Pose; t: number }[] {
  const out: { name: string; pose: Pose; t: number }[] = [];
  const ready: Pose = { lean: 0.15, legF: [0.4, 0.55], legB: [-0.35, 0.4], armF: [0.55, 1.35], armB: [0.25, 1.1], pad: 0.2 };
  out.push({ name: 'idle0', pose: ready, t: 0 });
  out.push({ name: 'idle1', pose: { ...ready, bob: 1, armF: [0.6, 1.3] }, t: 1.5 });
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * Math.PI * 2;
    const leg = (p: number): [number, number] => [0.85 * Math.sin(p), 0.35 + 1.3 * Math.max(0, -Math.sin(p - 0.9))];
    out.push({
      name: `run${i}`, t: ph,
      pose: {
        lean: 0.32, bob: Math.abs(Math.sin(ph)) > 0.7 ? -1 : 0,
        legF: leg(ph), legB: leg(ph + Math.PI),
        armF: [0.45 - 0.35 * Math.sin(ph), 1.4], armB: [0.8 * Math.sin(ph), 1.4], pad: 0.2, expr: 'normal',
      },
    });
  }
  const wide: Pick<Pose, 'legF' | 'legB'> = { legF: [0.55, 0.5], legB: [-0.5, 0.45] };
  out.push({ name: 'fore0', t: 0, pose: { ...wide, lean: 0.0, armF: [-1.8, 0.9], armB: [0.9, 0.7], pad: 0.3, expr: 'effort' } });
  out.push({ name: 'fore1', t: 0.5, pose: { ...wide, lean: 0.12, armF: [-0.7, 0.6], armB: [0.7, 0.6], pad: 0.2, expr: 'effort' } });
  out.push({ name: 'fore2', t: 1, pose: { ...wide, lean: 0.28, armF: [1.05, 0.5], armB: [-0.3, 0.6], pad: 0, expr: 'effort' } });
  out.push({ name: 'fore3', t: 1.5, pose: { ...wide, lean: 0.32, armF: [2.3, 0.7], armB: [-0.6, 0.8], pad: 0, expr: 'normal' } });
  const air: Pick<Pose, 'legF' | 'legB' | 'air'> = { legF: [0.9, 1.5], legB: [0.15, 1.2], air: true };
  out.push({ name: 'over0', t: 0, pose: { ...air, lean: -0.2, armF: [3.4, 1.5], armB: [2.6, 0.1], pad: 0.4, expr: 'effort' } });
  out.push({ name: 'over1', t: 0.5, pose: { ...air, lean: -0.05, armF: [3.1, 0.6], armB: [2.2, 0.2], pad: 0.2, expr: 'effort' } });
  out.push({ name: 'over2', t: 1, pose: { ...air, lean: 0.25, armF: [2.3, 0.1], armB: [0.6, 0.4], pad: 0, expr: 'effort' } });
  out.push({ name: 'over3', t: 1.5, pose: { legF: [0.6, 0.3], legB: [-0.2, 0.5], air: true, lean: 0.4, armF: [0.9, 0.3], armB: [-0.4, 0.5], pad: 0, expr: 'normal' } });
  out.push({ name: 'serve0', t: 0, pose: { lean: 0.0, legF: [0.3, 0.2], legB: [-0.3, 0.2], armF: [-1.4, 1.1], armB: [2.9, 0.05], pad: 0.3, expr: 'normal' } });
  out.push({ name: 'serve1', t: 0.5, pose: { lean: -0.1, legF: [0.3, 0.4], legB: [-0.3, 0.3], armF: [3.3, 1.5], armB: [2.4, 0.2], pad: 0.3, expr: 'effort' } });
  out.push({ name: 'serve2', t: 1, pose: { lean: 0.3, legF: [0.4, 0.3], legB: [-0.5, 0.4], armF: [2.2, 0.1], armB: [0.2, 0.6], pad: 0, expr: 'effort' } });
  out.push({ name: 'jump0', t: 0, pose: { ...air, lean: 0.1, armF: [1.4, 1.0], armB: [1.6, 0.6], pad: 0.2, expr: 'effort' } });
  out.push({ name: 'cele0', t: 0, pose: { lean: -0.05, legF: [0.2, 0.1], legB: [-0.2, 0.1], armF: [2.95, 0.15], armB: [3.4, -0.1], pad: 0, expr: 'happy' } });
  out.push({ name: 'cele1', t: 2, pose: { lean: -0.05, legF: [0.5, 1.0], legB: [-0.1, 1.1], air: true, armF: [3.1, 0.3], armB: [3.25, 0.2], pad: 0, expr: 'happy' } });
  out.push({ name: 'sad0', t: 0, pose: { lean: 0.35, legF: [0.15, 0.1], legB: [-0.1, 0.1], armF: [0.1, 0.15], armB: [-0.05, 0.1], pad: 0.1, headDy: 2, expr: 'sad' } });
  out.push({ name: 'stun0', t: 1, pose: { lean: -0.45, legF: [0.7, 0.3], legB: [0.1, 0.6], armF: [-2.2, 0.4], armB: [2.6, 0.5], pad: 0.5, expr: 'shock' } });
  out.push({ name: 'power0', t: 0.5, pose: { lean: 0.05, legF: [0.45, 0.7], legB: [-0.45, 0.65], armF: [2.9, 0.7], armB: [1.4, 0.9], pad: 0.3, expr: 'effort' } });
  return out;
}

export const LOOKS: Record<'sun' | 'wave', AthleteLook> = {
  sun: {
    skin: 0xf0b98a, hair: 0xffb52e, hairStyle: 'sun', band: 0xff4a1a, shirt: 0xff6a10, trim: 0xffd25a, tank: true,
    shorts: 0x262636, stripe: 0xff8a1a, sock: 0xffffff, shoe: 0xeeeeee, shoeAccent: 0xff6a00, paddle: 0xe8452a, paddleRim: 0x5a1a10,
  },
  wave: {
    skin: 0xc98a5e, hair: 0x1a1c2e, hairStyle: 'spiky', band: 0x2a6fd6, shirt: 0x1fb5b5, trim: 0x0d4f5a, tank: false,
    shorts: 0x1a1a24, stripe: 0x1fb5b5, sock: 0x22222e, shoe: 0x22252e, shoeAccent: 0x1fd0d0, paddle: 0x22b8c8, paddleRim: 0x0b3a4a,
  },
};

export function bakeAthletes(scene: Phaser.Scene) {
  for (const key of ['sun', 'wave'] as const) {
    const L = LOOKS[key];
    const poses = athletePoses();
    const grids = poses.map((p) => drawAthlete(p.pose, L, p.t));
    bakeSheet(scene, `ath_${key}`, grids, athleteMats(L), poses.map((p) => p.name));
  }
}

// ---------------------------------------------------------------------------------------------
// Público (sprites 22x36), siluetas en primer plano (40x44), perro y gaviota.
// ---------------------------------------------------------------------------------------------

const SKINS = [0xf2c9a0, 0xe0a87a, 0xc68a5c, 0x9a6440, 0x6e4428, 0xf5d6b8];
const HAIRS = [0x2a1a10, 0x5a3418, 0xe0b040, 0x161616, 0xa0401a, 0x7a5030, 0xd8d0c0, 0x3a2418];
const SHIRTS = [0xff5a5a, 0xffd23f, 0x5ac46a, 0x3a8fff, 0xff9f45, 0xf4f4f4, 0xb07dff, 0x2ec4b6, 0xf15bb5, 0x00b0f0, 0x2a9a5a];
const BOTTOMS = [0x2d3a8c, 0x1b6f6a, 0x333344, 0x8c2d2d, 0x3d7ad6, 0xd8b88d, 0x5a8a3a];
const HATS = [0xff3b3b, 0x2d6cdf, 0xf4f4f4, 0xffd23f, 0x1a9a6a];

const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 8; i++) next();
  return next;
}

const F_SK = 0, F_HR = 1, F_SH = 2, F_BT = 3, F_HAT = 4, F_SIGN = 5, F_POLE = 6;

function drawFan(r: () => number, look: any, pose: 'a' | 'b' | 'c' | 'sign'): PixGrid {
  const g = new PixGrid(22, 36);
  const cx = 11, foot = 34;
  const hip = { x: cx, y: foot - 9 + (look.kid ? 3 : 0) };
  const neck = { x: cx, y: hip.y - (look.kid ? 7 : 9) };
  const head = { x: cx, y: neck.y - 4 };
  const jump = pose === 'c' ? -2 : 0;
  hip.y += jump; neck.y += jump; head.y += jump;
  // piernas
  g.capsule(cx - 1.6, hip.y, cx - 2, foot + jump, 1.4, look.legs ? F_BT : F_SK);
  g.capsule(cx + 1.6, hip.y, cx + 2, foot + jump, 1.4, look.legs ? F_BT : F_SK);
  g.capsule(cx - 1.5, hip.y - 1, cx + 1.5, hip.y + 1, 2.6, F_BT);
  // brazos
  const up = pose === 'b' || pose === 'c' || pose === 'sign';
  if (up) {
    const wave = pose === 'c' ? 1 : 0;
    g.capsule(cx - 3, neck.y + 2, cx - 5 - wave, neck.y - 6, 1.2, F_SK);
    g.capsule(cx + 3, neck.y + 2, cx + 5 + wave, neck.y - 6, 1.2, F_SK);
  } else {
    const sway = pose === 'a' ? 0 : 1;
    g.capsule(cx - 3, neck.y + 2, cx - 4 - sway, hip.y, 1.2, F_SK);
    g.capsule(cx + 3, neck.y + 2, cx + 4, hip.y - sway, 1.2, F_SK);
  }
  // torso
  g.capsule(cx - 0.8, hip.y - 1, cx - 0.8, neck.y + 1.5, 2.2, F_SH);
  g.capsule(cx + 0.8, hip.y - 1, cx + 0.8, neck.y + 1.5, 2.2, F_SH);
  // cabeza
  g.circle(head.x, head.y, 3.6, F_SK);
  const hs = look.hairStyle;
  if (hs === 0) g.circle(head.x, head.y - 1, 3.7, F_HR, false, (x, y) => y <= head.y - 1);
  else if (hs === 1) { g.circle(head.x, head.y - 1, 3.9, F_HR, false, (x, y) => y <= head.y - 1 || Math.abs(x - head.x) >= 3); g.rect(head.x - 4, head.y, 2, 4, F_HR); g.rect(head.x + 3, head.y, 2, 4, F_HR); }
  else if (hs === 2) { g.circle(head.x, head.y - 1, 3.7, F_HR, false, (x, y) => y <= head.y - 1); g.circle(head.x, head.y - 5, 1.8, F_HR); }
  if (look.hat) { g.circle(head.x, head.y - 1.5, 3.9, F_HAT, false, (x, y) => y <= head.y - 2); g.rect(head.x - 5, head.y - 2, 10, 1, F_HAT); }
  // cara
  g.px(head.x - 1, head.y, 0x1a1420); g.px(head.x + 1, head.y, 0x1a1420);
  if (pose === 'b' || pose === 'c' || pose === 'sign') { g.px(head.x, head.y + 2, 0x7a2a22); g.px(head.x - 1, head.y + 2, 0x7a2a22); }
  if (look.glasses) { g.px(head.x - 1, head.y, 0x101010); g.px(head.x - 2, head.y, 0x101010); g.px(head.x + 1, head.y, 0x101010); g.px(head.x + 2, head.y, 0x101010); g.px(head.x, head.y, 0x101010); }
  // cartel
  if (pose === 'sign') {
    g.rect(cx - 7, neck.y - 13, 14, 9, F_SIGN);
    if (look.signType === 0) {
      for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) g.px(cx + x, neck.y - 9 + y, 0xffb000);
      for (const [x, y] of [[0, -3], [0, 3], [3, 0], [-3, 0]]) g.px(cx + x, neck.y - 9 + y, 0xff8a00);
    } else {
      for (let x = -5; x <= 5; x++) g.px(cx + x, neck.y - 8 + Math.round(Math.sin(x * 0.9) * 1.5), 0x1e7fd8);
      for (let x = -5; x <= 5; x++) g.px(cx + x, neck.y - 6 + Math.round(Math.sin(x * 0.9 + 1) * 1), 0x5ab0f0);
    }
  }
  return g;
}

function fanMats(look: any): Material[] {
  const m: Material[] = [];
  m[F_SK] = mat(look.skin);
  m[F_HR] = mat(look.hair, undefined, undefined, undefined, { highlight: true });
  m[F_SH] = mat(look.shirt);
  m[F_BT] = mat(look.bottom);
  m[F_HAT] = mat(look.hatC);
  m[F_SIGN] = mat(0xfff8e8, undefined, 0xd8d0c0, 0x5a5048);
  m[F_POLE] = mat(0x8a6a4a);
  return m;
}

export const FAN_VARIANTS = 18;

export function bakeCrowd(scene: Phaser.Scene) {
  for (let i = 0; i < FAN_VARIANTS; i++) {
    const r = rng(i + 1);
    const look = {
      skin: pick(SKINS, r), hair: pick(HAIRS, r), shirt: pick(SHIRTS, r), bottom: pick(BOTTOMS, r), hatC: pick(HATS, r),
      hairStyle: Math.floor(r() * 3), hat: r() < 0.28, glasses: r() < 0.2, kid: r() < 0.15, legs: r() < 0.3, signType: i % 2,
    };
    const poses: ('a' | 'b' | 'c' | 'sign')[] = ['a', 'b', 'c', i % 4 === 0 ? 'sign' : 'b'];
    const grids = poses.map((p) => drawFan(r, look, p));
    bakeSheet(scene, `fan${i}`, grids, fanMats(look), ['a', 'b', 'c', 'd']);
  }
  // siluetas de espaldas (primer plano)
  for (let v = 0; v < 6; v++) {
    const grids: PixGrid[] = [];
    for (const up of [false, true]) {
      const g = new PixGrid(40, 46);
      const cx = 20;
      g.ellipse(cx, 46, 15, 13, 0);
      g.circle(cx, 22, 8, 0);
      g.rect(cx - 4, 28, 9, 8, 0); // cuello
      if (v === 1) { g.circle(cx, 19, 8.5, 0, false, (x, y) => y <= 19); g.rect(cx - 3, 18, 15, 2, 0); } // gorra
      if (v === 2) { g.ellipse(cx, 27, 9.5, 9, 0); } // melena
      if (v === 3) { g.circle(cx, 13, 3.6, 0); } // moño
      if (v === 4) { for (const [tx, ty] of [[-6, 10], [-2, 9], [2, 9.5], [6, 11]]) g.tri(cx + tx - 2.5, 17, cx + tx + 2.5, 17, cx + tx * 1.2, ty, 0); } // pelo de punta
      if (v === 5) { g.rect(cx + 6, 19, 9, 6, 0); g.circle(cx + 15, 22, 2.6, 0); } // cámara de fotos
      if (up) {
        g.capsule(cx - 11, 38, cx - 14, 6, 2.6, 0);
        g.capsule(cx + 11, 38, cx + 14, 6, 2.6, 0);
        g.circle(cx - 14, 5, 3, 0); g.circle(cx + 14, 5, 3, 0);
      }
      // luz de contorno (contraluz del sol)
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) >= 0 && g.get(x, y - 1) < 0) g.px(x, y, 0x3c4c6c);
      grids.push(g);
    }
    bakeSheet(scene, `sil${v}`, grids, [mat(0x161c2a, 0x161c2a, 0x161c2a, 0x0c101a, { shade: false })], ['a', 'b'], false);
  }
  // perro
  {
    const g = new PixGrid(22, 16);
    g.ellipse(10, 10, 6, 3.4, 0);
    g.circle(16, 6, 3.4, 0);
    g.ellipse(14.5, 4.5, 1.2, 2.5, 1);
    g.ellipse(19, 7.5, 1.6, 1.2, 0);
    for (const x of [6, 8, 12, 14]) g.rect(x, 12, 1, 3, 0);
    g.capsule(4, 9, 1, 5, 0.9, 0);
    g.px(17, 5, 0x1a1420); g.px(20, 7, 0x1a1420);
    bakeSheet(scene, 'dogpx', [g], [mat(0xd9a35b), mat(0x9a6a2e)], ['a']);
  }
  // gaviota (2 frames)
  {
    const gs: PixGrid[] = [];
    for (const f of [0, 1]) {
      const g = new PixGrid(15, 8);
      if (f === 0) { g.capsule(1, 2, 6, 4, 0.6, 0); g.capsule(13, 2, 8, 4, 0.6, 0); }
      else { g.capsule(1, 6, 6, 4, 0.6, 0); g.capsule(13, 6, 8, 4, 0.6, 0); }
      g.capsule(6, 4, 8, 4, 1, 0);
      gs.push(g);
    }
    bakeSheet(scene, 'gullpx', gs, [mat(0xffffff, 0xffffff, 0xd8e0ea, 0x6a7a90, { shade: false })], ['a', 'b']);
  }
}
