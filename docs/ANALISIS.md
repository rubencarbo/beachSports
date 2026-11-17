# Análisis del vídeo de referencia y diseño del juego

Vídeo: 9,9 s, 848×528, 30 fps. Ilustración tipo cartoon/chibi de una pista de palas en la playa, vista lateral.
Los datos de cámara salen de medir el desplazamiento entre fotogramas (correlación de imagen a 10 fps).

## 1. Cámara (prioridad nº 1)

| Comportamiento observado | Medida | Implementación (`src/fx/CameraDirector.ts`) |
|---|---|---|
| Paneo lateral continuo siguiendo la bola | 10–25 % del ancho de pantalla por segundo, con aceleración y frenada suaves | Muelle amortiguado (`smoothDamp`) en x/y/zoom. El objetivo mezcla un 62 % bola (más anticipación según su velocidad) y un 38 % jugador que recibe |
| Barrido rápido acompañando la bola de fuego | ~50 % de pantalla/s (6,8–7,4 s del vídeo) | Mientras vuela el especial, el tiempo de paneo baja de 0,55 s a 0,16 s |
| Zoom sobre el jugador en el especial | +10–25 % | "Plano" con prioridad: +18 % al activar el poder y +27 % en el impacto, después vuelve al plano general |
| Perspectiva que cambia al panear (la red se inclina) | Visible en todos los paneos | El punto de fuga sigue a la cámara (`view.vpx`); pista, vallas y red se redibujan cada frame |
| Capas a distinta velocidad | Cielo/mar casi fijos, público intermedio, siluetas delanteras más rápidas | Parallax por capa con desplazamiento y zoom atenuado (`zoom^(s-1)`) |
| Golpe de cámara / temblor en impactos | Remate final y explosión | `kick()` (muelle de zoom), `shake()`, `flash()` y parada de imagen (hitstop) de 80–130 ms |
| Cámara lenta en el especial | Ralentiza durante el remate | `timeScale` 0,3–0,35 durante unos 0,5 s reales, con recuperación progresiva. La cámara funciona en tiempo real |
| Celebración | Plano más cerrado tras el punto | Zoom suave (+18 %) hacia el ganador |
| Sensación de retransmisión | Ligero movimiento constante | Ruido "cámara al hombro" de ±2 px |

## 2. Jugadores
- Estilo chibi: cabeza muy grande y cuerpo pequeño. Dos personajes: uno con pelo naranja de pinchos y visera, el otro con cinta turquesa.
- Animaciones: espera (balanceo), carrera (ciclo de piernas e inclinación), golpe de derecha, remate por encima de la cabeza con salto, saque, celebración (saltos con brazos arriba) y lamento (cabeza baja).
- En el vídeo hay saltos altos para rematar. En el juego hay un botón de SALTO, y el remate sale solo si la bola está alta y el jugador está en el aire.

## 3. Bola
- Física balística 3D (x = largo, z = profundidad, y = altura), con gravedad algo mayor de la real para que el juego vaya más rápido.
- Sombra en la arena que encoge con la altura.
- Estela: blanca en los golpes normales, de color en remates y especiales.
- Tipos de golpe: normal, drive (plano y rápido), globo (alto), remate y especial. El tiro se calcula hacia un objetivo en el campo contrario, siempre por encima de la red. Si el golpe es de poca calidad, el objetivo se desvía y la bola puede ir fuera o a la red.

## 4. Golpes especiales
- **Meteoro solar** (jugador naranja): aura de fuego y anillos al activarlo, bola en llamas con partículas, explosión al caer (llamas, arena y onda expansiva), temblor y destello.
- **Tsunami** (jugador turquesa): la misma mecánica con partículas de agua y espuma.
- La barra de especial se llena golpeando (más con golpes perfectos y remates). Cuando está llena se pulsa ★ y el siguiente golpe es el especial. Para devolverlo hace falta un golpe perfecto; si no, el rival es arrollado.

## 5. Escenario y público
- Cielo con sol y rayos que giran, nubes que se desplazan, gaviotas aleteando, mar con destellos, velero que se mece, isla, espuma en la orilla, sombrillas y hamacas al fondo.
- Pista tipo pádel en la arena: cristal abajo y malla arriba, carteles con olas, farolas, banderines que ondean y palmeras con ligero balanceo.
- Público detrás de la valla del fondo en 3 filas, con balanceo continuo. Cuando hay un punto o un especial, levanta los brazos y salta, y algunos llevan carteles con el sol o una ola. También hay perros.
- Siluetas oscuras de público en primer plano, pegadas al borde inferior de la pantalla, algunas con gorra o cámara. Levantan los brazos en los puntos.
- Marcador de madera junto a la red y marcador gigante de cartones que giran en cada punto, con confeti.

## 6. Reglas (palas de playa 1 vs 1)
- La bola no puede botar (como en beach tennis): si cae en tu campo, el punto es para el rival.
- Fuera, red o valla: punto para el rival. Puntuación rally a 5, 7 u 11 puntos, ganando por 2. Saca quien gana el punto.

## 7. Arquitectura
```
src/
  config.ts            proyección pseudo-3D (mundo en metros → pantalla) + punto de fuga dinámico
  core/                texturas procedurales, audio WebAudio sintetizado, input compartido
  entities/            Ball, Player (dibujo vectorial animado), shots (balística), Ai
  fx/                  CameraDirector (realización), Effects (partículas)
  stage/BeachStage.ts  escenario común para TODOS los deportes
  sports/              reglas por deporte (interfaz SportRules)
  scenes/              Boot, Match (bucle), Hud (táctil + marcadores), Menu (sobre una demo CPU vs CPU)
  services/backend.ts  Firebase (Auth anónima + Firestore), carga perezosa y opcional
```
- **Frontend:** Phaser 3 + TypeScript + Vite. Es WebGL y funciona bien en iPhone. Incluye cámaras con zoom y shake, partículas y tweens, y pesa unos 340 KB comprimidos.
- **Arte 100 % procedural** (canvas y Graphics), sin descargar ningún asset. Para acercarse más al acabado pintado del vídeo, basta con sustituir las texturas por sprite sheets dibujados usando las mismas *keys*.
- **iPhone:** pantalla horizontal con `Scale.EXPAND` para llenar el formato 19,5:9, aviso "gira el móvil", gestos del navegador bloqueados, manifest PWA en pantalla completa ("Añadir a pantalla de inicio") y audio desbloqueado al primer toque.
- **Backend:** Firebase Hosting, Auth anónima y Firestore (`players/{uid}` con estadísticas y `matches` con historial). Reglas en `firestore.rules`.

## 8. Estética retro 16 bits
- **Sprites pixel art generados por código** (`src/core/pixelArt.ts` y `characters.ts`). Se dibujan formas sobre una rejilla de materiales y después se aplica sombreado por bandas (luz, base y sombra), contorno selectivo de 1 px y detalles píxel a píxel. Los miembros del fondo van más oscuros.
  - Deportistas de 48×64 px con 24 frames: espera, carrera (6), derecha (4), remate en salto (4), saque (3), salto, celebración (2), lamento, aturdido y poder.
  - Público de 18 variantes de 22×36 px con poses de reposo, brazos arriba, salto y cartel. También siluetas de espaldas (6 variantes, con brazos arriba), perro y gaviotas.
- **Recursos del usuario:**
  - El fondo tropical se reduce a su resolución nativa (250×89, unos 8 px por píxel de arte) y se escala sin filtrado, con copias en espejo a los lados.
  - Las 6 expresiones de la hoja de personaje se recortan quitando el croma verde. Se usan como retratos animados en el marcador, junto con una versión recoloreada para el jugador naranja.
- **Shader retro** (`src/fx/RetroPipeline.ts`): rejilla de unos 250 píxeles de alto con muestreo nearest y color de 15 bits (5 bits por canal, como la SNES). Todo comparte la misma rejilla.
- Fuente pixel *Press Start 2P* en la interfaz. No tiene mayúsculas con tilde.

## 9. Siguientes pasos
1. Multijugador online 1 vs 1 con Firebase Realtime Database (más baja latencia que Firestore). Modelo autoritativo del que saca, enviando solo los eventos de golpe (posición + velocidad), ya que la trayectoria es determinista.
2. Vóley playa: `touchesPerSide: 3` y controles de recepción, colocación y remate. Futvóley: mismos toques usando el cuerpo. El escenario, la cámara, los efectos y el público se reutilizan tal cual.
3. Arte final en sprite sheets, música, ranking global y personajes desbloqueables.
