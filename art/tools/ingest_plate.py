#!/usr/bin/env python3
"""Reduce un fondo pixel art generado (JPEG reescalado) a su resolución nativa.
Uso: python3 -I art/tools/ingest_plate.py art/raw/beach_plate.jpg src/assets/plate.png"""
import importlib.util, sys, os
import numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('ing', os.path.join(os.path.dirname(__file__), 'ingest_parts.py'))
ing = importlib.util.module_from_spec(spec); spec.loader.exec_module(ing)
a = np.asarray(Image.open(sys.argv[1]).convert('RGB'), np.float32)
n, p = ing.to_native(a)
Image.fromarray(np.clip(n, 0, 255).astype(np.uint8)).save(sys.argv[2], optimize=True)
print(f'pixel={p:.2f} native={n.shape[1]}x{n.shape[0]} -> {sys.argv[2]}')
