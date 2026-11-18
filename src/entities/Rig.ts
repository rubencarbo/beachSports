import Phaser from 'phaser';

/**
 * Personaje "recortable" (cut-out) animado por esqueleto a partir de piezas de arte
 * (importadas con art/tools/ingest_parts.py).
 *
 * Animación basada en el vídeo de referencia:
 *  - guardia agachada con la pala delante y botecitos continuos,
 *  - carrera con rebote, rodillas altas y cadencia ligada a la velocidad (los pies no patinan),
 *  - golpes en 4 fases: preparación rápida -> LATIGAZO casi instantáneo -> gesto final sostenido -> recuperación,
 *  - salto: agachado previo, estiramiento al subir, piernas recogidas arriba, aplastamiento al caer,
 *  - movimiento secundario: mechón de pelo con muelle, rebote de la pala tras el golpe.
 */

import { ANIM, POSES, Pose, RigData, RigFrame, RigInput, headFrame, layoutParts, lerpPose, partOrder, partOrigin, rigAnchors, targetPose } from './poses';
export * from './poses';

export function registerRigFrames(scene: Phaser.Scene, key: string, data: RigData) {
  const tex = scene.textures.get(key);
  for (const [name, f] of Object.entries(data.frames)) if (!tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

// ------------------------------------------------------------------------------- rig
export class Rig {
  container: Phaser.GameObjects.Container;
  private parts: Record<string, Phaser.GameObjects.Image> = {};
  private cur: Pose = { ...POSES.ready };
  private F: Record<string, RigFrame>;
  height: number;

  private hk = 1;
  private lk = 1;

  noPaddle = false;

  constructor(scene: Phaser.Scene, key: string, data: RigData, opts: { noPaddle?: boolean } = {}) {
    this.noPaddle = !!opts.noPaddle;
    this.hk = data.scale?.head ?? 1;
    this.lk = data.scale?.leg ?? 1;
    this.F = data.frames;
    this.height = data.frames.full?.h ?? 120;
    this.container = scene.add.container(0, 0);
    for (const [name, frame, back] of partOrder(this.F)) {
      const o = partOrigin(this.F, name, frame);
      const im = scene.add.image(0, 0, key, frame).setOrigin(o[0], o[1]);
      if (back) im.setTint(0xb8b2c8);
      this.parts[name] = im;
      this.container.add(im);
    }
    if (this.noPaddle) this.parts.paddle.setVisible(false);
    // el antebrazo con pala se recorta en la muñeca (la mano la pone la pieza de la pala)
    const fa = this.F.forearm;
    if (this.F.paddlehand) this.parts.foreF.setCrop(0, 0, fa.w, Math.round(fa.h * 0.66));
    this.setHead('head');
  }

  /** Anclajes anatómicos dentro de cada pieza (px de arte), medidos sobre la hoja importada. */
  private get A() { return rigAnchors(this.F); }

  private setHead(frame: string) {
    const P_ = this.parts.head;
    if (!this.F[frame]) frame = 'head';
    if (P_.frame.name === frame && P_.getData('ok')) return;
    P_.setData('ok', true);
    const hf = this.F[frame];
    P_.setFrame(frame).setOrigin(hf.bot[0] / hf.w, hf.bot[1] / hf.h).setScale(ANIM.headScale * this.hk);
  }

  update(dt: number, s: RigInput) {
    const { pose, rate, snap } = targetPose(s, this.noPaddle);
    const k = snap ? 1 : 1 - Math.exp(-dt * rate);
    this.cur = lerpPose(this.cur, pose, k);
    this.setHead(headFrame(this.F, s));
    this.layout(this.cur);
  }

  private layout(p: Pose) {
    const xf = layoutParts(this.F, p, this.hk, this.lk);
    for (const [name, im] of Object.entries(this.parts)) {
      const t = xf[name];
      if (!t) continue;
      im.setPosition(t.x, t.y).setRotation(t.rot);
      if (name === 'head') im.setScale(t.sy); else im.setScale(1, t.sy);
    }
  }

  destroy() { this.container.destroy(); }
}
