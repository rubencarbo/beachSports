"""Reduce las capturas del decorado y los atlas a la escala de la consola y los empaqueta para game.js.
Salida: trimui/assets/assets.json  {nombre: {w,h,ox,oy,s,d}}  (d = RGBA comprimido con zlib, en base64)."""
import json, zlib, base64, sys, os
import numpy as np
from PIL import Image

CAP = 'trimui/build/cap'
OUT = 'trimui/assets/assets.json'
ZOOM, CY, CXS = 0.55, 230, [880, 1920]
S = 0.35  # px de consola por px de mundo con el zoom base 1,4 (0,25 x 1,4)
VENUES = {
    'mediodia': dict(tint=(1.045, 1.0, 0.93), sunset=0),
    'bahia': dict(tint=(0.99, 1.01, 1.04), sunset=0),
    'atardecer': dict(tint=(1.12, 0.9, 0.8), sunset=1),
}

def layer(name):
    """Une las dos mitades y recupera RGBA (prem. alfa) a escala ZOOM, en coordenadas de mundo."""
    W = int(round((CXS[1] - CXS[0]) * ZOOM)) + 1280
    acc = np.zeros((720, W, 4), np.float32); cnt = np.zeros((720, W, 1), np.float32)
    for i, cx in enumerate(CXS):
        b = np.asarray(Image.open(f'{CAP}/{name}_{i}_0.png').convert('RGB'), np.float32) / 255
        w = np.asarray(Image.open(f'{CAP}/{name}_{i}_1.png').convert('RGB'), np.float32) / 255
        a = np.clip(1 - (w - b).mean(axis=2, keepdims=True), 0, 1)
        rgba = np.concatenate([b, a], axis=2)  # b = color * alfa (premultiplicado sobre negro)
        off = int(round((cx - CXS[0]) * ZOOM))
        # recortar 30 px de los bordes de cada mitad (salvo los extremos) para evitar costuras
        x0 = 0 if i == 0 else 30; x1 = 1280 if i == len(CXS) - 1 else 1250
        acc[:, off + x0:off + x1] += rgba[:, x0:x1]; cnt[:, off + x0:off + x1] += 1
    img = acc / np.maximum(cnt, 1)
    ox = CXS[0] - 640 / ZOOM; oy = CY - 360 / ZOOM
    return img, ox, oy

def down(img, f):
    """Reduce por f (área) en premultiplicado."""
    h, w = img.shape[:2]
    nh, nw = int(h * f), int(w * f)
    out = np.zeros((nh, nw, 4), np.float32)
    for c in range(4):
        out[..., c] = np.asarray(Image.fromarray(img[..., c]).resize((nw, nh), Image.BOX))
    return out

def grade(img, oy, venue):
    v = VENUES[venue]
    a = img[..., 3:4]
    c = np.where(a > 1e-4, img[..., :3] / np.maximum(a, 1e-4), 0)
    c = (c - 0.5) * 1.07 + 0.5
    c = c * np.array(v['tint'], np.float32)
    if v['sunset']:
        h = img.shape[0]
        wy = oy + (np.arange(h) + 0.5) / S
        sy = (wy - 462) * 1.1 + 360  # y en pantalla web con la cámara base
        uvy = 1 - sy / 720
        t = np.clip((uvy - 0.35) / 0.65, 0, 1); t = t * t * (3 - 2 * t)
        k = (v['sunset'] * t * 0.55)[:, None, None]
        c = c * (1 - k) + c * np.array([1.06, 0.74, 0.86], np.float32) * k
    l = (c * np.array([0.299, 0.587, 0.114], np.float32)).sum(axis=2, keepdims=True)
    c = l + (c - l) * 1.04
    c = np.clip(c, 0, 1)
    return np.concatenate([c * a, a], axis=2)

def crop(img):
    a = img[..., 3]
    ys, xs = np.where(a > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return img[y0:y1, x0:x1], x0, y0

def pack(img, premul=True):
    a = img[..., 3:4]
    c = np.where(a > 1e-4, img[..., :3] / np.maximum(a, 1e-4), 0) if premul else img[..., :3]
    rgba = np.concatenate([c, a], axis=2)
    q = np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8)
    # cuantiza alfa a 16 niveles y color a 5 bits: comprime mucho mejor y no se nota a 320x180
    q[..., 3] = (q[..., 3] // 17) * 17
    q[..., :3] = (q[..., :3] & 0xF8) | (q[..., :3] >> 5)
    q[q[..., 3] == 0] = 0
    h, w = q.shape[:2]
    return {'w': int(w), 'h': int(h), 'd': base64.b64encode(zlib.compress(q.tobytes(), 9)).decode()}

out = {}
def world_layer(name, key, venue=None, extra=0):
    img, ox, oy = layer(name)
    img = down(img, S / ZOOM)
    if venue: img = grade(img, oy, venue)
    img, x0, y0 = crop(img)
    e = pack(img)
    e['ox'] = round(ox + x0 / S, 2); e['oy'] = round(oy + y0 / S, 2); e['s'] = S
    out[key] = e
    print(key, e['w'], e['h'], len(e['d']) // 1024, 'KB')

for v in VENUES:
    world_layer('far', f'far_{v}', v)
    world_layer('beach', f'beach_{v}', v)
    world_layer(f'mid_{v}', f'mid_{v}', v)
    world_layer(f'court_{v}', f'court_{v}', v)
world_layer('fg', 'fg', 'mediodia')

def tex(key, f):
    im = Image.open(f'{CAP}/tex_{key}.png').convert('RGBA')
    a = np.asarray(im, np.float32) / 255
    pm = np.concatenate([a[..., :3] * a[..., 3:4], a[..., 3:4]], axis=2)
    pm = down(pm, f)
    e = pack(pm); e['s'] = f
    out['tex_' + key] = e
    print('tex', key, e['w'], e['h'], len(e['d']) // 1024, 'KB')

tex('fronds', 0.25); tex('frondFg', 0.25 * 0.82)
for k in ['ball', 'football', 'shadow', 'comet_sun', 'comet_wave']: tex(k, 0.5)

# atlas nativos (personajes y público): la consola los reescala al arrancar
for k in ['rig_sun', 'rig_wave', 'rig_boy', 'crowd']:
    im = np.asarray(Image.open(f'src/assets/{k}.png').convert('RGBA'), np.uint8)
    h, w = im.shape[:2]
    out['atlas_' + k] = {'w': w, 'h': h, 'd': base64.b64encode(zlib.compress(im.tobytes(), 9)).decode(),
                         'json': json.load(open(f'src/assets/{k}.json'))}
    print('atlas', k, len(out['atlas_' + k]['d']) // 1024, 'KB')

json.dump(out, open(OUT, 'w'))
print('TOTAL', os.path.getsize(OUT) // 1024, 'KB')
