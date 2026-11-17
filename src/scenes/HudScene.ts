import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { playerInput } from '../core/input';
import { CtrlId, ctrlPos, getSettings, onSettings, updateSettings } from '../core/settings';
import { applyRetro } from '../fx/RetroPipeline';
import { IconName, LABEL_FONT, TITLE_FONT, UI, block, button, cutRect, icon, label, panel, shade } from '../ui/kit';

interface Btn { c: Phaser.GameObjects.Container; g: Phaser.GameObjects.Graphics; r: number; key: 'hit' | 'jump' | 'special'; pid: number; color: number; icon: IconName; text: string }

/** Interfaz de partido: marcador tipo TV, controles táctiles, pausa, marcador de punto y resultado final. */
export class HudScene extends Phaser.Scene {
  private scoreTxt!: Phaser.GameObjects.Text[];
  private names!: Phaser.GameObjects.Text[];
  private meters!: Phaser.GameObjects.Graphics;
  private serveIcon!: Phaser.GameObjects.Graphics;
  private panelTop!: Phaser.GameObjects.Container;
  private pauseBtn!: Phaser.GameObjects.Container;
  private stick = { c: null as any as Phaser.GameObjects.Container, knob: null as any as Phaser.GameObjects.Container, pid: -1, ox: 0, oy: 0 };
  private btns: Btn[] = [];
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hint!: Phaser.GameObjects.Text;
  private last = { a: 0, b: 0 };
  private meterVals = { a: 0, b: 0, pa: false, pb: false };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = false;
  private faces: { img: Phaser.GameObjects.Image; until: number }[] = [];
  private edit = false;
  private editMode: 'place' | 'settings' = 'place';
  private standalone = false;
  private editUi?: Phaser.GameObjects.Container;
  private drag: { id: CtrlId; pid: number; dx: number; dy: number } | null = null;
  private pauseUi?: Phaser.GameObjects.Container;
  private serving = false;
  private target = 7;

  constructor() { super('Hud'); }

  init(d: { edit?: boolean | 'settings'; standalone?: boolean }) {
    this.edit = !!d.edit;
    this.editMode = d.edit === 'settings' ? 'settings' : 'place';
    this.standalone = !!d.standalone;
    this.btns = []; this.faces = [];
    this.last = { a: 0, b: 0 };
    this.pauseUi = undefined; this.editUi = undefined; this.drag = null;
  }

  create() {
    this.touch = this.sys.game.device.input.touch;
    this.input.addPointer(3);
    const m = this.scene.get('Match') as any;
    this.target = m?.cfg?.points ?? 7;
    this.buildTop();
    this.buildControls();
    this.confetti = this.add.particles(0, 0, 'square', {
      speed: { min: 200, max: 560 }, angle: { min: 200, max: 340 }, gravityY: 560, lifespan: 2400,
      rotate: { start: 0, end: 720 }, scaleX: { start: 1.4, end: 0.5 }, scaleY: { min: 0.6, max: 1.6 },
      tint: [0xff5a5a, 0xffd23f, 0x3ab0ff, 0x7bd389, 0xff9f1c, 0xc77dff, 0xffffff], emitting: false,
    }).setDepth(50);
    this.hint = label(this, 0, 0, '', 28, '#fff3d6').setDepth(40);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,SPACE,SHIFT,ESC,P') as any;
    kb.on('keydown-J', () => { sfx.unlock(); playerInput.pressHit(); });
    kb.on('keydown-SPACE', () => { sfx.unlock(); playerInput.pressHit(); });
    kb.on('keydown-K', () => playerInput.pressJump());
    kb.on('keydown-L', () => playerInput.pressSpecial());
    kb.on('keydown-SHIFT', () => playerInput.pressSpecial());
    kb.on('keydown-ESC', () => (this.pauseUi ? this.resume() : this.showPause()));

    const ev = this.game.events;
    const onHud = (d: any) => this.onHud(d);
    const onPoint = (d: any) => this.onPoint(d);
    const onOver = (d: any) => this.onOver(d);
    const onFace = (d: { side: number; expr: number; dur: number }) => this.setFace(d.side, d.expr, d.dur);
    const onEdit = (mode?: 'settings') => { this.editMode = mode === 'settings' ? 'settings' : 'place'; this.setEdit(true); };
    const onEditEnd = () => { this.setEdit(false); this.showPause(); };
    const onSettingsClosed = () => this.showPause();
    ev.on('hud', onHud); ev.on('point', onPoint); ev.on('match-over', onOver); ev.on('face', onFace);
    ev.on('hud-edit', onEdit); ev.on('hud-settings-closed', onSettingsClosed); ev.on('hud-edit-end', onEditEnd);
    const offSettings = onSettings(() => this.layout());
    this.events.once('shutdown', () => {
      ev.off('hud', onHud); ev.off('point', onPoint); ev.off('match-over', onOver); ev.off('face', onFace);
      ev.off('hud-edit', onEdit); ev.off('hud-settings-closed', onSettingsClosed); ev.off('hud-edit-end', onEditEnd); offSettings();
    });
    applyRetro(this.cameras.main, 2000);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    if (this.standalone) { this.panelTop.setVisible(false); this.pauseBtn.setVisible(false); }
    this.layout();
    if (this.edit) this.setEdit(true);
  }

  // ------------------------------------------------------------ marcador tipo TV
  private buildTop() {
    const c = this.add.container(0, 0).setDepth(20);
    const g = this.add.graphics();
    const W = 560;
    block(g, -W / 2 + 64, 10, 190, 50, UI.orange);
    block(g, W / 2 - 64 - 190, 10, 190, 50, UI.teal);
    block(g, -78, 4, 156, 64, UI.ink, { border: 4 });
    cutRect(g, -66, 14, 54, 44, UI.cream, 1, 4);
    cutRect(g, 12, 14, 54, 44, UI.cream, 1, 4);
    g.fillStyle(shade(UI.cream, 0.85), 1).fillRect(-66, 35, 54, 2).fillRect(12, 35, 54, 2);
    block(g, -46, 62, 92, 28, UI.inkSoft, { shadow: false });
    c.add(g);
    c.add(label(this, 0, 76, `A ${this.target}`, 18, '#ffd23f'));
    this.scoreTxt = [
      this.add.text(-39, 37, '0', { fontFamily: TITLE_FONT, fontSize: '28px', color: '#e0611a' }).setOrigin(0.5),
      this.add.text(39, 37, '0', { fontFamily: TITLE_FONT, fontSize: '28px', color: '#0e7f8f' }).setOrigin(0.5),
    ];
    this.names = [
      label(this, -W / 2 + 64 + 95, 31, 'TÚ', 28),
      label(this, W / 2 - 64 - 95, 31, 'CPU', 28),
    ];
    this.meters = this.add.graphics();
    this.serveIcon = this.add.graphics();
    c.add([...this.scoreTxt, ...this.names, this.meters, this.serveIcon]);
    for (const [i, key, x] of [[0, 'rig_sun', -W / 2 + 30], [1, 'rig_wave', W / 2 - 30]] as [number, string, number][]) {
      const fg = this.add.graphics();
      block(fg, x - 38, 0, 76, 80, i === 0 ? UI.orange : UI.teal);
      cutRect(fg, x - 30, 8, 60, 64, 0x8fd3f5, 1, 4);
      fg.fillStyle(0xffe2a3, 1).fillRect(x - 30, 58, 60, 14);
      const img = this.add.image(x, 74, key, 'head').setOrigin(0.5, 1).setScale(1.85).setFlipX(i === 1);
      c.add([fg, img]);
      this.faces.push({ img, until: 0 });
    }
    this.panelTop = c;

    const pb = button(this, 0, 0, 80, 72, '', () => this.showPause(), { icon: 'pause', color: UI.inkSoft });
    pb.c.setDepth(30);
    this.pauseBtn = pb.c;
  }

  private drawMeters() {
    const g = this.meters;
    g.clear();
    const W = 560;
    const seg = 6;
    const draw = (x0: number, v: number, col: number, powered: boolean, rtl: boolean) => {
      const full = v >= 1 || powered;
      cutRect(g, x0 - 4, 58, 190 + 8, 20, UI.ink, 1, 4);
      const sw = 190 / seg;
      for (let i = 0; i < seg; i++) {
        const idx = rtl ? seg - 1 - i : i;
        const fillF = Phaser.Math.Clamp(v * seg - idx, 0, 1);
        const sx = x0 + i * sw + 2;
        g.fillStyle(0x10162b, 1).fillRect(sx, 62, sw - 4, 12);
        if (fillF > 0) {
          const fw = (sw - 4) * fillF;
          const c2 = full ? (Math.floor(this.time.now / 90) % 2 ? UI.yellow : col) : col;
          const fx = rtl ? sx + (sw - 4) - fw : sx;
          g.fillStyle(c2, 1).fillRect(fx, 62, fw, 12);
          g.fillStyle(shade(c2, 1.35), 1).fillRect(fx, 62, fw, 3);
        }
      }
    };
    draw(-W / 2 + 64, this.meterVals.pa ? 1 : this.meterVals.a, UI.orange, this.meterVals.pa, false);
    draw(W / 2 - 64 - 190, this.meterVals.pb ? 1 : this.meterVals.b, UI.teal, this.meterVals.pb, true);
    this.serveIcon.clear();
    if (this.serving) icon(this.serveIcon, 'ball', -W / 2 + 64 + 172, 34, 22);
  }

  // ------------------------------------------------------------ controles táctiles
  private drawBtn(b: Btn, pressed: boolean) {
    const g = b.g;
    g.clear();
    const r = b.r;
    const off = pressed ? 4 : 0;
    g.fillStyle(0x000000, 0.25).fillCircle(4, 8, r + 2);
    g.fillStyle(shade(b.color, 0.5), 1).fillCircle(0, 6, r);
    g.fillStyle(UI.ink, 1).fillCircle(0, off, r);
    g.fillStyle(b.color, 1).fillCircle(0, off, r - 5);
    g.fillStyle(shade(b.color, 1.25), 1).fillCircle(-r * 0.18, off - r * 0.22, r * 0.55);
    g.fillStyle(b.color, 1).fillCircle(0, off + r * 0.08, r * 0.62);
    icon(g, b.icon, 0, off - (b.text ? r * 0.16 : 0), r * 0.75, UI.cream);
    (b.c.getAt(1) as Phaser.GameObjects.Text | undefined)?.setY(off + r * 0.52);
  }

  private makeBtn(key: Btn['key'], text: string, r: number, color: number, ic: IconName) {
    const c = this.add.container(0, 0).setDepth(30);
    const g = this.add.graphics();
    c.add(g);
    if (text) c.add(this.add.text(0, r * 0.52, text, { fontFamily: LABEL_FONT, fontStyle: 'bold', fontSize: `${Math.round(r * 0.34)}px`, color: '#fff3d6', stroke: '#1b2240', strokeThickness: 4 }).setOrigin(0.5));
    const b: Btn = { c, g, r, key, pid: -1, color, icon: ic, text };
    this.drawBtn(b, false);
    this.btns.push(b);
    return b;
  }

  private buildControls() {
    const sc = this.add.container(0, 0).setDepth(30);
    const sg = this.add.graphics();
    sg.fillStyle(0x000000, 0.22).fillCircle(4, 6, 86);
    sg.fillStyle(UI.ink, 0.85).fillCircle(0, 0, 84);
    sg.fillStyle(0x2c3560, 0.85).fillCircle(0, 0, 77);
    sg.lineStyle(3, UI.cream, 0.35).strokeCircle(0, 0, 58);
    for (const [dx, dy, a] of [[0, -66, 0], [66, 0, Math.PI / 2], [0, 66, Math.PI], [-66, 0, -Math.PI / 2]] as [number, number, number][]) {
      const s = 11;
      sg.fillStyle(UI.cream, 0.8).fillTriangle(
        dx + Math.sin(a) * s, dy - Math.cos(a) * s,
        dx - Math.cos(a) * s - Math.sin(a) * s * 0.4, dy - Math.sin(a) * s + Math.cos(a) * s * 0.4,
        dx + Math.cos(a) * s - Math.sin(a) * s * 0.4, dy + Math.sin(a) * s + Math.cos(a) * s * 0.4);
    }
    sc.add(sg);
    const knob = this.add.container(0, 0).setDepth(31);
    const kg = this.add.graphics();
    kg.fillStyle(0x000000, 0.3).fillCircle(3, 6, 40);
    kg.fillStyle(UI.ink, 1).fillCircle(0, 0, 40);
    kg.fillStyle(UI.cream, 1).fillCircle(0, 0, 34);
    kg.fillStyle(UI.orange, 1).fillCircle(0, 2, 24);
    kg.fillStyle(shade(UI.orange, 1.3), 1).fillCircle(-6, -5, 11);
    knob.add(kg);
    this.stick.c = sc; this.stick.knob = knob;

    this.makeBtn('hit', 'GOLPE', 80, UI.orange, 'paddle');
    this.makeBtn('jump', 'SALTO', 56, UI.teal, 'jump');
    this.makeBtn('special', '', 58, UI.red, 'star');

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      const w = this.scale.width;
      const st = getSettings();
      if (this.edit) { this.startDrag(p); return; }
      if (this.pauseUi) return;
      for (const b of this.btns) {
        if (b.c.visible && Phaser.Math.Distance.Between(p.x, p.y, b.c.x, b.c.y) < b.r * st.btnScale + 18) {
          b.pid = p.id;
          this.drawBtn(b, true);
          if (b.key === 'hit') playerInput.pressHit();
          if (b.key === 'jump') playerInput.pressJump();
          if (b.key === 'special') playerInput.pressSpecial();
          return;
        }
      }
      const home = ctrlPos('stick', w, this.scale.height);
      const onStickSide = st.leftHanded ? p.x > w * 0.5 : p.x < w * 0.5;
      const nearHome = Phaser.Math.Distance.Between(p.x, p.y, home.x, home.y) < 84 * st.stickScale * 1.7;
      if (this.stick.pid < 0 && p.y > 100 && (st.stickMode === 'floating' ? onStickSide : nearHome)) {
        this.stick.pid = p.id;
        if (st.stickMode === 'floating') { this.stick.ox = p.x; this.stick.oy = p.y; } else { this.stick.ox = home.x; this.stick.oy = home.y; }
        this.stick.c.setPosition(this.stick.ox, this.stick.oy);
        this.stick.knob.setPosition(this.stick.ox, this.stick.oy);
        this.moveStick(p);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.edit) { this.moveDrag(p); return; }
      if (p.id === this.stick.pid) this.moveStick(p);
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (this.drag && this.drag.pid === p.id) this.drag = null;
      if (p.id === this.stick.pid) {
        this.stick.pid = -1;
        playerInput.mx = playerInput.my = 0;
        this.layoutStick();
      }
      for (const b of this.btns) if (b.pid === p.id) { b.pid = -1; this.drawBtn(b, false); if (b.key === 'hit') playerInput.releaseHit(); }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  private moveStick(p: Phaser.Input.Pointer) {
    const sc = getSettings().stickScale;
    const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy;
    const len = Math.hypot(dx, dy), max = 64 * sc;
    const k = len > max ? max / len : 1;
    this.stick.knob.setPosition(this.stick.ox + dx * k, this.stick.oy + dy * k);
    const dead = 8 * sc;
    playerInput.mx = len < dead ? 0 : (dx * k) / max;
    playerInput.my = len < dead ? 0 : -(dy * k) / max;
  }

  private layoutStick() {
    const p = ctrlPos('stick', this.scale.width, this.scale.height);
    const sc = getSettings().stickScale;
    this.stick.c.setPosition(p.x, p.y).setScale(sc);
    this.stick.knob.setPosition(p.x, p.y).setScale(sc);
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.panelTop.setPosition(w / 2, 8).setScale(Math.min(1.4, (w - 240) / 600));
    this.pauseBtn.setPosition(60, 52);
    const st = getSettings();
    if (this.stick.pid < 0) this.layoutStick();
    for (const b of this.btns) {
      const p = ctrlPos(b.key as CtrlId, w, h);
      b.c.setPosition(p.x, p.y).setScale(st.btnScale);
    }
    this.hint.setPosition(w / 2, h - 70);
    const show = this.touch || this.edit;
    this.panelTop.setVisible(!this.standalone && !(this.edit && this.editMode === 'settings'));
    const a = this.edit ? Math.max(0.7, st.opacity) : st.opacity;
    this.stick.c.setVisible(show).setAlpha(a); this.stick.knob.setVisible(show).setAlpha(a);
    for (const b of this.btns) b.c.setVisible(show).setAlpha(a);
  }

  // ------------------------------------------------------------ colocar controles
  private startDrag(p: Phaser.Input.Pointer) {
    const st = getSettings();
    const objs = [
      { id: 'stick' as CtrlId, x: this.stick.c.x, y: this.stick.c.y, r: 84 * st.stickScale },
      ...this.btns.map((b) => ({ id: b.key as CtrlId, x: b.c.x, y: b.c.y, r: b.r * st.btnScale })),
    ];
    const hit = objs.find((c) => Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y) < c.r + 16);
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

  private setEdit(on: boolean) {
    this.edit = on;
    this.pauseUi?.destroy(); this.pauseUi = undefined;
    this.editUi?.destroy(); this.editUi = undefined;
    if (on && this.editMode === 'place') {
      const w = this.scale.width;
      const c = this.add.container(0, 0).setDepth(80);
      const p = panel(this, w / 2, 170, 460, 130, { title: 'COLOCAR', titleColor: UI.orange });
      p.add(label(this, 0, -12, 'Arrastra cada control a su sitio', 20));
      const done = button(this, 0, 36, 200, 50, 'LISTO', () => {
        this.setEdit(false);
        if (this.standalone) { this.scene.launch('Settings', { from: 'menu' }); this.scene.stop(); } else this.scene.launch('Settings', { from: 'hud' });
      }, { color: UI.green, icon: 'check', size: 20 });
      p.add(done.c);
      c.add(p);
      this.editUi = c;
    }
    this.layout();
  }

  // ------------------------------------------------------------ pausa
  private showPause() {
    if (this.standalone || this.pauseUi) return;
    if (this.scene.isActive('Match')) this.scene.pause('Match');
    const w = this.scale.width, h = this.scale.height;
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.6).setOrigin(0).setInteractive());
    const p = panel(this, w / 2, h / 2 + 24, 500, 420, { title: 'PAUSA', titleColor: UI.teal });
    const items: [string, IconName, number, () => void][] = [
      ['CONTINUAR', 'play', UI.green, () => this.resume()],
      ['AJUSTES', 'gear', UI.orange, () => { this.pauseUi?.destroy(); this.pauseUi = undefined; this.scene.launch('Settings', { from: 'hud' }); this.scene.bringToTop('Settings'); }],
      ['MENÚ', 'home', UI.blue, () => { this.scene.resume('Match'); this.backToMenu(); }],
    ];
    items.forEach(([t, ic, col, cb], i) => p.add(button(this, 0, -96 + i * 104, 400, 82, t, cb, { color: col, icon: ic, size: 34 }).c));
    c.add(p);
    p.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.pauseUi = c;
  }

  private resume() {
    this.pauseUi?.destroy(); this.pauseUi = undefined;
    if (this.scene.isPaused('Match')) this.scene.resume('Match');
  }

  // ------------------------------------------------------------ caras
  private setFace(side: number, expr: number, dur: number) {
    const f = this.faces[side === -1 ? 0 : 1];
    if (!f) return;
    const fr = ['head', 'head_angry', 'head_happy', 'head_angry', 'head', 'head_sad'][expr] ?? 'head';
    f.img.setFrame(expr === 2 && f.img.texture.has('head_laugh') ? 'head_laugh' : fr);
    f.until = this.time.now + dur * 1000;
    this.tweens.add({ targets: f.img, y: 68, duration: 70, yoyo: true });
  }

  // ------------------------------------------------------------ eventos
  private onHud(d: any) {
    this.meterVals = { a: d.meterA, b: d.meterB, pa: d.poweredA, pb: d.poweredB };
    this.names[0].setText(d.names[0] === 'TU' ? 'TÚ' : d.names[0]);
    this.names[1].setText(d.names[1]);
    this.serving = !!d.serving;
    if (d.serving) this.hint.setText(this.touch ? 'Pulsa GOLPE para sacar' : 'Pulsa J o ESPACIO para sacar');
    else this.hint.setText('');
  }

  private onPoint(d: { score: { a: number; b: number }; winner: number }) {
    const w = this.scale.width;
    sfx.flip();
    const prev = { ...this.last };
    this.last = { ...d.score };
    const won = d.winner === -1;
    const board = this.add.container(w / 2, -220).setDepth(45);
    const g = this.add.graphics();
    g.fillStyle(0x8a8f9e, 1);
    for (let y = -150; y < -84; y += 10) { g.fillRect(-120, y, 6, 7); g.fillRect(114, y, 6, 7); }
    block(g, -170, -88, 340, 196, UI.wood);
    g.fillStyle(shade(UI.wood, 0.82), 1).fillRect(-162, -40, 324, 3).fillRect(-162, 10, 324, 3).fillRect(-162, 60, 324, 3);
    g.fillStyle(UI.woodDark, 1).fillRect(-154, -80, 6, 6).fillRect(148, -80, 6, 6).fillRect(-154, 94, 6, 6).fillRect(148, 94, 6, 6);
    board.add(g);
    const card = (x: number, from: number, to: number, col: string, changed: boolean, name: string, nameCol: number) => {
      const cg = this.add.graphics();
      block(cg, x - 62, -66, 124, 128, UI.cream, { border: 4 });
      cg.fillStyle(0x000000, 0.12).fillRect(x - 56, -3, 112, 4);
      const t = this.add.text(x, 0, String(from), { fontFamily: TITLE_FONT, fontSize: '64px', color: col }).setOrigin(0.5);
      const ng = this.add.graphics();
      block(ng, x - 62, 70, 124, 30, nameCol, { shadow: false });
      board.add([cg, t, ng, label(this, x, 85, name, 20)]);
      if (changed) {
        this.tweens.add({ targets: [cg, t], scaleY: 0, duration: 140, delay: 450, yoyo: true, onYoyo: () => { t.setText(String(to)); sfx.flip(); } });
      } else t.setText(String(to));
    };
    card(-78, prev.a, d.score.a, '#e0611a', prev.a !== d.score.a, this.names[0].text, UI.orange);
    card(78, prev.b, d.score.b, '#0e7f8f', prev.b !== d.score.b, this.names[1].text, UI.teal);
    const rib = this.add.graphics();
    const rc = won ? UI.orange : UI.teal;
    rib.fillStyle(shade(rc, 0.6), 1).fillTriangle(-150, -98, -124, -112, -124, -80).fillTriangle(150, -98, 124, -112, 124, -80);
    block(rib, -124, -122, 248, 46, rc);
    board.add([rib, label(this, 0, -100, '¡PUNTO!', 22, '#fff3d6', { title: true })]);
    this.tweens.add({ targets: board, y: 270, duration: 420, ease: 'Back.Out' });
    this.tweens.add({ targets: board, angle: { from: -3, to: 3 }, duration: 600, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: board, y: -260, duration: 320, delay: 1750, ease: 'Cubic.In', onComplete: () => board.destroy() });
    this.time.delayedCall(560, () => {
      this.confetti.explode(70, w / 2 - 140, 120);
      this.confetti.explode(70, w / 2 + 140, 120);
    });
    this.time.delayedCall(700, () => {
      this.scoreTxt[0].setText(String(d.score.a));
      this.scoreTxt[1].setText(String(d.score.b));
      for (const t of this.scoreTxt) this.tweens.add({ targets: t, scale: 1.5, duration: 120, yoyo: true });
    });
  }

  private onOver(d: { winner: number; score: { a: number; b: number }; mode: string; stats?: { specials: number; perfects: number; longestRally: number } }) {
    if (d.mode !== 'play') return;
    const w = this.scale.width, h = this.scale.height;
    const won = d.winner === -1;
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.55).setOrigin(0).setInteractive());
    const p = panel(this, w / 2, h / 2 + 16, 640, 470, { title: won ? '¡VICTORIA!' : 'DERROTA', titleColor: won ? UI.orange : UI.blue, wood: won });
    const pg = this.add.graphics();
    block(pg, -290, -170, 170, 190, won ? UI.orange : UI.teal);
    cutRect(pg, -280, -160, 150, 170, 0x8fd3f5, 1, 4);
    const head = this.add.image(-205, 4, won ? 'rig_sun' : 'rig_wave', 'head_laugh').setOrigin(0.5, 1).setScale(4.4).setFlipX(!won);
    const tg = this.add.graphics();
    icon(tg, 'trophy', -205, 52, 46, UI.yellow);
    p.add([pg, head, tg]);
    p.add(label(this, 90, -130, `${d.score.a}  -  ${d.score.b}`, 46, '#fff3d6', { title: true }));
    const s = d.stats ?? { specials: 0, perfects: 0, longestRally: 0 };
    const rows: [string, string][] = [['Golpes perfectos', String(s.perfects)], ['Especiales', String(s.specials)], ['Peloteo más largo', String(s.longestRally)]];
    rows.forEach(([k, v], i) => {
      const yy = -58 + i * 48;
      const rg = this.add.graphics();
      block(rg, -80, yy - 20, 340, 40, UI.inkSoft, { shadow: false, border: 3 });
      p.add([rg, label(this, -60, yy, k, 24).setOrigin(0, 0.5), label(this, 238, yy, v, 26, '#ffd23f').setOrigin(1, 0.5)]);
    });
    p.add(button(this, -150, 172, 270, 78, 'REVANCHA', () => { const m = this.scene.get('Match') as any; m.scene.restart(m.cfg); this.scene.restart(); }, { color: UI.orange, icon: 'retry', size: 30 }).c);
    p.add(button(this, 150, 172, 270, 78, 'MENÚ', () => this.backToMenu(), { color: UI.blue, icon: 'home', size: 30 }).c);
    c.add(p);
    p.setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });
    if (won) this.time.addEvent({ delay: 400, repeat: 5, callback: () => this.confetti.explode(60, Phaser.Math.Between(100, w - 100), 60) });
  }

  private backToMenu() {
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'attract' });
    this.scene.launch('Menu');
    this.scene.stop();
  }

  update() {
    const k = this.keys;
    if (k) {
      const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const ky = (k.W.isDown || k.UP.isDown ? 1 : 0) - (k.S.isDown || k.DOWN.isDown ? 1 : 0);
      if (this.stick.pid < 0 && (kx || ky || !this.touch)) { playerInput.mx = kx; playerInput.my = ky; }
    }
    this.drawMeters();
    for (const f of this.faces) if (f.until && this.time.now > f.until) { f.until = 0; f.img.setFrame('head'); }
    // botón especial: anillo de carga alrededor
    const sp = this.btns[2];
    if (sp) {
      const v = this.meterVals.pa ? 1 : Math.min(1, this.meterVals.a);
      const ready = this.meterVals.a >= 1 && !this.meterVals.pa;
      this.drawBtn(sp, sp.pid >= 0);
      const g = sp.g;
      const r = sp.r + 9;
      g.lineStyle(7, UI.ink, 0.9).beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.strokePath();
      g.lineStyle(5, ready ? (Math.floor(this.time.now / 100) % 2 ? UI.yellow : UI.orange) : UI.yellow, 1).beginPath();
      g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); g.strokePath();
      const st = getSettings();
      sp.c.setScale(st.btnScale * (ready ? 1 + Math.sin(this.time.now * 0.012) * 0.06 : 1));
      sp.c.setAlpha((this.edit ? 1 : st.opacity) * (ready || this.meterVals.pa || this.edit ? 1 : 0.75));
    }
  }
}
