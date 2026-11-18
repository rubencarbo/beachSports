/**
 * Importador de hojas de personaje en el navegador (equivalente a art/tools/ingest_parts.py):
 *  1. detecta el tamaño real del píxel de arte y lo reduce a resolución nativa,
 *  2. quita el croma verde (y el verde residual del contorno),
 *  3. separa las piezas (componentes conexas) y propone qué es cada una,
 *  4. empaqueta un atlas con anclas para el esqueleto.
 */
import type { RigFrame } from '../entities/Rig';

export type Role = 'ignore' | 'full' | 'head' | 'head_angry' | 'head_happy' | 'head_sad' | 'torso' | 'arm' | 'upperarm' | 'forearm' | 'leg' | 'thigh' | 'lowerleg' | 'paddle' | 'paddlehand';
export const ROLE_LABELS: Record<Role, string> = {
  ignore: '— Ignorar —', full: 'Figura entera', head: 'Cabeza normal', head_angry: 'Cabeza esfuerzo', head_happy: 'Cabeza alegre', head_sad: 'Cabeza cansada',
  torso: 'Torso (con pantalón)', arm: 'Brazo entero', upperarm: 'Brazo (hombro-codo)', forearm: 'Antebrazo', leg: 'Pierna entera', thigh: 'Muslo', lowerleg: 'Pierna (rodilla-pie)',
  paddle: 'Pala', paddlehand: 'Mano con pala',
};

export interface Piece { id: number; x0: number; y0: number; x1: number; y1: number; n: number; canvas: HTMLCanvasElement; role: Role }

function period(g: Float64Array): [number, number] {
  let best = 0, bp = 6, ba = 0;
  let total = 0; for (const v of g) total += v;
  for (let p = 3; p < 12; p += 0.02) {
    let re = 0, im = 0;
    for (let i = 0; i < g.length; i++) { const a = (2 * Math.PI * (i % p)) / p; re += g[i] * Math.cos(a); im += g[i] * Math.sin(a); }
    const m = Math.hypot(re, im) / total;
    if (m > best) { best = m; bp = p; ba = Math.atan2(im, re); }
  }
  const off = (((ba / (2 * Math.PI)) * bp) % bp + bp) % bp;
  return [bp, off];
}

export async function loadImageData(file: File | Blob): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, c.width, c.height);
  } finally { URL.revokeObjectURL(url); }
}

/** Reduce a resolución nativa del pixel art. */
export function toNative(src: ImageData): { data: Uint8ClampedArray; w: number; h: number; pixel: number } {
  const { width: W, height: H, data: d } = src;
  const gx = new Float64Array(W - 1), gy = new Float64Array(H - 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) {
    const i = (y * W + x) * 4, j = i + 4;
    gx[x] += Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
  }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, j = i + W * 4;
    gy[y] += Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
  }
  const [px, ox] = period(gx), [py, oy] = period(gy);
  const p = (px + py) / 2;
  const w = Math.floor((W - ox) / p), h = Math.floor((H - oy) / p);
  const out = new Uint8ClampedArray(w * h * 4);
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const med = (a: number[]) => { a.sort((m, n) => m - n); return a[a.length >> 1]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    r.length = g.length = b.length = 0;
    const y0 = Math.floor(oy + y * p + p * 0.25), y1 = Math.max(y0 + 1, Math.floor(oy + (y + 1) * p - p * 0.25));
    const x0 = Math.floor(ox + x * p + p * 0.25), x1 = Math.max(x0 + 1, Math.floor(ox + (x + 1) * p - p * 0.25));
    for (let yy = y0; yy < Math.min(H, y1); yy++) for (let xx = x0; xx < Math.min(W, x1); xx++) {
      const i = (yy * W + xx) * 4; r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
    }
    const o = (y * w + x) * 4;
    out[o] = med(r); out[o + 1] = med(g); out[o + 2] = med(b); out[o + 3] = 255;
  }
  return { data: out, w, h, pixel: p };
}

/** Quita el croma y separa las piezas. Propone el papel de cada una. */
export function extractPieces(nat: { data: Uint8ClampedArray; w: number; h: number }): Piece[] {
  const { data: d, w, h } = nat;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    mask[i] = g > 100 && g > r + 28 && g > b + 28 ? 0 : 1;
  }
  // verde residual del contorno
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const edge = (x > 0 && !mask[i - 1]) || (x < w - 1 && !mask[i + 1]) || (y > 0 && !mask[i - w]) || (y < h - 1 && !mask[i + w]);
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (edge && g > Math.max(r, b) + 6) mask[i] = 0;
    else if (edge && g > Math.max(r, b)) d[i * 4 + 1] = Math.max(r, b);
  }
  // componentes conexas (8 vecinos)
  const lab = new Int32Array(w * h).fill(-1);
  const comps: { id: number; n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!mask[s0] || lab[s0] >= 0) continue;
    const id = comps.length;
    const st = [s0]; lab[s0] = id;
    const c = { id, n: 0, x0: w, y0: h, x1: 0, y1: 0 };
    while (st.length) {
      const i = st.pop()!; const x = i % w, y = (i / w) | 0;
      c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j] && lab[j] < 0) { lab[j] = id; st.push(j); }
      }
    }
    comps.push(c);
  }
  const big = comps.filter((c) => c.n > 25);
  const crop = (c: { id: number; x0: number; y0: number; x1: number; y1: number }, x0 = c.x0, x1 = c.x1) => {
    const cw = x1 - x0 + 1, ch = c.y1 - c.y0 + 1;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d')!; const im = ctx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (c.y0 + y) * w + (x0 + x), o = (y * cw + x) * 4;
      if (lab[i] !== c.id) continue;
      im.data[o] = d[i * 4]; im.data[o + 1] = d[i * 4 + 1]; im.data[o + 2] = d[i * 4 + 2]; im.data[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return cv;
  };
  const pieces: Piece[] = [];
  // cabezas que se tocan (tira ancha en la fila de arriba): se dividen a partes iguales
  for (const c of big) {
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    const isTop = (c.y0 + c.y1) / 2 < h * 0.35;
    const k = isTop && cw > ch * 1.5 ? Math.max(2, Math.round(cw / (ch * 0.9))) : 1;
    for (let j = 0; j < k; j++) {
      const x0 = c.x0 + Math.round((cw * j) / k), x1 = c.x0 + Math.round((cw * (j + 1)) / k) - 1;
      pieces.push({ id: pieces.length, x0, y0: c.y0, x1, y1: c.y1, n: c.n / k, canvas: crop(c, x0, x1), role: 'ignore' });
    }
  }
  guessRoles(pieces, w, h);
  return pieces;
}

function rowWidths(cv: HTMLCanvasElement) {
  const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
  const out: number[] = [];
  for (let y = 0; y < cv.height; y++) { let n = 0; for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) n++; out.push(n); }
  return out;
}
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

function guessRoles(ps: Piece[], _w: number, h: number) {
  if (!ps.length) return;
  const tall = ps.reduce((a, b) => (b.y1 - b.y0 > a.y1 - a.y0 ? b : a));
  tall.role = 'full';
  const heads = ps.filter((p) => p !== tall && (p.y0 + p.y1) / 2 < h * 0.35).sort((a, b) => a.x0 - b.x0);
  (['head', 'head_angry', 'head_happy', 'head_sad'] as Role[]).forEach((r, i) => { if (heads[i]) heads[i].role = r; });
  const rest = ps.filter((p) => p.role === 'ignore');
  for (const p of rest) {
    const rw = rowWidths(p.canvas);
    const n = rw.length;
    const top = avg(rw.slice(0, Math.floor(n * 0.5))), bot = avg(rw.slice(Math.floor(n * 0.6)));
    const mid = avg(rw.slice(Math.floor(n * 0.3), Math.floor(n * 0.7)));
    const pw = p.x1 - p.x0 + 1, ph = p.y1 - p.y0 + 1;
    if (top / Math.max(1, bot) > 2.2 && ph / pw > 1.1) p.role = 'paddle';
    else if (ph / pw > 1.3 && avg(rw.slice(Math.floor(n * 0.85))) / Math.max(1, mid) > 1.35) p.role = 'leg';
    else if (ph / pw > 1.8) p.role = 'arm';
  }
  const torsoC = rest.filter((p) => p.role === 'ignore').sort((a, b) => b.n - a.n)[0];
  if (torsoC) torsoC.role = 'torso';
  // de cada papel, sólo el primero (el resto se ignora)
  const seen = new Set<Role>();
  for (const p of ps.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) { if (p.role === 'ignore') continue; if (seen.has(p.role)) p.role = 'ignore'; else seen.add(p.role); }
  ps.sort((a, b) => a.id - b.id);
}

/** Comprueba que hay las piezas mínimas para animar. Devuelve qué falta. */
export function missingRoles(ps: Piece[]): string[] {
  const has = (r: Role) => ps.some((p) => p.role === r);
  const miss: string[] = [];
  if (!has('head')) miss.push('cabeza normal');
  if (!has('torso')) miss.push('torso');
  if (!has('arm') && !(has('upperarm') && has('forearm'))) miss.push('brazo');
  if (!has('leg') && !(has('thigh') && has('lowerleg'))) miss.push('pierna');
  if (!has('paddle') && !has('paddlehand')) miss.push('pala');
  return miss;
}

/** Empaqueta el atlas (PNG en data URL) y los frames con anclas para el esqueleto. */
export function buildAtlas(ps: Piece[]): { png: string; frames: Record<string, RigFrame> } {
  const items: { name: string; cv: HTMLCanvasElement }[] = [];
  const splitV = (cv: HTMLCanvasElement, at: number, ov: number): [HTMLCanvasElement, HTMLCanvasElement] => {
    const h = cv.height, cut = Math.floor(h * at), o = Math.max(1, Math.floor(h * ov));
    const mk = (y0: number, y1: number) => { const c = document.createElement('canvas'); c.width = cv.width; c.height = y1 - y0; c.getContext('2d')!.drawImage(cv, 0, -y0); return c; };
    return [mk(0, cut + o), mk(cut - o, h)];
  };
  for (const p of ps) {
    if (p.role === 'ignore') continue;
    if (p.role === 'arm') { const [a, b] = splitV(p.canvas, 0.5, 0.06); items.push({ name: 'upperarm', cv: a }, { name: 'forearm', cv: b }); }
    else if (p.role === 'leg') { const [a, b] = splitV(p.canvas, 0.5, 0.06); items.push({ name: 'thigh', cv: a }, { name: 'lowerleg', cv: b }); }
    else items.push({ name: p.role, cv: p.canvas });
  }
  if (!items.some((i) => i.name === 'full')) { const hd = items.find((i) => i.name === 'head'); if (hd) items.push({ name: 'full', cv: hd.cv }); }
  const pad = 2;
  const W = items.reduce((s, i) => s + i.cv.width + pad, pad), H = Math.max(...items.map((i) => i.cv.height)) + pad * 2;
  const atlas = document.createElement('canvas'); atlas.width = W; atlas.height = H;
  const ctx = atlas.getContext('2d')!;
  const frames: Record<string, RigFrame> = {};
  let x = pad;
  for (const it of items) {
    ctx.drawImage(it.cv, x, pad);
    const rw = (y: number) => {
      const d = it.cv.getContext('2d')!.getImageData(0, Math.min(it.cv.height - 1, Math.max(0, y)), it.cv.width, 1).data;
      let s = 0, n = 0; for (let i = 0; i < it.cv.width; i++) if (d[i * 4 + 3]) { s += i; n++; }
      return n ? s / n : it.cv.width / 2;
    };
    const hh = it.cv.height;
    frames[it.name] = { x, y: pad, w: it.cv.width, h: hh, top: [Math.round(rw(2) * 10) / 10, 2], bot: [Math.round(rw(hh - 3) * 10) / 10, hh - 3] };
    x += it.cv.width + pad;
  }
  return { png: atlas.toDataURL('image/png'), frames };
}
