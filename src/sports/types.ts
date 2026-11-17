// Interfaz común para los distintos deportes que compartirán el mismo escenario.
// Palas de playa (1vs1) es el primero; vóley playa y futvóley reutilizarán
// escenario, cámara, público, efectos y backend cambiando sólo reglas + controles.

export type Side = -1 | 1; // -1 = izquierda, 1 = derecha

export interface PointResult {
  winner: Side;
  reason: 'in' | 'out' | 'net' | 'own-side' | 'unstoppable';
}

export interface SportRules {
  id: string;
  name: string;
  available: boolean;
  /** ¿Se permite que la bola bote antes de devolverla? */
  bouncesAllowed: number;
  /** Toques por equipo antes de pasar (vóley = 3, palas = 1) */
  touchesPerSide: number;
  pointsToWin: number;
  winBy: number;
  isMatchOver(a: number, b: number): Side | 0;
}

export function rallyScoring(pointsToWin: number, winBy: number) {
  return (a: number, b: number): Side | 0 => {
    if (a >= pointsToWin && a - b >= winBy) return -1;
    if (b >= pointsToWin && b - a >= winBy) return 1;
    return 0;
  };
}
