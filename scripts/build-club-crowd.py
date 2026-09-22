"""Build two lighter dancing extras from the project's pinned CC0 source cache.

Keeps the existing 46-bone rig and clothing topology, omits surface subdivision.
The resulting GLBs reuse the already shipped Choi/Dujour skin, eye and hair maps.
No authoring tool runs in the game.
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
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.subdivide = lambda vertices, uv, faces, weights: (vertices, uv, faces, weights)
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='matrix-club-crowd-') as staging:
    builder.OUT = Path(staging)
    for character, filename in [('choi', 'club-male.glb'), ('dujour', 'club-female.glb')]:
        builder.main(args.source, character)
        (args.output / filename).write_bytes((builder.OUT / (character + '.glb')).read_bytes())
        print('Shipped', args.output / filename)
