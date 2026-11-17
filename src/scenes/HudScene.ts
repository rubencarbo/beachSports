import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { playerInput } from '../core/input';
import { applyRetro } from '../fx/RetroPipeline';

import { PIXEL_FONT as FONT } from '../core/fonts';

interface Btn { c: Phaser.GameObjects.Container; r: number; key: 'hit' | 'jump' | 'special'; ring: Phaser.GameObjects.Arc; pid: number }

/** Interfaz: marcador, barras de especial, controles táctiles y marcador gigante de punto. */
export class HudScene extends Phaser.Scene {
  private scoreA!: Phaser.GameObjects.Text;
  private scoreB!: Phaser.GameObjects.Text;
  private names!: Phaser.GameObjects.Text[];
  private meterA!: Phaser.GameObjects.Graphics;
  private meterB!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Container;
  private stick = { base: null as any as Phaser.GameObjects.Arc, knob: null as any as Phaser.GameObjects.Arc, pid: -1, ox: 0, oy: 0 };
  private btns: Btn[] = [];
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hint!: Phaser.GameObjects.Text;
  private overPanel?: Phaser.GameObjects.Container;
  private last = { a: 0, b: 0 };
  private meterVals = { a: 0, b: 0, pa: false, pb: false };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = false;
  private faces: { img: Phaser.GameObjects.Image; base: number; until: number }[] = [];

  constructor() { super('Hud'); }

  create() {
    this.touch = this.sys.game.device.input.touch;
    this.input.addPointer(3);
    this.buildTop();
    this.buildControls();
    this.confetti = this.add.particles(0, 0, 'square', {
      speed: { min: 200, max: 520 }, angle: { min: 200, max: 340 }, gravityY: 520, lifespan: 2200,
      rotate: { start: 0, end: 720 }, scaleX: { start: 1.2, end: 0.4 }, scaleY: { min: 0.5, max: 1.4 },
      tint: [0xff5a5a, 0xffd23f, 0x3ab0ff, 0x7bd389, 0xff9f1c, 0xc77dff, 0xffffff], emitting: false,
    }).setDepth(50);
    this.hint = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#1d2a3a', strokeThickness: 4 }).setOrigin(0.5).setDepth(40);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,SPACE,SHIFT') as any;
    kb.on('keydown-J', () => { sfx.unlock(); playerInput.pressHit(); });
    kb.on('keydown-SPACE', () => { sfx.unlock(); playerInput.pressHit(); });
    kb.on('keydown-K', () => playerInput.pressJump());
    kb.on('keydown-L', () => playerInput.pressSpecial());
    kb.on('keydown-SHIFT', () => playerInput.pressSpecial());

    const ev = this.game.events;
    const onHud = (d: any) => this.onHud(d);
    const onPoint = (d: any) => this.onPoint(d);
    const onOver = (d: any) => this.onOver(d);
    const onFace = (d: { side: number; expr: number; dur: number }) => this.setFace(d.side, d.expr, d.dur);
    ev.on('hud', onHud); ev.on('point', onPoint); ev.on('match-over', onOver); ev.on('face', onFace);
    this.events.once('shutdown', () => { ev.off('hud', onHud); ev.off('point', onPoint); ev.off('match-over', onOver); ev.off('face', onFace); });
    applyRetro(this.cameras.main, 360);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();
  }

  // ------------------------------------------------------------ construcción
  private buildTop() {
    const c = this.add.container(0, 0).setDepth(20);
    const bg = this.add.graphics();
    bg.fillStyle(0x1d2a3a, 0.82).fillRoundedRect(-170, 0, 340, 58, 14);
    bg.fillStyle(0xff8a1f, 1).fillRoundedRect(-166, 4, 120, 50, 11);
    bg.fillStyle(0x25c4c4, 1).fillRoundedRect(46, 4, 120, 50, 11);
    c.add(bg);
    this.names = [
      this.add.text(-106, 30, 'TU', { fontFamily: FONT, fontSize: '12px', color: '#fff', stroke: '#7a3a00', strokeThickness: 4 }).setOrigin(0.5),
      this.add.text(106, 30, 'CPU', { fontFamily: FONT, fontSize: '12px', color: '#fff', stroke: '#0b4a5a', strokeThickness: 4 }).setOrigin(0.5),
    ];
    this.scoreA = this.add.text(-22, 30, '0', { fontFamily: FONT, fontSize: '24px', color: '#ffd29a' }).setOrigin(0.5);
    this.scoreB = this.add.text(22, 30, '0', { fontFamily: FONT, fontSize: '24px', color: '#9af5f5' }).setOrigin(0.5);
    const dash = this.add.text(0, 28, '-', { fontFamily: FONT, fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    this.meterA = this.add.graphics();
    this.meterB = this.add.graphics();
    c.add([...this.names, this.scoreA, this.scoreB, dash, this.meterA, this.meterB]);
    // retratos (caras del usuario: 0 normal, 1 esfuerzo, 2 risa, 3 grito, 4 sorpresa, 5 agotado)
    for (const [i, key, x] of [[0, 'faces_sun', -214], [1, 'faces_wave', 214]] as [number, string, number][]) {
      const frame = this.add.graphics();
      frame.fillStyle(0x1d2a3a, 1).fillRect(x - 34, 2, 68, 74);
      frame.fillStyle(i === 0 ? 0xff8a1f : 0x25c4c4, 1).fillRect(x - 31, 5, 62, 68);
      frame.fillStyle(0x7fc4ec, 1).fillRect(x - 28, 8, 56, 62);
      const img = this.add.image(x, 72, key, 0).setOrigin(0.5, 1).setScale(1.35).setFlipX(i === 0);
      const mask = this.add.graphics().setVisible(false);
      c.add([frame, img]);
      this.faces.push({ img, base: 0, until: 0 });
      void mask;
    }
    this.panel = c;

    const menu = this.add.text(0, 0, 'II', { fontFamily: FONT, fontSize: '16px', color: '#fff', backgroundColor: '#1d2a3acc', padding: { x: 12, y: 6 } })
      .setDepth(30).setInteractive({ useHandCursor: true }).setName('menuBtn');
    menu.on('pointerdown', () => { sfx.ui(); this.backToMenu(); });
  }

  private drawMeters() {
    const draw = (g: Phaser.GameObjects.Graphics, x: number, v: number, col: number, powered: boolean) => {
      g.clear();
      g.fillStyle(0x1d2a3a, 0.85).fillRoundedRect(x, 62, 150, 14, 7);
      const full = v >= 1;
      const pulse = full || powered ? 0.6 + Math.sin(this.time.now * 0.012) * 0.4 : 1;
      g.fillStyle(full || powered ? 0xffffff : col, 1).fillRoundedRect(x + 2, 64, Math.max(4, 146 * Math.min(1, powered ? 1 : v)), 10, 5);
      if (full || powered) g.fillStyle(col, pulse).fillRoundedRect(x + 2, 64, 146, 10, 5);
    };
    draw(this.meterA, -166, this.meterVals.a, 0xff8a1f, this.meterVals.pa);
    draw(this.meterB, 16, this.meterVals.b, 0x25c4c4, this.meterVals.pb);
  }

  private makeBtn(key: Btn['key'], label: string, r: number, col: number) {
    const c = this.add.container(0, 0).setDepth(30);
    const ring = this.add.circle(0, 0, r + 6, 0xffffff, 0).setStrokeStyle(5, 0xffffff, 0.0);
    const base = this.add.circle(0, 0, r, col, 0.55).setStrokeStyle(4, 0xffffff, 0.8);
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.max(8, Math.round(r * 0.2))}px`, color: '#fff', stroke: '#1d2a3a', strokeThickness: 4 }).setOrigin(0.5);
    c.add([ring, base, t]);
    const b: Btn = { c, r, key, ring, pid: -1 };
    this.btns.push(b);
    return b;
  }

  private buildControls() {
    this.stick.base = this.add.circle(0, 0, 70, 0x1d2a3a, 0.35).setStrokeStyle(4, 0xffffff, 0.5).setDepth(30);
    this.stick.knob = this.add.circle(0, 0, 32, 0xffffff, 0.75).setDepth(31);
    this.makeBtn('hit', 'GOLPE', 64, 0xff8a1f);
    this.makeBtn('jump', 'SALTO', 44, 0x3a8fd6);
    this.makeBtn('special', '★', 46, 0xe0322a);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      const w = this.scale.width;
      for (const b of this.btns) {
        if (Phaser.Math.Distance.Between(p.x, p.y, b.c.x, b.c.y) < b.r + 18) {
          b.pid = p.id;
          b.c.setScale(0.9);
          if (b.key === 'hit') playerInput.pressHit();
          if (b.key === 'jump') playerInput.pressJump();
          if (b.key === 'special') playerInput.pressSpecial();
          return;
        }
      }
      if (p.x < w * 0.5 && this.stick.pid < 0) {
        this.stick.pid = p.id;
        this.stick.ox = p.x; this.stick.oy = p.y;
        this.stick.base.setPosition(p.x, p.y);
        this.stick.knob.setPosition(p.x, p.y);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stick.pid) return;
      const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy;
      const len = Math.hypot(dx, dy), max = 62;
      const k = len > max ? max / len : 1;
      this.stick.knob.setPosition(this.stick.ox + dx * k, this.stick.oy + dy * k);
      const dead = 10;
      playerInput.mx = len < dead ? 0 : (dx * k) / max;
      playerInput.my = len < dead ? 0 : -(dy * k) / max;
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stick.pid) {
        this.stick.pid = -1;
        playerInput.mx = playerInput.my = 0;
        this.layoutStick();
      }
      for (const b of this.btns) if (b.pid === p.id) { b.pid = -1; b.c.setScale(1); if (b.key === 'hit') playerInput.releaseHit(); }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  private layoutStick() {
    const h = this.scale.height;
    this.stick.base.setPosition(140, h - 130);
    this.stick.knob.setPosition(140, h - 130);
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.panel.setPosition(w / 2, 10);
    (this.children.getByName('menuBtn') as Phaser.GameObjects.Text)?.setPosition(18, 14);
    this.layoutStick();
    const [hit, jump, special] = this.btns;
    hit.c.setPosition(w - 120, h - 118);
    jump.c.setPosition(w - 262, h - 74);
    special.c.setPosition(w - 238, h - 210);
    this.hint.setPosition(w / 2, h - 60);
    const show = this.touch;
    this.stick.base.setVisible(show); this.stick.knob.setVisible(show);
    for (const b of this.btns) b.c.setVisible(show);
    if (!show) this.hint.setText('Mover: WASD/flechas · Golpe: J/Espacio · Salto: K · Especial: L');
  }

  private setFace(side: number, expr: number, dur: number) {
    const f = this.faces[side === -1 ? 0 : 1];
    if (!f) return;
    f.img.setFrame(expr);
    f.until = this.time.now + dur * 1000;
    this.tweens.add({ targets: f.img, y: 66, duration: 70, yoyo: true });
  }

  // ------------------------------------------------------------ eventos
  private onHud(d: any) {
    this.meterVals = { a: d.meterA, b: d.meterB, pa: d.poweredA, pb: d.poweredB };
    this.names[0].setText(d.names[0]);
    this.names[1].setText(d.names[1]);
    if (this.touch) this.hint.setText(d.serving ? 'Pulsa GOLPE para sacar' : '');
    else if (d.serving) this.hint.setText('Pulsa J / Espacio para sacar  ·  K salto  ·  L especial');
    else this.hint.setText('');
  }

  private onPoint(d: { score: { a: number; b: number }; winner: number }) {
    const w = this.scale.width;
    sfx.flip();
    // marcador gigante con cartones que giran (como en el vídeo)
    const prev = { ...this.last };
    this.last = { ...d.score };
    const board = this.add.container(w / 2, -120).setDepth(45);
    const g = this.add.graphics();
    g.fillStyle(0x6b4a2b, 1).fillRoundedRect(-150, -80, 300, 160, 16);
    g.lineStyle(6, 0x3e2a17, 1).strokeRoundedRect(-150, -80, 300, 160, 16);
    g.fillStyle(0x2a2a2a, 1).fillRect(-6, -60, 12, 120);
    board.add(g);
    const card = (x: number, from: number, to: number, col: string, changed: boolean) => {
      const bgc = this.add.rectangle(x, 0, 116, 128, 0xf5ecd8).setStrokeStyle(3, 0x3e2a17);
      const t = this.add.text(x, 0, String(from), { fontFamily: FONT, fontSize: '60px', color: col }).setOrigin(0.5);
      board.add([bgc, t]);
      if (changed) {
        this.tweens.add({
          targets: [bgc, t], scaleY: 0, duration: 140, delay: 450, yoyo: true,
          onYoyo: () => { t.setText(String(to)); sfx.flip(); },
        });
      } else t.setText(String(to));
    };
    card(-72, prev.a, d.score.a, '#e0611a', prev.a !== d.score.a);
    card(72, prev.b, d.score.b, '#14858c', prev.b !== d.score.b);
    this.tweens.add({ targets: board, y: 150, duration: 380, ease: 'Back.Out' });
    this.tweens.add({ targets: board, y: -160, duration: 300, delay: 1700, ease: 'Cubic.In', onComplete: () => board.destroy() });
    this.time.delayedCall(560, () => {
      this.confetti.explode(70, w / 2 - 120, 160);
      this.confetti.explode(70, w / 2 + 120, 160);
    });
    this.time.delayedCall(700, () => {
      this.scoreA.setText(String(d.score.a));
      this.scoreB.setText(String(d.score.b));
      for (const t of [this.scoreA, this.scoreB]) this.tweens.add({ targets: t, scale: 1.5, duration: 120, yoyo: true });
    });
  }

  private onOver(d: { winner: number; score: { a: number; b: number }; mode: string }) {
    if (d.mode !== 'play') return;
    const w = this.scale.width, h = this.scale.height;
    const won = d.winner === -1;
    const c = this.add.container(w / 2, h / 2).setDepth(60).setScale(0.4).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x1d2a3a, 0.92).fillRoundedRect(-260, -150, 520, 300, 24);
    g.lineStyle(5, won ? 0xffc23a : 0x8aa0b8, 1).strokeRoundedRect(-260, -150, 520, 300, 24);
    c.add(g);
    c.add(this.add.text(0, -88, won ? '¡HAS GANADO!' : 'HAS PERDIDO', { fontFamily: FONT, fontSize: '32px', color: won ? '#ffd23f' : '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
    c.add(this.add.text(0, -18, `${d.score.a}  -  ${d.score.b}`, { fontFamily: FONT, fontSize: '28px', color: '#fff' }).setOrigin(0.5));
    const mk = (x: number, label: string, cb: () => void, col: string) => {
      const b = this.add.text(x, 80, label, { fontFamily: FONT, fontSize: '20px', color: '#fff', backgroundColor: col, padding: { x: 22, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.ui(); cb(); });
      c.add(b);
    };
    mk(-115, 'REVANCHA', () => { const m = this.scene.get('Match') as any; m.scene.restart(m.cfg); this.scene.restart(); }, '#ff8a1f');
    mk(115, 'MENU', () => this.backToMenu(), '#3a8fd6');
    this.overPanel = c;
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 400, ease: 'Back.Out' });
    if (won) this.time.addEvent({ delay: 400, repeat: 4, callback: () => this.confetti.explode(60, Phaser.Math.Between(100, w - 100), 80) });
  }

  private backToMenu() {
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'attract' });
    this.scene.launch('Menu');
    this.scene.stop();
  }

  update() {
    // teclado
    const k = this.keys;
    if (k) {
      const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const ky = (k.W.isDown || k.UP.isDown ? 1 : 0) - (k.S.isDown || k.DOWN.isDown ? 1 : 0);
      if (this.stick.pid < 0 && (kx || ky || !this.touch)) { playerInput.mx = kx; playerInput.my = ky; }
    }
    this.drawMeters();
    for (const f of this.faces) if (f.until && this.time.now > f.until) { f.until = 0; f.img.setFrame(f.base); }
    const sp = this.btns[2];
    if (sp) {
      const ready = this.meterVals.a >= 1 && !this.meterVals.pa;
      sp.ring.setStrokeStyle(5, 0xffd23f, ready ? 0.5 + Math.sin(this.time.now * 0.012) * 0.5 : 0);
      sp.c.setAlpha(ready || this.meterVals.pa ? 1 : 0.45);
    }
  }
}
