"""Turn the clean synthetic sheets into photos of three qualities.

    OCR/paddleocr-env/bin/python e2e/ocr-accuracy/distort.py

Reads out/clean/<id>.png + .json and writes out/sheets/<id>.jpg + .json. Each
sheet gets one condition, assigned in turn so every layout appears under
every condition:

  scan   flatbed-like: near-straight, sharp, even light, high resolution
  phone  a typical phone photo: tilted a few degrees, slight perspective,
         a shadow across the page, mild blur and noise, JPEG compression
  poor   a careless photo: stronger tilt and perspective, heavy shadow,
         blur, lower resolution and strong JPEG compression

Every ground-truth box is moved with exactly the same geometry as the
image, so the recognition test still knows where each number is.
"""
import glob
import json
import os
import random

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SET_DIR = os.path.join(HERE, 'out', os.environ['OCR_SET']) if os.environ.get('OCR_SET') else os.path.join(HERE, 'out')
SRC = os.path.join(SET_DIR, 'clean')
DST = os.path.join(SET_DIR, 'sheets')
SEED = int(os.environ.get('OCR_SEED', 20261010))
CONDITIONS = ['scan', 'phone', 'poor']
SETTINGS = {
    #        long side, rotate°, perspective, blur σ, noise σ, shadow, JPEG
    'scan': dict(long=2400, rot=0.6, persp=0.000, blur=0.0, noise=2, shadow=0.05, jpeg=92),
    'phone': dict(long=2400, rot=3.5, persp=0.025, blur=0.8, noise=6, shadow=0.30, jpeg=82),
    'poor': dict(long=1600, rot=6.5, persp=0.055, blur=1.5, noise=10, shadow=0.50, jpeg=60),
}


def homography(w, h, out_w, out_h, cfg, rng):
    """3x3 matrix taking clean-sheet pixels to photo pixels."""
    margin = 0.06
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    # Fit the page into the photo with a margin, then tilt and skew it.
    inner_w, inner_h = out_w * (1 - 2 * margin), out_h * (1 - 2 * margin)
    s = min(inner_w / w, inner_h / h)
    cx, cy = out_w / 2, out_h / 2
    corners = np.float32([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) * s
    a = np.deg2rad(rng.uniform(-cfg['rot'], cfg['rot']))
    rot = np.float32([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    corners = corners @ rot.T
    jitter = cfg['persp'] * max(out_w, out_h)
    corners += np.float32([[rng.uniform(-jitter, jitter), rng.uniform(-jitter, jitter)] for _ in range(4)])
    dst = corners + np.float32([cx, cy])
    return cv2.getPerspectiveTransform(src, dst)


def shadow_mask(out_w, out_h, strength, rng):
    """A soft diagonal shadow: 1.0 where lit, down to 1-strength in shade."""
    yy, xx = np.mgrid[0:out_h, 0:out_w].astype(np.float32)
    ang = rng.uniform(0, np.pi)
    d = (xx * np.cos(ang) + yy * np.sin(ang))
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    edge = rng.uniform(0.3, 0.7)
    t = np.clip((d - edge) * 4 + 0.5, 0, 1)
    return 1.0 - strength * t


def main():
    os.makedirs(DST, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    rng = np.random.default_rng(SEED)
    random.seed(SEED)
    manifest = []
    for n, png in enumerate(files):
        sheet_id = os.path.splitext(os.path.basename(png))[0]
        gt = json.load(open(os.path.join(SRC, f'{sheet_id}.json')))
        cond = CONDITIONS[(n // 6) % 3]  # 6 layouts per block → every layout under every condition
        cfg = SETTINGS[cond]
        img = cv2.imread(png)
        h, w = img.shape[:2]
        scale = cfg['long'] / max(w, h)
        out_w, out_h = int(w * scale * 1.12), int(h * scale * 1.12)
        H = homography(w, h, out_w, out_h, cfg, rng)
        # A table-top background, then the page warped onto it.
        bg = np.full((out_h, out_w, 3), rng.integers(70, 150, 3), dtype=np.uint8)
        page = cv2.warpPerspective(img, H, (out_w, out_h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
        mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), H, (out_w, out_h))
        photo = np.where(mask[..., None] > 0, page, bg).astype(np.float32)
        photo *= shadow_mask(out_w, out_h, cfg['shadow'], rng)[..., None]
        photo *= rng.uniform(0.9, 1.05)  # overall exposure
        if cfg['blur'] > 0:
            photo = cv2.GaussianBlur(photo, (0, 0), cfg['blur'])
        photo += rng.normal(0, cfg['noise'], photo.shape)
        photo = np.clip(photo, 0, 255).astype(np.uint8)
        out_jpg = os.path.join(DST, f'{sheet_id}.jpg')
        cv2.imwrite(out_jpg, photo, [cv2.IMWRITE_JPEG_QUALITY, cfg['jpeg']])
        # Move the ground-truth boxes the same way.
        for t in gt['tokens']:
            x1, y1, x2, y2 = t['box']
            pts = np.float32([[[x1, y1]], [[x2, y1]], [[x2, y2]], [[x1, y2]]])
            moved = cv2.perspectiveTransform(pts, H).reshape(-1, 2)
            t['box'] = [float(moved[:, 0].min()), float(moved[:, 1].min()), float(moved[:, 0].max()), float(moved[:, 1].max())]
        gt['condition'] = cond
        gt['image'] = os.path.basename(out_jpg)
        gt['size'] = [out_w, out_h]
        json.dump(gt, open(os.path.join(DST, f'{sheet_id}.json'), 'w'), indent=2)
        manifest.append({'id': sheet_id, 'layout': gt['layout'], 'condition': cond, 'tokens': len(gt['tokens'])})
        print(f'\r{n + 1}/{len(files)} {sheet_id} ({cond})      ', end='', flush=True)
    json.dump(manifest, open(os.path.join(DST, 'manifest.json'), 'w'), indent=2)
    print(f'\nWrote {len(manifest)} photos to {os.path.relpath(DST)}')


if __name__ == '__main__':
    main()
