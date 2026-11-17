import Phaser from 'phaser';
import { generateTextures } from '../core/textures';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    generateTextures(this);
    const go = () => {
      this.scene.start('Match', { mode: 'attract' });
      this.scene.launch('Menu');
    };
    // espera a la fuente (si está disponible) para que los textos salgan bien
    const fonts = (document as any).fonts;
    if (fonts?.load) Promise.race([fonts.load('32px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    else go();
  }
}
