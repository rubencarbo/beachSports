import Phaser from 'phaser';
import { applyRetro } from '../fx/RetroPipeline';
import { CharDef, getChar, getRoster, randomChar } from '../game/roster';
import { startTournament, venueFor } from '../game/tournament';
import { VENUES } from '../game/venues';
import { UI, block, button, cutRect, label, panel, shade } from '../ui/kit';

export interface SelectConfig { mode: 'friendly' | 'tournament'; difficulty: 'facil' | 'normal' | 'dificil'; points: number; sport?: 'palas' | 'futvoley'; format?: '1v1' | '2v2' }

/** Elección de personaje (y, en amistoso, rival y sede) antes del partido. */
export class SelectScene extends Phaser.Scene {
  private cfg!: SelectConfig;
  private pick = 'sol';
  private rival = 'random';
  private venue = 'mediodia';
  private step: 'player' | 'partner' | 'rival' = 'player';
  private partner = 'random';
  private root!: Phaser.GameObjects.Container;

  constructor() { super('Select'); }

  init(d: SelectConfig) {
    this.cfg = d;
    this.step = 'player';
    this.partner = 'random';
    try { this.pick = localStorage.getItem('beachsports.lastChar') || 'sol'; } catch { this.pick = 'sol'; }
    if (!getRoster().some((c) => c.id === this.pick)) this.pick = 'sol';
  }

  create() {
    this.root = this.add.container(0, 0);
    applyRetro(this.cameras.main, 2000);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
  }

  private build() {
    this.root.removeAll(true);
    const w = this.scale.width, h = this.scale.height;
    const c = this.root;
    c.add(this.add.rectangle(0, 0, w, h, 0x0b1a2a, 0.62).setOrigin(0).setInteractive());
    const choosingRival = this.step !== 'player';
    const partnerStep = this.step === 'partner';
    const title = partnerStep ? 'ELIGE TU COMPAÑERO/A' : choosingRival ? (this.cfg.format === '2v2' ? 'ELIGE RIVAL (CAPITÁN) Y SEDE' : 'ELIGE RIVAL Y SEDE') : this.cfg.mode === 'tournament' ? 'TORNEO · ELIGE PERSONAJE' : 'ELIGE TU PERSONAJE';
    const pw = w - 60, ph = h - 50;
    const p = panel(this, w / 2, h / 2 + 14, pw, ph, { title, titleColor: choosingRival ? UI.teal : UI.orange, wood: true });
    c.add(p);
    const sel = partnerStep ? this.partner : choosingRival ? this.rival : this.pick;
    const roster = getRoster();
    const chosen = sel === 'random' ? null : getChar(sel);

    // ficha grande de la seleccionada (izquierda)
    const cardW = Math.min(360, pw * 0.3);
    const cx0 = -pw / 2 + 30 + cardW / 2;
    const cardH = ph - 190;
    const cg = this.add.graphics();
    block(cg, cx0 - cardW / 2, -ph / 2 + 54, cardW, cardH, chosen ? chosen.color : UI.grey);
    cutRect(cg, cx0 - cardW / 2 + 12, -ph / 2 + 66, cardW - 24, cardH - 160, 0x8fd3f5, 1, 6);
    cg.fillStyle(0xffe2a3, 1).fillRect(cx0 - cardW / 2 + 12, -ph / 2 + 66 + cardH - 220, cardW - 24, 60);
    p.add(cg);
    if (chosen) {
      const full = this.add.image(cx0, -ph / 2 + 66 + cardH - 170, chosen.tex, chosen.data.frames.full ? 'full' : 'head').setOrigin(0.5, 1);
      full.setScale(Math.min((cardH - 190) / full.height, (cardW - 40) / full.width));
      p.add(full);
      this.tweens.add({ targets: full, y: full.y - 6, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });
      p.add(label(this, cx0, -ph / 2 + 66 + cardH - 132, chosen.name, 34, '#fff3d6', { title: true }));
      const st = chosen.stats;
      const rows: [string, number][] = [['VELOCIDAD', st.speed], ['POTENCIA', st.power], ['CONTROL', st.control]];
      rows.forEach(([n, v], i) => {
        const yy = -ph / 2 + 66 + cardH - 92 + i * 30;
        p.add(label(this, cx0 - cardW / 2 + 24, yy, n, 18).setOrigin(0, 0.5));
        const g = this.add.graphics();
        for (let k = 0; k < 5; k++) { g.fillStyle(UI.ink, 1).fillRect(cx0 + 20 + k * 26, yy - 9, 22, 18); g.fillStyle(k < v ? UI.yellow : 0x4a5570, 1).fillRect(cx0 + 22 + k * 26, yy - 7, 18, 14); }
        p.add(g);
      });
      p.add(label(this, cx0, -ph / 2 + 66 + cardH + 8, chosen.element === 'sun' ? 'ESPECIAL: FUEGO' : 'ESPECIAL: AGUA', 18, chosen.element === 'sun' ? '#ffb020' : '#5ff0ff'));
    } else {
      p.add(label(this, cx0, -ph / 2 + 54 + cardH / 2 - 40, '?', 120, '#fff3d6', { title: true }));
      p.add(label(this, cx0, -ph / 2 + 54 + cardH / 2 + 60, 'RIVAL AL AZAR', 26));
    }

    // rejilla de jugadoras (derecha)
    const gx0 = cx0 + cardW / 2 + 30, gw = pw / 2 - 30 - gx0;
    const items: (CharDef | null)[] = [...roster];
    if (choosingRival) items.unshift(null);
    const cols = 4;
    const cw = (gw - (cols - 1) * 12) / cols;
    const rowsN = Math.ceil(items.length / cols);
    const gridTop = -ph / 2 + 54;
    const gridH = choosingRival && !partnerStep ? ph - 330 : ph - 190;
    const chh = Math.min(cw * 1.15, (gridH - (rowsN - 1) * 12) / rowsN);
    items.forEach((ch, i) => {
      const x = gx0 + (i % cols) * (cw + 12), y = gridTop + Math.floor(i / cols) * (chh + 12);
      const id = ch ? ch.id : 'random';
      const isSel = id === sel;
      const taken = choosingRival && ch && (ch.id === this.pick || (!partnerStep && ch.id === this.partner));
      const g = this.add.graphics();
      block(g, x, y, cw, chh, isSel ? UI.yellow : ch ? shade(ch.color, 0.75) : UI.grey, { depth: isSel ? 0 : 4 });
      cutRect(g, x + 8, y + 8, cw - 16, chh - 40, 0x8fd3f5, 1, 4);
      p.add(g);
      if (ch) {
        const head = this.add.image(x + cw / 2, y + chh - 36, ch.tex, 'head').setOrigin(0.5, 1);
        head.setScale(Math.min((chh - 52) / head.height, (cw - 24) / head.width));
        if (taken) head.setAlpha(0.35);
        p.add(head);
        p.add(label(this, x + cw / 2, y + chh - 18, ch.name, 18, isSel ? '#1b2240' : '#fff3d6', isSel ? { stroke: '#fff3d6' } : {}));
      } else {
        p.add(label(this, x + cw / 2, y + chh / 2 - 12, '?', 46, '#fff3d6', { title: true }));
        p.add(label(this, x + cw / 2, y + chh - 18, 'AZAR', 18));
      }
      const hit = this.add.rectangle(x + cw / 2, y + chh / 2, cw, chh, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (taken) return;
        if (partnerStep) this.partner = id; else if (choosingRival) this.rival = id; else this.pick = id;
        this.build();
      });
      p.add(hit);
    });

    // sedes (sólo amistoso, paso de rival)
    if (choosingRival && !partnerStep) {
      const vy = gridTop + gridH + 26;
      p.add(label(this, gx0, vy, 'SEDE', 24).setOrigin(0, 0.5));
      const vw = (gw - 100 - 2 * 12) / 3;
      VENUES.forEach((v, i) => {
        const x = gx0 + 100 + i * (vw + 12);
        p.add(button(this, x + vw / 2, vy, vw, 58, v.short, () => { this.venue = v.id; this.build(); }, { active: this.venue === v.id, activeColor: UI.teal, size: 20 }).c);
      });
    }

    // botones inferiores
    const by = ph / 2 - 52;
    p.add(button(this, -pw / 2 + 140, by, 220, 70, 'ATRÁS', () => this.back(), { color: UI.grey, size: 24 }).c);
    const next = this.cfg.mode === 'friendly' && this.step !== 'rival' ? 'SIGUIENTE' : this.cfg.mode === 'tournament' ? '¡AL TORNEO!' : '¡JUGAR!';
    p.add(button(this, pw / 2 - 180, by, 300, 78, next, () => this.next(), { color: UI.orange, icon: 'play', size: 30 }).c);
  }

  private back() {
    if (this.step === 'rival') { this.step = this.cfg.format === '2v2' ? 'partner' : 'player'; this.build(); return; }
    if (this.step === 'partner') { this.step = 'player'; this.build(); return; }
    this.scene.launch('Menu');
    this.scene.stop();
  }

  private next() {
    try { localStorage.setItem('beachsports.lastChar', this.pick); } catch { /* ignorar */ }
    const duo = this.cfg.format === '2v2';
    if (this.cfg.mode === 'friendly') {
      if (this.step === 'player') { this.step = duo ? 'partner' : 'rival'; this.build(); return; }
      if (this.step === 'partner') { this.step = 'rival'; this.build(); return; }
      const mate = this.partner === 'random' ? randomChar([this.pick]).id : this.partner;
      const rival = this.rival === 'random' ? randomChar([this.pick, mate]).id : this.rival;
      if (this.cfg.sport === 'futvoley') {
        const team2 = duo ? [rival, randomChar([this.pick, mate, rival]).id] : [rival];
        this.launchFoot({ team1: duo ? [this.pick, mate] : [this.pick], team2 });
        return;
      }
      this.launchMatch({ p1: this.pick, p2: rival, venue: this.venue, difficulty: this.cfg.difficulty, tournament: false });
      return;
    }
    startTournament(this.pick, this.cfg.points, this.cfg.sport ?? 'palas');
    this.scene.launch('Bracket');
    this.scene.stop();
    void venueFor;
  }

  private launchFoot(o: { team1: string[]; team2: string[] }) {
    this.scene.stop('Match');
    this.scene.start('Foot', { mode: 'play', points: this.cfg.points, difficulty: this.cfg.difficulty, format: this.cfg.format ?? '1v1', venue: this.venue, tournament: false, ...o });
    this.scene.launch('Hud', { edit: false, standalone: false, game: 'Foot' });
    this.scene.bringToTop('Hud');
    this.scene.stop();
  }

  private launchMatch(o: { p1: string; p2: string; venue: string; difficulty: string; tournament: boolean }) {
    this.scene.stop('Match');
    this.scene.start('Match', { mode: 'play', points: this.cfg.points, ...o });
    this.scene.launch('Hud', { edit: false, standalone: false });
    this.scene.bringToTop('Hud');
    this.scene.stop();
  }
}
