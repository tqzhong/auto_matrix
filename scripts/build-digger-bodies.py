"""Fit CC0 anatomy and dock clothing to the existing Zee/Charra performance rig.

Uses the pinned MakeHuman source and NumPy from the character authoring pipeline.
The separate head assets and gameplay joint lengths are intentionally retained.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct
import urllib.request

import numpy as np

spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
CAPTAINS = {
    'niobe': {'shoulders': .50, 'race': 'african', 'sex': 'female', 'neck_sample': [256 / 1024, 453 / 1536]},
    'lock': {'shoulders': .62, 'race': 'african', 'sex': 'male', 'neck_sample': [256 / 1024, 944 / 1536]},
    'roland': {'shoulders': .64, 'race': 'caucasian', 'sex': 'male', 'neck_sample': [256 / 1024, 1484 / 1536]},
}
PROGRAMS = {
    'architect': {'shoulders': .65, 'race': 'caucasian', 'sex': 'male'},
    'seraph': {'shoulders': .58, 'race': 'asian', 'sex': 'male'},
    'keymaker': {'shoulders': .55, 'race': 'asian', 'sex': 'male'},
    'rama_kandra': {'shoulders': .61, 'race': 'asian', 'sex': 'male'},
    'kamala': {'shoulders': .51, 'race': 'asian', 'sex': 'female'},
    'trainman': {'shoulders': .54, 'race': 'caucasian', 'sex': 'male'},
}
COUNCILLORS = {
    'hamann': {'shoulders': .59, 'race': 'caucasian', 'sex': 'male'},
    'west': {'shoulders': .66, 'race': 'african', 'sex': 'male'},
    'dillard': {'shoulders': .52, 'race': 'caucasian', 'sex': 'female'},
}

HAMMER_CREW = {
    'bane': {'shoulders': .66, 'race': 'caucasian', 'sex': 'male'},
    'maggie': {'shoulders': .51, 'race': 'caucasian', 'sex': 'female'},
    'colt': {'shoulders': .61, 'race': 'caucasian', 'sex': 'male'},
    'link': {'shoulders': .57, 'race': 'african', 'sex': 'male'},
}


def normals(points, faces):
    result = np.zeros_like(points)
    for face in faces:
        ids = [i for i, _ in face]
        n = np.cross(points[ids[1]] - points[ids[0]], points[ids[2]] - points[ids[0]])
        result[ids] += n
    return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-10)


def cloth_sections(points, faces, arms, bottom=1.9):
    """Convex horizontal sections bridge the chest instead of tracing skin."""
    triangles = np.array([[f[0][0], f[i][0], f[i + 1][0]] for f in faces for i in range(1, len(f) - 1)])
    triangles = triangles[arms[triangles].max(axis=1) < .25]
    heights = np.linspace(bottom, 3.23, 48)
    angles = np.arange(96) * np.pi * 2 / 96
    directions = np.column_stack((np.sin(angles), np.cos(angles)))

    def cross(a, b): return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]

    sections = []
    for height in heights:
        intersection = []
        for a, b in [(0, 1), (1, 2), (2, 0)]:
            start, end = points[triangles[:, a]], points[triangles[:, b]]
            cut = (start[:, 1] > height) != (end[:, 1] > height)
            start, end = start[cut], end[cut]
            t = (height - start[:, 1]) / (end[:, 1] - start[:, 1])
            intersection.extend((start + (end - start) * t[:, None])[:, [0, 2]])
        ordered = sorted(set(map(tuple, np.round(intersection, 7))))
        outline = []
        for sequence in [ordered, ordered[::-1]]:
            chain = []
            for point in sequence:
                while len(chain) >= 2 and cross(np.subtract(chain[-1], chain[-2]), np.subtract(point, chain[-1])) <= 0: chain.pop()
                chain.append(point)
            outline.extend(chain[:-1])
        outline = np.array(outline); edges = np.roll(outline, -1, axis=0) - outline
        denominator = cross(directions[:, None, :], edges[None, :, :])
        denominator[np.abs(denominator) < 1e-10] = 1e-10
        radius = cross(outline, edges)[None, :] / denominator
        along = cross(outline[None, :, :], directions[:, None, :]) / denominator
        radius[(along < 0) | (along > 1) | (radius < 0)] = np.inf
        section = radius.min(axis=1)
        assert np.isfinite(section).all(), f'Open garment section at {height}'
        sections.append(section)
    sections = np.array(sections)
    for _ in range(6):
        padded = np.pad(sections, ((1, 1), (0, 0)), mode='edge')
        sections = (padded[:-2] + 2 * padded[1:-1] + padded[2:]) / 4
        sections = (np.roll(sections, 1, axis=1) + 2 * sections + np.roll(sections, -1, axis=1)) / 4
    return heights, sections


def head_neck_section(role):
    """Read the actual fitted head, whose neck sits behind the rig origin."""
    data = (builder.ROOT / 'packages/client/public/assets/characters' / (role + '-head.glb')).read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length]); binary = data[28 + length:]

    def array(index, width):
        accessor = doc['accessors'][index]; view = doc['bufferViews'][accessor['bufferView']]
        return np.frombuffer(binary, dtype='<f4' if accessor['componentType'] == 5126 else '<u4',
                             count=accessor['count'] * width, offset=view.get('byteOffset', 0)).reshape(-1, width)

    mesh = next(mesh for mesh in doc['meshes'] if mesh['name'] == role + '-anatomical-head')['primitives'][0]
    points = array(mesh['attributes']['POSITION'], 3); triangles = array(mesh['indices'], 1).reshape(-1, 3)
    section = []
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        start, end = points[triangles[:, a]], points[triangles[:, b]]
        crosses = (start[:, 1] > -.45) != (end[:, 1] > -.45)
        start, end = start[crosses], end[crosses]
        t = (-.45 - start[:, 1]) / (end[:, 1] - start[:, 1])
        section.extend((start + (end - start) * t[:, None])[:, [0, 2]])
    section = np.array(section); center = (section.min(axis=0) + section.max(axis=0)) / 2
    offset = section - center; angles = np.arctan2(offset[:, 0], offset[:, 1]); radius = np.linalg.norm(offset, axis=1)
    order = np.argsort(angles)
    return center, angles[order], radius[order]


def main(source, output, role):
    program = PROGRAMS.get(role)
    council = COUNCILLORS.get(role)
    crew = HAMMER_CREW.get(role)
    captain = CAPTAINS.get(role); profile = captain or program or council or crew; sleeved = bool(profile and (profile['sex'] == 'male' or role == 'kamala' or council or crew))
    sex = profile['sex'] if profile else 'female'; race = profile['race'] if profile else 'african' if role == 'zee' else 'caucasian'
    targets = {'macrodetails/' + race + '-' + sex + '-young': 1,
               'macrodetails/universal-' + sex + '-young-averagemuscle-averageweight': .7,
               'macrodetails/universal-' + sex + '-young-maxmuscle-' + ('averageweight' if sleeved else 'minweight'): .3}
    if role in ['architect', 'keymaker', 'rama_kandra', 'trainman']:
        targets['macrodetails/universal-male-young-averagemuscle-averageweight'] = .92
        targets['macrodetails/universal-male-young-maxmuscle-averageweight'] = .08
    if council:
        targets['macrodetails/' + race + '-' + sex + '-young'] = .20
        targets['macrodetails/' + race + '-' + sex + '-old'] = .80
        targets['macrodetails/universal-' + sex + '-young-averagemuscle-averageweight'] = 1
        targets['macrodetails/universal-' + sex + '-young-maxmuscle-averageweight'] = 0
    files = {'base.obj': '3dobjs/base.obj', 'default.mhskel': 'rigs/default.mhskel',
             'default_weights.mhw': 'rigs/default_weights.mhw'}
    files.update({name + '.target': 'targets/' + name + '.target' for name in targets})
    for local, remote in files.items():
        path = source / local
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{builder.REVISION}/makehuman/data/{remote}', timeout=90) as response:
                path.write_bytes(response.read())
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, amount in targets.items():
        # The average-weight target intentionally contains only its header:
        # it is MakeHuman's neutral body, with no vertex deltas.
        rows = [line.split() for line in (source / (name + '.target')).read_text().splitlines() if line and not line.startswith('#')]
        if rows:
            values = np.array(rows, dtype=float)
            base[values[:, 0].astype(int)] += values[:, 1:] * amount
    source_rig = json.loads((source / 'default.mhskel').read_text())
    source_weights = json.loads((source / 'default_weights.mhw').read_text())['weights']

    def pivot(name):
        return base[source_rig['joints'][source_rig['bones'][name]['head']]].mean(axis=0)

    names = ['pelvis', 'torso', 'neck']
    source_pivots = [(pivot('upperleg01.L') + pivot('upperleg01.R')) / 2, pivot('spine03'), pivot('neck01')]
    rest = [[0, 1.86, 0], [0, 1.86, 0], [0, 3.44, 0]]
    shoulder_x = (profile['shoulders'] if profile else .5 if role == 'zee' else .56) * .87
    for side, sign in [('R', -1), ('L', 1)]:
        for part, ref, point in [('shoulder', 'upperarm01', [sign * shoulder_x, 3.25, 0]),
                                 ('elbow', 'lowerarm01', [sign * shoulder_x, 2.44, 0]),
                                 ('wrist', 'wrist', [sign * shoulder_x, 1.79, .005]),
                                 ('hip', 'upperleg01', [sign * .225, 1.86, 0]),
                                 ('knee', 'lowerleg01', [sign * .225, .92, 0]),
                                 ('ankle', 'foot', [sign * .225, .02, 0])]:
            names.append(part + '_' + side); source_pivots.append(pivot(ref + '.' + side)); rest.append(point)
        for finger in range(4):
            ref = 2 + (finger if side == 'L' else 3 - finger)
            names.append(f'finger{finger}_{side}'); source_pivots.append(pivot(f'finger{ref}-1.{side}'))
            rest.append([sign * shoulder_x - .063 + finger * .041, 1.62, .01])
    rest, source_pivots = np.array(rest), np.array(source_pivots)

    def mapped(name):
        side = name.split('.')[-1]
        for prefix, target in [('upperarm', 'shoulder'), ('lowerarm', 'elbow'), ('wrist', 'wrist'),
                               ('metacarpal', 'wrist'), ('upperleg', 'hip'), ('lowerleg', 'knee'), ('toe', 'ankle'), ('foot', 'ankle')]:
            if name.startswith(prefix): return names.index(target + '_' + side)
        if name.startswith('finger'):
            finger = int(name[6])
            return names.index('wrist_' + side if finger == 1 else f'finger{finger - 2 if side == "L" else 5 - finger}_{side}')
        if name.startswith(('neck', 'head', 'jaw', 'special', 'eye', 'tongue', 'levator', 'orbicularis', 'oris', 'temporalis', 'oculi', 'risorius')): return 2
        if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')): return 1
        return 0

    weights = np.zeros((len(base), len(names)))
    for name, entries in source_weights.items():
        for vertex, value in entries: weights[vertex, mapped(name)] += value
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-10)
    # Affine fitting bakes each anatomical segment into the existing relaxed
    # bind pose. The runtime subsequently needs only rigid joint transforms.
    hip_source = source_pivots[0]
    sy = 1.39 / (pivot('upperarm01.L')[1] - hip_source[1])
    sx = shoulder_x / pivot('upperarm01.L')[0]
    matrices = np.tile(np.diag([sx, sy, .27]), (len(names), 1, 1))
    source_pivots[1] = hip_source
    source_pivots[2] = pivot('neck01')
    for side, sign in [('R', -1), ('L', 1)]:
        for part, endpoint, width in [('shoulder', 'elbow', .265), ('elbow', 'wrist', .25), ('hip', 'knee', .245), ('knee', 'ankle', .25)]:
            i, j = names.index(part + '_' + side), names.index(endpoint + '_' + side)
            a, b = source_pivots[j] - source_pivots[i], rest[j] - rest[i]
            axis = builder.normalize(a)
            stretch = np.eye(3) * width + np.outer(axis, axis) * (np.linalg.norm(b) / np.linalg.norm(a) - width)
            matrices[i] = builder.align(a, b) @ stretch
        wrist = names.index('wrist_' + side)
        across = builder.normalize((pivot(f'finger5-1.{side}') - pivot(f'finger2-1.{side}')) * sign)
        down = builder.normalize(pivot(f'finger3-1.{side}') - pivot('wrist.' + side))
        across = builder.normalize(across - down * np.dot(across, down))
        basis = np.column_stack((across, down, np.cross(across, down)))
        width = .123 / np.linalg.norm(pivot(f'finger5-1.{side}') - pivot(f'finger2-1.{side}'))
        length = .17 / np.linalg.norm(pivot(f'finger3-1.{side}') - pivot('wrist.' + side))
        matrices[wrist] = np.diag([width, -length, -.22]) @ basis.T
        for finger in range(4):
            i = names.index(f'finger{finger}_{side}')
            ref = 2 + (finger if side == 'L' else 3 - finger)
            direction = pivot(f'finger{ref}-3.{side}') - source_pivots[i]
            matrices[i] = builder.align(direction, np.array([0, -1, 0])) * .24
        ankle = names.index('ankle_' + side)
        matrices[ankle] = np.diag([.27, .25, .27])
    translation = rest - np.einsum('nij,nj->ni', matrices, source_pivots)
    points = np.zeros_like(base)
    for i in range(len(names)): points += (base @ matrices[i].T + translation[i]) * weights[:, i:i + 1]
    faces = [face for face, group in zip(faces, groups) if group == 'body']
    # No anatomical head is exported: first-person head hiding and the
    # separately fitted continuous head/neck remain owned by EpilogueHeads.
    points, uv, faces, weights = builder.trim_neckline(points, uv, faces, weights, 3.54)
    points, uv, faces, weights = builder.subdivide(points, uv, faces, weights)
    center, neck_angles, neck_radius = head_neck_section(role)
    blend = np.clip((points[:, 1] - 3.28) / .22, 0, 1); blend = blend * blend * (3 - 2 * blend)
    theta = np.arctan2(points[:, 0], points[:, 2] - .03)
    fitted_radius = np.interp(theta, neck_angles, neck_radius, period=2 * np.pi) * .98
    fitted = np.column_stack((np.sin(theta), np.cos(theta))) * fitted_radius[:, None] + center
    points[:, [0, 2]] = points[:, [0, 2]] * (1 - blend[:, None]) + fitted * blend[:, None]
    weights *= 1 - blend[:, None]; weights[:, 2] += blend
    normal = normals(points, faces)
    binaries = bytearray()
    doc = {'asset': {'version': '2.0', 'generator': 'auto_matrix dock anatomy and garments'},
           'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [],
           'extras': {'role': role, 'sourceRevision': builder.REVISION, 'targets': targets, 'joints': names,
                      'fitting': 'CC0 anatomy fitted to existing performance joints; approximate dock costume, not actor scan data.'}}

    def accessor(array, kind, component=5126):
        a = np.asarray(array, dtype={5126: '<f4', 5123: '<u2', 5125: '<u4'}[component])
        binaries.extend(b'\x00' * (-len(binaries) % 4))
        view = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaries), 'byteLength': a.nbytes})
        binaries.extend(a.tobytes())
        entry = {'bufferView': view, 'componentType': component, 'count': len(a), 'type': kind}
        if kind != 'MAT4': entry.update(min=np.atleast_1d(a.min(axis=0)).tolist(), max=np.atleast_1d(a.max(axis=0)).tolist())
        doc['accessors'].append(entry); return len(doc['accessors']) - 1

    # Flat bind bones receive the established performance joints in model
    # space. No new hierarchy changes the existing hand/foot contact solver.
    for name, point in zip(names, rest):
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'translation': point.tolist()})
    inverses = np.tile(np.eye(4), (len(names), 1, 1)); inverses[:, :3, 3] = -rest
    doc['skins'] = [{'joints': list(range(len(names))), 'inverseBindMatrices': accessor(inverses.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]
    for name, color, roughness in [('Skin', [1, 1, 1], .73), ('Dock cloth', [.07, .08, .06], .94),
                                    ('Dock trousers', [.027, .033, .026], .95), ('Dock boots', [.012, .015, .012], .79),
                                    ('Dock bindings', [.035, .039, .028], .93)]:
        doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'metallicFactor': 0, 'roughnessFactor': roughness}, 'doubleSided': True})
    if program:
        doc['materials'][4]['pbrMetallicRoughness']['baseColorFactor'] = [.66, .65, .59, 1] if role == 'architect' else [.74, .71, .61, 1]
        for name, color, roughness in [('Program shirt', [.80, .79, .73] if role == 'architect' else [.025, .030, .028], .91),
                                        ('Program tie', [.13, .15, .15], .86)]:
            doc['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'metallicFactor': 0, 'roughnessFactor': roughness}, 'doubleSided': True})
        if role == 'rama_kandra': doc['materials'][5]['pbrMetallicRoughness']['baseColorFactor'] = [.86, .86, .78, 1]
        if role == 'trainman': doc['materials'][5]['pbrMetallicRoughness']['baseColorFactor'] = [.22, .20, .14, 1]
        if role in ['rama_kandra', 'kamala', 'trainman']: doc['materials'][4]['pbrMetallicRoughness']['baseColorFactor'] = [.12, .14, .11, 1]

    def export(name, p, tex, polygons, w, material, wardrobe=None):
        triangles = [[f[0], f[i], f[i + 1]] for f in polygons for i in range(1, len(f) - 1)]
        n = normals(p, polygons)
        lookup, pairs, indices = {}, [], []
        for tri in triangles:
            for pair in tri:
                key = (pair[0], *np.round(tex[pair[1]], 7))
                if key not in lookup: lookup[key] = len(pairs); pairs.append(pair)
                indices.append(lookup[key])
        vi, ui = np.array(pairs).T
        joints = np.argsort(-w[vi], axis=1)[:, :4]; values = np.take_along_axis(w[vi], joints, axis=1)
        values /= np.maximum(values.sum(axis=1, keepdims=True), 1e-10)
        fitted_uv = tex[ui].copy()
        if name == role + '-anatomical-body':
            # The exposed neck uses the same atlas strip as EpilogueHeads;
            # remove the color break where the two fitted meshes overlap.
            blend = np.clip((p[vi, 1] - 3.22) / .24, 0, 1)[:, None]
            neck_uv = np.column_stack(((.25 + p[vi, 0] * .10 - .232) / .035,
                                       (.445 + np.clip(3.69 - p[vi, 1], 0, .2) * .12 - .452) / .02))
            if captain or program or council or crew:
                neck_uv[:, 1] = (.002 + np.clip(3.69 - p[vi, 1], 0, .2) * .03) / .012
            fitted_uv = fitted_uv * (1 - blend) + neck_uv * blend
        attrs = {'POSITION': accessor(p[vi], 'VEC3'), 'NORMAL': accessor(n[vi], 'VEC3'), 'TEXCOORD_0': accessor(fitted_uv, 'VEC2'),
                 'JOINTS_0': accessor(joints, 'VEC4', 5123), 'WEIGHTS_0': accessor(values, 'VEC4')}
        doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'mesh': len(doc['meshes']), 'skin': 0})
        if wardrobe: doc['nodes'][-1]['extras'] = {'wardrobe': wardrobe}
        doc['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': accessor(indices, 'SCALAR', 5125), 'material': material}]})
        print(role, name, len(pairs), 'vertices', len(indices) // 3, 'triangles')

    arm_ids = [i for i, name in enumerate(names) if name.startswith(('shoulder', 'elbow', 'wrist', 'finger'))]
    arms = weights[:, arm_ids].sum(axis=1)
    # A sleeveless work top has a scooped front neck and wide shoulder straps.
    # Both the garment and exposed skin are clipped against these same cuts.
    x, y, z = points.T
    neck_height = 3.42 - .22 * np.exp(-(x / .19) ** 4) * np.clip((z + .1) / .22, 0, 1)
    armhole = .35 + .20 * np.clip((y - 2.93) / .4, 0, 1)
    covered = np.minimum(neck_height - y, (armhole - arms))
    covered = np.minimum(covered, y - 1.97)
    if sleeved:
        neck_height = 3.42 - .33 * np.clip(1 - np.abs(x) / .27, 0, 1) * np.clip((z + .1) / .22, 0, 1)
        covered = np.minimum(neck_height - y, y - np.where(arms > .3, 1.82, 1.97))
    if program:
        # A modern suit opens onto a full shirt. Seraph's earlier Chinese
        # jacket closes at the throat; his park jacket opens onto a dark top.
        neck_height = 3.45 - (.78 * np.clip(1 - np.abs(x) / .30, 0, 1) * np.clip((z + .02) / .14, 0, 1) if role in ['architect', 'keymaker', 'rama_kandra', 'trainman'] else 0)
        covered = np.minimum(neck_height - y, y - np.where(arms > .3, 1.82, 1.82 if role in ['architect', 'keymaker', 'rama_kandra', 'kamala', 'trainman'] else 1.98))
    if council or crew:
        neck_height = 3.43 - .085 * np.exp(-(x / .19) ** 4) * np.clip((z + .1) / .22, 0, 1)
        covered = np.minimum(neck_height - y, y - np.where(arms > .3, 1.82, 1.88))
    skin_covered = np.minimum(3.44 - y, y - np.where(arms > .3, 1.82, 1.97)) if program else covered
    skin_p, skin_uv, skin_faces, skin_w = builder.trim_neckline(points, uv, faces, weights, y + skin_covered - .008, above=True)
    skin_p, skin_uv, skin_faces, skin_w = builder.trim_neckline(skin_p, skin_uv, skin_faces, skin_w, 1.96, above=True,
                                                              preserve=skin_w[:, arm_ids].sum(axis=1) > .3)
    export(role + '-anatomical-body', skin_p, skin_uv, skin_faces, skin_w, 0)

    vest = points + normal * .018
    # Smooth small anatomical indentations before adding cloth folds. This
    # changes garment vertices only; the shoulder/arm skin stays continuous.
    adjacency = {}
    for face in faces:
        ids = [i for i, _ in face]
        for a, b in zip(ids, ids[1:] + ids[:1]): adjacency.setdefault(a, set()).add(b); adjacency.setdefault(b, set()).add(a)
    for _ in range(5):
        smooth = vest.copy()
        for i, neighbors in adjacency.items():
            if arms[i] < .55 and 2.06 < y[i] < 3.3: smooth[i] = vest[i] * .35 + vest[list(neighbors)].mean(axis=0) * .65
        vest = smooth
    heights, sections = cloth_sections(points, faces, arms)
    angle = np.mod(np.arctan2(x, z), np.pi * 2) / (np.pi * 2) * sections.shape[1]
    torso_surface = (arms < .2) | ((role == 'kamala') & (np.abs(x) < .43) & (z > .035))
    for i in np.flatnonzero(torso_surface & (y >= 1.94) & (y < 3.22)):
        a = int(angle[i]) % sections.shape[1]; t = angle[i] - np.floor(angle[i])
        radius = np.interp(y[i], heights, sections[:, a] * (1 - t) + sections[:, (a + 1) % sections.shape[1]] * t)
        radius += (.065 if role == 'kamala' else .018) + .022 * np.clip((2.55 - y[i]) / .5, 0, 1)
        blend = min(1, (3.22 - y[i]) / .10)
        radial = points[i, [0, 2]] / max(np.hypot(x[i], z[i]), 1e-8) * radius
        vest[i, [0, 2]] = vest[i, [0, 2]] * (1 - blend) + radial * blend
    folds = (.003 * np.sin(y * 28 + np.arctan2(x, z) * 5) + .002 * np.sin(y * 43 - x * 17)) * np.clip((2.9 - y) / .6, 0, 1)
    vest += normal * folds[:, None]
    if program:
        # Section smoothing must not pull a jacket inside its anatomical
        # undershirt, especially beside the chest and shoulder blades.
        clearance = ((vest - points) * normal).sum(axis=1)
        vest += normal * np.maximum(.026 - clearance, 0)[:, None]
    vp, vu, vf, vw = builder.trim_neckline(vest, uv, faces, weights, vest[:, 1] + covered + .012)
    export(role + ('-tailored-jacket' if role == 'architect' else '-work-jacket' if role == 'keymaker' else '-traditional-top' if role == 'seraph' else '-work-top'), vp, vu, vf, vw, 1, 'matrix' if role == 'seraph' else 'dock' if role == 'niobe' else None)
    if role == 'niobe':
        # She wears a burgundy long-sleeved sweater in the Hammer meeting.
        # Retain the sleeveless dock top as a separate scene wardrobe.
        clearance = ((vest - points) * normal).sum(axis=1)
        sweater = vest + normal * (np.maximum(.025 - clearance, 0) * (arms > .25))[:, None]
        neckline = 3.43 - .09 * np.exp(-(x / .19) ** 4) * np.clip((z + .1) / .22, 0, 1)
        cut = np.minimum(neckline - y, y - np.where(arms > .3, 1.82, 1.95))
        sp, su, sf, sw = builder.trim_neckline(sweater, uv, faces, weights, sweater[:, 1] + cut)
        export('niobe-briefing-sweater', sp, su, sf, sw, 1, 'briefing')
    # Sewn armhole/neck bindings have actual thickness in silhouette.
    edge_count = {}
    for face in vf:
        ids = [i for i, _ in face]
        for a, b in zip(ids, ids[1:] + ids[:1]):
            edge = tuple(sorted((a, b))); edge_count[edge] = edge_count.get(edge, 0) + 1
    ep, eu, ef, ew = [], [], [], []
    for (a, b), count in edge_count.items():
        if count != 1: continue
        direction = builder.normalize(vp[b] - vp[a]); across = builder.normalize(np.cross(direction, [0, 0, 1]))
        out = np.cross(direction, across); start = len(ep)
        for vertex in [a, b]:
            for segment in range(8):
                angle = segment / 8 * np.pi * 2
                ep.append(vp[vertex] + (across * np.cos(angle) + out * np.sin(angle)) * .006)
                eu.append([segment / 8, 0 if vertex == a else 1]); ew.append(vw[vertex])
        for segment in range(8):
            ids = [start + segment, start + (segment + 1) % 8, start + 8 + (segment + 1) % 8, start + 8 + segment]
            ef.append([(j, j) for j in ids])
    export(role + '-sewn-bindings', np.array(ep), np.array(eu), ef, np.array(ew), 4, 'matrix' if role == 'seraph' else 'dock' if role == 'niobe' else None)

    if sleeved and not program and not council and not crew:
        # Woven layered V collars and a diagonal wrap seam belong to Zion,
        # rather than a modern buttoned military uniform. Fit each strip to
        # the actual garment front and carry its neighboring skin weights.
        cp, cu, cf, cw = [], [], [], []
        paths = [[[-.29, 3.36], [0, 3.075], [.29, 3.36]],
                 [[-.32, 3.29], [.015, 3.015], [.32, 3.29]],
                 [[.18, 3.22], [-.32, 2.63]]]
        for path in paths:
            for a, b in zip(path, path[1:]):
                a, b = np.array(a), np.array(b); across = builder.normalize([-(b - a)[1], (b - a)[0]])
                start = len(cp)
                for row in range(25):
                    t = row / 24; at = a * (1 - t) + b * t
                    for edge in [-1, 1]:
                        xy = at + across * edge * .027
                        distance = (vest[:, 0] - xy[0]) ** 2 + (vest[:, 1] - xy[1]) ** 2 + (vest[:, 2] < 0) * 100
                        nearby = np.argmin(distance)
                        cp.append([*xy, vest[nearby, 2] + .016]); cu.append([(edge + 1) / 2, t]); cw.append(weights[nearby])
                    if row:
                        ids = [start + (row - 1) * 2, start + row * 2, start + row * 2 + 1, start + (row - 1) * 2 + 1]
                        cf.append([(j, j) for j in ids])
        export(role + '-wrap-collar', np.array(cp), np.array(cu), cf, np.array(cw), 4)

    if program:
        # Fit subdivided tailoring to the actual garment surface, retaining
        # its local shoulder/torso weights instead of attaching flat cards.
        front_faces = np.array([[f[0][0], f[i][0], f[i + 1][0]] for f in faces for i in range(1, len(f) - 1)])
        front_points = vest[front_faces]
        front_origin = front_points[:, 0, :2]
        ab, ac = front_points[:, 1, :2] - front_origin, front_points[:, 2, :2] - front_origin
        determinant = ab[:, 0] * ac[:, 1] - ab[:, 1] * ac[:, 0]
        valid = np.abs(determinant) > 1e-10
        front_faces, front_points, front_origin, ab, ac, determinant = [value[valid] for value in [front_faces, front_points, front_origin, ab, ac, determinant]]

        def front_patch(name, outline, material, wardrobe=None, lift=.020):
            p, tex, polygons, influence = [], [], [], []
            center = np.array(outline).mean(axis=0)
            for a, b in zip(outline, outline[1:] + outline[:1]):
                a, b = np.array(a), np.array(b); start = len(p); rows = 16
                for row in range(rows + 1):
                    for column in range(row + 1):
                        xy = center * (1 - row / rows) + a * ((row - column) / rows) + b * (column / rows)
                        offset = xy - front_origin
                        u = (offset[:, 0] * ac[:, 1] - offset[:, 1] * ac[:, 0]) / determinant
                        v = (ab[:, 0] * offset[:, 1] - ab[:, 1] * offset[:, 0]) / determinant
                        inside = np.flatnonzero((u >= -1e-7) & (v >= -1e-7) & (u + v <= 1 + 1e-7))
                        if len(inside):
                            barycentric = np.column_stack((1 - u[inside] - v[inside], u[inside], v[inside]))
                            depth = (front_points[inside, :, 2] * barycentric).sum(axis=1)
                            index = np.argmax(depth); at = inside[index]
                            height = depth[index]; weight = (weights[front_faces[at]] * barycentric[index, :, None]).sum(axis=0)
                        else:
                            distance = (vest[:, 0] - xy[0]) ** 2 + (vest[:, 1] - xy[1]) ** 2 + (vest[:, 2] < 0) * 100
                            nearby = np.argsort(distance)[:3]; mix = 1 / np.maximum(distance[nearby], 1e-8); mix /= mix.sum()
                            height = vest[nearby, 2] @ mix; weight = (weights[nearby] * mix[:, None]).sum(axis=0)
                        p.append([*xy, height + lift]); tex.append([column / max(1, row), row / rows]); influence.append(weight)
                        if row and column:
                            upper = start + (row - 1) * row // 2 + column - 1
                            lower = start + row * (row + 1) // 2 + column - 1
                            polygons.append([(j, j) for j in [upper, lower, lower + 1]])
                            if column < row: polygons.append([(j, j) for j in [upper, lower + 1, upper + 1]])
            export(role + '-' + name, np.array(p), np.array(tex), polygons, np.array(influence), material, wardrobe)

        if role in ['architect', 'keymaker', 'rama_kandra', 'trainman']:
            shirt = points + normal * .010
            shirt_cut = np.minimum(3.45 - y, y - np.where(arms > .3, 1.79, 1.98))
            sp, su, sf, sw = builder.trim_neckline(shirt, uv, faces, weights, shirt[:, 1] + shirt_cut)
            export(role + '-shirt', sp, su, sf, sw, 5)
            for sign in [-1, 1]:
                front_patch('lapel-' + str(sign), [[sign * x, y] for x, y in [[.17, 3.43], [.36, 3.29], [.30, 3.18], [.42, 3.10], [.15, 2.62], [.095, 2.72]]], 1, lift=.033)
                front_patch('shirt-collar-' + str(sign), [[sign * x, y] for x, y in [[.10, 3.51], [.26, 3.36], [.16, 3.15], [.045, 3.37]]], 5, lift=.024)
                front_patch('welt-pocket-' + str(sign), [[sign * x, y] for x, y in [[.23, 2.17], [.46, 2.18], [.46, 2.14], [.23, 2.13]]], 1, lift=.027)
            if role in ['architect', 'rama_kandra']:
                front_patch('tie-knot', [[-.039, 3.36], [.039, 3.36], [.025, 3.27], [-.025, 3.27]], 6, lift=.043)
                front_patch('tie', [[-.025, 3.285], [.025, 3.285], [.055, 2.72], [0, 2.65], [-.055, 2.72]], 6, lift=.027)
            elif role == 'keymaker':
                doc['materials'][5]['pbrMetallicRoughness']['baseColorFactor'] = [.58, .59, .50, 1]
                doc['materials'][6]['name'] = 'Keymaker apron'
                doc['materials'][6]['pbrMetallicRoughness'].update(baseColorFactor=[.027, .030, .024, 1], roughnessFactor=.78)
                # The worn leather work apron is a fitted garment, including
                # its neck strap and layered pocket, rather than a dark torso.
                front_patch('apron-bib', [[-.28, 2.96], [.28, 2.96], [.39, 2.08], [-.39, 2.08]], 6, lift=.050)
                front_patch('apron-pocket', [[-.26, 2.59], [.26, 2.59], [.26, 2.35], [-.26, 2.35]], 6, lift=.062)
                for sign in [-1, 1]:
                    front_patch('apron-strap-' + str(sign), [[sign * a, b] for a, b in [[.11, 3.40], [.14, 3.40], [.27, 2.96], [.23, 2.96]]], 6, lift=.048)
                doc['materials'].append({'name': 'Keymaker keys', 'pbrMetallicRoughness': {'baseColorFactor': [.43, .35, .17, 1], 'metallicFactor': .72, 'roughnessFactor': .42}, 'doubleSided': True})
                kp, ku, kf, kw = [], [], [], []

                def key_patch(outline):
                    start = len(kp)
                    for xy in outline:
                        distance = (vest[:, 0] - xy[0]) ** 2 + (vest[:, 1] - xy[1]) ** 2 + (vest[:, 2] < 0) * 100
                        nearby = np.argsort(distance)[:3]; mix = 1 / np.maximum(distance[nearby], 1e-8); mix /= mix.sum()
                        kp.append([*xy, vest[nearby, 2] @ mix + .080]); ku.append([xy[0], xy[1]])
                        kw.append((weights[nearby] * mix[:, None]).sum(axis=0))
                    kf.append([(j, j) for j in range(start, len(kp))])

                for sign in [-1, 1]:
                    for key in range(3):
                        cx, cy = sign * (.31 + key * .031), 2.20 - key * .028
                        for segment in range(12):
                            angles = np.array([segment, segment + 1]) / 12 * 2 * np.pi
                            outer = np.column_stack((cx + np.cos(angles) * .017, cy + np.sin(angles) * .017))
                            inner = np.column_stack((cx + np.cos(angles) * .010, cy + np.sin(angles) * .010))
                            key_patch([outer[0].tolist(), outer[1].tolist(), inner[1].tolist(), inner[0].tolist()])
                        key_patch([[cx - .004, cy - .008], [cx + .004, cy - .008], [cx + .004, cy - .13], [cx - .004, cy - .13]])
                        key_patch([[cx, cy - .09], [cx + .018, cy - .09], [cx + .018, cy - .117], [cx, cy - .117]])
                export('keymaker-keys', np.array(kp), np.array(ku), kf, np.array(kw), 7)
            # A suit jacket extends across the hips; it cannot inherit the
            # dock vest's short hem or split around the anatomical crotch.
            hem_heights, hem_sections = cloth_sections(points, faces, arms, bottom=1.08 if role == 'trainman' else 1.55) if role in ['rama_kandra', 'trainman'] else (heights, sections)
            hp, hu, hf, hw = [], [], [], []
            for row in range(13):
                t = row / 12; height = 2.08 - (1.00 if role == 'trainman' else .50) * t
                for column in range(96):
                    angle = column / 96 * 2 * np.pi
                    radius = np.interp(height, hem_heights, hem_sections[:, column]) + (.09 if role in ['rama_kandra', 'trainman'] else .018) + .040 * t
                    hp.append([np.sin(angle) * radius, height, np.cos(angle) * radius]); hu.append([column / 96, t])
                    weight = np.zeros(len(names)); weight[0] = t; weight[1] = 1 - t; hw.append(weight)
                    if row and not (role == 'trainman' and (column < 5 or column > 90)):
                        a = (row - 1) * 96 + column; b = (row - 1) * 96 + (column + 1) % 96
                        hf.append([(j, j) for j in [a, a + 96, b + 96, b]])
            export(role + '-jacket-hem', np.array(hp), np.array(hu), hf, np.array(hw), 1)
            if role == 'keymaker':
                ap, au, af, aw = [], [], [], []
                for row in range(17):
                    t = row / 16; height = 2.13 - .68 * t
                    radius = np.interp(height, heights, sections[:, 0]) + .065 + .040 * t
                    for column in range(25):
                        x = (column / 12 - 1) * (.38 + .015 * t)
                        ap.append([x, height, np.sqrt(max(.001, radius * radius - x * x)) + .004 * np.sin(column * 1.8) * t])
                        au.append([column / 24, t]); weight = np.zeros(len(names)); weight[0] = t; weight[1] = 1 - t; aw.append(weight)
                        if row and column:
                            a = (row - 1) * 25 + column - 1
                            af.append([(j, j) for j in [a, a + 1, a + 26, a + 25]])
                export('keymaker-apron-skirt', np.array(ap), np.array(au), af, np.array(aw), 6)
        elif role == 'kamala':
            for sign in [-1, 1]:
                front_patch('blouse-collar-' + str(sign), [[sign * x, y] for x, y in [[.10, 3.48], [.27, 3.32], [.16, 3.14], [.045, 3.35]]], 1, lift=.024)
            front_patch('blouse-placket', [[-.012, 3.30], [.012, 3.30], [.012, 1.85], [-.012, 1.85]], 1, lift=.012)
        else:
            opening = np.where((vest[:, 2] > .025) & (arms < .3), np.abs(vest[:, 0]) - (.11 + .07 * np.clip((3.3 - y) / 1.3, 0, 1)), 1)
            cut = np.minimum(covered, opening)
            op, ou, of, ow = builder.trim_neckline(vest, uv, faces, weights, vest[:, 1] + cut)
            export('seraph-park-jacket', op, ou, of, ow, 1, 'park')
            undershirt = points + normal * .009
            cut = np.minimum(3.39 - y, y - np.where(arms > .3, 2.65, 1.99))
            ip, iu, inf, iw = builder.trim_neckline(undershirt, uv, faces, weights, undershirt[:, 1] + cut)
            export('seraph-park-undershirt', ip, iu, inf, iw, 5, 'park')
            for wardrobe in ['matrix', 'park']:
                # A stand collar follows the fitted neck, with an open throat
                # in the park rather than a recolored closed uniform.
                cp, cu, cf, cw = [], [], [], []
                for row in range(5):
                    height = 3.39 + row * .027
                    for column in range(65):
                        angle = (.65 if wardrobe == 'park' else .10) + column / 64 * (2 * np.pi - (1.30 if wardrobe == 'park' else .20))
                        r = np.interp(angle, neck_angles, neck_radius, period=2 * np.pi) + .021
                        cp.append([center[0] + np.sin(angle) * r, height, center[1] + np.cos(angle) * r]); cu.append([column / 64, row / 4])
                        weight = np.zeros(len(names)); weight[1] = 1; cw.append(weight)
                        if row and column:
                            a = (row - 1) * 65 + column - 1; cf.append([(j, j) for j in [a, a + 1, a + 66, a + 65]])
                export('seraph-' + wardrobe + '-stand-collar', np.array(cp), np.array(cu), cf, np.array(cw), 1, wardrobe)
            for index, height in enumerate([3.28, 3.04, 2.80, 2.56, 2.32]):
                front_patch('frog-closure-' + str(index), [[-.115, height + .012], [.115, height + .012], [.115, height - .012], [-.115, height - .012]], 4, 'matrix', lift=.027)

    # Relaxed trousers bridge skin details, add ease around thighs and knees,
    # and share the anatomical hip weights across the continuous crotch.
    pants = points + normal * ((.005 if role == 'kamala' else .055 if program else .025) + (.002 if role == 'kamala' else .018) * np.exp(-((y - 1.2) / .8) ** 2))[:, None]
    crease = (.003 if program else .009) * np.sin(y * 42 + x * 14) * np.exp(-((y - .92) / .3) ** 2)
    pants += normal * crease[:, None]
    for _ in range(5):
        smooth = pants.copy()
        for i, neighbors in adjacency.items():
            if .27 < y[i] < 2.08: smooth[i] = pants[i] * .4 + pants[list(neighbors)].mean(axis=0) * .6
        pants = smooth
    pp, pu, pf, pw = builder.trim_neckline(pants, uv, faces, weights, 2.08)
    # Hands in the relaxed bind pose must not become part of the trousers.
    pp, pu, pf, pw = builder.trim_neckline(pp, pu, pf, pw, pp[:, 1] + .1 - pw[:, arm_ids].sum(axis=1))
    pp, pu, pf, pw = builder.trim_neckline(pp, pu, pf, pw, .14 if program else .24, above=True)
    export(role + ('-bare-legs' if role == 'kamala' else '-work-trousers'), pp, pu, pf, pw, 0 if role == 'kamala' else 2)

    # Shallow, bevelled cargo pockets move with the upper legs. A separate
    # folded flap reads as a pocket instead of a box glued to the thigh.
    pocket_points, pocket_uv, pocket_faces, pocket_weights = [], [], [], []
    for side, sign in [('R', -1), ('L', 1)]:
        hip = names.index('hip_' + side)
        for flap in [False, True]:
            start = len(pocket_points)
            for row in range(7):
                h = 1.39 + row / 6 * .34 if not flap else 1.67 + row / 6 * .085
                for column in range(7):
                    z = -.16 + column / 6 * .3
                    bevel = np.sin(row / 6 * np.pi) * np.sin(column / 6 * np.pi)
                    pocket_points.append([sign * (.455 + .028 * bevel + (.009 if flap else 0)), h, z])
                    pocket_uv.append([column / 6, row / 6]); weight = np.zeros(len(names)); weight[hip] = 1; pocket_weights.append(weight)
                    if row and column:
                        a = start + (row - 1) * 7 + column - 1
                        ids = [a, a + 1, a + 8, a + 7]
                        if sign < 0: ids.reverse()
                        pocket_faces.append([(j, j) for j in ids])
    if not program and not council: export(role + '-cargo-pockets', np.array(pocket_points), np.array(pocket_uv), pocket_faces, np.array(pocket_weights), 2)

    # Built over a flat sole, with a rounded toe box instead of enlarged toes.
    bp, bu, bf, bw = [], [], [], []
    for side in ['R', 'L']:
        ankle = names.index('ankle_' + side); start = len(bp)
        rings = [(-.155, .155, .11, .275), (-.13, .157, .11, .275), (-.09, .15, .10, .27),
                 (-.04, .143, .105, .265), (.02, .14, .087, .25), (.095, .125, .04, .205),
                 (.16, .115, 0, .15), (.3, .122, -.012, .135), (.4, .13, -.012, .14)]
        if program: rings = rings[:6] + [(.14, .115, 0, .15)]
        for row, (height, width, center, depth) in enumerate(rings):
            for column in range(64):
                angle = column / 64 * np.pi * 2
                bp.append(rest[ankle] + [np.sin(angle) * width, height, center + np.cos(angle) * depth]); bu.append([column / 64, row / 8])
                weight = np.zeros(len(names)); cuff = 0 if program else np.clip((height - .095) / .305, 0, 1)
                weight[ankle] = 1 - cuff; weight[names.index('knee_' + side)] = cuff; bw.append(weight)
                if row:
                    ids = [start + (row - 1) * 64 + column, start + (row - 1) * 64 + (column + 1) % 64,
                           start + row * 64 + (column + 1) % 64, start + row * 64 + column]
                    bf.append([(j, j) for j in ids])
        bf.append([(start + j, start + j) for j in range(63, -1, -1)])
    export(role + '-work-boots', np.array(bp), np.array(bu), bf, np.array(bw), 3)
    output.mkdir(parents=True, exist_ok=True); builder.OUT = output
    builder.write_glb(doc, binaries, role + '-body.glb')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--roles', nargs='+', choices=['zee', 'charra', *CAPTAINS, *PROGRAMS, *COUNCILLORS, *HAMMER_CREW], default=['zee', 'charra'])
    args = parser.parse_args()
    for role in args.roles: main(args.source, args.output, role)
