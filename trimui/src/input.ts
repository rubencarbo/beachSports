/* Mando: navigator.getGamepads() del lanzador con el mapeo de Knulli (A = 1 este, B = 0 sur, X = 3, Y = 2,
   L1 = 4, R1 = 5, SELECT = 8, START = 9, MENU = 16, cruceta 12-15). Si el lanzador no expone el mando, PADX lo abre
   directamente con sdl.joystick (plantillas/console/11-joy.js). Teclado para probar en el PC. */
import { settings } from './settings';

export const PADX = {
  inst: null as any, dev: null as any, err: '', t: 0, snap: null as any, snapT: 0,
  RAW2STD: { 0: 1, 1: 0, 2: 3, 3: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 16 } as Record<number, number>,
  sdl() { return typeof sdl !== 'undefined' ? sdl : null; },
  win() { try { const s = PADX.sdl(), w = s && s.video && s.video.windows; return (w && w[0]) || null; } catch (e) { return null; } },
  devices(): any[] { const s = PADX.sdl(); try { return s ? [...s.joystick.devices] : []; } catch (e: any) { PADX.err = e.message; return []; } },
  tryOpen() {
    if (PADX.inst) return; const now = Date.now(); if (now - PADX.t < 1500) return; PADX.t = now;
    const s = PADX.sdl(); if (!s) return; const ds = PADX.devices(); if (!ds.length) return;
    try { PADX.inst = s.joystick.openDevice(ds[0]); PADX.dev = ds[0]; console.error('[BeachSports] mando abierto directamente: ' + ds[0].name); }
    catch (e: any) { PADX.err = e.message; console.error('[BeachSports] no puedo abrir el mando: ' + e.message); }
  },
  state() {
    const i = PADX.inst; if (!i) return null; const now = Date.now(); if (PADX.snap && now - PADX.snapT < 4) return PADX.snap;
    let raw: boolean[] = [], ax: number[] = [], hat = 'centered';
    try { raw = i.buttons; ax = i.axes; hat = (i.hats && i.hats[0]) || 'centered'; } catch (e: any) { PADX.err = e.message; return null; }
    const b: any[] = []; for (let k = 0; k < 17; k++) b.push({ pressed: false, touched: false, value: 0 });
    raw.forEach((on, r) => { const s = PADX.RAW2STD[r]; if (on && s != null) { b[s].pressed = true; b[s].value = 1; } });
    const h = String(hat);
    for (const [w, k] of [['up', 12], ['down', 13], ['left', 14], ['right', 15]] as [string, number][]) if (h.includes(w)) { b[k].pressed = true; b[k].value = 1; }
    PADX.snap = { id: 'TRIMUI (directo)', index: 0, connected: true, mapping: 'standard', timestamp: now, buttons: b, axes: [+ax[0] || 0, +ax[1] || 0, +ax[2] || 0, +ax[3] || 0] };
    PADX.snapT = now; return PADX.snap;
  },
  info() {
    const s = PADX.sdl(); if (!s) return 'SDL NO DISPONIBLE';
    const i = s.info || {}, v = i.version && i.version.runtime, dr = i.drivers || {};
    let ad = 0; try { ad = s.audio.devices.length; } catch (e) { /* nada */ }
    const ds = PADX.devices();
    return 'SDL ' + (v ? v.major + '.' + v.minor + '.' + v.patch : '?') + ' VID ' + ((dr.video && dr.video.current) || '-') + ' AUD ' + ((dr.audio && dr.audio.current) || '-') +
      ' JOY ' + ds.length + ' SALIDAS ' + ad + (PADX.inst ? ' DIRECTO' : '') + (PADX.err ? ' ERR ' + PADX.err : '');
  },
};
// sustituye getGamepads para que también funcione MENU+START del lanzador
if (typeof sdl !== 'undefined' && sdl && typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
  const orig = navigator.getGamepads.bind(navigator);
  try {
    (navigator as any).getGamepads = () => {
      let a: any = []; try { a = orig() || []; } catch (e) { /* nada */ }
      if ([...a].some(Boolean)) return a; PADX.tryOpen(); const p = PADX.state(); return p ? [p] : a;
    };
  } catch (e) { /* nada */ }
}

// ---------------------------------------------------------------- teclado (pruebas en el PC)
export const keys: Record<string, boolean> = {};
const onKey = (down: boolean) => (e: any) => { const k = e.code || e.key; if (k) keys[k] = down; if (e.key) keys['key:' + String(e.key).toLowerCase()] = down; };
try {
  const tgt: any = typeof window !== 'undefined' ? window : document;
  if (tgt && tgt.addEventListener) { tgt.addEventListener('keydown', onKey(true)); tgt.addEventListener('keyup', onKey(false)); }
} catch (e) { /* sin teclado */ }

export type Btn = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'x' | 'y' | 'l1' | 'r1' | 'start' | 'select' | 'menu';
const BTNS: Btn[] = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l1', 'r1', 'start', 'select', 'menu'];

/** Estado del mando leído UNA vez por fotograma, con flancos y autorrepetición para los menús. */
export const pad = {
  held: {} as Record<Btn, boolean>, prev: {} as Record<Btn, boolean>, ev: {} as Record<Btn, boolean>, rep: {} as Record<string, number>,
  ax: 0, ay: 0, pads: 0, list: '' as string,
  poll(dt: number) {
    const st = {} as Record<Btn, boolean>;
    for (const b of BTNS) st[b] = false;
    const k = (n: string) => !!keys[n];
    if (k('ArrowUp') || k('KeyW')) st.up = true; if (k('ArrowDown') || k('KeyS')) st.down = true;
    if (k('ArrowLeft') || k('KeyA')) st.left = true; if (k('ArrowRight') || k('KeyD')) st.right = true;
    if (k('KeyZ') || k('Enter') || k('key:return') || k('key:enter') || k('Space')) st.a = true;
    if (k('KeyX') || k('Escape') || k('key:escape') || k('Backspace')) st.b = true;
    if (k('KeyC')) st.x = true; if (k('KeyV')) st.y = true; if (k('KeyQ')) st.l1 = true; if (k('KeyE')) st.r1 = true;
    if (k('KeyP')) st.start = true; if (k('Tab')) st.select = true;
    let ax = 0, ay = 0;
    if (st.left) ax -= 1; if (st.right) ax += 1; if (st.up) ay -= 1; if (st.down) ay += 1;
    let n = 0; const ids: string[] = [];
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads as any) {
      if (!p) continue; n++;
      ids.push((p.id || '?').slice(0, 20) + ' B(' + p.buttons.map((b: any, i: number) => (b && (b.pressed || b.value > 0.5) ? i : -1)).filter((i: number) => i >= 0).join(',') + ')');
      const on = (i: number) => !!(p.buttons[i] && p.buttons[i].pressed);
      // Knulli: A = botón 1 (este), B = botón 0 (sur); en el navegador del PC el estándar es A = 0
      const CON = typeof sdl !== 'undefined';
      let A = CON ? 1 : 0, B = CON ? 0 : 1;
      if (settings.swapAB) [A, B] = [B, A];
      const X = CON ? 3 : 2, Y = CON ? 2 : 3;
      const sx = p.axes[0] || 0, sy = p.axes[1] || 0;
      if (on(12) || sy < -0.55) st.up = true; if (on(13) || sy > 0.55) st.down = true;
      if (on(14) || sx < -0.55) st.left = true; if (on(15) || sx > 0.55) st.right = true;
      if (on(A)) st.a = true; if (on(B)) st.b = true; if (on(X)) st.x = true; if (on(Y)) st.y = true;
      if (on(4) || on(6)) st.l1 = true; if (on(5) || on(7)) st.r1 = true;
      if (on(9)) st.start = true; if (on(8)) st.select = true; if (on(16)) st.menu = true;
      if (Math.abs(sx) > 0.2 || Math.abs(sy) > 0.2) { ax = sx; ay = sy; }
      else { if (on(14)) ax = -1; if (on(15)) ax = 1; if (on(12)) ay = -1; if (on(13)) ay = 1; }
    }
    this.pads = n; this.list = ids.join(' | ');
    const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    this.ax = ax; this.ay = ay;
    for (const b of BTNS) {
      this.ev[b] = st[b] && !this.prev[b];
      if (st[b] && (b === 'up' || b === 'down' || b === 'left' || b === 'right')) {
        this.rep[b] = (this.rep[b] || 0) + dt;
        if (this.rep[b] > 0.4) { this.ev[b] = true; this.rep[b] = 0.31; }
      } else if (!st[b]) this.rep[b] = 0;
    }
    if (st.menu) { this.ev.start = false; this.ev.select = false; } // MENU+START = salir (lo gestiona el lanzador)
    this.prev = st; this.held = st;
  },
};

/** Entrada de juego del jugador humano (equivalente a playerInput de la web). */
export const play = {
  mx: 0, my: 0, hit: false, jump: false, special: false,
  read() {
    this.mx = pad.ax; this.my = -pad.ay; // my > 0 = hacia el fondo
    if (pad.ev.a || pad.ev.r1) this.hit = true;
    if (pad.ev.b || pad.ev.l1) this.jump = true;
    if (pad.ev.x || pad.ev.y) this.special = true;
  },
  consumeHit() { const v = this.hit; this.hit = false; return v; },
  consumeJump() { const v = this.jump; this.jump = false; return v; },
  consumeSpecial() { const v = this.special; this.special = false; return v; },
  reset() { this.hit = this.jump = this.special = false; },
};
