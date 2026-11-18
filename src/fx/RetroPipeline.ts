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

/**
 * Etalonaje "de vídeo" para la cámara del partido: luz cálida de playa, algo de contraste,
 * resplandor suave alrededor del sol y viñeta. Acerca el aspecto plano del juego al look
 * pintado y luminoso del vídeo de referencia.
 */
const gradeFrag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uSun;      // posición del sol en coordenadas de textura
uniform float uAspect;
uniform float uFlash;   // 0..1 destello extra (impactos)
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord;
  vec4 col = texture2D(uMainSampler, uv);
  vec3 c = col.rgb;
  // contraste suave + calidez
  c = (c - 0.5) * 1.07 + 0.5;
  c *= vec3(1.045, 1.0, 0.93);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.04);
  // resplandor del sol
  vec2 d = (uv - uSun) * vec2(uAspect, 1.0);
  float glow = smoothstep(0.75, 0.0, length(d));
  c += vec3(1.0, 0.9, 0.65) * glow * glow * 0.32;
  // viñeta
  vec2 q = (uv - 0.5) * vec2(1.0, 1.15);
  float v = smoothstep(0.85, 0.32, length(q));
  c *= mix(0.78, 1.0, v);
  c += uFlash * 0.25;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), col.a);
}`;

export class GradePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  sun: [number, number] = [0.3, 0.85];
  flash = 0;
  constructor(game: Phaser.Game) {
    super({ game, name: 'GradePipeline', fragShader: gradeFrag });
  }
  onPreRender() {
    this.set2f('uSun', this.sun[0], this.sun[1]);
    this.set1f('uAspect', this.renderer.width / this.renderer.height);
    this.set1f('uFlash', this.flash);
  }
}
