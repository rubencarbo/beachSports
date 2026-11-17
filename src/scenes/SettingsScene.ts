import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { PIXEL_FONT as FONT } from '../core/fonts';
import { Settings, getSettings, resetSettings, updateSettings } from '../core/settings';

/** Pantalla de ajustes de controles: tamaños, transparencia, tipo de cruceta, zurdo y colocación. */
export class SettingsScene extends Phaser.Scene {
  private from: 'menu' | 'hud' = 'menu';
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Settings'); }

  init(d: { from?: 'menu' | 'hud' }) { this.from = d.from ?? 'menu'; }

  create() {
    this.root = this.add.container(0, 0);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height, s = getSettings();
    const c = this.root;
    const pw = Math.min(760, w - 40), ph = Math.min(560, h - 30);
    const x0 = w / 2 - pw / 2, y0 = h / 2 - ph / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b1a2a, 0.6).fillRect(0, 0, w, h);
    bg.fillStyle(0x1d2a3a, 0.97).fillRect(x0, y0, pw, ph);
    bg.lineStyle(4, 0xffc23a, 1).strokeRect(x0, y0, pw, ph);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains); // bloquea toques al fondo
    c.add(bg);
    c.add(this.add.text(w / 2, y0 + 30, 'AJUSTES DE CONTROLES', { fontFamily: FONT, fontSize: '20px', color: '#ffd23f' }).setOrigin(0.5));

    const rowH = Math.min(62, (ph - 150) / 7);
    let y = y0 + 80;
    const label = (t: string) => c.add(this.add.text(x0 + 30, y, t, { fontFamily: FONT, fontSize: '14px', color: '#fff' }).setOrigin(0, 0.5));
    const slider = (t: string, key: 'stickScale' | 'btnScale' | 'opacity', min: number, max: number, fmt: (v: number) => string) => {
      label(t);
      const tx = x0 + pw * 0.45, tw = pw * 0.38, ty = y;
      const track = this.add.rectangle(tx, ty, tw, 8, 0x4a5a70).setOrigin(0, 0.5);
      const fill = this.add.rectangle(tx, ty, 0, 8, 0xff8a1f).setOrigin(0, 0.5);
      const knob = this.add.rectangle(0, ty, 22, 30, 0xffffff).setStrokeStyle(3, 0x1d2a3a);
      const val = this.add.text(tx + tw + 18, ty, '', { fontFamily: FONT, fontSize: '12px', color: '#ffd29a' }).setOrigin(0, 0.5);
      const set = (v: number, save: boolean) => {
        v = Phaser.Math.Clamp(v, min, max);
        const f = (v - min) / (max - min);
        knob.x = tx + f * tw; fill.width = f * tw; val.setText(fmt(v));
        if (save) updateSettings({ [key]: Math.round(v * 100) / 100 } as Partial<Settings>);
      };
      set(s[key], false);
      const hit = this.add.rectangle(tx + tw / 2, ty, tw + 40, 50, 0, 0).setInteractive({ draggable: true, useHandCursor: true });
      const fromX = (px: number) => min + ((px - tx) / tw) * (max - min);
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => set(fromX(p.x), true));
      hit.on('drag', (p: Phaser.Input.Pointer) => set(fromX(p.x), true));
      c.add([track, fill, knob, val, hit]);
      y += rowH;
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    slider('TAMANO CRUCETA', 'stickScale', 0.6, 1.8, pct);
    slider('TAMANO BOTONES', 'btnScale', 0.6, 1.8, pct);
    slider('TRANSPARENCIA', 'opacity', 0.15, 1, pct);

    const toggle = (t: string, a: string, b: string, isA: boolean, onA: () => void, onB: () => void) => {
      label(t);
      const bx = x0 + pw * 0.45;
      for (const [i, txt, active, cb] of [[0, a, isA, onA], [1, b, !isA, onB]] as [number, string, boolean, () => void][]) {
        const btn = this.add.text(bx + i * (pw * 0.2), y, txt, {
          fontFamily: FONT, fontSize: '12px', color: '#fff', backgroundColor: active ? '#25a8a8' : '#33445a', padding: { x: 10, y: 8 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => { sfx.ui(); cb(); this.build(); });
        c.add(btn);
      }
      y += rowH;
    };
    toggle('CRUCETA', 'FLOTANTE', 'FIJA', s.stickMode === 'floating', () => updateSettings({ stickMode: 'floating' }), () => updateSettings({ stickMode: 'fixed' }));
    toggle('MANO', 'DIESTRO', 'ZURDO', !s.leftHanded, () => updateSettings({ leftHanded: false }), () => updateSettings({ leftHanded: true }));
    toggle('MOVIMIENTO', 'ASISTIDO', 'MANUAL', s.assist, () => updateSettings({ assist: true }), () => updateSettings({ assist: false }));
    toggle('REMATE', 'AUTOMATICO', 'CON SALTO', s.autoSmash, () => updateSettings({ autoSmash: true }), () => updateSettings({ autoSmash: false }));

    const by = y0 + ph - 40;
    const btn = (x: number, t: string, col: string, cb: () => void) => {
      const b = this.add.text(x, by, t, { fontFamily: FONT, fontSize: '13px', color: '#fff', backgroundColor: col, padding: { x: 12, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.ui(); cb(); });
      c.add(b);
    };
    btn(w / 2 - pw * 0.32, 'COLOCAR', '#ff8a1f', () => this.placeControls());
    btn(w / 2, 'RESTABLECER', '#5a6a80', () => { resetSettings(); this.build(); });
    btn(w / 2 + pw * 0.32, 'LISTO', '#e0322a', () => this.close());
  }

  /** Modo "colocar controles": la HUD muestra los controles arrastrables. */
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
