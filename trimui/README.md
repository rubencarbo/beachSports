# Beach Sports · edición TrimUI Smart Pro (Knulli + jsgamelauncher)

Port de consola hecho siguiendo `GUIA-PORTAR-A-TRIMUI.md` (kit de CatalunyaRUN / Mossos H.Q.).
Phaser no funciona en jsgamelauncher (WebGL/DOM), así que la consola usa un **bucle propio en Canvas 2D a 320×180**
y **comparte con la web toda la lógica pura**: física de la bola (`src/entities/ballPhysics.ts`), jugador y fases del
golpe (`playerCore.ts`), poses y esqueleto (`poses.ts`), IA y trayectorias (`Ai.ts`, `shots.ts`), personajes y
recoloreado (`src/game/charData.ts`), sedes y torneo.

| Pieza | Archivo |
|---|---|
| Primera línea: alias de globales (contexto `node:vm`) | `src/prelude.js` |
| Cámara de TV (muelles, cortes con prioridad, zoom, sacudida, destello) + decorado con paralaje + personajes por piezas | `src/world.ts` |
| Palas 1 vs 1 / Futvóley 1 vs 1 y 2 vs 2 (port de `MatchScene` / `FootScene`) | `src/palas.ts`, `src/foot.ts` |
| Menús en el canvas, HUD, diagnóstico, bucle de paso fijo (≤ 4 subpasos) | `src/app.ts` |
| Sintetizador → `sdl.audio` (mono 22050 Hz f32, cola adaptativa, perro guardián) | `src/audio.ts` |
| Mando (Knulli A=1/B=0, PADX directo por `sdl.joystick`, teclado para pruebas) | `src/input.ts` |
| Recursos incrustados (zlib + base64; inflate propio) | `src/gfx.ts`, `src/inflate.ts`, `assets/assets.json` |

## Construir

```bash
npm run build && npm run build:trimui        # dist/ (web) + dist/trimui/ (consola, instalador, zip)
```

`build:trimui` genera `dist/trimui/beachsports/{game.js,package.json,BeachSports.jsg}`, comprueba `node --check`,
escribe `dist/trimui/instalar.sh` con la URL del hosting (`TRIMUI_URL=https://<proyecto>.web.app/trimui` o `.firebaserc`),
copia `jsgl-deps-arm64.tar.gz` si existe y deja una copia instalable desde GitHub en `trimui/release/`.

Decorados (sólo si cambia el arte de la web): `npx vite preview --port 4173` y luego
`node trimui/tools/capture.cjs && python3 trimui/tools/bake.py` (hornea cada capa sobre negro y blanco para recuperar
la transparencia, la reduce a la escala de la consola y aplica el etalonaje de cada sede).

Dependencias de jsgamelauncher para arm64 (21 MB, sin enlaces simbólicos): `trimui/tools/deps.sh`.

## Probar sin la consola

- `node trimui/test/con.cjs` — emulación en Chromium a 1280×720 (menús, palas, especial, futvóley 2 vs 2, torneo).
- Lanzador real en el PC: `SDL_VIDEODRIVER=offscreen SDL_AUDIODRIVER=disk SDL_DISKAUDIOFILE=/tmp/a.raw node cli.js -rom dist/trimui/beachsports/BeachSports.jsg`.

Medido en el PC con el lanzador real: arranque 80–100 ms, **0,5 ms por fotograma** (presupuesto de la guía: ≤ 3 ms),
audio 4 ms de CPU por segundo, cola estable de 123 ms; con 70 ms de espera forzada por fotograma (14 FPS) el audio no se corta.

## Instalar en la consola

Por SSH (`root` / `linux`):

```bash
curl -fsSL https://raw.githubusercontent.com/rubencarbo/beachSports/claude/admiring-rubin-ate8ux/trimui/release/instalar.sh | bash
```

o, tras `npm run deploy` con el hosting configurado, `curl -fsSL https://<proyecto>.web.app/trimui/instalar.sh | bash`.
Luego: START > Ajustes de juegos > Actualizar listas de juegos → **JS Games** → Beach Sports.
