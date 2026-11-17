import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { SPORTS } from '../sports';
import { backendEnabled, getMyStats } from '../services/backend';

const FONT = 'Lilita One, Arial Black, sans-serif';

/** Menú sobre una partida de demostración (CPU vs CPU) que sirve de fondo animado. */
export class MenuScene extends Phaser.Scene {
  private difficulty: 'facil' | 'normal' | 'dificil' = 'normal';
  private points = 7;
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Menu'); }

  create() {
    this.root = this.add.container(0, 0);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height;
    const c = this.root;
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x0b1a2a, 0x0b1a2a, 0x0b1a2a, 0x0b1a2a, 0.55, 0.55, 0.1, 0.1);
    shade.fillRect(0, 0, w, h * 0.62);
    c.add(shade);
    const title = this.add.text(w / 2, h * 0.14, 'BEACH SPORTS', {
      fontFamily: FONT, fontSize: '84px', color: '#ffd23f', stroke: '#c4520c', strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 6, color: '#00000088', blur: 0, fill: true, stroke: true },
    }).setOrigin(0.5);
    c.add(title);
    this.tweens.add({ targets: title, scale: 1.04, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
    c.add(this.add.text(w / 2, h * 0.14 + 62, 'Torneo de playa', { fontFamily: FONT, fontSize: '28px', color: '#fff', stroke: '#1d2a3a', strokeThickness: 6 }).setOrigin(0.5));

    // deportes
    const sy = h * 0.42;
    SPORTS.forEach((s, i) => {
      const x = w / 2 + (i - 1) * 230;
      const b = this.add.text(x, sy, s.name, {
        fontFamily: FONT, fontSize: '26px', color: s.available ? '#fff' : '#ffffffaa',
        backgroundColor: s.available ? '#ff8a1f' : '#2b3b4f', padding: { x: 18, y: 10 },
      }).setOrigin(0.5);
      c.add(b);
      if (!s.available) c.add(this.add.text(x, sy + 34, 'PRÓXIMAMENTE', { fontFamily: FONT, fontSize: '15px', color: '#ffd23f' }).setOrigin(0.5));
    });

    // dificultad
    const dy = h * 0.58;
    const levels: [typeof this.difficulty, string][] = [['facil', 'FÁCIL'], ['normal', 'NORMAL'], ['dificil', 'DIFÍCIL']];
    levels.forEach(([id, label], i) => {
      const b = this.add.text(w / 2 + (i - 1) * 160, dy, label, {
        fontFamily: FONT, fontSize: '24px', color: '#fff',
        backgroundColor: this.difficulty === id ? '#25a8a8' : '#1d2a3acc', padding: { x: 14, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.unlock(); sfx.ui(); this.difficulty = id; this.build(); });
      c.add(b);
    });
    // puntos
    const py = h * 0.69;
    [5, 7, 11].forEach((p, i) => {
      const b = this.add.text(w / 2 + (i - 1) * 140, py, `A ${p}`, {
        fontFamily: FONT, fontSize: '22px', color: '#fff',
        backgroundColor: this.points === p ? '#25a8a8' : '#1d2a3acc', padding: { x: 14, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { sfx.unlock(); sfx.ui(); this.points = p; this.build(); });
      c.add(b);
    });

    const play = this.add.text(w / 2, h * 0.85, '¡JUGAR!', {
      fontFamily: FONT, fontSize: '50px', color: '#fff', backgroundColor: '#e0322a', padding: { x: 40, y: 12 },
      stroke: '#7a1010', strokeThickness: 6,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: play, scale: 1.07, yoyo: true, repeat: -1, duration: 600 });
    play.on('pointerdown', () => this.start());
    c.add(play);
    this.input.keyboard?.once('keydown-ENTER', () => this.start());

    if (backendEnabled) {
      const st = this.add.text(w - 16, h - 12, 'Conectando…', { fontFamily: FONT, fontSize: '16px', color: '#fff' }).setOrigin(1, 1);
      c.add(st);
      getMyStats().then((s) => st.active && st.setText(s ? `Partidas: ${s.played ?? 0} · Victorias: ${s.wins ?? 0}` : 'Offline'));
    }
  }

  private start() {
    sfx.unlock();
    sfx.ui();
    // pantalla completa donde se pueda (Android/escritorio; en iPhone usar "Añadir a pantalla de inicio")
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
