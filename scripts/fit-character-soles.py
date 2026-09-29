"""Keep the finished shoe soles rigid, with a soft transition at the ankle.

The MakeHuman proxy transfers shin weights onto the sole. Only shoe joint
indices/weights change; preserve the finished geometry, faces and materials.
Run once after the other character finishing passes, with Python/numpy.
"""
import argparse
import json
from pathlib import Path
import struct

import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
data = args.source.read_bytes(); length = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
if doc['extras'].get('fittedSolesVersion'):
    raise RuntimeError('Use the finished character before this sole pass, not its output.')


def array(index, width):
    accessor = doc['accessors'][index]; view = doc['bufferViews'][accessor['bufferView']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']])
    return np.ndarray((accessor['count'], width), dtype, binary,
                      view.get('byteOffset', 0) + accessor.get('byteOffset', 0),
                      strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))


node = next(node for node in doc['nodes'] if node.get('name') == 'shoes01')
skin = doc['skins'][node['skin']]
names = [doc['nodes'][index]['name'] for index in skin['joints']]
inverse = array(skin['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1)
attributes = doc['meshes'][node['mesh']]['primitives'][0]['attributes']
positions = array(attributes['POSITION'], 3)
joints = array(attributes['JOINTS_0'], 4); weights = array(attributes['WEIGHTS_0'], 4)
for index, point in enumerate(positions):
    ankle = names.index('ankle_' + ('L' if point[0] > 0 else 'R'))
    height = inverse[ankle, 1, :3] @ point + inverse[ankle, 1, 3]
    edge = np.clip(height / .12, 0, 1)
    amount = 1 - edge * edge * (3 - 2 * edge)
    if amount == 0:
        continue
    influence = np.bincount(joints[index], weights=weights[index], minlength=len(names)) * (1 - amount)
    influence[ankle] += amount
    order = np.argsort(influence)[-4:][::-1]
    joints[index] = order; weights[index] = influence[order] / influence[order].sum()

for name, values in [('JOINTS_0', joints), ('WEIGHTS_0', weights)]:
    doc['accessors'][attributes[name]].update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
doc['extras']['fittedSolesVersion'] = 1
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
                       + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                       + struct.pack('<II', len(binary), 0x004e4942) + binary)
print('Written', args.output)
