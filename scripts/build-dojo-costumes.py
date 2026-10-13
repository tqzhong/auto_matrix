"""Fit first-film dojo clothes to the delivered CC0 bodies and 46-joint rig.

Offline numpy authoring only. Existing faces, meshes, textures and binary data
are preserved; review a fresh --output before replacing a shipped character.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np

spec = importlib.util.spec_from_file_location('knit_builder', Path(__file__).with_name('build-morpheus-hammer-knit.py'))
knit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(knit)
builder = knit.builder


def build(source, character, output, skin_texture):
    original = character.read_bytes()
    length = struct.unpack_from('<I', original, 12)[0]
    doc = json.loads(original[20:20 + length]); binary = bytearray(original[28 + length:])
    metadata = doc['extras']; role = metadata['character']
    assert role in ['neo', 'morpheus'] and metadata['sourceRevision'] == builder.REVISION
    assert 'dojoCostumeVersion' not in metadata and not output.exists()
    assert skin_texture.is_file()

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
    sources = ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [name + '.target' for name in metadata['targets']]
    hashes = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in sources}
    for name, amount in metadata['targets'].items():
        for line in (source / (name + '.target')).read_text().splitlines():
            values = line.split()
            if len(values) == 4 and not line.startswith('#'):
                base[int(values[0])] += np.array([float(value) for value in values[1:]]) * amount
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
    normals = knit.surface_normals(points, faces)
    arm = weights[:, [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]].sum(axis=1)
    waist = metadata['waist'][1]
    cloth = points + normals * .065
    trunk = (1 - np.clip(arm / .45, 0, 1)) * np.clip((3.85 - points[:, 1]) / .25, 0, 1)
    cloth[:, 0] *= 1 + trunk * .12
    cloth[:, 2] *= 1 + trunk * .12
    # Extend the wrap below its sash; blend only the torso, leaving cuffs on wrists.
    hem_extension = np.clip((2.7 - points[:, 1]) / .32, 0, 1) * trunk * .19
    cloth[:, 2] += normals[:, 2] * hem_extension
    cloth[:, 0] += normals[:, 0] * hem_extension
    cloth[:, 2] += np.maximum(normals[:, 2], 0) * trunk * .009 * np.sin(points[:, 1] * 23 + points[:, 0] * 9)

    def neck(values):
        front = np.clip((values[:, 2] - .035) / .14, 0, 1)
        return 3.9 - front * np.maximum(0, .75 - np.abs(values[:, 0]) * 2.25)

    hem = np.where(arm > .4, 2.1, waist - .025)
    jacket = builder.trim_neckline(cloth, uv, faces, weights, hem, above=True)
    jacket = builder.trim_neckline(*jacket, neck(jacket[0]))
    garment, coords, polygons, influence = jacket
    sleeve = influence[:, [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]].sum(axis=1)
    skirt = np.clip((waist + .25 - garment[:, 1]) / .28, 0, 1) * (1 - np.clip(sleeve / .4, 0, 1))
    garment[:, 1] -= skirt * .44
    garment[:, 0] *= 1 + skirt * .15; garment[:, 2] *= 1 + skirt * .18
    influence *= (1 - skirt[:, None]); influence[:, 0] += skirt
    pants = points + normals * .075
    legs = weights[:, [i for i, name in enumerate(names) if name.startswith(('hip', 'knee', 'ankle'))]].sum(axis=1)
    pants[:, 0] += normals[:, 0] * legs * .04
    pant_faces = [face for face in faces if arm[[i for i, _ in face]].max() < .2]
    pants = builder.trim_neckline(pants, uv, pant_faces, weights, waist + .13)
    pants = builder.trim_neckline(*pants, .36, above=True)
    exposed = builder.trim_neckline(points, uv, faces, weights, .42)
    chest = builder.trim_neckline(points, uv, faces, weights, 3.03, above=True)
    chest = builder.trim_neckline(*chest, 3.9)

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    def export(part, surface, color=None):
        values, coords, polygons, influence = surface
        normals = knit.surface_normals(values, polygons)
        pairs, lookup, indices = [], {}, []
        for face in polygons:
            for j in range(1, len(face) - 1):
                for pair in [face[0], face[j], face[j + 1]]:
                    key = (pair[0], *np.round(coords[pair[1]], 7))
                    if key not in lookup:
                        lookup[key] = len(pairs); pairs.append(pair)
                    indices.append(lookup[key])
        vertices, texture = np.array(pairs).T
        joints = np.argsort(-influence[vertices], axis=1)[:, :4]
        sw = np.take_along_axis(influence[vertices], joints, axis=1); sw /= sw.sum(axis=1, keepdims=True)
        texcoords = coords[texture].copy(); texcoords[:, 1] = 1 - texcoords[:, 1]
        attrs = {'POSITION': accessor(values[vertices], 'VEC3'), 'NORMAL': accessor(normals[vertices], 'VEC3'),
                 'TEXCOORD_0': accessor(texcoords, 'VEC2'), 'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
        material = body_material
        if color is not None:
            material = len(doc['materials'])
            doc['materials'].append({'name': role + '-dojo-' + part, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'roughnessFactor': .96, 'metallicFactor': 0}, 'doubleSided': True})
        index = len(doc['meshes']); name = role + '-dojo-' + part
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material}]})
        doc['scenes'][doc.get('scene', 0)]['nodes'].append(len(doc['nodes']))
        doc['nodes'].append({'name': name, 'mesh': index, 'skin': 0, 'extras': {'dojoCostume': True, 'dojoSkin': color is None}})
        return {'vertices': len(vertices), 'triangles': len(indices) // 3}

    # The contrasting collar follows the cut opening itself, including the
    # rounded back neck. Its weights come from those actual garment vertices.
    values, coords, polygons, influence = jacket
    edges = {}
    for face in polygons:
        for a, b in zip(face, face[1:] + face[:1]):
            edges.setdefault(tuple(sorted((a[0], b[0]))), []).append((a[0], b[0]))
    surface = knit.surface_normals(values, polygons)
    band_points, band_weights, band_uv, band_faces = [], [], [], []
    for adjacent in edges.values():
        if len(adjacent) != 1:
            continue
        a, b = adjacent[0]
        if min(values[[a, b], 1]) < 3.08 or max(abs(values[[a, b], 0])) > .4:
            continue
        start = len(band_points)
        for i in [a, b]:
            for column in range(2):
                point = values[i] + surface[i] * .009
                point[1] -= column * .075
                band_points.append(point); band_weights.append(influence[i]); band_uv.append([column, values[i, 1]])
        band_faces.append([(start, start), (start + 2, start + 2), (start + 3, start + 3), (start + 1, start + 1)])
    triangles = np.array([[face[0][0], face[j][0], face[j + 1][0]] for face in polygons for j in range(1, len(face) - 1)])
    arms = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]
    triangles = triangles[influence[triangles][:, :, arms].sum(axis=(1, 2)) < .2]

    def front(x, y):
        a, b, c = values[triangles[:, 0]], values[triangles[:, 1]], values[triangles[:, 2]]
        den = (b[:, 1] - c[:, 1]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 1] - c[:, 1])
        den = np.where(abs(den) < 1e-9, np.nan, den)
        u = ((b[:, 1] - c[:, 1]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (y - c[:, 1])) / den
        v = ((c[:, 1] - a[:, 1]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (y - c[:, 1])) / den
        w = 1 - u - v; z = u * a[:, 2] + v * b[:, 2] + w * c[:, 2]
        candidates = np.where((u >= -1e-5) & (v >= -1e-5) & (w >= -1e-5))[0]
        assert len(candidates), f'{role}: front cloth missing at {x},{y}'
        i = candidates[np.argmax(z[candidates])]; amounts = np.array([u[i], v[i], w[i]])
        return np.array([x, y, z[i] + .018]), (influence[triangles[i]] * amounts[:, None]).sum(axis=0)

    start = len(band_points)
    for row in range(17):
        t = row / 16; y = 3.12 - t * .58
        for column in range(3):
            point, weight = front(-t * .25 + (column / 2 - .5) * .06, y)
            band_points.append(point); band_weights.append(weight); band_uv.append([column / 2, t])
            if row < 16 and column < 2:
                a = start + row * 3 + column
                band_faces.append([(a, a), (a + 3, a + 3), (a + 4, a + 4), (a + 1, a + 1)])
    lapel = np.array(band_points), np.array(band_uv), band_faces, np.array(band_weights)
    belt_points, belt_uv, belt_faces, belt_weights = [], [], [], []
    for row in range(4):
        y = waist - .025 + (row / 3 - .5) * .13
        waist_triangles = triangles[(values[triangles, 1].min(axis=1) <= y) & (values[triangles, 1].max(axis=1) > y)]
        # Fitted oval sash, with a tied pair of folded ends at the front hip.
        for column in range(65):
            angle = column / 64 * np.pi * 2
            direction = np.array([np.sin(angle), np.cos(angle)])
            hits = []
            for triangle in waist_triangles:
                section = []
                for i, j in zip(triangle, np.roll(triangle, -1)):
                    a, b = values[i], values[j]
                    if (a[1] <= y < b[1]) or (b[1] <= y < a[1]):
                        t = (y - a[1]) / (b[1] - a[1])
                        section.append((a + (b - a) * t, influence[i] + (influence[j] - influence[i]) * t))
                if len(section) != 2:
                    continue
                a, aw = section[0]; b, bw = section[1]
                edge = b[[0, 2]] - a[[0, 2]]
                cross = direction[0] * edge[1] - direction[1] * edge[0]
                if abs(cross) < 1e-9:
                    continue
                along = (a[0] * edge[1] - a[2] * edge[0]) / cross
                t = (a[0] * direction[1] - a[2] * direction[0]) / cross
                if along > 0 and 0 <= t <= 1:
                    hits.append((along, aw + (bw - aw) * t))
            assert hits, f'{role}: sash misses wrap at {y},{angle}'
            along, weight = max(hits, key=lambda hit: hit[0]); radius = along + .018
            point = [direction[0] * radius, y, direction[1] * radius]
            belt_points.append(point); belt_uv.append([column / 64, row / 3])
            belt_weights.append(weight)
            if row < 3 and column < 64:
                a = row * 65 + column
                belt_faces.append([(a, a), (a + 65, a + 65), (a + 66, a + 66), (a + 1, a + 1)])
    for side in [-1, 1]:
        start = len(belt_points)
        for row in range(7):
            for column in range(3):
                t = row / 6; x = .13 + side * t * .15 + (column / 2 - .5) * .08
                point, weight = front(x, waist - t * .35); point[2] += .025 + np.sin(t * np.pi) * .015
                belt_points.append(point); belt_uv.append([column / 2, t]); belt_weights.append(weight)
                if row < 6 and column < 2:
                    a = start + row * 3 + column
                    belt_faces.append([(a, a), (a + 3, a + 3), (a + 4, a + 4), (a + 1, a + 1)])
    belt = np.array(belt_points), np.array(belt_uv), belt_faces, np.array(belt_weights)
    # Join feet and exposed chest without changing either UV layout.
    a, auv, af, aw = exposed; b, buv, bf, bw = chest
    exposed = np.vstack((a, b)), np.vstack((auv, buv)), af + [[(i + len(a), u + len(auv)) for i, u in face] for face in bf], np.vstack((aw, bw))
    pale, dark = [.68, .64, .49], [.016, .018, .027]
    # The finished face bake contains head/hands only. Use the full CC0 body
    # image for exposed chest and feet, preserving the existing actor face.
    image = len(doc['images']); doc['images'].append({'uri': skin_texture.name})
    texture = len(doc['textures']); doc['textures'].append({'source': image, 'sampler': 0})
    body_material = len(doc['materials'])
    doc['materials'].append({'name': role + '-dojo-body', 'pbrMetallicRoughness': {'baseColorFactor': [.94, .9, .87, 1],
        'baseColorTexture': {'index': texture}, 'roughnessFactor': .63, 'metallicFactor': 0}})
    cloth_color, edge_color = (pale, dark) if role == 'neo' else (dark, pale)
    meshes = {'jacket': export('jacket', jacket, cloth_color), 'lapel': export('lapel', lapel, edge_color),
              'belt': export('belt', belt, dark), 'trousers': export('trousers', pants, cloth_color), 'skin': export('skin', exposed)}
    hashes[skin_texture.name] = hashlib.sha256(skin_texture.read_bytes()).hexdigest()
    metadata.update(dojoCostumeVersion=1, dojoCostumeOriginalSha256=hashlib.sha256(original).hexdigest(), dojoCostumeSource=hashes)
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4)); output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                   + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary)
    print(json.dumps({'output': str(output), 'meshes': meshes, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--character', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--skin-texture', required=True, type=Path)
    args = parser.parse_args(); build(args.source, args.character, args.output, args.skin_texture)
