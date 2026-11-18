import type { Theme } from '../entities/ballPhysics';
import type { RigData } from '../entities/poses';

/** Datos de personajes sin Phaser (web y consola). */
export interface CharStats { speed: number; power: number; control: number } // 1..5
export interface CharDef {
  id: string;
  name: string;
  tex: string; // clave de textura (atlas de piezas)
  data: RigData;
  element: Theme; // estilo del especial: fuego (sun) o agua (wave)
  stats: CharStats;
  color: number; // color de la ficha
  builtin: boolean;
  gender: 'f' | 'm';
}

/** Textos según el género del personaje. */
export const g = (c: { gender: 'f' | 'm' }, f: string, m: string) => (c.gender === 'm' ? m : f);

export const STYLES: Record<string, { label: string; stats: CharStats }> = {
  equilibrada: { label: 'EQUILIBRADA', stats: { speed: 3, power: 3, control: 4 } },
  rapida: { label: 'RÁPIDA', stats: { speed: 5, power: 2, control: 3 } },
  potente: { label: 'POTENTE', stats: { speed: 2, power: 5, control: 3 } },
  tecnica: { label: 'TÉCNICA', stats: { speed: 3, power: 2, control: 5 } },
};

export interface Variant { id: string; name: string; base: 'sun' | 'wave' | 'boy'; hue: number | null; element: Theme; stats: CharStats; color: number }

export const VARIANTS: Variant[] = [
  { id: 'sol', name: 'SOL', base: 'sun', hue: null, element: 'sun', stats: { speed: 3, power: 4, control: 3 }, color: 0xff8a1f },
  { id: 'toni', name: 'TONI', base: 'boy', hue: null, element: 'wave', stats: { speed: 3, power: 4, control: 3 }, color: 0x1fb5c9 },
  { id: 'ola', name: 'OLA', base: 'wave', hue: null, element: 'wave', stats: { speed: 4, power: 3, control: 3 }, color: 0x1fb5c9 },
  { id: 'marco', name: 'MARCO', base: 'boy', hue: 2, element: 'sun', stats: { speed: 2, power: 5, control: 3 }, color: 0xe8433a },
  { id: 'coral', name: 'CORAL', base: 'sun', hue: 335, element: 'sun', stats: { speed: 3, power: 3, control: 4 }, color: 0xff5a8a },
  { id: 'leo', name: 'LEO', base: 'boy', hue: 42, element: 'sun', stats: { speed: 4, power: 3, control: 3 }, color: 0xffd23f },
  { id: 'lima', name: 'LIMA', base: 'sun', hue: 95, element: 'wave', stats: { speed: 5, power: 2, control: 3 }, color: 0x8ad13a },
  { id: 'bruno', name: 'BRUNO', base: 'boy', hue: 275, element: 'wave', stats: { speed: 3, power: 2, control: 5 }, color: 0x9a5ad6 },
  { id: 'uva', name: 'UVA', base: 'sun', hue: 275, element: 'sun', stats: { speed: 2, power: 5, control: 3 }, color: 0x9a5ad6 },
  { id: 'menta', name: 'MENTA', base: 'wave', hue: 150, element: 'wave', stats: { speed: 4, power: 2, control: 4 }, color: 0x3ad6a0 },
];

// ---------------------------------------------------------------------------------- recoloreado
export function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Cambia el color de ropa/pelo/pala (no la piel) de los píxeles RGBA de una hoja de piezas, pieza a pieza. */
export function recolorPixels(d: Uint8ClampedArray | Uint8Array, W: number, data: RigData, base: 'sun' | 'wave' | 'boy', hue: number) {
  // paleta de piel: todos los colores que aparecen en las piezas que son sólo piel (brazo y antebrazo).
  // En pixel art la paleta es limitada, así que excluir esos colores protege la piel en todas las piezas.
  const q = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const skin = new Set<number>();
  for (const name of ['upperarm', 'forearm']) {
    const f = data.frames[name];
    if (!f) continue;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const hh = rgb2hsl(d[i], d[i + 1], d[i + 2])[0];
      if (hh < 45 || hh > 340) skin.add(q(d[i], d[i + 1], d[i + 2])); // sólo tonos de piel (no mangas ni muñequeras)
    }
  }
  for (const [name, f] of Object.entries(data.frames)) {
    const skinOnly = ['upperarm', 'forearm', 'thigh'].includes(name);
    if (skinOnly) continue;
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        if (name === 'lowerleg' && y < f.y + f.h * 0.62) continue; // sólo la zapatilla
        const i = (y * W + x) * 4;
        if (d[i + 3] === 0) continue;
        if (skin.has(q(d[i], d[i + 1], d[i + 2]))) continue;
        const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
        let hit = false;
        if (base === 'sun') {
          // naranjas/amarillos muy saturados (ropa, pelo, visera, pala); la piel es menos saturada
          hit = s >= 0.7 && (h < 55 || h > 345) && l > 0.1 && l < 0.88;
          if (name.startsWith('head') && (h < 14 || h > 340) && l > 0.6) hit = false; // colorete de las mejillas
        } else {
          hit = s >= 0.28 && h >= 160 && h <= 205; // turquesa
        }
        if (!hit) continue;
        const [r, g, b] = hsl2rgb(hue, Math.min(1, s * 0.95), l);
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    }
  }
}
