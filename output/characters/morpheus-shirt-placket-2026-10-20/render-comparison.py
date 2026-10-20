"""Render the complete measured shirt, with diagnostic shading, not game pixels."""
import json
import sys
from pathlib import Path

out = Path(__file__).parent
(out / 'runtime-meshes').mkdir(exist_ok=True)
for label in ['before', 'after']:
    data = json.loads((out / f'shirt-contacts-{label}.json').read_text())
    surface = {'vertices': data['points'], 'indices': data['indices'],
               'texcoords': [[0, 0] for _ in data['points']], 'color': [.46, .49, .43],
               'vertexColors': None, 'texture': None, 'face': None, 'side': 2}
    scene = {'width': 800, 'height': 800, 'eye': [.035, 2.78, 1.15], 'target': [0, 2.78, .42],
             'fov': 12, 'surfaces': [surface], 'renderSource': 'DIAGNOSTIC SHADING'}
    (out / 'runtime-meshes' / f'{label}.json').write_text(json.dumps(scene))
sys.argv = [__file__, 'before', 'after']
renderer = out.parent / 'morpheus-withdrawal-path-2026-10-20/render-body.py'
exec(compile(renderer.read_text(), str(renderer), 'exec'), {'__file__': __file__, '__name__': '__main__'})
