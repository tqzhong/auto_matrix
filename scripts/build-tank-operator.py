"""Author Tank's first-film operator body from the pinned CC0 anatomy.

The generated face is landmark guidance, not a scan. Geometry, bind matrices,
clothes, exposed fingers and headset ship in one GLB; numpy is authoring-only.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import urllib.request

import numpy as np


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


body = module('build-mouse-body'); builder = body.builder
TARGETS = {'macrodetails/african-male-young': .6, 'macrodetails/asian-male-young': .25,
           'macrodetails/caucasian-male-young': .15,
           'macrodetails/universal-male-young-averagemuscle-averageweight': .55,
           'macrodetails/universal-male-young-maxmuscle-averageweight': .45,
           'head/head-fat-decr': .20, 'chin/chin-width-incr': .12,
           'nose/nose-scale-depth-incr': .12, 'nose/nose-width2-incr': .1}


def build(source, output, portrait):
    output.mkdir(parents=True, exist_ok=True)
    assert not (output / 'tank.glb').exists(), 'Review a new output directory.'
    for name in TARGETS:
        path = source / (name + '.target')
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            url = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{builder.REVISION}/makehuman/data/targets/{name}.target'
            with urllib.request.urlopen(url, timeout=60) as response: path.write_bytes(response.read())
    builder.CHARACTERS['tank'] = {'height': 4.35, 'support': True, 'hair': None,
                                  'skin': 'middleage_african_male', 'targets': TARGETS}
    with tempfile.TemporaryDirectory(prefix='matrix-tank-') as temp:
        builder.OUT = Path(temp); builder.main(source, 'tank')
        raw = (builder.OUT / 'tank.glb').read_bytes(); length = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + length]); binary = bytearray(raw[28 + length:])
        for image in doc['images']:
            if image['uri'] == 'tank-skin.png': (output / image['uri']).write_bytes((builder.OUT / image['uri']).read_bytes())
    metadata = doc['extras']

    def array(index, width):
        item = doc['accessors'][index]; view = doc['bufferViews'][item['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[item['componentType']]
        return np.frombuffer(binary, dtype=dtype, count=item['count'] * width,
                             offset=view.get('byteOffset', 0) + item.get('byteOffset', 0)).reshape(-1, width).copy()

    names = [doc['nodes'][i]['name'].replace('_', '.') for i in doc['skins'][0]['joints']]
    rest = np.linalg.inv(array(doc['skins'][0]['inverseBindMatrices'], 16).reshape(-1, 4, 4).transpose(0, 2, 1))[:, :3, 3]
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, amount in TARGETS.items():
        for line in (source / (name + '.target')).read_text().splitlines():
            values = line.split()
            if len(values) == 4 and not line.startswith('#'):
                base[int(values[0])] += np.array([float(x) for x in values[1:]]) * amount
    skeleton = json.loads((source / 'default.mhskel').read_text())
    def pivot(name): return base[skeleton['joints'][skeleton['bones'][name]['head']]].mean(axis=0)
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
    weights = np.zeros((len(base), len(names)))
    for name, entries in json.loads((source / 'default_weights.mhw').read_text())['weights'].items():
        for vertex, amount in entries: weights[vertex, mapped(name)] += amount
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
    rotations = np.tile(np.eye(3), (len(names), 1, 1))
    for side in ['R', 'L']:
        for start, end in [('shoulder', 'elbow'), ('elbow', 'wrist'), ('hip', 'knee'), ('knee', 'ankle')]:
            a, b = [names.index(part + '.' + side) for part in [start, end]]
            rotations[a] = builder.align(pivots[b] - pivots[a], rest[b] - rest[a])
        for i, name in enumerate(names):
            if name.startswith(('wrist', 'finger')) and name.endswith('.' + side): rotations[i] = rotations[names.index('elbow.' + side)]
    body_faces = [f for f, group in zip(faces, groups) if group == 'body']
    source_eye = pivot('eye.L'); source_y = [pivot('neck01')[1], base[780, 1], base[492, 1], base[474, 1], base[455, 1], base[343, 1], source_eye[1], base[[i for f in body_faces for i, _ in f], 1].max()]
    base, uv, faces, weights = builder.subdivide(base, uv, body_faces, weights)
    points = np.zeros_like(base)
    for i in range(len(names)): points += ((base - pivots[i]) @ rotations[i].T * metadata['sourceScale'] + rest[i]) * weights[:, i:i + 1]
    eye = np.array(metadata['eye']); head_y = rest[3, 1]
    portrait_y = np.interp(base[:, 1], source_y, [1235, 882, 766, 734, 705, 632, 496, 180])
    pixel_scale = .335 / (882 - 496); xscale = (424 - 207) * pixel_scale / (2 * source_eye[0])
    fit = np.column_stack((base[:, 0] * xscale, (496 - portrait_y) * pixel_scale, (base[:, 2] - source_eye[2]) * xscale + .185))
    fitted_scale = eye[0] / (source_eye[0] * xscale)
    target = fit * fitted_scale + [0, eye[1], eye[2] - .185 * fitted_scale]
    # Blend the new face into the same anatomical neck, never a floating mask.
    blend = np.clip((points[:, 1] - (head_y - .22)) / .22, 0, 1); blend *= blend * (3 - 2 * blend)
    points += (target - points) * blend[:, None]
    normals = body.normals(points, faces)
    arm_ids = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]
    hand_ids = [i for i, name in enumerate(names) if name.startswith(('wrist', 'finger'))]
    arm, hand = weights[:, arm_ids].sum(axis=1), weights[:, hand_ids].sum(axis=1)

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binary.extend(b'\x00' * (-len(binary) % 4)); view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes}); binary.extend(values.tobytes())
        doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                                 'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1
    def material(name, color, roughness=.9):
        doc['materials'].append({'name': name, 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'roughnessFactor': roughness, 'metallicFactor': 0}})
        return len(doc['materials']) - 1
    def export(name, p, tex, polygons, influence, mat, extras=None, additional=None, corner_uv=None):
        n = body.normals(p, polygons); pairs, lookup, indices = [], {}, []
        for f in polygons:
            for j in range(1, len(f) - 1):
                for pair in [f[0], f[j], f[j + 1]]:
                    key = (pair[0], *np.round(tex[pair[1]], 7))
                    if corner_uv is not None: key += tuple(np.round(corner_uv[pair[1]], 7))
                    if key not in lookup: lookup[key] = len(pairs); pairs.append(pair)
                    indices.append(lookup[key])
        vi, ti = np.array(pairs).T; joints = np.argsort(-influence[vi], axis=1)[:, :4]
        sw = np.take_along_axis(influence[vi], joints, axis=1); sw /= np.maximum(sw.sum(axis=1, keepdims=True), 1e-8)
        coord = tex[ti].copy(); coord[:, 1] = 1 - coord[:, 1]
        attrs = {'POSITION': accessor(p[vi], 'VEC3'), 'NORMAL': accessor(n[vi], 'VEC3'), 'TEXCOORD_0': accessor(coord, 'VEC2'), 'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
        for key, (values, kind) in (additional or {}).items(): attrs[key] = accessor(values[vi], kind)
        if corner_uv is not None: attrs['_BODY_UV'] = accessor(corner_uv[ti], 'VEC2')
        index = len(doc['meshes']); doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': mat}]})
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'mesh': index, 'skin': 0, 'extras': extras or {}})
        return index
    selected = [i for i, m in enumerate(doc['meshes']) if m['name'] in ['Tailored trousers', 'shoes01', 'high-poly']]
    skin = next(i for i, m in enumerate(doc['materials']) if m['name'] == 'Skin')
    doc['materials'][skin]['pbrMetallicRoughness']['baseColorFactor'] = [1, .96, .91, 1]
    skin_faces = [f for f in faces if max(arm[[i for i, _ in f]]) > .45 and max(points[[i for i, _ in f], 1]) < head_y - .12]
    selected.append(export('Anatomical head and hands', points, uv, skin_faces, weights, skin))
    face_faces = [f for f in faces if min(points[[i for i, _ in f], 1]) > head_y - .55]
    face_mat = material('Tank face', [1, 1, 1], .64)
    image_id = len(doc['images']); doc['images'].append({'uri': 'tank-face-reference.png'}); doc['textures'].append({'source': image_id, 'sampler': 0})
    portrait_texture = len(doc['textures']) - 1
    doc['materials'][face_mat]['pbrMetallicRoughness']['baseColorTexture'] = {'index': portrait_texture}
    u = 315.5 + base[:, 0] * xscale / pixel_scale
    face_uv = np.column_stack((np.clip(u, 110, 520) / 1254, 1 - portrait_y / 1254))
    visible_face = np.unique([i for face in face_faces for i, _ in face])
    candidates = visible_face[(points[visible_face, 1] > eye[1] - .08) & (points[visible_face, 1] < eye[1] + .025)]
    ear_index = candidates[np.argmin(points[candidates, 0])]
    ear_z = fit[ear_index, 2]
    nose_z = max(fit[i, 2] for i in visible_face if abs(fit[i, 0]) < .025 and -.15 < fit[i, 1] < 0)
    profile_x = np.where(fit[:, 2] < .185, 751 + (.185 - fit[:, 2]) * (1070 - 751) / (.185 - ear_z),
                         751 - (fit[:, 2] - .185) * (751 - 645) / (nose_z - .185))
    profile = np.column_stack((profile_x / 1254, portrait_y / 1254))
    fade = np.clip((fit[:, 2] - .035) / .14, 0, 1) * np.clip((.25 - np.abs(fit[:, 0])) / .075, 0, 1)
    fade *= np.clip((fit[:, 1] + .41) / .16, 0, 1)
    face_polys = [[(i, i) for i, _ in f] for f in face_faces]
    portrait_corners, body_corners, skin_polys = [], [], []
    for face in face_faces:
        polygon = []
        for i, u in face:
            polygon.append((i, len(portrait_corners)))
            portrait_corners.append(face_uv[i]); body_corners.append([uv[u, 0], 1 - uv[u, 1]])
        skin_polys.append(polygon)
    neck_fade = np.clip((points[:, 1] - eye[1] + .45) / .16, 0, 1)
    ear_surface = np.clip((np.abs(points[:, 0]) - abs(eye[0]) * 1.8) / (abs(eye[0]) * .5), 0, 1)
    selected.append(export('Tank face', points, np.array(portrait_corners), skin_polys, weights, face_mat, {'tankHead': True}, {'TEXCOORD_1': (profile, 'VEC2'), '_FACE_WEIGHT': (fade, 'SCALAR'), '_NECK_FADE': (neck_fade, 'SCALAR'), '_EAR_SURFACE': (ear_surface, 'SCALAR')}, np.array(body_corners)))

    shirt = points + normals * .038
    trunk = np.clip(1 - arm / .4, 0, 1); shirt[:, 0] *= 1 + trunk * .035; shirt[:, 2] *= 1 + trunk * .04
    hem = np.where(arm > .35, min(rest[names.index('shoulder.' + s), 1] for s in ['R', 'L']) - .43, metadata['waist'][1] - .12)
    cloth = builder.trim_neckline(shirt, uv, faces, weights, hem, above=True)
    p, t, f, w = cloth; neckline = head_y - .21 - .12 * np.clip((p[:, 2] - .02) / .22, 0, 1)
    p, t, f, w = builder.trim_neckline(p, t, f, w, neckline)
    shirt_mat = material('Tank ribbed cotton', [.038, .061, .066], .97)
    cloth_uv = np.column_stack((np.arctan2(p[:, 0], p[:, 2]) / (2 * np.pi), p[:, 1]))
    selected.append(export('Tank ribbed shirt', p, cloth_uv, [[(i, i) for i, _ in face] for face in f], w, shirt_mat))
    # Straps are sampled on the actual shirt so they share its bend and never
    # hang rigidly through the chest. Front and back join over the shoulders.
    strap = p + body.normals(p, f) * .014
    sp, st, sf, sw = builder.trim_neckline(strap, t, f, w, metadata['waist'][1] - .04, above=True)
    def strap_center(p): return .26 + .12 * np.clip((p[:, 1] - 2.7) / .9, 0, 1)
    sp, st, sf, sw = builder.trim_neckline(sp, st, sf, sw, sp[:, 1] + strap_center(sp) - .052 - np.abs(sp[:, 0]), above=True)
    sp, st, sf, sw = builder.trim_neckline(sp, st, sf, sw, sp[:, 1] + strap_center(sp) + .052 - np.abs(sp[:, 0]))
    selected.append(export('Tank harness', sp, st, sf, sw, material('Tank worn harness', [.018, .014, .011], .8)))
    wrist = min(rest[names.index('wrist.' + s), 1] for s in ['R', 'L'])
    gp, gt, gf, gw = builder.trim_neckline(points + normals * .015, uv, skin_faces, weights, wrist + .36)
    distal_ids = [i for i, name in enumerate(names) if name.startswith('finger') and not name.startswith('finger1-1')]
    gp, gt, gf, gw = builder.trim_neckline(gp, gt, gf, gw, gp[:, 1] + .55 - gw[:, distal_ids].sum(axis=1))
    glove_uv = np.column_stack((np.arctan2(gp[:, 0] - np.sign(gp[:, 0]) * abs(rest[names.index('wrist.R'), 0]), gp[:, 2]) / (2 * np.pi), gp[:, 1]))
    selected.append(export('Tank fingerless gloves', gp, glove_uv, [[(i, i) for i, _ in face] for face in gf], gw, material('Tank knitted mitts', [.20, .185, .145], .99)))

    front = np.clip((points[:, 2] - eye[2] + .07) / .09, 0, 1)
    side = np.clip((np.abs(points[:, 0]) - abs(eye[0]) * 1.1) / (abs(eye[0]) * .8), 0, 1)
    back = np.clip((eye[2] - .14 - points[:, 2]) / .14, 0, 1)
    hairline = eye[1] + .015 + .12 * front * (1 - side * .7) - .07 * back
    hp, ht, hf, hw = builder.trim_neckline(points, face_uv, face_polys, weights, hairline, above=True)
    hn = body.normals(hp, hf)
    hair_depth = .019 + .022 * np.clip((hp[:, 1] - eye[1]) / .18, 0, 1)
    hp += hn * (hair_depth + .003 * np.sin(hp[:, 0] * 157) * np.cos(hp[:, 1] * 173))[:, None]
    hair_mat = material('Tank short curls', [1, 1, 1], .94)
    doc['materials'][hair_mat]['pbrMetallicRoughness']['baseColorTexture'] = {'index': portrait_texture}
    selected.append(export('Tank curled hair', hp, ht, hf, hw, hair_mat, {'tankHead': True}))

    # A single skinned headset batch, including earpiece and articulated boom.
    verts, tex, polys = [], [], []
    def tube(path, radius, sides=8):
        path = np.array(path); start = len(verts)
        for i, center in enumerate(path):
            direction = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]; direction /= np.linalg.norm(direction)
            a = np.cross(direction, [0, 0, 1] if abs(direction[2]) < .9 else [0, 1, 0]); a /= np.linalg.norm(a); b = np.cross(direction, a)
            for j in range(sides):
                angle = 2 * np.pi * j / sides; verts.append(center + radius * (a * np.cos(angle) + b * np.sin(angle))); tex.append([j / sides, i / max(1, len(path) - 1)])
        for i in range(len(path) - 1):
            for j in range(sides):
                ids = [start + i * sides + j, start + i * sides + (j + 1) % sides, start + (i + 1) * sides + (j + 1) % sides, start + (i + 1) * sides + j]
                polys.append([(k, k) for k in ids])
    # Short curved tufts break the silhouette; all are baked, not simulated.
    triangles = np.array([[face[0][0], face[j][0], face[j + 1][0]] for face in hf for j in range(1, len(face) - 1)])
    area = np.linalg.norm(np.cross(hp[triangles[:, 1]] - hp[triangles[:, 0]], hp[triangles[:, 2]] - hp[triangles[:, 0]]), axis=1)
    random = np.random.default_rng(2718)
    for tri in triangles[random.choice(len(triangles), 420, p=area / area.sum())]:
        mix = random.dirichlet([1, 1, 1]); center = mix @ hp[tri]; normal = mix @ hn[tri]; normal /= np.linalg.norm(normal)
        tangent = np.cross(normal, [0, 1, 0] if abs(normal[1]) < .9 else [1, 0, 0]); tangent /= np.linalg.norm(tangent); bitangent = np.cross(normal, tangent)
        radius = random.uniform(.004, .007); phase = random.uniform(0, 2 * np.pi)
        tube([center + normal * (.002 + .004 * np.sin(a / 1.3)) + radius * (tangent * np.cos(a + phase) + bitangent * np.sin(a + phase)) for a in np.linspace(0, 4.2, 7)], .0015, 3)
    ww = np.zeros((len(verts), len(names))); ww[:, 3] = 1
    selected.append(export('Tank curl strands', np.array(verts), np.array(tex), polys, ww, material('Tank curl fibers', [.0015, .0012, .001], .94), {'tankHead': True}))
    verts, tex, polys = [], [], []
    ear = points[ear_index].copy(); ear[0] -= .012
    tube([ear + [0, np.sin(a) * .065, np.cos(a) * .035] for a in np.linspace(0, 2 * np.pi, 25)], .006)
    path = [ear + [-.008, .07, -.02], ear + [-.018, -.03, 0], ear + [-.015, -.11, .015], [-.15, eye[1] - .24, eye[2] + .015], [-.07, eye[1] - .30, eye[2] + .065], [-.025, eye[1] - .30, eye[2] + .075]]
    tube(path, .006)
    tube([p + np.array([0, .016, -.006]) for p in path[1:]], .004)
    tube([[-.045, eye[1] - .30, eye[2] + .075], [.005, eye[1] - .30, eye[2] + .075]], .018, 12)
    ww = np.zeros((len(verts), len(names))); ww[:, 3] = 1
    selected.append(export('Tank headset', np.array(verts), np.array(tex), polys, ww, material('Tank headset metal', [.035, .045, .05], .48), {'tankHead': True}))
    for i in selected:
        if doc['meshes'][i]['name'] == 'high-poly':
            for node in doc['nodes']:
                if node.get('mesh') == i: node['extras'] = {'tankHead': True}
    metadata.update(tankOperatorVersion=1, sourceHashes={name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in ['base.obj', 'default.mhskel', 'default_weights.mhw'] + [n + '.target' for n in TARGETS]},
                    faceReferenceSha256=hashlib.sha256(portrait.read_bytes()).hexdigest(), fitting='Generated front/profile landmarks on anatomical CC0 skin; not an actor scan.', skinBaked=True)
    result = body.pack(doc, binary, selected, output / 'tank.glb')
    (output / 'tank-face-reference.png').write_bytes(portrait.read_bytes())
    report = {'bytes': (output / 'tank.glb').stat().st_size, 'sha256': hashlib.sha256((output / 'tank.glb').read_bytes()).hexdigest(), 'meshes': {m['name']: result['accessors'][m['primitives'][0]['indices']]['count'] // 3 for m in result['meshes']}, 'sourceRevision': builder.REVISION}
    (output / 'tank-build.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True); parser.add_argument('--portrait', type=Path, required=True)
    args = parser.parse_args(); build(args.source, args.output, args.portrait)
