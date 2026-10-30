"""Sculpt the current playable Neo without rebuilding his rig or wardrobe.

Blender's bundled Python/numpy are authoring dependencies only. The first pass
uses visually measured 1999 film references, not a numerical likeness score.
Run with --source <neo.glb> --output <staging/neo.glb>. Source stays untouched.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals


def sculpt(points, eyelids=True):
    result = points.astype(float).copy()
    x, y, z = points.T
    front = np.clip((z - .13) / .12, 0, 1)
    neck = np.clip((y - 3.68) / .12, 0, 1)
    mask = front * neck * neck * (3 - 2 * neck)

    def field(cx, cy, rx, ry):
        return np.exp(-((np.abs(x) - cx) / rx) ** 2 - ((y - cy) / ry) ** 2) * mask

    # The reference mouth is wider relative to the interpupillary distance.
    # Carry the whole perioral surface and the oral cavity together.
    mouth = field(0, 3.953, .10, .045)
    result[:, 0] += x * .16 * mouth
    result[:, 1] -= .009 * mouth
    lower_lip = field(0, 3.938, .065, .012)
    result[:, 2] -= .003 * lower_lip
    chin = field(0, 3.855, .095, .045)
    result[:, 1] -= .011 * chin
    result[:, 2] += .004 * chin
    jaw = field(.125, 3.925, .045, .045)
    result[:, 0] += np.sign(x) * .003 * jaw
    cheek = field(.105, 4.045, .045, .055)
    result[:, 2] += .004 * cheek
    temple = field(.163, 4.15, .035, .095)
    result[:, 0] -= np.sign(x) * .003 * temple
    nose = field(0, 4.028, .032, .028)
    result[:, 1] -= .006 * nose
    result[:, 2] -= .003 * nose
    bridge = field(.021, 4.084, .016, .045)
    result[:, 0] += np.sign(x) * .002 * bridge
    if eyelids:
        upper = field(.073, 4.148, .03, .009)
        result[:, 1] -= .0025 * upper
        outer = field(.104, 4.135, .013, .013)
        result[:, 1] += .002 * outer
    return result.astype('<f4')


def main(source, output):
    raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    if doc.get('extras', {}).get('character') != 'neo' or not doc['extras'].get('neoMouthVersion'):
        raise ValueError('Use the current Neo with the existing jaw and oral surfaces.')
    if doc['extras'].get('likenessSculptVersion'):
        raise ValueError('Use the unchanged source, not a previous sculpt output.')
    binary = bytearray(raw[28 + size:28 + size + doc['buffers'][0]['byteLength']])

    def view(index, count, width, component, offset=0):
        buffer = doc['bufferViews'][index]
        dtype = np.dtype({5121: '<u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[component])
        return np.ndarray((count, width), dtype=dtype, buffer=binary,
                          offset=buffer.get('byteOffset', 0) + offset,
                          strides=(buffer.get('byteStride', dtype.itemsize * width), dtype.itemsize))

    def read(index):
        a = doc['accessors'][index]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        values = view(a['bufferView'], a['count'], width, a['componentType'], a.get('byteOffset', 0)).copy() if 'bufferView' in a else np.zeros((a['count'], width), dtype='<f4')
        if 'sparse' in a:
            sparse = a['sparse']; ids = sparse['indices']; data = sparse['values']
            selected = view(ids['bufferView'], sparse['count'], 1, ids['componentType'], ids.get('byteOffset', 0)).ravel()
            values[selected] = view(data['bufferView'], sparse['count'], width, a['componentType'], data.get('byteOffset', 0))
        return values

    def write(index, values):
        a = doc['accessors'][index]
        # Replace sparse morph storage with exact dense deltas; retain accessor
        # identity so every target, node and animation continues to reference it.
        if 'sparse' in a:
            a.pop('sparse'); a.pop('byteOffset', None)
            binary.extend(b'\0' * (-len(binary) % 4))
            a['bufferView'] = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
            binary.extend(values.astype('<f4').tobytes())
        else:
            view(a['bufferView'], a['count'], values.shape[1], a['componentType'], a.get('byteOffset', 0))[:] = values
        a.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())

    report = []
    for mesh in doc['meshes']:
        if mesh['name'] not in ['Anatomical head and hands', 'neo-teeth-upper', 'neo-teeth-lower', 'neo-tongue']: continue
        for primitive in mesh['primitives']:
            attrs = primitive['attributes']; old = read(attrs['POSITION']); new = sculpt(old)
            triangles = read(primitive['indices']).reshape(-1, 3)
            moved = np.any(new != old, axis=1)
            normal = read(attrs['NORMAL']); fitted_normal = smooth_normals(new, triangles).astype('<f4')
            fitted_normal[~moved] = normal[~moved]
            # Transform a posed mouth, then subtract the transformed rest head.
            # Copying the old deltas would detach teeth/lips after a wider fit.
            for target in primitive.get('targets', []):
                old_delta = read(target['POSITION']); posed = sculpt(old + old_delta)
                write(target['POSITION'], posed - new)
                if 'NORMAL' in target:
                    old_normal_delta = read(target['NORMAL'])
                    delta = smooth_normals(posed, triangles).astype('<f4') - fitted_normal
                    delta[~moved] = old_normal_delta[~moved]
                    write(target['NORMAL'], delta)
            assert np.array_equal(old[old[:, 1] < 3.68], new[old[:, 1] < 3.68]), 'Hands and neck must not move.'
            assert np.isfinite(new).all() and np.isfinite(fitted_normal).all()
            write(attrs['POSITION'], new); write(attrs['NORMAL'], fitted_normal)
            report.append({'mesh': mesh['name'], 'changedVertices': int(moved.sum()),
                           'maxDisplacement': float(np.linalg.norm(new - old, axis=1).max())})

    doc['extras'].update(likenessSculptVersion=1, likenessSourceSha256=hashlib.sha256(raw).hexdigest(),
                         likenessStatus='First film-reference sculpt; requires multiview gameplay review and user acceptance.')
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.glb.tmp'); temporary.write_bytes(result); temporary.replace(output)
    print(json.dumps({'sourceSha256': hashlib.sha256(raw).hexdigest(), 'outputSha256': hashlib.sha256(result).hexdigest(), 'meshes': report}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None)
    main(args.source, args.output)
