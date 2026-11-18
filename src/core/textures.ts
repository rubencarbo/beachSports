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
  generateForeground(scene);
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

// ---------------------------------------------------------------------------------------------
// PRIMER PLANO: siluetas de público de espaldas y hoja de palmera, desenfocadas como si la
// cámara enfocase a las jugadoras (profundidad de campo). El desenfoque gaussiano se calcula
// una sola vez al arrancar (3 pasadas de desenfoque de caja = gaussiano), sin coste en partida.
// ---------------------------------------------------------------------------------------------

export const SIL_TYPES = 10;

/** Desenfoque gaussiano aproximado (3 pasadas de caja separables) sobre RGBA premultiplicado. */
function gaussianBlur(c: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    ch[0][i] = d[i * 4] * a; ch[1][i] = d[i * 4 + 1] * a; ch[2][i] = d[i * 4 + 2] * a; ch[3][i] = a;
  }
  const tmp = new Float32Array(n);
  const box = (src: Float32Array, rr: number) => {
    const k = 1 / (2 * rr + 1);
    for (let y = 0; y < h; y++) { // horizontal
      let acc = 0; const row = y * w;
      for (let x = -rr; x <= rr; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * k;
        acc += src[row + Math.min(w - 1, x + rr + 1)] - src[row + Math.max(0, x - rr)];
      }
    }
    for (let x = 0; x < w; x++) { // vertical
      let acc = 0;
      for (let y = -rr; y <= rr; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc * k;
        acc += tmp[Math.min(h - 1, y + rr + 1) * w + x] - tmp[Math.max(0, y - rr) * w + x];
      }
    }
  };
  const rr = Math.max(1, Math.round(r / 1.7));
  for (const arr of ch) for (let pass = 0; pass < 3; pass++) box(arr, rr);
  for (let i = 0; i < n; i++) {
    const a = ch[3][i];
    d[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.001) { d[i * 4] = ch[0][i] / a; d[i * 4 + 1] = ch[1][i] / a; d[i * 4 + 2] = ch[2][i] / a; }
  }
  c.putImageData(img, 0, 0);
}

type ArmStyle = 'both' | 'one' | 'phone';

/** Persona de espaldas (cabeza, orejas, cuello, hombros) con distintos peinados. */
function person(c: CanvasRenderingContext2D, v: number, arms: ArmStyle | null) {
  const cx = 220;
  const kid = v === 8;
  const S = kid ? 0.8 : 1;
  const hy = kid ? 190 : 150; // centro de la cabeza
  const hr = 54 * S; // radio de la cabeza
  // hombros y torso: trapecio que baja desde el cuello hasta el hombro redondeado (deltoides)
  const sw = (kid ? 104 : 132), sy = hy + hr + 40 * S;
  const half = (sd: number) => {
    c.moveTo(cx + sd * 30 * S, hy + hr * 0.7);
    c.quadraticCurveTo(cx + sd * 44 * S, sy - 6, cx + sd * sw * 0.72, sy + 2); // trapecio
    c.quadraticCurveTo(cx + sd * (sw + 8), sy + 8, cx + sd * (sw + 4), sy + 70); // hombro redondeado
    c.lineTo(cx + sd * (sw + 14), 480);
    c.lineTo(cx, 480);
  };
  c.beginPath(); half(-1); c.closePath(); c.fill();
  c.beginPath(); half(1); c.closePath(); c.fill();
  c.fillRect(cx - 34 * S, hy + hr * 0.6, 68 * S, 480);
  // brazos animando: brazo y antebrazo gruesos, codo doblado hacia fuera, puño
  if (arms) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const arm = (side: number, phone: boolean) => {
      const shx = cx + side * (sw - 10), shy = sy + 26;
      const elx = cx + side * (sw + 34), ely = hy + 20 * S;
      const hx = cx + side * (sw + 6), hyy = hy - 92 * S;
      c.lineWidth = 46 * S;
      c.beginPath(); c.moveTo(shx, shy); c.lineTo(elx, ely); c.stroke();
      c.lineWidth = 38 * S;
      c.beginPath(); c.moveTo(elx, ely); c.lineTo(hx, hyy); c.stroke();
      c.beginPath(); c.ellipse(hx, hyy - 14 * S, 24 * S, 28 * S, 0, 0, Math.PI * 2); c.fill(); // puño
      if (phone) { c.save(); c.translate(hx - side * 4, hyy - 44 * S); c.rotate(side * 0.12); c.fillRect(-24, -46, 48, 78); c.restore(); }
    };
    if (arms === 'both') { arm(-1, false); arm(1, false); }
    else if (arms === 'one') arm(1, false);
    else arm(1, true);
  }
  // cuello
  c.beginPath(); c.ellipse(cx, hy + hr * 0.75, 30 * S, 44 * S, 0, 0, Math.PI * 2); c.fill();
  // orejas
  if (v !== 6 && v !== 7) for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(cx + sd * hr * 0.98, hy + 8 * S, 11 * S, 19 * S, sd * 0.15, 0, Math.PI * 2); c.fill(); }
  // cabeza (un poco más ancha arriba, como un cráneo de espaldas)
  c.beginPath(); c.ellipse(cx, hy, hr, hr * 1.12, 0, 0, Math.PI * 2); c.fill();
  // peinados
  switch (v) {
    case 0: // pelo corto: volumen arriba y nuca irregular
      c.beginPath(); c.ellipse(cx, hy - 10, hr + 5, hr * 1.02, 0, Math.PI, 0); c.fill();
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(cx + i * 14, hy - hr + 6 + Math.abs(i) * 4, 13, 0, Math.PI * 2); c.fill(); }
      break;
    case 1: // calvo: sólo el cráneo (el contraluz lo marca)
      break;
    case 2: // gorra: copa + visera de lado y ajuste trasero
      c.beginPath(); c.ellipse(cx, hy - 12, hr + 6, hr * 0.95, 0, Math.PI * 1.02, Math.PI * 1.98); c.fill();
      c.fillRect(cx - hr - 6, hy - 14, (hr + 6) * 2, 16);
      c.beginPath(); c.ellipse(cx + hr + 6, hy - 10, 30, 9, -0.12, 0, Math.PI * 2); c.fill();
      break;
    case 3: // coleta
      c.beginPath(); c.ellipse(cx, hy - 8, hr + 4, hr * 1.06, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.moveTo(cx - 16, hy + 6); c.bezierCurveTo(cx - 34, hy + 70, cx + 26, hy + 90, cx + 6, hy + 150);
      c.bezierCurveTo(cx + 44, hy + 100, cx + 28, hy + 40, cx + 16, hy + 6); c.fill();
      break;
    case 4: // moño
      c.beginPath(); c.ellipse(cx, hy - 6, hr + 3, hr * 1.06, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(cx + 4, hy - hr - 22, 30, 0, Math.PI * 2); c.fill();
      break;
    case 5: // rizos / afro
      for (let i = 0; i < 18; i++) { const a = Math.PI * 0.95 + (i / 17) * Math.PI * 1.1; c.beginPath(); c.arc(cx + Math.cos(a) * (hr + 10), hy - 4 + Math.sin(a) * (hr + 14), 22, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.ellipse(cx, hy - 6, hr + 18, hr + 20, 0, 0, Math.PI * 2); c.fill();
      break;
    case 6: // melena hasta los hombros
      c.beginPath(); c.moveTo(cx - hr - 10, hy);
      c.bezierCurveTo(cx - hr - 20, hy + 90, cx - hr + 4, hy + 120, cx - hr + 20, hy + 128);
      c.lineTo(cx + hr - 20, hy + 128);
      c.bezierCurveTo(cx + hr - 4, hy + 120, cx + hr + 20, hy + 90, cx + hr + 10, hy);
      c.closePath(); c.fill();
      c.beginPath(); c.ellipse(cx, hy - 4, hr + 10, hr * 1.12, 0, 0, Math.PI * 2); c.fill();
      break;
    case 7: // sombrero de playa de ala ancha
      c.beginPath(); c.ellipse(cx, hy - 26, hr + 52, 20, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx, hy - 40, hr - 4, 40, 0, Math.PI, 0); c.fill();
      break;
    case 8: // niño con pelo corto
      c.beginPath(); c.ellipse(cx, hy - 8, hr + 4, hr, 0, Math.PI, 0); c.fill();
      break;
    case 9: // pelo largo recogido con pinza
      c.beginPath(); c.ellipse(cx, hy - 6, hr + 4, hr * 1.06, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(cx, hy + 30, 24, 40, 0, 0, Math.PI * 2); c.fill();
      break;
  }
}

function generateForeground(scene: Phaser.Scene) {
  const W = 440, H = 480;
  const armsFor = (v: number): ArmStyle => (['both', 'one', 'both', 'phone', 'both', 'one', 'both', 'one', 'both', 'phone'] as ArmStyle[])[v];
  for (let v = 0; v < SIL_TYPES; v++) {
    for (const up of [false, true]) {
      const key = `silS${v}${up ? 'b' : 'a'}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.createCanvas(key, W, H)!;
      const c = tex.getContext();
      // contraluz: la silueta clara un poco desplazada hacia arriba-izquierda y encima la oscura
      c.fillStyle = '#121826'; c.strokeStyle = '#121826';
      person(c, v, up ? armsFor(v) : null);
      gaussianBlur(c, W, H, 9); // desenfoque de profundidad de campo
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  // hoja de palmera oscura y desenfocada en primer plano (esquina inferior)
  {
    const key = 'frondFg';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const fw = 560, fh = 420;
    const tex = scene.textures.createCanvas(key, fw, fh)!;
    const c = tex.getContext();
    const stem: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      // tallo curvo desde la esquina inferior derecha hacia arriba-izquierda
      stem.push([fw - 20 - t * 430 - Math.sin(t * 2.2) * 30, fh - 10 - t * 300 + t * t * 120]);
    }
    c.lineCap = 'round';
    c.strokeStyle = '#1e3d24'; c.lineWidth = 10;
    c.beginPath(); stem.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.fillStyle = '#244a2b';
    for (let i = 2; i < stem.length - 1; i += 2) {
      const [x0, y0] = stem[i], [x1, y1] = stem[i + 1];
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = 175 * Math.sin((i / stem.length) * Math.PI * 0.95 + 0.1) + 40;
      for (const sd of [-1, 1]) {
        const a = ang + sd * 0.95;
        const tx = x0 + Math.cos(a) * len, ty = y0 + Math.sin(a) * len + len * 0.55; // cuelgan por su peso
        c.beginPath(); c.moveTo(x0, y0);
        c.quadraticCurveTo(x0 + Math.cos(a - sd * 0.3) * len * 0.5, y0 + Math.sin(a - sd * 0.3) * len * 0.5, tx, ty);
        c.quadraticCurveTo(x0 + Math.cos(a + sd * 0.2) * len * 0.45, y0 + Math.sin(a + sd * 0.2) * len * 0.45 + 6, x0 + Math.cos(ang) * 8, y0 + Math.sin(ang) * 8);
        c.fill();
      }
    }
    gaussianBlur(c, fw, fh, 7);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
