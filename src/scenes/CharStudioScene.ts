import Phaser from 'phaser';
import { ROLE_LABELS, Role, Piece, buildAtlas, extractPieces, loadImageData, missingRoles, toNative } from '../game/charImport';
import { CharSpec, DEFAULT_SPEC, OPTIONS, buildPrompt } from '../game/charPrompt';
import { STYLES, getRoster, loadCustom, registerCustom, removeCustom, saveCustom } from '../game/roster';

/**
 * Estudio de personajes (Ajustes → PERSONAJES). Interfaz HTML superpuesta al juego
 * (campos de texto, copiar al portapapeles y subir imágenes funcionan mejor así en móvil).
 *  1. CREAR PROMPT: rasgos → prompt completo listo para copiar.
 *  2. IMPORTAR: sube la imagen generada → piezas detectadas y asignables → guardar.
 *  3. MIS PERSONAJES: lista y borrado.
 */
const CSS = `
#bs-studio{position:fixed;inset:0;z-index:50;background:rgba(11,26,42,.78);display:flex;align-items:center;justify-content:center;
  font-family:"Pixelify Sans","Press Start 2P",monospace;color:#fff3d6;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));box-sizing:border-box}
#bs-studio *{box-sizing:border-box}
#bs-studio .win{width:min(1100px,100%);height:100%;max-height:720px;display:flex;flex-direction:column;background:#b8743c;border:4px solid #1b2240;border-radius:10px;box-shadow:0 8px 0 rgba(0,0,0,.3)}
#bs-studio .head{display:flex;gap:8px;align-items:center;padding:10px 12px;background:#2c3560;border-bottom:4px solid #1b2240;flex-wrap:wrap}
#bs-studio h1{font-family:"Press Start 2P",monospace;font-size:16px;margin:0 10px 0 0;color:#ffd23f}
#bs-studio .tab,#bs-studio button{font:inherit;font-weight:700;font-size:16px;color:#fff3d6;background:#2c3560;border:3px solid #1b2240;border-radius:8px;padding:8px 12px;cursor:pointer;box-shadow:0 4px 0 #1b2240}
#bs-studio .tab.on{background:#1fb5c9}
#bs-studio button.primary{background:#ff8a1f}#bs-studio button.ok{background:#5ccf5a}#bs-studio button.danger{background:#e8433a}
#bs-studio button:active{transform:translateY(3px);box-shadow:0 1px 0 #1b2240}
#bs-studio button:focus-visible,#bs-studio select:focus-visible,#bs-studio input:focus-visible,#bs-studio textarea:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}
#bs-studio .close{margin-left:auto;background:#5a6a80}
#bs-studio .body{flex:1;overflow:auto;padding:14px;display:grid;gap:12px}
#bs-studio .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
#bs-studio label{display:flex;flex-direction:column;gap:4px;font-size:15px}
#bs-studio select,#bs-studio input[type=text],#bs-studio textarea{font:inherit;font-size:16px;color:#1b2240;background:#fff3d6;border:3px solid #1b2240;border-radius:6px;padding:6px;min-width:0}
#bs-studio textarea{width:100%;min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.35;resize:vertical}
#bs-studio .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#bs-studio .note{background:#2c3560;border:3px solid #1b2240;border-radius:8px;padding:10px;font-size:15px;line-height:1.4}
#bs-studio .pieces{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
#bs-studio .piece{background:#2c3560;border:3px solid #1b2240;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;align-items:center}
#bs-studio .piece canvas{image-rendering:pixelated;background:#8fd3f5;width:100%;height:110px;object-fit:contain;border-radius:4px}
#bs-studio .piece select{width:100%;font-size:14px}
#bs-studio .err{color:#ffd23f}
#bs-studio .chars{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
#bs-studio .char{background:#2c3560;border:3px solid #1b2240;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center}
#bs-studio .char img{image-rendering:pixelated;height:120px;max-width:100%;object-fit:contain;background:#8fd3f5;border-radius:4px;width:100%}
@media (prefers-reduced-motion:reduce){#bs-studio button:active{transform:none}}
`;

export class CharStudioScene extends Phaser.Scene {
  private from: 'menu' | 'hud' = 'menu';
  private root?: HTMLDivElement;
  private tab: 'prompt' | 'import' | 'mine' = 'prompt';
  private spec: CharSpec = { ...DEFAULT_SPEC };
  private pieces: Piece[] = [];
  private status = '';

  constructor() { super('CharStudio'); }

  init(d: { from?: 'menu' | 'hud' }) { this.from = d.from ?? 'menu'; this.tab = 'prompt'; this.pieces = []; this.status = ''; }

  create() {
    if (!document.getElementById('bs-studio-css')) {
      const st = document.createElement('style'); st.id = 'bs-studio-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    try { const s = localStorage.getItem('beachsports.spec'); if (s) this.spec = { ...DEFAULT_SPEC, ...JSON.parse(s) }; } catch { /* ignorar */ }
    this.root = document.createElement('div');
    this.root.id = 'bs-studio';
    document.body.appendChild(this.root);
    this.render();
    this.events.once('shutdown', () => { this.root?.remove(); this.root = undefined; });
  }

  private close() {
    this.scene.launch('Settings', { from: this.from });
    this.scene.stop();
  }

  private render() {
    const r = this.root!;
    r.innerHTML = '';
    const win = el('div', 'win');
    const head = el('div', 'head');
    head.append(el('h1', '', 'PERSONAJES'));
    const tabs: [typeof this.tab, string][] = [['prompt', '1 · CREAR PROMPT'], ['import', '2 · IMPORTAR'], ['mine', '3 · MIS PERSONAJES']];
    for (const [id, t] of tabs) {
      const b = el('button', `tab${this.tab === id ? ' on' : ''}`, t);
      b.onclick = () => { this.tab = id; this.render(); };
      head.append(b);
    }
    const c = el('button', 'close', 'VOLVER'); c.onclick = () => this.close(); head.append(c);
    const body = el('div', 'body');
    win.append(head, body);
    r.append(win);
    if (this.tab === 'prompt') this.renderPrompt(body);
    else if (this.tab === 'import') this.renderImport(body);
    else this.renderMine(body);
  }

  // ---------------------------------------------------------------- 1. prompt
  private renderPrompt(body: HTMLElement) {
    body.append(el('div', 'note', 'Elige cómo será tu personaje (chica o chico) y copia el texto. Pégalo en tu generador de imágenes (en una conversación NUEVA). Si puedes, adjunta también una captura de una jugadora del juego como referencia de estilo. Después ve a «2 · IMPORTAR» con la imagen que obtengas.'));
    const grid = el('div', 'grid');
    const s = this.spec;
    const save = () => { try { localStorage.setItem('beachsports.spec', JSON.stringify(this.spec)); } catch { /* ignorar */ } ta.value = buildPrompt(this.spec); };
    const field = (txt: string, node: HTMLElement) => { const l = el('label', '', txt); l.append(node); grid.append(l); };
    const sel = (id: string, opts: readonly (readonly [string, string])[], val: string, on: (v: string) => void) => {
      const e = document.createElement('select'); e.id = `bs-${id}`;
      for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === val) o.selected = true; e.append(o); }
      e.onchange = () => { on(e.value); save(); };
      return e;
    };
    const name = document.createElement('input'); name.type = 'text'; name.id = 'bs-name'; name.maxLength = 10; name.value = s.name;
    name.oninput = () => { s.name = name.value || 'Jugadora'; save(); };
    field('Nombre', name);
    field('Personaje', sel('gender', OPTIONS.gender, s.gender, (v) => { s.gender = v as CharSpec['gender']; }));
    field('Peinado', sel('hair', OPTIONS.hairStyle, s.hairStyle, (v) => { s.hairStyle = v; }));
    field('Color de pelo', sel('hairc', OPTIONS.hairColor, s.hairColor, (v) => { s.hairColor = v; }));
    field('En la cabeza', sel('acc', OPTIONS.accessory, s.accessory, (v) => { s.accessory = v; }));
    field('Color del complemento', sel('accc', OPTIONS.color, s.accessoryColor, (v) => { s.accessoryColor = v; }));
    field('Piel', sel('skin', OPTIONS.skin, s.skin, (v) => { s.skin = v; }));
    field('Camiseta', sel('top', OPTIONS.top, s.top, (v) => { s.top = v; }));
    field('Color camiseta', sel('topc', OPTIONS.color, s.topColor, (v) => { s.topColor = v; }));
    field('Color pantalón', sel('botc', OPTIONS.color, s.bottomColor, (v) => { s.bottomColor = v; }));
    field('Color zapatillas', sel('shoec', OPTIONS.color, s.shoeColor, (v) => { s.shoeColor = v; }));
    field('Color de la pala', sel('padc', OPTIONS.color, s.paddleColor, (v) => { s.paddleColor = v; }));
    const extra = document.createElement('input'); extra.type = 'text'; extra.id = 'bs-extra'; extra.placeholder = 'Opcional, en inglés: freckles, earrings…'; extra.value = s.extra;
    extra.oninput = () => { s.extra = extra.value; save(); };
    field('Detalles extra', extra);
    body.append(grid);
    const ta = document.createElement('textarea'); ta.id = 'bs-prompt'; ta.readOnly = true; ta.value = buildPrompt(s);
    const row = el('div', 'row');
    const copy = el('button', 'primary', 'COPIAR PROMPT');
    const msg = el('span', 'err', '');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); msg.textContent = '¡Copiado! Pégalo en tu generador de imágenes.'; }
      catch { ta.focus(); ta.select(); msg.textContent = 'Texto seleccionado: cópialo con el menú del sistema.'; }
    };
    row.append(copy, msg);
    body.append(row, ta);
  }

  // ---------------------------------------------------------------- 2. importar
  private renderImport(body: HTMLElement) {
    body.append(el('div', 'note', 'Sube la imagen que te ha generado (fondo verde). El juego detecta las piezas y propone qué es cada una; corrige lo que haga falta con los desplegables. Necesita como mínimo: cabeza normal, torso, brazo, pierna y pala.'));
    const row = el('div', 'row');
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.id = 'bs-file';
    const pick = el('button', 'primary', 'ELEGIR IMAGEN');
    pick.onclick = () => file.click();
    file.style.display = 'none';
    file.onchange = async () => {
      const f = file.files?.[0]; if (!f) return;
      this.status = 'Procesando…'; this.render();
      await new Promise((res) => setTimeout(res, 30));
      try {
        const img = await loadImageData(f);
        const nat = toNative(img);
        this.pieces = extractPieces(nat);
        this.status = this.pieces.length ? `${this.pieces.length} piezas detectadas (píxel de arte ≈ ${nat.pixel.toFixed(1)} px).` : 'No se encontraron piezas: ¿el fondo es verde liso?';
      } catch { this.status = 'No se pudo leer la imagen.'; this.pieces = []; }
      this.render();
    };
    row.append(pick, file, el('span', 'err', this.status));
    body.append(row);
    if (!this.pieces.length) return;
    const grid = el('div', 'pieces');
    for (const p of this.pieces) {
      const card = el('div', 'piece');
      const cv = document.createElement('canvas'); cv.width = p.canvas.width; cv.height = p.canvas.height;
      cv.getContext('2d')!.drawImage(p.canvas, 0, 0);
      const s = document.createElement('select'); s.id = `bs-role-${p.id}`; s.setAttribute('aria-label', 'Qué es esta pieza');
      for (const [v, t] of Object.entries(ROLE_LABELS)) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === p.role) o.selected = true; s.append(o); }
      s.onchange = () => { p.role = s.value as Role; this.render(); };
      card.append(cv, s);
      grid.append(card);
    }
    body.append(grid);
    const miss = missingRoles(this.pieces);
    const form = el('div', 'grid');
    const name = document.createElement('input'); name.type = 'text'; name.id = 'bs-iname'; name.maxLength = 10; name.value = this.spec.name;
    const nl = el('label', '', 'Nombre'); nl.append(name); form.append(nl);
    const gen = document.createElement('select'); gen.id = 'bs-gen';
    for (const [v, t] of [['f', 'Chica'], ['m', 'Chico']]) { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((this.spec.gender === 'boy' ? 'm' : 'f') === v) o.selected = true; gen.append(o); }
    const gl = el('label', '', 'Personaje'); gl.append(gen); form.append(gl);
    const elem = document.createElement('select'); elem.id = 'bs-elem';
    for (const [v, t] of [['sun', 'Fuego'], ['wave', 'Agua']]) { const o = document.createElement('option'); o.value = v; o.textContent = t; elem.append(o); }
    const el2 = el('label', '', 'Golpe especial'); el2.append(elem); form.append(el2);
    const style = document.createElement('select'); style.id = 'bs-style';
    for (const [v, d] of Object.entries(STYLES)) { const o = document.createElement('option'); o.value = v; o.textContent = d.label; style.append(o); }
    const sl = el('label', '', 'Estilo de juego'); sl.append(style); form.append(sl);
    body.append(form);
    const row2 = el('div', 'row');
    const save = el('button', 'ok', 'GUARDAR PERSONAJE') as HTMLButtonElement;
    const msg = el('span', 'err', miss.length ? `Falta: ${miss.join(', ')}` : '');
    save.disabled = miss.length > 0;
    if (miss.length) save.style.opacity = '0.5';
    save.onclick = async () => {
      const { png, frames } = buildAtlas(this.pieces);
      const id = `c${Date.now().toString(36)}`;
      const c = { id, name: (name.value || 'Jugador').toUpperCase(), element: elem.value as 'sun' | 'wave', style: style.value, png, frames, gender: gen.value as 'f' | 'm' };
      const list = [...loadCustom(), c];
      if (!saveCustom(list)) { msg.textContent = 'No hay espacio para guardar en este dispositivo.'; return; }
      await registerCustom(this, c);
      this.pieces = []; this.status = `¡${c.name} guardada! Ya puedes elegir este personaje al empezar un partido.`;
      this.tab = 'mine'; this.render();
    };
    row2.append(save, msg);
    body.append(row2);
  }

  // ---------------------------------------------------------------- 3. mis personajes
  private renderMine(body: HTMLElement) {
    if (this.status) body.append(el('div', 'note', this.status));
    const list = loadCustom();
    if (!list.length) {
      body.append(el('div', 'note', 'Todavía no has importado ningún personaje. Crea el prompt en «1», genera la imagen y súbela en «2».'));
      return;
    }
    const grid = el('div', 'chars');
    for (const c of list) {
      const card = el('div', 'char');
      const f = c.frames.full ?? c.frames.head;
      const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
      const img = new Image();
      img.onload = () => cv.getContext('2d')!.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      img.src = c.png;
      cv.style.cssText = 'image-rendering:pixelated;height:120px;width:100%;object-fit:contain;background:#8fd3f5;border-radius:4px';
      const del = el('button', 'danger', 'BORRAR');
      let armed = false;
      del.onclick = () => {
        if (!armed) { armed = true; del.textContent = '¿SEGURO?'; return; }
        removeCustom(this, c.id); this.status = ''; this.render();
      };
      card.append(cv, el('div', '', `${c.name} · ${c.element === 'sun' ? 'FUEGO' : 'AGUA'}`), del);
      grid.append(card);
    }
    body.append(grid);
    void getRoster;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
