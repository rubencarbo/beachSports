// Estado de entrada compartido entre la HUD (táctil) / teclado y la escena de partido.
export class InputState {
  mx = 0; // -1..1 (hacia la derecha de pantalla)
  my = 0; // -1..1 (hacia arriba de pantalla = fondo de pista)
  hitHeld = false;
  private hitEdge = false;
  private jumpEdge = false;
  private specialEdge = false;

  pressHit() { this.hitEdge = true; this.hitHeld = true; }
  releaseHit() { this.hitHeld = false; }
  pressJump() { this.jumpEdge = true; }
  pressSpecial() { this.specialEdge = true; }

  consumeHit() { const v = this.hitEdge; this.hitEdge = false; return v; }
  consumeJump() { const v = this.jumpEdge; this.jumpEdge = false; return v; }
  consumeSpecial() { const v = this.specialEdge; this.specialEdge = false; return v; }
  reset() { this.mx = this.my = 0; this.hitHeld = this.hitEdge = this.jumpEdge = this.specialEdge = false; }
}

export const playerInput = new InputState();
