// Efectos de sonido sintetizados con WebAudio (sin ficheros). Se desbloquea con el primer toque (iOS).
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
      this.ambient();
    }
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
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
    src.connect(f).connect(g).connect(this.master!);
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
    o.connect(g).connect(this.master!);
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
    src.connect(f).connect(g).connect(this.master!);
    src.start(); lfo.start();
  }
}

export const sfx = new Sfx();
