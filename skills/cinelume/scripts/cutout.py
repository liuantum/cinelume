#!/usr/bin/env python3
"""Remove the background of a photo (people, objects) for Vox-edit collage cut-outs.
usage: cutout.py in.jpg out.png      needs: pip install rembg   (downloads the u2net model, ~170 MB, once)"""
import sys
try:
    from rembg import remove, new_session
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('rembg not installed: pip install rembg')
im = Image.open(sys.argv[1]).convert('RGB')
out = remove(im, session=new_session('u2net'), alpha_matting=False)
a = out.split()[-1].filter(ImageFilter.GaussianBlur(0.6))   # soften the matte edge a touch
out.putalpha(a)
bbox = out.getbbox()
if bbox: out = out.crop(bbox)
out.save(sys.argv[2])
