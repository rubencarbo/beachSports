#!/bin/bash
# Instalador por red para Knulli (TrimUI Smart Pro) de Beach Sports (jsgamelauncher).
# Uso en la consola, por SSH (root / linux):
#   curl -fsSL https://raw.githubusercontent.com/rubencarbo/beachSports/claude/admiring-rubin-ate8ux/trimui/release/instalar.sh | bash
URL="${JUEGO_URL:-https://raw.githubusercontent.com/rubencarbo/beachSports/claude/admiring-rubin-ate8ux/trimui/release}"
JUEGOS="beachsports:BeachSports"
case "$URL" in *TU-PROYECTO*) echo "ERROR: falta la dirección del hosting. Usa: JUEGO_URL=https://<tu-sitio>/trimui bash instalar.sh"; exit 1;; esac
JSG=/userdata/system/jsgamelauncher
ROMS=/userdata/roms/jsgames
ESCFG=/userdata/system/configs/emulationstation
echo ""
echo "=== Beach Sports · instalador para Knulli (TrimUI Smart Pro) ==="
# 1) cada juego: game.js + package.json desde el hosting y un .jsg vacío (es lo que lista EmulationStation)
for J in $JUEGOS; do
  D="${J%%:*}"; N="${J##*:}"; GAME="$ROMS/$D"
  echo "-> $N: descargando..."
  mkdir -p "$GAME" || { echo "ERROR: no puedo crear $GAME"; exit 1; }
  for f in game.js package.json; do
    if ! curl -fsSL "$URL/$D/$f" -o "$GAME/$f.tmp"; then
      echo "ERROR: no se pudo descargar $D/$f. Revisa el Wi-Fi."; rm -f "$GAME/$f.tmp"; exit 1
    fi
    mv -f "$GAME/$f.tmp" "$GAME/$f"
  done
  : > "$GAME/$N.jsg"
done
# 2) jsgamelauncher, si falta (instalador oficial de monteslu)
if [ ! -f "$JSG/cli.js" ]; then
  echo "-> Instalando jsgamelauncher (5-10 minutos, no apagues la consola)..."
  curl -fsSL https://raw.githubusercontent.com/monteslu/jsgamelauncher/main/installers/install-batocera-knulli.sh | bash
  [ -f "$JSG/cli.js" ] || { echo "ERROR: no se pudo instalar jsgamelauncher."; exit 1; }
fi
source ~/.bash_profile >/dev/null 2>&1
# 3) dependencias nativas: la SD es exFAT (sin enlaces simbólicos) y npm se queda roto. Se descarga un node_modules
#    ya preparado para arm64 y sin enlaces (jsgl-deps-arm64.tar.gz, ~21 MB, publicado junto a este script).
A=$(node -p process.arch 2>/dev/null)
deps_ok(){ [ -f "$JSG/node_modules/@kmamal/sdl/dist/sdl.node" ] && [ -f "$JSG/node_modules/@kmamal/sdl/dist/libSDL2-2.0.so.0" ] \
  && [ -d "$JSG/node_modules/@napi-rs/canvas-linux-$A-gnu" ] && [ -d "$JSG/node_modules/webaudio-node" ] && [ -d "$JSG/node_modules/gamepad-node" ] && [ -d "$JSG/node_modules/commander" ]; }
if ! deps_ok; then
  echo "-> Instalando dependencias de jsgamelauncher (21 MB)..."
  rm -rf /tmp/jsgl && mkdir -p /tmp/jsgl
  if curl -fsSL "$URL/jsgl-deps-$A.tar.gz" -o /tmp/jsgl/deps.tar.gz && tar xzf /tmp/jsgl/deps.tar.gz -C /tmp/jsgl; then
    rm -rf "$JSG/node_modules"; cp -r /tmp/jsgl/node_modules "$JSG/"
  else
    echo "-> Sin paquete preparado; pruebo con npm (sin enlaces) + binarios de GitHub..."
    cd "$JSG" || exit 1
    NPM="npm"; [ -n "$(npm -v 2>/dev/null)" ] || NPM="node $(dirname "$(command -v node)")/../lib/node_modules/npm/bin/npm-cli.js"
    $NPM install --ignore-scripts --no-bin-links --no-audit --no-fund 2>&1 | tail -n 3
    mkdir -p /tmp/jsgl/sdl /tmp/jsgl/gles
    V=$(node -p "require('./node_modules/@kmamal/sdl/package.json').version")
    curl -fsSL "https://github.com/kmamal/node-sdl/releases/download/v$V/sdl.node-v$V-linux-$A.tar.gz" | tar xz -C /tmp/jsgl/sdl && mkdir -p node_modules/@kmamal/sdl/dist && cp -L /tmp/jsgl/sdl/* node_modules/@kmamal/sdl/dist/
    V=$(node -p "require('./node_modules/native-gles/package.json').version")
    curl -fsSL "https://github.com/monteslu/native-gles/releases/download/v$V/gles.node-v$V-linux-$A.tar.gz" | tar xz -C /tmp/jsgl/gles && mkdir -p node_modules/native-gles/dist && cp -L /tmp/jsgl/gles/* node_modules/native-gles/dist/
    cd - >/dev/null
  fi
  rm -rf /tmp/jsgl
  deps_ok || { echo "ERROR: dependencias incompletas."; exit 1; }
fi
# 4) lanzador de Knulli: desde jsgamelauncher 0.12 hay que usar cli.js (index.js ya no arranca juegos)
mkdir -p "$JSG/knulli"
cat > "$JSG/knulli/run.sh" <<'RUNEOF'
#!/bin/bash
export LD_LIBRARY_PATH=/usr/lib
export SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS=1
[ -f /userdata/system/jsgamelauncher/knulli/extra-env.sh ] && source /userdata/system/jsgamelauncher/knulli/extra-env.sh
source ~/.bash_profile
cd /userdata/system/jsgamelauncher
node cli.js "$@"
RUNEOF
chmod +x "$JSG/knulli/run.sh"
# 5) sistema "JS Games" en EmulationStation
if [ ! -f "$ESCFG/es_systems_jsgames.cfg" ]; then mkdir -p "$ESCFG" && cp "$JSG/knulli/es_systems_jsgames.cfg" "$ESCFG/"; fi
echo ""
echo "=== ¡Listo! En la consola: START > Ajustes de juegos > Actualizar listas de juegos (sistema JS Games) ==="
