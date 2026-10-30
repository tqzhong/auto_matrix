"""Refine Neo's existing strand groom without adding geometry or changing skin.

Run in Blender against the latest face/mouth candidate. The current topology,
weights, UVs and materials remain intact; short clumped lifts break up the
uniform swept-back shell seen in the first multi-view review.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals


def main(source, output):
    raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
    assert doc['extras'].get('groomVersion') == 1 and not doc['extras'].get('groomRefinementVersion')

    def read(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        width = {'VEC3':3, 'VEC2':2, 'VEC4':4, 'SCALAR':1}[a['type']]
        dtype = np.dtype({5126:'<f4', 5125:'<u4', 5123:'<u2'}[a['componentType']])
        return np.ndarray((a['count'], width), dtype, buffer=binary, offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(v.get('byteStride', width * dtype.itemsize), dtype.itemsize))

    def write(index, values):
        read(index)[:] = values
        doc['accessors'][index].update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())

    skin = next(m for m in doc['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
    skin_points = read(skin['attributes']['POSITION']).copy(); skin_faces = read(skin['indices']).reshape(-1, 3)
    surface = BVHTree.FromPolygons(skin_points.tolist(), skin_faces.tolist(), all_triangles=True)
    eye = doc['extras']['eye'][1]; center = np.array([0, eye + .025, .10])
    records = []
    for mesh in doc['meshes']:
        if mesh['name'] not in ['Close-cut scalp undercoat', 'Swept individual hair strands']: continue
        p = mesh['primitives'][0]; attrs = p['attributes']; old = read(attrs['POSITION']).astype(float)
        original_normals = read(attrs['NORMAL']).astype(float); triangles = read(p['indices']).reshape(-1, 3)
        top = np.clip((old[:, 1] - eye - .09) / .14, 0, 1); top = top * top * (3 - 2 * top)
        volume = .024 * np.exp(-((old[:, 0] + .035) / .21) ** 2 - ((old[:, 2] - .11) / .25) ** 2) * top
        # A broad asymmetric crown remains below the separate fine strands.
        radial = old - center; radial /= np.linalg.norm(radial, axis=1, keepdims=True)
        shaped = old + radial * volume[:, None]
        strand_count = 0
        if mesh['name'] == 'Swept individual hair strands':
            uv = read(attrs['TEXCOORD_0']); starts = np.where((uv[:, 0] == 0) & (uv[:, 1] == 0))[0]
            assert len(starts) == 3000 and np.all(starts % 2 == 0)
            for strand, (start, end) in enumerate(zip(starts, [*starts[1:], len(old)])):
                t = uv[start:end, 1]; root = old[start:start + 2].mean(axis=0)
                upper = np.clip((root[1] - eye - .085) / .14, 0, 1)
                upper = upper * upper * (3 - 2 * upper)
                clump = .5 + .5 * math.sin(root[0] * 51 + root[2] * 29)
                arc = np.maximum(0, np.sin(np.pi * t)) ** 1.2 * (.004 + .010 * clump) * upper
                # A small minority of tips leave the shell; roots stay seated.
                if strand % 29 == 0: arc += t ** 3 * .012 * upper
                shaped[start:end] += original_normals[start:end] * arc[:, None]
                strand_count += 1
        assert np.isfinite(shaped).all(), f'{mesh["name"]}: non-finite groom positions'
        new = shaped.astype('<f4'); normal = smooth_normals(new, triangles)
        invalid = np.linalg.norm(normal, axis=1) < .5; normal[invalid] = original_normals[invalid]
        cross = lambda values: np.cross(values[triangles[:, 1]] - values[triangles[:, 0]], values[triangles[:, 2]] - values[triangles[:, 0]])
        before, after = cross(old), cross(new)
        dots = (before * after).sum(axis=1); flipped = np.where(dots < -1e-15)[0]
        assert not len(flipped), f'{mesh["name"]}: {len(flipped)} groom triangles flipped; first {flipped[:4].tolist()}, min dot {dots.min()}'
        # Check every actual vertex against the same scalp rays used to author
        # the original groom, including the roots and tapered strand tips.
        gaps = []
        for point in new:
            direction = point - center; distance = np.linalg.norm(direction)
            hit, _, _, hit_distance = surface.ray_cast(Vector(center), Vector(direction / distance))
            assert hit is not None, f'{mesh["name"]}: scalp ray missed at vertex {len(gaps)}, {point.tolist()}'
            gaps.append(distance - hit_distance)
        minimum = float(min(gaps)); assert minimum > -.0001, f'Hair enters the skin: {minimum}'
        write(attrs['POSITION'], new); write(attrs['NORMAL'], normal.astype('<f4'))
        records.append({'mesh':mesh['name'], 'vertices':len(new), 'strands':strand_count,
                        'maxDisplacement':float(np.linalg.norm(new - old, axis=1).max()), 'minimumRadialScalpClearance':minimum})
    assert len(records) == 2
    output.mkdir(parents=True, exist_ok=True)
    for image in doc['images']:
        link = output / image['uri']
        if not link.exists(): link.symlink_to((source.parent / image['uri']).resolve())
    doc['extras'].update(groomRefinementVersion=1, groomRefinementSourceSha256=hashlib.sha256(raw).hexdigest())
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    temporary = output / 'neo.glb.tmp'; temporary.write_bytes(result); temporary.replace(output / 'neo.glb')
    report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
              'addedVertices':0, 'addedTriangles':0, 'changes':records, 'userAcceptance':'pending'}
    (output / 'groom-report.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:]); main(args.source, args.output)
