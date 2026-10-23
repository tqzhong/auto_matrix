"""Sew the delivered dojo collar into its jacket, preserving face/hand assets.

Offline numpy authoring. Input must already have the anatomical dojo neck fix;
write a fresh output, inspect it in motion, then replace the delivered GLB.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np

spec = importlib.util.spec_from_file_location('dojo_builder', Path(__file__).with_name('build-dojo-costumes.py'))
dojo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dojo)


def drape_chest(points, triangles, weights):
    """Bridge the anatomy's chest hollows with a loose, vertically draped panel."""
    torso = weights[:, :3].sum(axis=1)
    triangles = triangles[(torso[triangles].min(axis=1) > .7) & (abs(points[triangles, 0]).max(axis=1) < .64)]
    heights = np.linspace(2.6, 3.65, 48); angles = np.arange(128) * 2 * np.pi / 128
    rays = np.column_stack((np.sin(angles), np.cos(angles)))
    cross = lambda a, b: a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]
    sections = []
    for y in heights:
        section = []
        for a, b in [(0, 1), (1, 2), (2, 0)]:
            start, end = points[triangles[:, a]], points[triangles[:, b]]
            cut = (start[:, 1] > y) != (end[:, 1] > y); start, end = start[cut], end[cut]
            t = (y - start[:, 1]) / (end[:, 1] - start[:, 1])
            section.extend((start + (end - start) * t[:, None])[:, [0, 2]])
        ordered = sorted(set(map(tuple, np.round(section, 7)))); hull = []
        for sequence in [ordered, ordered[::-1]]:
            chain = []
            for point in sequence:
                while len(chain) >= 2 and cross(np.subtract(chain[-1], chain[-2]), np.subtract(point, chain[-1])) <= 0: chain.pop()
                chain.append(point)
            hull.extend(chain[:-1])
        hull = np.array(hull); edges = np.roll(hull, -1, axis=0) - hull
        den = cross(rays[:, None], edges[None]); den[abs(den) < 1e-10] = 1e-10
        radius = cross(hull, edges)[None] / den
        along = cross(hull[None], rays[:, None]) / den
        radius[(along < 0) | (along > 1) | (radius < 0)] = np.inf
        section = radius.min(axis=1); assert np.isfinite(section).all(), f'Incomplete chest at {y}'
        sections.append(section)
    sections = np.array(sections)
    for _ in range(10):
        pad = np.pad(sections, ((1, 1), (0, 0)), mode='edge')
        sections = (pad[:-2] + 2 * pad[1:-1] + pad[2:]) / 4
        sections = (np.roll(sections, 1, axis=1) + 2 * sections + np.roll(sections, -1, axis=1)) / 4
    angle = np.mod(np.arctan2(points[:, 0], points[:, 2]), 2 * np.pi)
    sector = angle * 128 / (2 * np.pi); left = np.floor(sector).astype(int) % 128; mix = sector - np.floor(sector)
    y = points[:, 1]
    radius = np.array([np.interp(y[i], heights, sections[:, left[i]]) * (1 - mix[i])
                       + np.interp(y[i], heights, sections[:, (left[i] + 1) % 128]) * mix[i] for i in range(len(points))])
    smooth = lambda x: np.clip(x, 0, 1) ** 2 * (3 - 2 * np.clip(x, 0, 1))
    blend = smooth((y - 2.63) / .18) * (1 - smooth((y - 3.45) / .2)) * smooth((torso - .7) / .25)
    # Small tension folds taper out at the sash, shoulder and sleeve boundaries.
    folds = .008 * (1 + np.sin(angle * 19 + y * 5))
    current = np.linalg.norm(points[:, [0, 2]], axis=1)
    gain = np.maximum(0, radius + .018 + folds - current) * blend
    points[:, 0] += np.sin(angle) * gain; points[:, 2] += np.cos(angle) * gain
    return {'maximumDrapeOffset': float(gain.max()), 'affectedVertices': int(np.count_nonzero(gain > 1e-6))}


def build(character, output):
    original = character.read_bytes(); length = struct.unpack_from('<I', original, 12)[0]
    doc = json.loads(original[20:20 + length]); binary = bytearray(original[28 + length:])
    metadata = doc['extras']; role = metadata['character']
    assert role in ['neo', 'morpheus'] and metadata.get('dojoNeckVersion') == 1
    assert 'dojoTailoringVersion' not in metadata and not output.exists()

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = np.dtype({5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']])
        return np.ndarray((item['count'], width), dtype, binary,
                          view.get('byteOffset', 0) + item.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()

    def part(name):
        return next(mesh for mesh in doc['meshes'] if mesh['name'] == role + '-dojo-' + name)['primitives'][0]

    jacket = part('jacket'); attrs = jacket['attributes']
    points = array(attrs['POSITION'], 3).astype(float); uv = array(attrs['TEXCOORD_0'], 2)
    indices = array(jacket['indices'], 1).reshape(-1, 3)
    joints = array(attrs['JOINTS_0'], 4); values = array(attrs['WEIGHTS_0'], 4)
    names = [doc['nodes'][index]['name'] for index in doc['skins'][0]['joints']]
    weights = np.zeros((len(points), len(names)))
    for slot in range(4): weights[np.arange(len(points)), joints[:, slot]] += values[:, slot]
    # Cloth hangs from the chest/shoulders. Neck skin may follow the head, but
    # the same inherited skin weights make a gi twist into upright paper fins.
    weights[:, names.index('chest')] += weights[:, names.index('head')]
    weights[:, names.index('head')] = 0
    drape = drape_chest(points, indices, weights)
    faces = [[(int(i), int(i)) for i in triangle] for triangle in indices]
    front = np.clip((points[:, 2] - .035) / .14, 0, 1)
    front = front * front * (3 - 2 * front)
    rear = 3.72 + 6 * np.maximum(0, np.abs(points[:, 0]) - (.2 if role == 'neo' else .28)) ** 2
    contour = rear * (1 - front) + (3.15 + np.abs(points[:, 0]) * 2.25) * front
    points, uv, faces, weights = dojo.builder.trim_neckline(points, uv, faces, weights, contour)

    # Weld UV duplicates only for connectivity. The original UV seam remains
    # distinct at export so the existing fabric layout is not damaged.
    positions, welded = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    edges = {}
    for face in faces:
        for a, b in zip(face, face[1:] + face[:1]):
            x, y = welded[a[0]], welded[b[0]]
            if x != y: edges.setdefault(tuple(sorted((x, y))), []).append((a[0], b[0]))
    rim = [edge[0] for edge in edges.values() if len(edge) == 1
           and min(points[list(edge[0]), 1]) > 3.05 and max(abs(points[list(edge[0]), 0])) < .65]
    assert len(rim) > 100, 'The complete V/back-neck boundary is required.'
    distance = np.full(len(points), np.inf)
    for a, b in rim:
        edge = points[b] - points[a]
        t = np.clip((points - points[a]) @ edge / (edge @ edge), 0, 1)
        distance = np.minimum(distance, np.linalg.norm(points - points[a] - t[:, None] * edge, axis=1))
    # The same sewn border continues diagonally into the overlapping wrap.
    start = np.array([0, 3.15]); end = np.array([-.29, metadata['waist'][1] - .08])
    delta = end - start; along = np.clip((points[:, :2] - start) @ delta / (delta @ delta), 0, 1)
    slash = np.linalg.norm(points[:, :2] - start - along[:, None] * delta, axis=1) * 2
    distance = np.minimum(distance, np.where((points[:, 2] > .25) & (points[:, 1] < 3.21), slash, np.inf))
    distance = np.minimum(distance, 10)
    width = .07
    # Both colors are cut from a single surface. They share positions, weights
    # and normals at their seam rather than placing floating quads on the skin.
    outside = dojo.builder.trim_neckline(points, uv, faces, weights, points[:, 1] + distance - width)
    inside = dojo.builder.trim_neckline(points, uv, faces, weights, points[:, 1] + distance - width, above=True)
    surfaces = [outside, inside]
    all_points, all_faces, offsets = [], [], []
    for p, tex, polygons, w in surfaces:
        offset = len(all_points); offsets.append(offset); all_points.extend(p)
        all_faces.extend([[(i + offset, 0) for i, _ in face] for face in polygons])
    all_points = np.array(all_points)
    normals = np.zeros_like(all_points)
    for face in all_faces:
        for k in range(1, len(face) - 1):
            a, b, c = [face[i][0] for i in [0, k, k + 1]]
            normals[[a, b, c]] += np.cross(all_points[b] - all_points[a], all_points[c] - all_points[a])
    _, welded = np.unique(np.round(all_points, 5), axis=0, return_inverse=True)
    shared = np.zeros((welded.max() + 1, 3)); np.add.at(shared, welded, normals); normals = shared[welded]
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
        binary.extend(values.tobytes()); index = len(doc['accessors'])
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return index

    report = {}
    for name, (p, tex, polygons, w), offset in zip(['jacket', 'lapel'], surfaces, offsets):
        pairs, lookup, indices = [], {}, []
        for face in polygons:
            for k in range(1, len(face) - 1):
                triangle = [face[i] for i in [0, k, k + 1]]
                a, b, c = [p[i] for i, _ in triangle]
                if np.linalg.norm(np.cross(b - a, c - a)) < 1e-10: continue
                for i, u in triangle:
                    key = (i, *np.round(tex[u], 7))
                    if key not in lookup: lookup[key] = len(pairs); pairs.append((i, u))
                    indices.append(lookup[key])
        vi, ui = np.array(pairs).T
        ji = np.argsort(-w[vi], axis=1)[:, :4]; sw = np.take_along_axis(w[vi], ji, axis=1); sw /= sw.sum(axis=1, keepdims=True)
        primitive = part(name)
        primitive['attributes'] = {'POSITION': accessor(p[vi], 'VEC3'), 'NORMAL': accessor(normals[vi + offset], 'VEC3'),
            'TEXCOORD_0': accessor(tex[ui], 'VEC2'), 'JOINTS_0': accessor(ji, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
        primitive['indices'] = accessor(indices, 'SCALAR', 5125)
        report[name] = {'vertices': len(vi), 'triangles': len(indices) // 3}
    if role == 'neo':
        doc['materials'][part('belt')['material']]['pbrMetallicRoughness']['baseColorFactor'] = list(doc['materials'][jacket['material']]['pbrMetallicRoughness']['baseColorFactor'])
    metadata.update(dojoTailoringVersion=1, dojoTailoringOriginalSha256=hashlib.sha256(original).hexdigest(),
                    dojoTailoringReference='https://www.youtube.com/watch?v=ozS_6vqnJ8w')
    assert binary[:len(original[28 + struct.unpack_from('<I', original, 12)[0]:])] == original[28 + struct.unpack_from('<I', original, 12)[0]:]
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4)); output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as file:
        file.write(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)))
        file.write(struct.pack('<II', len(encoded), 0x4E4F534A)); file.write(encoded)
        file.write(struct.pack('<II', len(binary), 0x004E4942)); file.write(binary)
    print(json.dumps({'role': role, 'meshes': report, 'drape': drape, 'rimEdges': len(rim), 'outputBytes': output.stat().st_size,
                      'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'originalBinaryPreserved': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--character', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); build(args.character, args.output)
