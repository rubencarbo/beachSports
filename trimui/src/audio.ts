/* Audio de consola: sintetizador propio en JS → dispositivo de audio SDL (mono, 22050 Hz, float32).
   El Web Audio del lanzador mezcla mal y no libera nodos: aquí cada sonido es una "voz" que sólo gasta CPU
   mientras suena. Patrón de plantillas/console/10-synth.js del kit (bombeo adaptativo + perro guardián). */
import { settings } from './settings';

const SR = 22050, BLK = 64, TAU = Math.PI * 2;
const SINE = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) SINE[i] = Math.sin((i / 4096) * TAU);
const NZ = new Float32Array(65536);
for (let i = 0; i < 65536; i++) NZ[i] = Math.random() * 2 - 1;

type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';
interface Filt { ty: number; q: number; f: number; b0: number; b1: number; b2: number; a1: number; a2: number; x1: number; x2: number; y1: number; y2: number }
const FT: Record<string, number> = { lowpass: 0, highpass: 1, bandpass: 2 };
const filt = (type: string, q = 0.7): Filt => ({ ty: FT[type] ?? 0, q, f: -1, b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 });
function setF(F: Filt, f: number) {
  f = f < 20 ? 20 : f > SR * 0.45 ? SR * 0.45 : f;
  if (Math.abs(f - F.f) < F.f * 0.006) return;
  F.f = f;
  const w = (TAU * f) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Math.max(0.05, F.q)), a0 = 1 + al;
  if (F.ty === 0) { F.b0 = (1 - cs) / 2 / a0; F.b1 = (1 - cs) / a0; F.b2 = F.b0; }
  else if (F.ty === 1) { F.b0 = (1 + cs) / 2 / a0; F.b1 = -(1 + cs) / a0; F.b2 = F.b0; }
  else { F.b0 = al / a0; F.b1 = 0; F.b2 = -al / a0; }
  F.a1 = (-2 * cs) / a0; F.a2 = (1 - al) / a0;
}
function runF(F: Filt, b: Float32Array, n: number) {
  let { x1, x2, y1, y2 } = F; const { b0, b1, b2, a1, a2 } = F;
  for (let i = 0; i < n; i++) { const x = b[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; b[i] = y; }
  if (Math.abs(y1) < 1e-15) y1 = 0; if (Math.abs(y2) < 1e-15) y2 = 0;
  F.x1 = x1; F.x2 = x2; F.y1 = y1; F.y2 = y2;
}

/** Voz: oscilador o ruido (con filtro), frecuencia con rampa exponencial y envolvente ataque/caída exponencial. */
interface Voice {
  s: number; e: number; // muestras inicio/fin
  noise: boolean; wave: Wave; ph: number; j: number;
  f0: number; f1: number; // frecuencia (o corte del filtro en ruido) inicio→fin
  vol: number; att: number; dur: number; t0: number;
  F: Filt | null; bus: 0 | 1; // 0 música, 1 efectos
}

class Synth {
  n = 0; // muestras generadas
  voices: Voice[] = [];
  dev: any = null; HB: any = null; hb: any = null; hf: Float32Array | null = null;
  err = ''; state = 'parado'; ms = 0; reopens = 0; sent = 0; lastQ = 0; stall = 0; frame = 1 / 30; started = false;
  mute = 1; muteT = 1;
  tmp = new Float32Array(BLK); mus = new Float32Array(BLK); sfx = new Float32Array(BLK);
  // ambiente continuo: olas y murmullo del público
  waveF = filt('lowpass', 0.7); crowdF = filt('bandpass', 0.8); amb = 0; ambJ = 0; ambK = 0;
  cheerG = 0; cheerT = 0;
  get time() { return this.n / SR; }

  hostBuffer(canvas: any) {
    if (this.HB) return this.HB;
    for (const f of [() => canvas && canvas.data && canvas.data(), () => new (OffscreenCanvas as any)(1, 1).data()]) {
      try { const d = f(); if (d && d.constructor && typeof d.constructor.alloc === 'function') return (this.HB = d.constructor); } catch (e) { /* sigue */ }
    }
    return null;
  }
  open(canvas: any) {
    if (typeof sdl === 'undefined' || !sdl || !sdl.audio) { this.err = 'SIN SDL'; return false; }
    const HB = this.hostBuffer(canvas);
    if (!HB) { this.err = 'SIN BUFFER'; return false; }
    try {
      this.dev = sdl.audio.openDevice({ type: 'playback' }, { channels: 1, frequency: SR, format: 'f32', buffered: 1024 });
      this.dev.play();
      this.state = 'ok'; this.err = '';
      this.hb = HB.alloc(SR * 4); this.hf = new Float32Array(this.hb.buffer, this.hb.byteOffset, SR);
      return true;
    } catch (e: any) { this.err = String((e && e.message) || e).slice(0, 40); this.state = 'error'; console.error('[BeachSports] audio: ' + this.err); return false; }
  }
  start(canvas: any) {
    if (this.started) return;
    this.started = true;
    if (!this.open(canvas)) return;
    this.pump();
    setInterval(() => this.pump(), 12);
    setInterval(() => this.watchdog(canvas), 1000);
  }
  queued() { try { return this.dev ? this.dev.queued / 4 / SR : 0; } catch (e) { return 0; } }
  pump() {
    if (!this.dev || this.state !== 'ok') return;
    const t0 = performance.now();
    const target = Math.min(0.35, Math.max(0.12, 0.08 + 2.5 * this.frame));
    let q = this.queued();
    for (let k = 0; k < 10 && q < target; k++) {
      const n = Math.min(Math.ceil(SR * 0.05), Math.ceil((target - q) * SR) + BLK);
      music.tick(this.time + n / SR + 0.03);
      this.render(this.hf!, n);
      try { this.dev.enqueue(this.hb, n * 4); this.sent += n * 4; } catch (e: any) { this.err = String(e.message).slice(0, 40); break; }
      q += n / SR;
    }
    this.ms += performance.now() - t0;
  }
  watchdog(canvas: any) {
    if (!this.dev) return;
    let q: number; try { q = this.dev.queued; } catch (e) { q = -1; }
    const used = this.sent - q;
    if (q > 0 && used <= this.lastQ) this.stall++; else this.stall = 0;
    this.lastQ = used;
    if (this.stall >= 2) {
      this.stall = 0; this.reopens++;
      console.error('[BeachSports] audio parado: reabro el dispositivo (' + this.reopens + ')');
      try { this.dev.close(); } catch (e) { /* nada */ }
      this.dev = null; this.sent = 0; this.lastQ = 0; this.open(canvas);
    }
  }

  add(v: Omit<Voice, 's' | 'e' | 'ph' | 'j'> & { when?: number }) {
    if (!this.dev) return; // sin dispositivo no se acumulan voces
    if (this.voices.length > 48) return;
    const t0 = v.t0;
    const s = Math.max(this.n, Math.round(t0 * SR)), e = Math.round((t0 + v.dur + 0.03) * SR);
    this.voices.push({ ...v, s, e, ph: Math.random(), j: (Math.random() * 65536) | 0 });
  }

  render(out: Float32Array, len: number) {
    const n0 = this.n;
    for (let o = 0; o < len; o += BLK) {
      const n = Math.min(BLK, len - o), b0 = n0 + o;
      this.mus.fill(0, 0, n); this.sfx.fill(0, 0, n);
      const vs = this.voices; let w = 0;
      for (let k = 0; k < vs.length; k++) {
        const v = vs[k]; if (v.e <= b0) continue; vs[w++] = v; if (v.s >= b0 + n) continue;
        const i0 = Math.max(0, v.s - b0), i1 = Math.min(n, v.e - b0);
        if (i1 > i0) this.voice(v, i0, i1, b0);
      }
      vs.length = w;
      this.ambient(n, b0);
      const mt = this.muteT, mv = settings.music ? 0.55 : 0, sv = settings.sound ? 0.9 : 0;
      let mu = this.mute;
      for (let i = 0; i < n; i++) {
        mu += (mt - mu) * 0.004;
        let x = (this.mus[i] * mv + this.sfx[i] * sv) * mu;
        x = x > 3 ? 1 : x < -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x);
        out[o + i] = x;
      }
      this.mute = mu;
    }
    this.n += len;
  }

  private voice(v: Voice, i0: number, i1: number, b0: number) {
    const tmp = this.tmp, n = i1 - i0, tA = (b0 + i0) / SR - v.t0;
    const fr = (t: number) => v.f0 * Math.pow(v.f1 / v.f0, Math.min(1, Math.max(0, t / v.dur)));
    const f = fr(tA);
    if (v.noise) { let j = v.j; for (let i = 0; i < n; i++) tmp[i] = NZ[(j++) & 65535]; v.j = j; setF(v.F!, f); runF(v.F!, tmp, n); }
    else {
      let ph = v.ph; const dt = Math.min(0.45, f / SR);
      if (v.wave === 'sine') for (let i = 0; i < n; i++) { tmp[i] = SINE[(ph * 4096) | 0]; ph += dt; if (ph >= 1) ph -= 1; }
      else if (v.wave === 'triangle') for (let i = 0; i < n; i++) { tmp[i] = 4 * Math.abs(ph - 0.5) - 1; ph += dt; if (ph >= 1) ph -= 1; }
      else if (v.wave === 'square') for (let i = 0; i < n; i++) { tmp[i] = ph < 0.5 ? 0.7 : -0.7; ph += dt; if (ph >= 1) ph -= 1; }
      else for (let i = 0; i < n; i++) { tmp[i] = (2 * ph - 1) * 0.7; ph += dt; if (ph >= 1) ph -= 1; }
      v.ph = ph;
    }
    const env = (t: number) => (t < 0 ? 0 : t < v.att ? (v.att > 0 ? t / v.att : 1) * v.vol : t > v.dur ? 0 : v.vol * Math.pow(0.0002 / Math.max(1e-4, v.vol), (t - v.att) / Math.max(1e-3, v.dur - v.att)));
    let g = env(tA); const g1 = env(tA + n / SR), dg = (g1 - g) / n;
    const dst = v.bus === 0 ? this.mus : this.sfx;
    for (let i = 0; i < n; i++) { dst[i0 + i] += tmp[i] * g; g += dg; }
  }

  /** Olas (ruido grave con vaivén lento) y murmullo del público; las ovaciones lo suben un rato. */
  private ambient(n: number, b0: number) {
    const t = b0 / SR, tmp = this.tmp;
    this.amb += ((game.ambient ? 1 : 0) - this.amb) * 0.02;
    if (this.amb < 0.01) return;
    this.cheerG += (this.cheerT - this.cheerG) * 0.01;
    this.cheerT *= 0.9994;
    let j = this.ambJ;
    for (let i = 0; i < n; i++) tmp[i] = NZ[(j++) & 65535];
    this.ambJ = j;
    setF(this.waveF, 500); runF(this.waveF, tmp, n);
    const wv = (0.05 + 0.035 * Math.sin(TAU * 0.12 * t)) * this.amb * 1.4;
    for (let i = 0; i < n; i++) this.sfx[i] += tmp[i] * wv;
    let k = this.ambK + 20000;
    for (let i = 0; i < n; i++) tmp[i] = NZ[(k++) & 65535];
    this.ambK = k - 20000;
    setF(this.crowdF, 650 + this.cheerG * 500); runF(this.crowdF, tmp, n);
    const cv = (0.05 + this.cheerG * 0.22) * this.amb;
    for (let i = 0; i < n; i++) this.sfx[i] += tmp[i] * cv;
  }
}
export const SYN = new Synth();
/** Estado que el audio consulta (lo fija el juego). */
export const game = { ambient: false };

const now = () => SYN.time + 0.01;
function tone(f0: number, f1: number, dur: number, vol: number, wave: Wave = 'sine', when = 0, bus: 0 | 1 = 1, att = 0.004) {
  SYN.add({ noise: false, wave, f0, f1, vol, att, dur, t0: now() + when, F: null, bus });
}
function noise(dur: number, type: string, f0: number, f1: number, vol: number, att = 0.005, when = 0, bus: 0 | 1 = 1) {
  SYN.add({ noise: true, wave: 'sine', f0, f1: Math.max(20, f1), vol, att, dur, t0: now() + when, F: filt(type, type === 'bandpass' ? 1.2 : 0.7), bus });
}

/** Mismos efectos que la versión web (src/core/audio.ts). */
export const sfx = {
  hit(power = 0.5) { tone(520 + power * 200, 180, 0.09, 0.5); noise(0.06, 'bandpass', 2400, 900, 0.4 + power * 0.3); },
  whoosh() { noise(0.3, 'bandpass', 600, 2400, 0.25, 0.08); },
  jump() { noise(0.15, 'lowpass', 900, 200, 0.2); },
  land() { noise(0.12, 'lowpass', 500, 120, 0.25); },
  powerUp() { tone(200, 900, 0.5, 0.25, 'sawtooth'); noise(0.7, 'bandpass', 300, 3000, 0.3, 0.2); },
  fireShot() { tone(160, 50, 0.5, 0.6, 'square'); noise(0.9, 'lowpass', 3000, 200, 0.6); },
  explosion() { tone(90, 30, 0.7, 0.8); noise(1.2, 'lowpass', 2500, 80, 0.9, 0.003); },
  netHit() { noise(0.2, 'lowpass', 700, 150, 0.4); },
  bounce() { noise(0.1, 'lowpass', 400, 100, 0.35); },
  whistle() { tone(2100, 2000, 0.35, 0.18, 'triangle'); },
  cheer(intensity = 1) { SYN.cheerT = Math.min(1.2, Math.max(SYN.cheerT, intensity * 0.7)); noise(1.2 + intensity * 0.6, 'bandpass', 1100, 800, 0.1 * intensity, 0.25); },
  ui() { tone(880, 660, 0.08, 0.2, 'triangle'); },
  move() { tone(660, 620, 0.04, 0.12, 'triangle'); },
};

/** Música chiptune procedural (la misma progresión I–V–vi–IV a 118 ppm de la web). */
export const music = {
  step: 0, next: 0, melody: [] as number[], on: true,
  init() {
    const penta = [0, 2, 4, 7, 9, 12, 14, 16];
    const phrase = () => Array.from({ length: 16 }, (_, i) => (i % 4 === 3 || Math.random() < 0.25 ? -1 : penta[Math.floor(Math.random() * penta.length)]));
    const a = phrase(), b = phrase();
    this.melody = [...a, ...b, ...a, ...phrase()];
  },
  tick(until: number) {
    if (!this.melody.length) this.init();
    const spb = 60 / 118 / 4;
    if (this.next < SYN.time) this.next = SYN.time + 0.02;
    while (this.next < until) { this.play(this.step, this.next, spb); this.next += spb; this.step++; }
  },
  play(step: number, t: number, spb: number) {
    if (!settings.music) return;
    const s16 = step % 16, bar = Math.floor(step / 16) % 4;
    const roots = [48, 43, 45, 41], minor = bar === 2, root = roots[bar];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const at = t - SYN.time - 0.01;
    if (s16 % 8 === 0) tone(140, 45, 0.16, 0.9, 'sine', at, 0, 0.002);
    if (s16 === 4 || s16 === 12) noise(0.14, 'bandpass', 1800, 1800, 0.45, 0.002, at, 0);
    if (s16 % 2 === 0) noise(0.04, 'highpass', 7000, 7000, 0.18, 0.001, at, 0);
    if ([0, 3, 6, 8, 11, 14].includes(s16)) { const f = hz(root - 12 + (s16 === 6 || s16 === 14 ? 12 : 0)); tone(f, f, spb * 1.8, 0.5, 'triangle', at, 0, 0.008); }
    const chord = [0, minor ? 3 : 4, 7, 12];
    if (s16 % 2 === 0) { const f = hz(root + 12 + chord[(s16 / 2) % 4]); tone(f, f, spb * 1.2, 0.06, 'square', at, 0, 0.008); }
    const mIdx = step % 64, m = this.melody[Math.floor(mIdx / 2) % this.melody.length];
    if (mIdx % 2 === 0 && m >= 0) { const f = hz(72 + m); tone(f, f, spb * 1.7, 0.05, 'square', at, 0, 0.008); }
  },
};
