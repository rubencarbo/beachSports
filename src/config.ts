// Constantes globales del mundo y de la proyección pseudo-3D.
// Unidades del mundo en METROS: x = largo de pista (red en x=0), z = profundidad (0 = lado cercano), y = altura.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const STAGE_W = 2800;
export const STAGE_CX = STAGE_W / 2;

export const PPM = 58; // píxeles por metro a z=0
/** Píxeles de mundo por cada píxel de arte de los sprites (a z=0). */
export const ART_SCALE = 2.6;
/** Tamaño del píxel retro en pantalla (px de canvas) para el shader. */
export const RETRO_ROWS = 250;
export const GROUND_NEAR_Y = 640; // y en pantalla de la línea cercana (z=0)
export const DEPTH_PX_PER_M = 22; // cuánto "sube" el suelo por metro de profundidad
export const PERSPECTIVE = 0.03; // reducción de escala por metro de profundidad
export const HORIZON_Y = 262;

export const COURT = {
  halfLen: 8, // pista 16 x 8 (beach tennis / palas)
  width: 8,
  netH: 1.7,
  fenceX: 10.6,
  fenceZ: 9.6,
};

export const PHYS = {
  gravity: 11.5,
  playerSpeed: 6.4,
  jumpV: 5.6,
  reach: 1.35,
  reachUp: 2.45,
};

export const COLORS = {
  orange: 0xff8a1f,
  orangeDark: 0xc4520c,
  teal: 0x25c4c4,
  tealDark: 0x0e7f86,
  line: 0x2f6fd6,
  outline: 0x2a1a12,
};

export function kz(z: number): number {
  return 1 - z * PERSPECTIVE;
}

/** Punto de fuga horizontal: sigue a la cámara => la perspectiva cambia al panear (efecto 3D real). */
export const view = { vpx: STAGE_CX };

export function project(x: number, y: number, z: number) {
  const k = kz(z);
  const wx = STAGE_CX + x * PPM;
  return {
    x: view.vpx + (wx - view.vpx) * k,
    y: GROUND_NEAR_Y - z * DEPTH_PX_PER_M - y * PPM * k,
    k,
  };
}

/** Profundidad de render: lo más cercano (z pequeño) va delante. */
export function depthFor(z: number): number {
  return 100 + (12 - z) * 10;
}
