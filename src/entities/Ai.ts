import { COURT, PHYS } from '../config';
import type { Ball } from './Ball';
import type { Intent, Player } from './Player';

export interface AiSkill {
  react: [number, number]; // segundos de reacción
  speed: number; // multiplicador de velocidad de desplazamiento
  posError: number; // error de colocación (m)
  quality: [number, number]; // rango de calidad de golpeo
  smashChance: number;
  specialChance: number;
}

export const AI_LEVELS: Record<string, AiSkill> = {
  facil: { react: [0.3, 0.5], speed: 0.72, posError: 0.75, quality: [0.25, 0.75], smashChance: 0.25, specialChance: 0.3 },
  normal: { react: [0.18, 0.32], speed: 0.88, posError: 0.45, quality: [0.4, 0.9], smashChance: 0.55, specialChance: 0.5 },
  dificil: { react: [0.08, 0.18], speed: 1.0, posError: 0.2, quality: [0.6, 1.0], smashChance: 0.85, specialChance: 0.8 },
};

export class AiController {
  private reactT = 0;
  private lastHitterSeen: number = 99;
  private target = { x: 0, z: 4 };
  private plan: { t: number; smash: boolean } | null = null;
  private serveDelay = 0;
  private jumped = false;
  wantShot: { aimZ: number; kind: 'normal' | 'drive' | 'lob' } = { aimZ: 0.5, kind: 'normal' };
  qualityRoll = 0.7;

  constructor(public me: Player, public skill: AiSkill) {}

  think(dt: number, ball: Ball, opp: Player, servingMe: boolean): Intent {
    const me = this.me;
    const it: Intent = { mx: 0, mz: 0, hit: false, jump: false, special: false };

    if (servingMe && ball.held) {
      // al sacar: espera un instante, se recoloca y saca
      this.serveDelay += dt;
      if (this.serveDelay > 1.1) { it.hit = true; this.serveDelay = 0; this.pickShot(opp); }
      return it;
    }
    this.serveDelay = 0;

    const incoming = ball.live && !ball.held && ball.lastHitter !== me.side;
    if (ball.lastHitter !== this.lastHitterSeen) {
      this.lastHitterSeen = ball.lastHitter;
      this.reactT = this.skill.react[0] + Math.random() * (this.skill.react[1] - this.skill.react[0]);
      this.plan = null;
      this.jumped = false;
      if (incoming) this.pickShot(opp);
    }

    if (incoming) {
      this.reactT -= dt;
      if (this.reactT <= 0 && !this.plan) this.computePlan(ball);
      if (this.plan) {
        // ¿especial?
        if (me.meter >= 1 && !me.powered && Math.random() < this.skill.specialChance * dt * 3) it.special = true;
      }
    } else {
      // posición de espera: fondo-medio de su campo, centrado respecto a la bola
      this.target.x = me.side * 5.2;
      this.target.z = 4 + (ball.z - 4) * 0.35;
    }

    const dx = this.target.x - me.x;
    const dz = this.target.z - me.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.12) {
      const sp = Math.min(1, dist / 0.6) * this.skill.speed;
      it.mx = (dx / dist) * sp;
      it.mz = (dz / dist) * sp;
    }

    if (incoming && this.plan) {
      // tiempo hasta el contacto planeado
      this.plan.t -= dt;
      if (this.plan.smash && !this.jumped && this.plan.t <= PHYS.jumpV / PHYS.gravity * 0.95) {
        it.jump = true;
        this.jumped = true;
      }
      const ss = me.sweetSpot();
      const d = Math.hypot(ball.x - ss.x, (ball.y - ss.y) * 0.8, ball.z - ss.z);
      if (d < PHYS.reach * 0.95 && me.hitBuffer <= 0 && me.swingT >= 1) it.hit = true;
    }
    return it;
  }

  private pickShot(opp: Player) {
    const r = Math.random();
    // tira lejos del rival en profundidad
    const aimZ = opp.z > COURT.width / 2 ? Math.random() * 0.35 : 0.65 + Math.random() * 0.35;
    const oppNearNet = Math.abs(opp.x) < 4;
    const kind = oppNearNet && r < 0.6 ? 'lob' : r < 0.45 ? 'drive' : r < 0.75 ? 'normal' : 'lob';
    this.wantShot = { aimZ: Math.random() < 0.75 ? aimZ : Math.random(), kind };
    const [q0, q1] = this.skill.quality;
    this.qualityRoll = q0 + Math.random() * (q1 - q0);
  }

  private computePlan(ball: Ball) {
    const me = this.me;
    const f = planIntercept(ball, me, Math.random() < this.skill.smashChance);
    if (!f) return;
    const err = this.skill.posError;
    this.target.x = f.x + (Math.random() - 0.5) * err;
    this.target.z = f.z + (Math.random() - 0.5) * err;
    this.plan = { t: f.t, smash: f.smash };
  }

}

export interface InterceptPlan {
  t: number; // segundos hasta el contacto
  x: number; z: number; // dónde debe colocarse el jugador
  bx: number; by: number; bz: number; // dónde estará la bola
  smash: boolean;
}

/** Predice dónde y cuándo puede golpear `me` la bola que viene (remate si va alta y se permite). */
export function planIntercept(ball: Ball, me: Player, allowSmash: boolean): InterceptPlan | null {
  let found: InterceptPlan | null = null;
  const mk = (t: number, x: number, y: number, z: number, smash: boolean): InterceptPlan => {
    let px = x - me.facing * 0.45;
    px = me.side < 0 ? Math.min(px, -0.5) : Math.max(px, 0.5);
    return { t, x: px, z: z + 0.15, bx: x, by: y, bz: z, smash };
  };
  if (allowSmash) {
    ball.predict(3, 1 / 60, (t, x, y, z, vy) => {
      if (x * me.side > 1.2 && x * me.side < 7.5 && vy < 0 && y > 2.1 && y < PHYS.reachUp + 1.0) { found = mk(t, x, y, z, true); return true; }
      return false;
    });
  }
  if (!found) {
    ball.predict(3, 1 / 60, (t, x, y, z, vy) => {
      if (x * me.side > 0.6 && vy < 0 && y < 1.3) { found = mk(t, x, y, z, false); return true; }
      return false;
    });
  }
  return found;
}
