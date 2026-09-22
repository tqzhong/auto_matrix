"""Close the finished Trinity outfit's waist gap without rebuilding her head.

Run after finish-characters.py, with Python/numpy. Only the jacket's lower
torso positions, normals and skin weights change; other meshes are preserved.
"""
import argparse
import json
from pathlib import Path
import struct

import numpy as np

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=root / 'packages/client/public/assets/characters/trinity.glb')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
data = args.source.read_bytes(); length = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
if not doc['extras'].get('skinBaked') or doc['extras'].get('fittedWaistVersion'):
    raise RuntimeError('Use the finished Trinity before this waist pass, not its output.')


def array(index, width):
    accessor = doc['accessors'][index]; view = doc['bufferViews'][accessor['bufferView']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']])
    return np.ndarray((accessor['count'], width), dtype, binary,
                      view.get('byteOffset', 0) + accessor.get('byteOffset', 0),
                      strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))


primitive = next(m for m in doc['meshes'] if m['name'] == 'Fitted leather jacket')['primitives'][0]
attributes = primitive['attributes']; positions = array(attributes['POSITION'], 3)
joints = array(attributes['JOINTS_0'], 4); weights = array(attributes['WEIGHTS_0'], 4)
names = [doc['nodes'][index]['name'] for index in doc['skins'][0]['joints']]
torso = (np.isin(joints, [names.index(name) for name in ['pelvis', 'spine', 'chest']]) * weights).sum(axis=1)
t = np.clip((3.15 - positions[:, 1]) / .38, 0, 1)
t = t * t * (3 - 2 * t) * np.clip((torso - .8) / .2, 0, 1)
positions[:, 1] -= .56 * t
# Let the lowered hem follow the pelvis rather than opening up when leaning.
for index in np.flatnonzero(t > 0):
    influence = np.bincount(joints[index], weights=weights[index], minlength=len(names)) * (1 - .75 * t[index])
    influence[names.index('pelvis')] += .75 * t[index]
    order = np.argsort(influence)[-4:][::-1]
    joints[index] = order; weights[index] = influence[order] / influence[order].sum()
triangles = array(primitive['indices'], 1).reshape(-1, 3)
surface = np.cross(positions[triangles[:, 1]] - positions[triangles[:, 0]], positions[triangles[:, 2]] - positions[triangles[:, 0]])
normals = np.zeros_like(positions)
for corner in range(3):
    np.add.at(normals, triangles[:, corner], surface)
_, weld = np.unique(np.round(positions, 5), axis=0, return_inverse=True)
sums = np.zeros((weld.max() + 1, 3)); np.add.at(sums, weld, normals)
normals = sums[weld]; normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
array(attributes['NORMAL'], 3)[:] = normals
for name, values in [('POSITION', positions), ('NORMAL', normals), ('JOINTS_0', joints), ('WEIGHTS_0', weights)]:
    doc['accessors'][attributes[name]].update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
doc['extras']['fittedWaistVersion'] = 1
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
                       + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                       + struct.pack('<II', len(binary), 0x004e4942) + binary)
print('Written', args.output)
