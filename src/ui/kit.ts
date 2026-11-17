import Phaser from 'phaser';
import { sfx } from '../core/audio';

/**
 * Kit de interfaz "arcade de playa" en pixel art: paneles con esquinas recortadas, contorno grueso,
 * bisel de luz/sombra y sombra proyectada; botones con relieve que se hunden al pulsar; iconos dibujados.
 */

export const UI = {
  ink: 0x1b2240, // contorno
  inkSoft: 0x2c3560,
  cream: 0xfff3d6,
  sand: 0xffe2a3,
  wood: 0xb8743c,
  woodDark: 0x7c4a22,
  woodLight: 0xd99a5a,
  orange: 0xff8a1f,
  red: 0xe8433a,
  teal: 0x1fb5c9,
  tealDark: 0x0e7f8f,
  blue: 0x3a7fd6,
  yellow: 0xffd23f,
  green: 0x5ccf5a,
  grey: 0x6b7591,
};

export const TITLE_FONT = '"Press Start 2P", "Courier New", monospace';
export const LABEL_FONT = '"Pixelify Sans", "Press Start 2P", monospace';

export function shade(c: number, f: number) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

/** Rectángulo con esquinas recortadas "a píxel". */
export function cutRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1, cut = 6) {
  g.fillStyle(color, alpha);
  g.fillRect(x + cut, y, w - cut * 2, h);
  g.fillRect(x, y + cut, w, h - cut * 2);
  g.fillRect(x + cut / 2, y + cut / 2, w - cut, h - cut);
}

/** Bloque con contorno, bisel y sombra: base de paneles y botones. */
export function block(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, opts: { depth?: number; shadow?: boolean; border?: number; alpha?: number } = {}) {
  const d = opts.depth ?? 0;
  const B = opts.border ?? 4;
  const a = opts.alpha ?? 1;
  if (opts.shadow !== false) cutRect(g, x + 4, y + 6 + d, w, h, 0x000000, 0.28 * a, 8);
  if (d) cutRect(g, x, y + d, w, h, shade(color, 0.55), a, 8); // grosor del botón
  cutRect(g, x, y, w, h, UI.ink, a, 8);
  cutRect(g, x + B, y + B, w - B * 2, h - B * 2, color, a, 6);
  // bisel: franja de luz arriba y de sombra abajo
  g.fillStyle(shade(color, 1.28), a).fillRect(x + B + 4, y + B, w - B * 2 - 8, 4);
  g.fillStyle(shade(color, 0.78), a).fillRect(x + B + 4, y + h - B - 5, w - B * 2 - 8, 5);
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#fff3d6', opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { title?: boolean } = {}) {
  const { title, ...rest } = opts;
  return scene.add.text(x, y, text, {
    fontFamily: title ? TITLE_FONT : LABEL_FONT, fontSize: `${size}px`, color, fontStyle: title ? undefined : 'bold',
    stroke: '#1b2240', strokeThickness: Math.max(3, Math.round(size / 6)), ...rest,
  }).setOrigin(0.5);
}

/** Panel con cabecera opcional (cinta de color). Devuelve un contenedor centrado en (x, y). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: { color?: number; title?: string; titleColor?: number; wood?: boolean } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const col = opts.color ?? (opts.wood ? UI.wood : UI.inkSoft);
  block(g, -w / 2, -h / 2, w, h, col);
  if (opts.wood) {
    // tablones y clavos
    g.fillStyle(shade(col, 0.82), 1);
    for (let yy = -h / 2 + 34; yy < h / 2 - 12; yy += 30) g.fillRect(-w / 2 + 8, yy, w - 16, 3);
    g.fillStyle(UI.woodDark, 1);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.fillRect(sx * (w / 2 - 16) - 3, sy * (h / 2 - 16) - 3, 6, 6);
  }
  c.add(g);
  if (opts.title) {
    const tw = Math.min(w - 40, Math.max(220, opts.title.length * 27 + 70));
    const tg = scene.add.graphics();
    const tc = opts.titleColor ?? UI.orange;
    // cinta con colas
    tg.fillStyle(shade(tc, 0.6), 1).fillTriangle(-tw / 2 - 26, -h / 2 + 6, -tw / 2, -h / 2 - 6, -tw / 2, -h / 2 + 30);
    tg.fillTriangle(tw / 2 + 26, -h / 2 + 6, tw / 2, -h / 2 - 6, tw / 2, -h / 2 + 30);
    block(tg, -tw / 2, -h / 2 - 26, tw, 56, tc);
    c.add(tg);
    c.add(label(scene, 0, -h / 2 + 2, opts.title, 26, '#fff3d6', { title: true }));
  }
  return c;
}

export type IconName = 'play' | 'pause' | 'gear' | 'home' | 'flask' | 'paddle' | 'jump' | 'star' | 'retry' | 'lock' | 'ball' | 'volley' | 'foot' | 'trophy' | 'move' | 'check';

/** Iconos dibujados en pixel art (centrados en x, y; s = tamaño). */
export function icon(g: Phaser.GameObjects.Graphics, name: IconName, x: number, y: number, s: number, color = UI.cream) {
  const u = s / 16;
  const R = (px: number, py: number, w: number, h: number, c = color) => { g.fillStyle(c, 1).fillRect(x + px * u, y + py * u, w * u, h * u); };
  g.fillStyle(color, 1);
  switch (name) {
    case 'play': g.fillTriangle(x - 5 * u, y - 7 * u, x - 5 * u, y + 7 * u, x + 7 * u, y); break;
    case 'pause': R(-6, -7, 4, 14); R(2, -7, 4, 14); break;
    case 'gear':
      g.fillCircle(x, y, 6 * u);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillRect(x + Math.cos(a) * 7 * u - 2 * u, y + Math.sin(a) * 7 * u - 2 * u, 4 * u, 4 * u); }
      g.fillStyle(UI.ink, 1).fillCircle(x, y, 2.5 * u);
      break;
    case 'home': g.fillTriangle(x - 8 * u, y - 1 * u, x + 8 * u, y - 1 * u, x, y - 8 * u); R(-6, -1, 12, 8); R(-2, 3, 4, 4, UI.ink); break;
    case 'flask': R(-2, -8, 4, 6); g.fillTriangle(x - 7 * u, y + 7 * u, x + 7 * u, y + 7 * u, x, y - 3 * u); R(-5, 2, 10, 5, UI.green); break;
    case 'paddle':
      g.fillCircle(x + 2 * u, y - 3 * u, 6 * u);
      g.fillStyle(UI.ink, 1).fillCircle(x + 2 * u, y - 3 * u, 3.5 * u);
      g.fillStyle(color, 1).fillCircle(x + 2 * u, y - 3 * u, 2.5 * u);
      g.lineStyle(3 * u, color, 1).lineBetween(x - 2 * u, y + 2 * u, x - 7 * u, y + 8 * u);
      break;
    case 'jump':
      for (const dy of [-4, 3]) g.fillTriangle(x - 7 * u, y + (dy + 4) * u, x + 7 * u, y + (dy + 4) * u, x, y + (dy - 3) * u);
      break;
    case 'star': {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = (i % 2 ? 3.5 : 8.5) * u; pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
      g.fillPoints(pts, true);
      break;
    }
    case 'retry':
      g.lineStyle(3 * u, color, 1).beginPath(); g.arc(x, y, 6 * u, -0.3, Math.PI * 1.5); g.strokePath();
      g.fillTriangle(x + 3 * u, y - 10 * u, x + 3 * u, y - 2 * u, x + 9 * u, y - 6 * u);
      break;
    case 'lock': R(-6, -1, 12, 9); g.lineStyle(3 * u, color, 1).beginPath(); g.arc(x, y - 2 * u, 4.5 * u, Math.PI, 0); g.strokePath(); break;
    case 'ball': g.fillStyle(0xd6f03a, 1).fillCircle(x, y, 6 * u); g.lineStyle(1.5 * u, 0xffffff, 1).beginPath(); g.arc(x - 5 * u, y, 5 * u, -0.9, 0.9); g.strokePath(); break;
    case 'volley': g.fillCircle(x, y, 7 * u); g.lineStyle(1.5 * u, UI.ink, 1).lineBetween(x - 7 * u, y, x + 7 * u, y).lineBetween(x, y - 7 * u, x, y + 7 * u); break;
    case 'foot': g.fillCircle(x, y, 7 * u); g.fillStyle(UI.ink, 1).fillCircle(x, y, 2.5 * u); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.fillCircle(x + Math.cos(a) * 5 * u, y + Math.sin(a) * 5 * u, 1.6 * u); } break;
    case 'trophy': R(-6, -8, 12, 7); R(-2, -1, 4, 5); R(-5, 4, 10, 3); R(-9, -7, 3, 4); R(6, -7, 3, 4); break;
    case 'move': for (const [dx, dy, r] of [[0, -7, 0], [0, 7, Math.PI], [-7, 0, -Math.PI / 2], [7, 0, Math.PI / 2]] as [number, number, number][]) {
      const cx = x + dx * u, cy = y + dy * u, s3 = 3.5 * u;
      g.fillTriangle(cx + Math.sin(r) * s3, cy - Math.cos(r) * s3, cx - Math.cos(r) * s3 - Math.sin(r) * s3 * 0.2, cy - Math.sin(r) * s3 + Math.cos(r) * s3 * 0.2, cx + Math.cos(r) * s3, cy + Math.sin(r) * s3);
    } break;
    case 'check': g.lineStyle(3 * u, color, 1).lineBetween(x - 6 * u, y, x - 2 * u, y + 5 * u).lineBetween(x - 2 * u, y + 5 * u, x + 7 * u, y - 6 * u); break;
  }
}

export interface Button {
  c: Phaser.GameObjects.Container;
  setActive(on: boolean): void;
  setEnabled(on: boolean): void;
}

/** Botón con relieve: se hunde al pulsar. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void,
  opts: { color?: number; icon?: IconName; size?: number; activeColor?: number; active?: boolean; disabled?: boolean } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const ig = scene.add.graphics();
  const size = opts.size ?? Math.round(h * 0.42);
  const t = label(scene, opts.icon && text ? size * 0.7 : 0, 0, text, size);
  c.add([g, ig, t]);
  const DEPTH = 6;
  let active = !!opts.active, enabled = !opts.disabled, pressed = false;
  const draw = () => {
    g.clear(); ig.clear();
    const base = !enabled ? UI.grey : active ? (opts.activeColor ?? UI.teal) : (opts.color ?? UI.inkSoft);
    const d = pressed ? 2 : DEPTH;
    const off = pressed ? DEPTH - 2 : 0;
    block(g, -w / 2, -h / 2 + off, w, h, base, { depth: d });
    const tx = opts.icon ? (text ? -w / 2 + h * 0.55 : 0) : 0;
    if (opts.icon) icon(ig, opts.icon, tx, off, h * 0.42, enabled ? UI.cream : 0xc8cdd8);
    t.setY(off - 1).setX(opts.icon && text ? h * 0.25 : 0).setAlpha(enabled ? 1 : 0.7);
  };
  draw();
  const hit = scene.add.rectangle(0, 0, w + 8, h + 12, 0, 0).setInteractive({ useHandCursor: true });
  c.add(hit);
  hit.on('pointerdown', () => { if (!enabled) return; pressed = true; draw(); sfx.unlock(); sfx.ui(); });
  hit.on('pointerout', () => { if (pressed) { pressed = false; draw(); } });
  hit.on('pointerup', () => { if (!pressed) return; pressed = false; draw(); onClick(); });
  return {
    c,
    setActive(on: boolean) { active = on; draw(); },
    setEnabled(on: boolean) { enabled = on; draw(); },
  } as Button;
}

/** Selector segmentado (una opción activa). */
export function segmented(scene: Phaser.Scene, x: number, y: number, w: number, h: number, options: string[], active: number, onChange: (i: number) => void, color = UI.teal) {
  const c = scene.add.container(x, y);
  const bw = w / options.length;
  const btns: Button[] = [];
  options.forEach((o, i) => {
    const b = button(scene, -w / 2 + bw * i + bw / 2, 0, bw - 6, h, o, () => { btns.forEach((bb, j) => bb.setActive(j === i)); onChange(i); },
      { active: i === active, activeColor: color, size: Math.round(h * 0.42) });
    btns.push(b);
    c.add(b.c);
  });
  return c;
}

/** Deslizador con valor. */
export function slider(scene: Phaser.Scene, x: number, y: number, w: number, value: number, min: number, max: number, onChange: (v: number) => void, fmt = (v: number) => `${Math.round(v * 100)}%`) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const knob = scene.add.graphics();
  const val = label(scene, w / 2 + 50, 0, '', 24, '#ffd23f');
  c.add([g, knob, val]);
  const tw = w;
  const draw = (v: number) => {
    const f = (v - min) / (max - min);
    g.clear();
    cutRect(g, -tw / 2 - 3, -9, tw + 6, 18, UI.ink, 1, 4);
    g.fillStyle(0x10162b, 1).fillRect(-tw / 2, -6, tw, 12);
    g.fillStyle(UI.orange, 1).fillRect(-tw / 2, -6, tw * f, 12);
    g.fillStyle(shade(UI.orange, 1.3), 1).fillRect(-tw / 2, -6, tw * f, 3);
    knob.clear();
    const kx = -tw / 2 + tw * f;
    block(knob, kx - 12, -18, 24, 36, UI.cream, { depth: 3 });
    val.setText(fmt(v));
  };
  let cur = value;
  draw(cur);
  const hit = scene.add.rectangle(0, 0, tw + 30, 50, 0, 0).setInteractive({ draggable: true, useHandCursor: true });
  c.add(hit);
  const apply = (p: Phaser.Input.Pointer) => {
    const m = c.getWorldTransformMatrix();
    const lx = (p.x - m.tx) / m.scaleX;
    cur = Phaser.Math.Clamp(min + ((lx + tw / 2) / tw) * (max - min), min, max);
    draw(cur);
    onChange(cur);
  };
  hit.on('pointerdown', apply);
  hit.on('drag', apply);
  return c;
}
