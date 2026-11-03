"""
Master Logo Enhancement Script for TreFood.

Boosts brightness, contrast, and color vibrance of the TreFood brand logo:
- Pure luminous white for 'Tre'
- Radiant warm honey gold for 'Food' (#FFB800 / #FCB51A)
- Fresh vibrant spring green for Sprout Emblem (#7CB342 / #84CC16)
- Luminous royal crimson-maroon radiant background (#CE1C52 center -> #941036 edge)
- Subtle ambient illumination & crisp micro-shadow for depth

Generates:
  public/logo.png (1024x1024)
  public/icons/logo.png (1024x1024)
  public/brand/trefood-brand-logo.jpg (1024x1024)
  public/logo-source.png (1600x1600)
"""
import os
from PIL import Image, ImageFilter
import numpy as np

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
ICONS_DIR = os.path.join(PUBLIC_DIR, "icons")
BRAND_DIR = os.path.join(PUBLIC_DIR, "brand")
ASSETS_DIR = os.path.join(ROOT_DIR, "scripts", "assets")

os.makedirs(ICONS_DIR, exist_ok=True)
os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

wordmark_path = os.path.join(ASSETS_DIR, "wordmark.png")

if os.path.exists(wordmark_path):
    wordmark_img = Image.open(wordmark_path).convert("RGBA")
else:
    source_path = os.path.join(PUBLIC_DIR, "logo-source.png")
    src = Image.open(source_path).convert("RGB")
    arr = np.array(src, dtype=float)
    H, W, _ = arr.shape

    bg_orig = arr[10, 10]
    dist = np.linalg.norm(arr - bg_orig, axis=2)
    alpha = np.clip((dist - 6.0) / (28.0 - 6.0), 0.0, 1.0)

    fg = np.zeros_like(arr)
    for c in range(3):
        fg[:, :, c] = np.clip((arr[:, :, c] - (1.0 - alpha) * bg_orig[c]) / np.maximum(alpha, 1e-4), 0, 255)

    y_idx, x_idx = np.where(alpha > 0.05)
    ymin, ymax = y_idx.min(), y_idx.max()
    xmin, xmax = x_idx.min(), x_idx.max()

    fg_crop = fg[ymin:ymax+1, xmin:xmax+1]
    alpha_crop = alpha[ymin:ymax+1, xmin:xmax+1]
    fg_enh = fg_crop.copy()

    # 1. Pure brilliant white 'Tre'
    is_white = (fg_crop[:,:,0] > 215) & (fg_crop[:,:,1] > 215) & (fg_crop[:,:,2] > 215)
    fg_enh[is_white] = [255.0, 255.0, 255.0]

    # 2. Vibrant warm golden-honey 'Food' (#FFB800)
    is_yellow = (fg_crop[:,:,0] > 180) & (fg_crop[:,:,1] > 130) & (fg_crop[:,:,2] < 90)
    fg_enh[is_yellow, 0] = 255.0
    fg_enh[is_yellow, 1] = np.clip(fg_crop[is_yellow, 1] * 1.06, 190.0, 210.0)
    fg_enh[is_yellow, 2] = np.clip(fg_crop[is_yellow, 2] * 0.6, 0.0, 20.0)

    # 3. Fresh vibrant leaf green (#7CB342 / #84CC16)
    is_green = (fg_crop[:,:,1] > fg_crop[:,:,0]) & (fg_crop[:,:,1] > 70) & (~is_white)
    green_intensity = np.clip(fg_crop[is_green, 1] / 175.0, 0.4, 1.0)
    fg_enh[is_green, 0] = np.clip(126.0 * green_intensity, 95.0, 140.0)
    fg_enh[is_green, 1] = np.clip(202.0 * green_intensity, 165.0, 220.0)
    fg_enh[is_green, 2] = np.clip(48.0 * green_intensity, 25.0, 65.0)

    rgba_crop = np.dstack([fg_enh, alpha_crop * 255.0]).astype(np.uint8)
    wordmark_img = Image.fromarray(rgba_crop, "RGBA")
    wordmark_img.save(wordmark_path, optimize=True)

def make_logo(size=1024, wordmark_ratio=0.76):
    target_w = int(size * wordmark_ratio)
    target_h = int(wordmark_img.height * (target_w / wordmark_img.width))
    wordmark_resized = wordmark_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    px = (size - target_w) // 2
    py = (size - target_h) // 2

    y, x = np.ogrid[:size, :size]
    cx, cy = size / 2.0, size / 2.0
    r = np.sqrt((x - cx)**2 + (y - cy)**2)
    glow_radial = np.exp(-0.5 * (r / (size * 0.52))**2)

    bg_arr = np.zeros((size, size, 3), dtype=np.uint8)
    for c, (c_c, c_e) in enumerate([(206, 148), (28, 16), (82, 54)]):
        bg_arr[:, :, c] = np.clip(c_e + (c_c - c_e) * glow_radial, 0, 255).astype(np.uint8)

    bg_img = Image.fromarray(bg_arr, "RGB")
    canvas = bg_img.convert("RGBA")

    # Ambient back-glow behind wordmark
    glow_mask = Image.new("L", (size, size), 0)
    glow_mask.paste(wordmark_resized.split()[3], (px, py))
    glow_blurred = glow_mask.filter(ImageFilter.GaussianBlur(radius=int(size * 0.024)))
    glow_layer = Image.new("RGBA", (size, size), (255, 60, 110, 0))
    glow_alpha = np.array(glow_blurred, dtype=float) * 0.35
    glow_layer.putalpha(Image.fromarray(glow_alpha.astype(np.uint8)))
    canvas = Image.alpha_composite(canvas, glow_layer)

    # Crisp micro-shadow for depth & contrast
    shadow_mask = Image.new("L", (size, size), 0)
    shadow_offset = max(2, int(size * 0.004))
    shadow_mask.paste(wordmark_resized.split()[3], (px, py + shadow_offset))
    shadow_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(radius=max(2, int(size * 0.005))))
    shadow_layer = Image.new("RGBA", (size, size), (30, 2, 10, 0))
    shadow_alpha = np.array(shadow_blurred, dtype=float) * 0.50
    shadow_layer.putalpha(Image.fromarray(shadow_alpha.astype(np.uint8)))
    canvas = Image.alpha_composite(canvas, shadow_layer)

    canvas.paste(wordmark_resized, (px, py), wordmark_resized)
    return canvas.convert("RGB")

logo_1024 = make_logo(1024, 0.76)
logo_1024.save(os.path.join(PUBLIC_DIR, "logo.png"), optimize=True)
logo_1024.save(os.path.join(ICONS_DIR, "logo.png"), optimize=True)
logo_1024.save(os.path.join(BRAND_DIR, "trefood-brand-logo.jpg"), "JPEG", quality=96)

logo_1600 = make_logo(1600, 0.89)
logo_1600.save(os.path.join(PUBLIC_DIR, "logo-source.png"), optimize=True)
print("Successfully generated high-contrast master brand logos.")
