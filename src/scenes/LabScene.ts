import Phaser from 'phaser';
import { STAGE_CX, project } from '../config';
import { sfx } from '../core/audio';
import { PIXEL_FONT as FONT } from '../core/fonts';
import { Intent, MOVE, Player, SWING_TIMES } from '../entities/Player';
import { ANIM } from '../entities/Rig';

type Anim = 'guardia' | 'correr' | 'atras' | 'derecha' | 'remate' | 'saque' | 'salto' | 'celebrar' | 'lamento' | 'aturdida';

/**
 * Laboratorio de animación: las dos jugadoras a tamaño grande, en bucle, con cámara lenta,
 * pausa, avance por fotograma y parámetros ajustables en vivo. Arriba, fotogramas del vídeo de referencia.
 */
export class LabScene extends Phaser.Scene {
  private players: Player[] = [];
  private anim: Anim = 'guardia';
  private speed = 1;
  private paused = false;
  private stepOnce = false;
  private t = 0;
  private cycleT = 0;
  private ui!: Phaser.GameObjects.Container;
  private ref!: Phaser.GameObjects.Image;

  constructor() { super('Lab'); }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#8fd0f0');
    const ground = project(0, 0, 2);
    this.add.rectangle(STAGE_CX, ground.y + 200, 4000, 400, 0xf9d27a);
    this.add.rectangle(STAGE_CX, ground.y, 4000, 3, 0xd8a850);
    this.players = [new Player(this, -1, 'sun', 'SOL'), new Player(this, 1, 'wave', 'OLA')];
    this.players[0].x = -1.6; this.players[1].x = 1.6;
    for (const p of this.players) p.z = 2;
    cam.setZoom(2.4 * (this.scale.height / 720));
    cam.centerOn(STAGE_CX, ground.y - 90);
    this.ref = this.add.image(0, 0, 'ref_strip').setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
    this.buildUi();
    this.scale.on('resize', this.buildUi, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.buildUi, this));
  }

  private buildUi() {
    this.ui?.destroy();
    const w = this.scale.width, h = this.scale.height;
    const cam = this.cameras.main;
    cam.setZoom(2.4 * (h / 720));
    // la UI va en coordenadas de pantalla: se compensa el zoom de la cámara
    const z = cam.zoom;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(1000).setScale(1 / z);
    c.setPosition(cam.width / 2 - cam.width / 2 / z, cam.height / 2 - cam.height / 2 / z);
    this.ui = c;
    const btn = (x: number, y: number, t: string, active: boolean, cb: () => void, col = '#25a8a8') => {
      const b = this.add.text(x, y, t, { fontFamily: FONT, fontSize: '11px', color: '#fff', backgroundColor: active ? col : '#1d2a3acc', padding: { x: 8, y: 7 } })
        .setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.ui(); cb(); this.buildUi(); });
      c.add(b);
      return b;
    };
    const anims: Anim[] = ['guardia', 'correr', 'atras', 'derecha', 'remate', 'saque', 'salto', 'celebrar', 'lamento', 'aturdida'];
    anims.forEach((a, i) => btn(10 + (i % 5) * 112, 10 + Math.floor(i / 5) * 34, a.toUpperCase(), this.anim === a, () => { this.anim = a; this.cycleT = 0; this.resetPlayers(); }));
    // velocidad
    [1, 0.5, 0.25, 0.1].forEach((v, i) => btn(10 + i * 70, 84, `x${v}`, this.speed === v, () => { this.speed = v; }, '#ff8a1f'));
    btn(300, 84, this.paused ? 'SEGUIR' : 'PAUSA', this.paused, () => { this.paused = !this.paused; }, '#e0322a');
    btn(400, 84, 'PASO', false, () => { this.paused = true; this.stepOnce = true; });
    btn(w - 90, 10, 'MENU', false, () => { this.scene.start('Match', { mode: 'attract' }); this.scene.launch('Menu'); }, '#3a8fd6');
    btn(w - 210, 10, 'VIDEO', this.ref.visible, () => { this.ref.setVisible(!this.ref.visible); }, '#3a8fd6');

    // parámetros en vivo
    const params: [string, () => number, (v: number) => void, number, number][] = [
      ['CABEZA', () => ANIM.headScale, (v) => { ANIM.headScale = v; }, 0.8, 1.6],
      ['PIERNAS', () => ANIM.legScale, (v) => { ANIM.legScale = v; }, 0.6, 1.1],
      ['ZANCADA', () => ANIM.stride, (v) => { ANIM.stride = v; }, 1, 3],
      ['REBOTE', () => ANIM.runBob, (v) => { ANIM.runBob = v; }, 0, 8],
      ['INCLINAR', () => ANIM.runLean, (v) => { ANIM.runLean = v; }, 0, 0.8],
      ['LATIGAZO', () => SWING_TIMES.snap, (v) => { SWING_TIMES.snap = v; }, 0.02, 0.2],
      ['GESTO FINAL', () => SWING_TIMES.follow, (v) => { SWING_TIMES.follow = v; }, 0.05, 0.4],
      ['ACELERACION', () => MOVE.accel, (v) => { MOVE.accel = v; }, 20, 160],
    ];
    params.forEach(([name, get, set, min, max], i) => {
      const x = w - 250, y = 64 + i * 40;
      const val = this.add.text(x, y, '', { fontFamily: FONT, fontSize: '9px', color: '#fff', backgroundColor: '#1d2a3acc', padding: { x: 4, y: 3 } });
      const tx = x, tw = 230, ty = y + 22;
      const track = this.add.rectangle(tx, ty, tw, 6, 0x4a5a70).setOrigin(0, 0.5);
      const knob = this.add.rectangle(0, ty, 12, 18, 0xffd23f);
      const upd = () => { const v = get(); knob.x = tx + ((v - min) / (max - min)) * tw; val.setText(`${name}: ${v.toFixed(2)}`); };
      upd();
      const zone = this.add.rectangle(tx + tw / 2, ty, tw + 20, 26, 0, 0).setInteractive({ draggable: true });
      const apply = (p: Phaser.Input.Pointer) => {
        const lx = p.x; // la UI está en coordenadas de pantalla
        set(Phaser.Math.Clamp(min + ((lx - tx) / tw) * (max - min), min, max));
        upd();
      };
      zone.on('pointerdown', apply);
      zone.on('drag', apply);
      c.add([val, track, knob, zone]);
    });
    this.ref.setPosition(cam.width / 2, 120 / z + cam.height / 2 - cam.height / 2 / z).setScale(Math.min(1, (w * 0.6) / 1280) / z);
    c.add(this.add.text(10, h - 30, 'Laboratorio: compara con VIDEO, ajusta y dime los valores que te gustan', { fontFamily: FONT, fontSize: '9px', color: '#1d2a3a' }));
  }

  private resetPlayers() {
    for (const p of this.players) {
      p.x = p.side * 1.6; p.y = 0; p.vy = 0; p.vx = 0; p.vz = 0;
      p.stage = 'none'; p.stageT = 0; p.mood = 'none'; p.stunned = 0;
    }
  }

  update(time: number, delta: number) {
    let dt = Math.min(delta / 1000, 0.05) * this.speed;
    if (this.paused && !this.stepOnce) dt = 0;
    if (this.stepOnce) { dt = 1 / 60 * this.speed; this.stepOnce = false; }
    this.t += dt;
    this.cycleT += dt;
    const loop = 1.4;
    const ph = this.cycleT % loop;
    const fresh = this.cycleT - dt < Math.floor(this.cycleT / loop) * loop || this.cycleT < dt * 1.01;
    for (const p of this.players) {
      const it: Intent = { mx: 0, mz: 0, hit: false, jump: false, special: false };
      const x0 = p.side * 1.6;
      switch (this.anim) {
        case 'correr': it.mx = p.facing; break;
        case 'atras': it.mx = -p.facing * 0.7; break;
        case 'derecha':
          if (fresh) p.startSwing('fore');
          if (p.stage === 'windup' && p.stageT > 0.12) p.contact('fore');
          break;
        case 'remate':
          if (fresh) it.jump = true;
          if (p.airborne && p.vy < 2.5 && p.stage === 'none' && ph < 0.8) p.startSwing('over');
          if (p.stage === 'windup' && p.vy < 0.3) p.contact('over', true);
          break;
        case 'saque':
          if (fresh) p.startSwing('serve');
          if (p.stage === 'windup' && p.stageT > SWING_TIMES.serveWindup) p.contact('serve', true);
          break;
        case 'salto': if (fresh) it.jump = true; break;
        case 'celebrar': p.mood = 'happy'; p.moodT = 9; break;
        case 'lamento': p.mood = 'sad'; p.moodT = 9; break;
        case 'aturdida': p.stunned = 9; break;
      }
      p.update(dt, it, true);
      p.x = x0; // corre "en el sitio" (cinta de correr)
      p.events.length = 0;
      p.render(this.t * 1000);
    }
  }
}
