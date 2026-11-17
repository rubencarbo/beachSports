import Phaser from 'phaser';
import { COURT, COLORS, HORIZON_Y, STAGE_CX, STAGE_W, project } from '../config';
import { CAM_BASE_Y } from '../fx/CameraDirector';

/**
 * Escenario de playa compartido por todos los deportes.
 * Capas con parallax real (desplazamiento + zoom atenuado según la distancia),
 * público animado (balanceo, brazos arriba, carteles) y siluetas en primer plano.
 */

interface Layer { c: Phaser.GameObjects.Container; sx: number; sy: number; pinBottom?: boolean }
interface Fan { s: Phaser.GameObjects.Image; baseY: number; phase: number; keyA: string; keyB: string; amp: number; up: number }

export class BeachStage {
  layers: Layer[] = [];
  fans: Fan[] = [];
  fg: Fan[] = [];
  private gulls: { s: Phaser.GameObjects.Image; vx: number; baseY: number; ph: number }[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private sparkles: Phaser.GameObjects.Image[] = [];
  private flags: { s: Phaser.GameObjects.Image; ph: number }[] = [];
  private palms: Phaser.GameObjects.Image[] = [];
  private rays!: Phaser.GameObjects.Image;
  private boat!: Phaser.GameObjects.Image;
  private foam!: Phaser.GameObjects.Graphics;
  excitement = 0; // 0..1
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
    // --- cielo (capa infinita)
    const sky = this.layer(0, 0, 0);
    sky.add(s.add.image(STAGE_CX, CAM_BASE_Y - 120, 'sky').setDisplaySize(4200, 1400));
    // sol + rayos
    const sunL = this.layer(0.04, 0.1, 1);
    this.rays = s.add.image(STAGE_CX - 120, 40, 'rays').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.6);
    sunL.add(this.rays);
    sunL.add(s.add.image(STAGE_CX - 120, 40, 'sun').setScale(1.3).setBlendMode(Phaser.BlendModes.ADD));
    // nubes
    const cl = this.layer(0.1, 0.2, 2);
    for (let i = 0; i < 9; i++) {
      const c = s.add.image(STAGE_CX - 1500 + i * 380 + Math.random() * 120, 30 + Math.random() * 160, `cloud${i % 3}`).setScale(0.7 + Math.random() * 0.6).setAlpha(0.95);
      this.clouds.push(c);
      cl.add(c);
    }
    // gaviotas
    const gl = this.layer(0.2, 0.25, 3);
    for (let i = 0; i < 7; i++) {
      const g = s.add.image(STAGE_CX - 900 + Math.random() * 1800, 40 + Math.random() * 150, 'gull').setScale(0.6 + Math.random() * 0.5);
      this.gulls.push({ s: g, vx: 20 + Math.random() * 30, baseY: g.y, ph: Math.random() * 6 });
      gl.add(g);
    }
    // mar
    const sea = this.layer(0.3, 0.45, 4);
    sea.add(s.add.image(STAGE_CX, HORIZON_Y + 70, 'sea').setDisplaySize(4600, 150));
    sea.add(s.add.image(STAGE_CX + 650, HORIZON_Y - 18, 'island').setScale(1.4, 0.7).setAlpha(0.8));
    this.boat = s.add.image(STAGE_CX - 60, HORIZON_Y + 4, 'boat').setScale(0.55);
    sea.add(this.boat);
    for (let i = 0; i < 70; i++) {
      // reflejo del sol en el agua: más brillos cerca del eje del sol
      const spread = Math.random() < 0.6 ? 300 : 1800;
      const sp = s.add.image(STAGE_CX - 120 + (Math.random() - 0.5) * spread * 2, HORIZON_Y + 6 + Math.random() * 120, 'sparkle')
        .setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 + Math.random() * 0.6).setAlpha(Math.random());
      this.sparkles.push(sp);
      sea.add(sp);
    }
    this.foam = s.add.graphics();
    sea.add(this.foam);

    // playa lejana con sombrillas, hamacas y bañistas
    const far = this.layer(0.42, 0.6, 5);
    const farSand = s.add.graphics();
    farSand.fillStyle(0xf3dcaa, 1).fillRect(STAGE_CX - 2600, HORIZON_Y + 140, 5200, 400);
    farSand.fillStyle(0xe9cf98, 1).fillRect(STAGE_CX - 2600, HORIZON_Y + 140, 5200, 8);
    far.add(farSand);
    for (let i = 0; i < 16; i++) {
      const ux = STAGE_CX - 1800 + i * 240 + Math.random() * 80;
      far.add(s.add.image(ux, HORIZON_Y + 150, 'umbrella').setScale(0.75));
      if (Math.random() < 0.7) far.add(s.add.image(ux + 30, HORIZON_Y + 175, 'chair').setScale(0.8));
      if (Math.random() < 0.6) far.add(s.add.image(ux - 30, HORIZON_Y + 170, `fan${Math.floor(Math.random() * 14)}a`).setScale(0.45));
    }

    // farolas y palmeras traseras
    const back = this.layer(0.64, 0.85, 6);
    for (const px of [-11.5, 11.5]) {
      const p = project(px, 0, COURT.fenceZ + 0.6);
      const pole = s.add.graphics();
      pole.fillStyle(0x6a7380, 1).fillRect(p.x - 4, p.y - 420, 8, 420);
      pole.fillStyle(0x4a525c, 1).fillRect(p.x - 26, p.y - 432, 52, 18);
      pole.fillStyle(0xfff8d0, 1).fillRect(p.x - 22, p.y - 418, 44, 5);
      back.add(pole);
    }
    for (const [px, key, sc] of [[-17, 'palm', 1.05], [16.5, 'palmR', 1.1], [-26, 'palm', 0.9], [25, 'palmR', 0.95]] as [number, string, number][]) {
      const p = project(px, 0, COURT.fenceZ + 2);
      const palm = s.add.image(p.x, p.y + 10, key).setOrigin(key === 'palm' ? 0.2 : 0.8, 1).setScale(sc);
      this.palms.push(palm);
      back.add(palm);
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
    const rows = [
      { z: COURT.fenceZ + 1.9, sc: 0.78, n: 36 },
      { z: COURT.fenceZ + 1.2, sc: 0.84, n: 34 },
      { z: COURT.fenceZ + 0.55, sc: 0.9, n: 30 },
    ];
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const wx = -15 + (30 * i) / r.n + (Math.random() - 0.5) * 0.4;
        // hueco para el marcador detrás de la red
        if (r.z < COURT.fenceZ + 0.8 && wx > 0.6 && wx < 3.4) continue;
        const p = project(wx, 0, r.z);
        const idx = Math.floor(Math.random() * 14);
        const im = s.add.image(p.x, p.y, `fan${idx}a`).setOrigin(0.5, 1).setScale(r.sc * (0.9 + Math.random() * 0.2));
        crowd.add(im);
        this.fans.push({ s: im, baseY: p.y, phase: Math.random() * 10, keyA: `fan${idx}a`, keyB: `fan${idx}b`, amp: 1 + Math.random() * 2, up: 0 });
      }
    }
    for (const wx of [-4.5, 2.8, 6.5]) {
      const p = project(wx, 0, COURT.fenceZ + 0.4);
      crowd.add(s.add.image(p.x, p.y, 'dog').setOrigin(0.5, 1).setScale(0.8));
    }
    // marcador de madera detrás de la red
    const bp = project(2, 0, COURT.fenceZ + 0.45);
    const board = s.add.graphics();
    board.fillStyle(0x6b4a2b, 1).fillRect(bp.x - 4, bp.y - 70, 8, 70);
    board.fillStyle(0x7a5532, 1).fillRoundedRect(bp.x - 50, bp.y - 118, 100, 52, 6);
    board.fillStyle(0xf5ecd8, 1).fillRoundedRect(bp.x - 44, bp.y - 112, 40, 40, 4).fillRoundedRect(bp.x + 4, bp.y - 112, 40, 40, 4);
    crowd.add(board);
    for (let i = 0; i < 2; i++) {
      const t = s.add.text(bp.x - 24 + i * 48, bp.y - 92, '0', { fontFamily: 'Lilita One, Arial Black, sans-serif', fontSize: '32px', color: i === 0 ? '#e0611a' : '#14858c' }).setOrigin(0.5);
      this.boardTexts.push(t);
      crowd.add(t);
    }

    // --- pista (capa 1:1 con el mundo)
    const court = this.layer(1, 1, 10);
    this.buildCourt(court);

    // primer plano: hojas de palmera en las esquinas y siluetas del público
    const fronds = this.layer(1.12, 1.05, 500);
    const fl = s.add.image(STAGE_CX - 1050, -40, 'fronds').setOrigin(0.5, 0).setScale(1.4);
    const fr = s.add.image(STAGE_CX + 1050, -60, 'fronds').setOrigin(0.5, 0).setScale(-1.4, 1.4);
    this.palms.push(fl, fr);
    fronds.add([fl, fr]);

    const fgL = this.layer(1.28, 1.08, 600);
    this.layers[this.layers.length - 1].pinBottom = true; // siempre pegadas al borde inferior de la pantalla
    for (let i = 0; i < 26; i++) {
      const v = Math.floor(Math.random() * 4);
      const x = STAGE_CX - 1700 + i * 135 + Math.random() * 40;
      const y = 800 + Math.random() * 25;
      const im = s.add.image(x, y, `sil${v}a`).setOrigin(0.5, 1).setScale(0.62 + Math.random() * 0.2);
      fgL.add(im);
      this.fg.push({ s: im, baseY: y, phase: Math.random() * 10, keyA: `sil${v}a`, keyB: `sil${v}b`, amp: 2 + Math.random() * 3, up: 0 });
    }
    // banda de arena/sombra inferior para tapar el borde
    const band = s.add.graphics();
    band.fillStyle(0x161c28, 1).fillRect(STAGE_CX - 2400, 795, 4800, 300);
    fgL.addAt(band, 0);
  }

  private buildCourt(c: Phaser.GameObjects.Container) {
    const s = this.scene;
    // arena
    const sandTop = project(0, 0, COURT.fenceZ + 2.5).y;
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
    // cristales del fondo
    for (let x = -fx; x < fx - 0.01; x += 2.65) {
      const a = P(x, 0, fz), b = P(x + 2.65, 0, fz), at = P(x, 2.1, fz), bt = P(x + 2.65, 2.1, fz);
      g.fillStyle(0xbfe6f5, 0.16);
      g.fillPoints([at, bt, b, a].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
      g.lineStyle(3, 0xffffff, 0.22);
      g.lineBetween(at.x + 20, at.y + 8, at.x + 60, a.y - 6);
      g.lineBetween(at.x + 40, at.y + 8, at.x + 70, at.y + 40);
    }
    // malla superior
    const mt = 3.9;
    g.lineStyle(1, 0x30343a, 0.55);
    for (let x = -fx; x <= fx; x += 0.35) {
      const a = P(x, 2.1, fz), b = P(x, mt, fz);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = 2.1; y <= mt; y += 0.3) {
      const a = P(-fx, y, fz), b = P(fx, y, fz);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    // postes y marcos
    g.lineStyle(5, 0x2b3038, 1);
    for (let x = -fx; x <= fx + 0.01; x += 2.65) {
      const a = P(x, 0, fz), b = P(x, mt, fz);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const r0 = P(-fx, 2.1, fz), r1 = P(fx, 2.1, fz), t0 = P(-fx, mt, fz), t1 = P(fx, mt, fz);
    g.lineBetween(r0.x, r0.y, r1.x, r1.y);
    g.lineBetween(t0.x, t0.y, t1.x, t1.y);
    // carteles en el cristal
    for (const x of [-8.5, -3.2, 5.5]) {
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
    g.lineStyle(1, 0x1c1c1c, 0.5);
    for (let z = z0; z <= z1; z += 0.2) {
      const a = P(0, 0.05, z), b = P(0, h, z);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = 0.05; y <= h; y += 0.14) {
      const a = P(0, y, z0), b = P(0, y, z1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const t0 = P(0, h, z0), t1 = P(0, h, z1);
    g.lineStyle(5, 0xffffff, 1).lineBetween(t0.x, t0.y, t1.x, t1.y);
    for (const z of [z0, z1]) {
      const a = P(0, 0, z), b = P(0, h + 0.15, z);
      g.lineStyle(7, 0x2b3038, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  setScore(a: number, b: number) {
    this.boardTexts[0]?.setText(String(a));
    this.boardTexts[1]?.setText(String(b));
  }

  /** El público reacciona: 1 = locura (especial / punto). */
  cheer(amount: number) {
    this.excitement = Math.min(1, Math.max(this.excitement, amount));
    for (const f of [...this.fans, ...this.fg]) if (Math.random() < amount * 0.85) f.up = 0.8 + Math.random() * 1.6 * amount;
  }

  /** Aplica el parallax real a cada capa según la cámara. */
  applyParallax(camX: number, camY: number, zoom: number) {
    const halfH = this.scene.cameras.main.height / (2 * zoom);
    for (const l of this.layers) {
      const c = Math.pow(zoom, l.sx - 1);
      const tx = camX - c * (STAGE_CX + l.sx * (camX - STAGE_CX));
      let ty = camY - c * (CAM_BASE_Y + l.sy * (camY - CAM_BASE_Y));
      if (l.pinBottom) ty = camY + halfH + 30 / zoom - c * 800 + Math.sin(this.scene.time.now * 0.0007) * 3;
      l.c.setPosition(tx, ty).setScale(c);
    }
  }

  update(dt: number, time: number) {
    const t = time / 1000;
    this.rays.rotation += dt * 0.03;
    this.rays.setAlpha(0.45 + Math.sin(t * 0.8) * 0.12);
    for (const c of this.clouds) {
      c.x += dt * 6;
      if (c.x > STAGE_CX + 1800) c.x = STAGE_CX - 1800;
    }
    for (const g of this.gulls) {
      g.s.x += g.vx * dt;
      g.s.y = g.baseY + Math.sin(t * 1.2 + g.ph) * 8;
      g.s.setTexture(Math.sin(t * 7 + g.ph) > 0 ? 'gull' : 'gull2');
      if (g.s.x > STAGE_CX + 1400) g.s.x = STAGE_CX - 1400;
    }
    for (let i = 0; i < this.sparkles.length; i++) {
      const sp = this.sparkles[i];
      sp.setAlpha(Math.max(0, Math.sin(t * (1.5 + (i % 5) * 0.7) + i * 1.7)));
    }
    this.boat.y = HORIZON_Y + 4 + Math.sin(t * 1.3) * 2;
    this.boat.rotation = Math.sin(t * 1.1) * 0.04;
    this.boat.x += dt * 3;
    // espuma de la orilla
    this.foam.clear();
    this.foam.lineStyle(4, 0xffffff, 0.75);
    const fy = HORIZON_Y + 136 + Math.sin(t * 0.9) * 5;
    this.foam.beginPath();
    for (let x = -2300; x <= 2300; x += 40) {
      const y = fy + Math.sin(x * 0.01 + t * 1.5) * 3;
      if (x === -2300) this.foam.moveTo(STAGE_CX + x, y); else this.foam.lineTo(STAGE_CX + x, y);
    }
    this.foam.strokePath();
    for (const f of this.flags) f.s.rotation = Math.sin(t * 3 + f.ph) * 0.25;
    for (let i = 0; i < this.palms.length; i++) this.palms[i].rotation = Math.sin(t * 0.6 + i) * 0.015;

    // público: balanceo base + saltos cuando están emocionados
    this.excitement = Math.max(0, this.excitement - dt * 0.25);
    for (const group of [this.fans, this.fg]) {
      for (const f of group) {
        if (f.up > 0) f.up -= dt;
        const up = f.up > 0;
        f.s.setTexture(up ? f.keyB : f.keyA);
        const jump = up ? Math.abs(Math.sin(t * 9 + f.phase)) * 10 * f.amp * 0.6 : 0;
        f.s.y = f.baseY - Math.abs(Math.sin(t * 2 + f.phase)) * f.amp - jump;
      }
    }
  }
}
