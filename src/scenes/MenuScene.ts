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
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Menu'); }

  create() {
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 360);
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
    const rw = 360, ry = ly + 160;
    rib.fillStyle(shade(UI.red, 0.6), 1).fillTriangle(lx - rw / 2 - 30, ry + 6, lx - rw / 2, ry - 10, lx - rw / 2, ry + 26);
    rib.fillTriangle(lx + rw / 2 + 30, ry + 6, lx + rw / 2, ry - 10, lx + rw / 2, ry + 26);
    block(rib, lx - rw / 2, ry - 22, rw, 46, UI.red);
    c.add(rib);
    c.add(label(this, lx, ry, 'TORNEO DE PALAS', 24, '#fff3d6'));

    // ---- letrero de opciones
    const pw = Math.min(560, w * 0.42), ph = Math.min(560, h - 60);
    const px = w - pw / 2 - 30, py = h / 2 + 10;
    const p = panel(this, px, py, pw, ph, { wood: true, title: 'NUEVO PARTIDO', titleColor: UI.orange });
    c.add(p);
    let y = -ph / 2 + 64;
    p.add(label(this, -pw / 2 + 30, y, 'DEPORTE', 20, '#fff3d6').setOrigin(0, 0.5));
    y += 52;
    const cw = (pw - 60) / 3;
    const icons: IconName[] = ['paddle', 'volley', 'foot'];
    SPORTS.forEach((s, i) => {
      const cx = -pw / 2 + 30 + cw * i + cw / 2;
      const card = this.add.graphics();
      block(card, cx - cw / 2 + 4, y - 40, cw - 8, 92, s.available ? UI.teal : 0x55607e);
      icon(card, icons[i], cx, y - 8, 40, s.available ? UI.cream : 0xb8c0d4);
      p.add(card);
      p.add(label(this, cx, y + 30, s.name, 15, s.available ? '#fff3d6' : '#c8cfe0'));
      if (!s.available) {
        const lk = this.add.graphics();
        block(lk, cx + cw / 2 - 46, y - 52, 40, 34, UI.ink, { shadow: false });
        icon(lk, 'lock', cx + cw / 2 - 26, y - 35, 22, UI.yellow);
        p.add(lk);
      }
    });
    y += 92;
    p.add(label(this, -pw / 2 + 30, y, 'DIFICULTAD', 20, '#fff3d6').setOrigin(0, 0.5));
    y += 46;
    const levels: ('facil' | 'normal' | 'dificil')[] = ['facil', 'normal', 'dificil'];
    p.add(segmented(this, 0, y, pw - 60, 50, ['FÁCIL', 'NORMAL', 'DIFÍCIL'], levels.indexOf(this.difficulty), (i) => { this.difficulty = levels[i]; }, UI.teal));
    y += 62;
    p.add(label(this, -pw / 2 + 30, y, 'PUNTOS', 20, '#fff3d6').setOrigin(0, 0.5));
    y += 46;
    const pts = [5, 7, 11];
    p.add(segmented(this, 0, y, pw - 60, 50, pts.map((n) => `A ${n}`), pts.indexOf(this.points), (i) => { this.points = pts[i]; }, UI.teal));
    const play = button(this, 0, ph / 2 - 62, pw - 80, 78, '¡JUGAR!', () => this.start(), { color: UI.orange, icon: 'play', size: 34 });
    p.add(play.c);
    this.tweens.add({ targets: play.c, scale: 1.04, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.InOut' });

    // ---- botones secundarios
    const gear = button(this, 70, h - 56, 110, 60, '', () => { this.scene.launch('Settings', { from: 'menu' }); this.scene.stop(); }, { icon: 'gear', color: UI.inkSoft });
    const lab = button(this, 196, h - 56, 110, 60, '', () => { this.scene.stop('Match'); this.scene.start('Lab'); }, { icon: 'flask', color: UI.inkSoft });
    c.add([gear.c, lab.c]);
    c.add([label(this, 70, h - 102, 'AJUSTES', 14), label(this, 196, h - 102, 'LAB', 14)]);

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
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'play', difficulty: this.difficulty, points: this.points });
    this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    this.scene.stop();
  }
}
