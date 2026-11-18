import Phaser from 'phaser';
import { RigData, registerRigFrames } from '../entities/Rig';
import rigSunJson from '../assets/rig_sun.json';
import rigWaveJson from '../assets/rig_wave.json';
import rigBoyJson from '../assets/rig_boy.json';
import { CharDef, STYLES, VARIANTS, recolorPixels } from './charData';
import type { Theme } from '../entities/ballPhysics';
export * from './charData';

/**
 * Catálogo de jugadoras y jugadores. Tres hojas base (Sol, Ola, Toni) + variantes de color generadas en el
 * navegador + personajes importados por el usuario (guardados en el dispositivo).
 */

const roster: CharDef[] = [];

export function getRoster() { return roster; }
export function getChar(id: string | undefined): CharDef { return roster.find((c) => c.id === id) ?? roster[0]; }
export function randomChar(except: string[] = []): CharDef {
  const pool = roster.filter((c) => !except.includes(c.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? roster[0];
}

function recolor(scene: Phaser.Scene, srcKey: string, dstKey: string, data: RigData, base: 'sun' | 'wave' | 'boy', hue: number) {
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas(dstKey, src.width, src.height)!;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  recolorPixels(d, src.width, data, base, hue);
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  registerRigFrames(scene, dstKey, data);
}

// ---------------------------------------------------------------------------------- personalizados
export interface CustomChar { id: string; name: string; element: Theme; style: string; png: string; frames: RigData['frames']; gender?: 'f' | 'm' }
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
      const def: CharDef = { id: c.id, name: c.name.toUpperCase().slice(0, 10), tex: key, data, element: c.element, stats: st.stats, color: c.element === 'sun' ? 0xff8a1f : 0x1fb5c9, builtin: false, gender: c.gender ?? 'f' };
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
  const data = { sun: rigSunJson as unknown as RigData, wave: rigWaveJson as unknown as RigData, boy: rigBoyJson as unknown as RigData };
  for (const v of VARIANTS) {
    const srcKey = `rig_${v.base}`;
    const key = v.hue === null ? srcKey : `rig_${v.id}`;
    if (v.hue !== null && !scene.textures.exists(key)) recolor(scene, srcKey, key, data[v.base], v.base, v.hue);
    roster.push({ id: v.id, name: v.name, tex: key, data: data[v.base], element: v.element, stats: v.stats, color: v.color, builtin: true, gender: v.base === 'boy' ? 'm' : 'f' });
  }
  for (const c of loadCustom()) await registerCustom(scene, c);
}
