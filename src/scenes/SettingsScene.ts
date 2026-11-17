import Phaser from 'phaser';
import { getSettings, resetSettings, updateSettings } from '../core/settings';
import { applyRetro } from '../fx/RetroPipeline';
import { UI, button, label, panel, segmented, slider } from '../ui/kit';

/**
 * Ajustes con vista previa en directo: los controles táctiles reales se ven en pantalla mientras
 * se cambian tamaño y transparencia, y se pueden arrastrar a cualquier posición en cualquier momento.
 */
export class SettingsScene extends Phaser.Scene {
  private from: 'menu' | 'hud' = 'menu';
  private root!: Phaser.GameObjects.Container;
  private collapsed = false;

  constructor() { super('Settings'); }

  init(d: { from?: 'menu' | 'hud' }) { this.from = d.from ?? 'menu'; this.collapsed = false; }

  create() {
    // controles visibles y arrastrables debajo del panel
    if (this.from === 'hud') this.game.events.emit('hud-edit', 'settings');
    else if (!this.scene.isActive('Hud')) this.scene.launch('Hud', { edit: 'settings', standalone: true });
    this.scene.bringToTop();
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 2000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height, s = getSettings();
    const c = this.root;
    const pw = Math.min(820, w * 0.56);

    if (this.collapsed) {
      const bar = panel(this, w / 2, 70, Math.min(560, w * 0.5), 96, { title: 'AJUSTES', titleColor: UI.orange });
      bar.add(label(this, -40, 12, 'Arrastra los controles', 24).setOrigin(0.5));
      bar.add(button(this, Math.min(560, w * 0.5) / 2 - 80, 12, 120, 56, 'VER', () => { this.collapsed = false; this.build(); }, { color: UI.teal, size: 24 }).c);
      c.add(bar);
      return;
    }

    const ph = Math.min(h * 0.8, 600);
    const p = panel(this, w / 2, 26 + ph / 2 + 10, pw, ph, { title: 'AJUSTES', titleColor: UI.orange, wood: true });
    c.add(p);
    const left = -pw / 2 + 34;
    const cx = pw * 0.17, cw = pw * 0.52;
    const rows = 7;
    const top = -ph / 2 + 58, step = (ph - 190) / (rows - 1);
    const row = (i: number) => top + i * step;
    const name = (i: number, t: string) => p.add(label(this, left, row(i), t, 24).setOrigin(0, 0.5));
    name(0, 'Tamaño cruceta');
    p.add(slider(this, cx, row(0), cw * 0.78, s.stickScale, 0.6, 1.8, (v) => updateSettings({ stickScale: Math.round(v * 100) / 100 })));
    name(1, 'Tamaño botones');
    p.add(slider(this, cx, row(1), cw * 0.78, s.btnScale, 0.6, 1.8, (v) => updateSettings({ btnScale: Math.round(v * 100) / 100 })));
    name(2, 'Transparencia');
    p.add(slider(this, cx, row(2), cw * 0.78, s.opacity, 0.15, 1, (v) => updateSettings({ opacity: Math.round(v * 100) / 100 })));
    const seg = (i: number, t: string, opts: string[], act: number, cb: (j: number) => void) => {
      name(i, t);
      p.add(segmented(this, cx + 24, row(i), cw, Math.min(56, step - 8), opts, act, cb, UI.teal));
    };
    seg(3, 'Cruceta', ['FLOTANTE', 'FIJA'], s.stickMode === 'floating' ? 0 : 1, (j) => updateSettings({ stickMode: j === 0 ? 'floating' : 'fixed' }));
    seg(4, 'Mano', ['DIESTRO', 'ZURDO'], s.leftHanded ? 1 : 0, (j) => updateSettings({ leftHanded: j === 1 }));
    seg(5, 'Movimiento', ['ASISTIDO', 'MANUAL'], s.assist ? 0 : 1, (j) => updateSettings({ assist: j === 0 }));
    seg(6, 'Remate', ['AUTOMÁTICO', 'CON SALTO'], s.autoSmash ? 0 : 1, (j) => updateSettings({ autoSmash: j === 0 }));

    const by = ph / 2 - 52;
    const bw = (pw - 100) / 3;
    p.add(button(this, -bw - 18, by, bw, 70, 'OCULTAR', () => { this.collapsed = true; this.build(); }, { color: UI.blue, icon: 'move', size: 24 }).c);
    p.add(button(this, 0, by, bw, 70, 'RESTABLECER', () => { resetSettings(); this.build(); }, { color: UI.grey, icon: 'retry', size: 22 }).c);
    p.add(button(this, bw + 18, by, bw, 70, 'LISTO', () => this.close(), { color: UI.green, icon: 'check', size: 26 }).c);
    c.add(label(this, w / 2, Math.min(h - 18, 26 + ph + 34), 'Arrastra la cruceta y los botones para colocarlos', 22).setAlpha(0.95));
  }

  private close() {
    if (this.from === 'hud') this.game.events.emit('hud-edit-end');
    else { this.scene.stop('Hud'); this.scene.launch('Menu'); }
    this.scene.stop();
  }
}
