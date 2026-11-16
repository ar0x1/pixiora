"""Generate real image fixtures for PIXIORA engine + e2e tests.

Uses Pillow (+ pillow-heif) so fixtures are genuine files produced by an
independent toolchain, not by the code under test.
"""
import os, struct, math
from PIL import Image, ImageDraw, ImageFilter
import pillow_heif

OUT = os.path.join(os.path.dirname(__file__), "..", "pixiora", "tests", "fixtures")
os.makedirs(OUT, exist_ok=True)
pillow_heif.register_heif_opener()


def photo(w, h, seed=1):
    """Photo-like texture: gradients + shapes + noise -> realistic entropy."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            r = int(127 + 100 * math.sin((x / w) * 6.2 + seed))
            g = int(127 + 90 * math.sin((y / h) * 5.1 + seed * 2))
            b = int(127 + 110 * math.sin(((x + y) / (w + h)) * 7.3))
            n = ((x * 7919 + y * 104729) % 23) - 11
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    d = ImageDraw.Draw(img)
    for i in range(6):
        d.ellipse([w * 0.1 * i, h * 0.08 * i, w * 0.55, h * 0.6], outline=(255, 255, 255), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.4))


def p(*name):
    return os.path.join(OUT, *name)


# JPEG (with EXIF orientation = 6 so orientation logic is exercised)
base = photo(420, 300)
exif = Image.Exif()
exif[274] = 6
base.save(p("photo.jpg"), quality=92, exif=exif)
base.save(p("photo-large.jpg"), quality=95)
photo(1600, 1200, seed=3).save(p("large.jpg"), quality=94)

# PNG with real alpha channel (transparency must survive)
alpha = Image.new("RGBA", (300, 220), (0, 0, 0, 0))
d = ImageDraw.Draw(alpha)
for i in range(8):
    d.rectangle([i * 34, i * 24, i * 34 + 120, i * 24 + 90], fill=(139, 92, 246, 255))
d.ellipse([60, 40, 240, 180], fill=(34, 197, 94, 180))
alpha.save(p("alpha.png"))

# Opaque gradient PNG
grad = Image.new("RGB", (256, 256))
gpx = grad.load()
for y in range(256):
    for x in range(256):
        gpx[x, y] = (x, y, (x * y) % 256)
grad.save(p("gradient.png"))

# WebP
base.save(p("photo.webp"), quality=90)

# AVIF
photo(320, 240, seed=5).save(p("photo.avif"), quality=70)

# TIFF
photo(320, 240, seed=7).save(p("photo.tiff"))

# HEIC
pillow_heif.from_pillow(photo(320, 240, seed=9)).save(p("photo.heic"), quality=80)

# Animated GIF (4 frames, distinct colours, real delays)
frames = []
pal = [
    [(255, 0, 0), (0, 0, 255)],
    [(0, 255, 0), (255, 255, 0)],
    [(0, 0, 255), (255, 0, 255)],
    [(255, 255, 0), (0, 255, 255)],
]
for i, (bgc, fgc) in enumerate(pal):
    f = Image.new("RGB", (120, 90), bgc)
    fd = ImageDraw.Draw(f)
    fd.ellipse([10 + i * 18, 20, 70 + i * 18, 80], fill=fgc)
    frames.append(f)
frames[0].save(p("anim.gif"), save_all=True, append_images=frames[1:],
               duration=[120, 80, 160, 100], loop=0, disposal=2)

# Static GIF
frames[0].save(p("static.gif"), save_all=True)

# SVG (with unsafe content: script, event handler, external ref -> sanitizer test)
svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <!-- a comment that SVGO should drop -->
  <script type="text/javascript">alert(document.cookie)</script>
  <rect x="10" y="10" width="180" height="130" fill="#8B5CF6" onclick="steal()"/>
  <circle cx="100" cy="75" r="40" fill="#22C55E"/>
  <a xlink:href="javascript:alert(1)"><text x="20" y="140">click</text></a>
  <image href="https://evil.example/x.png" width="10" height="10"/>
</svg>
"""
open(p("logo.svg"), "w").write(svg)

# Not-really-an-image, plus a corrupt file
open(p("not-an-image.txt"), "w").write("this is definitely not an image\n")
data = bytearray(open(p("photo.jpg"), "rb").read())
data[2:40] = b"\x00" * 38          # destroy SOF markers -> decoder must fail cleanly
open(p("corrupt.jpg"), "wb").write(bytes(data))

for f in sorted(os.listdir(OUT)):
    print(f"{f:20s} {os.path.getsize(os.path.join(OUT,f)):>9,d} bytes")
