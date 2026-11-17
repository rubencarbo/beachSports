import Phaser from 'phaser';
import { generateTextures } from '../core/textures';
import { bakeAthletes, bakeCrowd } from '../core/characters';

import backdropUrl from '../assets/backdrop.png';
import facesSunUrl from '../assets/faces_sun.png';
import facesWaveUrl from '../assets/faces_wave.png';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('backdrop', backdropUrl);
    this.load.spritesheet('faces_sun', facesSunUrl, { frameWidth: 40, frameHeight: 46 });
    this.load.spritesheet('faces_wave', facesWaveUrl, { frameWidth: 40, frameHeight: 46 });
  }
  create() {
    generateTextures(this);
    bakeAthletes(this);
    bakeCrowd(this);
    const go = () => {
      this.scene.start('Match', { mode: 'attract' });
      this.scene.launch('Menu');
    };
    // espera a la fuente (si está disponible) para que los textos salgan bien
    const fonts = (document as any).fonts;
    if (fonts?.load) Promise.race([fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    else go();
  }
}
