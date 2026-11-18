import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { applyRetro } from '../fx/RetroPipeline';
import { g, getChar } from '../game/roster';
import { ROUND_DIFF, ROUND_NAMES, Tournament, clearTournament, getTournament, playerMatch, venueFor } from '../game/tournament';
import { getVenue } from '../game/venues';
import { UI, block, button, cutRect, icon, label, panel } from '../ui/kit';

/** Cuadro del torneo: cuartos → semis → final, con la sede de la siguiente ronda. */
export class BracketScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  constructor() { super('Bracket'); }

  create() {
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 2000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    const t = getTournament();
    if (t?.champion) {
      sfx.cheer(2);
      const conf = this.add.particles(0, 0, 'square', {
        speed: { min: 200, max: 560 }, angle: { min: 200, max: 340 }, gravityY: 560, lifespan: 2600,
        rotate: { start: 0, end: 720 }, scale: { start: 1.4, end: 0.5 },
        tint: [0xff5a5a, 0xffd23f, 0x3ab0ff, 0x7bd389, 0xff9f1c, 0xffffff], emitting: false,
      }).setDepth(50);
      this.time.addEvent({ delay: 450, repeat: 6, callback: () => conf.explode(50, Phaser.Math.Between(100, this.scale.width - 100), 60) });
    }
  }

  private build() {
    this.root.removeAll(true);
    const t = getTournament();
    const w = this.scale.width, h = this.scale.height;
    const c = this.root;
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.62).setOrigin(0).setInteractive());
    if (!t) return;
    const done = t.round >= 3;
    const me = getChar(t.player);
    const title = done ? (t.champion === t.player ? g(me, '¡CAMPEONA!', '¡CAMPEÓN!') : 'TORNEO TERMINADO') : ROUND_NAMES[t.round];
    const pw = w - 60, ph = h - 50;
    const p = panel(this, w / 2, h / 2 + 14, pw, ph, { title, titleColor: done && t.champion === t.player ? UI.yellow : UI.orange, wood: true });
    c.add(p);

    // cuadro: 3 columnas (cuartos, semis, final) + campeona
    const colX = [-pw / 2 + 40, -pw / 2 + 40 + pw * 0.24, -pw / 2 + 40 + pw * 0.48];
    const boxW = pw * 0.2, boxH = 44;
    const top = -ph / 2 + 70, area = ph - 210;
    const slotY = (round: number, i: number) => {
      const n = 8 >> round; // jugadoras en esa ronda
      const step = area / n;
      return top + step * i + step / 2;
    };
    const drawSlot = (round: number, i: number, id: string | undefined, winner: boolean, loser: boolean, score?: number) => {
      const x = colX[round], y = slotY(round, i);
      const g = this.add.graphics();
      const ch = id ? getChar(id) : null;
      const me = id === t.player;
      block(g, x, y - boxH / 2, boxW, boxH, me ? UI.orange : ch ? UI.inkSoft : 0x3a4560, { shadow: false, border: 3 });
      if (loser) { g.fillStyle(0x000000, 0.45); cutRect(g, x, y - boxH / 2, boxW, boxH, 0x000000, 0.45, 6); }
      p.add(g);
      if (ch) {
        const head = this.add.image(x + 26, y + boxH / 2 - 4, ch.tex, loser ? 'head_sad' : winner ? 'head_happy' : 'head').setOrigin(0.5, 1);
        head.setScale((boxH - 8) / head.height);
        p.add(head);
        p.add(label(this, x + 54, y, me ? `${ch.name} (TÚ)` : ch.name, 18, loser ? '#9aa3b8' : '#fff3d6').setOrigin(0, 0.5));
        if (score !== undefined) p.add(label(this, x + boxW - 14, y, String(score), 20, winner ? '#ffd23f' : '#9aa3b8').setOrigin(1, 0.5));
      } else p.add(label(this, x + boxW / 2, y, '—', 18, '#9aa3b8'));
      return { x, y };
    };
    const lines = this.add.graphics();
    lines.lineStyle(4, 0x1b2240, 0.8);
    p.add(lines);
    for (let r = 0; r < 3; r++) {
      const ms = t.rounds[r] ?? [];
      const n = 4 >> r;
      for (let k = 0; k < n; k++) {
        const m = ms[k];
        const ya = slotY(r, k * 2), yb = slotY(r, k * 2 + 1);
        drawSlot(r, k * 2, m?.a, !!m?.winner && m.winner === m.a, !!m?.winner && m.winner !== m.a, m?.score?.[0]);
        drawSlot(r, k * 2 + 1, m?.b, !!m?.winner && m.winner === m.b, !!m?.winner && m.winner !== m.b, m?.score?.[1]);
        const xr = colX[r] + boxW, xm = xr + (pw * 0.24 - boxW) / 2;
        const yn = r < 2 ? slotY(r + 1, k) : (ya + yb) / 2;
        lines.lineBetween(xr, ya, xm, ya).lineBetween(xr, yb, xm, yb).lineBetween(xm, ya, xm, yb).lineBetween(xm, yn, xm + (pw * 0.24 - boxW) / 2, yn);
      }
    }
    // trofeo / campeona
    const tx = -pw / 2 + 40 + pw * 0.72, ty = top + area / 2;
    const tg = this.add.graphics();
    block(tg, tx, ty - 110, pw * 0.22, 220, t.champion ? UI.yellow : UI.inkSoft);
    icon(tg, 'trophy', tx + pw * 0.11, ty - 50, 80, t.champion ? 0xfff3d6 : UI.yellow);
    p.add(tg);
    if (t.champion) {
      const ch = getChar(t.champion);
      const head = this.add.image(tx + pw * 0.11, ty + 70, ch.tex, 'head_happy').setOrigin(0.5, 1);
      head.setScale(80 / head.height);
      p.add([head, label(this, tx + pw * 0.11, ty + 92, ch.name, 22, '#1b2240', { stroke: '#fff3d6' })]);
    } else p.add(label(this, tx + pw * 0.11, ty + 50, 'CAMPEÓN/A', 20));

    // pie: sede de la siguiente ronda y botones
    const by = ph / 2 - 50;
    if (!done && !t.eliminated) {
      const v = getVenue(venueFor(t.round));
      const opp = playerMatch(t);
      const rivalId = opp ? (opp.a === t.player ? opp.b : opp.a) : '';
      p.add(label(this, -pw / 2 + 40, by - 6, `SEDE: ${v.name}`, 24, '#ffd23f').setOrigin(0, 0.5));
      p.add(label(this, -pw / 2 + 40, by + 24, `RIVAL: ${getChar(rivalId).name} · DIFICULTAD ${ROUND_DIFF[t.round].toUpperCase().replace('FACIL', 'FÁCIL').replace('DIFICIL', 'DIFÍCIL')}`, 20).setOrigin(0, 0.5));
      p.add(button(this, pw / 2 - 170, by, 300, 78, '¡A JUGAR!', () => this.play(t), { color: UI.orange, icon: 'play', size: 30 }).c);
      p.add(button(this, pw / 2 - 420, by, 180, 62, 'ABANDONAR', () => this.exit(), { color: UI.grey, size: 20 }).c);
    } else {
      const msg = t.champion === t.player ? '¡Has ganado el torneo de palas!' : t.eliminated ? g(me, 'Has quedado eliminada. ¡A por la revancha!', 'Has quedado eliminado. ¡A por la revancha!') : '';
      p.add(label(this, -pw / 2 + 40, by, msg, 26).setOrigin(0, 0.5));
      p.add(button(this, pw / 2 - 170, by, 300, 78, 'MENÚ', () => this.exit(), { color: UI.blue, icon: 'home', size: 30 }).c);
    }
  }

  private play(t: Tournament) {
    const m = playerMatch(t)!;
    const rival = m.a === t.player ? m.b : m.a;
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'play', points: t.points, p1: t.player, p2: rival, venue: venueFor(t.round), difficulty: ROUND_DIFF[t.round], tournament: true });
    this.scene.launch('Hud', { edit: false, standalone: false });
    this.scene.bringToTop('Hud');
    this.scene.stop();
  }

  private exit() {
    clearTournament();
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'attract' });
    this.scene.launch('Menu');
    this.scene.stop();
  }
}
