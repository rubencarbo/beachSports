import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { applyRetro } from '../fx/RetroPipeline';
import { SPORTS } from '../sports';
import { backendEnabled, getMyStats } from '../services/backend';
import { IconName, UI, block, button, icon, label, panel, segmented, shade } from '../ui/kit';

/** Menú principal sobre una partida de demostración (CPU vs CPU) que sirve de fondo animado. */
export class MenuScene extends Phaser.Scene {
  private difficulty: 'facil' | 'normal' | 'dificil' = 'normal';
  private points = 7;
  private mode: 'friendly' | 'tournament' = 'friendly';
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Menu'); }

  create() {
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 2000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.input.keyboard?.once('keydown-ENTER', () => this.start());
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height;
    const c = this.root;

    // viñeta a la izquierda para que el logo destaque sobre la demo
    const shadeG = this.add.graphics();
    shadeG.fillGradientStyle(0x0b1a2a, 0x0b1a2a, 0x0b1a2a, 0x0b1a2a, 0.65, 0, 0.65, 0);
    shadeG.fillRect(0, 0, w * 0.6, h);
    c.add(shadeG);

    // ---- logotipo
    const lx = w * 0.27, ly = h * 0.24;
    const sun = this.add.graphics().setPosition(lx + 150, ly - 40);
    sun.fillStyle(UI.yellow, 1).fillCircle(0, 0, 46);
    sun.fillStyle(shade(UI.yellow, 1.12), 1).fillCircle(-8, -8, 30);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sun.fillStyle(UI.orange, 1).fillRect(Math.cos(a) * 60 - 6, Math.sin(a) * 60 - 6, 12, 12);
    }
    c.add(sun);
    this.tweens.add({ targets: sun, angle: 360, duration: 24000, repeat: -1 });
    const mk = (y: number, t: string, size: number, fill: string, stroke: string) => {
      const sh = this.add.text(lx + 6, y + 8, t, { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: '#1b2240' }).setOrigin(0.5);
      const tx = this.add.text(lx, y, t, { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: fill, stroke, strokeThickness: Math.round(size / 5) }).setOrigin(0.5);
      c.add([sh, tx]);
      return tx;
    };
    const t1 = mk(ly, 'BEACH', 72, '#ffd23f', '#c4420c');
    const t2 = mk(ly + 86, 'SPORTS', 56, '#5fe0f0', '#0e5f8f');
    this.tweens.add({ targets: [t1], y: ly - 4, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut' });
    this.tweens.add({ targets: [t2], y: ly + 82, yoyo: true, repeat: -1, duration: 1100, delay: 250, ease: 'Sine.InOut' });
    // cinta "torneo de palas"
    const rib = this.add.graphics();
    const rw = 420, ry = ly + 166;
    rib.fillStyle(shade(UI.red, 0.6), 1).fillTriangle(lx - rw / 2 - 30, ry + 6, lx - rw / 2, ry - 10, lx - rw / 2, ry + 26);
    rib.fillTriangle(lx + rw / 2 + 30, ry + 6, lx + rw / 2, ry - 10, lx + rw / 2, ry + 26);
    block(rib, lx - rw / 2, ry - 26, rw, 54, UI.red);
    c.add(rib);
    c.add(label(this, lx, ry, 'TORNEO DE PALAS', 30, '#fff3d6'));

    // ---- letrero de opciones
    const pw = Math.min(640, w * 0.46), ph = Math.min(640, h - 40);
    const px = w - pw / 2 - 30, py = h / 2 + 10;
    const p = panel(this, px, py, pw, ph, { wood: true, title: 'NUEVO PARTIDO', titleColor: UI.orange });
    c.add(p);
    let y = -ph / 2 + 58;
    p.add(label(this, -pw / 2 + 30, y, 'DEPORTE', 24, '#fff3d6').setOrigin(0, 0.5));
    y += 52;
    const cw = (pw - 60) / 3;
    const icons: IconName[] = ['paddle', 'volley', 'foot'];
    SPORTS.forEach((s, i) => {
      const cx = -pw / 2 + 30 + cw * i + cw / 2;
      const card = this.add.graphics();
      block(card, cx - cw / 2 + 4, y - 34, cw - 8, 76, s.available ? UI.teal : 0x55607e);
      icon(card, icons[i], cx - cw * 0.28, y + 4, 34, s.available ? UI.cream : 0xb8c0d4);
      p.add(card);
      p.add(label(this, cx + 18, y + 4, s.name, 17, s.available ? '#fff3d6' : '#c8cfe0', { wordWrap: { width: cw * 0.6 }, align: 'center' }));
      if (!s.available) {
        const lk = this.add.graphics();
        block(lk, cx + cw / 2 - 44, y - 46, 38, 32, UI.ink, { shadow: false });
        icon(lk, 'lock', cx + cw / 2 - 25, y - 30, 22, UI.yellow);
        p.add(lk);
      }
    });
    y += 74;
    p.add(label(this, -pw / 2 + 30, y, 'MODO', 24, '#fff3d6').setOrigin(0, 0.5));
    y += 44;
    p.add(segmented(this, 0, y, pw - 60, 58, ['AMISTOSO', 'TORNEO (8)'], this.mode === 'friendly' ? 0 : 1, (i) => { this.mode = i === 0 ? 'friendly' : 'tournament'; this.build(); }, UI.orange));
    y += 60;
    p.add(label(this, -pw / 2 + 30, y, 'DIFICULTAD', 24, '#fff3d6').setOrigin(0, 0.5));
    y += 44;
    const levels: ('facil' | 'normal' | 'dificil')[] = ['facil', 'normal', 'dificil'];
    if (this.mode === 'friendly') p.add(segmented(this, 0, y, pw - 60, 58, ['FÁCIL', 'NORMAL', 'DIFÍCIL'], levels.indexOf(this.difficulty), (i) => { this.difficulty = levels[i]; }, UI.teal));
    else p.add(label(this, 0, y, 'SUBE EN CADA RONDA: FÁCIL → NORMAL → DIFÍCIL', 20, '#ffd23f'));
    y += 60;
    p.add(label(this, -pw / 2 + 30, y, 'PUNTOS', 24, '#fff3d6').setOrigin(0, 0.5));
    y += 44;
    const pts = [5, 7, 11];
    p.add(segmented(this, 0, y, pw - 60, 58, pts.map((n) => `A ${n}`), pts.indexOf(this.points), (i) => { this.points = pts[i]; }, UI.teal));
    const play = button(this, 0, ph / 2 - 56, pw - 70, 82, this.mode === 'tournament' ? '¡AL TORNEO!' : '¡JUGAR!', () => this.start(), { color: UI.orange, icon: 'play', size: 42 });
    p.add(play.c);
    this.tweens.add({ targets: play.c, scale: 1.04, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.InOut' });

    // ---- botones secundarios
    const gear = button(this, 78, h - 62, 124, 76, '', () => { this.scene.launch('Settings', { from: 'menu' }); this.scene.stop(); }, { icon: 'gear', color: UI.inkSoft });
    const lab = button(this, 216, h - 62, 124, 76, '', () => { this.scene.stop('Match'); this.scene.start('Lab'); }, { icon: 'flask', color: UI.inkSoft });
    c.add([gear.c, lab.c]);
    c.add([label(this, 78, h - 118, 'AJUSTES', 20), label(this, 216, h - 118, 'LAB', 20)]);

    if (backendEnabled) {
      const st = label(this, w * 0.27, h - 56, 'Conectando…', 16).setOrigin(0.5);
      c.add(st);
      getMyStats().then((s) => st.active && st.setText(s ? `Partidas ${s.played ?? 0} · Victorias ${s.wins ?? 0}` : 'Sin conexión'));
    }
  }

  start() {
    sfx.unlock();
    sfx.ui();
    const el = document.documentElement as any;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    (screen.orientation as any)?.lock?.('landscape').catch?.(() => {});
    // elegir personaje (la partida de demostración sigue de fondo)
    this.scene.launch('Select', { mode: this.mode, difficulty: this.difficulty, points: this.points });
    this.scene.stop();
  }
}
