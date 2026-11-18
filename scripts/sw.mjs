// Genera dist/sw.js tras `vite build`: precarga todo el juego web para jugar sin conexión.
// La carpeta /trimui/ (consola) queda fuera.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIST = 'dist';
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (p !== path.join(DIST, 'trimui')) walk(p); } else files.push(p); } };
walk(DIST);
const list = files.map((f) => './' + path.relative(DIST, f).split(path.sep).join('/')).filter((f) => f !== './sw.js' && !f.endsWith('.map'));
const h = crypto.createHash('sha1');
for (const f of files) h.update(fs.readFileSync(f));
const VERSION = h.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sw.js'), `// generado por scripts/sw.mjs
const CACHE = 'beachsports-${VERSION}';
const FILES = ${JSON.stringify(['./', ...list])};
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('beachsports-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin || u.pathname.includes('/trimui/')) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('./index.html', { ignoreSearch: true }))); return; }
  e.respondWith(caches.match(r, { ignoreVary: true, ignoreSearch: true }).then((m) => m || fetch(r)));
});
`);
console.log('sw.js', VERSION, list.length, 'archivos');
