"""Build the four principal characters from CC0 MakeHuman assets, without Blender.

Authoring dependency: numpy. No Python or external service is used by the game.
Run with --source pointing to the downloaded MakeHuman source/cache directory.
The README beside the GLBs records the source URLs and revision.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import zipfile

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'packages/client/public/assets/characters'
REVISION = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
CHARACTERS = {
    'neo': {
        'height': 4.4, 'tile': 0, 'hair': 'short04', 'skin': 'young_caucasian_male',
        'targets': {
            'macrodetails/caucasian-male-young': .72, 'macrodetails/asian-male-young': .28,
            'macrodetails/universal-male-young-averagemuscle-averageweight': .85,
            'macrodetails/universal-male-young-maxmuscle-averageweight': .15,
            'head/head-rectangular': .45, 'head/head-fat-decr': .25,
            'chin/chin-width-incr': .4, 'chin/chin-prominent-incr': .10,
            'forehead/forehead-scale-vert-decr': .13, 'nose/nose-scale-depth-incr': .12,
            'nose/nose-width2-decr': .05, 'mouth/mouth-scale-horiz-decr': .12,
            'mouth/mouth-upperlip-volume-decr': .2,
            'eyebrows/eyebrows-trans-down': .1,
        },
        'portrait': {'eye': [.393, .605, .461], 'nose': .63, 'mouth': .722, 'chin': .878},
    },
    'trinity': {
        'height': 4.25, 'tile': 1, 'hair': 'short04', 'skin': 'young_caucasian_female',
        'targets': {
            'macrodetails/caucasian-female-young': 1,
            'macrodetails/universal-female-young-averagemuscle-averageweight': .7,
            'macrodetails/universal-female-young-maxmuscle-minweight': .3,
            'head/head-rectangular': .28, 'head/head-fat-decr': .4,
            'chin/chin-width-incr': .4, 'chin/chin-prominent-incr': .15,
            'cheek/l-cheek-bones-incr': .4, 'cheek/r-cheek-bones-incr': .4,
            'nose/nose-curve-convex': .16, 'nose/nose-scale-depth-incr': .12,
            'mouth/mouth-upperlip-volume-decr': .4, 'mouth/mouth-lowerlip-volume-decr': .3,
        },
        'portrait': {'eye': [.389, .604, .465], 'nose': .627, 'mouth': .719, 'chin': .864},
    },
    'smith': {
        'height': 4.4, 'tile': 2, 'hair': 'short04', 'skin': 'middleage_caucasian_male',
        'targets': {
            'macrodetails/caucasian-male-young': .88, 'macrodetails/caucasian-male-old': .12,
            'macrodetails/universal-male-young-averagemuscle-averageweight': 1,
            'head/head-rectangular': .5, 'head/head-fat-decr': .3,
            'chin/chin-height-incr': .18, 'chin/chin-width-incr': .55,
            'chin/chin-cleft-incr': .3, 'nose/nose-scale-depth-incr': .28,
            'nose/nose-hump-incr': .18, 'nose/nose-point-down': .12,
            'mouth/mouth-scale-horiz-incr': .15, 'mouth/mouth-upperlip-volume-decr': .25,
            'eyebrows/eyebrows-angle-down': .28,
        },
        'portrait': {'eye': [.378, .62, .442], 'nose': .604, 'mouth': .695, 'chin': .874},
    },
    'morpheus': {
        'height': 4.5, 'tile': 3, 'hair': None, 'skin': 'middleage_african_male',
        'targets': {
            'macrodetails/african-male-young': .92, 'macrodetails/african-male-old': .08,
            'macrodetails/universal-male-young-maxmuscle-averageweight': .55,
            'macrodetails/universal-male-young-averagemuscle-maxweight': .45,
            'head/head-square': .35, 'head/head-scale-horiz-incr': .36,
            'chin/chin-width-incr': .4, 'chin/chin-prominent-incr': .12,
            'nose/nose-width2-incr': .12, 'neck/neck-scale-horiz-incr': .15,
        },
        'portrait': {'eye': [.375, .611, .429], 'nose': .581, 'mouth': .692, 'chin': .876},
    },
}


def fetch_source(source):
    def download(url, dest):
        if dest.exists():
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        partial = dest.with_suffix(dest.suffix + '.part')
        subprocess.run(['curl', '-fLsS', '--max-time', '300', url, '-o', str(partial)], check=True)
        partial.replace(dest)
    repository = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REVISION}/'
    for remote, local in [('makehuman/data/3dobjs/base.obj', 'base.obj'),
                          ('makehuman/data/rigs/default.mhskel', 'default.mhskel'),
                          ('makehuman/data/rigs/default_weights.mhw', 'default_weights.mhw')]:
        download(repository + remote, source / local)
    for target in {target for character in CHARACTERS.values() for target in character['targets']}:
        download(repository + 'makehuman/data/targets/' + target + '.target', source / (target + '.target'))
    archive = source / 'system-assets.zip'
    download('https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip', archive)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107', 'System asset archive changed; review it before rebuilding.'
    folders = ['clothes/male_elegantsuit01/', 'clothes/shoes01/', 'clothes/female_casualsuit01/',
               'hair/short04/', 'eyes/high-poly/', 'eyes/materials/']
    folders += ['skins/' + character['skin'] + '/' for character in CHARACTERS.values()]
    with zipfile.ZipFile(archive) as assets:
        for name in assets.namelist():
            if name.endswith('/') or '..' in Path(name).parts or not any(name.startswith(folder) for folder in folders):
                continue
            dest = source / 'system' / name; dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(assets.read(name))


def obj(path):
    vertices, uv, faces, groups = [], [], [], []
    group = ''
    for line in path.read_text().splitlines():
        a = line.split()
        if not a:
            continue
        if a[0] == 'v':
            vertices.append([float(x) for x in a[1:4]])
        elif a[0] == 'vt':
            uv.append([float(x) for x in a[1:3]])
        elif a[0] == 'g':
            group = a[1]
        elif a[0] == 'f':
            faces.append([(int(x.split('/')[0]) - 1, int(x.split('/')[1]) - 1) for x in a[1:]])
            groups.append(group)
    return np.array(vertices), np.array(uv), faces, groups


def normalize(v):
    return v / max(np.linalg.norm(v), 1e-10)


def align(a, b):
    a, b = normalize(a), normalize(b)
    v = np.cross(a, b)
    c = np.dot(a, b)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k / max(1 + c, 1e-8)


def subdivide(vertices, uv, faces, influence):
    """One Catmull-Clark pass, sharing geometry across UV seams and skin weights."""
    values = np.column_stack((vertices, influence))
    face_points = np.array([values[[i for i, _ in face]].mean(axis=0) for face in faces])
    edges = {}; incident = {}; neighbors = {}
    for fi, face in enumerate(faces):
        ids = [i for i, _ in face]
        for a, b in zip(ids, ids[1:] + ids[:1]):
            edges.setdefault(tuple(sorted((a, b))), []).append(fi)
            incident.setdefault(a, set()).add(fi)
            neighbors.setdefault(a, set()).add(b); neighbors.setdefault(b, set()).add(a)
    result = list(values.copy())
    boundary = {}
    edge_ids = {}
    for (a, b), adjacent in edges.items():
        edge_ids[a, b] = len(result)
        result.append((values[a] + values[b] + face_points[adjacent].sum(axis=0)) / 4 if len(adjacent) == 2 else (values[a] + values[b]) / 2)
        if len(adjacent) == 1:
            boundary.setdefault(a, []).append(b); boundary.setdefault(b, []).append(a)
    for i, adjacent in incident.items():
        if i in boundary:
            result[i] = values[i] * .75 + values[boundary[i]].mean(axis=0) * .25
        else:
            n = len(neighbors[i]); midpoint = (values[list(neighbors[i])] + values[i]).mean(axis=0) / 2
            result[i] = (face_points[list(adjacent)].mean(axis=0) + midpoint * 2 + values[i] * (n - 3)) / n
    face_start = len(result); result.extend(face_points)
    texcoords = list(uv); new_faces = []
    for fi, face in enumerate(faces):
        tex_center = uv[[u for _, u in face]].mean(axis=0)
        for j, (a, u) in enumerate(face):
            b, v = face[(j + 1) % len(face)]; c, w = face[j - 1]
            start = len(texcoords); texcoords.extend([(uv[u] + uv[v]) / 2, tex_center, (uv[u] + uv[w]) / 2])
            new_faces.append([(a, u), (edge_ids[tuple(sorted((a, b)))], start),
                              (face_start + fi, start + 1), (edge_ids[tuple(sorted((a, c)))], start + 2)])
    result = np.array(result)
    return result[:, :3], np.array(texcoords), new_faces, result[:, 3:]


def trim_neckline(vertices, uv, faces, influence, height):
    """Cut a level garment opening instead of exposing a stair-step face edge."""
    points, texcoords, weights = list(vertices), list(uv), list(influence)
    clipped_faces = []; edge_vertices = {}
    for face in faces:
        clipped = []
        for current, previous in zip(face, face[-1:] + face[:-1]):
            i, u = current; j, v = previous
            a = height - vertices[i, 1]; b = height - vertices[j, 1]
            if (a >= 0) != (b >= 0):
                t = b / (b - a); edge = tuple(sorted((i, j)))
                if edge not in edge_vertices:
                    edge_vertices[edge] = len(points)
                    points.append(vertices[j] + (vertices[i] - vertices[j]) * t)
                    weights.append(influence[j] + (influence[i] - influence[j]) * t)
                clipped.append((edge_vertices[edge], len(texcoords)))
                texcoords.append(uv[v] + (uv[u] - uv[v]) * t)
            if a >= 0: clipped.append(current)
        if len(clipped) >= 3: clipped_faces.append(clipped)
    return np.array(points), np.array(texcoords), clipped_faces, np.array(weights)


def main(source, character):
    spec = CHARACTERS[character]
    original, skin_uv, body_faces, groups = obj(source / 'base.obj')
    base = original.copy()
    for name, weight in spec['targets'].items():
        for line in (source / (name + '.target')).read_text().splitlines():
            a = line.split()
            if len(a) == 4 and not line.startswith('#'):
                base[int(a[0])] += np.array([float(x) for x in a[1:]]) * weight
    rig = json.loads((source / 'default.mhskel').read_text())
    source_weights = json.loads((source / 'default_weights.mhw').read_text())['weights']

    def pivot(name):
        return base[rig['joints'][rig['bones'][name]['head']]].mean(axis=0)

    names = ['pelvis', 'spine', 'chest', 'head']
    parents = [-1, 0, 1, 2]
    pivots = [(pivot('upperleg01.L') + pivot('upperleg01.R')) / 2,
              pivot('spine03'), pivot('spine01'), pivot('head')]
    for side in ['R', 'L']:
        for part, ref, parent in [('shoulder', 'upperarm01', 'chest'), ('elbow', 'lowerarm01', 'shoulder.' + side),
                                  ('wrist', 'wrist', 'elbow.' + side), ('hip', 'upperleg01', 'pelvis'),
                                  ('knee', 'lowerleg01', 'hip.' + side), ('ankle', 'foot', 'knee.' + side)]:
            names.append(part + '.' + side)
            parents.append(names.index(parent))
            pivots.append(pivot(ref + '.' + side))
        for finger in range(1, 6):
            for segment in range(1, 4):
                name = f'finger{finger}-{segment}.{side}'
                names.append(name)
                parents.append(names.index(f'finger{finger}-{segment - 1}.{side}' if segment > 1 else 'wrist.' + side))
                pivots.append(pivot(name))
    pivots = np.array(pivots)

    def mapped(name):
        if name in names:
            return names.index(name)
        side = '.' + name.split('.')[-1]
        for prefix, target in [('upperarm', 'shoulder'), ('lowerarm', 'elbow'), ('metacarpal', 'wrist'),
                               ('upperleg', 'hip'), ('lowerleg', 'knee'), ('toe', 'ankle'), ('foot', 'ankle')]:
            if name.startswith(prefix):
                return names.index(target + side)
        if name.startswith(('neck', 'jaw', 'special', 'eye', 'tongue', 'levator', 'orbicularis', 'oris', 'temporalis', 'oculi', 'risorius')):
            return 3
        if name in ('spine03', 'spine04'):
            return 1
        if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')):
            return 2
        return 0

    weights = np.zeros((len(base), len(names)))
    for name, entries in source_weights.items():
        for vertex, weight in entries:
            weights[vertex, mapped(name)] += weight
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)

    # Bake the source A-pose into a relaxed, straight-legged bind pose. All
    # runtime bones then share world-aligned axes, matching the motion solver.
    rotation = [np.eye(3) for _ in names]
    posed = pivots.copy()
    for side in ['R', 'L']:
        shoulder, elbow, wrist = [names.index(x + '.' + side) for x in ['shoulder', 'elbow', 'wrist']]
        sign = 1 if side == 'L' else -1
        rotation[shoulder] = align(pivots[elbow] - pivots[shoulder], np.array([sign * .08, -1, .02]))
        posed[elbow] = pivots[shoulder] + rotation[shoulder] @ (pivots[elbow] - pivots[shoulder])
        rotation[elbow] = align(pivots[wrist] - pivots[elbow], np.array([sign * .04, -1, .05]))
        posed[wrist] = posed[elbow] + rotation[elbow] @ (pivots[wrist] - pivots[elbow])
        rotation[wrist] = rotation[elbow]
        for i, name in enumerate(names):
            if name.startswith('finger') and name.endswith(side):
                rotation[i] = rotation[wrist]
                posed[i] = posed[wrist] + rotation[wrist] @ (pivots[i] - pivots[wrist])
        hip, knee, ankle = [names.index(x + '.' + side) for x in ['hip', 'knee', 'ankle']]
        rotation[hip] = align(pivots[knee] - pivots[hip], np.array([0, -1, .035]))
        posed[knee] = pivots[hip] + rotation[hip] @ (pivots[knee] - pivots[hip])
        rotation[knee] = align(pivots[ankle] - pivots[knee], np.array([0, -1, -.035]))
        posed[ankle] = posed[knee] + rotation[knee] @ (pivots[ankle] - pivots[knee])
        rotation[ankle] = np.eye(3)
    rotation = np.array(rotation)
    translations = posed - np.einsum('nij,nj->ni', rotation, pivots)

    def bake(vertices, influence):
        result = np.zeros_like(vertices)
        for i in range(len(names)):
            result += (vertices @ rotation[i].T + translations[i]) * influence[:, i:i + 1]
        return result

    # Exclude all authoring helpers. They are never exported or rendered.
    body_faces = [f for f, group in zip(body_faces, groups) if group == 'body']
    body_indices = np.unique([i for f in body_faces for i, _ in f])
    baked = bake(base, weights)
    floor = baked[body_indices, 1].min()
    scale = spec['height'] / (baked[body_indices, 1].max() - floor)

    def game_space(vertices):
        return (vertices - np.array([0, floor, 0])) * scale

    posed = game_space(posed)
    binaries = bytearray()
    doc = {'asset': {'version': '2.0', 'generator': 'auto_matrix CC0 character authoring'},
           'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [],
           'accessors': [], 'bufferViews': [], 'buffers': [], 'images': [], 'textures': [],
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]}

    def accessor(array, kind, component=5126):
        array = np.asarray(array, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        while len(binaries) % 4:
            binaries.append(0)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaries), 'byteLength': array.nbytes})
        binaries.extend(array.tobytes())
        entry = {'bufferView': view, 'componentType': component, 'count': len(array), 'type': kind}
        if kind != 'MAT4':
            entry.update(min=np.atleast_1d(array.min(axis=0)).tolist(), max=np.atleast_1d(array.max(axis=0)).tolist())
        doc['accessors'].append(entry)
        return len(doc['accessors']) - 1

    def texture(path, filename):
        (OUT / filename).write_bytes(path.read_bytes())
        doc['images'].append({'uri': filename})
        doc['textures'].append({'source': len(doc['images']) - 1, 'sampler': 0})
        return len(doc['textures']) - 1

    def material(name, color, roughness, path=None, filename=None, alpha=False):
        pbr = {'baseColorFactor': color, 'roughnessFactor': roughness, 'metallicFactor': 0}
        if path:
            pbr['baseColorTexture'] = {'index': texture(path, filename)}
        entry = {'name': name, 'pbrMetallicRoughness': pbr, 'doubleSided': alpha}
        if alpha:
            entry.update(alphaMode='MASK', alphaCutoff=.42)
        doc['materials'].append(entry)
        return len(doc['materials']) - 1

    system = source / 'system'
    skin_folder = system / 'skins' / spec['skin']
    skin_map = next(skin_folder.glob('*diffuse.png'))
    skin = material('Skin', [.94, .9, .87, 1], .63, skin_map, character + '-skin.png')
    leather = character in ('trinity', 'morpheus')
    suit = material('Coat leather' if leather else 'Coat wool', [.012, .009, .008, 1] if character == 'morpheus' else [.007, .009, .011, 1], .36 if leather else .72)
    pants = material('Trousers', [.006, .007, .009, 1], .86)
    if spec['hair']:
        hair = material('Hair cards', [.37, .32, .29, 1] if character == 'smith' else [.28, .30, .33, 1], .65,
                        system / 'hair' / spec['hair'] / (spec['hair'] + '_diffuse.png'), spec['hair'] + '-hair.png', True)
    shoes = material('Boot leather', [.022, .024, .023, 1], .32)
    eye_map = 'bluegreen_eye.png' if character == 'trinity' else 'grey_eye.png' if character == 'smith' else 'brown_eye.png'
    sclera = material('Eyes', [1, 1, 1, 1], .23, system / 'eyes/materials' / eye_map, eye_map, True)
    if character == 'smith':
        formal = material('Charcoal suit and shirt', [.9, .91, .9, 1], .75,
                          system / 'clothes/male_elegantsuit01/male_elegantsuit01_diffuse.png', 'smith-suit.png')
    joints = []
    for i, name in enumerate(names):
        node = {'name': name.replace('.', '_'), 'translation': (posed[i] - (posed[parents[i]] if parents[i] >= 0 else 0)).tolist()}
        doc['nodes'].append(node)
        joints.append(i)
        if parents[i] >= 0:
            doc['nodes'][parents[i]].setdefault('children', []).append(i)
        else:
            doc['scenes'][0]['nodes'].append(i)
    inverses = np.tile(np.eye(4), (len(names), 1, 1))
    inverses[:, :3, 3] = -posed
    doc['skins'] = [{'joints': joints, 'skeleton': 0, 'inverseBindMatrices': accessor(inverses.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]

    eye = pivot('eye.L')
    nose = base[body_indices][np.argmax(base[body_indices, 2] * (base[body_indices, 1] > eye[1] - 1))]
    print('Face landmarks', 'eye', eye, 'nose', nose)

    def export_mesh(name, vertices, uv, faces, influence, mat, project_face=False):
        if not faces:
            return
        points = game_space(bake(vertices, influence))
        triangles = [(f[0], f[i], f[i + 1]) for f in faces for i in range(1, len(f) - 1)]
        normals = np.zeros_like(points)
        for t in triangles:
            a, b, c = [x[0] for x in t]
            n = np.cross(points[b] - points[a], points[c] - points[a])
            normals[a] += n; normals[b] += n; normals[c] += n
        # Clipping creates duplicate vertices along adjacent faces. Weld their
        # normals by position while retaining independent UVs and skin weights.
        _, welded = np.unique(np.round(points, 5), axis=0, return_inverse=True)
        smooth_normals = np.zeros((welded.max() + 1, 3))
        np.add.at(smooth_normals, welded, normals)
        normals = smooth_normals[welded]
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
        lookup, pairs, indices = {}, [], []
        for t in triangles:
            for pair in t:
                key = (pair[0], *np.round(uv[pair[1]], 7))
                if key not in lookup:
                    lookup[key] = len(pairs); pairs.append(pair)
                indices.append(lookup[key])
        vi, ui = np.array(pairs).T
        # glTF has a top-left texture origin; OBJ uses bottom-left.
        tex = uv[ui].copy(); tex[:, 1] = 1 - tex[:, 1]
        si = np.argsort(-influence[vi], axis=1)[:, :4]
        sw = np.take_along_axis(influence[vi], si, axis=1)
        sw /= np.maximum(sw.sum(axis=1, keepdims=True), 1e-8)
        attrs = {'POSITION': accessor(points[vi], 'VEC3'), 'NORMAL': accessor(normals[vi], 'VEC3'),
                 'TEXCOORD_0': accessor(tex, 'VEC2'), 'JOINTS_0': accessor(si, 'VEC4', 5123), 'WEIGHTS_0': accessor(sw, 'VEC4')}
        if project_face:
            # Piecewise landmark registration puts eyes, nose, lips and chin on
            # geometry, rather than stretching a portrait over a sphere.
            v = vertices[vi]
            portrait = spec['portrait']; chin = base[780, 1]; mouth = base[474, 1]
            top = base[body_indices, 1].max()
            y = np.interp(v[:, 1], [chin - .3, chin, base[492, 1], mouth, base[455, 1], base[343, 1], eye[1], top],
                          [.985, portrait['chin'], portrait['mouth'] + .027, portrait['mouth'], portrait['mouth'] - .025,
                           portrait['nose'], portrait['eye'][2], .025])
            u = (portrait['eye'][0] + portrait['eye'][1]) / 2 + v[:, 0] * ((portrait['eye'][1] - portrait['eye'][0]) / (2 * eye[0]))
            tile = spec['tile']
            # Fade on the sides and under the jaw, across a continuous mesh.
            # The old hard face boundary created a visible mask on the cheek.
            width = max(abs(base[11797, 0]), .65)
            face_weight = np.clip((v[:, 1] - chin + .2) / .3, 0, 1) * np.clip((v[:, 2] - .3) / .55, 0, 1)
            face_weight *= np.clip((width * 1.65 - np.abs(v[:, 0])) / (width * .55), 0, 1)
            silhouette = np.interp(y, [0, .08, .18, .3, .46, .6, .68, .75, .82, .88, .94, 1],
                                   [.035, .15, .235, .275, .275, .245, .22, .19, .155, .14, .18, .18])
            # Never project the portrait's beige background onto the temple.
            face_weight *= np.clip((silhouette - np.abs(u - .5)) / .045, 0, 1)
            # Even the feathered edge must sample skin, not background. Clamp
            # to the interior silhouette before baking; the outer face then
            # fades into the original UV skin without pale cheek islands.
            safe_width = np.maximum(.01, silhouette - .045)
            sample_u = np.clip(u, .5 - safe_width, .5 + safe_width)
            attrs['TEXCOORD_1'] = accessor(np.column_stack(((sample_u + tile % 2) * .5, 1 - (y + tile // 2) * .5)), 'VEC2')
            face_weight = face_weight * face_weight * (3 - 2 * face_weight)
            attrs['_FACE_WEIGHT'] = accessor(face_weight, 'SCALAR')
        mesh_index = len(doc['meshes'])
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': mat}]})
        doc['scenes'][0]['nodes'].append(len(doc['nodes']))
        doc['nodes'].append({'name': name, 'mesh': mesh_index, 'skin': 0})
        print(name, len(pairs), 'vertices', len(indices) // 3, 'triangles')

    hand_bones = [i for i, name in enumerate(names) if name.startswith(('wrist', 'finger'))]
    neckline = pivot('neck01')[1] - .08
    waistline = pivot('spine03')[1] + .9
    exposed = [f for f in body_faces if np.mean(base[[i for i, _ in f], 1]) > neckline - .85 or
               np.mean(weights[[i for i, _ in f]][:, hand_bones].sum(axis=1)) > .85]
    v, uv, faces, w = subdivide(base, skin_uv, exposed, weights)
    export_mesh('Anatomical head and hands', v, uv, faces, w, skin, True)
    if character != 'smith':
        arm_bones = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow'))]
        undershirt = [f for f in body_faces if (np.mean(base[[i for i, _ in f], 1]) > waistline - .3
                     or character == 'trinity' and np.mean(weights[[i for i, _ in f]][:, arm_bones].sum(axis=1)) > .5)
                     and np.mean(base[[i for i, _ in f], 1]) < neckline + .12
                     and (np.max(np.abs(base[[i for i, _ in f], 0])) < 1.58 or character == 'trinity')
                     and np.mean(weights[[i for i, _ in f]][:, hand_bones].sum(axis=1)) < .8]
        shirt_vertices = base.copy(); shirt_vertices[:, [0, 2]] *= 1.025
        v, uv, faces, w = trim_neckline(shirt_vertices, skin_uv, undershirt, weights, neckline)
        v, uv, faces, w = subdivide(v, uv, faces, w)
        export_mesh('Fitted leather jacket' if character == 'trinity' else 'Black crew neck', v, uv, faces, w, suit if character == 'trinity' else pants)

    def clothing(folder, name):
        path = system / folder / name
        vertices, uv, faces, _ = obj(path.with_suffix('.obj'))
        refs, bary, offset = [], [], []
        scales = np.ones(3); active = False
        for line in path.with_suffix('.mhclo').read_text().splitlines():
            a = line.split()
            if not a or a[0].startswith('#'):
                continue
            if a[0] in ('x_scale', 'y_scale', 'z_scale'):
                axis = 'xyz'.index(a[0][0]); scales[axis] = abs(base[int(a[1]), axis] - base[int(a[2]), axis]) / float(a[3])
            elif a[0] == 'verts':
                active = True
            elif active:
                if a[0] == 'material':
                    continue
                if not a[0].lstrip('-').isdigit():
                    active = False
                elif len(a) == 9:
                    refs.append([int(x) for x in a[:3]]); bary.append([float(x) for x in a[3:6]]); offset.append([float(x) for x in a[6:9]])
                elif len(a) == 1:
                    refs.append([int(a[0])] * 3); bary.append([1, 0, 0]); offset.append([0, 0, 0])
        assert len(refs) == len(vertices), (name, len(refs), len(vertices))
        refs, bary = np.array(refs), np.array(bary)
        loft = .6 if name.startswith('short') and character == 'trinity' else .9 if name.startswith('short') else 1
        vertices = (base[refs] * bary[:, :, None]).sum(axis=1) + np.array(offset) * scales * loft
        influence = np.maximum((weights[refs] * bary[:, :, None]).sum(axis=1), 0)
        influence /= np.maximum(influence.sum(axis=1, keepdims=True), 1e-8)
        return vertices, uv, faces, influence

    clothing_name = 'female_casualsuit01' if character == 'trinity' else 'male_elegantsuit01'
    v, uv, faces, w = clothing('clothes/' + clothing_name, clothing_name)
    # The lower connected component is trousers; keep that topology and its
    # knee folds. The tailored jacket supplies shoulders, sleeves and lapels.
    adjacency = [set() for _ in v]
    for f in faces:
        ids = [i for i, _ in f]
        for i in ids:
            adjacency[i].update(ids)
    low = int(np.argmin(v[:, 1])); trousers = set(); queue = [low]
    while queue:
        i = queue.pop()
        if i not in trousers:
            trousers.add(i); queue.extend(adjacency[i] - trousers)
    export_mesh('Tailored trousers', v, uv, [f for f in faces if f[0][0] in trousers], w, suit if character == 'trinity' else pants)
    coat_faces = []; extra_v = list(v); extra_uv = list(uv); extra_w = list(w)
    for f in faces:
        if f[0][0] in trousers:
            continue
        if character == 'trinity':
            continue
        center = v[[i for i, _ in f]].mean(axis=0)
        # Open the formal jacket over Neo's black shirt, removing the stock tie
        # and shirt collar. Clip at the V opening instead of deleting whole
        # faces: selecting by centroid left a visible stair-step neckline.
        if character != 'smith' and waistline < center[1] < neckline + .5 and center[2] > .90:
            polygon = [(v[i], uv[u], w[i]) for i, u in f]
            for side in [-1, 1]:
                clipped = []
                for current, previous in zip(polygon, polygon[-1:] + polygon[:-1]):
                    a = side * current[0][0] - (.10 + .18 * (current[0][1] - waistline))
                    b = side * previous[0][0] - (.10 + .18 * (previous[0][1] - waistline))
                    if (a >= 0) != (b >= 0):
                        t = b / (b - a)
                        clipped.append(tuple(old + (new - old) * t for old, new in zip(previous, current)))
                    if a >= 0:
                        clipped.append(current)
                if len(clipped) >= 3:
                    face = []
                    for position, texcoord, influence in clipped:
                        face.append((len(extra_v), len(extra_uv)))
                        extra_v.append(position); extra_uv.append(texcoord); extra_w.append(influence)
                    coat_faces.append(face)
        else:
            coat_faces.append(f)
    export_mesh('Tailored coat upper', np.array(extra_v), np.array(extra_uv), coat_faces, np.array(extra_w), formal if character == 'smith' else suit)
    accessories = [('clothes/shoes01', 'shoes01', shoes), ('eyes/high-poly', 'high-poly', sclera)]
    if spec['hair']:
        accessories.append(('hair/' + spec['hair'], spec['hair'], hair))
    for folder, name, mat in accessories:
        v, uv, faces, w = clothing(folder, name)
        if name.startswith('short'):
            v, uv, faces, w = subdivide(v, uv, faces, w)
            # Subdivision of thin hair strips can sink their roots through the
            # scalp. Push them to the outside of the anatomical surface.
            normal = np.zeros_like(base)
            for face in body_faces:
                ids = [i for i, _ in face]
                n = np.cross(base[ids[1]] - base[ids[0]], base[ids[2]] - base[ids[0]])
                normal[ids] += n
            normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-8)
            scalp = body_indices[base[body_indices, 1] > eye[1] - .5]
            for start in range(0, len(v), 256):
                points = v[start:start + 256]
                nearest = scalp[np.argmin(((points[:, None, :] - base[scalp]) ** 2).sum(axis=2), axis=1)]
                distance = ((points - base[nearest]) * normal[nearest]).sum(axis=1)
                points += normal[nearest] * np.maximum(.025 - distance, 0)[:, None]
        export_mesh(name, v, uv, faces, w, mat)

    # Store dimensions for animation and for attaching glasses/coat details.
    doc['extras'] = {'character': character, 'height': spec['height'], 'eye': game_space(eye).tolist(),
                     'head': posed[3].tolist(), 'floor': float(floor), 'sourceScale': float(scale),
                     'waist': [0, spec['height'] * .55, 0],
                     'targets': spec['targets'], 'sourceRevision': REVISION}
    doc['buffers'] = [{'byteLength': len(binaries)}]
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    binaries += b'\x00' * ((-len(binaries)) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binaries))
    glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binaries), 0x004E4942) + binaries
    (OUT / (character + '.glb')).write_bytes(glb)
    print('Written', OUT / (character + '.glb'), len(glb), 'bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path(tempfile.gettempdir()) / 'matrix-character-source')
    parser.add_argument('--fetch', action='store_true', help='Download the pinned CC0 source assets into the cache')
    parser.add_argument('--character', choices=list(CHARACTERS), help='Rebuild only one character')
    parser.add_argument('--output', type=Path, default=OUT, help='Asset directory; use a staging directory to review before replacing the game assets')
    args = parser.parse_args()
    OUT = args.output; OUT.mkdir(parents=True, exist_ok=True)
    if args.fetch:
        fetch_source(args.source)
    for character in [args.character] if args.character else CHARACTERS:
        main(args.source, character)
