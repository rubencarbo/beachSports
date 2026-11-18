// Canvas, texto en mapa de bits con caché, decodificación de recursos y personajes preparados para dibujar rápido.
import ASSETS from '../assets/assets.json';
import { b64, inflate } from './inflate';
import type { RigData, RigFrame } from '../../src/entities/poses';
import { partOrder, partOrigin } from '../../src/entities/poses';
import { VARIANTS, recolorPixels, roster, CharDef } from '../../src/game/charData';
import { RIG_SCALE } from '../../src/config';

export const W = 320, H = 180;
/** px de consola por px de mundo con zoom 1 (la web usa 1280x720). */
export const Q0 = 0.25;

export type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type Img = OffscreenCanvas | HTMLCanvasElement;

export const CONSOLE = typeof sdl !== 'undefined';
export function mkCanvas(w: number, h: number): Img {
  // en la consola no hay DOM: todos los lienzos auxiliares son OffscreenCanvas (también existe en Chromium)
  return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
}
export function ctx2d(c: Img): Ctx {
  const x = c.getContext('2d') as Ctx;
  x.imageSmoothingEnabled = false;
  return x;
}

// ---------------------------------------------------------------- recursos incrustados
type Asset = { w: number; h: number; d: string; ox?: number; oy?: number; s?: number; json?: any };
const A = ASSETS as unknown as Record<string, Asset>;
const decoded = new Map<string, { img: Img; ox: number; oy: number; s: number; w: number; h: number }>();
export function rgbaOf(key: string): Uint8Array { const e = A[key]; return inflate(b64(e.d), e.w * e.h * 4); }
export function imageFromRGBA(px: Uint8Array | Uint8ClampedArray, w: number, h: number): Img {
  const c = mkCanvas(w, h), x = ctx2d(c);
  const id = x.createImageData(w, h);
  id.data.set(px);
  x.putImageData(id, 0, 0);
  return c;
}
/** Imagen de un recurso (se decodifica la primera vez que se pide). */
export function asset(key: string) {
  let d = decoded.get(key);
  if (!d) {
    const e = A[key];
    d = { img: imageFromRGBA(rgbaOf(key), e.w, e.h), ox: e.ox ?? 0, oy: e.oy ?? 0, s: e.s ?? 1, w: e.w, h: e.h };
    decoded.set(key, d);
  }
  return d;
}
export function atlasJson(key: string): any { return A['atlas_' + key].json; }

// ---------------------------------------------------------------- fuente 3x5 (avance 4 px)
const GL: Record<string, string> = {
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447',
  M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
  Y: '55222', Z: '71247', ' ': '00000', '.': '00002', ':': '02020', '-': '00700', '!': '22202', '¡': '20222', '/': '11244', '?': '71202',
  ',': '00024', '%': '51245', '>': '42124', '<': '12421', '+': '02720', '(': '24442', ')': '42224', "'": '22000', '"': '55000', '=': '07070',
  '*': '05250', '_': '00007', '#': '57575', '¿': '20247', '·': '00200', '&': '25253', 'º': '25200', '|': '22222',
  '0': '75557', '1': '26227', '2': '61247', '3': '61216', '4': '55711', '5': '74616', '6': '34652', '7': '71222', '8': '25252', '9': '25316',
};
const ACC: Record<string, string> = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N', 'À': 'A', 'È': 'E', 'Ò': 'O', 'Ç': 'C' };
export function norm(s: string) {
  s = String(s).toUpperCase();
  let o = '';
  for (const ch of s) o += ACC[ch] ?? (GL[ch] ? ch : ' ');
  return o;
}
export const textW = (s: string, sc = 1) => Math.max(0, norm(s).length * 4 - 1) * sc;

const TXC = new Map<string, Img>();
function textImg(s: string, sc: number, col: string, sh: string | null): Img {
  const k = s + '|' + sc + col + (sh || '');
  let im = TXC.get(k);
  if (im) return im;
  if (TXC.size > 400) TXC.clear();
  const w = textW(s, sc) + (sh ? sc : 0), h = 5 * sc + (sh ? sc : 0);
  im = mkCanvas(w + 1, h + 1);
  const x = ctx2d(im);
  const draw = (ox: number, oy: number, c: string) => {
    x.fillStyle = c;
    let cx = ox;
    for (const ch of s) {
      const g = GL[ch];
      if (g) for (let r = 0; r < 5; r++) { const v = +g[r]; for (let b = 0; b < 3; b++) if (v & (4 >> b)) x.fillRect(cx + b * sc, oy + r * sc, sc, sc); }
      cx += 4 * sc;
    }
  };
  if (sh) draw(sc, sc, sh);
  draw(0, 0, col);
  TXC.set(k, im);
  return im;
}
/** Texto: una imagen cacheada por cadena (una sola llamada nativa por texto). align: 'l' | 'c' | 'r'. */
export function text(c: Ctx, s: string, x: number, y: number, sc = 1, col = '#fff3d6', sh: string | null = '#1b2240', align: 'l' | 'c' | 'r' = 'l') {
  const n = norm(s);
  if (!n.trim()) return 0;
  const w = textW(n, sc);
  if (align === 'c') x -= w / 2; else if (align === 'r') x -= w;
  c.drawImage(textImg(n, sc, col, sh) as any, Math.round(x), Math.round(y));
  return w;
}

// ---------------------------------------------------------------- personajes
/** Escala (px de consola por px de arte) a la que se preparan las piezas: la del zoom base a z=0. */
export const PART_SCALE = RIG_SCALE * Q0 * 1.4;
export interface CharGfx {
  F: Record<string, RigFrame>;
  parts: Record<string, { img: Img; back?: Img; w: number; h: number }>; // piezas reescaladas (back = tono de espalda)
  heads: Record<string, Img>; // retratos grandes para menús
  hk: number; lk: number;
}
const gfxByTex = new Map<string, CharGfx>();
export function charGfx(c: CharDef) { return gfxByTex.get(c.tex)!; }

function scalePart(src: Img, f: RigFrame, s: number, tint?: [number, number, number]): Img {
  const w = Math.max(1, Math.round(f.w * s)), h = Math.max(1, Math.round(f.h * s));
  const c = mkCanvas(w, h), x = ctx2d(c);
  x.imageSmoothingEnabled = true;
  (x as any).imageSmoothingQuality = 'high';
  x.drawImage(src as any, f.x, f.y, f.w, f.h, 0, 0, w, h);
  if (tint) {
    const id = x.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = d[i] * tint[0]; d[i + 1] = d[i + 1] * tint[1]; d[i + 2] = d[i + 2] * tint[2]; }
    x.putImageData(id, 0, 0);
  }
  return c;
}

function prepChar(tex: string, px: Uint8Array, w: number, h: number, data: RigData) {
  const src = imageFromRGBA(px, w, h);
  const F = data.frames;
  const parts: CharGfx['parts'] = {};
  const backT: [number, number, number] = [0xb8 / 255, 0xb2 / 255, 0xc8 / 255];
  for (const name of Object.keys(F)) {
    if (name === 'full') continue;
    const f = F[name];
    parts[name] = { img: scalePart(src, f, PART_SCALE), w: f.w, h: f.h };
    if (['upperarm', 'forearm', 'thigh', 'lowerleg'].includes(name)) parts[name].back = scalePart(src, f, PART_SCALE, backT);
  }
  const heads: Record<string, Img> = {};
  for (const hn of ['head', 'head_happy', 'head_sad', 'head_angry']) if (F[hn]) heads[hn] = scalePart(src, F[hn], 0.85);
  gfxByTex.set(tex, { F, parts, heads, hk: data.scale?.head ?? 1, lk: data.scale?.leg ?? 1 });
}

/** Crea el registro de personajes (mismos 10 que la web) con sus variantes de color. */
export function buildRoster() {
  roster.length = 0;
  const base: Record<string, { px: Uint8Array; w: number; h: number; data: RigData }> = {};
  for (const b of ['sun', 'wave', 'boy']) {
    const key = 'atlas_rig_' + b, e = A[key];
    base[b] = { px: rgbaOf(key), w: e.w, h: e.h, data: e.json };
  }
  for (const v of VARIANTS) {
    const B = base[v.base];
    const tex = v.hue == null ? `rig_${v.base}` : `rig_${v.id}`;
    if (!gfxByTex.has(tex)) {
      let px = B.px;
      if (v.hue != null) { px = B.px.slice(); recolorPixels(px, B.w, B.data, v.base, v.hue); }
      prepChar(tex, px, B.w, B.h, B.data);
    }
    roster.push({ id: v.id, name: v.name, tex, data: B.data, element: v.element, stats: v.stats, color: v.color, builtin: true, gender: v.base === 'boy' ? 'm' : 'f' });
  }
}

/** Atlas del público (fotogramas f0a..f7b, dog_a/b) reescalado a la escala de la grada. */
export interface CrowdGfx { frames: Record<string, { img: Img; flip: Img; w: number; h: number; bx: number; by: number }> }
let crowdG: CrowdGfx | null = null;
export const CROWD_SCALE = 2.45;
export function crowdGfx(): CrowdGfx {
  if (crowdG) return crowdG;
  const e = A.atlas_crowd, src = imageFromRGBA(rgbaOf('atlas_crowd'), e.w, e.h);
  const frames: CrowdGfx['frames'] = {};
  const s = CROWD_SCALE * Q0 * 1.4 * 0.75; // la grada está a z≈10: k≈0,7
  for (const [n, f] of Object.entries<any>(e.json.frames)) {
    const img = scalePart(src, f, s);
    const flip = mkCanvas((img as any).width, (img as any).height), fx = ctx2d(flip);
    fx.scale(-1, 1); fx.drawImage(img as any, -(img as any).width, 0);
    frames[n] = { img, flip, w: f.w, h: f.h, bx: f.w / 2, by: f.h };
  }
  return (crowdG = { frames });
}

export { partOrder, partOrigin };
