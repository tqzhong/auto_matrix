"""Replace overlapping dojo neck skin with the delivered head's complement.

Reconstruct the pinned CC0 anatomy, sharing its boundary positions, skin
weights and normals with the finished head. No per-frame seam solver or new
texture is required. Existing face, hand, foot and costume buffers stay intact.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('character_builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def build(source, character, output):
    original = character.read_bytes(); length = struct.unpack_from('<I', original, 12)[0]
    doc = json.loads(original[20:20 + length]); binary = bytearray(original[28 + length:])
    metadata = doc['extras']; role = metadata['character']
    assert role in ['neo', 'morpheus'] and metadata['sourceRevision'] == builder.REVISION
    assert metadata.get('dojoCostumeVersion') == 1 and 'dojoNeckVersion' not in metadata
    assert not output.exists(), 'Review a fresh staging destination.'
    files = ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [name + '.target' for name in metadata['targets']]
    hashes = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in files}
    assert all(value == metadata['dojoCostumeSource'][name] for name, value in hashes.items()), 'Source anatomy differs from the delivered costume.'

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]; size = np.dtype(dtype).itemsize
        return np.ndarray((item['count'], width), dtype, binary,
                          view.get('byteOffset', 0) + item.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * size), size)).copy()

    skin = doc['skins'][0]; names = [doc['nodes'][node]['name'].replace('_', '.') for node in skin['joints']]
    assert len(names) == 46
    rest = np.linalg.inv(array(skin['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1))[:, :3, 3]
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, weight in metadata['targets'].items():
        for line in (source / (name + '.target')).read_text().splitlines():
            values = line.split()
            if len(values) == 4 and not line.startswith('#'):
                base[int(values[0])] += np.array([float(value) for value in values[1:]]) * weight
    rig = json.loads((source / 'default.mhskel').read_text())

    def pivot(name):
        return base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)

    pivots = np.zeros_like(rest)
    pivots[:4] = [(pivot('upperleg01.L') + pivot('upperleg01.R')) / 2, pivot('spine03'), pivot('spine01'), pivot('head')]
    for i, name in enumerate(names[4:], 4):
        prefix, side = name.split('.')
        reference = {'shoulder': 'upperarm01', 'elbow': 'lowerarm01', 'hip': 'upperleg01', 'knee': 'lowerleg01', 'ankle': 'foot'}.get(prefix, prefix)
        pivots[i] = pivot(reference + '.' + side)

    def mapped(name):
        if name in names:
            return names.index(name)
        side = '.' + name.split('.')[-1]
        for prefix, target in [('upperarm', 'shoulder'), ('lowerarm', 'elbow'), ('metacarpal', 'wrist'), ('upperleg', 'hip'), ('lowerleg', 'knee'), ('toe', 'ankle'), ('foot', 'ankle')]:
            if name.startswith(prefix):
                return names.index(target + side)
        if name.startswith(('neck', 'jaw', 'special', 'eye', 'tongue', 'levator', 'orbicularis', 'oris', 'temporalis', 'oculi', 'risorius')):
            return 3
        if name in ('spine03', 'spine04'):
            return 1
        return 2 if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')) else 0

    weights = np.zeros((len(base), len(names)))
    for name, entries in json.loads((source / 'default_weights.mhw').read_text())['weights'].items():
        for vertex, weight in entries:
            weights[vertex, mapped(name)] += weight
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
    rotations = np.tile(np.eye(3), (len(names), 1, 1))
    for side in ['R', 'L']:
        sign = 1 if side == 'L' else -1
        for start, end, direction in [('shoulder', 'elbow', [sign * .08, -1, .02]), ('elbow', 'wrist', [sign * .04, -1, .05])]:
            a, b = [names.index(part + '.' + side) for part in [start, end]]
            rotations[a] = builder.align(pivots[b] - pivots[a], np.array(direction))
        for i, name in enumerate(names):
            if name.startswith(('wrist', 'finger')) and name.endswith(side):
                rotations[i] = rotations[names.index('elbow.' + side)]

    hands = [i for i, name in enumerate(names) if name.startswith(('wrist', 'finger'))]
    neckline = pivot('neck01')[1] - .08
    # The original head already includes the complete upper neck. Complement
    # its source polygons before subdivision to retain the same boundary ring.
    body = [face for face, group in zip(faces, groups) if group == 'body'
            and np.mean(base[[i for i, _ in face], 1]) <= neckline - .85
            and np.mean(weights[[i for i, _ in face]][:, hands].sum(axis=1)) <= .85]
    vertices, uv, polygons, influence = builder.subdivide(base, uv, body, weights)
    points = np.zeros_like(vertices)
    for i in range(len(names)):
        points += ((vertices - pivots[i]) @ rotations[i].T * metadata['sourceScale'] + rest[i]) * influence[:, i:i + 1]
    points, uv, polygons, influence = builder.trim_neckline(points, uv, polygons, influence, 3.03, above=True)
    pairs, lookup, indices = [], {}, []
    for face in polygons:
        for j in range(1, len(face) - 1):
            for pair in [face[0], face[j], face[j + 1]]:
                key = (pair[0], *np.round(uv[pair[1]], 7))
                if key not in lookup:
                    lookup[key] = len(pairs); pairs.append(pair)
                indices.append(lookup[key])
    vi, ui = np.array(pairs).T
    points = points[vi]; texcoords = uv[ui].copy(); texcoords[:, 1] = 1 - texcoords[:, 1]
    joints = np.argsort(-influence[vi], axis=1)[:, :4]
    sw = np.take_along_axis(influence[vi], joints, axis=1); sw /= sw.sum(axis=1, keepdims=True)
    normals = np.zeros_like(points)
    for a, b, c in np.array(indices).reshape(-1, 3):
        normals[[a, b, c]] += np.cross(points[b] - points[a], points[c] - points[a])
    _, welded = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    smooth = np.zeros((welded.max() + 1, 3)); np.add.at(smooth, welded, normals); normals = smooth[welded]
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
    head = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Anatomical head and hands')['primitives'][0]
    attrs = head['attributes']; hp = array(attrs['POSITION'], 3); hn = array(attrs['NORMAL'], 3)
    hj = array(attrs['JOINTS_0'], 4); hw = array(attrs['WEIGHTS_0'], 4)
    rim = np.flatnonzero((hp[:, 1] > 3) & (hp[:, 1] <= points[:, 1].max() + 1e-5))
    joined = []
    for i, point in enumerate(points):
        distance = np.linalg.norm(hp[rim] - point, axis=1); closest = distance.argmin()
        if distance[closest] < 1e-5:
            joined.append((i, rim[closest]))
    assert len(joined) >= 120, f'{role}: only {len(joined)} vertices meet the finished head.'
    own, other = np.array(joined).T
    points[own] = hp[other]; joints[own] = hj[other]; sw[own] = hw[other]
    distance = np.linalg.norm(points[:, None] - points[own][None], axis=2)
    nearest = distance.argmin(axis=1); blend = np.clip(1 - distance.min(axis=1) / .1, 0, 1)
    normals = normals * (1 - blend[:, None]) + hn[other[nearest]] * blend[:, None]
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
    normals[own] = hn[other]

    # Feet were exported first. Restrict the existing accessors to those exact
    # vertices/indices, retaining their binding, maps, normal and sole contact.
    old = next(mesh for mesh in doc['meshes'] if mesh['name'] == role + '-dojo-skin')['primitives'][0]
    old_points = array(old['attributes']['POSITION'], 3); old_indices = array(old['indices'], 1).ravel()
    feet = np.flatnonzero(old_points[:, 1] < .5); foot_indices = old_indices[old_points[old_indices, 1] < .5]
    assert np.array_equal(feet, np.arange(len(feet))) and np.array_equal(foot_indices, old_indices[:len(foot_indices)])
    for name, accessor_id in old['attributes'].items():
        item = doc['accessors'][accessor_id]; width = {'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[item['type']]
        values = array(accessor_id, width)[:len(feet)]
        item.update(count=len(feet), min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    doc['accessors'][old['indices']].update(count=len(foot_indices), min=[int(foot_indices.min())], max=[int(foot_indices.max())])

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    attrs = {'POSITION': accessor(points, 'VEC3'), 'NORMAL': accessor(normals, 'VEC3'), 'TEXCOORD_0': accessor(texcoords, 'VEC2'),
             'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
    material = copy.deepcopy(doc['materials'][head['material']]); material['name'] = role + '-dojo-neck'
    material.pop('normalTexture', None)  # The finished facial normal atlas has different UVs.
    material['pbrMetallicRoughness']['baseColorTexture'] = copy.deepcopy(doc['materials'][old['material']]['pbrMetallicRoughness']['baseColorTexture'])
    # Read existing pixels to recover the tone calibration applied by the head
    # finisher. Keep both bitmaps intact; this gain is applied once at loading.
    def sample(material, coords):
        texture = material['pbrMetallicRoughness']['baseColorTexture']['index']
        image = doc['images'][doc['textures'][texture]['source']]['uri']
        path = character.parent / image; hashes[image] = hashlib.sha256(path.read_bytes()).hexdigest()
        pixels = np.asarray(Image.open(path).convert('RGB'))
        xy = coords * np.array([pixels.shape[1], pixels.shape[0]]) - .5
        ij = np.floor(xy).astype(int); fraction = xy - ij
        colors = np.zeros((len(coords), 3))
        for x, y in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            values = pixels[np.clip(ij[:, 1] + y, 0, pixels.shape[0] - 1), np.clip(ij[:, 0] + x, 0, pixels.shape[1] - 1)] / 255
            values = np.where(values <= .04045, values / 12.92, ((values + .055) / 1.055) ** 2.4)
            colors += values * (fraction[:, 0] if x else 1 - fraction[:, 0])[:, None] * (fraction[:, 1] if y else 1 - fraction[:, 1])[:, None]
        return colors

    reference = sample(doc['materials'][head['material']], array(head['attributes']['TEXCOORD_0'], 2)[other])
    stock = sample(material, texcoords[own])
    gain = np.median(reference / np.maximum(stock, .0001), axis=0)
    material['extras'] = {'dojoSkinColorGain': gain.tolist()}
    material_index = len(doc['materials']); doc['materials'].append(material)
    name = role + '-dojo-neck'; mesh = len(doc['meshes'])
    doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material_index}]})
    doc['scenes'][doc.get('scene', 0)]['nodes'].append(len(doc['nodes']))
    doc['nodes'].append({'name': name, 'mesh': mesh, 'skin': 0, 'extras': {'dojoCostume': True, 'dojoSkin': True}})
    metadata.update(dojoNeckVersion=1, dojoNeckOriginalSha256=hashlib.sha256(original).hexdigest(), dojoNeckSource=hashes)
    assert binary[:len(original[28 + length:])] == original[28 + length:], 'Existing face, hands and feet must remain byte-for-byte intact.'
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4)); output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)))
        file.write(struct.pack('<II', len(encoded), 0x4E4F534A)); file.write(encoded)
        file.write(struct.pack('<II', len(binary), 0x004E4942)); file.write(binary)
    print(json.dumps({'role': role, 'vertices': len(points), 'triangles': len(indices) // 3, 'joinedVertices': len(joined),
                      'preservedFootVertices': len(feet), 'preservedFootTriangles': len(foot_indices) // 3,
                      'removedDuplicateTriangles': (len(old_indices) - len(foot_indices)) // 3,
                      'skinColorGain': gain.tolist(), 'originalBinaryPreserved': True, 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--character', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    build(args.source, args.character, args.output)
