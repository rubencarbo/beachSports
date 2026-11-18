// Pantallas (menús en el canvas), HUD, diagnóstico y bucle principal de la edición consola.
import { CharDef, getChar, getRoster, randomChar } from '../../src/game/charData';
import { ROUND_DIFF, ROUND_NAMES, clearTournament, getTournament, playerMatch, reportResult, startTournament, venueFor } from '../../src/game/tournament';
import { VENUES } from '../../src/game/venues';
import { SYN, game as audioGame, sfx } from './audio';
import { Foot } from './foot';
import { CONSOLE, Ctx, H, W, buildRoster, charGfx, ctx2d, mkCanvas, text, textW, Img } from './gfx';
import { PADX, pad, play } from './input';
import { Palas } from './palas';
import { loadSettings, saveSettings, settings } from './settings';
import type { Sim } from './sim';

const VERSION = '1.0.0';
const C = { night: '#120a26', ink: '#1b2240', panel: '#22305c', cream: '#fff3d6', sun: '#ffd23f', orange: '#ff8a1f', teal: '#25c4c4', coral: '#ff4f6d', muted: '#a9b4d8', green: '#4dff6a' };

type Screen = 'title' | 'setup' | 'select' | 'venue' | 'bracket' | 'match' | 'pause' | 'result' | 'settings' | 'help';
interface Item { t: string; v?: string; adj?: (d: number) => void; act?: () => void; sub?: string; hot?: boolean }

const S = {
  screen: 'title' as Screen, prev: 'title' as Screen, sel: {} as Record<string, number>,
  sport: 'palas' as 'palas' | 'futvoley', mode: 'friendly' as 'friendly' | 'tournament', format: '1v1' as '1v1' | '2v2',
  step: 'player' as 'player' | 'partner' | 'rival', pick: { player: 'sol', partner: 'toni', rival: 'ola' } as Record<string, string>, venue: 'mediodia', cursor: 0,
  sim: null as Sim | null, demo: null as Sim | null, settingsFrom: 'title' as Screen, toast: '', toastT: 0,
};

// ---------------------------------------------------------------- utilidades de dibujo
function panel(c: Ctx, x: number, y: number, w: number, h: number, edge = C.cream) {
  c.fillStyle = '#000'; c.fillRect(x + 2, y + 2, w, h);
  c.fillStyle = edge; c.fillRect(x, y, w, h);
  c.fillStyle = C.night; c.fillRect(x + 1, y + 1, w - 2, h - 2);
  c.fillStyle = C.panel; c.fillRect(x + 2, y + 2, w - 4, h - 4);
}
function wrap(s: string, max: number) { const out: string[] = []; let cur = ''; for (const w of s.split(' ')) { const nx = cur ? cur + ' ' + w : w; if (nx.length > max && cur) { out.push(cur); cur = w; } else cur = nx; } if (cur) out.push(cur); return out; }
function logo(c: Ctx, x: number, y: number) {
  for (const [d, col] of [[2, '#000'], [1, '#c4420c']] as [number, string][]) text(c, 'BEACH', x + d, y + d, 4, col, null, 'c');
  text(c, 'BEACH', x, y, 4, C.sun, null, 'c');
  for (const [d, col] of [[2, '#000'], [1, '#0e5f8f']] as [number, string][]) text(c, 'SPORTS', x + d, y + 23 + d, 3, col, null, 'c');
  text(c, 'SPORTS', x, y + 23, 3, '#5fe0f0', null, 'c');
  const tag = 'EDICIÓN TRIMUI', tw = textW(tag) + 10;
  c.fillStyle = '#e8433a'; c.fillRect(Math.round(x - tw / 2), y + 43, tw, 9);
  text(c, tag, x, y + 45, 1, C.cream, null, 'c');
}
function head(c: Ctx, ch: CharDef, x: number, y: number, h = 26, frame = 'head', flip = false) {
  const g = charGfx(ch), im = (g.heads[frame] ?? g.heads.head) as any;
  const s = h / im.height, w = im.width * s;
  if (flip) { c.save(); c.scale(-1, 1); c.drawImage(im, -Math.round(x + w / 2), Math.round(y - h), Math.round(w), Math.round(h)); c.restore(); }
  else c.drawImage(im, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
}
function toast(s: string, t = 2.5) { S.toast = s; S.toastT = t; }
function hint(c: Ctx, s: string) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, H - 10, W, 10); text(c, s, W / 2, H - 8, 1, C.cream, null, 'c'); }

// ---------------------------------------------------------------- partidos
const diffName = { facil: 'FÁCIL', normal: 'NORMAL', dificil: 'DIFÍCIL' };
function newDemo() {
  const a = randomChar(), b = randomChar([a.id]);
  S.demo = new Palas({ mode: 'attract', difficulty: 'dificil', points: 7, p1: a.id, p2: b.id, venue: VENUES[Math.floor(Math.random() * VENUES.length)].id });
}
function startMatch(opts: { venue: string; difficulty: 'facil' | 'normal' | 'dificil'; rival: string }) {
  if (S.sport === 'palas') S.sim = new Palas({ mode: 'play', difficulty: opts.difficulty, points: settings.points, p1: S.pick.player, p2: opts.rival, venue: opts.venue });
  else {
    const two = S.format === '2v2';
    const t1 = two ? [S.pick.player, S.pick.partner] : [S.pick.player];
    const t2 = two ? [opts.rival, randomChar([S.pick.player, S.pick.partner, opts.rival]).id] : [opts.rival];
    S.sim = new Foot({ mode: 'play', difficulty: opts.difficulty, points: settings.points, format: S.format, team1: t1, team2: t2, venue: opts.venue });
  }
  S.demo = null;
  go('match');
}
function startFriendly() { startMatch({ venue: S.venue, difficulty: settings.difficulty, rival: S.pick.rival }); }
function playTournamentRound() {
  const t = getTournament()!, m = playerMatch(t)!;
  const rival = m.a === t.player ? m.b : m.a;
  startMatch({ venue: venueFor(t.round), difficulty: ROUND_DIFF[t.round], rival });
}

function go(s: Screen) {
  S.prev = S.screen; S.screen = s;
  audioGame.ambient = s === 'match' || s === 'pause' || s === 'title' || s === 'setup' || s === 'select' || s === 'venue' || s === 'bracket' || s === 'settings' || s === 'help' || s === 'result';
}

// ---------------------------------------------------------------- modelos de menú
function quit() { try { close(); } catch (e) { /* nada */ } toast('PARA SALIR: MANTÉN MENU Y PULSA START', 3.2); }
function yn(v: boolean) { return v ? 'SÍ' : 'NO'; }
function settingsItems(): Item[] {
  const mv = { assist: 'ASISTIDO', semi: 'SEMIASISTIDO', manual: 'MANUAL' } as const;
  const set = () => { saveSettings(); sfx.move(); };
  return [
    { t: 'MOVIMIENTO', v: mv[settings.movement], adj: (d) => { const l = ['assist', 'semi', 'manual'] as const; settings.movement = l[(l.indexOf(settings.movement) + d + 3) % 3]; set(); }, sub: settings.movement === 'assist' ? 'TU JUGADORA VA SOLA A LA BOLA: TÚ APUNTAS Y GOLPEAS' : settings.movement === 'semi' ? 'TE MUEVES TÚ; CERCA DE LA BOLA UN IMÁN TE COLOCA' : 'CONTROL TOTAL DEL MOVIMIENTO' },
    { t: 'REMATE AUTOMÁTICO', v: yn(settings.autoSmash), adj: () => { settings.autoSmash = !settings.autoSmash; set(); }, sub: 'SALTA SOLA PARA REMATAR LAS BOLAS ALTAS' },
    { t: 'BOTONES A / B', v: settings.swapAB ? 'CAMBIADOS' : 'NORMAL', adj: () => { settings.swapAB = !settings.swapAB; set(); }, sub: settings.swapAB ? 'B GOLPEA · A SALTA' : 'A GOLPEA · B SALTA' },
    { t: 'MÚSICA', v: yn(settings.music), adj: () => { settings.music = !settings.music; set(); } },
    { t: 'SONIDO', v: yn(settings.sound), adj: () => { settings.sound = !settings.sound; set(); } },
    { t: 'MODO LIGERO', v: yn(settings.lite), adj: () => { settings.lite = !settings.lite; set(); }, sub: 'MENOS PARTÍCULAS Y ESTELAS: MÁS FLUIDO' },
    { t: 'VSYNC', v: yn(settings.vsync), adj: () => { settings.vsync = !settings.vsync; set(); applyVsync(); }, sub: 'NO: MÁS FLUIDO · SÍ: IMAGEN SIN CORTES' },
    { t: 'DIAGNÓSTICO', v: yn(settings.diag), adj: () => { settings.diag = !settings.diag; set(); }, sub: 'DATOS DE RENDIMIENTO EN PANTALLA' },
    { t: 'HECHO', hot: true, act: () => go(S.settingsFrom) },
  ];
}
function model(scr: Screen): { title?: string; items: Item[]; back?: () => void; rows?: [string, string][]; big?: string; info?: string } | null {
  switch (scr) {
    case 'title': return {
      items: [
        { t: 'JUGAR', hot: true, act: () => go('setup'), sub: 'PALAS 1 VS 1 O FUTVÓLEY 1 VS 1 Y 2 VS 2' },
        { t: 'AJUSTES', act: () => { S.settingsFrom = 'title'; go('settings'); }, sub: 'MOVIMIENTO, BOTONES, SONIDO Y RENDIMIENTO' },
        { t: 'CONTROLES', act: () => go('help'), sub: 'QUÉ HACE CADA BOTÓN' },
        { t: 'SALIR', act: quit, sub: 'VOLVER AL MENÚ DE KNULLI' },
      ],
    };
    case 'setup': {
      const foot = S.sport === 'futvoley';
      const items: Item[] = [
        { t: 'DEPORTE', v: foot ? 'FUTVÓLEY' : 'PALAS', adj: () => { S.sport = foot ? 'palas' : 'futvoley'; if (S.sport === 'palas') S.format = '1v1'; sfx.move(); } },
        { t: 'MODO', v: S.mode === 'friendly' ? 'AMISTOSO' : 'TORNEO (8)', adj: () => { S.mode = S.mode === 'friendly' ? 'tournament' : 'friendly'; if (S.mode === 'tournament') S.format = '1v1'; sfx.move(); }, sub: S.mode === 'tournament' ? 'CUARTOS, SEMIFINAL Y FINAL: CADA RONDA EN UNA SEDE' : 'UN PARTIDO CONTRA LA MÁQUINA' },
      ];
      if (foot) items.push({ t: 'FORMATO', v: S.format === '1v1' ? '1 VS 1' : '2 VS 2', adj: () => { S.format = S.format === '1v1' ? '2v2' : '1v1'; if (S.format === '2v2') S.mode = 'friendly'; sfx.move(); }, sub: S.format === '1v1' ? '2 TOQUES: CONTROL Y PASE' : '3 TOQUES · TU COMPAÑERO ES LA MÁQUINA' });
      if (S.mode === 'friendly') items.push({ t: 'DIFICULTAD', v: diffName[settings.difficulty], adj: (d) => { const l = ['facil', 'normal', 'dificil'] as const; settings.difficulty = l[(l.indexOf(settings.difficulty) + d + 3) % 3]; saveSettings(); sfx.move(); } });
      items.push({ t: 'PUNTOS', v: 'A ' + settings.points, adj: (d) => { const l = [5, 7, 11]; settings.points = l[(l.indexOf(settings.points) + d + 3) % 3]; saveSettings(); sfx.move(); } });
      items.push({ t: S.mode === 'tournament' ? '¡AL TORNEO!' : '¡ELEGIR JUGADORES!', hot: true, act: () => { S.step = 'player'; S.cursor = getRoster().findIndex((c) => c.id === S.pick.player); go('select'); } });
      return { title: 'NUEVO PARTIDO', items, back: () => go('title') };
    }
    case 'venue': return {
      title: 'SEDE', items: [
        ...VENUES.map((v): Item => ({ t: v.name, v: S.venue === v.id ? '*' : '', act: () => { S.venue = v.id; startFriendly(); }, sub: v.short })),
      ], back: () => { S.step = 'rival'; go('select'); },
    };
    case 'pause': return {
      title: 'PAUSA', items: [
        { t: 'CONTINUAR', hot: true, act: () => go('match') },
        { t: 'AJUSTES', act: () => { S.settingsFrom = 'pause'; go('settings'); } },
        { t: 'CONTROLES', act: () => go('help') },
        { t: 'ABANDONAR', act: () => { S.sim = null; clearTournament(); newDemo(); go('title'); } },
      ], back: () => go('match'),
    };
    case 'settings': return { title: 'AJUSTES', items: settingsItems(), back: () => go(S.settingsFrom) };
    case 'help': return {
      title: 'CONTROLES', rows: [
        ['CRUCETA / STICK', 'MOVER · APUNTAR'], ['A', 'GOLPEAR (Y SACAR: 2 TOQUES)'], ['B', 'SALTAR'], ['X / Y', 'ESPECIAL (BARRA LLENA)'],
        ['ADELANTE + A', 'GOLPE PLANO / ATAQUE'], ['ATRÁS + A', 'GLOBO'], ['ARRIBA/ABAJO + A', 'PROFUNDIDAD'], ['START', 'PAUSA'], ['MENU + START', 'SALIR DEL JUEGO'],
      ], items: [{ t: 'VOLVER', hot: true, act: () => go(S.prev === 'help' ? 'title' : S.prev) }], back: () => go(S.prev === 'help' ? 'title' : S.prev),
    };
    case 'result': {
      const r = S.sim?.result; if (!r) return null;
      const t = getTournament();
      const won = r.winner === -1;
      const items: Item[] = [];
      if (t && !t.eliminated && t.round < 3) items.push({ t: 'SIGUIENTE RONDA', hot: true, act: () => go('bracket') });
      else if (t) items.push({ t: 'VER CUADRO', hot: true, act: () => go('bracket') });
      else items.push({ t: 'REVANCHA', hot: true, act: () => startFriendly() });
      items.push({ t: 'MENÚ', act: () => { S.sim = null; clearTournament(); newDemo(); go('title'); } });
      return {
        title: won ? '¡VICTORIA!' : 'DERROTA', big: `${r.score.a} - ${r.score.b}`,
        rows: [['PELOTEO MÁS LARGO', String(r.stats.longestRally)], ['GOLPES PERFECTOS', String(r.stats.perfects)], ['ESPECIALES', String(r.stats.specials)]],
        items, back: undefined,
      };
    }
  }
  return null;
}

function drawMenu(c: Ctx, scr: Screen, m: NonNullable<ReturnType<typeof model>>, sel: number) {
  const logoMode = scr === 'title';
  if (logoMode) { c.fillStyle = 'rgba(11,26,42,.35)'; c.fillRect(0, 0, W * 0.55, H); }
  else { c.fillStyle = 'rgba(10,5,24,.6)'; c.fillRect(0, 0, W, H); }
  const lh = 9, pad2 = 6;
  if (logoMode) {
    logo(c, 88, 26);
    const bx = 196, bw = 112, by = 40, bh = m.items.length * lh + pad2 * 2;
    panel(c, bx, by, bw, bh, C.orange);
    m.items.forEach((it, n) => {
      const y = by + pad2 + n * lh, on = n === sel;
      if (on) { c.fillStyle = C.sun; c.fillRect(bx + 3, y - 1, bw - 6, lh - 1); }
      text(c, it.t, bx + bw / 2, y + 1, 1, on ? C.night : it.hot ? C.orange : C.cream, null, 'c');
    });
    const sub = m.items[sel]?.sub;
    if (sub) wrap(sub, 30).slice(0, 2).forEach((l, i) => text(c, l, bx + bw / 2, by + bh + 5 + i * 7, 1, C.cream, '#000', 'c'));
    hint(c, 'A: ELEGIR  ·  MENU + START: SALIR' + '  ·  V' + VERSION);
    return;
  }
  const rowsW = m.rows ? Math.max(...m.rows.map((r) => textW(r[0]) + textW(r[1]) + 16)) : 0;
  const vw = Math.max(...m.items.map((it) => textW(it.t) + (it.v != null ? textW('< ' + it.v + ' >') + 14 : 0)));
  const bw = Math.min(W - 12, Math.max(170, vw, rowsW, m.title ? textW(m.title, 2) : 0) + pad2 * 2), bx = Math.round((W - bw) / 2);
  const subL = wrap(m.items[sel]?.sub ?? '', Math.floor((bw - 12) / 4)).slice(0, 2);
  const headH = m.title ? 16 : 0, bigH = m.big ? 20 : 0, rowsH = m.rows ? m.rows.length * 8 + 4 : 0;
  const vis = Math.min(m.items.length, Math.floor((H - 30 - headH - bigH - rowsH - 14) / lh));
  let scroll = 0; if (sel >= vis) scroll = sel - vis + 1;
  const bh = pad2 * 2 + headH + bigH + rowsH + vis * lh + (subL.length ? subL.length * 7 + 3 : 0);
  const by = Math.max(4, Math.round((H - 10 - bh) / 2));
  panel(c, bx, by, bw, bh);
  let y = by + pad2;
  if (m.title) { text(c, m.title, W / 2, y, 2, C.sun, '#000', 'c'); y += headH; }
  if (m.big) { text(c, m.big, W / 2, y, 3, C.cream, C.coral, 'c'); y += bigH; }
  if (m.rows) { for (const r of m.rows) { text(c, r[0], bx + pad2, y, 1, C.teal, null); text(c, r[1], bx + bw - pad2, y, 1, C.cream, null, 'r'); y += 8; } y += 4; }
  for (let n = scroll; n < Math.min(m.items.length, scroll + vis); n++) {
    const it = m.items[n], on = n === sel;
    if (on) { c.fillStyle = C.sun; c.fillRect(bx + 3, y - 1, bw - 6, lh - 1); }
    text(c, it.t, bx + pad2, y + 1, 1, on ? C.night : it.hot ? C.orange : C.cream, null);
    if (it.v != null) text(c, on && it.adj ? '< ' + it.v + ' >' : it.v, bx + bw - pad2, y + 1, 1, on ? C.night : C.sun, null, 'r');
    y += lh;
  }
  if (subL.length) { y += 3; for (const l of subL) { text(c, l, W / 2, y, 1, C.muted, null, 'c'); y += 7; } }
  hint(c, m.items.some((i) => i.adj) ? 'A: ELEGIR  ·  < >: CAMBIAR  ·  B: VOLVER' : m.back ? 'A: ELEGIR  ·  B: VOLVER' : 'A: ELEGIR');
}

function runMenu(c: Ctx, scr: Screen) {
  const m = model(scr); if (!m) return;
  let i = Math.max(0, Math.min(m.items.length - 1, S.sel[scr] ?? m.items.findIndex((x) => x.hot)));
  if (i < 0) i = 0;
  const it = m.items[i];
  if (pad.ev.up || pad.ev.down) { i = (i + (pad.ev.up ? -1 : 1) + m.items.length) % m.items.length; sfx.move(); }
  else if ((pad.ev.left || pad.ev.right) && it.adj) it.adj(pad.ev.left ? -1 : 1);
  else if (pad.ev.a || pad.ev.start) { sfx.ui(); if (it.act) it.act(); else if (it.adj) it.adj(1); }
  else if (pad.ev.b && m.back) { sfx.ui(); m.back(); }
  S.sel[scr] = i;
  if (S.screen === scr) { const m2 = model(scr); if (m2) drawMenu(c, scr, m2, Math.min(i, m2.items.length - 1)); }
}

// ---------------------------------------------------------------- selección de personaje
function runSelect(c: Ctx) {
  const R = getRoster(), cols = 5;
  const taken = S.step === 'partner' ? [S.pick.player] : S.step === 'rival' ? [S.pick.player, S.pick.partner].slice(0, S.format === '2v2' ? 2 : 1) : [];
  let k = S.cursor;
  if (pad.ev.left) k = (k + R.length - 1) % R.length; if (pad.ev.right) k = (k + 1) % R.length;
  if (pad.ev.up || pad.ev.down) k = (k + cols) % R.length;
  if (k !== S.cursor) { S.cursor = k; sfx.move(); }
  const ch = R[S.cursor];
  if (pad.ev.a || pad.ev.start) {
    if (taken.includes(ch.id)) sfx.netHit();
    else {
      sfx.ui(); S.pick[S.step] = ch.id;
      const t = S.mode === 'tournament';
      if (S.step === 'player') {
        if (t) { startTournament(ch.id, settings.points, S.sport); go('bracket'); }
        else if (S.sport === 'futvoley' && S.format === '2v2') { S.step = 'partner'; S.cursor = R.findIndex((x) => x.id !== ch.id); }
        else { S.step = 'rival'; S.cursor = R.findIndex((x) => x.id !== ch.id); }
      } else if (S.step === 'partner') { S.step = 'rival'; S.cursor = R.findIndex((x) => !taken.includes(x.id) && x.id !== ch.id); }
      else go('venue');
    }
  } else if (pad.ev.b) { sfx.ui(); if (S.step === 'player') go('setup'); else if (S.step === 'rival' && S.format === '2v2' && S.sport === 'futvoley') S.step = 'partner'; else S.step = 'player'; }

  c.fillStyle = 'rgba(10,5,24,.62)'; c.fillRect(0, 0, W, H);
  const title = S.step === 'player' ? 'ELIGE TU JUGADOR/A' : S.step === 'partner' ? 'ELIGE TU COMPAÑERO/A' : 'ELIGE RIVAL';
  text(c, title, W / 2, 6, 2, C.sun, '#000', 'c');
  const cw = 34, chh = 36, gx = 10, gy = 26;
  R.forEach((r, i) => {
    const x = gx + (i % cols) * (cw + 3), y = gy + Math.floor(i / cols) * (chh + 4), on = i === S.cursor, tk = taken.includes(r.id);
    c.fillStyle = on ? C.sun : '#0b1430'; c.fillRect(x - 1, y - 1, cw + 2, chh + 2);
    c.fillStyle = '#' + r.color.toString(16).padStart(6, '0'); c.fillRect(x, y, cw, chh);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + chh - 9, cw, 9);
    head(c, r, x + cw / 2, y + chh - 7, 27, on ? 'head_happy' : 'head');
    text(c, r.name, x + cw / 2, y + chh - 7, 1, C.cream, '#000', 'c');
    if (tk) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y, cw, chh); }
  });
  // ficha
  const px = 200, py = 24, pw = 112, ph = 136;
  panel(c, px, py, pw, ph, '#' + ch.color.toString(16).padStart(6, '0'));
  head(c, ch, px + pw / 2, py + 52, 46, 'head_happy');
  text(c, ch.name, px + pw / 2, py + 56, 2, C.cream, '#000', 'c');
  text(c, ch.element === 'sun' ? 'ESPECIAL: FUEGO' : 'ESPECIAL: AGUA', px + pw / 2, py + 70, 1, ch.element === 'sun' ? C.orange : '#5fe0f0', null, 'c');
  const st = [['VELOCIDAD', ch.stats.speed], ['POTENCIA', ch.stats.power], ['CONTROL', ch.stats.control]] as [string, number][];
  st.forEach(([n, v], i) => {
    const y = py + 82 + i * 11;
    text(c, n, px + 6, y, 1, C.muted, null);
    for (let b = 0; b < 5; b++) { c.fillStyle = b < v ? C.sun : '#0b1430'; c.fillRect(px + 58 + b * 9, y - 1, 7, 6); }
  });
  if (S.step !== 'player') text(c, 'TÚ: ' + getChar(S.pick.player).name + (S.step === 'rival' && S.format === '2v2' && S.sport === 'futvoley' ? ' & ' + getChar(S.pick.partner).name : ''), px + pw / 2, py + 120, 1, C.teal, null, 'c');
  hint(c, taken.includes(ch.id) ? 'YA ELEGIDO' : 'CRUCETA: ELEGIR  ·  A: CONFIRMAR  ·  B: VOLVER');
}

// ---------------------------------------------------------------- cuadro del torneo
function runBracket(c: Ctx) {
  const t = getTournament(); if (!t) { go('title'); return; }
  const over = t.round >= 3 || t.eliminated;
  if (pad.ev.a || pad.ev.start) { sfx.ui(); if (over) { clearTournament(); S.sim = null; newDemo(); go('title'); } else playTournamentRound(); return; }
  if (pad.ev.b) { sfx.ui(); clearTournament(); S.sim = null; newDemo(); go('title'); return; }
  c.fillStyle = 'rgba(10,5,24,.75)'; c.fillRect(0, 0, W, H);
  text(c, t.sport === 'futvoley' ? 'TORNEO DE FUTVÓLEY' : 'TORNEO DE PALAS', W / 2, 5, 2, C.sun, '#000', 'c');
  const colX = [8, 112, 216], colW = 96;
  t.rounds.forEach((round, ri) => {
    text(c, ROUND_NAMES[ri], colX[ri] + colW / 2, 22, 1, ri === Math.min(2, t.round) && !over ? C.orange : C.muted, null, 'c');
    const n = [4, 2, 1][ri], gap = 132 / n;
    for (let i = 0; i < n; i++) {
      const m = round[i], y = 32 + i * gap + (gap - 26) / 2;
      panel(c, colX[ri], y, colW, 24, m && (m.a === t.player || m.b === t.player) ? C.orange : C.cream);
      if (!m) { text(c, '?', colX[ri] + colW / 2, y + 9, 1, C.muted, null, 'c'); continue; }
      [m.a, m.b].forEach((id, j) => {
        const ch = getChar(id), yy = y + 4 + j * 9, win = m.winner === id, lose = m.winner && !win;
        text(c, ch.name, colX[ri] + 5, yy, 1, id === t.player ? C.sun : lose ? '#6b7290' : C.cream, null);
        if (m.score) text(c, String(m.score[j]), colX[ri] + colW - 5, yy, 1, win ? C.green : '#6b7290', null, 'r');
      });
    }
  });
  let msg: string;
  if (t.champion) msg = t.champion === t.player ? '¡CAMPEÓN/A DEL TORNEO!' : 'CAMPEÓN/A: ' + getChar(t.champion).name;
  else if (t.eliminated) msg = 'ELIMINADO/A';
  else msg = ROUND_NAMES[t.round] + ' · ' + VENUES[Math.min(t.round, 2)].name + ' · ' + diffName[ROUND_DIFF[t.round]];
  text(c, msg, W / 2, 166 - 8, 1, t.champion === t.player ? C.green : C.cream, '#000', 'c');
  hint(c, over ? 'A: TERMINAR' : 'A: ¡A JUGAR!  ·  B: ABANDONAR');
}

// ---------------------------------------------------------------- HUD del partido
function bar(c: Ctx, x: number, y: number, w: number, h: number, v: number, col: string, full: boolean, t: number) {
  c.fillStyle = '#0b1430'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = full && Math.sin(t * 12) > 0 ? '#ffffff' : col; c.fillRect(x, y, Math.round(w * Math.min(1, v)), h);
}
function drawHud(c: Ctx, sim: Sim) {
  const h = sim.hud, t = sim.now;
  // marcador
  const pw = 150, px = Math.round((W - pw) / 2);
  c.fillStyle = 'rgba(11,20,48,.82)'; c.fillRect(px, 2, pw, 15);
  c.fillStyle = C.orange; c.fillRect(px, 2, 3, 15); c.fillStyle = C.teal; c.fillRect(px + pw - 3, 2, 3, 15);
  text(c, h.names[0], px + 6, 4, 1, C.cream, null);
  text(c, h.names[1], px + pw - 6, 4, 1, C.cream, null, 'r');
  text(c, `${sim.score[-1]}-${sim.score[1]}`, W / 2, 4, 2, C.sun, '#000', 'c');
  bar(c, px + 6, 12, 44, 2, h.meters[0], C.orange, h.meters[0] >= 1 || h.powered[0], t);
  bar(c, px + pw - 50, 12, 44, 2, h.meters[1], C.teal, h.meters[1] >= 1 || h.powered[1], t);
  if (h.meters[0] >= 1 && !h.powered[0] && sim.mode === 'play') text(c, 'X/Y: ¡ESPECIAL!', 4, H - 34, 1, Math.sin(t * 10) > 0 ? C.sun : C.orange, '#000');
  if (h.rally >= 3) text(c, h.rally + (sim instanceof Foot ? ' TOQUES' : ' GOLPES'), px + pw - 6, 19, 1, C.cream, '#000', 'r');
  if (h.ringLabel) text(c, h.ringLabel, W / 2, 19, 1, C.sun, '#000', 'c');
  // barra del saque
  if (h.serve.phase !== 'hide') {
    const bw = 90, bx = Math.round((W - bw) / 2), by = H - 26;
    c.fillStyle = '#000'; c.fillRect(bx - 2, by - 2, bw + 4, 10);
    const zones: [number, number, string][] = [[0, 0.6, '#5a6478'], [0.6, 0.82, '#ffd23f'], [0.82, 0.97, '#4dff6a'], [0.97, 1, '#ff5a3a']];
    for (const [a, b2, col] of zones) { c.fillStyle = col; c.fillRect(bx + Math.round(a * bw), by, Math.round((b2 - a) * bw), 6); }
    const mx = bx + Math.round(h.serve.v * bw);
    c.fillStyle = '#ffffff'; c.fillRect(mx - 1, by - 3, 3, 12);
    text(c, h.serve.phase === 'done' ? ({ perfect: '¡PERFECTO!', good: 'BIEN', weak: 'FLOJO', over: '¡DEMASIADO!' } as any)[h.serve.zone!] : 'A: ¡GOLPEA EN VERDE!', W / 2, by - 9, 1, C.cream, '#000', 'c');
  } else if (h.serving) text(c, h.serveText, W / 2, H - 22, 1, Math.sin(t * 5) > -0.3 ? C.cream : C.sun, '#000', 'c');
  if (h.bannerT > 0) {
    const a = Math.min(1, h.bannerT * 3, (2.2 - h.bannerT) * 6);
    c.globalAlpha = Math.max(0, a);
    c.fillStyle = 'rgba(232,67,58,.9)'; c.fillRect(0, 70, W, 22);
    text(c, h.banner, W / 2, 74, 3, C.cream, '#000', 'c');
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- diagnóstico (una vez por segundo)
const D = { t: 0, n: 0, ms: 0, fps: 0, img: null as Img | null, line: '', full: [] as string[], log: 0 };
function diag(dt: number, frameMs: number) {
  D.n++; D.t += dt; D.ms += frameMs;
  if (D.t < 1) return;
  const fps = Math.round(D.n / D.t), game = D.ms / D.n, aud = SYN.ms / D.t;
  SYN.ms = 0; D.fps = fps; D.t = 0; D.n = 0; D.ms = 0;
  const w = PADX.win();
  const rend = w ? 'REND ' + (w.accelerated ? 'GPU' : 'CPU') + ' VSYNC ' + (w.vsync ? 'SI' : 'NO') : 'REND ?';
  const q = SYN.dev ? Math.round(SYN.queued() * 1000) : '-';
  D.line = 'FPS ' + fps + ' · JUEGO ' + game.toFixed(1) + 'MS · AUDIO ' + aud.toFixed(0) + ' · COLA ' + q;
  D.full = ['MANDOS ' + pad.pads + (pad.list ? ': ' + pad.list : ''), D.line + ' · ' + (SYN.err || SYN.state) + ' · VOCES ' + SYN.voices.length + ' · REAB ' + SYN.reopens, rend + ' · ' + W + 'X' + H + ' · ' + PADX.info()];
  D.img = null;
  if (++D.log % 5 === 0) console.error('[BeachSports] ' + D.full.join(' · '));
}
function drawDiag(c: Ctx, full: boolean) {
  if (!settings.diag || !D.line) return;
  if (!D.img) {
    const lines = full ? D.full : [D.line];
    const w = full ? W : Math.min(W, textW(D.line) + 4), h = 7 * lines.length;
    D.img = mkCanvas(w, h); const x = ctx2d(D.img);
    x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, 0, w, h);
    lines.forEach((l, i) => text(x, l.slice(0, 79), 2, 1 + i * 7, 1, '#9fffb0', null));
    (D.img as any)._full = full;
  }
  if ((D.img as any)._full !== full) { D.img = null; drawDiag(c, full); return; }
  c.drawImage(D.img as any, full ? 0 : Math.round((W - (D.img as any).width) / 2), full ? H - 10 - (D.img as any).height : H - 7);
}

// ---------------------------------------------------------------- bucle
function applyVsync() { const w = PADX.win(); if (!w || typeof w.setVsync !== 'function') return; try { if (!!w.vsync !== !!settings.vsync) w.setVsync(!!settings.vsync); } catch (e: any) { console.error('[BeachSports] vsync: ' + (e && e.message)); } }

export function boot() {
  loadSettings();
  const cv: any = document.getElementById('cv');
  cv.width = W; cv.height = H;
  const c = ctx2d(cv);
  const t0 = performance.now();
  buildRoster();
  newDemo();
  console.error('[BeachSports] arranque ' + VERSION + ' en ' + Math.round(performance.now() - t0) + ' ms · ' + (CONSOLE ? 'consola' : 'navegador'));
  try { sdl && sdl.video && sdl.video.windows[0] && sdl.video.windows[0].setVsync(false); } catch (e) { /* nada */ }
  applyVsync();
  go('title');
  if (!CONSOLE) (globalThis as any).__bs = { S, D, settings, go, startFriendly };
  let last = 0, acc = 0, started = false;
  const STEP = 1 / 60;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const tA = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (!started) { started = true; SYN.start(cv); }
    SYN.frame += (Math.min(0.2, dt) - SYN.frame) * 0.1;
    pad.poll(dt);
    const scr = S.screen;
    if (!S.sim && !S.demo) newDemo();
    const sim = scr === 'match' || scr === 'pause' || (scr === 'settings' && S.settingsFrom === 'pause') || scr === 'result' || (scr === 'help' && S.prev === 'pause') || ((scr === 'bracket') && S.sim) ? S.sim : S.demo;
    const running = sim && (scr === 'match' || sim === S.demo || scr === 'result');
    if (sim && running) {
      acc += dt; let k = 0;
      while (acc >= STEP && k < 4) { sim.step(STEP); acc -= STEP; k++; }
      if (k >= 4) acc = 0;
      if (sim === S.demo && sim.state === 'over' && sim.stateT > 3) newDemo();
    }
    if (sim) sim.render(c); else { c.fillStyle = '#1b2240'; c.fillRect(0, 0, W, H); }
    if (scr === 'match' && S.sim) {
      drawHud(c, S.sim);
      if (pad.ev.start) { sfx.ui(); go('pause'); }
      if (S.sim.result && S.sim.stateT > 3) {
        const r = S.sim.result, t = getTournament();
        if (t && !(S.sim as any)._reported) { (S.sim as any)._reported = true; reportResult(r.winner === -1, r.score.a, r.score.b); }
        go('result');
      }
    } else if (scr === 'select') runSelect(c);
    else if (scr === 'bracket') runBracket(c);
    else runMenu(c, scr);
    if (S.toastT > 0) { S.toastT -= dt; const tw = textW(S.toast) + 12; c.fillStyle = C.cream; c.fillRect(Math.round((W - tw) / 2), H - 30, tw, 11); text(c, S.toast, W / 2, H - 27, 1, C.night, null, 'c'); }
    if (scr === 'match') drawDiag(c, false); else if (scr === 'title' || scr === 'settings' || scr === 'pause') drawDiag(c, true);
    diag(dt, performance.now() - tA);
    SYN.pump();
  };
  requestAnimationFrame(loop);
}
