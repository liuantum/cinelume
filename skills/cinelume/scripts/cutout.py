#!/usr/bin/env python3
"""Turn a photo / clipart into a transparent die-cut sticker PNG (Vox-edit collage cut-outs).
usage: cutout.py in.(jpg|png|webp) out.png

1. already transparent (PNG/WebP with alpha)  -> keep it, just trim
2. rembg installed (pip install rembg)         -> AI background removal (u2net, ~170 MB model downloaded once)
3. otherwise, plain/flat background            -> flood-fill the background from the corners
4. otherwise                                   -> exit 2 (caller keeps the full image)"""
import sys
try:
    from PIL import Image, ImageFilter, ImageDraw, ImageChops
except ImportError:
    sys.exit('Pillow not installed: pip install pillow')

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
im.load()

def trim_save(out):
    bbox = out.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox: out = out.crop(bbox)
    m = max(out.size)
    if m > 1400: out = out.resize((round(out.width * 1400 / m), round(out.height * 1400 / m)), Image.LANCZOS)
    out.save(dst)
    sys.exit(0)

# 1. existing transparency
if im.mode in ('RGBA', 'LA', 'P'):
    rgba = im.convert('RGBA'); a = rgba.split()[-1]
    hist = a.histogram(); clear = sum(hist[:16]) / max(1, rgba.width * rgba.height)
    if clear > 0.04: trim_save(rgba)

rgb = im.convert('RGB')
# 2. rembg
try:
    from rembg import remove, new_session
    out = remove(rgb, session=new_session('u2net'), alpha_matting=False)
    a = out.split()[-1].filter(ImageFilter.GaussianBlur(0.6))   # soften the matte edge a touch
    out.putalpha(a)
    trim_save(out)
except ImportError:
    pass

# 3. flat background: corners agree -> flood fill from each corner
w, h = rgb.size
corners = [rgb.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
ref = corners[0]
if all(sum(abs(c[i] - ref[i]) for i in range(3)) < 40 for c in corners):
    work = rgb.copy(); key = (255, 0, 254)
    for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(work, p, key, thresh=38)
    mask = ImageChops.difference(work, Image.new('RGB', work.size, key)).convert('L').point(lambda v: 255 if v > 6 else 0)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert('RGBA'); out.putalpha(mask)
    trim_save(out)

sys.exit(2)
