import { COURT, PHYS } from '../config';
import type { Side } from '../sports/types';
import type { ShotKind } from './Ball';

const FLIGHT: Record<ShotKind, number> = {
  serve: 1.35, normal: 1.25, drive: 0.9, lob: 2.1, smash: 0.55, special: 0.46,
};
const DEPTH: Record<ShotKind, [number, number]> = {
  serve: [5, 7.2], normal: [4, 7.2], drive: [5.5, 7.6], lob: [6, 7.6], smash: [3, 6.5], special: [3.5, 7],
};

/**
 * Calcula la velocidad para que la bola aterrice en la mitad rival.
 * quality 0..1: con calidad baja el objetivo se desvía (posible fuera o red).
 */
export function computeShot(
  from: { x: number; y: number; z: number },
  side: Side,
  kind: ShotKind,
  aimZ: number,
  quality: number,
) {
  const [d0, d1] = DEPTH[kind];
  let tx = -side * (d0 + Math.random() * (d1 - d0));
  let tz = 0.7 + aimZ * (COURT.width - 1.4);
  const err = Math.pow(1 - quality, 1.6);
  tx += -side * (Math.random() * 2 - 0.6) * err * 3.2;
  tz += (Math.random() * 2 - 1) * err * 3.4;
  let T = FLIGHT[kind] * (0.95 + Math.random() * 0.1);
  const g = PHYS.gravity;
  const wantClear = quality < 0.25 && Math.random() < 0.55 ? COURT.netH - 0.25 : COURT.netH + 0.22;
  let vx = 0, vy = 0, vz = 0;
  for (let i = 0; i < 40; i++) {
    vx = (tx - from.x) / T;
    vz = (tz - from.z) / T;
    vy = (0 - from.y + 0.5 * g * T * T) / T;
    const tn = (0 - from.x) / vx;
    const yNet = from.y + vy * tn - 0.5 * g * tn * tn;
    if (yNet >= wantClear || tn <= 0) break;
    T += 0.05;
  }
  return { vx, vy, vz };
}
