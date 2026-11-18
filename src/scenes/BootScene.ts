import Phaser from 'phaser';
import { generateTextures } from '../core/textures';
import { bakeCrowd } from '../core/characters';

import plateUrl from '../assets/plate.png';
import refStripUrl from '../assets/ref_strip.jpg';
import rigSunUrl from '../assets/rig_sun.png';
import rigWaveUrl from '../assets/rig_wave.png';
import rigSunJson from '../assets/rig_sun.json';
import rigWaveJson from '../assets/rig_wave.json';
import crowdUrl from '../assets/crowd.png';
import crowdJson from '../assets/crowd.json';
import { RigData, registerRigFrames } from '../entities/Rig';
import { buildRoster } from '../game/roster';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('plate', plateUrl);
    this.load.image('ref_strip', refStripUrl);
    this.load.image('rig_sun', rigSunUrl);
    this.load.image('rig_wave', rigWaveUrl);
    this.load.image('crowd', crowdUrl);
  }
  create() {
    generateTextures(this);
    bakeCrowd(this);
    registerRigFrames(this, 'rig_sun', rigSunJson as unknown as RigData);
    registerRigFrames(this, 'rig_wave', rigWaveJson as unknown as RigData);
    registerRigFrames(this, 'crowd', crowdJson as unknown as RigData);
    const go0 = () => {
      if (location.hash === '#lab') { this.scene.start('Lab'); return; }
      this.scene.start('Match', { mode: 'attract' });
      this.scene.launch('Menu');
    };
    // espera a la fuente (si está disponible) para que los textos salgan bien
    const fonts = (document as any).fonts;
    const go = () => { buildRoster(this).then(go0, go0); };
    if (fonts?.load) Promise.race([Promise.all([fonts.load('16px "Press Start 2P"'), fonts.load('bold 16px "Pixelify Sans"')]), new Promise((r) => setTimeout(r, 2000))]).then(go, go);
    else go();
  }
}
