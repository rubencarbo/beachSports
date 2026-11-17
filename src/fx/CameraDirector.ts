import Phaser from 'phaser';
import { STAGE_W } from '../config';

/**
 * "Realizador" de TV: cámara dinámica que sigue la acción como en el vídeo de referencia.
 *
 * Medido en el vídeo (fotograma a fotograma):
 *  - Paneo lateral suave y continuo siguiendo la bola: ~10–25% del ancho de pantalla por segundo,
 *    con aceleración/frenado progresivos (muelle amortiguado, nunca cortes secos).
 *  - Barrido rápido (~50% pantalla/s) acompañando la bola de fuego del especial.
 *  - Zoom-in de ~10–25% sobre el jugador que ejecuta el especial y vuelta progresiva al plano general.
 *  - Ligero temblor de impacto y "cámara al hombro" sutil.
 *
 * Implementación: muelles críticamente amortiguados (smoothDamp) para x, y y zoom, con objetivos
 * que se calculan cada frame a partir de la bola (con anticipación según su velocidad), el jugador
 * que va a recibir, y "planos" temporales (cinemáticas) que tienen prioridad.
 */

export interface Shot {
  x: number;
  y: number;
  zoom: number;
  panTime: number; // tiempo de suavizado del paneo (s): menor = más rápido
  zoomTime: number;
  until: number; // tiempo real (s) en el que expira
  priority: number;
}

export const CAM_BASE_Y = 462;

function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number, maxSpeed = Infinity) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = cur - target;
  const maxChange = maxSpeed * smoothTime;
  change = Phaser.Math.Clamp(change, -maxChange, maxChange);
  const t2 = cur - change;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = t2 + (change + temp) * exp;
  if ((target - cur > 0) === (out > target)) { out = target; vel.v = (out - target) / dt; }
  return out;
}

export class CameraDirector {
  x: number;
  y = CAM_BASE_Y;
  zoom = 1.1;
  private vx = { v: 0 };
  private vy = { v: 0 };
  private vz = { v: 0 };
  private zoomKick = 0;
  private zoomKickV = 0;
  private t = 0;
  private shot: Shot | null = null;

  // objetivo "de seguimiento" (lo actualiza la escena cada frame)
  followX = STAGE_W / 2;
  followY = CAM_BASE_Y;
  followZoom = 1.1;
  panTime = 0.55;
  zoomTime = 0.6;

  constructor(public cam: Phaser.Cameras.Scene2D.Camera) {
    this.x = STAGE_W / 2;
  }

  /** Plano temporal con prioridad (cinemática). */
  cut(shot: Omit<Shot, 'until'> & { duration: number }, now: number) {
    if (this.shot && this.shot.until > now && this.shot.priority > shot.priority) return;
    this.shot = { ...shot, until: now + shot.duration };
  }
  releaseShot() { this.shot = null; }

  /** Golpe de zoom instantáneo (puñetazo de cámara) que se relaja solo. */
  kick(amount: number) { this.zoomKickV += amount * 14; }

  shake(duration: number, intensity: number) { this.cam.shake(duration, intensity, true); }

  flash(duration = 120, r = 255, g = 255, b = 255) { this.cam.flash(duration, r, g, b, true); }

  update(realDt: number, now: number) {
    this.t += realDt;
    let tx = this.followX, ty = this.followY, tz = this.followZoom;
    let pt = this.panTime, ztime = this.zoomTime;
    if (this.shot && this.shot.until > now) {
      tx = this.shot.x; ty = this.shot.y; tz = this.shot.zoom;
      pt = this.shot.panTime; ztime = this.shot.zoomTime;
    } else this.shot = null;

    this.x = smoothDamp(this.x, tx, this.vx, pt, realDt, 2600);
    this.y = smoothDamp(this.y, ty, this.vy, pt * 1.3, realDt, 1400);
    this.zoom = smoothDamp(this.zoom, tz, this.vz, ztime, realDt, 3);

    // muelle del "kick" de zoom
    const k = 120, d = 14;
    this.zoomKickV += (-k * this.zoomKick - d * this.zoomKickV) * realDt;
    this.zoomKick += this.zoomKickV * realDt;

    const z = Math.max(0.7, this.zoom + this.zoomKick);
    // cámara al hombro sutil
    const hx = Math.sin(this.t * 0.73) * 2.2 + Math.sin(this.t * 1.91) * 1.1;
    const hy = Math.sin(this.t * 0.57 + 1) * 1.6 + Math.sin(this.t * 2.3) * 0.7;

    // limitar a los bordes del escenario
    const halfW = this.cam.width / (2 * z);
    const halfH = this.cam.height / (2 * z);
    const cx = Phaser.Math.Clamp(this.x + hx, halfW + 10, STAGE_W - halfW - 10);
    const cy = Phaser.Math.Clamp(this.y + hy, -420 + halfH, 860 - halfH);
    this.cam.setZoom(z);
    this.cam.centerOn(cx, cy);
    return { x: cx, y: cy, zoom: z };
  }
}
