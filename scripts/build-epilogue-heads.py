"""MakeHuman head/neck meshes fitted to the generated Revolutions reference.

Uses the pinned CC0 base mesh and numpy already used by build-characters.py.
No Blender, Python or download is required by the game. Reference measurements
are in pixels of the 627-square atlas panels; they are not actor scan data.
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
    faces = [face for face, group in zip(faces, groups) if group == 'body' and min(base[[i for i, _ in face], 1]) > neck[1] - .1]
    points, uv, faces, _ = builder.subdivide(base, uv, faces, np.zeros((len(base), 1)))
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
    fitted[:, 1] = np.maximum(fitted[:, 1] - neck_blend * (.075 if role == 'oracle-revolutions' else .015), -.52)
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
    mask *= np.clip((.265 - np.abs(fitted[:, 0])) / .065, 0, 1)
    mask = mask * mask * (3 - 2 * mask)
    front_uv = np.column_stack((np.clip(u, 140, 480) / 1254, (v + settings['row'] * 627) / 1254))
    profile_uv = np.column_stack(((627 + 132 - (fitted[:, 2] - .22) / pixel_scale) / 1254,
                                  (v + settings['row'] * 627 - (0 if role == 'oracle-revolutions' else 7)) / 1254))
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
           'images': [{'uri': 'epilogue-faces.png'}], 'textures': [{'source': 0, 'sampler': 0}],
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
           'extras': {'role': role, 'sourceRevision': REVISION, 'targets': settings['targets'], 'skinColor': settings['skin'],
                      'eye': [float(eye[0] * x_scale), 0, .185], 'eyeRadius': float(x_scale * .115),
                      'fitting': 'Frontal landmark registration on CC0 anatomy; approximate generated likeness, not an actor scan.'}}

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
    args = parser.parse_args()
    for role in REFERENCES: main(args.source, args.output, role)
