import Phaser from 'phaser';

/**
 * Post-proceso "16 bits": cuantiza la imagen a una rejilla de píxeles grandes (muestreo nearest
 * en el centro de cada bloque) y reduce el color a 15 bits (5 bits por canal, como la SNES).
 * Así fondo, sprites, partículas y líneas comparten la misma rejilla de píxel.
 */
const frag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uRes;
uniform float uBlock;
varying vec2 outTexCoord;
void main() {
  vec2 px = outTexCoord * uRes;
  vec2 c = (floor(px / uBlock) + 0.5) * uBlock;
  vec4 col = texture2D(uMainSampler, c / uRes);
  col.rgb = floor(col.rgb * 31.0 + 0.5) / 31.0;
  gl_FragColor = col;
}`;

export class RetroPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  block = 3;
  constructor(game: Phaser.Game) {
    super({ game, name: 'RetroPipeline', fragShader: frag });
  }
  onPreRender() {
    this.set2f('uRes', this.renderer.width, this.renderer.height);
    this.set1f('uBlock', this.block);
  }
}

/** Aplica el filtro retro a una cámara con un tamaño de bloque acorde a la altura del canvas. */
export function applyRetro(cam: Phaser.Cameras.Scene2D.Camera, rows: number) {
  const scene = cam.scene;
  if (!(scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  cam.setPostPipeline(RetroPipeline);
  const pipe = cam.getPostPipeline(RetroPipeline) as RetroPipeline;
  const scale = scene.scale;
  const update = () => { pipe.block = Math.max(1, Math.round(scale.height / rows)); };
  update();
  scale.on('resize', update);
  scene.events.once('shutdown', () => scale.off('resize', update));
}
