"""Correct the fitted tongue's extra pitch and bake oral ambient visibility.

Blender authoring only. A small linear grayscale ramp stores the visibility
coordinate used by glTF's standard occlusionTexture; vertex colors stay albedo.
The wide-open jaw is deliberately used so closed-mouth cavity darkness cannot
be baked across the teeth exposed during speech and eating.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals


def main(source, tongue_source, output):
    raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
    assert doc['extras'].get('neoMouthVersion') and not doc['extras'].get('oralOcclusionVersion')
    original_size = len(binary)

    def view(index, count, width, component, offset=0):
        v = doc['bufferViews'][index]; dtype = np.dtype({5126:'<f4', 5123:'<u2', 5125:'<u4'}[component])
        return np.ndarray((count, width), dtype, buffer=binary, offset=v.get('byteOffset', 0) + offset,
                          strides=(v.get('byteStride', width * dtype.itemsize), dtype.itemsize))

    def read(index):
        a = doc['accessors'][index]; width = {'VEC3':3, 'SCALAR':1}[a['type']]
        values = view(a['bufferView'], a['count'], width, a['componentType'], a.get('byteOffset', 0)).copy() if 'bufferView' in a else np.zeros((a['count'], width))
        if 'sparse' in a:
            s = a['sparse']; i = s['indices']; v = s['values']
            ids = view(i['bufferView'], s['count'], 1, i['componentType'], i.get('byteOffset', 0)).ravel()
            values[ids] = view(v['bufferView'], s['count'], width, a['componentType'], v.get('byteOffset', 0))
        return values

    def append_uv(uv):
        uv = np.asarray(uv, dtype='<f4'); binary.extend(b'\0' * (-len(binary) % 4))
        buffer = len(doc['bufferViews']); doc['bufferViews'].append({'buffer':0, 'byteOffset':len(binary), 'byteLength':uv.nbytes})
        binary.extend(uv.tobytes()); index = len(doc['accessors'])
        doc['accessors'].append({'bufferView':buffer, 'componentType':5126, 'count':len(uv), 'type':'VEC2',
                                 'min':uv.min(axis=0).tolist(), 'max':uv.max(axis=0).tolist()})
        return index

    def write(index, values):
        a = doc['accessors'][index]; assert 'sparse' not in a
        view(a['bufferView'], a['count'], 3, a['componentType'], a.get('byteOffset', 0))[:] = values
        a.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())

    # Vertex identity is retained by the CC0 oral export. Undo only the extra
    # pitch introduced when a shallow facial patch's affine fit was extended
    # throughout the mouth; keep the tongue tip at its delivered position.
    source_hash = hashlib.sha256(tongue_source.read_bytes()).hexdigest()
    assert source_hash == doc['extras']['neoMouthSources']['system/tongue/tongue01/tongue01.obj']
    original = np.array([[float(x) for x in line.split()[1:]] for line in tongue_source.read_text().splitlines() if line.startswith('v ')])
    primitive = next(mesh for mesh in doc['meshes'] if mesh['name'] == 'neo-tongue')['primitives'][0]
    rest = read(primitive['attributes']['POSITION']).astype(float); assert len(original) == len(rest)
    triangles = read(primitive['indices']).reshape(-1, 3)
    fit = np.linalg.lstsq(np.column_stack((original, np.ones(len(original)))), rest, rcond=None)[0]
    pitch = np.arctan2(fit[1, 2] - fit[2, 1], fit[1, 1] + fit[2, 2])
    assert 0 < pitch < .5, 'Unexpected tongue fit; inspect rather than guessing a rotation.'
    rotation = lambda angle: np.array([[1, 0, 0], [0, np.cos(angle), -np.sin(angle)], [0, np.sin(angle), np.cos(angle)]])
    anchor = rest[np.argmax(rest[:, 2])]; refined = (rest - anchor) @ rotation(-pitch).T + anchor
    offset = refined - rest; normals = smooth_normals(refined, triangles)
    delta = read(primitive['targets'][0]['POSITION']).astype(float)
    posed = rest + delta + offset @ rotation(doc['extras']['jawAngle']).T
    write(primitive['attributes']['POSITION'], refined); write(primitive['attributes']['NORMAL'], normals)
    write(primitive['targets'][0]['POSITION'], posed - refined)
    write(primitive['targets'][0]['NORMAL'], smooth_normals(posed, triangles) - normals)
    fitted_binary = bytes(binary)

    meshes = {}; points = []; faces = []
    for mesh in doc['meshes']:
        name = mesh['name']
        if name not in ['Anatomical head and hands', 'neo-teeth-upper', 'neo-teeth-lower', 'neo-tongue']: continue
        primitive = mesh['primitives'][0]; position = read(primitive['attributes']['POSITION']).astype(float)
        if primitive.get('targets'): position += read(primitive['targets'][0]['POSITION'])
        triangles = read(primitive['indices']).reshape(-1, 3)
        triangles = triangles[np.all(position[triangles, 1] > 3.55, axis=1)]
        normals = smooth_normals(position, triangles)
        meshes[name] = (primitive, position, normals)
        faces.extend((triangles + len(points)).tolist()); points.extend(position.tolist())
    surface = BVHTree.FromPolygons(points, faces, all_triangles=True)
    output.mkdir(parents=True, exist_ok=True)
    for image in doc['images']:
        link = output / image['uri']
        if not link.exists(): link.symlink_to((source.parent / image['uri']).resolve())

    ramp = bpy.data.images.new('Oral ambient visibility ramp', width=2, height=1, alpha=False)
    ramp.colorspace_settings.name = 'Non-Color'; ramp.pixels[:] = [0, 0, 0, 1, 1, 1, 1, 1]
    ramp.filepath_raw = str((output / 'neo-oral-occlusion.png').resolve()); ramp.file_format = 'PNG'; ramp.save()
    sampler = len(doc['samplers']); doc['samplers'].append({'magFilter':9729, 'minFilter':9729, 'wrapS':33071, 'wrapT':33071})
    image = len(doc['images']); doc['images'].append({'uri':'neo-oral-occlusion.png'})
    texture = len(doc['textures']); doc['textures'].append({'source':image, 'sampler':sampler})
    report = []
    samples = 128; t = (np.arange(samples) + .5) / samples; phi = np.arange(samples) * np.pi * (3 - np.sqrt(5))
    directions = np.column_stack((np.sqrt(t) * np.cos(phi), np.sqrt(t) * np.sin(phi), np.sqrt(1 - t)))
    for name, (primitive, position, normals) in meshes.items():
        if name == 'Anatomical head and hands': continue
        visibility = []
        for point, normal in zip(position, normals):
            reference = np.array([0, 1, 0] if abs(normal[1]) < .9 else [1, 0, 0])
            tangent = np.cross(reference, normal); tangent /= max(np.linalg.norm(tangent), 1e-8)
            bitangent = np.cross(normal, tangent); rays = directions @ np.array([tangent, bitangent, normal])
            origin = Vector(point + normal * .0003)
            clear = sum(surface.ray_cast(origin, Vector(ray), .30)[0] is None for ray in rays)
            visibility.append(max(.03, clear / samples))
        visibility = np.array(visibility)
        # The two texel centres are .25 and .75; linear filtering reconstructs
        # the visibility value, including its smooth interpolation on a face.
        primitive['attributes']['TEXCOORD_0'] = append_uv(np.column_stack((.25 + visibility * .5, np.full(len(visibility), .5))))
        doc['materials'][primitive['material']]['occlusionTexture'] = {'index':texture, 'strength':1}
        report.append({'mesh':name, 'vertices':len(position), 'visibilityPercentiles':np.percentile(visibility, [0, 25, 50, 75, 100]).tolist()})
    assert bytes(binary[:original_size]) == fitted_binary, 'The visibility bake changed geometry or animation.'
    doc['extras']['oralOcclusionVersion'] = 1
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    temporary = output / 'neo.glb.tmp'; temporary.write_bytes(result); temporary.replace(output / 'neo.glb')
    audit = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
             'tongueSourceSha256':source_hash, 'tongueExtraPitchRemovedDegrees':float(np.degrees(pitch)),
             'tongueTipPreserved':True, 'tongueFollowsOriginalJawRotation':True,
             'raysPerVertex':samples, 'bakedJawOpen':1, 'meshes':report,
             'userAcceptance':'pending'}
    (output / 'occlusion-report.json').write_text(json.dumps(audit, indent=2) + '\n'); print(json.dumps(audit))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--tongue-source', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:]); main(args.source, args.tongue_source, args.output)
