"""MakeHuman head/neck meshes fitted to the generated Revolutions reference.

Uses the pinned CC0 base mesh and numpy already used by build-characters.py.
No Blender, Python or download is required by the game. Reference measurements
are in pixels of each portrait panel; they are not actor scan data.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import urllib.request

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('character_builder', Path(__file__).with_name('build-characters.py'))
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
REVISION = builder.REVISION
REFERENCES = {
    'oracle-revolutions': {
        'targets': {'macrodetails/african-female-old': .85, 'macrodetails/african-female-young': .15},
        'row': 0, 'eye': [239, 385, 267], 'ys': [625, 514, 438, 421, 404, 349, 267, 18],
        'chin': -.305, 'skin': [0.29, .15, .086],
    },
    'sati': {
        'targets': {'macrodetails/asian-female-child': .45, 'macrodetails/caucasian-female-child': .55},
        'row': 1, 'eye': [240, 379, 269], 'ys': [625, 492, 429, 416, 404, 347, 269, 17],
        'chin': -.315, 'skin': [.45, .25, .14],
    },
    'zee': {
        'targets': {'macrodetails/african-female-young': 1, 'head/head-fat-decr': .20,
                    'cheek/l-cheek-bones-incr': .16, 'cheek/r-cheek-bones-incr': .16},
        'row': 0, 'eye': [237, 392, 257], 'ys': [625, 520, 449, 424, 400, 350, 257, 4],
        'chin': -.31, 'skin': [.33, .16, .073], 'atlas': 'digger-faces.png', 'profile_y': 0,
    },
    'charra': {
        'targets': {'macrodetails/caucasian-female-young': 1, 'head/head-rectangular': .20,
                    'head/head-fat-decr': .22, 'nose/nose-scale-depth-incr': .10},
        'row': 1, 'eye': [237, 383, 266], 'ys': [625, 524, 452, 429, 413, 362, 266, 8],
        'chin': -.315, 'skin': [.54, .33, .215], 'atlas': 'digger-faces.png', 'profile_y': 0,
    },
    'niobe': {
        'targets': {'macrodetails/african-female-young': 1, 'head/head-fat-decr': .28,
                    'cheek/l-cheek-bones-incr': .30, 'cheek/r-cheek-bones-incr': .30,
                    'chin/chin-width-incr': .12},
        'row': 0, 'eye': [199, 308, 229], 'ys': [484, 422, 367, 353, 340, 299, 229, 50],
        'chin': -.312, 'skin': [.36, .20, .125], 'atlas': 'zion-captains-faces.png',
        'atlas_size': [1024, 1536], 'panel_top': 0, 'profile_anchor': 121, 'profile_y': 0,
        'neck_sample': [256, 453], 'cheek_sample': [735, 320], 'profile_ear': [347, 243],
    },
    'lock': {
        'targets': {'macrodetails/african-male-young': .85, 'macrodetails/african-male-old': .15,
                    'head/head-rectangular': .35, 'head/head-fat-decr': .25,
                    'chin/chin-width-incr': .18, 'nose/nose-scale-depth-incr': .12},
        'row': 1, 'eye': [194, 314, 215], 'ys': [488, 448, 381, 364, 348, 302, 215, 35],
        'chin': -.345, 'skin': [.29, .15, .085], 'atlas': 'zion-captains-faces.png',
        'atlas_size': [1024, 1536], 'panel_top': 485, 'profile_anchor': 113, 'profile_y': 0,
        'neck_sample': [256, 944], 'cheek_sample': [739, 799], 'profile_ear': [345, 251],
    },
    'roland': {
        'targets': {'macrodetails/caucasian-male-young': .75, 'macrodetails/caucasian-male-old': .25,
                    'head/head-rectangular': .40, 'head/head-fat-decr': .18,
                    'chin/chin-width-incr': .25, 'nose/nose-scale-depth-incr': .20},
        'row': 2, 'eye': [197, 308, 229], 'ys': [561, 458, 383, 365, 353, 310, 229, 25],
        'chin': -.34, 'skin': [.52, .32, .23], 'atlas': 'zion-captains-faces.png',
        'atlas_size': [1024, 1536], 'panel_top': 974, 'profile_anchor': 126, 'profile_y': 0,
        'neck_sample': [256, 1484], 'cheek_sample': [751, 1305], 'profile_ear': [347, 313],
    },
    'architect': {
        'targets': {'macrodetails/caucasian-male-old': 1, 'head/head-rectangular': .28,
                    'chin/chin-width-incr': .22, 'nose/nose-scale-depth-incr': .12},
        'row': 0, 'eye': [205, 406, 458], 'ys': [1235, 873, 766, 730, 690, 581, 458, 90],
        'chin': -.335, 'skin': [.65, .43, .32], 'atlas': 'architect-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 98, 'profile_y': -10,
        'neck_sample': [313, 1080], 'cheek_sample': [926, 598], 'profile_ear': [462, 537],
    },
    'seraph': {
        'targets': {'macrodetails/asian-male-young': 1, 'head/head-rectangular': .24,
                    'head/head-fat-decr': .18, 'chin/chin-width-incr': .14},
        'row': 0, 'eye': [210, 403, 489], 'ys': [1235, 858, 783, 754, 723, 638, 489, 92],
        'chin': -.32, 'skin': [.55, .32, .19], 'atlas': 'seraph-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 76, 'profile_y': -2,
        'neck_sample': [313, 1030], 'cheek_sample': [932, 635], 'profile_ear': [451, 528],
    },
    'keymaker': {
        'targets': {'macrodetails/asian-male-old': 1, 'head/head-rectangular': .22,
                    'chin/chin-width-incr': .18, 'nose/nose-width2-incr': .10},
        'row': 0, 'eye': [224, 426, 500], 'ys': [1235, 883, 777, 745, 710, 633, 500, 103],
        'chin': -.33, 'skin': [.64, .41, .28], 'atlas': 'keymaker-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 544, 'profile_y': -2, 'profile_direction': 1,
        'neck_sample': [313, 1030], 'cheek_sample': [1000, 658], 'profile_ear': [207, 575],
    },
    'rama_kandra': {
        'targets': {'macrodetails/asian-male-young': .65, 'macrodetails/caucasian-male-old': .35,
                    'head/head-fat-decr': .20, 'nose/nose-scale-depth-incr': .12},
        'row': 0, 'eye': [224, 422, 492], 'ys': [1220, 904, 750, 724, 691, 581, 492, 99],
        'chin': -.335, 'skin': [.49, .29, .18], 'atlas': 'rama_kandra-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 119, 'profile_y': 0,
        'neck_sample': [313, 1030], 'cheek_sample': [930, 611], 'profile_ear': [421, 562],
    },
    'kamala': {
        'targets': {'macrodetails/asian-female-young': .70, 'macrodetails/caucasian-female-young': .30,
                    'head/head-fat-decr': .12},
        'row': 0, 'eye': [223, 410, 447], 'ys': [1220, 796, 697, 671, 611, 529, 447, 75],
        'chin': -.315, 'skin': [.46, .27, .17], 'atlas': 'kamala-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 128, 'profile_y': 0,
        'neck_sample': [313, 1005], 'cheek_sample': [930, 580], 'profile_ear': [426, 516],
    },
    'trainman': {
        'targets': {'macrodetails/caucasian-male-old': 1, 'head/head-fat-decr': .40,
                    'nose/nose-scale-depth-incr': .38},
        'row': 0, 'eye': [225, 409, 407], 'ys': [1235, 848, 724, 682, 599, 497, 407, 24],
        'chin': -.36, 'skin': [.58, .40, .29], 'atlas': 'trainman-face-reference.png',
        'atlas_size': [1254, 1254], 'panel_top': 0, 'profile_anchor': 148, 'profile_y': 0,
        'neck_sample': [313, 1010], 'cheek_sample': [912, 514], 'profile_ear': [396, 429],
    },
}


def normals(points, faces):
    result = np.zeros_like(points)
    for face in faces:
        ids = [i for i, _ in face]
        n = np.cross(points[ids[1]] - points[ids[0]], points[ids[2]] - points[ids[0]])
        result[ids] += n
    return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-9)


def main(source, output, role):
    settings = REFERENCES[role]
    files = {'base.obj': '3dobjs/base.obj', 'default.mhskel': 'rigs/default.mhskel'}
    files.update({name + '.target': 'targets/' + name + '.target' for name in settings['targets']})
    for local, remote in files.items():
        path = source / local
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REVISION}/makehuman/data/{remote}', timeout=90) as response:
                path.write_bytes(response.read())
    base, uv, faces, groups = builder.obj(source / 'base.obj')
    for name, weight in settings['targets'].items():
        rows = np.loadtxt(source / (name + '.target'))
        base[rows[:, 0].astype(int)] += rows[:, 1:] * weight
    skeleton = json.loads((source / 'default.mhskel').read_text())

    def pivot(name):
        return base[skeleton['joints'][skeleton['bones'][name]['head']]].mean(axis=0)

    eye, neck = pivot('eye.L'), pivot('neck01')
    if role in ['architect', 'seraph', 'keymaker', 'rama_kandra', 'kamala', 'trainman']:
        # Keep and clip crossing faces rather than leaving jagged open edges
        # above the body's neck overlap.
        faces = [face for face, group in zip(faces, groups) if group == 'body' and max(base[[i for i, _ in face], 1]) > neck[1] - .1]
        head, uv, faces, influence = builder.trim_neckline(base, uv, faces, np.zeros((len(base), 1)), neck[1] - .1, above=True)
    else:
        faces = [face for face, group in zip(faces, groups) if group == 'body' and min(base[[i for i, _ in face], 1]) > neck[1] - .1]
        head, influence = base, np.zeros((len(base), 1))
    points, uv, faces, _ = builder.subdivide(head, uv, faces, influence)
    used = np.unique([i for face in faces for i, _ in face])
    top = points[used, 1].max()
    source_y = [neck[1], base[780, 1], base[492, 1], base[474, 1], base[455, 1], base[343, 1], eye[1], top]
    portrait_y = np.interp(points[:, 1], source_y, settings['ys'])
    pixel_scale = -settings['chin'] / (settings['ys'][1] - settings['eye'][2])
    x_scale = (settings['eye'][1] - settings['eye'][0]) / 2 * pixel_scale / eye[0]
    fitted = points.copy()
    fitted[:, 0] *= x_scale
    fitted[:, 1] = (settings['eye'][2] - portrait_y) * pixel_scale
    fitted[:, 2] = (points[:, 2] - eye[2]) * x_scale + .185
    # A continuous neck sinks into the garment instead of ending at the jaw.
    neck_blend = np.clip((-.33 - fitted[:, 1]) / .14, 0, 1)
    radius = np.maximum(np.hypot(fitted[:, 0], fitted[:, 2] * 1.3), .001)
    fitted[:, 0] *= 1 - neck_blend * (1 - .135 / radius)
    fitted[:, 2] *= 1 - neck_blend * .35
    if role in ['architect', 'seraph', 'keymaker', 'rama_kandra', 'kamala', 'trainman']:
        # Fit the anatomical neck independently of the portrait's long bare
        # shoulder region. Clamping that projection flattens several rings
        # into a visible flange at the collar.
        lower_neck = points[:, 1] < source_y[1]
        fitted[lower_neck, 1] = np.interp(points[lower_neck, 1],
                                        [points[used, 1].min(), source_y[1]], [-.52, settings['chin']])
    else:
        fitted[:, 1] = np.maximum(fitted[:, 1] - neck_blend * (.12 if 'atlas_size' in settings else .09 if role in ['zee', 'charra'] else .075 if role == 'oracle-revolutions' else .015), -.52)
    # Match the relaxed reference aperture instead of the base's wide-eyed pose.
    for side in [-1, 1]:
        dx = (fitted[:, 0] - side * eye[0] * x_scale) / .065
        opening = np.exp(-(dx ** 4) - (fitted[:, 1] / .055) ** 4) * np.clip((fitted[:, 2] - .12) / .06, 0, 1)
        fitted[:, 1] *= 1 - (.28 if role == 'oracle-revolutions' else .14) * opening
    n = normals(fitted, faces)
    center_u = (settings['eye'][0] + settings['eye'][1]) / 2
    u = center_u + fitted[:, 0] / pixel_scale
    v = portrait_y
    # Fade to a matched neck/ear color before reaching the reference backdrop.
    mask = np.clip((n[:, 2] - .10) / .55, 0, 1)
    mask *= np.clip((fitted[:, 1] - settings['chin'] + .13) / .25, 0, 1)
    mask *= np.clip(((.225 if role in ['zee', 'charra'] else .265) - np.abs(fitted[:, 0])) / .065, 0, 1)
    if role in ['zee', 'charra']:
        # The cheek/jaw outline is narrower than the reference's ears. Fade
        # before that silhouette so gray portrait background never hits skin.
        width = np.interp(portrait_y,
                          [4, 150, 257, 350, 424, 449, 500, 524, 625],
                          [105, 154, 153, 143, 124, 112, 75, 40, 150])
        mask *= np.clip((width - np.abs(u - center_u) - 8) / 24, 0, 1)
    mask = mask * mask * (3 - 2 * mask)
    atlas_w, atlas_h = settings.get('atlas_size', [1254, 1254])
    panel = atlas_w / 2; panel_top = settings.get('panel_top', settings['row'] * 627)
    low_u, high_u = [panel * .223, panel * .766] if 'atlas_size' in settings else [140, 480]
    front_uv = np.column_stack((np.clip(u, low_u, high_u) / atlas_w, (v + panel_top) / atlas_h))
    profile_direction = settings.get('profile_direction', -1)
    profile_uv = np.column_stack(((panel + settings.get('profile_anchor', 132) + profile_direction * (fitted[:, 2] - .22) / pixel_scale) / atlas_w,
                                  (v + panel_top - settings.get('profile_y', 0 if role == 'oracle-revolutions' else 7)) / atlas_h))
    # Close the upper/lower eyelid rings over the eyeball in the restored pose.
    closed = fitted.copy()
    for side in [-1, 1]:
        cx = side * eye[0] * x_scale
        horizontal = np.clip(1 - np.abs((fitted[:, 0] - cx) / .065), 0, 1)
        vertical = np.clip(1 - np.abs(fitted[:, 1]) / .054, 0, 1)
        front = np.clip((fitted[:, 2] - .12) / .05, 0, 1)
        close = horizontal * vertical * front
        closed[:, 1] += (-.008 - fitted[:, 1]) * close
        closed[:, 2] += .008 * close
    binaries = bytearray()
    doc = {'asset': {'version': '2.0', 'generator': 'auto_matrix epilogue head fitting'},
           'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [],
           'accessors': [], 'bufferViews': [], 'buffers': [],
           'images': [{'uri': settings.get('atlas', 'epilogue-faces.png')}], 'textures': [{'source': 0, 'sampler': 0}],
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
           'extras': {'role': role, 'sourceRevision': REVISION, 'targets': settings['targets'], 'skinColor': settings['skin'], 'atlasRow': settings['row'],
                      'eye': [float(eye[0] * x_scale), 0, .185], 'eyeRadius': float(x_scale * .115),
                      'fitting': 'Frontal landmark registration on CC0 anatomy; approximate generated likeness, not an actor scan.'}}
    if 'atlas_size' in settings:
        doc['extras'].update(atlasSize=settings['atlas_size'], profileOrigin=[panel, panel_top],
                             profileEar=settings['profile_ear'], profileEye=[settings['profile_anchor'] - profile_direction * .035 / pixel_scale, settings['eye'][2]],
                             neckSample=[settings['neck_sample'][0] / atlas_w, settings['neck_sample'][1] / atlas_h],
                             cheekSample=[settings['cheek_sample'][0] / atlas_w, settings['cheek_sample'][1] / atlas_h])

    def accessor(array, kind, component=5126):
        a = np.asarray(array, dtype='<u4' if component == 5125 else '<f4')
        binaries.extend(b'\x00' * (-len(binaries) % 4))
        index = len(doc['bufferViews']); doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binaries), 'byteLength': a.nbytes})
        binaries.extend(a.tobytes())
        doc['accessors'].append({'bufferView': index, 'componentType': component, 'count': len(a), 'type': kind,
                                 'min': np.atleast_1d(a.min(axis=0)).tolist(), 'max': np.atleast_1d(a.max(axis=0)).tolist()})
        return len(doc['accessors']) - 1

    material = {'name': role + ' skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'roughnessFactor': .72, 'metallicFactor': 0}}
    doc['materials'].append(material)
    remap = {old: new for new, old in enumerate(used)}
    triangles = [[remap[f[0][0]], remap[f[i][0]], remap[f[i + 1][0]]] for f in faces for i in range(1, len(f) - 1)]
    attrs = {'POSITION': accessor(fitted[used], 'VEC3'), 'NORMAL': accessor(n[used], 'VEC3'),
             'TEXCOORD_0': accessor(front_uv[used], 'VEC2'), 'TEXCOORD_1': accessor(profile_uv[used], 'VEC2'),
             '_FACE_WEIGHT': accessor(mask[used], 'SCALAR')}
    doc['meshes'].append({'name': role + '-anatomical-head', 'weights': [0], 'extras': {'targetNames': ['closedEyes']},
                          'primitives': [{'attributes': attrs, 'indices': accessor(np.ravel(triangles), 'SCALAR', 5125), 'material': 0,
                                          'targets': [{'POSITION': accessor((closed - fitted)[used], 'VEC3')}]}]})
    doc['nodes'].append({'mesh': 0, 'name': role + '-anatomical-head'}); doc['scenes'][0]['nodes'].append(0)
    builder.OUT = output; output.mkdir(parents=True, exist_ok=True)
    builder.write_glb(doc, binaries, role + '-head.glb')
    print(role, 'vertices', len(used), 'triangles', len(triangles), 'bounds', fitted[used].min(axis=0), fitted[used].max(axis=0))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--roles', nargs='+', choices=REFERENCES, default=['oracle-revolutions', 'sati'])
    args = parser.parse_args()
    for role in args.roles: main(args.source, args.output, role)
