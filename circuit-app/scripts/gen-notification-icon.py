#!/usr/bin/env python3
"""
Android status-bar / collapsed notification icon: **white alpha mask** on transparent.

Material draws this very small (24dp baseline). Thin strokes disappear and the OS
falls back to a generic light “placeholder” glyph. This script emits a **bold**
silhouette (pause bars) at 192px so Expo’s prebuild resize to mdpi–xxxhdpi stays legible.

After regenerating:
  python3 scripts/gen-notification-icon.py
  npx expo prebuild --platform android --clean   # or full prebuild
  rebuild the app on device
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "notification-icon.png"
SIZE = 192
WHITE = (255, 255, 255, 255)


def main() -> None:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    # Two solid rounded “pause” bars — readable at 24dp after mip pipeline
    bar_w = 44
    gap = 36
    top = 28
    bottom = SIZE - 28
    x0 = (SIZE - 2 * bar_w - gap) // 2
    x1 = x0 + bar_w + gap
    r = 10
    draw.rounded_rectangle((x0, top, x0 + bar_w, bottom), radius=r, fill=WHITE)
    draw.rounded_rectangle((x1, top, x1 + bar_w, bottom), radius=r, fill=WHITE)
    im.save(OUT, format="PNG")
    print("wrote", OUT, im.size)


if __name__ == "__main__":
    main()
