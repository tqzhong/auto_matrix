"""Rebind Neo's tracking sleeves to the adjacent arm in the exported bind pose.

The source clothing proxy transfers some cuff weights from the chest. Doing
the final transfer after fitting/posing keeps the cuff with the biceps. Only
the shirt's joint indices/weights change; geometry and patient skin are kept.
"""
import argparse
import json
from pathlib import Path
import struct

import numpy as np

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=root / 'packages/client/public/assets/characters/neo-tracking.glb')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
data = args.source.read_bytes(); length = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
if doc['extras'].get('fittedSleevesVersion'):
    raise RuntimeError('Use the tracking builder output before this sleeve pass, not its output.')


def array(index, width):
    accessor = doc['accessors'][index]; view = doc['bufferViews'][accessor['bufferView']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']])
    return np.ndarray((accessor['count'], width), dtype, binary,
                      view.get('byteOffset', 0) + accessor.get('byteOffset', 0),
                      strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))


names = [doc['nodes'][index]['name'] for index in doc['skins'][0]['joints']]
shirt = next(m for m in doc['meshes'] if m['name'] == 'Tracking shirt')['primitives'][0]['attributes']
body = next(m for m in doc['meshes'] if m['name'] == 'Patient body')['primitives'][0]['attributes']
positions = array(shirt['POSITION'], 3); body_positions = array(body['POSITION'], 3)
joints = array(shirt['JOINTS_0'], 4); weights = array(shirt['WEIGHTS_0'], 4)
body_joints = array(body['JOINTS_0'], 4); body_weights = array(body['WEIGHTS_0'], 4)
body_influence = np.zeros((len(body_positions), len(names)))
for slot in range(4):
    np.add.at(body_influence, (np.arange(len(body_positions)), body_joints[:, slot]), body_weights[:, slot])

shoulders = [names.index('shoulder_' + side) for side in ['L', 'R']]
for index in np.flatnonzero((positions[:, 1] > 3.05) & (positions[:, 1] < 3.48)):
    distance = ((body_positions - positions[index]) ** 2).sum(axis=1)
    nearest = np.argpartition(distance, 4)[:4]
    blend = 1 / np.maximum(distance[nearest], 1e-6); blend /= blend.sum()
    adjacent = (body_influence[nearest] * blend[:, None]).sum(axis=0)
    # Classify the fitted surface, not the faulty proxy weights: some outer
    # cuff vertices were mostly bound to the chest despite lying over biceps.
    # Fade into the chest/shoulder blend and leave the neckline/hem unchanged.
    amount = np.clip((adjacent[shoulders].sum() - .5) / .3, 0, 1)
    amount = amount * amount * (3 - 2 * amount)
    edge = np.clip((positions[index, 1] - 3.38) / .1, 0, 1)
    amount *= 1 - edge * edge * (3 - 2 * edge)
    edge = np.clip((positions[index, 1] - 3.05) / .1, 0, 1)
    amount *= edge * edge * (3 - 2 * edge)
    if amount == 0:
        continue
    influence = np.bincount(joints[index], weights=weights[index], minlength=len(names)) * (1 - amount) + adjacent * amount
    order = np.argsort(influence)[-4:][::-1]
    joints[index] = order; weights[index] = influence[order] / influence[order].sum()

for name, values in [('JOINTS_0', joints), ('WEIGHTS_0', weights)]:
    doc['accessors'][shirt[name]].update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
doc['extras']['fittedSleevesVersion'] = 1
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
                       + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                       + struct.pack('<II', len(binary), 0x004e4942) + binary)
print('Written', args.output)
