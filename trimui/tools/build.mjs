// Build de la edición TrimUI: un solo game.js (módulo ES) con la línea de alias de globales lo primero.
import { build } from 'esbuild';
import fs from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const VER = process.env.VER || pkg.version || '1.0.0';
const OUT = 'dist/trimui/beachsports';
fs.mkdirSync(OUT, { recursive: true });
const prelude = fs.readFileSync('trimui/src/prelude.js', 'utf8');
const r = await build({
  entryPoints: ['trimui/src/main.ts'], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  write: false, minifySyntax: true, minifyWhitespace: true, legalComments: 'none', charset: 'utf8',
  define: { 'import.meta.env': '{}' },
});
const code = r.outputFiles[0].text;
if (/\bdocument\.createElement\b/.test(code.replace(/typeof OffscreenCanvas[^;]*/g, ''))) console.warn('aviso: document.createElement en el bundle (sólo debe usarse sin OffscreenCanvas)');
fs.writeFileSync(`${OUT}/game.js`, prelude + code);
fs.writeFileSync(`${OUT}/package.json`, JSON.stringify({ name: 'beachsports', version: VER, type: 'module', main: 'game.js' }, null, 1) + '\n');
fs.writeFileSync(`${OUT}/BeachSports.jsg`, '');
execSync(`node --check ${OUT}/game.js`, { stdio: 'inherit' });
const first = fs.readFileSync(`${OUT}/game.js`, 'utf8').split('\n')[0];
if (!first.startsWith('const {Math,')) throw new Error('la primera línea debe ser el alias de globales');
// ---- distribución: instalador (con la URL del hosting), paquete de dependencias y zip para copiar a mano
let url = process.env.TRIMUI_URL;
if (!url) { try { const env = fs.readFileSync('.env.local', 'utf8').match(/^VITE_FIREBASE_PROJECT_ID=(\S+)/m); if (env) url = `https://${env[1]}.web.app/trimui`; } catch (e) { /* sin .env.local */ } }
if (!url) { try { const rc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8')); const id = rc.projects && rc.projects.default; if (id) url = `https://${id}.web.app/trimui`; } catch (e) { /* sin .firebaserc */ } }
if (!url) { url = 'https://TU-PROYECTO.web.app/trimui'; console.warn('aviso: sin TRIMUI_URL ni .firebaserc; el instalador necesitará JUEGO_URL=...'); }
fs.writeFileSync('dist/trimui/instalar.sh', fs.readFileSync('trimui/instalar.sh', 'utf8').replaceAll('__URL__', url), { mode: 0o755 });
if (fs.existsSync('trimui/build/jsgl-deps-arm64.tar.gz')) fs.copyFileSync('trimui/build/jsgl-deps-arm64.tar.gz', 'dist/trimui/jsgl-deps-arm64.tar.gz');
else console.warn('aviso: falta trimui/build/jsgl-deps-arm64.tar.gz (genéralo con trimui/tools/deps.sh)');
fs.copyFileSync('trimui/LEEME.txt', 'dist/trimui/LEEME.txt');
// sin un segundo index.html en el sitio: evita que sustituya al del juego al publicar
fs.writeFileSync('dist/trimui/consola.html', fs.readFileSync('trimui/web/index.html', 'utf8').replaceAll('__URL__', url).replaceAll('__VER__', VER));
execSync(`cd dist/trimui && rm -f beachsports-trimui.zip && python3 -c "import zipfile,os;z=zipfile.ZipFile('beachsports-trimui.zip','w',zipfile.ZIP_DEFLATED);[z.write(os.path.join(r,f)) for r,_,fs in os.walk('beachsports') for f in fs];z.write('instalar.sh');z.write('LEEME.txt');z.close()"`);
console.log('instalador:', url + '/instalar.sh');
// copia lista para instalar desde GitHub (raw), sin desplegar hosting: trimui/release/
try {
  const remote = execSync('git remote get-url origin').toString().trim().replace(/\.git$/, '');
  const m = remote.match(/github\.com[/:]([^/]+)\/([^/]+)$/);
  const branch = process.env.RELEASE_BRANCH || execSync('git branch --show-current').toString().trim();
  if (m && branch) {
    const rurl = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${branch}/trimui/release`;
    fs.mkdirSync('trimui/release/beachsports', { recursive: true });
    for (const f of ['game.js', 'package.json', 'BeachSports.jsg']) fs.copyFileSync(`${OUT}/${f}`, `trimui/release/beachsports/${f}`);
    fs.writeFileSync('trimui/release/instalar.sh', fs.readFileSync('trimui/instalar.sh', 'utf8').replaceAll('__URL__', rurl), { mode: 0o755 });
    fs.copyFileSync('trimui/LEEME.txt', 'trimui/release/LEEME.txt');
    console.log('release (GitHub):', rurl + '/instalar.sh');
  }
} catch (e) { console.warn('aviso: sin copia para GitHub: ' + e.message); }
console.log(`${OUT}/game.js`, (fs.statSync(`${OUT}/game.js`).size / 1024).toFixed(0), 'KB · node --check OK');
