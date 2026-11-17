# Beach Sports

Juego web de deportes de playa (empezando por **palas 1 vs 1**) para móvil en horizontal, con una cámara dinámica de estilo retransmisión, golpes especiales y público animado.

```bash
npm install
npm run dev        # http://localhost:5173 (con --host para probar en el iPhone de la misma red)
npm run build
node scripts/build-artifact.mjs   # demo en un único HTML (artifact/beach-sports.html)
```

**Controles.** Táctil: joystick a la izquierda; GOLPE, SALTO y ★ (especial) a la derecha. Teclado: WASD/flechas, J/Espacio, K, L.
Al golpear, el joystick hacia la red hace un drive, hacia atrás un globo, y arriba/abajo apunta en profundidad. Si saltas y la bola va alta, rematas.

**Firebase** (opcional): copia `.env.example` a `.env.local` y rellénalo. Después ejecuta `npm run deploy`.

Análisis completo del vídeo y diseño: [`docs/ANALISIS.md`](docs/ANALISIS.md).
