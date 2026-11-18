/**
 * Genera el prompt completo (en inglés, que los generadores siguen mejor) para crear una nueva
 * jugadora con exactamente el formato que el importador del juego espera.
 * Basado en los prompts que ya funcionaron con las jugadoras Sol y Ola.
 */
export interface CharSpec {
  name: string;
  gender: 'girl' | 'boy';
  hairStyle: string;
  hairColor: string;
  accessory: string;
  accessoryColor: string;
  skin: string;
  top: string;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  paddleColor: string;
  extra: string;
}

export const OPTIONS = {
  gender: [['girl', 'Chica'], ['boy', 'Chico']],
  hairStyle: [
    ['big spiky hair shaped like sun rays', 'Pinchos tipo sol'],
    ['spiky hair tied in a short ponytail', 'Pinchos con coleta'],
    ['long straight hair in a high ponytail', 'Coleta alta'],
    ['big curly afro hair', 'Rizos / afro'],
    ['short messy hair', 'Corto despeinado'],
    ['two braids', 'Dos trenzas'],
    ['a top bun', 'Moño alto'],
    ['shaved short buzz cut', 'Rapado'],
  ],
  hairColor: [['bright orange', 'Naranja'], ['dark brown', 'Castaño oscuro'], ['black', 'Negro'], ['platinum blonde', 'Rubio platino'], ['golden blonde', 'Rubio dorado'], ['bright pink', 'Rosa'], ['electric blue', 'Azul eléctrico'], ['purple', 'Morado'], ['fiery red', 'Rojo fuego'], ['silver white', 'Blanco plata']],
  accessory: [['a thin sport sun visor with a short bill pointing forward', 'Visera'], ['a sport headband tied at the back of the head with two fabric tails', 'Cinta con colas'], ['a baseball cap worn forward', 'Gorra'], ['round sunglasses on the forehead', 'Gafas de sol en la frente'], ['a flower hair clip', 'Flor en el pelo'], ['nothing on the head', 'Nada']],
  color: [['orange', 'Naranja'], ['turquoise', 'Turquesa'], ['red', 'Rojo'], ['yellow', 'Amarillo'], ['lime green', 'Verde lima'], ['royal blue', 'Azul'], ['pink', 'Rosa'], ['purple', 'Morado'], ['white', 'Blanco'], ['black', 'Negro']],
  skin: [['very fair skin', 'Muy clara'], ['light-tan skin', 'Clara'], ['warm tan skin', 'Morena'], ['brown skin', 'Oscura'], ['deep dark-brown skin', 'Muy oscura']],
  top: [['sleeveless sport tank top', 'Camiseta de tirantes'], ['short-sleeve sport t-shirt', 'Camiseta de manga corta'], ['sport crop top', 'Top deportivo'], ['loose basketball-style jersey', 'Camiseta ancha']],
} as const;

export const DEFAULT_SPEC: CharSpec = {
  name: 'Brisa', gender: 'girl', hairStyle: OPTIONS.hairStyle[2][0], hairColor: 'platinum blonde',
  accessory: OPTIONS.accessory[1][0], accessoryColor: 'pink', skin: 'light-tan skin', top: OPTIONS.top[0][0],
  topColor: 'pink', bottomColor: 'white', shoeColor: 'white', paddleColor: 'pink', extra: '',
};

export function buildPrompt(s: CharSpec): string {
  const who = s.gender === 'girl' ? 'A cheerful sporty young woman' : 'A cheerful sporty young man';
  const face = s.gender === 'girl' ? 'big expressive dark eyes with a white highlight and long eyelashes, small nose, rosy cheeks' : 'big expressive dark eyes with a white highlight, thick eyebrows, small nose, a friendly grin';
  const acc = s.accessory.startsWith('nothing') ? 'No accessory on the head.' : `Wears ${s.accessory}, colored ${s.accessoryColor}.`;
  return `Draw a BRAND NEW game-asset sprite sheet FROM SCRATCH in high-quality "HD pixel art" (polished 16-bit / 32-bit era look, like a premium modern indie sports game) for a 2D side-view beach paddle-ball game. If an image is attached, use it ONLY as reference for the art style, the pixel size, the cute chibi proportions and the layout of the sheet; the character must be NEW and different.

CHARACTER ("${s.name}")
${who}, beach paddle-ball player, VERY CHIBI cartoon style:
- Hair: ${s.hairColor} ${s.hairStyle}. All the hair belongs to the head (no loose hair pieces).
- ${acc}
- Face: ${face}, ${s.skin}.
- Outfit: ${s.topColor} ${s.top} with a thin contrasting trim; ${s.bottomColor} sport shorts with a thin side stripe; ${s.shoeColor} sneakers with small color details; short white socks.
- Round beach paddle: solid ${s.paddleColor} face, thin dark rim, short light wooden handle with grip tape.${s.extra.trim() ? `\n- Extra details: ${s.extra.trim()}.` : ''}

PROPORTIONS (the most important rule: VERY CHIBI, NOT realistic)
Total standing height = H (top of the hair to the soles).
- Head including hair: 40-45% of H, huge and round.
- Torso from neck to hips: 25% of H, short and compact.
- Legs from hips to the floor: 33% of H, short and sturdy.
- Arms short: upper arm 13% of H, forearm 11% of H, hand 6% of H.

STYLE
- Crisp pixel art with clearly visible square pixels of uniform size; the full-body figure is about 120-130 pixel-art pixels tall. No blur, no soft brushwork, no anti-aliasing smudges, no 3D, no photo realism.
- Clean 1-pixel dark warm-brown outline around every shape (not pure black).
- Cel shading with 4-5 tones per material, hue-shifted shadows (cooler, slightly purple-blue) and warm highlights.
- Bright midday sun from the TOP-LEFT on everything.
- Vibrant saturated tropical colors. Avoid any pure green (#00FF00-like) color on the character.

CANVAS AND BACKGROUND
- Wide 16:9 canvas.
- One flat, uniform pure chroma green background (#00FF00) everywhere: no gradient, no texture, no floor line, no ground shadow, no drop shadows, no scenery.
- Absolutely NO text, letters, numbers, labels, arrows, grid lines, frames or watermark.

LAYOUT
LEFT ZONE (left quarter of the canvas): ONE full-body figure in STRICT SIDE VIEW (pure profile) FACING RIGHT, only one eye visible, relaxed ready stance, both arms slightly away from the body, the paddle held in the near hand hanging down. The figure is about 80% of the canvas height and is the scale reference for every part.

RIGHT ZONE (right three quarters): the SAME character split into SEPARATE body parts, like a cut-out paper puppet for a game rig. Every part at EXACTLY THE SAME SCALE as the full figure, in strict side view FACING RIGHT, in a neat grid with WIDE empty green space around each part. Parts NEVER touch or overlap each other (not even the hair of the heads) and nothing is cut by the canvas edge.
Row 1, FOUR HEADS (strict profile facing right, identical size, hair and accessory; ONLY the expression changes; each with a short neck stub): 1 neutral smile, 2 effort with gritted teeth, 3 joy with a big open smile and closed eyes, 4 tired with a sweat drop.
Row 2: 5 TORSO WITH SHORTS as ONE piece (no arms, no legs, no head) - 6 ONE ARM, straight and vertical, from shoulder to a closed fist - 7 ONE LEG, straight and vertical, from hip to the sneaker - 8 the PADDLE ALONE, face fully visible, handle pointing down.

PART RULES
- Each part is complete and isolated as if detached from the body, with rounded ends, so it can rotate at the joints.
- Arm and leg are perfectly straight and vertical (pointing down), never bent.
- Same outline thickness, same pixel size, same palette and same top-left lighting on every part.

NEGATIVE: no editing of previous images, no blur, no background gradient, no shadows, no extra characters, no duplicated limbs, no loose hair pieces, no front view, no back view, no 3/4 view, no realistic proportions, no long legs, no text, no labels, no numbers, no watermark, no cropped parts, no 3D render.`;
}
