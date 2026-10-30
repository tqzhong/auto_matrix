"""Bake actual eyelid ambient visibility into the existing Morpheus eye material.

Blender authoring only. Preserve eye color, transparent cornea, geometry,
weights and the primary UVs. A second UV set samples a tiny linear ramp using
standard glTF occlusionTexture, as in the existing Neo oral visibility bake.
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


def main(source, output):
    raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); original = raw[28 + size:]; binary = bytearray(original)
    assert doc['extras']['character'] == 'morpheus' and not doc['extras'].get('eyeOcclusionVersion')

    def read(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}[a['type']]
        dtype = np.dtype({5126:'<f4', 5123:'<u2', 5125:'<u4'}[a['componentType']])
        return np.ndarray((a['count'], width), dtype, buffer=binary,
                          offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(v.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()

    head = next(m for m in doc['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
    points = read(head['attributes']['POSITION']); faces = read(head['indices']).reshape(-1, 3)
    faces = faces[np.all(points[faces, 1] > doc['extras']['eye'][1] - .45, axis=1)]
    surface = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    eye = next(m for m in doc['meshes'] if m['name'] == 'high-poly')['primitives'][0]
    assert 'TEXCOORD_1' not in eye['attributes'] and not eye.get('targets')
    position = read(eye['attributes']['POSITION']); normal = read(eye['attributes']['NORMAL'])
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-8)
    samples = 256; t = (np.arange(samples) + .5) / samples; phi = np.arange(samples) * np.pi * (3 - np.sqrt(5))
    directions = np.column_stack((np.sqrt(t) * np.cos(phi), np.sqrt(t) * np.sin(phi), np.sqrt(1 - t)))
    visibility = []
    for point, n in zip(position, normal):
        reference = np.array([0, 1, 0] if abs(n[1]) < .9 else [1, 0, 0])
        tangent = np.cross(reference, n); tangent /= max(np.linalg.norm(tangent), 1e-8)
        rays = directions @ np.array([tangent, np.cross(n, tangent), n])
        origin = Vector(point + n * .0001)
        visibility.append(sum(surface.ray_cast(origin, Vector(ray), .16)[0] is None for ray in rays) / samples)
    visibility = np.array(visibility)
    uv = np.column_stack((.25 + visibility * .5, np.full(len(visibility), .5))).astype('<f4')
    buffer = len(doc['bufferViews']); binary.extend(b'\0' * (-len(binary) % 4))
    doc['bufferViews'].append({'buffer':0, 'byteOffset':len(binary), 'byteLength':uv.nbytes}); binary.extend(uv.tobytes())
    eye['attributes']['TEXCOORD_1'] = len(doc['accessors'])
    doc['accessors'].append({'bufferView':buffer, 'componentType':5126, 'count':len(uv), 'type':'VEC2',
                             'min':uv.min(axis=0).tolist(), 'max':uv.max(axis=0).tolist()})

    output.mkdir(parents=True, exist_ok=True)
    for image in doc['images']:
        link = output / image['uri']
        if not link.exists(): link.symlink_to((source.parent / image['uri']).resolve())
    ramp = bpy.data.images.new('Morpheus eyelid ambient visibility', width=2, height=1, alpha=False)
    ramp.colorspace_settings.name = 'Non-Color'; ramp.pixels[:] = [0, 0, 0, 1, 1, 1, 1, 1]
    ramp.filepath_raw = str((output / 'morpheus-eye-occlusion.png').resolve()); ramp.file_format = 'PNG'; ramp.save()
    sampler = len(doc['samplers']); doc['samplers'].append({'magFilter':9729, 'minFilter':9729, 'wrapS':33071, 'wrapT':33071})
    image = len(doc['images']); doc['images'].append({'uri':'morpheus-eye-occlusion.png'})
    texture = len(doc['textures']); doc['textures'].append({'source':image, 'sampler':sampler})
    material = doc['materials'][eye['material']]; assert material['name'] == 'Eyes' and 'occlusionTexture' not in material
    material['occlusionTexture'] = {'index':texture, 'texCoord':1, 'strength':1}
    assert bytes(binary[:len(original)]) == original, 'Visibility bake modified existing geometry'
    doc['extras']['eyeOcclusionVersion'] = 1; doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    temporary = output / 'morpheus.glb.tmp'; temporary.write_bytes(result); temporary.replace(output / 'morpheus.glb')
    report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
              'raysPerVertex':samples, 'occlusionDistance':.16, 'occluder':'actual fitted head and eyelid triangles',
              'visibilityPercentiles':np.percentile(visibility, [0, 25, 50, 75, 100]).tolist(),
              'preservedBinaryBytes':len(original), 'primaryUvsColorsAlphaAndGeometryUnchanged':True,
              'limitation':'Rest-pose ambient visibility; revisit for future independent eye rotations or eyelid blendshapes.',
              'userAcceptance':'pending'}
    (output / 'eye-occlusion-report.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:]); main(args.source, args.output)
