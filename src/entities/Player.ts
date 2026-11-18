import Phaser from 'phaser';
import { RIG_SCALE, depthFor, project } from '../config';
import { Rig } from './Rig';
import type { Side } from '../sports/types';
import type { CharDef } from '../game/roster';
import { PlayerCore } from './playerCore';
export * from './playerCore';

export class Player extends PlayerCore {
  rig: Rig;
  shadow: Phaser.GameObjects.Image;
  private lastT = 0;

  constructor(scene: Phaser.Scene, side: Side, char: CharDef, opts: { noPaddle?: boolean } = {}) {
    super(side, char);
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(98);
    this.rig = new Rig(scene, char.tex, char.data, opts);
  }

  render(time: number) {
    const p = project(this.x, this.y, this.z);
    const g0 = project(this.x, 0, this.z);
    const s = p.k * RIG_SCALE;
    const hs = Math.max(0.4, 1 - this.y * 0.25);
    this.shadow.setPosition(g0.x, g0.y).setScale(1.0 * p.k * hs, 0.9 * p.k * hs).setAlpha(0.9 * hs);
    const dt = this.lastT ? Math.min(0.05, (time - this.lastT) / 1000) : 0.016;
    this.lastT = time;
    this.rig.update(dt, this.rigInput(time / 1000));
    const sq = Phaser.Math.Clamp(this.sq, -0.3, 0.3);
    const hop = this.mood === 'happy' ? Math.abs(Math.sin(time * 0.011)) * 14 * p.k : 0;
    this.rig.container.setPosition(p.x, p.y - hop).setScale(s * this.facing * (1 - sq * 0.6), s * (1 + sq)).setDepth(depthFor(this.z));
  }

  destroy() { this.rig.destroy(); this.shadow.destroy(); }
}
