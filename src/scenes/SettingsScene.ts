import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { Settings, getSettings, resetControls, updateSettings } from '../core/settings';
import { applyRetro } from '../fx/RetroPipeline';
import { UI, button, label, panel, segmented, slider } from '../ui/kit';

/**
 * Ajustes en dos pantallas:
 *  - principal: opciones de juego y sonido + acceso al editor de controles,
 *  - editor de controles a pantalla completa: los controles reales se arrastran con el dedo y
 *    una barra superior ajusta tamaño y transparencia en directo; GUARDAR / CANCELAR / RESTABLECER.
 * Durante el partido los controles NO se pueden mover: sólo aquí.
 */
export class SettingsScene extends Phaser.Scene {
  private from: 'menu' | 'hud' = 'menu';
  private root!: Phaser.GameObjects.Container;
  private mode: 'main' | 'editor' = 'main';
  private snapshot: Settings | null = null;

  constructor() { super('Settings'); }

  init(d: { from?: 'menu' | 'hud' }) { this.from = d.from ?? 'menu'; this.mode = 'main'; this.snapshot = null; }

  create() {
    this.scene.bringToTop();
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 2000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    if (this.mode === 'editor') this.buildEditor(); else this.buildMain();
  }

  // ------------------------------------------------------------ pantalla principal
  private buildMain() {
    const w = this.scale.width, h = this.scale.height, s = getSettings();
    const c = this.root;
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.6).setOrigin(0).setInteractive());
    const pw = Math.min(900, w - 60), ph = Math.min(620, h - 60);
    const p = panel(this, w / 2, h / 2 + 16, pw, ph, { title: 'AJUSTES', titleColor: UI.orange, wood: true });
    c.add(p);
    const left = -pw / 2 + 40, cx = pw * 0.14, cw = pw * 0.56;
    const rows = 5, top = -ph / 2 + 66, step = (ph - 340) / (rows - 1);
    const row = (i: number) => top + i * step;
    const seg = (i: number, t: string, opts: string[], act: number, cb: (j: number) => void) => {
      p.add(label(this, left, row(i), t, 26).setOrigin(0, 0.5));
      p.add(segmented(this, cx + 30, row(i), cw, Math.min(58, step - 12), opts, act, cb, UI.teal));
    };
    seg(0, 'Mano', ['DIESTRO', 'ZURDO'], s.leftHanded ? 1 : 0, (j) => updateSettings({ leftHanded: j === 1 }));
    seg(1, 'Movimiento', ['ASISTIDO', 'MANUAL'], s.assist ? 0 : 1, (j) => updateSettings({ assist: j === 0 }));
    seg(2, 'Remate', ['AUTOMÁTICO', 'CON SALTO'], s.autoSmash ? 0 : 1, (j) => updateSettings({ autoSmash: j === 0 }));
    seg(3, 'Música', ['SÍ', 'NO'], s.music ? 0 : 1, (j) => { updateSettings({ music: j === 0 }); this.game.events.emit('audio-settings'); });
    seg(4, 'Sonido', ['SÍ', 'NO'], s.sound ? 0 : 1, (j) => { updateSettings({ sound: j === 0 }); this.game.events.emit('audio-settings'); });
    p.add(button(this, 0, ph / 2 - 150, pw - 120, 80, 'PERSONALIZAR CONTROLES', () => this.openEditor(), { color: UI.orange, icon: 'move', size: 30 }).c);
    p.add(button(this, 0, ph / 2 - 58, 320, 70, 'VOLVER', () => this.close(), { color: UI.green, icon: 'check', size: 28 }).c);
  }

  // ------------------------------------------------------------ editor de controles
  private openEditor() {
    this.snapshot = JSON.parse(JSON.stringify(getSettings()));
    this.mode = 'editor';
    if (this.from === 'hud') this.game.events.emit('hud-edit', 'settings');
    else this.scene.launch('Hud', { edit: 'settings', standalone: true });
    this.scene.bringToTop();
    this.build();
  }

  private closeEditor(save: boolean) {
    if (!save && this.snapshot) updateSettings(this.snapshot);
    this.snapshot = null;
    if (this.from === 'hud') this.game.events.emit('hud-edit-off');
    else this.scene.stop('Hud');
    this.mode = 'main';
    this.build();
    if (save) this.toast('¡Controles guardados!');
  }

  private buildEditor() {
    const w = this.scale.width, s = getSettings();
    const c = this.root;
    const bw = Math.min(w - 24, 1500), bh = 150;
    const bar = this.add.container(w / 2, 12 + bh / 2);
    const g = this.add.graphics();
    // barra superior (no bloquea el resto de la pantalla: ahí se arrastran los controles)
    const pnl = panel(this, 0, 0, bw, bh, { color: UI.inkSoft });
    bar.add([pnl, g]);
    const btnW = 150, gap = 14;
    const btnsW = btnW * 3 + gap * 2;
    const slidersW = bw - btnsW - 70;
    const sw = slidersW / 3;
    const sx0 = -bw / 2 + 30;
    const group = (i: number, name: string, val: number, min: number, max: number, cb: (v: number) => void) => {
      const x = sx0 + i * sw + sw / 2 - 30;
      bar.add(label(this, x, -38, name, 24));
      bar.add(slider(this, x - 20, 18, sw - 120, val, min, max, cb));
    };
    group(0, 'CRUCETA', s.stickScale, 0.6, 2, (v) => updateSettings({ stickScale: Math.round(v * 100) / 100 }));
    group(1, 'BOTONES', s.btnScale, 0.6, 2, (v) => updateSettings({ btnScale: Math.round(v * 100) / 100 }));
    group(2, 'TRANSPARENCIA', s.opacity, 0.15, 0.9, (v) => updateSettings({ opacity: Math.round(v * 100) / 100 }));
    const bx0 = bw / 2 - 30 - btnsW + btnW / 2;
    bar.add(button(this, bx0, 0, btnW, 100, '', () => { resetControls(); this.build(); }, { color: UI.grey, icon: 'retry' }).c);
    bar.add(button(this, bx0 + btnW + gap, 0, btnW, 100, 'CANCELAR', () => this.closeEditor(false), { color: UI.red, size: 22 }).c);
    bar.add(button(this, bx0 + (btnW + gap) * 2, 0, btnW, 100, 'GUARDAR', () => this.closeEditor(true), { color: UI.green, size: 24 }).c);
    bar.add(label(this, bx0, 58, 'Restablecer', 16));
    c.add(bar);
    c.add(label(this, w / 2, 12 + bh + 34, 'Arrastra la cruceta y los botones a donde te resulte más cómodo', 26));
    bar.setScale(Math.min(1, (w - 24) / bw));
  }

  private toast(t: string) {
    const w = this.scale.width, h = this.scale.height;
    const c = this.add.container(w / 2, 70).setDepth(100);
    const p = panel(this, 0, 0, 460, 80, { color: UI.green });
    c.add([p, label(this, 0, 0, t, 28)]);
    c.setAlpha(0).setScale(0.8);
    sfx.ui();
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 300, onComplete: () => c.destroy() });
  }

  private close() {
    if (this.from === 'hud') this.game.events.emit('hud-settings-closed');
    else this.scene.launch('Menu');
    this.scene.stop();
  }
}
