#!/usr/bin/env python3
"""
Gera o logo do cabeçalho e o favicon a partir do logo completo (fundo branco).

  uv run --with pillow --with numpy python scripts/recortar-logo.py \
      assets/incoming/logo/logo1.jpeg assets/img/logo-mark.png /tmp/previa.png

O recorte (crop) é do arquivo logo1.jpeg de 09/10/2026: só o triângulo, sem a
faixa TIRADENTES — o nome vai em texto no HTML, que fica nítido em qualquer tela.
"""
# branco de fora: o fundo é achado por preenchimento a partir dos cantos, então
# o branco de dentro do desenho (faixas de velocidade, capacete) continua branco.
# Na borda, o alfa sai de quanto o pixel se afasta do branco — sem halo claro.
from PIL import Image, ImageDraw
import numpy as np, sys
src, out, preview = sys.argv[1:4]
im = Image.open(src).convert('RGB').crop((150, 0, 700, 452))
w, h = im.size
marca = im.copy()
for canto in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0)]:
    ImageDraw.floodfill(marca, canto, (0, 255, 0), thresh=60)
fundo = np.all(np.asarray(marca) == (0, 255, 0), axis=2)
a = np.asarray(im).astype(float) / 255
alfa = np.where(fundo, np.clip((1 - a.min(axis=2) - 0.03) / 0.97, 0, 1), 1.0)
cor = np.where(fundo[..., None],
               (a - (1 - alfa[..., None])) / np.maximum(alfa[..., None], 1e-3), a)
rgba = np.dstack([np.clip(cor, 0, 1), alfa])
img = Image.fromarray((rgba * 255).astype('uint8'), 'RGBA')
img = img.crop(img.getbbox())
w, h = img.size; lado = max(w, h)
quad = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); quad.paste(img, ((lado - w) // 2, (lado - h) // 2))
img.resize((round(256 * w / h), 256), Image.LANCZOS).save(out)   # mark: proporção natural
quad.resize((64, 64), Image.LANCZOS).save(out.replace('logo-mark.png', 'favicon.png'))
f = Image.new('RGBA', (600, 300), (17, 17, 19, 255))
f.alpha_composite(quad.resize((240, 240), Image.LANCZOS), (30, 30))
f.alpha_composite(quad.resize((42, 42), Image.LANCZOS), (320, 120))
f.alpha_composite(quad.resize((84, 84), Image.LANCZOS), (400, 100))
f.save(preview)
