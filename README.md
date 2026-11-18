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

## Publicar en Firebase (web PWA + carpeta TrimUI)

Un solo sitio de Firebase Hosting sirve:
- `/` → el juego web para móvil (PWA instalable, funciona sin conexión tras la primera visita).
- `/trimui/` → página con los pasos para la consola, `instalar.sh`, el juego de consola, el zip y las dependencias arm64.

### Una vez
1. Crea el proyecto en https://console.firebase.google.com y añade una **app web** (copia su configuración).
2. (Opcional, para guardar partidas) Authentication → activa **Anónimo**; Firestore → crea la base de datos.
3. Copia `.env.example` a `.env.local` y rellena los `VITE_FIREBASE_*`.

### Desplegar desde tu ordenador
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # elige el proyecto (crea .firebaserc)
bash trimui/tools/deps.sh     # sólo la primera vez: dependencias de jsgamelauncher para arm64 (21 MB)
npm run deploy                # web + /trimui/ + subida a Hosting
firebase deploy --only firestore:rules   # si usas Firestore
```

### O desplegar solo con cada push (GitHub Actions)
`.github/workflows/firebase-deploy.yml`. En GitHub › Settings › Secrets and variables › Actions:
- Secret `FIREBASE_SERVICE_ACCOUNT`: JSON de una cuenta de servicio con rol *Firebase Hosting Admin*
  (Google Cloud › IAM › Cuentas de servicio › Crear clave JSON).
- Variable `FIREBASE_PROJECT_ID` y, opcionalmente, las `VITE_FIREBASE_*`.

### En la consola
Abre `https://<proyecto>.web.app/trimui/` en el móvil o el ordenador y sigue los pasos (SSH + un comando).
