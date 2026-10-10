"""Add Hammer/Logos crew-neck costumes to finished character GLBs.

Uses the same pinned CC0 body, morphs and 46-joint bind pose as the delivered
character. The face, original wardrobe and existing binary buffers stay intact.
Python/numpy are authoring dependencies only. Review --output before shipping.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('character_builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def surface_normals(points, faces):
    normals = np.zeros_like(points)
    for face in faces:
        ids = [i for i, _ in face]
        for j in range(1, len(ids) - 1):
            a, b, c = ids[0], ids[j], ids[j + 1]
            normal = np.cross(points[b] - points[a], points[c] - points[a])
            normals[[a, b, c]] += normal
    return normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)


def build(source, character, output):
    data = character.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
    metadata = doc['extras']
    role = metadata['character']
    assert role in ['morpheus', 'neo', 'trinity'] and metadata.get('skinBaked')
    assert metadata['sourceRevision'] == builder.REVISION
    version = 'hammerKnit' if role == 'morpheus' else 'logosKnit'
    assert version + 'Version' not in metadata, 'Use the finished original, not an already dressed character.'
    assert not output.exists(), 'Review in a fresh staging file; never overwrite an earlier candidate.'

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]
        size = np.dtype(dtype).itemsize
        return np.ndarray((item['count'], width), dtype, binary,
                          view.get('byteOffset', 0) + item.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * size), size)).copy()

    skin = doc['skins'][0]
    names = [doc['nodes'][node]['name'].replace('_', '.') for node in skin['joints']]
    assert len(names) == 46
    rest = np.linalg.inv(array(skin['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1))[:, :3, 3]
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    source_hashes = {}
    for name in ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [target + '.target' for target in metadata['targets']]:
        source_hashes[name] = hashlib.sha256((source / name).read_bytes()).hexdigest()
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
        for start, end in [('shoulder', 'elbow'), ('elbow', 'wrist'), ('hip', 'knee'), ('knee', 'ankle')]:
            a, b = [names.index(part + '.' + side) for part in [start, end]]
            rotations[a] = builder.align(pivots[b] - pivots[a], rest[b] - rest[a])
        wrist = names.index('wrist.' + side)
        rotations[wrist] = rotations[names.index('elbow.' + side)]
        for i, name in enumerate(names):
            if name.startswith('finger') and name.endswith(side):
                rotations[i] = rotations[wrist]
    points = np.zeros_like(base)
    for i in range(len(names)):
        points += ((base - pivots[i]) @ rotations[i].T * metadata['sourceScale'] + rest[i]) * weights[:, i:i + 1]
    faces = [face for face, group in zip(faces, groups) if group == 'body']
    points, uv, faces, weights = builder.subdivide(points, uv, faces, weights)
    normals = surface_normals(points, faces)
    arms = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]
    arm = weights[:, arms].sum(axis=1)
    # A loose, closed body follows the actual anatomy without copying a jacket's
    # lapels or outlining every chest muscle. The wrists retain their own sleeve.
    cloth = points + normals * .035
    neckline = 3.91 if role == 'morpheus' else rest[3, 1] - .225
    trunk = (1 - np.clip(arm / .45, 0, 1)) * np.clip((neckline - .05 - points[:, 1]) / .2, 0, 1)
    cloth[:, 0] *= 1 + trunk * .07
    cloth[:, 2] *= 1 + trunk * .08
    cloth[:, 2] += np.maximum(normals[:, 2], 0) * trunk * (.008 * np.sin(points[:, 1] * 25 + points[:, 0] * 7))
    delivered = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Anatomical head and hands')['primitives'][0]['attributes']
    hand_points = array(delivered['POSITION'], 3)
    hand_joints, hand_weights = array(delivered['JOINTS_0'], 4), array(delivered['WEIGHTS_0'], 4)
    hand_tops = []
    for side in ['R', 'L']:
        family = [i for i, name in enumerate(names) if name.startswith(('wrist', 'finger')) and name.endswith('.' + side)]
        influence = np.where(np.isin(hand_joints, family), hand_weights, 0).sum(axis=1)
        hand_tops.append(hand_points[influence > .5, 1].max())
    # The finished hand mesh stops below the anatomical wrist pivot. Cover its
    # real edge with a short overlap, including when the palm turns during speech.
    cuff = min(hand_tops) - .04
    hem = np.where(arm > .4, cuff, 2.38 if role == 'morpheus' else metadata['waist'][1] - .095)

    def neck(points):
        front = np.clip((points[:, 2] - .04) / .20, 0, 1)
        return neckline - .105 * front * np.exp(-(points[:, 0] / .30) ** 4)

    garment, texcoords, polygons, influence = builder.trim_neckline(cloth, uv, faces, weights, hem, above=True)
    garment, texcoords, polygons, influence = builder.trim_neckline(garment, texcoords, polygons, influence, neck(garment))
    # The inner shirt is just a neck strip. Its lower edge is hidden by knit;
    # it cannot recreate the old white triangles across the chest.
    inner = points + normals * .017
    collar, collar_uv, collar_faces, collar_weights = builder.trim_neckline(inner, uv, faces, weights, neck(inner) - .022, above=True)
    collar, collar_uv, collar_faces, collar_weights = builder.trim_neckline(collar, collar_uv, collar_faces, collar_weights, neck(collar) + .032)

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    def export(name, points, uv, faces, weights, color):
        normals = surface_normals(points, faces)
        # Give open neck/cuff/hem boundaries a visible, skinned inner thickness.
        edges = {}
        for face in faces:
            for a, b in zip(face, face[1:] + face[:1]):
                key = tuple(sorted((a[0], b[0])))
                edges.setdefault(key, []).append((a, b))
        values, texcoords, influence = list(points), list(uv), list(weights)
        polygons = list(faces); inset = {}
        for adjacent in edges.values():
            if len(adjacent) != 1:
                continue
            a, b = adjacent[0]
            for i, u in [a, b]:
                if i not in inset:
                    inset[i] = len(values)
                    values.append(points[i] - normals[i] * .012); influence.append(weights[i])
            polygons.append([b, a, (inset[a[0]], a[1]), (inset[b[0]], b[1])])
        points, weights = np.array(values), np.array(influence)
        normals = surface_normals(points, polygons)
        pairs, lookup, indices = [], {}, []
        for face in polygons:
            for j in range(1, len(face) - 1):
                for pair in [face[0], face[j], face[j + 1]]:
                    key = (pair[0], *np.round(uv[pair[1]], 7))
                    if key not in lookup:
                        lookup[key] = len(pairs); pairs.append(pair)
                    indices.append(lookup[key])
        vertices, texture = np.array(pairs).T
        joints = np.argsort(-weights[vertices], axis=1)[:, :4]
        sw = np.take_along_axis(weights[vertices], joints, axis=1); sw /= sw.sum(axis=1, keepdims=True)
        texcoords = np.array(texcoords)[texture]; texcoords[:, 1] = 1 - texcoords[:, 1]
        attrs = {'POSITION': accessor(points[vertices], 'VEC3'), 'NORMAL': accessor(normals[vertices], 'VEC3'),
                 'TEXCOORD_0': accessor(texcoords, 'VEC2'), 'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
        material = len(doc['materials'])
        doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'roughnessFactor': .97, 'metallicFactor': 0}, 'doubleSided': True})
        index = len(doc['meshes'])
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material}]})
        doc['scenes'][doc.get('scene', 0)]['nodes'].append(len(doc['nodes']))
        costume = 'hammerBriefingCostume' if role == 'morpheus' else 'logosCostume'
        doc['nodes'].append({'name': name, 'mesh': index, 'skin': 0, 'extras': {costume: True}})
        return {'vertices': len(vertices), 'triangles': len(indices) // 3}

    name = role + ('-hammer' if role == 'morpheus' else '-logos')
    colors = {'morpheus': ([.091, .034, .047], [.386, .361, .301]),
              'neo': ([.0395, .0545, .0802], [.0865, .0931, .1022]),
              'trinity': ([.3813, .3763, .3231], [.3813, .3763, .3231])}
    upper_color, collar_color = colors[role]
    meshes = {'sweater': export(name + '-sweater', garment, texcoords, polygons, influence, upper_color),
              'collar': export(name + '-collar', collar, collar_uv, collar_faces, collar_weights, collar_color)}
    metadata.update({version + 'Version': 2, version + 'OriginalSha256': hashlib.sha256(data).hexdigest(), version + 'Source': source_hashes})
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                   + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                   + struct.pack('<II', len(binary), 0x004E4942) + binary)
    print(json.dumps({'output': str(output), 'meshes': meshes, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path, help='Cached pinned MakeHuman body, rig, weights and character targets')
    parser.add_argument('--character', type=Path, default=ROOT / 'packages/client/public/assets/characters/morpheus.glb')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    build(args.source, args.character, args.output)
