"""Append a source-weighted meal jaw and CC0 oral anatomy to the shipped Neo.

The UV correspondence transfers original MakeHuman jaw weights across the
existing face refinement. Neutral geometry, skinning and textures stay intact.
Authoring only; numpy/Pillow and the pinned source cache, no runtime dependency.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('character_builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)


def normals(points, triangles):
    faces = np.cross(points[triangles[:, 1]] - points[triangles[:, 0]], points[triangles[:, 2]] - points[triangles[:, 0]])
    result = np.zeros_like(points)
    for corner in range(3): np.add.at(result, triangles[:, corner], faces)
    _, welded = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    sums = np.zeros((welded.max() + 1, 3)); np.add.at(sums, welded, result)
    result = sums[welded]; return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-8)


def main(source, character, output):
    raw = character.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]; doc = json.loads(raw[20:20 + size])
    assert doc['extras']['character'] == 'neo' and doc['extras']['sourceRevision'] == builder.REVISION
    assert 'neoMouthVersion' not in doc['extras'], 'Use the preserved neutral Neo, not this script’s output.'
    binary = bytearray(raw[28 + size:28 + size + doc['buffers'][0]['byteLength']]); original_size = len(binary)

    def read(index):
        a = doc['accessors'][index]; view = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
        return np.frombuffer(binary, dtype, a['count'] * width, view.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, width).copy()

    def append(values, kind='VEC3', component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\0' * (-len(binary) % 4)); view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes}); binary.extend(values.tobytes())
        index = len(doc['accessors']); doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
            'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return index

    def sparse(values, kind='VEC3'):
        # Most of the shared head/hands buffer never moves with the jaw.
        # Sparse glTF accessors retain the exact deltas without shipping zeros.
        values = np.asarray(values, dtype='<f4'); used = np.where(np.any(values != 0, axis=1))[0]
        assert len(values) < 65536 and len(used) > 0
        data, indices = append(values[used], kind), append(used, 'SCALAR', 5123)
        index = len(doc['accessors']); doc['accessors'].append({'componentType': 5126, 'count': len(values), 'type': kind,
            'min': values.min(axis=0).tolist(), 'max': values.max(axis=0).tolist(), 'sparse': {'count': len(used),
                'indices': {'bufferView': doc['accessors'][indices]['bufferView'], 'componentType': 5123},
                'values': {'bufferView': doc['accessors'][data]['bufferView']}}})
        return index

    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, weight in doc['extras']['targets'].items():
        for line in (source / (name + '.target')).read_text().splitlines():
            row = line.split()
            if len(row) == 4 and not row[0].startswith('#'): base[int(row[0])] += np.array([float(x) for x in row[1:]]) * weight
    rig = json.loads((source / 'default.mhskel').read_text()); source_weights = json.loads((source / 'default_weights.mhw').read_text())['weights']
    pivot = lambda name: base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)
    family = {'jaw'}
    for _ in rig['bones']: family.update(n for n, bone in rig['bones'].items() if bone.get('parent') in family)
    jaw = np.zeros((len(base), 1))
    for name in family:
        for vertex, weight in source_weights.get(name, []): jaw[vertex, 0] += weight
    jaw = np.clip(jaw, 0, 1)
    head_faces = [face for face, group in zip(faces, groups) if group == 'body' and np.mean(base[[v for v, _ in face], 1]) > pivot('neck01')[1] - .93]
    points, texcoords, polys, influence = builder.subdivide(base, uv, head_faces, jaw)
    game = lambda values: (values - np.array([0, doc['extras']['floor'], 0])) * doc['extras']['sourceScale']
    primitive = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Anatomical head and hands')['primitives'][0]
    neutral = read(primitive['attributes']['POSITION']).astype(float); skin_uv = read(primitive['attributes']['TEXCOORD_0'])
    lookup = {}
    for face in polys:
        for vertex, tex in face:
            key = tuple(np.rint(texcoords[tex] * 1e6).astype(int)); lookup.setdefault(key, set()).add((vertex, tex))
    weights = np.zeros(len(neutral)); source_points = np.zeros_like(neutral); matched = 0
    for v in np.where(neutral[:, 1] > 3.6)[0]:
        target = skin_uv[v] * [1, -1] + [0, 1]; key = np.rint(target * 1e6).astype(int)
        candidates = set()
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]: candidates.update(lookup.get(tuple(key + [dx, dy]), ()))
        assert candidates, f'No source UV correspondence for head vertex {v}.'
        candidates = list(candidates); distance = [np.linalg.norm(texcoords[t] - target) for _, t in candidates]
        best = int(np.argmin(distance)); assert distance[best] < .000003, f'Unregistered head UV at {v}.'
        vertex = candidates[best][0]; weights[v] = influence[vertex, 0]; source_points[v] = game(points[vertex]); matched += 1
    fade = np.clip((neutral[:, 1] - 3.62) / .12, 0, 1); weights *= fade * fade * (3 - 2 * fade)
    # The visible oral surfaces follow the existing fitted mouth, not a new face.
    local = (neutral[:, 1] > 3.78) & (neutral[:, 1] < 4.03) & (neutral[:, 2] > .22) & (np.abs(neutral[:, 0]) < .18)
    assert local.sum() > 30
    affine = np.linalg.lstsq(np.column_stack((source_points[local], np.ones(local.sum()))), neutral[local], rcond=None)[0]
    assert np.linalg.det(affine[:3]) > .01, 'The oral fit is folded or degenerate.'
    fit = lambda values: np.column_stack((game(values), np.ones(len(values)))) @ affine
    hinge = fit(pivot('jaw')[None])[0]; angle = .32
    rotation = np.array([[1, 0, 0], [0, np.cos(angle), -np.sin(angle)], [0, np.sin(angle), np.cos(angle)]])
    turn = lambda values: (values - hinge) @ rotation.T + hinge
    delta = (turn(neutral) - neutral) * weights[:, None]; triangles = read(primitive['indices']).reshape(-1, 3)
    primitive['attributes']['_JAW_WEIGHT'] = sparse(weights[:, None], 'SCALAR')
    primitive['targets'] = [{'POSITION': sparse(delta), 'NORMAL': sparse(normals(neutral + delta, triangles) - normals(neutral, triangles))}]
    mesh = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'Anatomical head and hands')
    mesh['weights'] = [0]; mesh.setdefault('extras', {})['targetNames'] = ['jawOpen']

    def proxy(kind, name):
        folder = source / 'system' / kind / name; values, texcoords, polys, _ = builder.obj(folder / (name + '.obj'))
        refs, bary, offsets = [], [], []; scales = np.ones(3); active = False
        for line in (folder / (name + '.mhclo')).read_text().splitlines():
            parts = line.split()
            if not parts or parts[0].startswith('#'): continue
            if parts[0] in ('x_scale', 'y_scale', 'z_scale'):
                axis = 'xyz'.index(parts[0][0]); scales[axis] = abs(base[int(parts[1]), axis] - base[int(parts[2]), axis]) / float(parts[3])
            elif parts[0] == 'verts': active = True
            elif active:
                if not parts[0].lstrip('-').isdigit(): active = False
                elif len(parts) == 9:
                    refs.append([int(x) for x in parts[:3]]); bary.append([float(x) for x in parts[3:6]]); offsets.append([float(x) for x in parts[6:9]])
                elif len(parts) == 1: refs.append([int(parts[0])] * 3); bary.append([1, 0, 0]); offsets.append([0, 0, 0])
        refs, bary = np.array(refs), np.array(bary); assert len(refs) == len(values)
        values = (base[refs] * bary[:, :, None]).sum(axis=1) + np.array(offsets) * scales
        lower = np.clip((jaw[refs, 0] * bary).sum(axis=1), 0, 1)
        image = np.asarray(Image.open(folder / ('teeth.png' if kind == 'teeth' else 'tongue01_diffuse.png')).convert('RGB'), dtype=float) / 255
        colors, count = np.zeros_like(values), np.zeros(len(values))
        for poly in polys:
            for vertex, tex in poly:
                u, v = texcoords[tex]; color = image[int(np.clip((1 - v) * image.shape[0], 0, image.shape[0] - 1)), int(np.clip(u * image.shape[1], 0, image.shape[1] - 1))]
                colors[vertex] += np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4); count[vertex] += 1
        return fit(values), polys, lower, colors / np.maximum(count[:, None], 1)

    def oral(name, values, polys, colors, lower):
        used = np.unique([v for face in polys for v, _ in face]); remap = {v: i for i, v in enumerate(used)}
        triangles = np.array([[remap[face[0][0]], remap[face[i][0]], remap[face[i + 1][0]]] for face in polys for i in range(1, len(face) - 1)])
        joints = np.zeros((len(used), 4), dtype=np.uint16); joints[:, 0] = next(i for i, node in enumerate(doc['skins'][0]['joints']) if doc['nodes'][node]['name'] == 'head')
        skin = np.zeros((len(used), 4)); skin[:, 0] = 1
        attrs = {'POSITION': append(values[used]), 'NORMAL': append(normals(values[used], triangles)), 'COLOR_0': append(colors[used]),
                 'JOINTS_0': append(joints, 'VEC4', 5123), 'WEIGHTS_0': append(skin, 'VEC4')}
        material = len(doc['materials']); doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .43 if 'teeth' in name else .76}})
        part = {'attributes': attrs, 'indices': append(triangles.ravel(), 'SCALAR', 5125), 'material': material}
        mesh = {'name': name, 'primitives': [part]}
        if lower:
            moved = turn(values[used]); part['targets'] = [{'POSITION': append(moved - values[used]), 'NORMAL': append(normals(moved, triangles) - normals(values[used], triangles))}]
            mesh.update(weights=[0], extras={'targetNames': ['jawOpen']})
        index = len(doc['meshes']); doc['meshes'].append(mesh); doc['scenes'][0]['nodes'].append(len(doc['nodes']))
        doc['nodes'].append({'name': name, 'mesh': index, 'skin': 0}); return {'vertices': len(used), 'triangles': len(triangles)}

    teeth, polys, lower, colors = proxy('teeth', 'teeth_base'); report = {}
    for is_lower in [False, True]:
        name = 'neo-teeth-lower' if is_lower else 'neo-teeth-upper'
        chosen = [face for face in polys if bool(lower[[v for v, _ in face]].mean() >= .5) == is_lower]
        report[name] = oral(name, teeth, chosen, colors, is_lower)
    tongue, polys, _, colors = proxy('tongue', 'tongue01'); report['neo-tongue'] = oral('neo-tongue', tongue, polys, colors, True)
    sources = ['base.obj', 'default.mhskel', 'default_weights.mhw', *[name + '.target' for name in doc['extras']['targets']],
               'system/teeth/teeth_base/teeth_base.obj', 'system/teeth/teeth_base/teeth_base.mhclo', 'system/teeth/teeth_base/teeth.png',
               'system/tongue/tongue01/tongue01.obj', 'system/tongue/tongue01/tongue01.mhclo', 'system/tongue/tongue01/tongue01_diffuse.png']
    doc['extras'].update(neoMouthVersion=1, neoMouthOriginalSha256=hashlib.sha256(raw).hexdigest(),
                         neoMouthSources={name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in sources},
                         jawAngle=angle, jawPivot=hinge.tolist(), jawSource='Pinned MakeHuman jaw family, transferred by retained anatomical UVs',
                         mouthAssets='MakeHuman system CC0 teeth_base/tongue01; original diffuse baked to vertex colors')
    assert binary[:original_size] == raw[28 + size:28 + size + original_size]
    output.parent.mkdir(parents=True, exist_ok=True); builder.OUT = output.parent; builder.write_glb(doc, binary, output.name)
    print(json.dumps({'output': str(output), 'bytes': output.stat().st_size, 'neutralBinaryPreserved': True, 'registeredHeadVertices': matched,
                      'jawVertices': int((weights > .001).sum()), 'oralMeshes': report, 'oralFitRms': float(np.sqrt(((np.column_stack((source_points[local], np.ones(local.sum()))) @ affine - neutral[local]) ** 2).sum(axis=1).mean()))}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--character', required=True, type=Path); parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(); main(args.source, args.character, args.output)
