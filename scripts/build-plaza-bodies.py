"""Fit the pinned CC0 business suit to the existing male/female extra anatomy.

Intermediate rigs only; build-plaza-crowd.mts bakes the runtime walking meshes.
The output directory must be separate from the game's character directory.
"""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import struct
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('character_builder', root / 'scripts/build-characters.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.subdivide = lambda vertices, uv, faces, weights: (vertices, uv, faces, weights)
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='matrix-plaza-bodies-') as staging:
    builder.OUT = Path(staging)
    for sex, original in [('male', 'choi'), ('female', 'dujour')]:
        # The Smith authoring branch retains the suit's real lapels, cuffs,
        # white collar and tie. Only its body specification is replaced.
        builder.CHARACTERS['smith'] = copy.deepcopy(builder.CHARACTERS[original])
        builder.main(args.source, 'smith')
        data = (builder.OUT / 'smith.glb').read_bytes()
        length = struct.unpack_from('<I', data, 12)[0]
        document = json.loads(data[20:20 + length])
        for image in document['images']:
            if image['uri'] == 'grey_eye.png': image['uri'] = 'brown_eye.png'
            if image['uri'] == 'smith-skin.png': image['uri'] = original + '-skin.png'
            if image['uri'] == 'smith-suit.png': image['uri'] = 'plaza-business-suit.png'
        document['extras'].update(character='plaza-' + sex, anatomy=original, costume='CC0 male_elegantsuit01', skinBaked=True)
        payload = json.dumps(document, separators=(',', ':')).encode()
        payload += b' ' * (-len(payload) % 4)
        binary = data[20 + length:]
        result = struct.pack('<5I', 0x46546c67, 2, 20 + len(payload) + len(binary), len(payload), 0x4e4f534a) + payload + binary
        (args.output / ('plaza-' + sex + '-rig.glb')).write_bytes(result)
    (args.output / 'plaza-business-suit.png').write_bytes((builder.OUT / 'smith-suit.png').read_bytes())
