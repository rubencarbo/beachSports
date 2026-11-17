// Genera un único HTML autocontenido (juego + Phaser inline) para publicarlo como demo.
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const out = 'dist-artifact';
await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: out, emptyOutDir: true, target: 'es2020', modulePreload: false, assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const js = readdirSync(`${out}/assets`).find((f) => f.endsWith('.js'));
let code = readFileSync(`${out}/assets/${js}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Beach Sports</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
  /* Mundo único de juego (playa soleada): una sola apariencia, colores explícitos */
  :root { --sky: #5c8ad1; --panel: #1d2a3a; --ink: #ffffff; color-scheme: light; }
  html, body { height: 100%; margin: 0; background: var(--sky); overflow: hidden; overscroll-behavior: none;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none; }
  #game { position: fixed; inset: 0; }
  #rotate { display: none; position: fixed; inset: 0; z-index: 10; background: var(--panel); color: var(--ink);
    font-family: 'Press Start 2P', 'Courier New', monospace; font-size: 16px; line-height: 1.6; text-align: center;
    align-items: center; justify-content: center; flex-direction: column; gap: 18px; padding: 16px; }
  #rotate .phone { width: 46px; height: 80px; border: 5px solid var(--ink); border-radius: 10px; animation: rot 1.8s ease-in-out infinite; }
  @keyframes rot { 0%, 30% { transform: rotate(0); } 60%, 100% { transform: rotate(90deg); } }
  @media (prefers-reduced-motion: reduce) { #rotate .phone { animation: none; transform: rotate(90deg); } }
  @media (orientation: portrait) and (max-width: 900px) { #rotate { display: flex; } }
</style>
<div id="game"></div>
<div id="rotate"><div class="phone"></div>Gira el móvil para jugar</div>
<script type="module">${code}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/beach-sports.html', html);
console.log('artifact/beach-sports.html', (html.length / 1024).toFixed(0), 'KB');
