"""Append a source-weighted jaw and CC0 oral meshes, retaining the neutral head.

Authoring only: numpy/Pillow, pinned MakeHuman source and the checked system
asset archive extracted into source/system. No runtime Python or new texture.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('head_builder', Path(__file__).with_name('build-epilogue-heads.py'))
heads = importlib.util.module_from_spec(spec); spec.loader.exec_module(heads)


def main(source, head, output):
    raw = head.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:28 + size + doc['buffers'][0]['byteLength']])
    assert doc['extras']['role'] == 'cypher' and doc['extras']['sourceRevision'] == heads.REVISION
    assert 'mouthVersion' not in doc['extras'], 'Start with the neutral head, not an already extended mouth asset.'
    original_bytes = len(binary)

    def read(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dtype = {5126: '<f4', 5125: '<u4'}[a['componentType']]
        return np.frombuffer(binary, dtype, a['count'] * count, v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, count).copy()

    def accessor(array, kind='VEC3', component=5126):
        array = np.asarray(array, dtype='<f4' if component == 5126 else '<u4')
        while len(binary) % 4: binary.append(0)
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': array.nbytes})
        binary.extend(array.tobytes()); index = len(doc['accessors'])
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(array), 'type': kind,
                                 'min': np.atleast_1d(array.min(axis=0)).tolist(), 'max': np.atleast_1d(array.max(axis=0)).tolist()})
        return index

    settings = heads.REFERENCES['cypher']; base, uv, faces, groups = heads.builder.obj(source / 'base.obj')
    for name, weight in settings['targets'].items():
        rows = np.loadtxt(source / (name + '.target')); base[rows[:, 0].astype(int)] += rows[:, 1:] * weight
    rig = json.loads((source / 'default.mhskel').read_text()); source_weights = json.loads((source / 'default_weights.mhw').read_text())['weights']
    family = {'jaw'}
    for _ in rig['bones']: family.update(n for n, b in rig['bones'].items() if b.get('parent') in family)
    influence = np.zeros((len(base), 1))
    for name in family:
        for vertex, weight in source_weights.get(name, []): influence[vertex, 0] += weight
    influence = np.clip(influence, 0, 1)
    pivot = lambda name: base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)
    eye, neck = pivot('eye.L'), pivot('neck01')
    body = [f for f, group in zip(faces, groups) if group == 'body' and max(base[[v for v, _ in f], 1]) > neck[1] - .1]
    clipped, clipped_uv, body, skin = heads.builder.trim_neckline(base, uv, body, influence, neck[1] - .1, above=True)
    points, _, body, skin = heads.builder.subdivide(clipped, clipped_uv, body, skin)
    used = np.unique([v for f in body for v, _ in f]); remap = {v: i for i, v in enumerate(used)}
    quads = [[(remap[v], 0) for v, _ in f] for f in body]
    triangles = np.array([[f[0][0], f[i][0], f[i + 1][0]] for f in quads for i in range(1, len(f) - 1)])
    primitive = doc['meshes'][0]['primitives'][0]; neutral = read(primitive['attributes']['POSITION']).astype(float)
    assert len(used) == len(neutral) and np.array_equal(read(primitive['indices']).ravel(), triangles.ravel()), 'Head topology differs from the pinned source.'
    source_y = [neck[1], base[780, 1], base[492, 1], base[474, 1], base[455, 1], base[343, 1], eye[1], points[used, 1].max()]
    pixel_scale = -settings['chin'] / (settings['ys'][1] - settings['eye'][2]); x_scale = doc['extras']['eye'][0] / eye[0]

    def fitted(values):
        result = values.copy(); result[:, 0] *= x_scale
        result[:, 1] = (settings['eye'][2] - np.interp(values[:, 1], source_y, settings['ys'])) * pixel_scale
        result[:, 2] = (values[:, 2] - eye[2]) * x_scale + .185
        return result

    hinge = fitted(pivot('jaw')[None])[0]; angle = .32
    rotation = np.array([[1, 0, 0], [0, np.cos(angle), -np.sin(angle)], [0, np.sin(angle), np.cos(angle)]])
    turn = lambda values: (values - hinge) @ rotation.T + hinge
    fade = np.clip((neutral[:, 1] + .38) / .06, 0, 1); fade = fade * fade * (3 - 2 * fade)
    jaw_weight = np.clip(skin[used, 0], 0, 1) * fade
    delta = (turn(neutral) - neutral) * jaw_weight[:, None]
    normal_delta = heads.normals(neutral + delta, quads) - heads.normals(neutral, quads)
    primitive['attributes']['_JAW_WEIGHT'] = accessor(jaw_weight[:, None], 'SCALAR')
    primitive['targets'][0]['NORMAL'] = accessor(np.zeros_like(neutral))
    primitive['targets'].append({'POSITION': accessor(delta), 'NORMAL': accessor(normal_delta)})
    doc['meshes'][0]['weights'].append(0); doc['meshes'][0]['extras']['targetNames'].append('jawOpen')

    def proxy(kind, name):
        root = source / 'system' / kind / name; values, texcoords, polys, _ = heads.builder.obj(root / (name + '.obj'))
        refs, bary, offset = [], [], []; scales = np.ones(3); active = False
        for line in (root / (name + '.mhclo')).read_text().splitlines():
            a = line.split()
            if not a or a[0].startswith('#'): continue
            if a[0] in ('x_scale', 'y_scale', 'z_scale'):
                axis = 'xyz'.index(a[0][0]); scales[axis] = abs(base[int(a[1]), axis] - base[int(a[2]), axis]) / float(a[3])
            elif a[0] == 'verts': active = True
            elif active:
                if not a[0].lstrip('-').isdigit(): active = False
                elif len(a) == 9:
                    refs.append([int(x) for x in a[:3]]); bary.append([float(x) for x in a[3:6]]); offset.append([float(x) for x in a[6:9]])
                elif len(a) == 1: refs.append([int(a[0])] * 3); bary.append([1, 0, 0]); offset.append([0, 0, 0])
        assert len(refs) == len(values)
        refs, bary = np.array(refs), np.array(bary); values = (base[refs] * bary[:, :, None]).sum(axis=1) + np.array(offset) * scales
        jaw = np.clip((influence[refs, 0] * bary).sum(axis=1), 0, 1)
        texture = root / ('teeth.png' if kind == 'teeth' else 'tongue01_diffuse.png')
        image = np.asarray(Image.open(texture).convert('RGB'), dtype=float) / 255
        colors, counts = np.zeros((len(values), 3)), np.zeros(len(values))
        for poly in polys:
            for vertex, tex in poly:
                u, v = texcoords[tex]; color = image[int(np.clip((1 - v) * image.shape[0], 0, image.shape[0] - 1)), int(np.clip(u * image.shape[1], 0, image.shape[1] - 1))]
                colors[vertex] += np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4); counts[vertex] += 1
        return fitted(values), polys, jaw, colors / np.maximum(counts[:, None], 1)

    def oral(name, values, polys, colors, lower):
        indices = np.unique([v for poly in polys for v, _ in poly]); lookup = {v: i for i, v in enumerate(indices)}
        attrs = {'POSITION': accessor(values[indices]), 'NORMAL': accessor(heads.normals(values, polys)[indices]), 'COLOR_0': accessor(colors[indices])}
        faces = np.array([[lookup[f[0][0]], lookup[f[i][0]], lookup[f[i + 1][0]]] for f in polys for i in range(1, len(f) - 1)])
        material = len(doc['materials']); doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .43 if 'teeth' in name else .76, 'metallicFactor': 0}})
        part = {'attributes': attrs, 'indices': accessor(faces.ravel(), 'SCALAR', 5125), 'material': material}
        mesh = {'name': name, 'primitives': [part]}
        if lower:
            moved = turn(values)
            part['targets'] = [{'POSITION': accessor((moved - values)[indices]), 'NORMAL': accessor((heads.normals(moved, polys) - heads.normals(values, polys))[indices])}]
            mesh['weights'] = [0]; mesh['extras'] = {'targetNames': ['jawOpen']}
        index = len(doc['meshes']); doc['meshes'].append(mesh)
        doc['nodes'].append({'mesh': index, 'name': name}); doc['scenes'][0]['nodes'].append(len(doc['nodes']) - 1)
        return {'vertices': len(indices), 'triangles': len(faces)}

    teeth, polys, weights, colors = proxy('teeth', 'teeth_base'); report = {}
    for lower in [False, True]:
        name = 'cypher-teeth-lower' if lower else 'cypher-teeth-upper'
        selected = [f for f in polys if bool(weights[[v for v, _ in f]].mean() >= .5) == lower]
        report[name] = oral(name, teeth, selected, colors, lower)
    tongue, polys, _, colors = proxy('tongue', 'tongue01'); report['cypher-tongue'] = oral('cypher-tongue', tongue, polys, colors, True)
    doc['extras'].update(mouthVersion=1, jawPivot=hinge.tolist(), jawAngle=angle, mouthAssets='MakeHuman system CC0 teeth_base/tongue01; vertex colors baked from original diffuse textures')
    assert binary[:original_bytes] == raw[28 + size:28 + size + original_bytes], 'Neutral binary changed.'
    heads.builder.OUT = output.parent; output.parent.mkdir(parents=True, exist_ok=True); heads.builder.write_glb(doc, binary, output.name)
    print(json.dumps({'output': str(output), 'originalBinaryPreserved': True, 'oralMeshes': report, 'bytes': output.stat().st_size, 'jawVertices': int((jaw_weight > .001).sum())}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--head', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); main(args.source, args.head, args.output)
