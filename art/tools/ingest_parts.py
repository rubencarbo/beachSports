#!/usr/bin/env python3
"""
Importador de hojas de piezas (personaje recortable) generadas sobre croma verde.

Uso:
  python3 -I art/tools/ingest_parts.py art/raw/wave_parts.jpg src/assets/rig_wave [--recolor sun src/assets/rig_sun]

Pasos:
 1. Detecta el tamaño real del píxel de arte (FFT de los bordes) y su fase.
 2. Reduce la imagen a resolución nativa (mediana por bloque) => píxel limpio, sin artefactos JPEG.
 3. Quita el croma verde (y el "spill" verde de los bordes).
 4. Separa las piezas por componentes conexas y las nombra por su posición en la rejilla
    (izquierda = figura completa; derecha = rejilla 4x3).
 5. Empaqueta un atlas PNG + JSON con el rectángulo de cada pieza.
 6. (Opcional) genera una variante recoloreada para otro jugador.
"""
import colorsys
import json
import sys

import numpy as np
from PIL import Image

GRID_NAMES = [
    ['head', 'torso', 'pelvis', 'upperarm'],
    ['forearm', 'paddlehand', 'openhand', 'thigh'],
    ['lowerleg', 'shoe', 'head_angry', 'head_happy'],
]


def pixel_period(a, axis):
    d = np.abs(np.diff(a, axis=axis))
    g = d.sum(axis=(0, 2)) if axis == 1 else d.sum(axis=(1, 2))
    best = (0, 0, 0)
    for p in np.arange(3, 12, 0.02):
        ph = (np.arange(len(g)) % p) / p
        z = (g * np.exp(2j * np.pi * ph)).sum() / g.sum()
        if abs(z) > best[0]:
            best = (abs(z), p, np.angle(z))
    _, p, ang = best
    # las fronteras de píxel están donde se concentra la energía de bordes
    offset = (ang / (2 * np.pi)) * p % p
    return p, offset


def to_native(a):
    px, ox = pixel_period(a, 1)
    py, oy = pixel_period(a, 0)
    p = (px + py) / 2
    h, w = a.shape[:2]
    nw = int((w - ox) / p)
    nh = int((h - oy) / p)
    out = np.zeros((nh, nw, 3), np.float32)
    for y in range(nh):
        for x in range(nw):
            y0 = int(oy + y * p + p * 0.25); y1 = int(oy + (y + 1) * p - p * 0.25)
            x0 = int(ox + x * p + p * 0.25); x1 = int(ox + (x + 1) * p - p * 0.25)
            blk = a[y0:max(y1, y0 + 1), x0:max(x1, x0 + 1)].reshape(-1, 3)
            out[y, x] = np.median(blk, axis=0)
    return out, p


def chroma_mask(n):
    r, g, b = n[..., 0], n[..., 1], n[..., 2]
    green = (g > 100) & (g > r + 28) & (g > b + 28)
    return ~green


def despill(n, mask):
    r, g, b = n[..., 0], n[..., 1], n[..., 2]
    lim = np.maximum(r, b) + 8
    n[..., 1] = np.where(mask & (g > lim), lim, g)
    return n


def components(mask):
    h, w = mask.shape
    lab = -np.ones((h, w), np.int32)
    comps = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and lab[y, x] < 0:
                stack = [(y, x)]; lab[y, x] = len(comps); pts = []
                while stack:
                    cy, cx = stack.pop(); pts.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] < 0:
                                lab[ny, nx] = len(comps); stack.append((ny, nx))
                ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                comps.append({'id': len(comps), 'n': len(pts), 'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys)})
    return lab, comps


def name_parts(comps, w, h):
    big = [c for c in comps if c['n'] > 25]
    full = max(big, key=lambda c: (c['y1'] - c['y0']) * (1 if c['x1'] < w * 0.33 else 0))
    rest = [c for c in big if c is not full and c['x0'] > w * 0.33]
    named = {'full': full}
    for c in rest:
        cy = (c['y0'] + c['y1']) / 2; cx = (c['x0'] + c['x1']) / 2
        row = min(2, int(cy / (h / 3)))
        col = min(3, int((cx - w * 0.36) / (w * 0.64 / 4)))
        named.setdefault(GRID_NAMES[row][col], c)
    return named


def recolor(rgba, part, scheme):
    """Variante 'sun': camiseta -> naranja, pelo -> dorado, cinta -> roja, pala -> roja."""
    out = rgba.copy()
    h, w = out.shape[:2]
    is_head = part.startswith('head') or part == 'full'
    for y in range(h):
        for x in range(w):
            if out[y, x, 3] == 0:
                continue
            R, G, B = out[y, x, :3] / 255.0
            hh, ll, ss = colorsys.rgb_to_hls(R, G, B)
            hue = hh * 360
            new = None
            if 160 <= hue < 200 and ss > 0.25:  # turquesa (camiseta, muñequeras, pala, zapatillas)
                target = 4 if part == 'paddlehand' and ll < 0.6 and y > h * 0.35 else 24
                new = (target / 360, ll * 1.22, max(0.85, ss))
            elif 200 <= hue < 250 and ss > 0.3 and is_head:  # cinta azul -> roja
                new = (8 / 360, ll * 1.1, max(ss, 0.75))
            elif is_head and ll < 0.22 and (hue > 180 or ss < 0.3) and y < h * 0.62:  # pelo negro -> dorado
                new = (34 / 360, 0.32 + ll * 2.2, 0.95)
            if new:
                rr, gg, bb = colorsys.hls_to_rgb(new[0], min(0.88, new[1]), new[2])
                out[y, x, :3] = [rr * 255, gg * 255, bb * 255]
    return out


def main():
    src, outbase = sys.argv[1], sys.argv[2]
    variants = []
    if '--recolor' in sys.argv:
        i = sys.argv.index('--recolor')
        variants.append((sys.argv[i + 1], sys.argv[i + 2]))
    a = np.asarray(Image.open(src).convert('RGB'), np.float32)
    n, p = to_native(a)
    mask = chroma_mask(n)
    n = despill(n, mask)
    lab, comps = components(mask)
    h, w = mask.shape
    parts = name_parts(comps, w, h)
    print(f'pixel={p:.2f}px native={w}x{h} parts={sorted(parts)}')

    crops = {}
    for name, c in parts.items():
        sub = (lab[c['y0']:c['y1'] + 1, c['x0']:c['x1'] + 1] == c['id'])
        rgba = np.zeros(sub.shape + (4,), np.uint8)
        rgba[..., :3] = np.clip(n[c['y0']:c['y1'] + 1, c['x0']:c['x1'] + 1], 0, 255)
        rgba[..., 3] = sub * 255
        crops[name] = rgba

    def pack(cr, path):
        pad = 2
        W = sum(v.shape[1] + pad for v in cr.values()) + pad
        H = max(v.shape[0] for v in cr.values()) + pad * 2
        atlas = np.zeros((H, W, 4), np.uint8)
        frames = {}
        x = pad
        for name, v in cr.items():
            atlas[pad:pad + v.shape[0], x:x + v.shape[1]] = v
            al = v[..., 3] > 0
            def row_center(r):
                xs = np.nonzero(al[r])[0]
                return float(xs.mean()) if len(xs) else v.shape[1] / 2
            hgt = v.shape[0]
            frames[name] = {'x': x, 'y': pad, 'w': v.shape[1], 'h': hgt,
                            # anclas automáticas: centro de las filas opacas arriba y abajo
                            'top': [round(row_center(min(2, hgt - 1)), 1), 2],
                            'bot': [round(row_center(max(0, hgt - 3)), 1), hgt - 3]}
            x += v.shape[1] + pad
        Image.fromarray(atlas).save(path + '.png', optimize=True)
        json.dump({'pixel': round(p, 2), 'frames': frames}, open(path + '.json', 'w'), indent=1)
        print('->', path + '.png', atlas.shape)

    pack(crops, outbase)
    for scheme, vout in variants:
        pack({k: recolor(v, k, scheme) for k, v in crops.items()}, vout)


if __name__ == '__main__':
    main()
