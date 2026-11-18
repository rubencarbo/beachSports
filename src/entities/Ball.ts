import Phaser from 'phaser';
import { PPM, depthFor, project } from '../config';
import { BallPhysics } from './ballPhysics';
export * from './ballPhysics';

const TRAIL_COLORS: Record<string, number[]> = {
  normal: [0xffffff, 0xffffff],
  sun: [0xfff2a8, 0xff7a00],
  wave: [0xdffcff, 0x18c8e8],
};

export class Ball extends BallPhysics {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  trailG: Phaser.GameObjects.Graphics;
  comet: Phaser.GameObjects.Image;
  private trail: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene) {
    super();
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(99).setScale(0.45, 0.6);
    this.trailG = scene.add.graphics().setDepth(240).setBlendMode(Phaser.BlendModes.ADD);
    this.sprite = scene.add.image(0, 0, 'ball').setDepth(250).setScale(0.5);
    this.comet = scene.add.image(0, 0, 'comet_sun').setOrigin(0.08, 0.5).setDepth(249).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  protected onLaunch() { this.trail.length = 0; }

  render() {
    const p = project(this.x, this.y, this.z);
    const g = project(this.x, 0, this.z);
    this.sprite.setPosition(p.x, p.y).setScale(0.74 * p.k * this.size).setRotation(this.spin);
    this.sprite.setDepth(depthFor(this.z) + 0.5);
    const hScale = Math.max(0.3, 1 - this.y * 0.08);
    this.shadow.setPosition(g.x, g.y).setScale(0.7 * p.k * hScale, 0.75 * p.k * hScale).setAlpha(0.8 * hScale);

    // cometa de fuego/agua en el especial: orientado según la velocidad en pantalla
    if (this.kind === 'special' && this.live && !this.held && this.speed > 8) {
      const q = project(this.x + this.vx * 0.03, this.y + this.vy * 0.03, this.z + this.vz * 0.03);
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const fl = 0.9 + Math.random() * 0.25;
      this.comet.setTexture(this.theme === 'wave' ? 'comet_wave' : 'comet_sun').setVisible(true)
        .setPosition(p.x, p.y).setRotation(ang + Math.PI).setScale(1.25 * p.k * fl, 0.9 * p.k * (0.9 + Math.random() * 0.2));
    } else this.comet.setVisible(false);

    // estela: más larga y coloreada en golpes potentes
    const sp = this.speed;
    const fast = this.kind === 'special' || this.kind === 'smash' || this.kind === 'drive' || sp > 17;
    if (this.live && !this.held) this.trail.push({ x: p.x, y: p.y });
    const maxLen = this.kind === 'special' ? 16 : fast ? 10 : 5;
    while (this.trail.length > maxLen) this.trail.shift();
    this.trailG.clear();
    if (this.trail.length > 1 && sp > 6) {
      const cols = this.kind === 'special' || this.kind === 'smash' ? TRAIL_COLORS[this.theme] : TRAIL_COLORS.normal;
      const width = (this.kind === 'special' ? 30 : this.kind === 'smash' ? 17 : 9) * p.k;
      for (let i = 1; i < this.trail.length; i++) {
        const t = i / this.trail.length;
        const a = this.trail[i - 1], b = this.trail[i];
        this.trailG.lineStyle(width * t, cols[1], 0.55 * t);
        this.trailG.lineBetween(a.x, a.y, b.x, b.y);
        this.trailG.lineStyle(width * t * 0.45, cols[0], 0.8 * t);
        this.trailG.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  clearTrail() { this.trail.length = 0; this.trailG.clear(); }

  screenPos() { return project(this.x, this.y, this.z); }
  static pxPerM = PPM;
}
