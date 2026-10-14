"""Offline rasterization of actual posed surfaces and albedo, not game lighting."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

folder = Path(__file__).parent
assets = folder.parents[2] / 'packages/client/public/assets/characters'
sources = {label: json.loads((folder / f'{label}-arms.json').read_text()) for label in ['before', 'final']}
W, H = 430, 480
textures = {}
for pose in [0, 2]:
    sheet = Image.new('RGB', (W * 2, H * 4), (26, 31, 33)); draw = ImageDraw.Draw(sheet)
    for row, role in enumerate(['neo', 'trinity', 'smith', 'morpheus']):
        for col, label in enumerate(['before', 'final']):
            data = [frame for frame in sources[label] if frame['id'] == role][pose]
            forward = np.array([1, .12, 1.0]); forward /= np.linalg.norm(forward)
            right = np.cross([0, 1, 0], forward); right /= np.linalg.norm(right); up = np.cross(forward, right)
            light = forward + np.array([0, 1, 0]) * .55 + right * .45; light /= np.linalg.norm(light)
            pixels = np.zeros((H, W, 3), dtype=np.uint8) + [26, 31, 33]; depth = np.zeros((H, W)) - np.inf
            for surface in data['surfaces']:
                vertices = np.array(surface['vertices']); faces = np.array(surface['indices']).reshape(-1, 3)
                uv = np.array(surface['texcoords']); color = np.array(surface['color']); name = surface.get('texture')
                key = (label, name)
                if name and key not in textures:
                    rgb = np.array(Image.open(folder / 'original' / name if label == 'before' and name.endswith('-wrist-skin.png') else assets / name).convert('RGB'), dtype=float) / 255
                    textures[key] = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
                texture = textures.get(key)
                centered = vertices - [0, .04, 0]
                projected = np.column_stack((centered @ right * 550 + W / 2, -centered @ up * 550 + H / 2, centered @ forward))
                normals = np.array(surface['normals'])
                illumination = .45 + .65 * np.maximum(normals @ light, 0)
                for tri in faces:
                    p = projected[tri]; low = np.maximum(np.floor(p[:, :2].min(axis=0)).astype(int), [0, 0]); high = np.minimum(np.ceil(p[:, :2].max(axis=0)).astype(int), [W - 1, H - 1])
                    if np.any(low > high): continue
                    den = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
                    if abs(den) < 1e-9: continue
                    yy, xx = np.mgrid[low[1]:high[1] + 1, low[0]:high[0] + 1]; xx = xx + .5; yy = yy + .5
                    a = ((p[1, 1] - p[2, 1]) * (xx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (yy - p[2, 1])) / den
                    b = ((p[2, 1] - p[0, 1]) * (xx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (yy - p[2, 1])) / den; c = 1 - a - b
                    z = a * p[0, 2] + b * p[1, 2] + c * p[2, 2]; old = depth[low[1]:high[1] + 1, low[0]:high[0] + 1]
                    visible = (a >= 0) & (b >= 0) & (c >= 0) & (z > old); old[visible] = z[visible]
                    shade = a * illumination[tri[0]] + b * illumination[tri[1]] + c * illumination[tri[2]]
                    rgb = shade[..., None] * color
                    if texture is not None:
                        xy = (a[..., None] * uv[tri[0]] + b[..., None] * uv[tri[1]] + c[..., None] * uv[tri[2]]) * [texture.shape[1], texture.shape[0]] - .5
                        lo = np.floor(xy).astype(int); fraction = xy - lo
                        sample = np.zeros((*a.shape, 3))
                        for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                            gain = (fraction[..., 0] if dx else 1 - fraction[..., 0]) * (fraction[..., 1] if dy else 1 - fraction[..., 1])
                            sample += texture[np.clip(lo[..., 1] + dy, 0, texture.shape[0] - 1), np.clip(lo[..., 0] + dx, 0, texture.shape[1] - 1)] * gain[..., None]
                        rgb = rgb * sample
                    rgb = np.where(rgb <= .0031308, rgb * 12.92, 1.055 * np.maximum(rgb, 0) ** (1 / 2.4) - .055)
                    patch = pixels[low[1]:high[1] + 1, low[0]:high[0] + 1]; patch[visible] = np.clip(rgb[visible] * 255, 0, 255).astype('uint8')
            sheet.paste(Image.fromarray(pixels.astype('uint8')), (col * W, row * H))
            draw.text((col * W + 18, row * H + 16), f'{role} / {label} / ' + ('relaxed' if pose == 0 else '160 deg roll, 37 deg flex'), fill=(235, 235, 235))
    sheet.save(folder / ('neutral-comparison.png' if pose == 0 else 'wrist-comparison.png'))
