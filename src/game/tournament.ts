import { getChar, getRoster } from './roster';
import { VENUES } from './venues';

/**
 * Torneo eliminatorio de 8 jugadoras: cuartos -> semifinales -> final.
 * Cada ronda se juega en una sede distinta y la máquina es más dura en cada fase.
 * Los partidos entre jugadoras de la máquina se simulan según sus estadísticas.
 */
export interface Match { a: string; b: string; winner?: string; score?: [number, number] }
export interface Tournament {
  player: string;
  rounds: Match[][]; // [cuartos(4), semis(2), final(1)]
  round: number; // ronda actual (0..2); 3 = terminado
  points: number;
  champion?: string;
  eliminated?: boolean;
  sport: 'palas' | 'futvoley';
}

export const ROUND_NAMES = ['CUARTOS DE FINAL', 'SEMIFINAL', 'GRAN FINAL'];
export const ROUND_DIFF: ('facil' | 'normal' | 'dificil')[] = ['facil', 'normal', 'dificil'];

let current: Tournament | null = null;

export function getTournament() { return current; }
export function clearTournament() { current = null; }

export function startTournament(player: string, points: number, sport: 'palas' | 'futvoley' = 'palas'): Tournament {
  const ids = getRoster().map((c) => c.id).filter((id) => id !== player);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const field = [player, ...ids.slice(0, 7)];
  while (field.length < 8) field.push(getRoster()[field.length % getRoster().length].id);
  // la jugadora va en el primer partido; el resto, emparejado en orden aleatorio
  const quarters: Match[] = [];
  for (let i = 0; i < 8; i += 2) quarters.push({ a: field[i], b: field[i + 1] });
  current = { player, rounds: [quarters, [], []], round: 0, points, sport };
  return current;
}

/** Partido de la jugadora en la ronda actual. */
export function playerMatch(t: Tournament): Match | undefined {
  return t.rounds[t.round]?.find((m) => m.a === t.player || m.b === t.player);
}

export function venueFor(round: number) { return VENUES[Math.min(round, VENUES.length - 1)].id; }

function simulate(m: Match, points: number) {
  const ca = getChar(m.a), cb = getChar(m.b);
  const ra = ca.stats.speed + ca.stats.power + ca.stats.control;
  const rb = cb.stats.speed + cb.stats.power + cb.stats.control;
  const pa = 0.5 + (ra - rb) * 0.04;
  const aWins = Math.random() < pa;
  const loser = Math.floor(Math.random() * (points - 1));
  m.winner = aWins ? m.a : m.b;
  m.score = aWins ? [points, loser] : [loser, points];
}

/** Registra el resultado de la jugadora, simula el resto de la ronda y prepara la siguiente. */
export function reportResult(won: boolean, myScore: number, oppScore: number) {
  const t = current;
  if (!t) return;
  const pm = playerMatch(t);
  if (pm) {
    const meA = pm.a === t.player;
    pm.winner = won ? t.player : meA ? pm.b : pm.a;
    pm.score = meA ? [myScore, oppScore] : [oppScore, myScore];
  }
  for (const m of t.rounds[t.round]) if (!m.winner) simulate(m, t.points);
  if (!won) t.eliminated = true;
  advance(t);
}

function advance(t: Tournament) {
  const winners = t.rounds[t.round].map((m) => m.winner!);
  if (t.round === 2) { t.champion = winners[0]; t.round = 3; return; }
  const next: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1] });
  t.round++;
  t.rounds[t.round] = next;
  // si la jugadora está eliminada, el resto del torneo se simula de golpe
  if (t.eliminated) { for (const m of next) simulate(m, t.points); advance(t); }
}
