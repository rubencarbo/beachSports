import { SportRules, rallyScoring } from './types';

export function beachPaddle(points = 7): SportRules {
  return {
    id: 'palas', name: 'Palas de playa', available: true,
    bouncesAllowed: 0, touchesPerSide: 1,
    pointsToWin: points, winBy: 2,
    isMatchOver: rallyScoring(points, 2),
  };
}

export const SPORTS = [
  { id: 'palas', name: 'PALAS', available: true },
  { id: 'voley', name: 'VÓLEY PLAYA', available: false },
  { id: 'futvoley', name: 'FUTVÓLEY', available: false },
];
