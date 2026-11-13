"""Add speech shapes to the delivered Smith using Neo's registered oral anatomy.

Both characters retain the same anatomical UVs. Use those to transfer the
existing MakeHuman jaw weights and fit the CC0 teeth and tongue to Smith.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import runpy
import struct

import numpy as np

normals = runpy.run_path(Path(__file__).with_name('build-neo-mouth.py'))['normals']


def read_glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    return doc, raw[28 + size:28 + size + doc['buffers'][0]['byteLength']]


def read(doc, binary, index):
    accessor = doc['accessors'][index]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]

    def block(view, count, width, component, offset=0):
        buffer = doc['bufferViews'][view]
        dtype = np.dtype({5123: '<u2', 5125: '<u4', 5126: '<f4'}[component])
        return np.ndarray((count, width), dtype, buffer=binary, offset=buffer.get('byteOffset', 0) + offset,
                          strides=(buffer.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()

    count, component = accessor['count'], accessor['componentType']
    values = block(accessor['bufferView'], count, width, component, accessor.get('byteOffset', 0)) if 'bufferView' in accessor else np.zeros((count, width))
    if sparse := accessor.get('sparse'):
        indices, data = sparse['indices'], sparse['values']
        ids = block(indices['bufferView'], sparse['count'], 1, indices['componentType'], indices.get('byteOffset', 0)).ravel()
        values[ids] = block(data['bufferView'], sparse['count'], width, component, data.get('byteOffset', 0))
    return values


def smooth(value):
    t = np.clip(value, 0, 1)
    return t * t * (3 - 2 * t)


def main(neutral, donor, output):
    doc, original = read_glb(neutral)
    source, source_binary = read_glb(donor)
    assert doc['extras']['character'] == 'smith' and 'smithSpeechVersion' not in doc['extras']
    assert source['extras']['character'] == 'neo' and source['extras']['sourceRevision'] == doc['extras']['sourceRevision']
    binary = bytearray(original)

    def view(values):
        binary.extend(b'\0' * (-len(binary) % 4))
        index = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        return index

    def append(values, indices=False, sparse=False):
        values = np.asarray(values, dtype='<u4' if indices else '<f4')
        kind = 'SCALAR' if indices else 'VEC3'
        accessor = {'count': len(values), 'type': kind, 'componentType': 5125 if indices else 5126,
                    'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()}
        if sparse:
            used = np.flatnonzero(np.any(values != 0, axis=1)).astype('<u2')
            assert len(values) < 65536 and len(used)
            accessor['sparse'] = {'count': len(used), 'indices': {'bufferView': view(used), 'componentType': 5123},
                                  'values': {'bufferView': view(values[used])}}
        else:
            accessor['bufferView'] = view(values)
        doc['accessors'].append(accessor)
        return len(doc['accessors']) - 1

    def anatomical(document):
        return next(mesh for mesh in document['meshes'] if mesh['name'] == 'Anatomical head and hands')

    mesh = anatomical(doc)
    primitive = mesh['primitives'][0]
    a, b = primitive['attributes'], anatomical(source)['primitives'][0]['attributes']
    assert not primitive.get('targets')
    source_read = lambda index: read(source, source_binary, index)
    target_read = lambda index: read(doc, binary, index)
    positions = target_read(a['POSITION']).astype(float)
    donor_positions = source_read(b['POSITION']).astype(float)
    uv = lambda values: np.rint(values * 1e6).astype(int)
    donor_uv, target_uv = uv(source_read(b['TEXCOORD_0'])), uv(target_read(a['TEXCOORD_0']))
    matching = defaultdict(list)
    for i, point in enumerate(donor_uv):
        matching[tuple(point)].append(i)
    head_indices = np.flatnonzero(positions[:, 1] > 3.6)
    registered = np.array([min(matching[tuple(target_uv[i])], key=lambda j: np.linalg.norm(donor_positions[j] - positions[i])) for i in head_indices])
    jaw = np.zeros(len(positions))
    jaw[head_indices] = source_read(b['_JAW_WEIGHT'])[registered, 0]
    matched = donor_positions[registered]
    x, y, z = matched.T
    mouth = (y > 3.77) & (y < 4.035) & (z > .235) & (np.abs(x) < .17)
    source_mouth = np.column_stack((matched[mouth], np.ones(mouth.sum())))
    fit = np.linalg.lstsq(source_mouth, positions[head_indices[mouth]], rcond=None)[0]
    rms = np.linalg.norm(source_mouth @ fit - positions[head_indices[mouth]]) / np.sqrt(mouth.sum())
    assert rms < .012 and np.linalg.det(fit[:3]) > .8
    hinge = np.r_[source['extras']['jawPivot'], 1] @ fit
    angle = .29
    c, s = np.cos(angle), np.sin(angle)
    rotation = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    sx, sy, sz = positions.T
    # Smith's fitted lip corners are tight. Blend into their fixed commissures
    # before rotating the lower lip, so the inner fold stays continuous.
    corner = (1 - smooth((np.abs(np.abs(sx) - .058) - .004) / .04)) * smooth((sy - 3.924) / .017)
    corner *= smooth((3.977 - sy) / .019) * smooth((sz - .33) / .032)
    jaw *= 1 - .84 * corner
    opening = ((positions - hinge) @ rotation.T + hinge - positions) * jaw[:, None]

    # Rounded vowels move only the lip contours. A negative amount spreads them.
    lips = np.zeros(len(positions))
    lips[head_indices] = smooth((y - 3.913) / .018) * smooth((3.981 - y) / .014) * smooth((z - .34) / .025) * smooth((.104 - np.abs(x)) / .028)
    rounding = np.column_stack((-positions[:, 0] * .22, np.zeros(len(positions)), np.full(len(positions), .009))) * lips[:, None]
    triangles = target_read(primitive['indices']).reshape(-1, 3)
    normals_at = lambda p: np.cross(p[triangles[:, 1]] - p[triangles[:, 0]], p[triangles[:, 2]] - p[triangles[:, 0]])
    rest_faces = normals_at(positions)
    for opened in np.linspace(0, .86, 12):
        for rounded in (-.48, 0, .85):
            posed_faces = normals_at(positions + opened * opening + rounded * rounding)
            assert np.all(np.einsum('ij,ij->i', rest_faces, posed_faces) >= -1e-15), 'Speech folds the lip surface.'
    rest_normals = normals(positions, triangles)
    primitive['targets'] = []
    for delta in [opening, rounding]:
        moved = normals(positions + delta, triangles) - rest_normals
        primitive['targets'].append({'POSITION': append(delta, sparse=True), 'NORMAL': append(moved, sparse=True)})
    mesh.update(weights=[0, 0], extras={**mesh.get('extras', {}), 'targetNames': ['jawOpen', 'mouthRound']})

    head = next(node for node in doc['nodes'] if node['name'] == 'head')
    head_position = np.asarray(doc['extras']['head'])

    def node(parent, entry):
        parent.setdefault('children', []).append(len(doc['nodes']))
        doc['nodes'].append(entry)
        return entry

    oral = node(head, {'name': 'smith-mouth'})
    mandible = node(oral, {'name': 'smith-jaw', 'translation': (hinge - head_position).tolist(), 'extras': {'openingAngle': angle}})
    for name in ['teeth-upper', 'teeth-lower', 'tongue']:
        original_mesh = next(mesh for mesh in source['meshes'] if mesh['name'] == 'neo-' + name)['primitives'][0]
        attributes = original_mesh['attributes']
        points = source_read(attributes['POSITION'])
        points = np.column_stack((points, np.ones(len(points)))) @ fit
        points[:, 2] -= .016
        faces = source_read(original_mesh['indices']).reshape(-1, 3)
        upper = name == 'teeth-upper'
        material = len(doc['materials'])
        doc['materials'].append({'name': 'Smith ' + name, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0,
                                 'roughnessFactor': .46 if name.startswith('teeth') else .73}})
        attrs = {'POSITION': append(points - (head_position if upper else hinge)), 'NORMAL': append(normals(points, faces)),
                 'COLOR_0': append(source_read(attributes['COLOR_0']) * .73)}
        node(oral if upper else mandible, {'name': 'smith-' + name, 'mesh': len(doc['meshes'])})
        doc['meshes'].append({'name': 'smith-' + name, 'primitives': [{'attributes': attrs, 'indices': append(faces.ravel(), indices=True), 'material': material}]})

    doc['extras'].update(smithSpeechVersion=1, smithSpeechNeutralSha256=hashlib.sha256(neutral.read_bytes()).hexdigest(),
                         smithSpeechDonorSha256=hashlib.sha256(donor.read_bytes()).hexdigest(), smithSpeechFitRms=float(rms))
    assert binary[:len(original)] == original
    binary.extend(b'\0' * (-len(binary) % 4))
    doc['buffers'][0]['byteLength'] = len(binary)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    output.write_bytes(struct.pack('<IIIII', 0x46546C67, 2, 28 + len(data) + len(binary), len(data), 0x4E4F534A)
                       + data + struct.pack('<II', len(binary), 0x004E4942) + binary)
    print(f'{len(head_indices)} registered vertices, oral fit RMS {rms:.5f}, added {output.stat().st_size - neutral.stat().st_size} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ('neutral', 'donor', 'output'):
        parser.add_argument('--' + arg, required=True, type=Path)
    args = parser.parse_args()
    main(args.neutral, args.donor, args.output)
