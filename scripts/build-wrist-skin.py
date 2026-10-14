"""Restore the four heroes' missing wrist skin from their pinned CC0 anatomy.

Append to a finished GLB without changing its face, hands or existing buffers.
Trinity's fitted lower sleeves receive clearance around the restored anatomy.
The small texture atlas joins the existing baked hand color at the actual rim.
Python/numpy/Pillow are authoring tools only; review a fresh --output directory.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('character_builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def build(source, character, output):
    data = character.read_bytes(); length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
    metadata = doc['extras']; role = metadata['character']
    assert role in ['neo', 'trinity', 'smith', 'morpheus'] and metadata.get('skinBaked')
    assert metadata['sourceRevision'] == builder.REVISION and 'wristSkinVersion' not in metadata
    assert not (output / character.name).exists(), 'Use a fresh staging destination.'

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]
        size = np.dtype(dtype).itemsize
        return np.ndarray((item['count'], width), dtype, binary,
                          view.get('byteOffset', 0) + item.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * size), size)).copy()

    skin = doc['skins'][0]; names = [doc['nodes'][node]['name'].replace('_', '.') for node in skin['joints']]
    assert len(names) == 46
    rest = np.linalg.inv(array(skin['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1))[:, :3, 3]
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    files = ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [target + '.target' for target in metadata['targets']]
    source_hashes = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in files}
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
    # Complement the exact face selection used to export the original hands.
    # Subdivide before posing, so both halves keep identical boundary weights.
    body = [face for face, group in zip(faces, groups) if group == 'body'
            and np.mean(base[[i for i, _ in face], 1]) <= neckline - .85
            and np.mean(weights[[i for i, _ in face]][:, hands].sum(axis=1)) <= .85]
    vertices, uv, polygons, influence = builder.subdivide(base, uv, body, weights)
    points = np.zeros_like(vertices)
    for i in range(len(names)):
        points += ((vertices - pivots[i]) @ rotations[i].T * metadata['sourceScale'] + rest[i]) * influence[:, i:i + 1]
    arms = [i for i, name in enumerate(names) if name.startswith(('elbow', 'wrist', 'finger'))]
    wrist_height = max(rest[names.index('wrist.' + side), 1] for side in ['R', 'L'])
    polygons = [face for face in polygons if np.min(influence[[i for i, _ in face]][:, arms].sum(axis=1)) > .95
                and np.mean(points[[i for i, _ in face], 1]) < wrist_height + .4]
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
    original = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Anatomical head and hands')['primitives'][0]
    attrs = original['attributes']; original_points = array(attrs['POSITION'], 3); original_normals = array(attrs['NORMAL'], 3)
    original_joints = array(attrs['JOINTS_0'], 4); original_weights = array(attrs['WEIGHTS_0'], 4)
    hand_ids = np.where(original_points[:, 1] < 2.8)[0]
    distance = np.linalg.norm(points[:, None] - original_points[hand_ids][None], axis=2)
    nearest = hand_ids[distance.argmin(axis=1)]; separation = distance.min(axis=1); shared = np.where(separation < 1e-5)[0]
    assert len(shared) >= 96, f'The new anatomy must meet both original hand rings; found {len(shared)} shared vertices.'
    points[shared] = original_points[nearest[shared]]
    joints[shared] = original_joints[nearest[shared]]; sw[shared] = original_weights[nearest[shared]]
    blend = np.clip(1 - separation / .065, 0, 1)[:, None]
    normals = normals * (1 - blend) + original_normals[nearest] * blend
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)

    original_material = doc['materials'][original['material']]
    original_image = doc['images'][doc['textures'][original_material['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['uri']
    # The neighboring maps are required inputs, also when reviewing an original
    # GLB copied into an isolated staging directory.
    texture_dir = builder.ROOT / 'packages/client/public/assets/characters'
    baked = Image.open(texture_dir / original_image).convert('RGB')
    stock_file = next((source / 'system/skins' / builder.CHARACTERS[role]['skin']).glob('*diffuse.png'))
    stock = Image.open(stock_file).convert('RGB').resize(baked.size, Image.Resampling.LANCZOS)
    source_hashes[str(stock_file.relative_to(source))] = hashlib.sha256(stock_file.read_bytes()).hexdigest()

    def linear(rgb):
        rgb = np.asarray(rgb, dtype=float) / 255
        return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)

    baked_pixels, stock_pixels = linear(baked), linear(stock)
    size = np.array(baked.size); parts = []; crops = []
    # The bake contains black outside its actual hand UVs. Its export margin
    # is not a continuous skin surface; extend color from the cut edge there.
    painted = Image.new('1', baked.size); draw = ImageDraw.Draw(painted)
    hand_uv = array(attrs['TEXCOORD_0'], 2)
    for face in array(original['indices'], 1).reshape(-1, 3):
        if np.max(original_points[face, 1]) < 2.8:
            draw.polygon([tuple(point) for point in hand_uv[face] * size - .5], fill=1)
    painted = np.asarray(painted)
    shared_mask = np.zeros(len(points), dtype=bool); shared_mask[shared] = True
    seam_edges = set()
    for face in np.array(indices).reshape(-1, 3):
        for a, b in zip(face, np.roll(face, -1)):
            if shared_mask[a] and shared_mask[b]:
                seam_edges.add(tuple(sorted([int(a), int(b)])))
    # Pack disconnected UV islands separately; the original full-body layout
    # puts the palm and back of each wrist far apart in the source image.
    parents = np.arange(len(points))

    def component(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]; i = parents[i]
        return i

    for a, b, c in np.array(indices).reshape(-1, 3):
        parents[component(b)] = component(a); parents[component(c)] = component(a)
    islands = np.array([component(i) for i in range(len(points))])
    for island in np.unique(islands):
        selected = islands == island
        low = np.maximum(0, np.floor(texcoords[selected].min(axis=0) * size).astype(int) - 18)
        high = np.minimum(size, np.ceil(texcoords[selected].max(axis=0) * size).astype(int) + 18)
        ring = shared[np.sign(points[shared, 0]) == np.sign(points[selected, 0].mean())]
        samples = np.clip((texcoords[ring] * size).astype(int), 0, size - 1)
        gain = np.median(baked_pixels[samples[:, 1], samples[:, 0]] / np.maximum(stock_pixels[samples[:, 1], samples[:, 0]], .02), axis=0)
        patch = stock_pixels[low[1]:high[1], low[0]:high[0]].copy() * gain
        yy, xx = np.mgrid[low[1]:high[1], low[0]:high[0]]; distance = np.full(xx.shape, np.inf)
        pixels = np.stack([xx + .5, yy + .5], axis=-1); nearest = np.zeros_like(pixels)
        for a, b in seam_edges:
            if not (selected[a] and selected[b]):
                continue
            start, end = texcoords[[a, b]] * size; direction = end - start
            t = np.clip(((pixels - start) @ direction) / max(direction @ direction, 1e-8), 0, 1)
            edge = start + t[..., None] * direction; separation = np.linalg.norm(pixels - edge, axis=-1)
            closer = separation < distance; nearest[closer] = edge[closer]; distance[closer] = separation[closer]
        # Disconnected pieces beneath the sleeve have no cut-hand edge; their
        # infinite distance leaves them entirely on the full-body skin map.
        xy = nearest - .5; lo = np.floor(xy).astype(int); fraction = xy - lo; edge_color = np.zeros_like(patch)
        for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            gain = (fraction[..., 0] if dx else 1 - fraction[..., 0]) * (fraction[..., 1] if dy else 1 - fraction[..., 1])
            edge_color += baked_pixels[np.clip(lo[..., 1] + dy, 0, size[1] - 1),
                                       np.clip(lo[..., 0] + dx, 0, size[0] - 1)] * gain[..., None]
        continuation = np.where(painted[yy, xx, None], baked_pixels[yy, xx], edge_color)
        # Preserve the painted hand side; outside it, extend real edge color
        # before blending into the matching full-body skin over six pixels.
        blend = np.clip((14 - distance) / 6, 0, 1)[..., None]
        patch = patch * (1 - blend) + continuation * blend
        patch = np.where(patch <= .0031308, patch * 12.92, 1.055 * np.maximum(patch, 0) ** (1 / 2.4) - .055)
        parts.append(Image.fromarray(np.clip(np.rint(patch * 255), 0, 255).astype('uint8')))
        crops.append((selected, low, high))
    atlas = Image.new('RGB', (sum(part.width for part in parts), max(part.height for part in parts)))
    offset = 0
    for part, (selected, low, high) in zip(parts, crops):
        atlas.paste(part, (offset, 0)); texcoords[selected] = (texcoords[selected] * size - low + [offset, 0]) / np.array(atlas.size)
        offset += part.width
    output.mkdir(parents=True, exist_ok=True); atlas_name = role + '-wrist-skin.png'; atlas.save(output / atlas_name)

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4)); view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes}); binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    if role == 'trinity':
        jacket = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Fitted leather jacket')['primitives'][0]
        garment = array(jacket['attributes']['POSITION'], 3); original_garment = garment.copy()
        garment_normals = array(jacket['attributes']['NORMAL'], 3); original_normals = garment_normals.copy()
        for side in ['R', 'L']:
            wrist = rest[names.index('wrist.' + side)]; elbow = rest[names.index('elbow.' + side)]
            axis = wrist - elbow; axis /= np.linalg.norm(axis)
            along = (garment - wrist) @ axis; radial = garment - wrist - along[:, None] * axis
            radius = np.linalg.norm(radial, axis=1)
            fade = np.clip((along + .6) / .12, 0, 1) * np.clip((.14 - along) / .06, 0, 1)
            fade *= (radius < .2)
            garment += radial / np.maximum(radius[:, None], 1e-8) * (.025 * fade[:, None])
        triangles = array(jacket['indices'], 1).reshape(-1, 3)
        moved = np.linalg.norm(garment - original_garment, axis=1) > 1e-8
        affected = np.zeros(len(garment), dtype=bool); affected[np.unique(triangles[moved[triangles].any(axis=1)])] = True
        garment_normals[:] = 0
        for a, b, c in triangles:
            garment_normals[[a, b, c]] += np.cross(garment[b] - garment[a], garment[c] - garment[a])
        _, welded = np.unique(np.round(garment, 5), axis=0, return_inverse=True)
        smooth = np.zeros((welded.max() + 1, 3)); np.add.at(smooth, welded, garment_normals); garment_normals = smooth[welded]
        garment_normals /= np.maximum(np.linalg.norm(garment_normals, axis=1, keepdims=True), 1e-8)
        garment_normals[~affected] = original_normals[~affected]
        jacket['attributes']['POSITION'] = accessor(garment, 'VEC3'); jacket['attributes']['NORMAL'] = accessor(garment_normals, 'VEC3')
        metadata['wristSkinTailoring'] = {'mesh': 'Fitted leather jacket', 'movedVertices': int(moved.sum()), 'maximumExpansion': .025}

    attrs = {'POSITION': accessor(points, 'VEC3'), 'NORMAL': accessor(normals, 'VEC3'), 'TEXCOORD_0': accessor(texcoords, 'VEC2'),
             'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
    material = copy.deepcopy(original_material); material['name'] = 'Wrist skin'; material.pop('normalTexture', None)
    material['pbrMetallicRoughness']['baseColorTexture'] = {'index': len(doc['textures'])}
    doc['textures'].append({'source': len(doc['images']), 'sampler': 0}); doc['images'].append({'uri': atlas_name})
    doc['meshes'].append({'name': 'Anatomical wrist skin', 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': len(doc['materials'])}]})
    doc['materials'].append(material); doc['scenes'][doc.get('scene', 0)]['nodes'].append(len(doc['nodes']))
    doc['nodes'].append({'name': 'Anatomical wrist skin', 'mesh': len(doc['meshes']) - 1, 'skin': 0, 'extras': {'wristSkin': True}})
    metadata.update({'wristSkinVersion': 2, 'wristSkinOriginalSha256': hashlib.sha256(data).hexdigest(), 'wristSkinSource': source_hashes,
                     'wristSkinAlbedoSha256': hashlib.sha256((texture_dir / original_image).read_bytes()).hexdigest()})
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4); binary.extend(b'\x00' * (-len(binary) % 4))
    with (output / character.name).open('xb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4E4F534A)
                   + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary)
    print(json.dumps({'role': role, 'vertices': len(points), 'triangles': len(indices) // 3, 'shared': len(shared),
                      'atlas': atlas.size, 'addedBytes': (output / character.name).stat().st_size - len(data),
                      'textureBytes': (output / atlas_name).stat().st_size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--character', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); build(args.source, args.character, args.output)
