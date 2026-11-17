import Phaser from 'phaser';

/**
 * Mini-motor de pixel art procedural (estilo 16 bits):
 *  - se "pintan" primitivas (círculos, cápsulas, triángulos) sobre una rejilla de materiales,
 *  - cada material tiene 3 tonos (luz / base / sombra) => sombreado por bandas,
 *  - contorno selectivo de 1 px (versión oscura del material vecino),
 *  - detalles (ojos, boca...) píxel a píxel.
 * Así obtenemos sprites nítidos con todas sus animaciones sin depender de assets externos.
 */

export type RGB = number; // 0xRRGGBB

export interface Material {
  light: RGB;
  base: RGB;
  dark: RGB;
  outline: RGB;
  shade?: boolean; // aplicar sombreado
  highlight?: boolean; // aplicar luz arriba-izquierda
}

export function mat(base: RGB, light?: RGB, dark?: RGB, outline?: RGB, opts: Partial<Material> = {}): Material {
  return {
    base,
    light: light ?? tint(base, 1.25),
    dark: dark ?? tint(base, 0.7),
    outline: outline ?? tint(base, 0.32),
    shade: true,
    ...opts,
  };
}

export function tint(c: RGB, f: number): RGB {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export class PixGrid {
  m: Int16Array; // índice de material (-1 vacío)
  back: Uint8Array; // 1 = pintado como "plano trasero" (más oscuro)
  over: Int32Array; // color directo (detalles), -1 = ninguno
  constructor(public w: number, public h: number) {
    this.m = new Int16Array(w * h).fill(-1);
    this.back = new Uint8Array(w * h);
    this.over = new Int32Array(w * h).fill(-1);
  }
  set(x: number, y: number, mi: number, back = false) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.m[i] = mi;
    this.back[i] = back ? 1 : 0;
    this.over[i] = -1;
  }
  px(x: number, y: number, color: RGB) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.over[y * this.w + x] = color;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.m[y * this.w + x];
  }
  circle(cx: number, cy: number, r: number, mi: number, back = false, clip?: (x: number, y: number) => boolean) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r + r * 0.35 && (!clip || clip(x, y))) this.set(x, y, mi, back);
      }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, mi: number, back = false) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.08) this.set(x, y, mi, back);
      }
  }
  capsule(x1: number, y1: number, x2: number, y2: number, r: number, mi: number, back = false) {
    const minX = Math.floor(Math.min(x1, x2) - r - 1), maxX = Math.ceil(Math.max(x1, x2) + r + 1);
    const minY = Math.floor(Math.min(y1, y2) - r - 1), maxY = Math.ceil(Math.max(y1, y2) + r + 1);
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2));
        const ex = x - (x1 + t * dx), ey = y - (y1 + t * dy);
        if (ex * ex + ey * ey <= r * r + 0.3) this.set(x, y, mi, back);
      }
  }
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, mi: number, back = false) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
        const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) this.set(x, y, mi, back);
      }
  }
  rect(x: number, y: number, w: number, h: number, mi: number, back = false) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, mi, back);
  }

  /** Rasteriza a RGBA con sombreado por bandas y contorno selectivo. */
  render(mats: Material[], out: Uint8ClampedArray, stride: number, ox: number, oy: number, outline = true) {
    const { w, h } = this;
    const put = (x: number, y: number, c: RGB, a = 255) => {
      const i = ((oy + y) * stride + (ox + x)) * 4;
      out[i] = (c >> 16) & 255; out[i + 1] = (c >> 8) & 255; out[i + 2] = c & 255; out[i + 3] = a;
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const mi = this.m[i];
        if (mi < 0) {
          if (!outline) continue;
          // contorno: vecino 4-conectado opaco
          let nb = -1;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const v = this.get(x + dx, y + dy);
            if (v >= 0) { nb = v; break; }
          }
          if (nb >= 0) put(x, y, mats[nb].outline);
          continue;
        }
        if (this.over[i] >= 0) { put(x, y, this.over[i]); continue; }
        const M = mats[mi];
        let c = M.base;
        if (M.shade) {
          const r = this.get(x + 1, y), d = this.get(x, y + 1);
          const l = this.get(x - 1, y), u = this.get(x, y - 1);
          if (r !== mi || d !== mi) c = M.dark;
          else if (M.highlight && (l !== mi || u !== mi)) c = M.light;
        }
        if (this.back[i]) c = c === M.dark ? tint(M.dark, 0.82) : M.dark; // miembros del fondo, más oscuros
        put(x, y, c);
      }
  }
}

/** Crea una textura (hoja de frames horizontal) a partir de N rejillas. */
export function bakeSheet(scene: Phaser.Scene, key: string, grids: PixGrid[], mats: Material[] | Material[][], frameNames: string[], outline = true) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const fw = grids[0].w, fh = grids[0].h;
  const tex = scene.textures.createCanvas(key, fw * grids.length, fh)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(fw * grids.length, fh);
  grids.forEach((g, i) => g.render(Array.isArray(mats[0]) ? (mats as Material[][])[i] : (mats as Material[]), img.data, fw * grids.length, i * fw, 0, outline));
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  grids.forEach((_, i) => tex.add(frameNames[i], 0, i * fw, 0, fw, fh));
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
