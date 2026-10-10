"""Author Zion evacuation workwear using the pinned CC0 background anatomy.

Only the two dock GLBs are shipped. Existing club assets and textures stay intact.
"""
import argparse
import importlib.util
from pathlib import Path
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path(tempfile.gettempdir()) / 'matrix-character-source')
parser.add_argument('--output', type=Path, default=root / 'packages/client/public/assets/characters')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('character_builder', root / 'scripts/build-characters.py')
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
builder.subdivide = lambda vertices, uv, faces, weights: (vertices, uv, faces, weights)
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='matrix-dock-crowd-') as staging:
    builder.OUT = Path(staging)
    for character, sex in [('choi', 'male'), ('dujour', 'female')]:
        builder.main(args.source, character, dock=True)
        destination = args.output / ('dock-' + sex + '.glb')
        destination.write_bytes((builder.OUT / (character + '-dock.glb')).read_bytes())
        print('Shipped', destination)
