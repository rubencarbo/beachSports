import Phaser from 'phaser';
import { getSettings, resetSettings, updateSettings } from '../core/settings';
import { applyRetro } from '../fx/RetroPipeline';
import { UI, button, label, panel, segmented, slider } from '../ui/kit';

/** Ajustes: tamaños, transparencia, cruceta, mano, ayudas de juego y colocación de controles. */
export class SettingsScene extends Phaser.Scene {
  private from: 'menu' | 'hud' = 'menu';
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Settings'); }

  init(d: { from?: 'menu' | 'hud' }) { this.from = d.from ?? 'menu'; }

  create() {
    this.scene.bringToTop();
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 360);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height, s = getSettings();
    const c = this.root;
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.6).setOrigin(0).setInteractive());
    const pw = Math.min(920, w - 40), ph = Math.min(640, h - 50);
    const p = panel(this, w / 2, h / 2 + 18, pw, ph, { title: 'AJUSTES', titleColor: UI.orange, wood: true });
    c.add(p);
    const colL = -pw / 2 + 40;
    const rows = 7;
    const top = -ph / 2 + 62, step = (ph - 210) / (rows - 1);
    const row = (i: number) => top + i * step;
    const name = (i: number, t: string) => p.add(label(this, colL, row(i), t, 20).setOrigin(0, 0.5));
    const cx = pw * 0.12, cw = pw * 0.5;
    name(0, 'Tamaño cruceta');
    p.add(slider(this, cx, row(0), cw * 0.8, s.stickScale, 0.6, 1.8, (v) => updateSettings({ stickScale: Math.round(v * 100) / 100 })));
    name(1, 'Tamaño botones');
    p.add(slider(this, cx, row(1), cw * 0.8, s.btnScale, 0.6, 1.8, (v) => updateSettings({ btnScale: Math.round(v * 100) / 100 })));
    name(2, 'Transparencia');
    p.add(slider(this, cx, row(2), cw * 0.8, s.opacity, 0.15, 1, (v) => updateSettings({ opacity: Math.round(v * 100) / 100 })));
    const seg = (i: number, t: string, opts: string[], act: number, cb: (j: number) => void) => {
      name(i, t);
      p.add(segmented(this, cx + 20, row(i), cw, 46, opts, act, cb, UI.teal));
    };
    seg(3, 'Cruceta', ['FLOTANTE', 'FIJA'], s.stickMode === 'floating' ? 0 : 1, (j) => updateSettings({ stickMode: j === 0 ? 'floating' : 'fixed' }));
    seg(4, 'Mano', ['DIESTRO', 'ZURDO'], s.leftHanded ? 1 : 0, (j) => updateSettings({ leftHanded: j === 1 }));
    seg(5, 'Movimiento', ['ASISTIDO', 'MANUAL'], s.assist ? 0 : 1, (j) => updateSettings({ assist: j === 0 }));
    seg(6, 'Remate', ['AUTOMÁTICO', 'CON SALTO'], s.autoSmash ? 0 : 1, (j) => updateSettings({ autoSmash: j === 0 }));

    const by = ph / 2 - 46;
    const bw = (pw - 120) / 3;
    p.add(button(this, -bw - 20, by, bw, 62, 'COLOCAR', () => this.placeControls(), { color: UI.orange, icon: 'move', size: 22 }).c);
    p.add(button(this, 0, by, bw, 62, 'RESTABLECER', () => { resetSettings(); this.build(); }, { color: UI.grey, icon: 'retry', size: 20 }).c);
    p.add(button(this, bw + 20, by, bw, 62, 'LISTO', () => this.close(), { color: UI.green, icon: 'check', size: 22 }).c);
    p.setScale(Math.min(1, (h - 20) / (ph + 40)));
  }

  private placeControls() {
    if (this.from === 'hud') this.game.events.emit('hud-edit', true);
    else this.scene.launch('Hud', { edit: true, standalone: true });
    this.scene.stop();
  }

  private close() {
    if (this.from === 'hud') this.game.events.emit('hud-settings-closed');
    else this.scene.launch('Menu');
    this.scene.stop();
  }
}
