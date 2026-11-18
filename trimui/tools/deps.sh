#!/bin/bash
# Prepara jsgl-deps-arm64.tar.gz: node_modules de jsgamelauncher para la TrimUI (arm64) SIN enlaces simbólicos
# (la SD de Knulli es exFAT) y con los binarios nativos precompilados. Salida: trimui/build/jsgl-deps-arm64.tar.gz
set -e
OUT="$(cd "$(dirname "$0")/.." && pwd)/build"
T=$(mktemp -d)
git clone -q --depth 1 https://github.com/monteslu/jsgamelauncher "$T/jsgl"
cd "$T/jsgl"
npm install --ignore-scripts --no-bin-links --os=linux --cpu=arm64 --libc=glibc --no-audit --no-fund
V=$(node -p "require('./node_modules/@kmamal/sdl/package.json').version")
mkdir -p "$T/sdl" "$T/gles" node_modules/@kmamal/sdl/dist node_modules/native-gles/dist
curl -fsSL "https://github.com/kmamal/node-sdl/releases/download/v$V/sdl.node-v$V-linux-arm64.tar.gz" | tar xz -C "$T/sdl"
cp -L "$T/sdl/"* node_modules/@kmamal/sdl/dist/
V=$(node -p "require('./node_modules/native-gles/package.json').version")
curl -fsSL "https://github.com/monteslu/native-gles/releases/download/v$V/gles.node-v$V-linux-arm64.tar.gz" | tar xz -C "$T/gles"
cp -L "$T/gles/"* node_modules/native-gles/dist/
rm -rf node_modules/@napi-rs/canvas-linux-arm64-musl
[ -z "$(find node_modules -type l)" ] || { echo "ERROR: quedan enlaces simbólicos"; exit 1; }
mkdir -p "$OUT" && tar czf "$OUT/jsgl-deps-arm64.tar.gz" node_modules
rm -rf "$T"
ls -la "$OUT/jsgl-deps-arm64.tar.gz"
