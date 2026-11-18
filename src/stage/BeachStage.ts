import Phaser from 'phaser';
import { COURT, COLORS, HORIZON_Y, STAGE_CX, STAGE_W, project } from '../config';
import { CAM_BASE_Y } from '../fx/CameraDirector';
import { SIL_TYPES } from '../core/textures';
import { PIXEL_FONT } from '../core/fonts';

/**
 * Escenario de playa compartido por todos los deportes.
 * Capas con parallax real (desplazamiento + zoom atenuado según la distancia),
 * público animado (balanceo, brazos arriba, carteles) y siluetas en primer plano.
 */

interface Layer { c: Phaser.GameObjects.Container; sx: number; sy: number; pinBottom?: boolean; screen?: boolean }
interface Fan { s: Phaser.GameObjects.Sprite; baseY: number; phase: number; sign: boolean; amp: number; up: number; keyA?: string; keyB?: string }

export class BeachStage {
  layers: Layer[] = [];
  fans: Fan[] = [];
  fg: Fan[] = [];
  private gulls: { s: Phaser.GameObjects.Sprite; vx: number; baseY: number; ph: number }[] = [];
  private sparkles: Phaser.GameObjects.Image[] = [];
  private flags: { s: Phaser.GameObjects.Image; ph: number }[] = [];
  private palms: Phaser.GameObjects.Image[] = [];
  private rays!: Phaser.GameObjects.Image;
  excitement = 0; // 0..1
  private frondL!: Phaser.GameObjects.Image;
  private frondR!: Phaser.GameObjects.Image;
  private frondBR!: Phaser.GameObjects.Image;
  private courtG!: Phaser.GameObjects.Graphics;
  private netG!: Phaser.GameObjects.Graphics;
  boardTexts: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {
    this.build();
  }

  private layer(sx: number, sy: number, depth: number) {
    const c = this.scene.add.container(0, 0).setDepth(depth);
    const l = { c, sx, sy };
    this.layers.push(l);
    return c;
  }

  private build() {
    const s = this.scene;
    // --- cielo de fondo (color de la fila superior del fondo pixel art)
    const sky = this.layer(0, 0, 0);
    sky.add(s.add.rectangle(STAGE_CX, CAM_BASE_Y, 6000, 3000, 0x6d96cd));
    // --- fondo pixel art (imagen del usuario a resolución nativa 377x160), en 3 bandas con paralaje:
    //     cielo (con el sol) / mar con islas (algo comprimido en vertical) / playa con sombrillas
    const tex = s.textures.get('plate');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!tex.has('sky')) {
      tex.add('sky', 0, 0, 0, 377, 72);
      tex.add('sea', 0, 0, 66, 377, 52);
      tex.add('beach', 0, 0, 112, 377, 48);
    }
    const S = 4.2; // px de mundo por px del fondo
    const PW = 377 * S;
    const plateBand = (layer: Phaser.GameObjects.Container, frame: string, top: number, sy = S) => {
      for (const k of [-1, 0, 1]) {
        layer.add(s.add.image(STAGE_CX + k * PW, top, 'plate', frame).setOrigin(0.5, 0).setScale(S, sy).setFlipX(k !== 0));
      }
    };
    const skyL = this.layer(0.12, 0.25, 1);
    plateBand(skyL, 'sky', HORIZON_Y - 55 - 72 * S + 40);
    const seaL = this.layer(0.3, 0.45, 2);
    const SEA_SY = 2.0;
    plateBand(seaL, 'sea', HORIZON_Y - 15 * SEA_SY, SEA_SY); // fila 81 del fondo = horizonte
    const beachL = this.layer(0.5, 0.65, 4);
    plateBand(beachL, 'beach', HORIZON_Y + 36 * SEA_SY - 7 * S);
    const sunX = STAGE_CX - PW / 2 + 117 * S;
    this.rays = s.add.image(sunX, HORIZON_Y - 55 - 72 * S + 40 + 31 * S, 'rays').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(1.4);
    skyL.add(this.rays);
    const bd = seaL;
    for (let i = 0; i < 40; i++) {
      // destellos del sol sobre el agua
      const near = Math.random() < 0.7;
      const x = near ? sunX + (Math.random() - 0.5) * 260 : STAGE_CX + (Math.random() - 0.5) * 1500;
      const y = HORIZON_Y + 4 + Math.random() * 60;
      const sp = s.add.image(x, y, 'square').setScale(Math.random() < 0.3 ? 1.4 : 0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.sparkles.push(sp);
      bd.add(sp);
    }
    // gaviotas pixel art
    const gl = this.layer(0.22, 0.3, 3);
    for (let i = 0; i < 6; i++) {
      const g = s.add.sprite(STAGE_CX - 900 + Math.random() * 1800, -20 + Math.random() * 170, 'gullpx', 'a').setScale(3 + Math.random() * 1.5);
      this.gulls.push({ s: g, vx: 20 + Math.random() * 30, baseY: g.y, ph: Math.random() * 6 });
      gl.add(g);
    }

    // bruma sobre el horizonte: separa fondo y primer plano (perspectiva atmosférica)
    const haze = this.layer(0.45, 0.6, 5);
    const hz = s.add.graphics();
    hz.fillGradientStyle(0xeaf7ff, 0xeaf7ff, 0xeaf7ff, 0xeaf7ff, 0, 0, 0.32, 0.32);
    hz.fillRect(STAGE_CX - 3000, HORIZON_Y - 160, 6000, 160);
    hz.fillGradientStyle(0xeaf7ff, 0xeaf7ff, 0xfff1d6, 0xfff1d6, 0.32, 0.32, 0.1, 0.1);
    hz.fillRect(STAGE_CX - 3000, HORIZON_Y, 6000, 120);
    haze.add(hz);

    // farolas
    const back = this.layer(0.64, 0.85, 6);
    for (const px of [-11.5, 11.5]) {
      const p = project(px, 0, COURT.fenceZ + 0.6);
      const pole = s.add.graphics();
      pole.fillStyle(0x5a6270, 1).fillRect(p.x - 5, p.y - 420, 10, 420);
      pole.fillStyle(0x8a94a4, 1).fillRect(p.x - 5, p.y - 420, 3, 420);
      pole.fillStyle(0x3a404c, 1).fillRect(p.x - 30, p.y - 436, 60, 22);
      pole.fillStyle(0xfff4c0, 1).fillRect(p.x - 26, p.y - 418, 52, 6);
      back.add(pole);
    }

    // banderines (de farola a farola)
    const bunt = this.layer(0.66, 0.88, 7);
    const pL = project(-11.5, 0, COURT.fenceZ + 0.6), pR = project(11.5, 0, COURT.fenceZ + 0.6);
    const flagCols = [0xff5a5a, 0xffd23f, 0x3ab0ff, 0x7bd389, 0xff9f1c, 0xc77dff];
    for (const [x0, x1, y0, sag] of [[pL.x, pR.x, pL.y - 405, 70], [pL.x - 700, pL.x, pL.y - 380, 50], [pR.x, pR.x + 700, pR.y - 380, 50]]) {
      const line = s.add.graphics();
      line.lineStyle(1.5, 0x555555, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        pts.push(new Phaser.Math.Vector2(x0 + (x1 - x0) * t, y0 + Math.sin(t * Math.PI) * sag));
      }
      line.strokePoints(pts);
      bunt.add(line);
      for (let i = 1; i < 30; i++) {
        const f = s.add.image(pts[i].x, pts[i].y, 'flag').setOrigin(0.5, 0).setTint(flagCols[i % flagCols.length]).setScale(1.1);
        this.flags.push({ s: f, ph: i * 0.6 });
        bunt.add(f);
      }
    }

    // público tras la valla del fondo
    const crowd = this.layer(0.69, 0.95, 8);
    // público ilustrado (atlas 'crowd': f0..f7 con pose tranquila 'a' y animando 'b', y perro)
    const rows = [
      { z: COURT.fenceZ + 1.7, n: 19, back: true },
      { z: COURT.fenceZ + 0.6, n: 15, back: false },
    ];
    const CROWD_SCALE = 2.45; // la altura del público ~60 % de la de las jugadoras
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const wx = -14.5 + (29 * i) / r.n + (Math.random() - 0.5) * 0.7 + (r.back ? 0 : 0.9);
        // hueco para el marcador detrás de la red
        if (!r.back && wx > 0.6 && wx < 3.4) continue;
        const p = project(wx, 0, r.z);
        let t = Math.floor(Math.random() * 8);
        if (!r.back && t === 5) t = Math.floor(Math.random() * 5); // el padre con el niño, sólo detrás
        const im = s.add.sprite(p.x, p.y, 'crowd', `f${t}a`).setOrigin(0.5, 1).setScale(CROWD_SCALE * p.k * (0.92 + Math.random() * 0.14));
        if (t !== 2 && t !== 3 && Math.random() < 0.5) im.setFlipX(true); // los carteles siempre de frente
        crowd.add(im);
        this.fans.push({ s: im, baseY: p.y, phase: Math.random() * 10, sign: t === 2 || t === 3, amp: 1 + Math.random() * 2, up: 0, keyA: `f${t}a`, keyB: `f${t}b` });
      }
    }
    for (const wx of [-6.2, 4.6, 9.5]) {
      const p = project(wx, 0, COURT.fenceZ + 0.35);
      const dog = s.add.sprite(p.x, p.y, 'crowd', 'dog_a').setOrigin(0.5, 1).setScale(CROWD_SCALE * p.k * 0.9).setFlipX(wx > 0);
      crowd.add(dog);
      this.fans.push({ s: dog, baseY: p.y, phase: Math.random() * 10, sign: false, amp: 0.5, up: 0, keyA: 'dog_a', keyB: 'dog_b' });
    }
    // marcador de madera detrás de la red
    const bp = project(2, 0, COURT.fenceZ + 0.45);
    const board = s.add.graphics();
    board.fillStyle(0x6b4a2b, 1).fillRect(bp.x - 4, bp.y - 70, 8, 70);
    board.fillStyle(0x7a5532, 1).fillRoundedRect(bp.x - 50, bp.y - 118, 100, 52, 6);
    board.fillStyle(0xf5ecd8, 1).fillRoundedRect(bp.x - 44, bp.y - 112, 40, 40, 4).fillRoundedRect(bp.x + 4, bp.y - 112, 40, 40, 4);
    crowd.add(board);
    for (let i = 0; i < 2; i++) {
      const t = s.add.text(bp.x - 24 + i * 48, bp.y - 92, '0', { fontFamily: PIXEL_FONT, fontSize: '26px', color: i === 0 ? '#e0611a' : '#14858c' }).setOrigin(0.5);
      this.boardTexts.push(t);
      crowd.add(t);
    }

    // --- pista (capa 1:1 con el mundo)
    const court = this.layer(1, 1, 10);
    this.buildCourt(court);

    // primer plano: hojas de palmera en las esquinas y siluetas del público
    const fronds = this.layer(1, 1, 500);
    this.layers[this.layers.length - 1].screen = true; // en coordenadas de pantalla: siempre en las esquinas
    this.frondL = s.add.image(0, 0, 'fronds').setOrigin(0.5, 0.05).setScale(1.05);
    this.frondR = s.add.image(0, 0, 'fronds').setOrigin(0.5, 0.05).setScale(-1.05, 1.05);
    this.palms.push(this.frondL, this.frondR);
    fronds.add([this.frondL, this.frondR]);

    const fgL = this.layer(1.28, 1.08, 600);
    this.layers[this.layers.length - 1].pinBottom = true; // siempre pegadas al borde inferior de la pantalla
    for (const row of [{ y: 832, sc: 0.4, n: 38, dx: 0 }, { y: 884, sc: 0.5, n: 28, dx: 60 }]) {
      for (let i = 0; i < row.n; i++) {
        const v = Math.floor(Math.random() * SIL_TYPES);
        const x = STAGE_CX - 1900 + row.dx + i * (3800 / row.n) + (Math.random() - 0.5) * 40;
        const y = row.y + Math.random() * 18;
        const im = s.add.sprite(x, y, `silS${v}a`).setOrigin(0.5, 0.72).setScale(row.sc * 0.95 * (0.9 + Math.random() * 0.2)).setFlipX(Math.random() < 0.5);
        fgL.add(im);
        this.fg.push({ s: im, baseY: y, phase: Math.random() * 10, sign: false, amp: 2 + Math.random() * 3, up: 0, keyA: `silS${v}a`, keyB: `silS${v}b` });
      }
    }
    // hoja de palmera oscura y desenfocada en la esquina inferior derecha (como en el vídeo)
    const fgPalm = this.layer(1, 1, 650);
    this.layers[this.layers.length - 1].screen = true;
    this.frondBR = s.add.image(0, 0, 'frondFg').setOrigin(1, 1).setScale(0.9);
    this.palms.push(this.frondBR);
    fgPalm.add(this.frondBR);
    // banda de arena/sombra inferior para tapar el borde
    const band = s.add.graphics();
    band.fillStyle(0x121722, 1).fillRect(STAGE_CX - 2400, 860, 4800, 300);
    fgL.addAt(band, 0);
  }

  private buildCourt(c: Phaser.GameObjects.Container) {
    const s = this.scene;
    // arena
    const sandTop = project(0, 0, COURT.fenceZ - 0.05).y; // empieza en la valla: el público de detrás se ve de cuerpo entero
    const sand = s.add.tileSprite(STAGE_CX, sandTop, STAGE_W + 1600, 900, 'sand').setOrigin(0.5, 0);
    c.add(sand);
    const shade = s.add.graphics();
    // sombreado suave bajo la valla
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.12, 0.12, 0, 0);
    shade.fillRect(STAGE_CX - 2000, project(0, 0, COURT.fenceZ).y, 4000, 40);
    c.add(shade);

    this.courtG = s.add.graphics().setDepth(11);
  }



  /** Pista, vallas y líneas: se redibujan cada frame porque la perspectiva depende de la cámara. */
  drawCourt() {
    const g = this.courtG;
    g.clear();
    const P = (x: number, y: number, z: number) => project(x, y, z);
    // valla del fondo: cristal abajo + malla arriba
    const fz = COURT.fenceZ, fx = COURT.fenceX;
    // fondo abierto en el centro (como en el vídeo): cristal + malla sólo en las esquinas
    const segs: [number, number][] = [[-fx, -5.3], [5.3, fx]];
    const mt = 3.9;
    for (const [x0, x1] of segs) {
      const n = Math.max(1, Math.round((x1 - x0) / 2.65));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step;
        const a = P(x, 0, fz), b = P(x + step, 0, fz), at = P(x, 2.1, fz), bt = P(x + step, 2.1, fz);
        g.fillStyle(0xbfe6f5, 0.2);
        g.fillPoints([at, bt, b, a].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        const am = P(x, 0.6, fz), bm = P(x + step, 0.6, fz);
        g.fillStyle(0xffffff, 0.1).fillPoints([am, bm, b, a].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        g.lineStyle(4, 0xffffff, 0.3);
        g.lineBetween(at.x + 16, at.y + 8, at.x + 50, a.y - 6);
        g.lineStyle(2, 0xffffff, 0.22);
        g.lineBetween(at.x + 34, at.y + 8, at.x + 62, at.y + 44);
      }
      g.lineStyle(1.5, 0x2b3038, 0.5);
      for (let x = x0; x <= x1 + 0.01; x += 0.45) {
        const a = P(x, 2.1, fz), b = P(x, mt, fz);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (let y = 2.1; y <= mt; y += 0.45) {
        const a = P(x0, y, fz), b = P(x1, y, fz);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (const [wdt, col, off] of [[8, 0x2b3038, 0], [2, 0xb4bfce, -2]] as [number, number, number][]) {
        g.lineStyle(wdt, col, 1);
        for (let i = 0; i <= n; i++) {
          const x = x0 + i * step;
          const a = P(x, 0, fz), b = P(x, mt, fz);
          g.lineBetween(a.x + off, a.y, b.x + off, b.y);
        }
        for (const y of [2.1, mt]) {
          const a = P(x0, y, fz), b = P(x1, y, fz);
          g.lineBetween(a.x, a.y + off, b.x, b.y + off);
        }
      }
    }
    // centro abierto: sólo un cordón bajo con postes (el público se ve de cuerpo entero, como en el vídeo)
    {
      const ropeY = 0.55;
      for (let x = -5.3; x <= 5.31; x += 2.65) {
        const a = P(x, 0, fz), b = P(x, ropeY + 0.08, fz);
        g.lineStyle(6, 0x2b3038, 1).lineBetween(a.x, a.y, b.x, b.y);
        g.fillStyle(0xffffff, 1).fillCircle(b.x, b.y, 3.5 * a.k);
      }
      g.lineStyle(3, 0xe8433a, 1);
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = -5.3 + (10.6 * i) / 40;
        const seg = ((x + 5.3) % 2.65) / 2.65;
        const q = P(x, ropeY - Math.sin(seg * Math.PI) * 0.12, fz);
        if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
      }
      g.strokePath();
    }
    // carteles en el cristal
    for (const x of [-8.6, 6.6]) {
      const a = P(x, 0.25, fz), b = P(x + 1.6, 0.85, fz);
      g.fillStyle(0xf4f8ff, 0.95).fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      g.lineStyle(3, 0x2a7fd6, 1);
      g.beginPath();
      g.moveTo(a.x + 8, a.y - 12);
      for (let i = 0; i <= 10; i++) g.lineTo(a.x + 8 + i * ((b.x - a.x - 16) / 10), a.y - 12 - Math.sin(i * 0.9) * 8);
      g.strokePath();
    }

    // laterales (cristal en perspectiva)
    const side = g;
    for (const sx of [-fx, fx]) {
      for (let z = -0.6; z < fz - 0.01; z += 2.55) {
        const z1 = Math.min(fz, z + 2.55);
        const a = P(sx, 0, z), b = P(sx, 0, z1), at = P(sx, 2.1, z), bt = P(sx, 2.1, z1);
        side.fillStyle(0xbfe6f5, 0.13);
        side.fillPoints([at, bt, b, a].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        side.lineStyle(2.5, 0xffffff, 0.2);
        side.lineBetween((at.x + bt.x) / 2, (at.y + bt.y) / 2 + 6, (a.x + b.x) / 2 - sx * 2, (a.y + b.y) / 2 - 10);
        side.lineStyle(5, 0x2b3038, 1);
        side.lineBetween(a.x, a.y, P(sx, mt, z).x, P(sx, mt, z).y);
        // malla
        side.lineStyle(1, 0x30343a, 0.45);
        for (let y = 2.1; y <= mt; y += 0.3) {
          const p0 = P(sx, y, z), p1 = P(sx, y, z1);
          side.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
        for (let zz = z; zz <= z1; zz += 0.35) {
          const p0 = P(sx, 2.1, zz), p1 = P(sx, mt, zz);
          side.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
      }
      side.lineStyle(5, 0x2b3038, 1);
      const a = P(sx, 2.1, -0.6), b = P(sx, 2.1, fz), c0 = P(sx, mt, -0.6), c1 = P(sx, mt, fz);
      side.lineBetween(a.x, a.y, b.x, b.y);
      side.lineBetween(c0.x, c0.y, c1.x, c1.y);
    }

    // sombra de la red sobre la arena
    {
      const z0 = -0.4, z1 = COURT.width + 0.4;
      const pts = [P(0, 0, z1), P(0, 0, z0), P(0.9, 0, z0 - 0.5), P(0.9, 0, z1 - 0.5)];
      g.fillStyle(0x6a4a20, 0.16).fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
    }
    // líneas de la pista (cinta azul)
    const lines = g;
    const L = COURT.halfLen, W = COURT.width;
    const corners = [P(-L, 0, 0), P(L, 0, 0), P(L, 0, W), P(-L, 0, W)];
    lines.lineStyle(5, COLORS.line, 0.95);
    lines.strokePoints(corners.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
    lines.lineStyle(2, 0xffffff, 0.35);
    lines.strokePoints(corners.map((p) => new Phaser.Math.Vector2(p.x, p.y - 1.5)), true);
    // línea de servicio
    for (const sx of [-1, 1]) {
      const a = P(sx * 3, 0, 0), b = P(sx * 3, 0, W);
      lines.lineStyle(3, COLORS.line, 0.6).lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  /** Red: se dibuja aparte para ordenarla en profundidad con jugadores/bola. */
  buildNet() {
    this.netG = this.scene.add.graphics().setDepth(100 + (12 - COURT.width / 2) * 10);
    return this.netG;
  }

  drawNet() {
    const P = (x: number, y: number, z: number) => project(x, y, z);
    const g = this.netG;
    g.clear();
    const z0 = -0.4, z1 = COURT.width + 0.4, h = COURT.netH;
    g.lineStyle(1.4, 0x15181f, 0.62);
    for (let z = z0; z <= z1; z += 0.18) {
      const a = P(0, 0.08, z), b = P(0, h - 0.06, z);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = 0.08; y <= h - 0.05; y += 0.13) {
      const a = P(0, y, z0), b = P(0, y, z1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const t0 = P(0, h, z0), t1 = P(0, h, z1);
    g.lineStyle(9, 0x1b2240, 1).lineBetween(t0.x, t0.y + 1, t1.x, t1.y + 1);
    g.lineStyle(6, 0xffffff, 1).lineBetween(t0.x, t0.y, t1.x, t1.y);
    for (const z of [z0, z1]) {
      const a = P(0, 0, z), b = P(0, h + 0.18, z);
      g.lineStyle(11, 0x1b2240, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(5, 0x5a6478, 1).lineBetween(a.x - 2, a.y, b.x - 2, b.y);
      g.fillStyle(0xffffff, 1).fillCircle(b.x, b.y, 6 * a.k);
    }
  }

  /** Posición del sol en el mundo (para el resplandor del etalonaje). */
  sunWorld() {
    const m = this.rays.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  setScore(a: number, b: number) {
    this.boardTexts[0]?.setText(String(a));
    this.boardTexts[1]?.setText(String(b));
  }

  /** El público reacciona: 1 = locura (especial / punto). */
  cheer(amount: number, foreground = true) {
    this.excitement = Math.min(1, Math.max(this.excitement, amount));
    for (const f of foreground ? [...this.fans, ...this.fg] : this.fans) if (Math.random() < amount * 0.85) f.up = 0.8 + Math.random() * 1.6 * amount;
  }

  /** Aplica el parallax real a cada capa según la cámara. */
  applyParallax(camX: number, camY: number, zoom: number) {
    const halfH = this.scene.cameras.main.height / (2 * zoom);
    for (const l of this.layers) {
      const c = Math.pow(zoom, l.sx - 1);
      const tx = camX - c * (STAGE_CX + l.sx * (camX - STAGE_CX));
      let ty = camY - c * (CAM_BASE_Y + l.sy * (camY - CAM_BASE_Y));
      if (l.pinBottom) ty = camY + halfH + 30 / zoom - c * 800 + Math.sin(this.scene.time.now * 0.0007) * 3;
      if (l.screen) {
        // tamaño constante en pantalla, anclado a la esquina superior de la vista
        const W = this.scene.cameras.main.width;
        l.c.setPosition(camX, camY - halfH).setScale(1 / zoom);
        const H = this.scene.cameras.main.height;
        this.frondL.setPosition(-W / 2 + 30, -40);
        this.frondR.setPosition(W / 2 - 30, -50);
        this.frondBR.setPosition(W / 2 + 40, H + 20).setScale(0.82 * Math.min(1.4, H / 720));
        continue;
      }
      l.c.setPosition(tx, ty).setScale(c);
    }
  }

  update(dt: number, time: number) {
    const t = time / 1000;
    this.rays.rotation += dt * 0.03;
    this.rays.setAlpha(0.3 + Math.sin(t * 0.8) * 0.1);
    for (const g of this.gulls) {
      g.s.x += g.vx * dt;
      g.s.y = g.baseY + Math.sin(t * 1.2 + g.ph) * 8;
      g.s.setFrame(Math.sin(t * 7 + g.ph) > 0 ? 'a' : 'b');
      if (g.s.x > STAGE_CX + 1400) g.s.x = STAGE_CX - 1400;
    }
    for (let i = 0; i < this.sparkles.length; i++) {
      // destellos "a pasos" (sin fundidos suaves): muy de 16 bits
      const v = Math.sin(t * (1.5 + (i % 5) * 0.7) + i * 1.7);
      this.sparkles[i].setAlpha(v > 0.6 ? 1 : v > 0.2 ? 0.5 : 0);
    }
    for (const f of this.flags) f.s.rotation = Math.sin(t * 3 + f.ph) * 0.25;
    for (let i = 0; i < this.palms.length; i++) this.palms[i].rotation = Math.sin(t * 0.6 + i) * 0.015;

    // público: balanceo base + saltos cuando están emocionados
    this.excitement = Math.max(0, this.excitement - dt * 0.25);
    for (const group of [this.fans, this.fg]) {
      for (const f of group) {
        if (f.up > 0) f.up -= dt;
        const up = f.up > 0;
        const isSil = group === this.fg;
        if (isSil) f.s.setTexture(up ? f.keyB! : f.keyA!);
        else f.s.setFrame(up ? f.keyB! : f.keyA!);
        const jump = up ? Math.abs(Math.sin(t * 9 + f.phase)) * 10 * f.amp * 0.6 : 0;
        // movimiento a saltos de 1 px de arte
        const bob = Math.round(Math.abs(Math.sin(t * 2 + f.phase)) * f.amp);
        f.s.y = f.baseY - bob - jump;
      }
    }
  }
}
