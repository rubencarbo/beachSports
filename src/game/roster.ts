import Phaser from 'phaser';
import type { Theme } from '../entities/Ball';
import { RigData, registerRigFrames } from '../entities/Rig';
import rigSunJson from '../assets/rig_sun.json';
import rigWaveJson from '../assets/rig_wave.json';

/**
 * Catálogo de jugadoras. Dos hojas base (Sol, Ola) + variantes de color generadas en el
 * navegador + personajes importados por el usuario (guardados en el dispositivo).
 */

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
}

export const STYLES: Record<string, { label: string; stats: CharStats }> = {
  equilibrada: { label: 'EQUILIBRADA', stats: { speed: 3, power: 3, control: 4 } },
  rapida: { label: 'RÁPIDA', stats: { speed: 5, power: 2, control: 3 } },
  potente: { label: 'POTENTE', stats: { speed: 2, power: 5, control: 3 } },
  tecnica: { label: 'TÉCNICA', stats: { speed: 3, power: 2, control: 5 } },
};

interface Variant { id: string; name: string; base: 'sun' | 'wave'; hue: number | null; element: Theme; stats: CharStats; color: number }

const VARIANTS: Variant[] = [
  { id: 'sol', name: 'SOL', base: 'sun', hue: null, element: 'sun', stats: { speed: 3, power: 4, control: 3 }, color: 0xff8a1f },
  { id: 'ola', name: 'OLA', base: 'wave', hue: null, element: 'wave', stats: { speed: 4, power: 3, control: 3 }, color: 0x1fb5c9 },
  { id: 'coral', name: 'CORAL', base: 'sun', hue: 335, element: 'sun', stats: { speed: 3, power: 3, control: 4 }, color: 0xff5a8a },
  { id: 'lima', name: 'LIMA', base: 'sun', hue: 95, element: 'wave', stats: { speed: 5, power: 2, control: 3 }, color: 0x8ad13a },
  { id: 'uva', name: 'UVA', base: 'sun', hue: 275, element: 'sun', stats: { speed: 2, power: 5, control: 3 }, color: 0x9a5ad6 },
  { id: 'fresa', name: 'FRESA', base: 'wave', hue: 355, element: 'sun', stats: { speed: 3, power: 4, control: 3 }, color: 0xe8433a },
  { id: 'menta', name: 'MENTA', base: 'wave', hue: 150, element: 'wave', stats: { speed: 4, power: 2, control: 4 }, color: 0x3ad6a0 },
  { id: 'noche', name: 'NOCHE', base: 'wave', hue: 228, element: 'wave', stats: { speed: 3, power: 3, control: 4 }, color: 0x3a5ad6 },
];

const roster: CharDef[] = [];

export function getRoster() { return roster; }
export function getChar(id: string | undefined): CharDef { return roster.find((c) => c.id === id) ?? roster[0]; }
export function randomChar(except: string[] = []): CharDef {
  const pool = roster.filter((c) => !except.includes(c.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? roster[0];
}

// ---------------------------------------------------------------------------------- recoloreado
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Cambia el color de ropa/pelo/pala (no la piel) de una hoja de piezas, pieza a pieza. */
function recolor(scene: Phaser.Scene, srcKey: string, dstKey: string, data: RigData, base: 'sun' | 'wave', hue: number) {
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas(dstKey, src.width, src.height)!;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  // paleta de piel: todos los colores que aparecen en las piezas que son sólo piel (brazo y antebrazo).
  // En pixel art la paleta es limitada, así que excluir esos colores protege la piel en todas las piezas.
  const q = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const skin = new Set<number>();
  for (const name of ['upperarm', 'forearm']) {
    const f = data.frames[name];
    if (!f) continue;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      const i = (y * src.width + x) * 4;
      if (d[i + 3]) skin.add(q(d[i], d[i + 1], d[i + 2]));
    }
  }
  for (const [name, f] of Object.entries(data.frames)) {
    const skinOnly = ['upperarm', 'forearm', 'thigh'].includes(name);
    if (skinOnly) continue;
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        if (name === 'lowerleg' && y < f.y + f.h * 0.62) continue; // sólo la zapatilla
        const i = (y * src.width + x) * 4;
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
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  registerRigFrames(scene, dstKey, data);
}

// ---------------------------------------------------------------------------------- personalizados
export interface CustomChar { id: string; name: string; element: Theme; style: string; png: string; frames: RigData['frames'] }
const KEY = 'beachsports.chars.v1';

export function loadCustom(): CustomChar[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveCustom(list: CustomChar[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/** Registra un personaje importado (añade su textura y lo pone en el catálogo). */
export function registerCustom(scene: Phaser.Scene, c: CustomChar): Promise<void> {
  return new Promise((resolve) => {
    const key = `rig_custom_${c.id}`;
    const done = () => {
      const data: RigData = { pixel: 1, frames: c.frames };
      registerRigFrames(scene, key, data);
      const st = STYLES[c.style] ?? STYLES.equilibrada;
      const idx = roster.findIndex((r) => r.id === c.id);
      const def: CharDef = { id: c.id, name: c.name.toUpperCase().slice(0, 10), tex: key, data, element: c.element, stats: st.stats, color: c.element === 'sun' ? 0xff8a1f : 0x1fb5c9, builtin: false };
      if (idx >= 0) roster[idx] = def; else roster.push(def);
      resolve();
    };
    if (scene.textures.exists(key)) { done(); return; }
    const img = new Image();
    img.onload = () => { scene.textures.addImage(key, img); done(); };
    img.onerror = () => resolve();
    img.src = c.png;
  });
}

export function removeCustom(scene: Phaser.Scene, id: string) {
  saveCustom(loadCustom().filter((c) => c.id !== id));
  const i = roster.findIndex((r) => r.id === id);
  if (i >= 0) roster.splice(i, 1);
  const key = `rig_custom_${id}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

/** Construye el catálogo (llamar en el arranque, con las hojas base ya cargadas). */
export async function buildRoster(scene: Phaser.Scene) {
  roster.length = 0;
  const data = { sun: rigSunJson as unknown as RigData, wave: rigWaveJson as unknown as RigData };
  for (const v of VARIANTS) {
    const srcKey = `rig_${v.base}`;
    const key = v.hue === null ? srcKey : `rig_${v.id}`;
    if (v.hue !== null && !scene.textures.exists(key)) recolor(scene, srcKey, key, data[v.base], v.base, v.hue);
    roster.push({ id: v.id, name: v.name, tex: key, data: data[v.base], element: v.element, stats: v.stats, color: v.color, builtin: true });
  }
  for (const c of loadCustom()) await registerCustom(scene, c);
}
