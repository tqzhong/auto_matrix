"""Refine the bald crown and ear placement against fixed film cameras.

Authoring only: retain the existing UVs, textures, skeleton, weights, eyes,
hands, lower neck and wardrobe. Film silhouette residuals are not likeness.
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


def main(source, output):
    raw = source.read_bytes()
    source_sha = hashlib.sha256(raw).hexdigest()
    assert source_sha == '78f9013a95df8a840e63f7b95f0f57b90af4d6ba4bd86bb8e8a0ceaad82f3fe7'
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])

    def read(index):
        a = doc['accessors'][index]; view = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dtype = np.dtype({5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
        return np.ndarray((a['count'], width), dtype, buffer=binary,
                          offset=view.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize))

    smooth = lambda t: np.clip(t, 0, 1) ** 2 * (3 - 2 * np.clip(t, 0, 1))
    primitive = next(m for m in doc['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
    assert not primitive.get('targets'), 'Preserve existing facial morphs explicitly if the source changes'
    attrs = primitive['attributes']; old = read(attrs['POSITION']).copy(); new = old.copy()
    x, y, z = old.T
    # The visible-feature camera is frozen before sculpting. The upper crown
    # is too tall and broad in its 2003 silhouette; fade above the eye sockets.
    crown = smooth((y - 4.22) / .10)
    new[:, 0] -= x * .05 * crown
    new[:, 1] -= (y - 4.22) * .10 * crown
    new[:, 2] -= (z - .15) * .06 * crown
    triangles = read(primitive['indices']).reshape(-1, 3)
    # Carry the ear root through its actual connected skin. A product of XYZ
    # masks raises a horizontal ridge above the pinna on the bald skull.
    points, weld = np.unique(np.round(old, 5), axis=0, return_inverse=True)
    faces = weld[triangles]
    edges = np.unique(np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1), axis=0)
    edges = edges[edges[:, 0] != edges[:, 1]]
    a, b = edges.T; weights = 1 / np.maximum(np.linalg.norm(points[a] - points[b], axis=1), 1e-6)
    degree = np.bincount(a, weights, len(points)) + np.bincount(b, weights, len(points))
    px, py, pz = points.T
    pinna = (np.abs(px) > .183) & (py > 4.095) & (py < 4.225) & (pz > .035) & (pz < .155)
    fixed = pinna | (py < 3.99) | (py > 4.36) | (pz > .24) | (pz < -.08) | (np.abs(px) < .10)
    field = pinna.astype(float)
    for _ in range(1600):
        average = (np.bincount(a, weights * field[b], len(points)) + np.bincount(b, weights * field[a], len(points))) / np.maximum(degree, 1e-9)
        field[~fixed] = .7 * average[~fixed] + .3 * field[~fixed]
    ear = smooth(field[weld])
    new[:, 0] += np.sign(x) * .008 * ear
    new[:, 1] += .024 * ear
    cross = lambda points: np.cross(points[triangles[:, 1]] - points[triangles[:, 0]],
                                   points[triangles[:, 2]] - points[triangles[:, 0]])
    assert np.isfinite(new).all()
    assert np.all((cross(old) * cross(new)).sum(axis=1) >= -1e-15), 'Head refinement flipped a face'
    protected = old[:, 1] < 3.99
    assert np.array_equal(new[protected], old[protected]), 'Hands or lower neck moved'
    moved = np.any(old != new, axis=1)
    normals = smooth_normals(new, triangles).astype('<f4')
    normals[~moved] = read(attrs['NORMAL'])[~moved]
    for name, values in [('POSITION', new), ('NORMAL', normals)]:
        read(attrs[name])[:] = values
        doc['accessors'][attrs[name]].update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    # Assert byte-for-byte protection outside the two intended attributes.
    allowed = np.zeros(len(binary), dtype=bool)
    for name in ['POSITION', 'NORMAL']:
        a = doc['accessors'][attrs[name]]; view = doc['bufferViews'][a['bufferView']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', 12)
        for i in np.flatnonzero(moved): allowed[offset + i * stride:offset + i * stride + 12] = True
    changed = np.frombuffer(binary, dtype='u1') != np.frombuffer(raw[28 + size:], dtype='u1')
    assert not np.any(changed & ~allowed), 'Unexpected binary changes'
    output.mkdir(parents=True, exist_ok=True)
    for entry in doc['images']:
        link = output / entry['uri']
        if not link.exists(): link.symlink_to((source.parent / entry['uri']).resolve())
    doc['extras'].update(filmHeadRefinementVersion=1, filmHeadRefinementSourceSha256=source_sha,
                         filmHeadRefinementStatus='Fixed-camera crown and ear candidate; user acceptance pending')
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
    result += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    temporary = output / 'morpheus.glb.tmp'; temporary.write_bytes(result); temporary.replace(output / 'morpheus.glb')
    report = {'sourceSha256': source_sha, 'candidateSha256': hashlib.sha256(result).hexdigest(),
              'changedHeadVertices': int(moved.sum()), 'maxDisplacement': float(np.linalg.norm(new - old, axis=1).max()),
              'protectedVerticesUnchanged': int(protected.sum()), 'unchangedBinaryBytes': int((~changed).sum()),
              'onlyHeadPositionAndNormalChanged': True, 'flippedFaces': 0, 'userAcceptance': 'pending'}
    (output / 'head-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None)
    main(args.source, args.output)
