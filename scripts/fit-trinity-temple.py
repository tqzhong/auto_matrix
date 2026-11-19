"""Fit coverage beneath Trinity's existing swept hair cards without another draw."""
import argparse
import json
import math
from pathlib import Path
import struct

import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
raw = args.source.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + length])
binary = raw[28 + length:]
extras = doc['extras']
assert extras['character'] == 'trinity' and not extras.get('templeUndercoatVersion')


def array(accessor_index, width):
    accessor = doc['accessors'][accessor_index]
    view = doc['bufferViews'][accessor['bufferView']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']])
    return np.ndarray((accessor['count'], width), dtype, binary,
                      view.get('byteOffset', 0) + accessor.get('byteOffset', 0),
                      strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))


def primitive(name):
    return next(mesh for mesh in doc['meshes'] if mesh['name'] == name)['primitives'][0]


skin = primitive('Anatomical head and hands')
skin_points = array(skin['attributes']['POSITION'], 3)
skin_normals = array(skin['attributes']['NORMAL'], 3)
triangles = array(skin['indices'], 1).reshape(-1, 3)
triangles = triangles[skin_points[triangles, 1].max(axis=1) > extras['eye'][1] + .09]
face_points = skin_points[triangles]
edge_a, edge_b = face_points[:, 1] - face_points[:, 0], face_points[:, 2] - face_points[:, 0]
center = np.array([0, extras['eye'][1] + .045, .124])
relative = center - face_points[:, 0]
cross = np.cross(relative, edge_a)


def scalp(phi, theta):
    direction = np.array([math.sin(phi) * math.sin(theta), math.cos(theta), math.cos(phi) * math.sin(theta)])
    side = np.cross(direction, edge_b)
    determinant = (edge_a * side).sum(axis=1)
    valid = np.abs(determinant) > 1e-10
    reciprocal = np.divide(1, determinant, out=np.zeros_like(determinant), where=valid)
    u = (relative * side).sum(axis=1) * reciprocal
    v = (cross @ direction) * reciprocal
    distance = (edge_b * cross).sum(axis=1) * reciprocal
    hits = np.flatnonzero(valid & (u >= 0) & (v >= 0) & (u + v <= 1) & (distance > 0))
    assert len(hits), f'No scalp surface at {phi}, {theta}'
    index = hits[np.argmax(distance[hits])]
    weights = [1 - u[index] - v[index], u[index], v[index]]
    normal = weights @ skin_normals[triangles[index]]
    return center + direction * distance[index], normal / np.linalg.norm(normal), direction


hair = primitive('short04')
attrs = hair['attributes']
first = doc['accessors'][attrs['POSITION']]['count']
columns, rows = 28, 16
positions, normals, uv, faces = [], [], [], []
for col, phi in enumerate(np.linspace(.28, 1.28, columns + 1)):
    # Tuck the upper and side ends into the existing sweep. Lower the edge
    # across the temple gap, leaving the forehead and the ear under the cards.
    rim = extras['eye'][1] + np.interp(phi, [.28, .4, .58, .72, .86, 1.02, 1.28],
                                     [.200, .179, .166, .144, .142, .125, .120])
    lo, hi = .35, 1.55
    for _ in range(16):
        mid = (lo + hi) / 2
        if scalp(phi, mid)[0][1] > rim:
            lo = mid
        else:
            hi = mid
    for row, theta in enumerate(np.linspace(.35, (lo + hi) / 2, rows + 1)):
        point, normal, direction = scalp(phi, theta)
        positions.append(point + direction * .005)
        normals.append(normal)
        # Sample the opaque core of the original 2048² atlas.
        uv.append([(892 + 205 * col / columns) / 2048, (557 + 86 * row / rows) / 2048])
        if col and row:
            last = first + col * (rows + 1) + row
            a = last - rows - 2
            faces.extend([a, a + 1, last - 1, last - 1, a + 1, last])

joint = doc['skins'][0]['joints'].index(next(i for i, node in enumerate(doc['nodes']) if node['name'] == 'head'))
assert joint == 3, 'The temple must use the existing head joint'
updates = {}
for accessor, values, width in [
    (attrs['POSITION'], positions, 3), (attrs['NORMAL'], normals, 3), (attrs['TEXCOORD_0'], uv, 2),
    (attrs['JOINTS_0'], [[joint, 0, 0, 0]] * len(positions), 4),
    (attrs['WEIGHTS_0'], [[1, 0, 0, 0]] * len(positions), 4),
    (hair['indices'], np.array(faces).reshape(-1, 1), 1),
]:
    old = array(accessor, width)
    data = np.concatenate([old, np.asarray(values, dtype=old.dtype)])
    record = doc['accessors'][accessor]
    record.update(count=len(data), min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
    updates[record['bufferView']] = data.tobytes()

output = bytearray()
end = 0
for index, view in sorted(enumerate(doc['bufferViews']), key=lambda item: item[1]['byteOffset']):
    offset, size = view['byteOffset'], view['byteLength']
    output.extend(binary[end:offset])
    payload = updates.get(index, binary[offset:offset + size])
    view.update(byteOffset=len(output), byteLength=len(payload))
    output.extend(payload)
    end = offset + size
output.extend(binary[end:])
extras['templeUndercoatVersion'] = 1
doc['buffers'][0]['byteLength'] = len(output)
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(output))
                        + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                        + struct.pack('<II', len(output), 0x004e4942) + output)
print(f'{len(positions)} temple vertices and {len(faces) // 3} triangles added to short04')
