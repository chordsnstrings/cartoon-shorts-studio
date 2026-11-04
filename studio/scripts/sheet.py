# usage: python3 scripts/sheet.py out.jpg img1 img2 ... (labels = frame numbers, for review only)
import sys, re
from PIL import Image, ImageDraw
out, ims = sys.argv[1], sys.argv[2:]
th = [Image.open(p).convert("RGB") for p in ims]
w, h = 270, 480; cols = min(6, len(th)); rows = (len(th) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * h), "black"); d = ImageDraw.Draw(S)
for i, (p, im) in enumerate(zip(ims, th)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im.resize((w, h)), (x, y)); d.text((x + 6, y + 6), re.findall(r"(\d+)\.jpg", p)[-1], fill="yellow")
S.save(out, quality=85)
