import Phaser from 'phaser';

// Todo el arte se genera proceduralmente en canvas (cero assets descargados).
// Se puede sustituir más adelante por sprite sheets dibujados a mano con las mismas keys.

type Ctx = CanvasRenderingContext2D;

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const c = tex.getContext();
  draw(c, w, h);
  tex.refresh();
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const SKINS = ['#f5c9a0', '#e8b088', '#c98c5e', '#a8693f', '#7a4a2a', '#f2d3b3'];
const HAIRS = ['#2b1a10', '#5a3418', '#e0b040', '#1a1a1a', '#a0401a', '#704020', '#d9d0c0'];
const SHIRTS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff9f45', '#ffffff', '#c77dff', '#2ec4b6', '#f15bb5', '#00bbf9'];
const SHORTS = ['#2d3a8c', '#1b6f6a', '#333333', '#8c2d2d', '#3d7ad6', '#e2c08d'];

function outlinePath(c: Ctx, color = '#2a1a12', w = 2) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke();
}

function drawPerson(c: Ctx, w: number, h: number, armsUp: boolean, seed: { skin: string; hair: string; shirt: string; shorts: string; hairStyle: number; sign: number; cap: boolean }) {
  const cx = w / 2;
  const headR = w * 0.24;
  const headY = h * 0.22;
  // piernas
  c.fillStyle = seed.skin;
  c.fillRect(cx - 7, h * 0.66, 5, h * 0.28);
  c.fillRect(cx + 2, h * 0.66, 5, h * 0.28);
  // shorts
  c.fillStyle = seed.shorts;
  c.fillRect(cx - 9, h * 0.6, 18, h * 0.12);
  // cuerpo
  c.beginPath();
  c.fillStyle = seed.shirt;
  c.roundRect(cx - 10, h * 0.36, 20, h * 0.27, 5);
  c.fill();
  outlinePath(c, 'rgba(40,25,15,.6)', 1.5);
  // brazos
  c.strokeStyle = seed.skin;
  c.lineWidth = 4.5;
  c.lineCap = 'round';
  c.beginPath();
  if (armsUp) {
    c.moveTo(cx - 9, h * 0.4); c.lineTo(cx - 15, h * 0.08);
    c.moveTo(cx + 9, h * 0.4); c.lineTo(cx + 15, h * 0.08);
  } else {
    c.moveTo(cx - 9, h * 0.4); c.lineTo(cx - 13, h * 0.6);
    c.moveTo(cx + 9, h * 0.4); c.lineTo(cx + 13, h * 0.6);
  }
  c.stroke();
  // cabeza
  c.beginPath();
  c.fillStyle = seed.skin;
  c.arc(cx, headY, headR, 0, Math.PI * 2);
  c.fill();
  outlinePath(c, 'rgba(40,25,15,.7)', 1.5);
  // pelo
  c.fillStyle = seed.hair;
  c.beginPath();
  if (seed.hairStyle === 0) {
    c.arc(cx, headY - 2, headR, Math.PI, 0);
  } else if (seed.hairStyle === 1) {
    c.arc(cx, headY - 1, headR + 1.5, Math.PI * 0.9, Math.PI * 2.1);
    c.rect(cx - headR - 1.5, headY - 2, 4, headR + 6);
    c.rect(cx + headR - 2.5, headY - 2, 4, headR + 6);
  } else {
    c.arc(cx, headY - 3, headR * 0.8, Math.PI, 0);
  }
  c.fill();
  if (seed.cap) {
    c.fillStyle = pick(['#ff3b3b', '#2d6cdf', '#ffffff', '#ffd23f']);
    c.beginPath();
    c.arc(cx, headY - 2, headR + 1, Math.PI, 0);
    c.fill();
    c.fillRect(cx, headY - 4, headR + 6, 3);
  }
  // ojos
  c.fillStyle = '#1a1010';
  c.fillRect(cx - 4, headY + 1, 2, 3);
  c.fillRect(cx + 2, headY + 1, 2, 3);
  if (armsUp) {
    c.beginPath();
    c.fillStyle = '#7a2020';
    c.arc(cx, headY + 6, 2.4, 0, Math.PI);
    c.fill();
  }
  // cartel
  if (armsUp && seed.sign > 0) {
    c.fillStyle = '#fffaf0';
    c.fillRect(cx - 16, h * 0.0, 32, 22);
    c.strokeStyle = '#555';
    c.lineWidth = 1;
    c.strokeRect(cx - 16, h * 0.0, 32, 22);
    if (seed.sign === 1) {
      c.fillStyle = '#ffb000';
      c.beginPath(); c.arc(cx, 11, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffb000'; c.lineWidth = 1.5;
      for (let a = 0; a < 8; a++) { c.beginPath(); c.moveTo(cx + Math.cos(a) * 8, 11 + Math.sin(a) * 8); c.lineTo(cx + Math.cos(a) * 10.5, 11 + Math.sin(a) * 10.5); c.stroke(); }
    } else {
      c.strokeStyle = '#1e7fd8'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(cx - 12, 15); c.quadraticCurveTo(cx - 6, 3, cx, 13); c.quadraticCurveTo(cx + 6, 3, cx + 12, 13); c.stroke();
    }
  }
}

function drawSilhouette(c: Ctx, w: number, h: number, variant: number, armsUp: boolean) {
  c.fillStyle = '#1c2433';
  const cx = w / 2;
  // hombros
  c.beginPath();
  c.ellipse(cx, h * 0.98, w * 0.42, h * 0.38, 0, Math.PI, 0);
  c.fill();
  // cabeza
  c.beginPath();
  c.ellipse(cx, h * 0.48, w * 0.2, h * 0.19, 0, 0, Math.PI * 2);
  c.fill();
  if (variant === 1) { // gorra
    c.beginPath(); c.ellipse(cx, h * 0.38, w * 0.22, h * 0.1, 0, Math.PI, 0); c.fill();
    c.fillRect(cx, h * 0.36, w * 0.32, h * 0.04);
  } else if (variant === 2) { // pelo largo
    c.beginPath(); c.ellipse(cx, h * 0.55, w * 0.24, h * 0.24, 0, 0, Math.PI * 2); c.fill();
  } else if (variant === 3) { // cámara
    c.fillRect(cx + w * 0.12, h * 0.42, w * 0.22, h * 0.12);
    c.beginPath(); c.arc(cx + w * 0.36, h * 0.48, h * 0.06, 0, Math.PI * 2); c.fill();
  }
  if (armsUp) {
    c.strokeStyle = '#1c2433';
    c.lineWidth = w * 0.11;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - w * 0.3, h * 0.75); c.lineTo(cx - w * 0.36, h * 0.12);
    c.moveTo(cx + w * 0.3, h * 0.75); c.lineTo(cx + w * 0.36, h * 0.12);
    c.stroke();
    c.beginPath(); c.arc(cx - w * 0.36, h * 0.1, w * 0.08, 0, Math.PI * 2); c.arc(cx + w * 0.36, h * 0.1, w * 0.08, 0, Math.PI * 2); c.fill();
  }
  // borde iluminado (contraluz)
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(120,150,190,.25)';
  c.fillRect(0, 0, w, h * 0.3);
  c.globalCompositeOperation = 'source-over';
}

function drawPalm(c: Ctx, w: number, h: number, flip: boolean) {
  if (flip) { c.translate(w, 0); c.scale(-1, 1); }
  // tronco curvo
  c.strokeStyle = '#7a5530';
  c.lineWidth = 16;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(w * 0.2, h);
  c.quadraticCurveTo(w * 0.25, h * 0.45, w * 0.55, h * 0.18);
  c.stroke();
  c.strokeStyle = '#5c3d20';
  c.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const x = (1 - t) * (1 - t) * w * 0.2 + 2 * (1 - t) * t * w * 0.25 + t * t * w * 0.55;
    const y = (1 - t) * (1 - t) * h + 2 * (1 - t) * t * h * 0.45 + t * t * h * 0.18;
    c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y - 3); c.stroke();
  }
  // hojas
  const hx = w * 0.55, hy = h * 0.18;
  const leaves = [-2.9, -2.4, -1.9, -1.2, -0.6, 0, 0.5, 2.6];
  for (const a of leaves) {
    const len = rnd(w * 0.38, w * 0.5);
    c.fillStyle = pick(['#1f7a3a', '#2a8f45', '#196b31']);
    c.beginPath();
    c.moveTo(hx, hy);
    const ex = hx + Math.cos(a) * len, ey = hy + Math.sin(a) * len * 0.6 + len * 0.25;
    c.quadraticCurveTo(hx + Math.cos(a) * len * 0.5, hy + Math.sin(a) * len * 0.6 - 30, ex, ey);
    c.quadraticCurveTo(hx + Math.cos(a) * len * 0.5, hy + Math.sin(a) * len * 0.3 + 10, hx, hy);
    c.fill();
    c.strokeStyle = 'rgba(10,50,20,.6)';
    c.lineWidth = 1.5;
    c.stroke();
  }
  c.fillStyle = '#5a3a1e';
  c.beginPath(); c.arc(hx - 4, hy + 6, 6, 0, Math.PI * 2); c.arc(hx + 6, hy + 8, 6, 0, Math.PI * 2); c.fill();
}

export function generateTextures(scene: Phaser.Scene) {
  // cielo
  canvasTex(scene, 'sky', 64, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3d8fd9');
    g.addColorStop(0.55, '#8cc8f0');
    g.addColorStop(1, '#e8f4fb');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  canvasTex(scene, 'sun', 256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.18, 'rgba(255,250,210,1)');
    g.addColorStop(0.3, 'rgba(255,240,170,.6)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
  canvasTex(scene, 'rays', 1024, 1024, (c, w) => {
    c.translate(w / 2, w / 2);
    for (let i = 0; i < 18; i++) {
      c.rotate((Math.PI * 2) / 18);
      const g = c.createLinearGradient(0, 0, w / 2, 0);
      g.addColorStop(0, 'rgba(255,250,220,.35)');
      g.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w / 2, -rnd(18, 40));
      c.lineTo(w / 2, rnd(18, 40));
      c.fill();
    }
  });
  for (let i = 0; i < 3; i++) {
    canvasTex(scene, `cloud${i}`, 320, 140, (c, w, h) => {
      c.fillStyle = '#ffffff';
      const n = 6 + i;
      for (let j = 0; j < n; j++) {
        const x = rnd(50, w - 50), y = rnd(h * 0.45, h * 0.7), r = rnd(28, 52);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      c.fillRect(40, h * 0.62, w - 80, h * 0.25);
      c.globalCompositeOperation = 'source-atop';
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(120,150,190,.35)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
  }
  canvasTex(scene, 'sea', 64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b5fa8');
    g.addColorStop(0.5, '#2a86c4');
    g.addColorStop(1, '#4fc3d9');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  canvasTex(scene, 'sparkle', 24, 24, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,230,.7)');
    g.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
  canvasTex(scene, 'soft', 64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
  canvasTex(scene, 'flame', 48, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.65, 2, w / 2, h * 0.6, w / 2);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.4, 'rgba(255,200,80,.9)');
    g.addColorStop(1, 'rgba(255,90,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.quadraticCurveTo(w, h * 0.55, w / 2, h);
    c.quadraticCurveTo(0, h * 0.55, w / 2, 0);
    c.fill();
  });
  canvasTex(scene, 'star', 32, 32, (c, w) => {
    c.fillStyle = '#ffffff';
    c.translate(w / 2, w / 2);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? w / 2 : w / 8;
      const a = (i / 8) * Math.PI * 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.fill();
  });
  canvasTex(scene, 'square', 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 8); });
  canvasTex(scene, 'sandgrain', 6, 6, (c) => { c.fillStyle = '#e6c58a'; c.beginPath(); c.arc(3, 3, 3, 0, 7); c.fill(); });
  canvasTex(scene, 'ring', 128, 128, (c, w) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 8;
    c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); c.stroke();
  });
  canvasTex(scene, 'ball', 32, 32, (c, w) => {
    const g = c.createRadialGradient(w * 0.38, w * 0.35, 1, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#fbffb0');
    g.addColorStop(0.6, '#d6f03a');
    g.addColorStop(1, '#8fae10');
    c.fillStyle = g;
    c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(w * 0.1, w / 2, w * 0.42, -0.9, 0.9); c.stroke();
    c.beginPath(); c.arc(w * 0.9, w / 2, w * 0.42, Math.PI - 0.9, Math.PI + 0.9); c.stroke();
  });
  canvasTex(scene, 'shadow', 64, 24, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(60,40,20,.45)');
    g.addColorStop(1, 'rgba(60,40,20,0)');
    c.fillStyle = g;
    c.save(); c.scale(1, h / w); c.fillRect(0, 0, w, w); c.restore();
    c.fillRect(0, 0, 0, 0);
  });
  // arena de la pista con granulado
  canvasTex(scene, 'sand', 512, 512, (c, w, h) => {
    c.fillStyle = '#f7cf7c'; // color de la arena del fondo pixel art
    c.fillRect(0, 0, w, h);
    // ondulaciones suaves del viento (sin patrones repetidos llamativos)
    for (let i = 0; i < 26; i++) {
      c.strokeStyle = i % 2 ? 'rgba(255,240,200,.18)' : 'rgba(205,150,70,.12)';
      c.lineWidth = rnd(2, 5);
      c.beginPath();
      const y0 = rnd(0, h), a = rnd(3, 7), f = rnd(0.01, 0.025), ph = rnd(0, 6);
      for (let x = -10; x <= w + 10; x += 8) {
        const y = y0 + Math.sin(x * f + ph) * a;
        if (x === -10) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 5000; i++) {
      c.fillStyle = pick(['rgba(214,160,70,.28)', 'rgba(255,244,205,.45)', 'rgba(190,135,55,.2)']);
      c.fillRect(rnd(0, w), rnd(0, h), rnd(1, 2.5), rnd(1, 2));
    }
  });
  // huella en la arena y marca de bote de la bola
  canvasTex(scene, 'footprint', 24, 14, (c) => {
    c.fillStyle = 'rgba(150,95,35,.55)';
    c.beginPath(); c.ellipse(7, 7, 6, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,235,190,.5)';
    c.beginPath(); c.ellipse(8, 5.6, 4, 1.4, 0, 0, Math.PI * 2); c.fill();
  });
  canvasTex(scene, 'ballmark', 40, 18, (c) => {
    c.fillStyle = 'rgba(140,85,30,.5)';
    c.beginPath(); c.ellipse(20, 9, 14, 6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,238,195,.65)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(20, 8, 17, 7.5, 0, Math.PI, Math.PI * 2); c.stroke();
  });
  // cometa del golpe especial (cabeza brillante + cola), uno por tema
  for (const [key, cols] of [['comet_sun', ['255,255,235', '255,214,90', '255,120,20', '230,40,0']], ['comet_wave', ['240,255,255', '150,240,255', '40,190,240', '10,90,200']]] as [string, string[]][]) {
    canvasTex(scene, key, 320, 96, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, `rgba(${cols[0]},1)`);
      g.addColorStop(0.12, `rgba(${cols[1]},.95)`);
      g.addColorStop(0.45, `rgba(${cols[2]},.7)`);
      g.addColorStop(1, `rgba(${cols[3]},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(18, h / 2);
      c.bezierCurveTo(18, 6, 60, 10, w, h / 2 - 4);
      c.bezierCurveTo(60, h - 10, 18, h - 6, 18, h / 2);
      c.fill();
      const r = c.createRadialGradient(30, h / 2, 2, 30, h / 2, 34);
      r.addColorStop(0, `rgba(${cols[0]},1)`);
      r.addColorStop(1, `rgba(${cols[1]},0)`);
      c.fillStyle = r;
      c.fillRect(0, 0, 80, h);
    });
  }
  // siluetas suaves de público en primer plano (de espaldas, a contraluz), como en el vídeo
  const sil = (c: CanvasRenderingContext2D, v: number, up: boolean, col: string, ox: number, oy: number) => {
    c.save(); c.translate(ox, oy);
    c.fillStyle = col; c.strokeStyle = col;
    const cx = 130;
    const kid = v === 4;
    const hr = kid ? 50 : 62, hy = kid ? 150 : 128;
    // hombros
    c.beginPath(); c.ellipse(cx, 345, kid ? 100 : 128, 120, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(cx - 32, hy + 30, 64, 80);
    // cabeza
    c.beginPath(); c.ellipse(cx, hy, hr, hr * 1.12, 0, 0, Math.PI * 2); c.fill();
    if (v === 1) { // gorra
      c.beginPath(); c.ellipse(cx, hy - 26, hr + 6, 48, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(cx + 52, hy - 22, 46, 10, 0.05, 0, Math.PI * 2); c.fill();
    } else if (v === 2) { // melena
      c.beginPath(); c.ellipse(cx, hy + 26, hr + 14, hr + 30, 0, 0, Math.PI * 2); c.fill();
    } else if (v === 3) { // moño
      c.beginPath(); c.arc(cx - 6, hy - hr - 12, 26, 0, Math.PI * 2); c.fill();
    } else if (v === 5) { // pelo de punta
      for (const [dx, h] of [[-40, 34], [-14, 44], [12, 42], [38, 30]]) { c.beginPath(); c.moveTo(cx + dx - 18, hy - hr + 16); c.lineTo(cx + dx + 18, hy - hr + 16); c.lineTo(cx + dx * 1.2, hy - hr - h); c.fill(); }
    } else if (v === 6) { // cámara de fotos levantada
      c.fillRect(cx + 40, hy - 30, 70, 46); c.beginPath(); c.arc(cx + 110, hy - 7, 20, 0, Math.PI * 2); c.fill();
    }
    if (up) {
      c.lineCap = 'round'; c.lineWidth = 30;
      c.beginPath(); c.moveTo(cx - 88, 290); c.quadraticCurveTo(cx - 130, 200, cx - 112, 120); c.stroke();
      c.beginPath(); c.moveTo(cx + 88, 290); c.quadraticCurveTo(cx + 130, 200, cx + 112, 120); c.stroke();
      c.beginPath(); c.arc(cx - 112, 112, 22, 0, Math.PI * 2); c.arc(cx + 112, 112, 22, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  };
  for (let v = 0; v < 7; v++) {
    for (const up of [false, true]) {
      canvasTex(scene, `silS${v}${up ? 'b' : 'a'}`, 300, 420, (c) => {
        sil(c, v, up, 'rgba(120,150,190,.55)', 0, 0); // contraluz arriba-izquierda
        sil(c, v, up, '#121722', 5, 7);
      });
      scene.textures.get(`silS${v}${up ? 'b' : 'a'}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  // sombrilla y hamaca de la playa lejana
  canvasTex(scene, 'umbrella', 90, 80, (c, w, h) => {
    const cols = pick([['#ff5a5a', '#ffffff'], ['#3aa0ff', '#ffe066'], ['#ff9f1c', '#2ec4b6'], ['#7bd389', '#ffffff']]);
    c.strokeStyle = '#ddd';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w / 2 + 4, h); c.stroke();
    for (let i = 0; i < 6; i++) {
      c.fillStyle = cols[i % 2];
      c.beginPath();
      c.moveTo(w / 2, 6);
      const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
      c.lineTo(w / 2 + Math.cos(a0) * 44, 26 + Math.sin(a0) * -2);
      c.lineTo(w / 2 + Math.cos(a1) * 44, 26 + Math.sin(a1) * -2);
      c.fill();
    }
  });
  canvasTex(scene, 'chair', 50, 30, (c) => {
    c.fillStyle = pick(['#4d96ff', '#ff6b6b', '#ffd93d']);
    c.save(); c.translate(6, 22); c.rotate(-0.4); c.fillRect(0, -6, 40, 7); c.restore();
    c.strokeStyle = '#eee'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(10, 22); c.lineTo(14, 30); c.moveTo(38, 10); c.lineTo(40, 30); c.stroke();
  });
  canvasTex(scene, 'boat', 70, 70, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(36, 4); c.lineTo(36, 52); c.lineTo(10, 52); c.fill();
    c.fillStyle = '#f2f2f2';
    c.beginPath(); c.moveTo(39, 12); c.lineTo(39, 52); c.lineTo(60, 52); c.fill();
    c.fillStyle = '#e04040';
    c.beginPath(); c.moveTo(6, 56); c.lineTo(64, 56); c.lineTo(56, 64); c.lineTo(14, 64); c.fill();
  });
  canvasTex(scene, 'island', 400, 60, (c, w, h) => {
    c.fillStyle = '#5f8a6a';
    c.beginPath();
    c.moveTo(0, h);
    c.bezierCurveTo(w * 0.2, h * 0.1, w * 0.45, h * 0.2, w * 0.6, h * 0.5);
    c.bezierCurveTo(w * 0.75, h * 0.3, w * 0.9, h * 0.6, w, h);
    c.fill();
  });
  canvasTex(scene, 'gull', 30, 14, (c) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(2, 4); c.quadraticCurveTo(9, 0, 15, 8); c.quadraticCurveTo(21, 0, 28, 4); c.stroke();
  });
  canvasTex(scene, 'gull2', 30, 14, (c) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(2, 11); c.quadraticCurveTo(9, 5, 15, 7); c.quadraticCurveTo(21, 5, 28, 11); c.stroke();
  });
  canvasTex(scene, 'palm', 360, 520, (c, w, h) => drawPalm(c, w, h, false));
  canvasTex(scene, 'palmR', 360, 520, (c, w, h) => drawPalm(c, w, h, true));
  // hojas grandes en primer plano (esquinas superiores como en el vídeo)
  canvasTex(scene, 'fronds', 520, 300, (c, w, h) => {
    const leaves = [0.15, 0.45, 0.8, 1.2, 1.6, 2.2, 2.7];
    for (const a of leaves) {
      const len = rnd(220, 300);
      c.fillStyle = pick(['#1c6e34', '#24823f', '#165c2b']);
      c.beginPath();
      c.moveTo(w * 0.5, 0);
      const ex = w * 0.5 + Math.cos(a) * len, ey = Math.sin(a) * len * 0.75 + 30;
      c.quadraticCurveTo(w * 0.5 + Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.2 - 20, ex, ey);
      c.quadraticCurveTo(w * 0.5 + Math.cos(a) * len * 0.45, Math.sin(a) * len * 0.5 + 25, w * 0.5, 0);
      c.fill();
      // nervios
      c.strokeStyle = 'rgba(10,40,15,.55)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(w * 0.5, 0); c.quadraticCurveTo(w * 0.5 + Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.35, ex, ey); c.stroke();
    }
  });
  // público
  for (let i = 0; i < 14; i++) {
    const seed = {
      skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), shorts: pick(SHORTS),
      hairStyle: Math.floor(rnd(0, 3)), sign: i % 5 === 0 ? 1 : i % 5 === 2 ? 2 : 0, cap: Math.random() < 0.25,
    };
    canvasTex(scene, `fan${i}a`, 44, 96, (c, w, h) => drawPerson(c, w, h, false, seed));
    canvasTex(scene, `fan${i}b`, 44, 96, (c, w, h) => drawPerson(c, w, h, true, seed));
  }
  canvasTex(scene, 'dog', 44, 34, (c) => {
    c.fillStyle = '#d9a35b';
    c.beginPath(); c.ellipse(20, 22, 13, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(33, 13, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a8742e';
    c.beginPath(); c.ellipse(29, 9, 3, 6, -0.4, 0, Math.PI * 2); c.fill();
    c.fillRect(10, 26, 4, 8); c.fillRect(26, 26, 4, 8);
    c.fillStyle = '#1a1010'; c.fillRect(35, 11, 2, 2); c.fillRect(40, 14, 3, 2);
    c.strokeStyle = '#d9a35b'; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 18); c.lineTo(2, 10); c.stroke();
  });
  for (let v = 0; v < 4; v++) {
    canvasTex(scene, `sil${v}a`, 130, 170, (c, w, h) => drawSilhouette(c, w, h, v, false));
    canvasTex(scene, `sil${v}b`, 130, 170, (c, w, h) => drawSilhouette(c, w, h, v, true));
  }
  // banderita del banderín
  canvasTex(scene, 'flag', 16, 20, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 0); c.lineTo(8, 20); c.fill();
  });
  for (const k of ['fronds', 'comet_sun', 'comet_wave', 'sun', 'rays', 'soft', 'flame', 'shadow', 'footprint', 'ballmark', 'sand']) {
    if (scene.textures.exists(k)) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

}
