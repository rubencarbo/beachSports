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

## 9. Arte generado + esqueleto (fase actual)
- **Flujo de arte:** prompts detallados para generar el arte por IA. `art/tools/ingest_parts.py` lo deja listo para el juego: detecta el tamaño de píxel, lo reduce a resolución nativa, quita el croma verde, separa las piezas (por rejilla o con un mapa de posiciones en `art/sheets/*.json`), puede partir piezas (por ejemplo, el brazo por el codo), calcula las articulaciones, empaqueta el atlas y crea variantes recoloreadas. `art/tools/ingest_plate.py` hace lo mismo con los fondos.
- **Personajes por piezas** (`src/entities/Rig.ts`): poses chibi interpoladas en continuo.
  - Golpes en 4 fases: preparación de 0,10–0,30 s, latigazo de 0,06 s sincronizado con el contacto real, gesto final de 0,16 s y recuperación de 0,14 s.
  - Salto con agachado previo, estiramiento y aplastamiento, mechón de pelo con muelle, rebote de la pala y anticipación cuando se acerca la bola.
- **Movimiento** (`Player.ts`): aceleración de 95 m/s² y frenada de 80 m/s² (respuesta casi instantánea), velocidad de 7,4 m/s, derrape con polvo de arena y cadencia de carrera ligada a la zancada.
- **Encuadre medido en el vídeo:** horizonte al 30 % de la pantalla, pista menos profunda (18,5 px/m) y jugadoras al 22–26 % de la altura de pantalla.
- **Ajustes de controles** (`SettingsScene`, `core/settings.ts`): tamaño de la cruceta y de los botones, transparencia, cruceta flotante o fija, modo zurdo y colocación arrastrando. Se guardan en el dispositivo.
- **Laboratorio de animación** (`LabScene`, botón LAB del menú o `#lab`): animaciones en bucle, cámara lenta, pausa y avance por fotograma, parámetros en vivo y fotogramas del vídeo de referencia para comparar.

## 10. Auditoría frente al vídeo (noviembre 2026) y mejoras aplicadas
Comparación del mismo fotograma a 848×528:
- **Hecho**
  - **Encuadre:** el zoom depende del ancho y del alto, así que las jugadoras mantienen su tamaño en cualquier pantalla.
  - **Etalonaje cálido** (`GradePipeline`): contraste, resplandor del sol y viñeta.
  - **Bruma de horizonte.**
  - **Primer plano:** siluetas suaves a contraluz en dos filas y hojas de palmera fijas en las esquinas de la pantalla.
  - **Vallas** con marcos metálicos y cristal en dos tonos; **red** con postes, cinta gruesa y sombra en la arena.
  - **Arena** sin patrones repetidos, con huellas y marcas de bote que se desvanecen.
  - **Cometa de fuego o agua** orientado según la velocidad en el especial.
- **Jugabilidad**
  - Controles fijos en partido; se colocan solo en el editor de ajustes (GUARDAR, CANCELAR y RESTABLECER).
  - Diana que muestra dónde irá el golpe. Con movimiento asistido, mientras viene la bola la cruceta solo apunta.
  - Contador de peloteo con euforia del público y carga extra del especial.
  - Cartel de punto de partido y cámara lenta en el punto final.
  - Tutorial la primera vez y "CÓMO JUGAR" en la pausa.
  - Música chiptune procedural y murmullo del público, con ajustes de música y sonido.
- **Pendiente** (necesita arte):
  - público (sigue siendo la mayor diferencia con el vídeo)
  - farolas y banderines
  - marcador de madera
  - sombrillas cercanas

## 11. Público ilustrado, movimiento semiasistido y saque en dos toques
- **Público** (`art/sheets/crowd.json` → `src/assets/crowd.png`): 8 espectadores en dos poses (tranquilo y animando) y un perro (sentado y ladrando), en dos filas tras el cordón rojo.
  - El croma de esta hoja es más estricto, para no borrar la ropa verde.
  - La limpieza de restos de verde actúa solo en el contorno.
- **Movimiento** (`settings.movement`):
  - `assist`: corre sola a la bola y la cruceta solo apunta.
  - `semi`: te mueves tú y, a menos de 2,6 m del punto de golpeo, un imán te coloca; si sueltas la cruceta, da el último paso sola.
  - `manual`: sin ayuda.
- **Saque en dos toques:**
  - El 1.º toque lanza la bola (sube ~1,9 m y cae en ~1,15 s) y arranca una barra que va y viene cada 0,9 s.
  - El 2.º toque golpea. Zonas de la barra: flojo (<0,6), bueno (0,6–0,82), **perfecto** (0,82–0,97) y pasado (>0,97, muy potente pero impreciso).
  - La potencia acorta el vuelo hasta un 36 %. Golpear la bola por debajo de 2 m resta calidad. Si no golpeas, se repite.
  - La máquina usa la misma barra, con una dispersión según la dificultad.

## 12. Personajes, torneo y sedes
- **Catálogo** (`src/game/roster.ts`): 8 jugadoras.
  - SOL y OLA tienen arte propio. CORAL, LIMA, UVA, FRESA, MENTA y NOCHE son variantes de color generadas al arrancar; la piel se protege con la paleta de los brazos.
  - Cada una tiene estadísticas: velocidad (±6 % de carrera por punto), potencia (vuelo de la bola ±5 %) y control (+0,05 de precisión por punto). El especial puede ser de fuego o de agua.
- **Selección de jugadora** antes de cada partido. En amistoso también se eligen rival (o al azar) y sede.
- **Torneo de 8** (`src/game/tournament.ts`, `BracketScene`):
  - Cuartos (fácil, Playa del Sol), semifinal (normal, Bahía Blanca) y final (difícil, Gran Final al atardecer).
  - El resto de partidos se simula según las estadísticas. Hay pantalla de cuadro entre rondas y de campeona.
- **Sedes** (`src/game/venues.ts`): cambian arena, etalonaje (tinte y atardecer), publicidad con marcas ficticias, cordón, banderines, cantidad de público y farolas encendidas en la final.
- **Estudio de personajes** (Ajustes → PERSONAJES, `CharStudioScene`):
  1. Formulario que genera el prompt completo (`charPrompt.ts`), con botón para copiar.
  2. Importador en el navegador (`charImport.ts`, versión en TypeScript de `ingest_parts.py`): detecta el tamaño de píxel, quita el croma, separa piezas (y cabezas que se tocan), propone el papel de cada pieza con desplegables para corregirlo, parte brazo y pierna, crea el atlas y lo guarda en el dispositivo.
  3. Lista de personajes importados, con opción de borrar.

## 13. Siguientes pasos
1. Multijugador online 1 vs 1 con Firebase Realtime Database (más baja latencia que Firestore). Modelo autoritativo del que saca, enviando solo los eventos de golpe (posición + velocidad), ya que la trayectoria es determinista.
2. Vóley playa: `touchesPerSide: 3` y controles de recepción, colocación y remate. Futvóley: mismos toques usando el cuerpo. El escenario, la cámara, los efectos y el público se reutilizan tal cual.
3. Arte final en sprite sheets, música, ranking global y personajes desbloqueables.
