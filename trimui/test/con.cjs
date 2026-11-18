// Emulación de la edición consola en Chromium (1280x720, canvas 320x180, teclado como mando). Uso: node trimui/test/con.cjs <carpeta-salida>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const dir = path.join(__dirname, 'conweb');
fs.copyFileSync(path.join(__dirname, '../../dist/trimui/beachsports/game.js'), path.join(dir, 'game.js'));
(async () => {
  const out = process.argv[2] || 'trimui/build/shots'; fs.mkdirSync(out, { recursive: true });
  const srv = http.createServer((q, r) => { const f = dir + (q.url === '/' ? '/index.html' : q.url); try { const d = fs.readFileSync(f); r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); } catch (e) { r.writeHead(404); r.end(); } }).listen(8765);
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join('|')));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('[BeachSports]')) errs.push('console: ' + m.text().slice(0, 200)); else if (process.env.V) console.log(m.text().slice(0, 300)); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  const shot = async (n) => p.screenshot({ path: `${out}/${n}.png` });
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.down(k); await p.waitForTimeout(70); await p.keyboard.up(k); await p.waitForTimeout(140); } };
  const st = () => p.evaluate(() => ({ scr: __bs.S.screen, line: __bs.D.line, state: __bs.S.sim && __bs.S.sim.state, score: __bs.S.sim && [__bs.S.sim.score[-1], __bs.S.sim.score[1]] }));
  await shot('01-title'); console.log(await st());
  await key('Enter'); await shot('02-setup');
  // palas amistoso: ELEGIR JUGADORES
  await key('Enter'); await shot('03-select');
  await key('Enter'); await key('ArrowRight'); await key('Enter'); await shot('04-venue');
  await key('ArrowDown'); await key('Enter'); await p.waitForTimeout(1500); await shot('05-palas-serve');
  console.log(await st());
  // saque: A y A en verde (el bot pulsa cuando la barra está alta)
  await key('Enter'); await p.waitForTimeout(350); await key('Enter');
  await p.waitForTimeout(900); await shot('06-palas-rally');
  // juego automático: pulsa A cuando el anillo está verde
  await p.evaluate(() => { window.__auto = setInterval(() => { const s = __bs.S.sim; if (!s) return; if (s.ring && s.ring.col === '#4dff6a') { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z' })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'z' })), 40); } if (s.hud.serving) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z' })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'z' })), 40); } if (s.hud.serve.phase === 'run' && s.hud.serve.v > 0.85 && s.hud.serve.v < 0.95) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z' })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'z' })), 40); } }, 30); });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); if (i === 2) await shot('07-palas-mid'); }
  console.log('palas', await st());
  // especial
  await p.evaluate(() => { const s = __bs.S.sim; s.p1.meter = 1; });
  await key('KeyC'); await p.waitForTimeout(400); await shot('08-palas-special');
  await p.waitForTimeout(3000); await shot('09-palas-after');
  console.log('palas', await st());
  // pausa
  await key('KeyP'); await shot('10-pause'); await key('ArrowDown', 3); await key('Enter'); await p.waitForTimeout(500); console.log(await st());
  // futvóley 2v2
  await key('Enter'); await p.evaluate(() => { __bs.S.sel.setup = 0; });
  await key('ArrowRight'); await key('ArrowDown', 2); await key('ArrowRight'); await shot('12-setup-2v2');
  await key('ArrowDown', 3); await key('Enter'); await key('Enter'); await key('Enter'); await shot('13-select-rival'); await key('Enter'); await key('Enter'); await p.waitForTimeout(1500);
  await shot('14-foot-serve'); console.log(await st());
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); if (i === 2) await shot('15-foot-mid'); }
  console.log('foot', await st());
  const ms = await p.evaluate(async () => { const t = []; let n = 0; await new Promise((r) => { const f = () => { if (++n > 120) return r(); requestAnimationFrame(f); }; requestAnimationFrame(f); }); return __bs.D.line; });
  console.log('perf', ms);
  // torneo de palas: cuadro, partido, resultado, siguiente ronda
  await p.evaluate(() => { const S = __bs.S; S.sim = null; S.sport = 'palas'; S.mode = 'tournament'; S.format = '1v1'; S.step = 'player'; S.cursor = 4; __bs.go('select'); });
  await key('Enter'); await p.waitForTimeout(300); await shot('16-bracket');
  await key('Enter'); await p.waitForTimeout(1500); await shot('17-tour-match'); console.log('torneo', await st());
  await p.evaluate(() => { const s = __bs.S.sim; s.result = { winner: -1, score: { a: 7, b: 4 }, mode: 'play', stats: { specials: 1, perfects: 5, longestRally: 9 } }; s.state = 'over'; s.stateT = 5; });
  await p.waitForTimeout(500); await shot('18-result');
  await key('Enter'); await p.waitForTimeout(300); await shot('19-bracket-semis');
  await key('KeyX'); await p.waitForTimeout(300);
  await key('ArrowDown'); await key('Enter'); await p.waitForTimeout(300); await shot('20-settings');
  console.log(await st());
  console.log('errors', errs.join('\n') || 'none');
  srv.close(); await b.close();
})();
