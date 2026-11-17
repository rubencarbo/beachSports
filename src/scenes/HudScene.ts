import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { playerInput } from '../core/input';
import { applyRetro } from '../fx/RetroPipeline';

import { PIXEL_FONT as FONT } from '../core/fonts';
import { CtrlId, ctrlPos, getSettings, onSettings, updateSettings } from '../core/settings';

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
  private edit = false;
  private standalone = false;
  private editUi?: Phaser.GameObjects.Container;
  private drag: { id: CtrlId; pid: number; dx: number; dy: number } | null = null;
  private pauseUi?: Phaser.GameObjects.Container;

  constructor() { super('Hud'); }

  init(d: { edit?: boolean; standalone?: boolean }) {
    this.edit = !!d.edit;
    this.standalone = !!d.standalone;
    this.btns = []; this.faces = [];
    this.last = { a: 0, b: 0 };
  }

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
    const onEdit = () => this.setEdit(true);
    const onSettingsClosed = () => this.showPause();
    ev.on('hud', onHud); ev.on('point', onPoint); ev.on('match-over', onOver); ev.on('face', onFace);
    ev.on('hud-edit', onEdit); ev.on('hud-settings-closed', onSettingsClosed);
    const offSettings = onSettings(() => this.layout());
    this.events.once('shutdown', () => {
      ev.off('hud', onHud); ev.off('point', onPoint); ev.off('match-over', onOver); ev.off('face', onFace);
      ev.off('hud-edit', onEdit); ev.off('hud-settings-closed', onSettingsClosed); offSettings();
    });
    applyRetro(this.cameras.main, 360);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    if (this.standalone) { this.panel.setVisible(false); (this.children.getByName('menuBtn') as any)?.setVisible(false); }
    this.layout();
    if (this.edit) this.setEdit(true);
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
    // retratos: las cabezas de las jugadoras (0 normal, 1 esfuerzo, 2 risa, 3 grito, 4 sorpresa, 5 agotada)
    for (const [i, key, x] of [[0, 'rig_sun', -214], [1, 'rig_wave', 214]] as [number, string, number][]) {
      const frame = this.add.graphics();
      frame.fillStyle(0x1d2a3a, 1).fillRect(x - 34, 2, 68, 74);
      frame.fillStyle(i === 0 ? 0xff8a1f : 0x25c4c4, 1).fillRect(x - 31, 5, 62, 68);
      frame.fillStyle(0x7fc4ec, 1).fillRect(x - 28, 8, 56, 62);
      const img = this.add.image(x, 72, key, 'head').setOrigin(0.5, 1).setScale(1.85).setFlipX(i === 1);
      const mask = this.add.graphics().setVisible(false);
      c.add([frame, img]);
      this.faces.push({ img, base: 0, until: 0 });
      void mask;
    }
    this.panel = c;

    const menu = this.add.text(0, 0, 'II', { fontFamily: FONT, fontSize: '16px', color: '#fff', backgroundColor: '#1d2a3acc', padding: { x: 12, y: 6 } })
      .setDepth(30).setInteractive({ useHandCursor: true }).setName('menuBtn');
    menu.on('pointerdown', () => { sfx.ui(); this.showPause(); });
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
      const st = getSettings();
      if (this.edit) { this.startDrag(p); return; }
      if (this.pauseUi) return;
      for (const b of this.btns) {
        if (Phaser.Math.Distance.Between(p.x, p.y, b.c.x, b.c.y) < b.r * st.btnScale + 18) {
          b.pid = p.id;
          b.c.setScale(0.9);
          if (b.key === 'hit') playerInput.pressHit();
          if (b.key === 'jump') playerInput.pressJump();
          if (b.key === 'special') playerInput.pressSpecial();
          return;
        }
      }
      const home = ctrlPos('stick', w, this.scale.height);
      const onStickSide = st.leftHanded ? p.x > w * 0.5 : p.x < w * 0.5;
      const nearHome = Phaser.Math.Distance.Between(p.x, p.y, home.x, home.y) < 70 * st.stickScale * 1.7;
      if (this.stick.pid < 0 && (st.stickMode === 'floating' ? onStickSide : nearHome)) {
        this.stick.pid = p.id;
        if (st.stickMode === 'floating') { this.stick.ox = p.x; this.stick.oy = p.y; }
        else { this.stick.ox = home.x; this.stick.oy = home.y; }
        this.stick.base.setPosition(this.stick.ox, this.stick.oy);
        this.stick.knob.setPosition(this.stick.ox, this.stick.oy);
        this.moveStick(p);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.edit) { this.moveDrag(p); return; }
      if (p.id !== this.stick.pid) return;
      this.moveStick(p);
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (this.drag && this.drag.pid === p.id) this.endDrag();
      if (p.id === this.stick.pid) {
        this.stick.pid = -1;
        playerInput.mx = playerInput.my = 0;
        this.layoutStick();
      }
      for (const b of this.btns) if (b.pid === p.id) { b.pid = -1; b.c.setScale(getSettings().btnScale); if (b.key === 'hit') playerInput.releaseHit(); }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  private moveStick(p: Phaser.Input.Pointer) {
    {
      const sc = getSettings().stickScale;
      const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy;
      const len = Math.hypot(dx, dy), max = 62 * sc;
      const k = len > max ? max / len : 1;
      this.stick.knob.setPosition(this.stick.ox + dx * k, this.stick.oy + dy * k);
      const dead = 8 * sc;
      playerInput.mx = len < dead ? 0 : (dx * k) / max;
      playerInput.my = len < dead ? 0 : -(dy * k) / max;
    }
  }

  // ------------------------------------------------------------ modo "colocar controles"
  private ctrlObjects(): { id: CtrlId; x: number; y: number; r: number }[] {
    const st = getSettings();
    return [
      { id: 'stick', x: this.stick.base.x, y: this.stick.base.y, r: 70 * st.stickScale },
      ...this.btns.map((b) => ({ id: b.key as CtrlId, x: b.c.x, y: b.c.y, r: b.r * st.btnScale })),
    ];
  }

  private startDrag(p: Phaser.Input.Pointer) {
    const hit = this.ctrlObjects().find((c) => Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y) < c.r + 16);
    if (hit) this.drag = { id: hit.id, pid: p.id, dx: hit.x - p.x, dy: hit.y - p.y };
  }

  private moveDrag(p: Phaser.Input.Pointer) {
    if (!this.drag || this.drag.pid !== p.id) return;
    const w = this.scale.width, h = this.scale.height;
    const st = getSettings();
    let fx = Phaser.Math.Clamp((p.x + this.drag.dx) / w, 0.04, 0.96);
    const fy = Phaser.Math.Clamp((p.y + this.drag.dy) / h, 0.08, 0.95);
    if (st.leftHanded) fx = 1 - fx;
    updateSettings({ pos: { ...st.pos, [this.drag.id]: { x: fx, y: fy } } });
  }

  private endDrag() { this.drag = null; }

  private setEdit(on: boolean) {
    this.edit = on;
    this.pauseUi?.destroy(); this.pauseUi = undefined;
    this.editUi?.destroy(); this.editUi = undefined;
    if (on) {
      const w = this.scale.width;
      const c = this.add.container(0, 0).setDepth(80);
      const t = this.add.text(w / 2, 110, 'ARRASTRA LOS CONTROLES', { fontFamily: FONT, fontSize: '16px', color: '#ffd23f', stroke: '#1d2a3a', strokeThickness: 5 }).setOrigin(0.5);
      const done = this.add.text(w / 2, 160, 'LISTO', { fontFamily: FONT, fontSize: '16px', color: '#fff', backgroundColor: '#e0322a', padding: { x: 18, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      done.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation(); sfx.ui();
        this.setEdit(false);
        if (this.standalone) { this.scene.launch('Settings', { from: 'menu' }); this.scene.stop(); }
        else this.scene.launch('Settings', { from: 'hud' });
      });
      c.add([t, done]);
      this.editUi = c;
    }
    this.layout();
  }

  // ------------------------------------------------------------ pausa
  private showPause() {
    if (this.standalone) return;
    this.pauseUi?.destroy();
    if (this.scene.isActive('Match')) this.scene.pause('Match');
    const w = this.scale.width, h = this.scale.height;
    const c = this.add.container(0, 0).setDepth(90);
    const bg = this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.65).setOrigin(0).setInteractive();
    c.add(bg);
    c.add(this.add.text(w / 2, h * 0.25, 'PAUSA', { fontFamily: FONT, fontSize: '32px', color: '#ffd23f', stroke: '#1d2a3a', strokeThickness: 6 }).setOrigin(0.5));
    const items: [string, string, () => void][] = [
      ['CONTINUAR', '#25a8a8', () => { this.pauseUi?.destroy(); this.pauseUi = undefined; this.scene.resume('Match'); }],
      ['AJUSTES', '#ff8a1f', () => { this.pauseUi?.destroy(); this.pauseUi = undefined; this.scene.launch('Settings', { from: 'hud' }); this.scene.bringToTop('Settings'); }],
      ['MENU', '#3a8fd6', () => { this.scene.resume('Match'); this.backToMenu(); }],
    ];
    items.forEach(([t, col, cb], i) => {
      const b = this.add.text(w / 2, h * 0.42 + i * 62, t, { fontFamily: FONT, fontSize: '18px', color: '#fff', backgroundColor: col, padding: { x: 20, y: 12 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.ui(); cb(); });
      c.add(b);
    });
    this.pauseUi = c;
  }

  private layoutStick() {
    const p = ctrlPos('stick', this.scale.width, this.scale.height);
    const sc = getSettings().stickScale;
    this.stick.base.setPosition(p.x, p.y).setScale(sc);
    this.stick.knob.setPosition(p.x, p.y).setScale(sc);
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.panel.setPosition(w / 2, 10);
    (this.children.getByName('menuBtn') as Phaser.GameObjects.Text)?.setPosition(18, 14);
    const st = getSettings();
    if (this.stick.pid < 0) this.layoutStick();
    for (const b of this.btns) {
      const p = ctrlPos(b.key as CtrlId, w, h);
      b.c.setPosition(p.x, p.y).setScale(st.btnScale);
    }
    this.hint.setPosition(w / 2, h - 60);
    const show = this.touch || this.edit;
    const a = this.edit ? Math.max(0.6, st.opacity) : st.opacity;
    this.stick.base.setVisible(show).setAlpha(a); this.stick.knob.setVisible(show).setAlpha(a);
    for (const b of this.btns) b.c.setVisible(show).setAlpha(a);
    if (!this.touch && !this.edit) this.hint.setText('Mover: WASD/flechas · Golpe: J/Espacio · Salto: K · Especial: L');
  }

  private setFace(side: number, expr: number, dur: number) {
    const f = this.faces[side === -1 ? 0 : 1];
    if (!f) return;
    f.img.setFrame(['head', 'head_angry', 'head_happy', 'head_angry', 'head', 'head_sad'][expr] ?? 'head');
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
    for (const f of this.faces) if (f.until && this.time.now > f.until) { f.until = 0; f.img.setFrame('head'); }
    const sp = this.btns[2];
    if (sp) {
      const ready = this.meterVals.a >= 1 && !this.meterVals.pa;
      sp.ring.setStrokeStyle(5, 0xffd23f, ready ? 0.5 + Math.sin(this.time.now * 0.012) * 0.5 : 0);
      const op = this.edit ? 1 : getSettings().opacity;
      sp.c.setAlpha(op * (ready || this.meterVals.pa || this.edit ? 1 : 0.6));
    }
  }
}
