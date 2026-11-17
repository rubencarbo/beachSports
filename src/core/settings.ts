// Ajustes del jugador (controles táctiles). Se guardan en el dispositivo (localStorage);
// si el almacenamiento no está disponible, el juego usa los valores por defecto.

export type CtrlId = 'stick' | 'hit' | 'jump' | 'special';

export interface Settings {
  stickScale: number; // 0.6 .. 1.8
  btnScale: number; // 0.6 .. 1.8
  opacity: number; // 0.15 .. 1
  stickMode: 'floating' | 'fixed';
  leftHanded: boolean;
  /** posición del centro de cada control como fracción de la pantalla (0..1) */
  pos: Record<CtrlId, { x: number; y: number }>;
}

export const DEFAULT_POS: Settings['pos'] = {
  stick: { x: 0.1, y: 0.8 },
  hit: { x: 0.92, y: 0.82 },
  jump: { x: 0.83, y: 0.9 },
  special: { x: 0.845, y: 0.7 },
};

export const DEFAULT_SETTINGS: Settings = {
  stickScale: 1, btnScale: 1, opacity: 0.75, stickMode: 'floating', leftHanded: false,
  pos: JSON.parse(JSON.stringify(DEFAULT_POS)),
};

const KEY = 'beachsports.settings.v1';
let current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...s, pos: { ...JSON.parse(JSON.stringify(DEFAULT_POS)), ...(s.pos || {}) } };
    }
  } catch { /* sin almacenamiento: valores por defecto */ }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export function getSettings(): Settings { return current; }

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignorar */ }
  listeners.forEach((l) => l(current));
}

export function resetSettings() { updateSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS))); }

export function onSettings(fn: (s: Settings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Posición efectiva (aplica el modo zurdo: controles en espejo). */
export function ctrlPos(id: CtrlId, w: number, h: number) {
  const p = current.pos[id];
  const x = current.leftHanded ? 1 - p.x : p.x;
  return { x: x * w, y: p.y * h };
}
