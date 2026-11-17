import Phaser from 'phaser';
import { generateTextures } from '../core/textures';
import { bakeAthletes, bakeCrowd } from '../core/characters';

import backdropUrl from '../assets/backdrop.png';
import facesSunUrl from '../assets/faces_sun.png';
import facesWaveUrl from '../assets/faces_wave.png';
import rigSunUrl from '../assets/rig_sun.png';
import rigWaveUrl from '../assets/rig_wave.png';
import rigSunJson from '../assets/rig_sun.json';
import rigWaveJson from '../assets/rig_wave.json';
import { RigData, registerRigFrames } from '../entities/Rig';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('backdrop', backdropUrl);
    this.load.spritesheet('faces_sun', facesSunUrl, { frameWidth: 40, frameHeight: 46 });
    this.load.spritesheet('faces_wave', facesWaveUrl, { frameWidth: 40, frameHeight: 46 });
    this.load.image('rig_sun', rigSunUrl);
    this.load.image('rig_wave', rigWaveUrl);
  }
  create() {
    generateTextures(this);
    bakeAthletes(this);
    bakeCrowd(this);
    registerRigFrames(this, 'rig_sun', rigSunJson as unknown as RigData);
    registerRigFrames(this, 'rig_wave', rigWaveJson as unknown as RigData);
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
