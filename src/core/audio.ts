// Efectos de sonido y música sintetizados con WebAudio (sin ficheros). Se desbloquea con el primer toque (iOS).
import { getSettings, onSettings } from './settings';

class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx!.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx!.destination);
      const len = this.ctx!.sampleRate * 2;
      this.noiseBuf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.sfxBus = this.ctx!.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx!.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);
      this.ambient();
      this.applySettings();
      onSettings(() => this.applySettings());
      this.startMusic();
    }
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
  }

  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;

  private applySettings() {
    const st = getSettings();
    if (this.sfxBus) this.sfxBus.gain.value = st.sound ? 1 : 0;
    if (this.musicBus) this.musicBus.gain.value = st.music ? 0.16 : 0;
  }

  // ------------------------------------------------------------ música chiptune procedural
  // Progresión I–V–vi–IV en Do mayor, 118 ppm, 16 pasos por compás: bajo (triángulo),
  // arpegio de acordes (cuadrada suave), melodía pentatónica (pulso) y batería de ruido.
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private melody: number[] = [];

  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    // melodía generada una vez (16 compases), pentatónica con frases que se repiten
    const penta = [0, 2, 4, 7, 9, 12, 14, 16];
    const phrase = () => Array.from({ length: 16 }, (_, i) => (i % 4 === 3 || Math.random() < 0.25 ? -1 : penta[Math.floor(Math.random() * penta.length)]));
    const a = phrase(), b = phrase();
    this.melody = [...a, ...b, ...a, ...phrase()];
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    if (!this.ctx) return;
    const spb = 60 / 118 / 4; // semicorcheas
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, bus: GainNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat') {
    const ctx = this.ctx!, bus = this.musicBus!;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(bus); o.start(t); o.stop(t + 0.2);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain();
    const v = kind === 'hat' ? 0.18 : 0.45, d = kind === 'hat' ? 0.04 : 0.14;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random()); src.stop(t + d + 0.02);
  }

  private playStep(step: number, t: number, spb: number) {
    const bus = this.musicBus!;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const roots = [48, 43, 45, 41]; // Do, Sol, La, Fa (MIDI)
    const minor = bar === 2;
    const root = roots[bar];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    // batería
    if (s16 % 8 === 0) this.drum(t, 'kick');
    if (s16 === 4 || s16 === 12) this.drum(t, 'snare');
    if (s16 % 2 === 0) this.drum(t, 'hat');
    // bajo
    if ([0, 3, 6, 8, 11, 14].includes(s16)) this.note(hz(root - 12 + (s16 === 6 || s16 === 14 ? 12 : 0)), t, spb * 1.8, 'triangle', 0.5, bus);
    // arpegio de acorde
    const chord = [0, minor ? 3 : 4, 7, 12];
    if (s16 % 2 === 0) this.note(hz(root + 12 + chord[(s16 / 2) % 4]), t, spb * 1.2, 'square', 0.06, bus);
    // melodía (frases de 16 compases)
    const mIdx = step % 64;
    const m = this.melody[Math.floor(mIdx / 2) % this.melody.length];
    if (mIdx % 2 === 0 && m >= 0) this.note(hz(72 + m), t, spb * 1.7, 'square', 0.05, bus);
  }

  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, attack = 0.005, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus ?? this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, freq2: number, dur: number, vol: number, type: OscillatorType = 'sine', when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hit(power = 0.5) {
    this.tone(520 + power * 200, 180, 0.09, 0.5);
    this.noise(0.06, 'bandpass', 2400, 900, 0.4 + power * 0.3);
  }
  whoosh() { this.noise(0.3, 'bandpass', 600, 2400, 0.25, 0.08); }
  jump() { this.noise(0.15, 'lowpass', 900, 200, 0.2); }
  land() { this.noise(0.12, 'lowpass', 500, 120, 0.25); }
  powerUp() {
    this.tone(200, 900, 0.5, 0.25, 'sawtooth');
    this.noise(0.7, 'bandpass', 300, 3000, 0.3, 0.2);
  }
  fireShot() {
    this.tone(160, 50, 0.5, 0.6, 'square');
    this.noise(0.9, 'lowpass', 3000, 200, 0.6);
  }
  explosion() {
    this.tone(90, 30, 0.7, 0.8);
    this.noise(1.2, 'lowpass', 2500, 80, 0.9, 0.003);
  }
  netHit() { this.noise(0.2, 'lowpass', 700, 150, 0.4); }
  bounce() { this.noise(0.1, 'lowpass', 400, 100, 0.35); }
  whistle() { this.tone(2100, 2000, 0.35, 0.18, 'triangle'); }
  cheer(intensity = 1) {
    // ola de público: varias capas de ruido filtrado
    for (let i = 0; i < 3; i++) this.noise(1.6 + intensity, 'bandpass', 900 + i * 500, 700 + i * 300, 0.12 * intensity, 0.25, i * 0.05);
  }
  flip() { this.noise(0.05, 'highpass', 3000, 2000, 0.3); }
  ui() { this.tone(880, 660, 0.08, 0.2, 'triangle'); }

  private ambient() {
    // olas: ruido muy filtrado con LFO lento
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lg = this.ctx.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(this.sfxBus ?? this.master!);
    src.start(); lfo.start();
    // murmullo continuo del público
    const crowd = this.ctx.createBufferSource();
    crowd.buffer = this.noiseBuf; crowd.loop = true;
    const cf = this.ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 650; cf.Q.value = 0.8;
    const cg = this.ctx.createGain(); cg.gain.value = 0.035;
    crowd.connect(cf).connect(cg).connect(this.sfxBus ?? this.master!);
    crowd.start(0, 0.7);
  }
}

export const sfx = new Sfx();
