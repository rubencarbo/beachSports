import Phaser from 'phaser';
import type { Theme } from '../entities/Ball';
import { PIXEL_FONT } from '../core/fonts';

const THEME_TINTS: Record<Theme, number[]> = {
  sun: [0xffe680, 0xffa020, 0xff6a00, 0xe03000],
  wave: [0xb0f6ff, 0x40d8f0, 0x10a8e0, 0x0a6fc0],
};

/** Partículas y efectos de golpe, especiales, explosiones y textos flotantes. */
export class Effects {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private sand: Phaser.GameObjects.Particles.ParticleEmitter;
  private boom: Record<Theme, Phaser.GameObjects.Particles.ParticleEmitter>;
  private trail: Record<Theme, Phaser.GameObjects.Particles.ParticleEmitter>;
  private aura: Record<Theme, Phaser.GameObjects.Particles.ParticleEmitter>;
  private all: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(private scene: Phaser.Scene) {
    const s = scene;
    this.sparks = s.add.particles(0, 0, 'star', {
      speed: { min: 120, max: 380 }, lifespan: 320, scale: { start: 0.6, end: 0 }, rotate: { min: 0, max: 360 },
      blendMode: 'ADD', emitting: false, tint: [0xffffff, 0xfff4a0],
    }).setDepth(300);
    this.sand = s.add.particles(0, 0, 'sandgrain', {
      speed: { min: 60, max: 260 }, angle: { min: 200, max: 340 }, gravityY: 900, lifespan: 600,
      scale: { start: 1.2, end: 0.4 }, alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(260);
    this.boom = {} as any; this.trail = {} as any; this.aura = {} as any;
    for (const th of ['sun', 'wave'] as Theme[]) {
      const tint = THEME_TINTS[th];
      this.boom[th] = s.add.particles(0, 0, th === 'sun' ? 'flame' : 'soft', {
        speed: { min: 150, max: 650 }, lifespan: { min: 350, max: 800 }, scale: { start: 2.2, end: 0 },
        alpha: { start: 0.95, end: 0 }, rotate: { min: 0, max: 360 }, emitting: false, tint,
      }).setDepth(290);
      this.trail[th] = s.add.particles(0, 0, th === 'sun' ? 'flame' : 'soft', {
        speed: { min: 10, max: 60 }, lifespan: 380, scale: { start: 1.1, end: 0 }, alpha: { start: 0.9, end: 0 },
        rotate: { min: -30, max: 30 }, frequency: 14, quantity: 2, emitting: false, tint,
      }).setDepth(245);
      this.aura[th] = s.add.particles(0, 0, th === 'sun' ? 'flame' : 'soft', {
        speedY: { min: -220, max: -80 }, speedX: { min: -50, max: 50 }, lifespan: 500,
        scale: { start: 0.8, end: 0 }, alpha: { start: 0.8, end: 0 },
        frequency: 30, quantity: 1, emitting: false, tint,
        emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, -50, 38) as any },
      }).setDepth(235);
    }
    this.all = [this.sparks, this.sand, ...Object.values(this.boom), ...Object.values(this.trail), ...Object.values(this.aura)];
  }

  setTimeScale(ts: number) { for (const e of this.all) e.timeScale = ts; }

  hitSpark(x: number, y: number, big = false) {
    this.sparks.explode(big ? 16 : 7, x, y);
    const st = this.scene.add.image(x, y, 'star').setDepth(301).setBlendMode('ADD').setScale(0.4);
    this.scene.tweens.add({ targets: st, scale: big ? 3 : 1.6, alpha: 0, angle: 45, duration: big ? 300 : 180, onComplete: () => st.destroy() });
  }

  sandPuff(x: number, y: number, n = 10) { this.sand.explode(n, x, y); }

  startTrail(th: Theme, follow: Phaser.GameObjects.Image) {
    this.trail[th].startFollow(follow);
    this.trail[th].start();
  }
  stopTrails() { for (const t of Object.values(this.trail)) { t.stop(); t.stopFollow(); } }

  startAura(th: Theme, x: number, y: number) { this.aura[th].setPosition(x, y); this.aura[th].start(); }
  moveAura(th: Theme, x: number, y: number, scale: number) { this.aura[th].setPosition(x, y).setScale(scale); }
  stopAura(th: Theme) { this.aura[th].stop(); }

  /** Remolino de poder alrededor del jugador al activar el especial. */
  powerBurst(th: Theme, x: number, y: number) {
    const tint = THEME_TINTS[th];
    for (let i = 0; i < 3; i++) {
      const r = this.scene.add.image(x, y - 50, 'ring').setDepth(302).setBlendMode('ADD').setTint(tint[i + 1]).setScale(0.2).setAlpha(1);
      this.scene.tweens.add({ targets: r, scale: 2.4 + i * 0.6, alpha: 0, duration: 450 + i * 120, delay: i * 70, ease: 'Cubic.Out', onComplete: () => r.destroy() });
    }
    this.boom[th].explode(14, x, y - 50);
  }

  explosion(th: Theme, x: number, y: number) {
    this.boom[th].explode(40, x, y);
    this.sand.explode(40, x, y);
    const tint = THEME_TINTS[th];
    const ring = this.scene.add.image(x, y, 'ring').setDepth(292).setBlendMode('ADD').setTint(tint[1]).setScale(0.3, 0.12);
    this.scene.tweens.add({ targets: ring, scaleX: 5, scaleY: 1.6, alpha: 0, duration: 600, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    const glow = this.scene.add.image(x, y - 20, 'soft').setDepth(291).setBlendMode('ADD').setTint(tint[2]).setScale(1).setAlpha(0.55);
    this.scene.tweens.add({ targets: glow, scale: 6, alpha: 0, duration: 500, onComplete: () => glow.destroy() });
  }

  private decals: Phaser.GameObjects.Image[] = [];
  /** Huellas y marcas en la arena: se desvanecen en unos segundos (máximo 60 a la vez). */
  decal(key: string, x: number, y: number, k: number, flip: boolean) {
    let d = this.decals.length >= 60 ? this.decals.shift()! : this.scene.add.image(0, 0, key).setDepth(12);
    this.scene.tweens.killTweensOf(d);
    d.setTexture(key).setPosition(x, y).setScale(k).setFlipX(flip).setAlpha(0.9).setVisible(true);
    this.decals.push(d);
    this.scene.tweens.add({ targets: d, alpha: 0, delay: 2500, duration: 3500 });
  }

  /** Estela del golpe (arco blanco muy rápido) para vender el latigazo. */
  swoosh(x: number, y: number, facing: number, over: boolean, k: number, theme: Theme | null) {
    const g = this.scene.add.graphics().setDepth(255).setBlendMode('ADD');
    const r = 52 * k;
    const [a0, a1] = over ? [-2.6, 0.9] : [2.4, -0.9]; // ángulos (mirando a la derecha)
    const steps = 10;
    const col = theme ? THEME_TINTS[theme][1] : 0xffffff;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const aa = a0 + (a1 - a0) * t0, bb = a0 + (a1 - a0) * t1;
      g.lineStyle((3 + 9 * t1) * k, col, 0.15 + 0.6 * t1);
      g.lineBetween(x + facing * Math.cos(aa) * r, y + Math.sin(aa) * r, x + facing * Math.cos(bb) * r, y + Math.sin(bb) * r);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  floatText(x: number, y: number, text: string, color = '#ffffff', size = 34) {
    const wv = this.scene.cameras.main.worldView;
    const half = Math.min(wv.width * 0.3, text.length * size * 0.32);
    if (wv.width > 0) x = Phaser.Math.Clamp(x, wv.x + half, wv.right - half);
    const t = this.scene.add.text(x, y, text, {
      fontFamily: PIXEL_FONT, fontSize: `${Math.round(size * 0.6)}px`, color,
      stroke: '#1a1020', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(700).setScale(0.3);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
  }
}
