"""Genera las fotos de la galería del newsletter a partir de las fotos del sitio.

Cada foto sale en dos tamaños:
  public/email/galeria/<id>-ancha.jpg  1200x520 (cabecera del mail)
  public/email/galeria/<id>.jpg         480x360  (foto de cada novedad)
y la firma de Ceci en public/email/ceci-firma.jpg (160x160).

Para sumar una foto: copiala a public/, agregala a FOTOS (id, archivo) y a
src/data/galeria-newsletter.ts, y corré:  python scripts/galeria-newsletter.py
"""
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(RAIZ, 'public')
SALIDA = os.path.join(PUB, 'email', 'galeria')

FOTOS = [
    ('portada', 'hero.jpg'),
    ('espacio-1', 'espacio-1.jpg'),
    ('espacio-2', 'espacio-2.jpg'),
    ('espacio-3', 'espacio-3.jpg'),
]


def recortar(im, ancho, alto):
    w, h = im.size
    r = ancho / alto
    if w / h > r:
        nw = round(h * r)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w / r)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize((ancho, alto), Image.LANCZOS)


def guardar(im, ruta, calidad=78):
    im.save(ruta, 'JPEG', quality=calidad, optimize=True, progressive=True)
    print(f'{os.path.relpath(ruta, RAIZ)}  {os.path.getsize(ruta) // 1024} KB')


os.makedirs(SALIDA, exist_ok=True)
for id_, archivo in FOTOS:
    im = Image.open(os.path.join(PUB, archivo)).convert('RGB')
    guardar(recortar(im, 1200, 520), os.path.join(SALIDA, f'{id_}-ancha.jpg'))
    guardar(recortar(im, 480, 360), os.path.join(SALIDA, f'{id_}.jpg'))

firma = Image.open(os.path.join(PUB, 'ceci.jpg')).convert('RGB')
guardar(recortar(firma, 160, 160), os.path.join(PUB, 'email', 'ceci-firma.jpg'), 85)
