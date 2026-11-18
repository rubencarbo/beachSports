// Ajustes del jugador (controles táctiles). Se guardan en el dispositivo (localStorage);
// si el almacenamiento no está disponible, el juego usa los valores por defecto.

export type CtrlId = 'stick' | 'hit' | 'jump' | 'special';

export interface Settings {
  stickScale: number; // 0.6 .. 2
  btnScale: number; // 0.6 .. 2
  opacity: number; // 0.15 .. 0.9
  leftHanded: boolean;
  /** asistido: corre sola a la bola · semi: te mueves tú y un imán te coloca cerca de la bola · manual: sin ayuda */
  movement: 'assist' | 'semi' | 'manual';
  autoSmash: boolean; // GOLPE con bola alta = salto + remate automático
  music: boolean;
  sound: boolean;
  /** posición del centro de cada control como fracción de la pantalla (0..1) */
  pos: Record<CtrlId, { x: number; y: number }>;
}

export const DEFAULT_POS: Settings['pos'] = {
  stick: { x: 0.11, y: 0.77 },
  hit: { x: 0.915, y: 0.79 },
  jump: { x: 0.8, y: 0.9 },
  special: { x: 0.83, y: 0.63 },
};

export const DEFAULT_SETTINGS: Settings = {
  stickScale: 1, btnScale: 1, opacity: 0.75, leftHanded: false, movement: 'assist', autoSmash: true, music: true, sound: true,
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
      const out: Settings = { ...DEFAULT_SETTINGS, ...s, pos: { ...JSON.parse(JSON.stringify(DEFAULT_POS)), ...(s.pos || {}) } };
      out.opacity = Math.min(0.9, Math.max(0.15, out.opacity));
      delete (out as any).stickMode;
      if (!s.movement) out.movement = s.assist === false ? 'manual' : 'assist'; // ajustes antiguos
      delete (out as any).assist;
      return out;
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

/** Sólo los controles (posición, tamaño, transparencia) vuelven a los valores por defecto. */
export function resetControls() {
  const d = DEFAULT_SETTINGS;
  updateSettings({ stickScale: d.stickScale, btnScale: d.btnScale, opacity: d.opacity, pos: JSON.parse(JSON.stringify(DEFAULT_POS)) });
}

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
