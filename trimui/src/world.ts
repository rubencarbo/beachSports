// Cámara de TV, decorado por capas con paralaje, público vivo, personajes por piezas, bola y efectos.
import { COURT, RIG_SCALE, STAGE_CX, STAGE_W, project } from '../../src/config';
import { BallPhysics, Theme } from '../../src/entities/ballPhysics';
import type { PlayerCore } from '../../src/entities/playerCore';
import { POSES, Pose, headFrame, layoutParts, lerpPose, partOrder, partOrigin, targetPose } from '../../src/entities/poses';
import type { Venue } from '../../src/game/venues';
import { CROWD_SCALE, Ctx, H, Img, PART_SCALE, Q0, W, asset, charGfx, crowdGfx, ctx2d, mkCanvas, text } from './gfx';
import { settings } from './settings';

export const CAM_BASE_Y = 462;
const VIEW_W = 1280, VIEW_H = 720;

// ---------------------------------------------------------------- cámara (port de fx/CameraDirector.ts)
function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number, maxSpeed = Infinity) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime, x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = cur - target;
  const maxChange = maxSpeed * smoothTime;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const t2 = cur - change, temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = t2 + (change + temp) * exp;
  if ((target - cur > 0) === (out > target)) { out = target; vel.v = (out - target) / dt; }
  return out;
}
interface Shot { x: number; y: number; zoom: number; panTime: number; zoomTime: number; priority: number; until: number }
export class Camera {
  x = STAGE_CX; y = CAM_BASE_Y; zoom = 1.4;
  private vx = { v: 0 }; private vy = { v: 0 }; private vz = { v: 0 };
  private kickZ = 0; private kickV = 0; private t = 0; private shot: Shot | null = null;
  followX = STAGE_CX; followY = CAM_BASE_Y; followZoom = 1.4; panTime = 0.55; zoomTime = 0.6;
  // resultado del fotograma
  cx = STAGE_CX; cy = CAM_BASE_Y; z = 1.4; Q = 0.35; ox = 0; oy = 0;
  private shakeT = 0; private shakeDur = 0; private shakeI = 0;
  flashA = 0; private flashDur = 0.1; flashCol = '#ffffff';
  cut(s: Omit<Shot, 'until'> & { duration: number }, now: number) {
    if (this.shot && this.shot.until > now && this.shot.priority > s.priority) return;
    this.shot = { ...s, until: now + s.duration };
  }
  kick(a: number) { this.kickV += a * 14; }
  shake(ms: number, intensity: number) { if (settings.lite && intensity < 0.005) intensity *= 0.6; this.shakeT = this.shakeDur = ms / 1000; this.shakeI = intensity; }
  flash(ms = 120, r = 255, g = 255, b = 255) { this.flashA = 0.9; this.flashDur = ms / 1000; this.flashCol = `rgb(${r},${g},${b})`; }
  snap() { this.x = this.followX; this.y = this.followY; this.zoom = this.followZoom; this.vx.v = this.vy.v = this.vz.v = 0; }
  update(dt: number, now: number) {
    this.t += dt;
    let tx = this.followX, ty = this.followY, tz = this.followZoom, pt = this.panTime, zt = this.zoomTime;
    if (this.shot && this.shot.until > now) { tx = this.shot.x; ty = this.shot.y; tz = this.shot.zoom; pt = this.shot.panTime; zt = this.shot.zoomTime; } else this.shot = null;
    this.x = smoothDamp(this.x, tx, this.vx, pt, dt, 2600);
    this.y = smoothDamp(this.y, ty, this.vy, pt * 1.3, dt, 1400);
    this.zoom = smoothDamp(this.zoom, tz, this.vz, zt, dt, 3);
    this.kickV += (-120 * this.kickZ - 14 * this.kickV) * dt;
    this.kickZ += this.kickV * dt;
    const z = Math.max(0.7, this.zoom + this.kickZ);
    const hx = Math.sin(this.t * 0.73) * 2.2 + Math.sin(this.t * 1.91) * 1.1, hy = Math.sin(this.t * 0.57 + 1) * 1.6 + Math.sin(this.t * 2.3) * 0.7;
    const halfW = VIEW_W / (2 * z), halfH = VIEW_H / (2 * z);
    this.cx = Math.max(halfW + 10, Math.min(STAGE_W - halfW - 10, this.x + hx));
    this.cy = Math.max(-420 + halfH, Math.min(860 - halfH, this.y + hy));
    this.z = z; this.Q = z * Q0;
    if (this.shakeT > 0) {
      this.shakeT -= dt; const k = this.shakeT / this.shakeDur;
      this.ox = Math.round((Math.random() * 2 - 1) * this.shakeI * W * k); this.oy = Math.round((Math.random() * 2 - 1) * this.shakeI * H * k);
    } else { this.ox = this.oy = 0; }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - (dt / this.flashDur) * 0.9);
  }
  /** Mundo (px de escenario) → pantalla de la consola. */
  sx(wx: number) { return (wx - this.cx) * this.Q + W / 2 + this.ox; }
  sy(wy: number) { return (wy - this.cy) * this.Q + H / 2 + this.oy; }
}

// ---------------------------------------------------------------- decorado
interface Fan { x: number; y: number; k: number; key: string; flip: boolean; phase: number; amp: number; up: number }
export class Stage {
  fans: Fan[] = [];
  excitement = 0;
  score: [number, number] = [0, 0];
  netH = COURT.netH;
  t = 0;
  constructor(public venue: Venue) {
    const rows = [{ z: COURT.fenceZ + 1.7, n: Math.round(19 * venue.crowd), back: true }, { z: COURT.fenceZ + 0.6, n: Math.round(15 * venue.crowd), back: false }];
    for (const r of rows) for (let i = 0; i < r.n; i++) {
      const wx = -14.5 + (29 * i) / r.n + (Math.random() - 0.5) * 0.7 + (r.back ? 0 : 0.9);
      if (!r.back && wx > 0.6 && wx < 3.4) continue;
      const p = project(wx, 0, r.z);
      let t = Math.floor(Math.random() * 8);
      if (!r.back && t === 5) t = Math.floor(Math.random() * 5);
      this.fans.push({ x: p.x, y: p.y, k: p.k * (0.92 + Math.random() * 0.14), key: `f${t}`, flip: t !== 2 && t !== 3 && Math.random() < 0.5, phase: Math.random() * 10, amp: 1 + Math.random() * 2, up: 0 });
    }
    for (const wx of [-6.2, 4.6, 9.5]) {
      const p = project(wx, 0, COURT.fenceZ + 0.35);
      this.fans.push({ x: p.x, y: p.y, k: p.k * 0.9, key: 'dog_', flip: wx > 0, phase: Math.random() * 10, amp: 0.5, up: 0 });
    }
    this.fans.sort((a, b) => a.y - b.y);
    // decodifica ya las capas de esta sede (no a mitad de partido)
    for (const l of ['far', 'beach', 'mid', 'court']) asset(`${l}_${venue.id}`);
    asset('fg'); asset('tex_fronds'); asset('tex_frondFg');
  }
  cheer(amount: number) {
    this.excitement = Math.min(1, Math.max(this.excitement, amount));
    for (const f of this.fans) if (Math.random() < amount * 0.85) f.up = 0.8 + Math.random() * 1.6 * amount;
  }
  update(dt: number) {
    this.t += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.25);
    for (const f of this.fans) if (f.up > 0) f.up -= dt;
  }

  /** Capa con paralaje (misma fórmula que BeachStage.applyParallax). */
  private layer(c: Ctx, cam: Camera, key: string, sx: number, sy: number) {
    const L = asset(key);
    const k = Math.pow(cam.z, sx - 1);
    const tx = cam.cx - k * (STAGE_CX + sx * (cam.cx - STAGE_CX)), ty = cam.cy - k * (CAM_BASE_Y + sy * (cam.cy - CAM_BASE_Y));
    const dx = (k * L.ox + tx - cam.cx) * cam.Q + W / 2 + cam.ox, dy = (k * L.oy + ty - cam.cy) * cam.Q + H / 2 + cam.oy;
    const s = (k * cam.Q) / L.s;
    c.drawImage(L.img as any, Math.round(dx), Math.round(dy), Math.round(L.w * s), Math.round(L.h * s));
    return { k, tx, ty };
  }
  private lp(cam: Camera, sx: number, sy: number) {
    const k = Math.pow(cam.z, sx - 1);
    return { k, tx: cam.cx - k * (STAGE_CX + sx * (cam.cx - STAGE_CX)), ty: cam.cy - k * (CAM_BASE_Y + sy * (cam.cy - CAM_BASE_Y)) };
  }

  drawBack(c: Ctx, cam: Camera) {
    c.fillStyle = '#6d96cd';
    c.fillRect(0, 0, W, H);
    this.layer(c, cam, `far_${this.venue.id}`, 0.2, 0.35);
    this.layer(c, cam, `beach_${this.venue.id}`, 0.5, 0.65);
    this.layer(c, cam, `mid_${this.venue.id}`, 0.66, 0.88);
    // público (capa 0,69 / 0,95)
    const P = this.lp(cam, 0.69, 0.95), cg = crowdGfx();
    const t = this.t;
    for (const f of this.fans) {
      const up = f.up > 0 && !settings.lite ? 1 : f.up > 0 ? 1 : 0;
      const fr = cg.frames[f.key + (up ? 'b' : 'a')];
      if (!fr) continue;
      const jump = up ? Math.abs(Math.sin(t * 9 + f.phase)) * 10 * f.amp * 0.6 : 0;
      const bob = Math.round(Math.abs(Math.sin(t * 2 + f.phase)) * f.amp);
      const s = CROWD_SCALE * f.k * P.k * cam.Q; // px de consola por px de arte
      const wx = P.k * f.x + P.tx, wy = P.k * (f.y - bob - jump) + P.ty;
      const x = cam.sx(wx), y = cam.sy(wy), w = fr.w * s, h = fr.h * s;
      if (x < -20 || x > W + 20) continue;
      const img = (f.flip ? fr.flip : fr.img) as any;
      c.drawImage(img, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    }
    // marcador de madera detrás de la red
    const bp = project(2, 0, COURT.fenceZ + 0.45), M = this.lp(cam, 0.69, 0.95);
    for (let i = 0; i < 2; i++) {
      const x = cam.sx(M.k * (bp.x - 24 + i * 48) + M.tx), y = cam.sy(M.k * (bp.y - 92) + M.ty);
      text(c, String(this.score[i]), x, y - 3, 1, i === 0 ? '#e0611a' : '#14858c', null, 'c');
    }
    this.layer(c, cam, `court_${this.venue.id}`, 1, 1);
  }

  /** Red (se dibuja ordenada en profundidad con jugadores y bola). */
  drawNet(c: Ctx, cam: Camera) {
    const h = this.netH, z0 = -0.4, z1 = COURT.width + 0.4;
    const P = (y: number, z: number) => { const p = project(0, y, z); return [cam.sx(p.x), cam.sy(p.y)]; };
    const [ax, ay] = P(0.08, z0), [bx, by] = P(0.08, z1), [cx, cy] = P(h, z1), [dx, dy] = P(h, z0);
    c.fillStyle = 'rgba(20,24,31,0.28)';
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.lineTo(dx, dy); c.closePath(); c.fill();
    c.lineWidth = Math.max(1, 1.6 * cam.z / 1.4); c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(dx, dy); c.lineTo(cx, cy); c.stroke();
    c.lineWidth = Math.max(1, 2.4 * cam.z / 1.4); c.strokeStyle = '#1b2240';
    c.beginPath();
    for (const z of [z0, z1]) { const [px, py] = P(0, z), [qx, qy] = P(h + 0.18, z); c.moveTo(px, py); c.lineTo(qx, qy); }
    c.stroke();
  }

  drawFront(c: Ctx, cam: Camera) {
    // siluetas del público en primer plano (capa 1,28; pegadas al borde inferior)
    const L = asset('fg');
    const k = Math.pow(cam.z, 0.28);
    const tx = cam.cx - k * (STAGE_CX + 1.28 * (cam.cx - STAGE_CX));
    const halfH = VIEW_H / (2 * cam.z);
    const ty = cam.cy + halfH + 30 / cam.z - k * 800 + Math.sin(this.t * 0.7) * 3;
    const s = (k * cam.Q) / L.s;
    c.drawImage(L.img as any, Math.round(cam.sx(k * L.ox + tx) - cam.ox * 0.3), Math.round(cam.sy(k * L.oy + ty)), Math.round(L.w * s), Math.round(L.h * s));
    // hojas de palmera (en coordenadas de pantalla)
    const fr = asset('tex_fronds'), sw = Math.sin(this.t * 0.6) * 0.6;
    const fw = fr.w * 1.05, fh = fr.h * 1.05;
    c.drawImage(fr.img as any, Math.round(30 * Q0 - fw / 2 + sw), Math.round(-40 * Q0 - fh * 0.05), Math.round(fw), Math.round(fh));
    c.save(); c.scale(-1, 1);
    c.drawImage(fr.img as any, Math.round(-(W - 30 * Q0) - fw / 2 - sw), Math.round(-50 * Q0 - fh * 0.05), Math.round(fw), Math.round(fh));
    c.restore();
    const fb = asset('tex_frondFg');
    c.drawImage(fb.img as any, Math.round(W + 40 * Q0 - fb.w + sw), Math.round(H + 20 * Q0 - fb.h));
  }
}

// ---------------------------------------------------------------- personajes
export class RigView {
  cur: Pose = { ...POSES.ready };
  constructor(public p: PlayerCore, public noPaddle = false) {}
  update(dt: number, time: number) {
    const { pose, rate, snap } = targetPose(this.p.rigInput(time), this.noPaddle);
    this.cur = lerpPose(this.cur, pose, snap ? 1 : 1 - Math.exp(-dt * rate));
  }
  draw(c: Ctx, cam: Camera, time: number) {
    const p = this.p, g = charGfx(p.char);
    const pr = project(p.x, p.y, p.z);
    const s = pr.k * RIG_SCALE * cam.Q;
    const sq = Math.max(-0.3, Math.min(0.3, p.sq));
    const hop = p.mood === 'happy' ? Math.abs(Math.sin(time * 11)) * 14 * pr.k : 0;
    const px = cam.sx(pr.x), py = cam.sy(pr.y - hop);
    if (px < -40 || px > W + 40) return;
    const sx = s * p.facing * (1 - sq * 0.6), sy = s * (1 + sq);
    const F = g.F, xf = layoutParts(F, this.cur, g.hk, g.lk);
    const hf = headFrame(F, { expr: p.rigInput(time).expr, mood: p.mood, time });
    for (const [name, frame0, back] of partOrder(F)) {
      if (name === 'paddle' && this.noPaddle) continue;
      const frame = name === 'head' ? hf : frame0;
      const part = g.parts[frame]; if (!part) continue;
      const t = xf[name]; if (!t) continue;
      const o = partOrigin(F, name, frame);
      const ox = o[0] * part.w, oy = o[1] * part.h;
      const su = name === 'head' ? t.sy : 1, sv = t.sy;
      const cs = Math.cos(t.rot), sn = Math.sin(t.rot), k = 1 / PART_SCALE;
      c.setTransform(sx * cs * su * k, sy * sn * su * k, -sx * sn * sv * k, sy * cs * sv * k,
        px + sx * (t.x - cs * su * ox + sn * sv * oy), py + sy * (t.y - sn * su * ox - cs * sv * oy));
      c.drawImage((back && part.back ? part.back : part.img) as any, 0, 0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/** Sombra elíptica en la arena (imagen precalculada). */
let shadowImg: Img | null = null;
export function drawShadow(c: Ctx, cam: Camera, x: number, z: number, w: number, h: number, a: number) {
  if (!shadowImg) {
    shadowImg = mkCanvas(32, 12); const x2 = ctx2d(shadowImg);
    x2.fillStyle = 'rgba(70,45,20,0.42)'; x2.beginPath(); x2.ellipse(16, 6, 15, 5.5, 0, 0, Math.PI * 2); x2.fill();
    x2.fillStyle = 'rgba(70,45,20,0.25)'; x2.beginPath(); x2.ellipse(16, 6, 10, 3.5, 0, 0, Math.PI * 2); x2.fill();
  }
  const g = project(x, 0, z);
  const sw = w * g.k * cam.Q, sh = h * g.k * cam.Q;
  c.globalAlpha = a;
  c.drawImage(shadowImg as any, cam.sx(g.x) - sw / 2, cam.sy(g.y) - sh / 2, sw, sh);
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- bola
const TRAIL: Record<string, [string, string]> = { normal: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.5)'], sun: ['#fff2a8', '#ff7a00'], wave: ['#dffcff', '#18c8e8'] };
export class BallView {
  trail: { x: number; y: number }[] = [];
  tex = 'tex_ball'; texW = 32;
  constructor(public b: BallPhysics) {}
  clearTrail() { this.trail.length = 0; }
  draw(c: Ctx, cam: Camera) {
    const b = this.b;
    const p = project(b.x, b.y, b.z);
    const x = cam.sx(p.x), y = cam.sy(p.y);
    const sp = b.speed;
    const fast = b.kind === 'special' || b.kind === 'smash' || b.kind === 'drive' || sp > 17;
    if (b.live && !b.held) this.trail.push({ x: p.x, y: p.y });
    const maxLen = settings.lite ? (b.kind === 'special' ? 10 : fast ? 6 : 3) : b.kind === 'special' ? 16 : fast ? 10 : 5;
    while (this.trail.length > maxLen) this.trail.shift();
    if (this.trail.length > 1 && sp > 6) {
      const cols = b.kind === 'special' || b.kind === 'smash' ? TRAIL[b.theme] : TRAIL.normal;
      const width = (b.kind === 'special' ? 30 : b.kind === 'smash' ? 17 : 9) * p.k * cam.Q;
      c.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = cols[pass === 0 ? 1 : 0];
        for (let i = 1; i < this.trail.length; i++) {
          const t = i / this.trail.length, a = this.trail[i - 1], bb = this.trail[i];
          c.globalAlpha = (pass === 0 ? 0.55 : 0.8) * t;
          c.lineWidth = Math.max(1, width * t * (pass === 0 ? 1 : 0.45));
          c.beginPath(); c.moveTo(cam.sx(a.x), cam.sy(a.y)); c.lineTo(cam.sx(bb.x), cam.sy(bb.y)); c.stroke();
        }
      }
      c.globalAlpha = 1;
    }
    if (b.kind === 'special' && b.live && !b.held && sp > 8) {
      const q = project(b.x + b.vx * 0.03, b.y + b.vy * 0.03, b.z + b.vz * 0.03);
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI;
      const im = asset(b.theme === 'wave' ? 'tex_comet_wave' : 'tex_comet_sun');
      const fl = 0.9 + Math.random() * 0.25, sx = (1.25 * p.k * fl * cam.Q) / im.s, sy = (0.9 * p.k * cam.Q) / im.s;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      c.setTransform(cs * sx, sn * sx, -sn * sy, cs * sy, x, y);
      c.drawImage(im.img as any, -im.w * 0.08, -im.h * 0.5);
      c.setTransform(1, 0, 0, 1, 0, 0);
    }
    const im = asset(this.tex);
    const d = (this.texW * 0.74 * p.k * b.size * cam.Q);
    const cs = Math.cos(b.spin), sn = Math.sin(b.spin), s = d / im.w;
    c.setTransform(cs * s, sn * s, -sn * s, cs * s, x, y);
    c.drawImage(im.img as any, -im.w / 2, -im.h / 2);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// ---------------------------------------------------------------- efectos
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Float { x: number; y: number; t: number; s: string; col: string; sc: number }
interface Decal { x: number; y: number; k: number; t: number; type: 'foot' | 'mark' }
export class Fx {
  parts: Part[] = []; floats: Float[] = []; decals: Decal[] = [];
  auras: { theme: Theme; x: number; y: number; k: number; on: boolean }[] = [];
  explos: { x: number; y: number; t: number; theme: Theme }[] = [];
  burst(x: number, y: number, n: number, col: string, spd: number, life: number, g = 600, size = 3) {
    if (settings.lite) n = Math.ceil(n * 0.5);
    for (let i = 0; i < n && this.parts.length < 120; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.6);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, life: life * (0.6 + Math.random() * 0.4), max: life, col, size, g });
    }
  }
  sandPuff(x: number, y: number, n: number) { this.burst(x, y, Math.ceil(n * 0.6), '#f3d79a', 140, 0.45, 500, 5); }
  hitSpark(x: number, y: number, big: boolean) { this.burst(x, y, big ? 14 : 7, big ? '#fff07a' : '#ffffff', big ? 520 : 320, 0.25, 0, big ? 5 : 3); }
  powerBurst(theme: Theme, x: number, y: number) { this.burst(x, y, 22, theme === 'sun' ? '#ffb020' : '#5ff0ff', 420, 0.6, -200, 6); }
  explosion(theme: Theme, x: number, y: number) {
    this.explos.push({ x, y, t: 0, theme });
    this.burst(x, y, 40, theme === 'sun' ? '#ff7a00' : '#18c8e8', 700, 0.9, 400, 8);
    this.burst(x, y, 20, '#fff6c8', 500, 0.6, 300, 6);
  }
  floatText(x: number, y: number, s: string, col: string, size: number) {
    this.floats = this.floats.filter((f) => f.t < 1.1);
    if (this.floats.length > 4) this.floats.shift();
    this.floats.push({ x, y, t: 0, s, col, sc: size >= 34 ? 2 : 1 });
  }
  decal(type: 'foot' | 'mark', x: number, y: number, k: number) {
    this.decals.push({ x, y, k, t: 0, type });
    if (this.decals.length > (settings.lite ? 16 : 40)) this.decals.shift();
  }
  startAura(theme: Theme) { this.auras = [{ theme, x: 0, y: 0, k: 1, on: true }]; }
  moveAura(theme: Theme, x: number, y: number, k: number) { let a = this.auras.find((q) => q.theme === theme); if (!a) { a = { theme, x, y, k, on: true }; this.auras.push(a); } a.x = x; a.y = y; a.k = k; a.on = true; }
  stopAura(theme: Theme) { this.auras = this.auras.filter((a) => a.theme !== theme); }
  update(dt: number) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - dt * 2; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 1.3);
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter((d) => d.t < 6);
    for (const e of this.explos) e.t += dt;
    this.explos = this.explos.filter((e) => e.t < 0.6);
  }
  drawDecals(c: Ctx, cam: Camera) {
    for (const d of this.decals) {
      const a = Math.min(1, (6 - d.t) / 2) * (d.type === 'mark' ? 0.5 : 0.35);
      c.fillStyle = d.type === 'mark' ? `rgba(150,105,50,${a})` : `rgba(160,115,60,${a})`;
      const w = (d.type === 'mark' ? 22 : 9) * d.k * cam.Q, h = w * 0.4;
      c.fillRect(Math.round(cam.sx(d.x) - w / 2), Math.round(cam.sy(d.y) - h / 2), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
  }
  drawAuras(c: Ctx, cam: Camera, t: number) {
    for (const a of this.auras) {
      const r = (70 + Math.sin(t * 12) * 8) * a.k * cam.Q;
      c.globalAlpha = 0.28 + Math.sin(t * 9) * 0.08;
      c.fillStyle = a.theme === 'sun' ? '#ff9a20' : '#30d8ff';
      c.beginPath(); c.ellipse(cam.sx(a.x), cam.sy(a.y) - r * 0.9, r * 0.75, r * 1.05, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
  }
  draw(c: Ctx, cam: Camera) {
    for (const e of this.explos) {
      const r = (40 + e.t * 500) * cam.Q, a = 1 - e.t / 0.6;
      c.globalAlpha = a * 0.7; c.fillStyle = e.theme === 'sun' ? '#ffb020' : '#7ff0ff';
      c.beginPath(); c.ellipse(cam.sx(e.x), cam.sy(e.y), r, r * 0.45, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a; c.fillStyle = '#fff6d0';
      c.beginPath(); c.ellipse(cam.sx(e.x), cam.sy(e.y), r * 0.5, r * 0.22, 0, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    let last = '';
    for (const p of this.parts) {
      const s = Math.max(1, Math.round(p.size * cam.Q * Math.min(1, (p.life / p.max) * 1.5)));
      if (p.col !== last) { c.fillStyle = p.col; last = p.col; }
      c.fillRect(Math.round(cam.sx(p.x) - s / 2), Math.round(cam.sy(p.y) - s / 2), s, s);
    }
    for (const f of this.floats) {
      const rise = Math.min(1, f.t * 3) * 10 + f.t * 6;
      const x = Math.max(4, Math.min(W - 4, cam.sx(f.x))), y = Math.max(16, Math.min(H - 30, cam.sy(f.y) - rise));
      c.globalAlpha = f.t > 0.9 ? Math.max(0, 1 - (f.t - 0.9) / 0.4) : 1;
      const tw = (f.s.length * 4 - 1) * f.sc;
      text(c, f.s, Math.max(2 + tw / 2, Math.min(W - 2 - tw / 2, x)), y, f.sc, f.col, '#1b2240', 'c');
    }
    c.globalAlpha = 1;
  }
}
