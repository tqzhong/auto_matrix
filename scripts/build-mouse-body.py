"""Author Mouse's independent 46-joint body and two first-film wardrobes.

Uses the pinned CC0 MakeHuman cache and the existing numpy authoring pipeline.
The face here is an anatomical fallback; likeness fitting is a separate asset.
No photograph, source movie frame or new runtime dependency is embedded.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile

import numpy as np

spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def normals(points, faces):
    result = np.zeros_like(points)
    for face in faces:
        ids = [i for i, _ in face]
        for j in range(1, len(ids) - 1):
            n = np.cross(points[ids[j]] - points[ids[0]], points[ids[j + 1]] - points[ids[0]])
            result[[ids[0], ids[j], ids[j + 1]]] += n
    return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-8)


def pack(doc, binary, mesh_ids, output):
    """Keep only the selected surfaces and their actually referenced buffers."""
    doc = copy.deepcopy(doc)
    materials = sorted({p['material'] for i in mesh_ids for p in doc['meshes'][i]['primitives']})
    accessors = {doc['skins'][0]['inverseBindMatrices']}
    for i in mesh_ids:
        for primitive in doc['meshes'][i]['primitives']:
            accessors.update(primitive['attributes'].values()); accessors.add(primitive['indices'])
    accessors = sorted(accessors)
    views = sorted({doc['accessors'][i]['bufferView'] for i in accessors})
    textures = sorted({doc['materials'][i]['pbrMetallicRoughness']['baseColorTexture']['index'] for i in materials
                       if 'baseColorTexture' in doc['materials'][i]['pbrMetallicRoughness']})
    images = sorted({doc['textures'][i]['source'] for i in textures})
    maps = {kind: {old: new for new, old in enumerate(values)} for kind, values in
            [('mesh', mesh_ids), ('material', materials), ('accessor', accessors), ('view', views), ('texture', textures), ('image', images)]}
    packed = bytearray(); new_views = []
    for i in views:
        view = dict(doc['bufferViews'][i]); start = view.get('byteOffset', 0)
        packed.extend(b'\x00' * (-len(packed) % 4)); view['byteOffset'] = len(packed)
        packed.extend(binary[start:start + view['byteLength']]); new_views.append(view)
    nodes = [i for i, node in enumerate(doc['nodes']) if 'mesh' not in node or node['mesh'] in mesh_ids]
    node_map = {old: new for new, old in enumerate(nodes)}
    for i in nodes:
        node = doc['nodes'][i]
        if 'children' in node: node['children'] = [node_map[j] for j in node['children'] if j in node_map]
        if 'mesh' in node: node['mesh'] = maps['mesh'][node['mesh']]
    doc['nodes'] = [doc['nodes'][i] for i in nodes]
    for scene in doc['scenes']: scene['nodes'] = [node_map[i] for i in scene['nodes'] if i in node_map]
    for skin in doc['skins']:
        skin['joints'] = [node_map[i] for i in skin['joints']]; skin['skeleton'] = node_map[skin['skeleton']]
        skin['inverseBindMatrices'] = maps['accessor'][skin['inverseBindMatrices']]
    doc['meshes'] = [doc['meshes'][i] for i in mesh_ids]
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            primitive['attributes'] = {key: maps['accessor'][value] for key, value in primitive['attributes'].items()}
            primitive['indices'] = maps['accessor'][primitive['indices']]; primitive['material'] = maps['material'][primitive['material']]
    doc['materials'] = [doc['materials'][i] for i in materials]
    for material in doc['materials']:
        texture = material['pbrMetallicRoughness'].get('baseColorTexture')
        if texture: texture['index'] = maps['texture'][texture['index']]
    doc['textures'] = [doc['textures'][i] for i in textures]
    for texture in doc['textures']: texture['source'] = maps['image'][texture['source']]
    doc['images'] = [doc['images'][i] for i in images]
    doc['accessors'] = [doc['accessors'][i] for i in accessors]
    for accessor in doc['accessors']: accessor['bufferView'] = maps['view'][accessor['bufferView']]
    doc['bufferViews'] = new_views
    doc['buffers'] = [{'byteLength': len(packed)}]
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    packed.extend(b'\x00' * (-len(packed) % 4))
    output.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
                       + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                       + struct.pack('<II', len(packed), 0x004E4942) + packed)
    return doc


def build(source, output, head_path):
    output.mkdir(parents=True, exist_ok=True)
    assert not (output / 'mouse.glb').exists(), 'Review a fresh staging directory.'
    archive = source / 'system-assets.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107'
    with tempfile.TemporaryDirectory(prefix='matrix-mouse-body-') as temp:
        builder.OUT = Path(temp)
        builder.main(source, 'mouse')
        raw = (builder.OUT / 'mouse.glb').read_bytes(); length = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + length]); binary = bytearray(raw[28 + length:])
        for image in doc['images']:
            original = image['uri']
            # The complete CC0 body map is byte-identical to Choi's donor map;
            # reuse that existing dependency instead of shipping another 3.5 MB.
            if original == 'mouse-skin.png': image['uri'] = 'choi-skin.png'
            (output / image['uri']).write_bytes((builder.OUT / original).read_bytes())
    metadata = doc['extras']
    # Fit clothing and hair to the same authored head consumed by MouseAppearance.
    # Its eye-derived transform is stable; the lower neck remains body-fitted at runtime.
    head_raw = head_path.read_bytes(); head_length = struct.unpack_from('<I', head_raw, 12)[0]
    head_doc = json.loads(head_raw[20:20 + head_length]); head_binary = head_raw[28 + head_length:]
    head_primitive = head_doc['meshes'][0]['primitives'][0]

    def head_array(index, width):
        item = head_doc['accessors'][index]; view = head_doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]
        return np.frombuffer(head_binary, dtype=dtype, count=item['count'] * width,
                             offset=view.get('byteOffset', 0) + item.get('byteOffset', 0)).reshape(-1, width).copy()

    head_eye = np.array(head_doc['extras']['eye']); head_scale = abs(metadata['eye'][0]) / head_eye[0]
    head_offset = np.array([0, metadata['eye'][1], metadata['eye'][2]]) - head_eye * head_scale
    head_offset[0] = 0
    fitted_head = head_array(head_primitive['attributes']['POSITION'], 3) * head_scale + head_offset
    head_triangles = head_array(head_primitive['indices'], 1).reshape(-1, 3)
    head_faces = [[(int(i), int(i)) for i in face] for face in head_triangles]
    head_uv = head_array(head_primitive['attributes']['TEXCOORD_0'], 2); head_uv[:, 1] = 1 - head_uv[:, 1]
    head_normal = head_array(head_primitive['attributes']['NORMAL'], 3)
    head_weights = np.zeros((len(fitted_head), 46)); head_weights[:, 3] = 1

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]
        return np.frombuffer(binary, dtype=dtype, count=item['count'] * width,
                             offset=view.get('byteOffset', 0) + item.get('byteOffset', 0)).reshape(-1, width).copy()

    names = [doc['nodes'][node]['name'].replace('_', '.') for node in doc['skins'][0]['joints']]
    rest = np.linalg.inv(array(doc['skins'][0]['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1))[:, :3, 3]
    base, uv, source_faces, groups = builder.obj(source / 'base.obj')
    files = ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [target + '.target' for target in metadata['targets']]
    for folder in ['clothes/male_elegantsuit01', 'clothes/shoes01', 'hair/short04', 'eyes/high-poly', 'eyes/materials', 'skins/young_caucasian_male']:
        files += [str(path.relative_to(source)) for path in sorted((source / 'system' / folder).glob('*')) if path.suffix in ['.obj', '.mhclo', '.png']]
    hashes = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in files}
    hashes['system-assets.zip'] = hashlib.sha256(archive.read_bytes()).hexdigest()
    hashes['fitted-head:mouse-head.glb'] = hashlib.sha256(head_raw).hexdigest()
    for name, amount in metadata['targets'].items():
        for line in (source / (name + '.target')).read_text().splitlines():
            values = line.split()
            if len(values) == 4 and not line.startswith('#'):
                base[int(values[0])] += np.array([float(value) for value in values[1:]]) * amount
    rig = json.loads((source / 'default.mhskel').read_text())

    def pivot(name): return base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)

    pivots = np.zeros_like(rest)
    pivots[:4] = [(pivot('upperleg01.L') + pivot('upperleg01.R')) / 2, pivot('spine03'), pivot('spine01'), pivot('head')]
    for i, name in enumerate(names[4:], 4):
        part, side = name.split('.')
        reference = {'shoulder': 'upperarm01', 'elbow': 'lowerarm01', 'hip': 'upperleg01', 'knee': 'lowerleg01', 'ankle': 'foot'}.get(part, part)
        pivots[i] = pivot(reference + '.' + side)

    def mapped(name):
        if name in names: return names.index(name)
        side = '.' + name.split('.')[-1]
        for prefix, target in [('upperarm', 'shoulder'), ('lowerarm', 'elbow'), ('metacarpal', 'wrist'), ('upperleg', 'hip'), ('lowerleg', 'knee'), ('toe', 'ankle'), ('foot', 'ankle')]:
            if name.startswith(prefix): return names.index(target + side)
        if name.startswith(('neck', 'jaw', 'special', 'eye', 'tongue', 'levator', 'orbicularis', 'oris', 'temporalis', 'oculi', 'risorius')): return 3
        if name in ('spine03', 'spine04'): return 1
        return 2 if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')) else 0

    weights = np.zeros((len(base), 46))
    for name, entries in json.loads((source / 'default_weights.mhw').read_text())['weights'].items():
        for vertex, amount in entries: weights[vertex, mapped(name)] += amount
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
    rotations = np.tile(np.eye(3), (46, 1, 1))
    for side in ['R', 'L']:
        for start, end in [('shoulder', 'elbow'), ('elbow', 'wrist'), ('hip', 'knee'), ('knee', 'ankle')]:
            a, b = [names.index(part + '.' + side) for part in [start, end]]
            rotations[a] = builder.align(pivots[b] - pivots[a], rest[b] - rest[a])
        for i, name in enumerate(names):
            if name.startswith(('wrist', 'finger')) and name.endswith('.' + side): rotations[i] = rotations[names.index('elbow.' + side)]
    body_faces = [face for face, group in zip(source_faces, groups) if group == 'body']
    base, uv, faces, weights = builder.subdivide(base, uv, body_faces, weights)
    points = np.zeros_like(base)
    for i in range(46): points += ((base - pivots[i]) @ rotations[i].T * metadata['sourceScale'] + rest[i]) * weights[:, i:i + 1]
    surface = normals(points, faces)
    arm = weights[:, [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]].sum(axis=1)
    hand = weights[:, [i for i, name in enumerate(names) if name.startswith(('wrist', 'finger'))]].sum(axis=1)
    wrist_y = min(rest[names.index('wrist.' + side), 1] for side in ['R', 'L'])
    head_y, eye_y = metadata['head'][1], metadata['eye'][1]
    skin_id = next(i for i, material in enumerate(doc['materials']) if material['name'] == 'Skin')

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4)); view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes}); binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    def material(name, color, roughness=.95):
        doc['materials'].append({'name': name, 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'roughnessFactor': roughness, 'metallicFactor': 0}})
        return len(doc['materials']) - 1

    def export(name, p, tex, polygons, influence, material_id, extras=None, thickness=False):
        p, tex, influence = np.array(p), np.array(tex), np.array(influence)
        polygons = list(polygons)
        if thickness:
            n = normals(p, polygons); edges = {}
            for polygon in polygons:
                for a, b in zip(polygon, polygon[1:] + polygon[:1]): edges.setdefault(tuple(sorted([a[0], b[0]])), []).append((a, b))
            values, w, inset = list(p), list(influence), {}
            for adjacent in edges.values():
                if len(adjacent) != 1: continue
                a, b = adjacent[0]
                for i, _ in [a, b]:
                    if i not in inset: inset[i] = len(values); values.append(p[i] - n[i] * .012); w.append(influence[i])
                polygons.append([b, a, (inset[a[0]], a[1]), (inset[b[0]], b[1])])
            p, influence = np.array(values), np.array(w)
        normal = normals(p, polygons); pairs, lookup, indices = [], {}, []
        for polygon in polygons:
            for j in range(1, len(polygon) - 1):
                for pair in [polygon[0], polygon[j], polygon[j + 1]]:
                    key = (pair[0], *np.round(tex[pair[1]], 7))
                    if key not in lookup: lookup[key] = len(pairs); pairs.append(pair)
                    indices.append(lookup[key])
        vertices, texture = np.array(pairs).T
        joints = np.argsort(-influence[vertices], axis=1)[:, :4]
        w = np.take_along_axis(influence[vertices], joints, axis=1); w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-8)
        coords = tex[texture].copy(); coords[:, 1] = 1 - coords[:, 1]
        attrs = {'POSITION': accessor(p[vertices], 'VEC3'), 'NORMAL': accessor(normal[vertices], 'VEC3'), 'TEXCOORD_0': accessor(coords, 'VEC2'),
                 'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(w, 'VEC4')}
        index = len(doc['meshes']); doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material_id}]})
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'mesh': index, 'skin': 0, 'extras': extras or {}})
        print(name, len(vertices), 'vertices', len(indices) // 3, 'triangles')
        return index

    # One continuous anatomical mesh includes each wrist and the whole visible
    # throat. Skin selection happens after subdivision, so no artificial wrist
    # seam separates fingers from the forearm when the cuff moves.
    anatomy = [face for face in faces if points[[i for i, _ in face], 1].mean() > head_y - .49
               or (arm[[i for i, _ in face]].mean() > .8 and points[[i for i, _ in face], 1].mean() < wrist_y + .38)]
    anatomy_id = export('Anatomical head and hands', points, uv, anatomy, weights, skin_id)
    neck = builder.trim_neckline(points, uv, faces, weights, head_y - .65, above=True)
    neck = builder.trim_neckline(*neck, head_y - .08)
    neck_id = export('mouse-neck-reference', *neck, skin_id, {'mouseNeckReference': True})

    # The open shirt is draped over the anatomy, with a loose trunk and folds
    # around the elbows; it is not the old formal jacket recolored blue.
    upper = material('Mouse ship fabric', [.041, .060, .065])
    seam = material('Mouse folded cloth', [.029, .042, .047])
    knit = material('Mouse cap fabric', [.021, .024, .026], .98)
    cloth = points + surface * .028
    trunk = (1 - np.clip(arm / .5, 0, 1)) * np.clip((head_y - .3 - points[:, 1]) / .20, 0, 1)
    cloth[:, 0] *= 1 + trunk * .035; cloth[:, 2] *= 1 + trunk * .04
    folds = (.004 * np.sin(points[:, 1] * 23 + points[:, 0] * 12) + .003 * np.sin(points[:, 1] * 37 - points[:, 2] * 18)) * arm
    cloth += surface * folds[:, None]
    hem = np.where(arm > .4, wrist_y - .02, metadata['waist'][1] - .16)
    shirt = builder.trim_neckline(cloth, uv, faces, weights, hem, above=True)
    p = shirt[0]; cut = head_y - .12 - .105 * np.clip((p[:, 2] - .02) / .18, 0, 1) * np.exp(-(p[:, 0] / .12) ** 4)
    shirt = builder.trim_neckline(*shirt, cut)
    ship_ids = [export('mouse ship shirt', *shirt, upper, {'mouseCostume': True}, thickness=True)]

    def garment_panel(name, corners, material_id):
        rows, columns = 12, 8; p, tex, polygons = [], [], []
        a, b, c, d = np.array(corners)
        for row in range(rows + 1):
            v = row / rows
            for column in range(columns + 1):
                u = column / columns; point = (a * (1 - v) + d * v) * (1 - u) + (b * (1 - v) + c * v) * u
                point[2] += .026 * np.sin(u * np.pi) * np.sin(v * np.pi)
                p.append(point); tex.append([u, v])
        for row in range(rows):
            for col in range(columns):
                i = row * (columns + 1) + col; ids = [i, i + 1, i + columns + 2, i + columns + 1]; polygons.append([(j, j) for j in ids])
        p = np.array(p); nearest = np.argmin(((p[:, None] - points[None]) ** 2).sum(axis=2), axis=1)
        return export(name, p, np.array(tex), polygons, weights[nearest], material_id, {'mouseCostume': True}, thickness=True)

    # Two turned-over cloth leaves follow the throat and shoulder. Their bottom
    # tips sit over the opening rather than intersecting the anatomical neck.
    for side in [-1, 1]:
        ship_ids.append(garment_panel('mouse ship collar' if side == -1 else 'mouse ship collar left',
            [[side * .095, head_y - .16, .245], [side * .19, head_y - .17, .195],
             [side * .23, head_y - .32, .31], [side * .14, head_y - .28, .335]], upper))
    ship_ids.append(garment_panel('mouse ship placket', [[-.022, head_y - .25, .345], [.022, head_y - .25, .345],
        [.022, metadata['waist'][1] - .15, .33], [-.022, metadata['waist'][1] - .15, .33]], seam))

    # Shape a slouched crown from Mouse's actual scalp. The folded lower band
    # has a rolled cross-section and asymmetric fabric creases, not a sphere.
    cap_center = np.array([0, .13])
    theta = np.arctan2(fitted_head[:, 0], fitted_head[:, 2] - cap_center[1])
    lift = np.clip((fitted_head[:, 1] - eye_y) / (fitted_head[:, 1].max() - eye_y), 0, 1)
    cap_fold = .003 * np.sin(theta * 6 + lift * 5) + .001 * np.sin(theta * 9 - lift * 7)
    crown = fitted_head + head_normal * (.036 + cap_fold)[:, None]
    crown[:, 0] -= .004 * lift ** 2
    crown[:, 2] -= .006 * lift ** 2
    cap = builder.trim_neckline(crown, head_uv, head_faces, head_weights, eye_y + .052, above=True)
    ship_ids.append(export('mouse ship cap', *cap, knit, {'mouseCostume': True, 'mouseCap': True}, thickness=True))
    crown_top = fitted_head[:, 1] > eye_y + .015
    directions = np.arange(128) * 2 * np.pi / 128
    radii = []
    for angle in directions:
        delta = np.angle(np.exp(1j * (theta - angle)))
        band = crown_top & (fitted_head[:, 1] < eye_y + .10) & (np.abs(delta) < .10)
        radii.append(np.max(np.linalg.norm(fitted_head[band][:, [0, 2]] - cap_center, axis=1)) if band.any() else .18)
    radii = np.array(radii)
    for _ in range(3): radii = (np.roll(radii, 1) + 2 * radii + np.roll(radii, -1)) / 4
    p, tex, polygons = [], [], []
    for row in range(9):
        t = row / 8
        for i, angle in enumerate(directions):
            radius = radii[i] + .018 + .009 * np.sin(t * np.pi) + .003 * np.sin(angle * 7 + t * 4)
            p.append([np.sin(angle) * radius, eye_y + .045 + .055 * t + .004 * np.sin(angle * 5), cap_center[1] + np.cos(angle) * radius])
            tex.append([i / 128, t])
            if row < 8:
                ids = [row * 128 + i, row * 128 + (i + 1) % 128, (row + 1) * 128 + (i + 1) % 128, (row + 1) * 128 + i]
                polygons.append([(j, j) for j in ids])
    influence = np.zeros((len(p), 46)); influence[:, 3] = 1
    ship_ids.append(export('mouse cap folded band', p, tex, polygons, influence, knit, {'mouseCostume': True, 'mouseCap': True}, thickness=True))

    # Preserve the authored short blazer/trousers, and fit real shoe soles to
    # the ground while retaining their tread and ankle binding.
    matrix_ids = [i for i, mesh in enumerate(doc['meshes']) if mesh['name'] in ['Tailored trousers', 'Tailored coat upper', 'Black crew neck', 'shoes01', 'high-poly', 'short04']]
    boots_id = material('Mouse boot tread', [.009, .011, .010], .85)
    boot_meshes = []
    for i in matrix_ids:
        mesh = doc['meshes'][i]
        if mesh['name'] == 'shoes01':
            attrs = mesh['primitives'][0]['attributes']; p = array(attrs['POSITION'], 3)
            sole = p[:, 1].min(); p[:, 1] -= sole - .018
            attrs['POSITION'] = accessor(p, 'VEC3')
            for side, sign in [('R', -1), ('L', 1)]:
                selected = p[(p[:, 0] * sign > 0) & (p[:, 1] < .10)]
                center = (selected[:, [0, 2]].min(axis=0) + selected[:, [0, 2]].max(axis=0)) / 2
                relative = selected[:, [0, 2]] - center; angles = np.arctan2(relative[:, 0], relative[:, 1])
                radii = []
                for angle in directions:
                    nearest = np.argsort(np.abs(np.angle(np.exp(1j * (angles - angle)))))[:5]
                    radii.append(np.linalg.norm(relative[nearest], axis=1).max())
                radii = np.array(radii)
                for _ in range(2): radii = (np.roll(radii, 1) + 2 * radii + np.roll(radii, -1)) / 4
                sole_points, tex, polygons = [], [], []
                for row, height in enumerate([0, .018, .028, .058, .075]):
                    for j, angle in enumerate(directions):
                        lug = .008 if row < 2 and j % 6 < 4 else 0
                        radius = radii[j] + .007 + lug
                        sole_points.append([center[0] + np.sin(angle) * radius, height, center[1] + np.cos(angle) * radius])
                        tex.append([j / 128, row / 4])
                        if row < 4:
                            ids = [row * 128 + j, row * 128 + (j + 1) % 128, (row + 1) * 128 + (j + 1) % 128, (row + 1) * 128 + j]
                            polygons.append([(k, k) for k in ids])
                for row in [0, 4]:
                    middle = len(sole_points); sole_points.append([center[0], .075 if row else 0, center[1]]); tex.append([.5, .5])
                    for j in range(128):
                        ids = [middle, row * 128 + j, row * 128 + (j + 1) % 128]
                        if row == 0: ids.reverse()
                        polygons.append([(k, k) for k in ids])
                w = np.zeros((len(sole_points), 46)); w[:, names.index('ankle.' + side)] = 1
                boot_meshes.append(export('mouse boot sole ' + side, sole_points, tex, polygons, w, boots_id))
        if mesh['name'] == 'short04':
            # Preserve the donor's UVs and strand alpha. Only move buried temple
            # roots outward to the registered skull, avoiding painted bald gaps.
            attrs = mesh['primitives'][0]['attributes']; p = array(attrs['POSITION'], 3)
            hair_indices = array(mesh['primitives'][0]['indices'], 1).reshape(-1, 3)
            tex = array(attrs['TEXCOORD_0'], 2); joints = array(attrs['JOINTS_0'], 4); old_weights = array(attrs['WEIGHTS_0'], 4)
            influence = np.zeros((len(p), 46))
            for part in range(4): influence[np.arange(len(p)), joints[:, part]] += old_weights[:, part]
            # A straight card triangle can cut through a curved temple even
            # when all three corners clear it. Linear refinement preserves the
            # original strand UVs exactly while allowing the surface to bend.
            values, coords, binding = list(p), list(tex), list(influence); middle = {}; refined = []
            for a, b, c in hair_indices:
                edge = []
                for first, second in [(a, b), (b, c), (c, a)]:
                    key = tuple(sorted([int(first), int(second)]))
                    if key not in middle:
                        middle[key] = len(values); values.append((p[first] + p[second]) / 2)
                        coords.append((tex[first] + tex[second]) / 2); binding.append((influence[first] + influence[second]) / 2)
                    edge.append(middle[key])
                ab, bc, ca = edge; refined += [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]
            p, tex, influence = np.array(values), np.array(coords), np.array(binding); hair_indices = np.array(refined)
            joints = np.argsort(-influence, axis=1)[:, :4]; bound = np.take_along_axis(influence, joints, axis=1)
            attrs['TEXCOORD_0'] = accessor(tex, 'VEC2'); attrs['JOINTS_0'] = accessor(joints, 'VEC4', 5123)
            attrs['WEIGHTS_0'] = accessor(bound / bound.sum(axis=1, keepdims=True), 'VEC4')
            mesh['primitives'][0]['indices'] = accessor(hair_indices.reshape(-1), 'SCALAR', 5125)
            original = p.copy(); center = np.array([0, eye_y + .12, metadata['eye'][2] - .12])
            triangles = fitted_head[head_triangles]; edge1 = triangles[:, 1] - triangles[:, 0]; edge2 = triangles[:, 2] - triangles[:, 0]
            origin_delta = center - triangles[:, 0]; q = np.cross(origin_delta, edge1)
            for vertex in np.flatnonzero((p[:, 1] > eye_y - .08) & (p[:, 1] < eye_y + .12) & (np.abs(p[:, 0]) > .12)):
                direction = p[vertex] - center; distance = np.linalg.norm(direction); direction /= distance
                h = np.cross(direction, edge2); determinant = np.sum(edge1 * h, axis=1)
                valid = np.abs(determinant) > 1e-10
                inverse = np.zeros(len(triangles)); inverse[valid] = 1 / determinant[valid]
                u = inverse * np.sum(origin_delta * h, axis=1); v = inverse * (q @ direction)
                t = inverse * np.sum(edge2 * q, axis=1)
                hits = t[valid & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)]
                # The short cards need a small continuous envelope around the
                # folded ear rim so their interiors do not slice through it.
                if len(hits) and distance < hits.max() + .018: p[vertex] = center + direction * (hits.max() + .018)
            # Check triangle interiors as well as vertices. Around a concave
            # ear rim a planar card can still enter skin between clear corners.
            temple = hair_indices[np.any((p[hair_indices, 1] > eye_y - .08) & (p[hair_indices, 1] < eye_y + .12)
                                          & (np.abs(p[hair_indices, 0]) > .12), axis=1)]
            for _ in range(3):
                padding = np.zeros(len(p))
                for face in temple:
                    for bary in [[1 / 3, 1 / 3, 1 / 3], [.6, .2, .2], [.2, .6, .2], [.2, .2, .6]]:
                        point = np.array(bary) @ p[face]; direction = point - center
                        distance = np.linalg.norm(direction); direction /= distance
                        h = np.cross(direction, edge2); determinant = np.sum(edge1 * h, axis=1)
                        valid = np.abs(determinant) > 1e-10; inverse = np.zeros(len(triangles)); inverse[valid] = 1 / determinant[valid]
                        u = inverse * np.sum(origin_delta * h, axis=1); v = inverse * (q @ direction)
                        t = inverse * np.sum(edge2 * q, axis=1)
                        hits = np.sort(t[valid & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > distance + .002)])
                        if len(hits): hits = hits[np.r_[True, np.diff(hits) > 1e-5]]
                        if len(hits) % 2 == 1: padding[face] = np.maximum(padding[face], hits[-1] - distance + .006)
                if not np.any(padding): break
                directions_to_root = p - center; directions_to_root /= np.maximum(np.linalg.norm(directions_to_root, axis=1, keepdims=True), 1e-8)
                p += directions_to_root * padding[:, None]
            hair_indices = array(mesh['primitives'][0]['indices'], 1).reshape(-1, 3)
            hair_faces = [[(int(v), 0) for v in face] for face in hair_indices]
            attrs['POSITION'] = accessor(p, 'VEC3'); attrs['NORMAL'] = accessor(normals(p, hair_faces), 'VEC3')
            print('Short hair fitted vertices', int((np.linalg.norm(p - original, axis=1) > 1e-6).sum()),
                  'maximum displacement', float(np.linalg.norm(p - original, axis=1).max()))
            doc['materials'][mesh['primitives'][0]['material']]['pbrMetallicRoughness']['baseColorFactor'] = [.24, .15, .085, 1]
    metadata.update(mouseBodyVersion=1, mouseSourceHashes=hashes, mouseHeadAnchors={
        'eye': metadata['eye'], 'head': metadata['head'], 'neckReference': 'mouse-neck-reference',
        'neckBottom': head_y - .65, 'neckTop': head_y - .08, 'capBottom': eye_y + .045,
        'note': 'Authored proportions, not calibrated actor measurements; head fitting must retain this skeleton.'})
    body_doc = pack(doc, binary, matrix_ids + boot_meshes + [anatomy_id, neck_id], output / 'mouse.glb')
    doc['extras']['costumeOnly'] = True
    ship_doc = pack(doc, binary, ship_ids, output / 'mouse-ship.glb')
    used = {image['uri'] for result in [body_doc, ship_doc] for image in result['images']}
    for image in doc['images']:
        if image['uri'] not in used: (output / image['uri']).unlink()
    report = {'anchors': metadata['mouseHeadAnchors'], 'assets': {name: {'bytes': (output / name).stat().st_size,
              'sha256': hashlib.sha256((output / name).read_bytes()).hexdigest()} for name in ['mouse.glb', 'mouse-ship.glb']},
              'textures': sorted(used), 'sourceRevision': builder.REVISION,
              'license': 'CC0 MakeHuman core/system assets; all additional garment/cap geometry authored in this script.'}
    (output / 'mouse-body-build.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--head', type=Path, required=True)
    args = parser.parse_args()
    build(args.source, args.output, args.head)
