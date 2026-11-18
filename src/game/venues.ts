/**
 * Sedes (escenarios). Mismo decorado base con cambios de arena, luz, publicidad, cordón,
 * banderines y farolas. En el torneo cada ronda se juega en una sede distinta.
 * Las marcas de las vallas son inventadas.
 */
export interface Venue {
  id: string;
  name: string;
  short: string;
  sand: { base: string; light: string; dark: string };
  /** etalonaje: tinte multiplicador, intensidad de atardecer (0..1), brillo del sol */
  grade: { tint: [number, number, number]; sunset: number; glow: number };
  rope: number;
  bunting: number[];
  ads: string[]; // claves de anuncios (texturas ad_*)
  lamps: boolean; // farolas encendidas
  crowd: number; // multiplicador de público
}

export const VENUES: Venue[] = [
  {
    id: 'mediodia', name: 'PLAYA DEL SOL', short: 'MEDIODÍA',
    sand: { base: '#f7cf7c', light: 'rgba(255,244,205,.45)', dark: 'rgba(190,135,55,.2)' },
    grade: { tint: [1.045, 1.0, 0.93], sunset: 0, glow: 0.32 },
    rope: 0xe8433a, bunting: [0xff5a5a, 0xffd23f, 0x3ab0ff, 0x7bd389, 0xff9f1c, 0xc77dff],
    ads: ['solaria', 'cocobeach', 'palaspro', 'heladito'], lamps: false, crowd: 1,
  },
  {
    id: 'bahia', name: 'BAHÍA BLANCA', short: 'BAHÍA',
    sand: { base: '#fbecc9', light: 'rgba(255,255,245,.55)', dark: 'rgba(205,170,110,.18)' },
    grade: { tint: [0.99, 1.01, 1.04], sunset: 0, glow: 0.24 },
    rope: 0x1fb5c9, bunting: [0x1fb5c9, 0xffffff, 0x3a7fd6, 0xffffff],
    ads: ['olafresca', 'marazul', 'olafresca', 'surfclub'], lamps: false, crowd: 1.1,
  },
  {
    id: 'atardecer', name: 'GRAN FINAL', short: 'ATARDECER',
    sand: { base: '#e4ae66', light: 'rgba(255,214,160,.4)', dark: 'rgba(150,90,40,.25)' },
    grade: { tint: [1.12, 0.9, 0.8], sunset: 1, glow: 0.45 },
    rope: 0xffd23f, bunting: [0xffd23f, 0xff8a1f, 0xe8433a, 0xffd23f],
    ads: ['finalcup', 'solaria', 'finalcup', 'cocobeach'], lamps: true, crowd: 1.25,
  },
];

export function getVenue(id: string | undefined) { return VENUES.find((v) => v.id === id) ?? VENUES[0]; }

/** Anuncios (marcas ficticias): fondo, color de texto, texto y un icono simple. */
export const ADS: Record<string, { bg: [string, string]; fg: string; text: string; icon: 'sun' | 'wave' | 'paddle' | 'cup' | 'coco' | 'ice' | 'board' }> = {
  solaria: { bg: ['#ffb020', '#ff6a00'], fg: '#ffffff', text: 'SOLARIA', icon: 'sun' },
  cocobeach: { bg: ['#7a4a22', '#4e2d12'], fg: '#ffe9c2', text: 'COCO BEACH', icon: 'coco' },
  palaspro: { bg: ['#1b2240', '#2c3560'], fg: '#ffd23f', text: 'PALAS PRO', icon: 'paddle' },
  heladito: { bg: ['#ff8ab8', '#ff5a8a'], fg: '#ffffff', text: 'HELADITO', icon: 'ice' },
  olafresca: { bg: ['#1fb5c9', '#0e7f8f'], fg: '#ffffff', text: 'OLA FRESCA', icon: 'wave' },
  marazul: { bg: ['#3a7fd6', '#1b4fa0'], fg: '#ffffff', text: 'MAR AZUL', icon: 'wave' },
  surfclub: { bg: ['#ffffff', '#e8f4fb'], fg: '#1b4fa0', text: 'SURF CLUB', icon: 'board' },
  finalcup: { bg: ['#1b2240', '#3a1b40'], fg: '#ffd23f', text: 'FINAL CUP', icon: 'cup' },
};
