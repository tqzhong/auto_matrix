"""Restore the existing outer eye surface as a separate glTF transmissive layer.

The alpha inspection must match the exact input GLB. No vertex, weight, normal,
UV or texture is changed; only triangle assignment and the outer material change.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct


def main(source, inspection, output):
    raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); original = raw[28 + size:]; binary = bytearray(original)
    audit = json.loads(inspection.read_text())
    assert hashlib.sha256(raw).hexdigest() == audit['sourceSha256']
    assert doc['extras']['character'] == 'smith' and not doc['extras'].get('corneaVersion')
    assert audit['mixedVertexAlphaFaces'] == 0
    mesh_id = next(i for i, mesh in enumerate(doc['meshes']) if mesh['name'] == 'high-poly')
    mesh = doc['meshes'][mesh_id]; assert len(mesh['primitives']) == 1
    eye = mesh['primitives'][0]; accessor = doc['accessors'][eye['indices']]
    view = doc['bufferViews'][accessor['bufferView']]
    assert accessor['type'] == 'SCALAR' and 'byteStride' not in view and not eye.get('targets')
    kind = {5123:'H', 5125:'I'}[accessor['componentType']]
    indices = struct.unpack_from('<' + kind * accessor['count'], original,
                                 view.get('byteOffset', 0) + accessor.get('byteOffset', 0))
    groups = [audit['opaqueFaceIndices'], audit['removedFaceIndices']]
    assert sorted(groups[0] + groups[1]) == list(range(len(indices) // 3))
    assert len(groups[0]) == 1060 and len(groups[1]) == 980

    def append_indices(faces):
        values = [indices[face * 3 + k] for face in faces for k in range(3)]
        data = struct.pack('<' + kind * len(values), *values)
        binary.extend(b'\0' * (-len(binary) % 4)); view_id = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0, 'byteOffset':len(binary), 'byteLength':len(data), 'target':34963})
        binary.extend(data); result = len(doc['accessors'])
        doc['accessors'].append({'bufferView':view_id, 'componentType':accessor['componentType'],
                                 'count':len(values), 'type':'SCALAR', 'min':[min(values)], 'max':[max(values)]})
        return result

    cornea = copy.deepcopy(eye)
    eye['indices'] = append_indices(groups[0]); cornea['indices'] = append_indices(groups[1])
    cornea['material'] = len(doc['materials'])
    doc['materials'].append({'name':'Eyes cornea',
        'pbrMetallicRoughness':{'baseColorFactor':[1, 1, 1, 1], 'roughnessFactor':.04, 'metallicFactor':0},
        'alphaMode':'OPAQUE', 'doubleSided':False,
        'extensions':{'KHR_materials_transmission':{'transmissionFactor':1}, 'KHR_materials_ior':{'ior':1.4}},
        'occlusionTexture':copy.deepcopy(doc['materials'][eye['material']]['occlusionTexture'])})
    for extension in ['KHR_materials_transmission', 'KHR_materials_ior']:
        if extension not in doc['extensionsUsed']: doc['extensionsUsed'].append(extension)
    node_id = next(i for i, node in enumerate(doc['nodes']) if node.get('mesh') == mesh_id)
    node = copy.deepcopy(doc['nodes'][node_id]); assert 'children' not in node
    node['name'] = 'Corneal tear film'; node['mesh'] = len(doc['meshes'])
    doc['meshes'].append({'name':'Corneal tear film', 'primitives':[cornea]})
    parent_lists = [n['children'] for n in doc['nodes'] if node_id in n.get('children', [])]
    parent_lists += [scene['nodes'] for scene in doc['scenes'] if node_id in scene['nodes']]
    assert len(parent_lists) == 1
    parent_lists[0].append(len(doc['nodes'])); doc['nodes'].append(node)
    doc['extras']['corneaVersion'] = 1; doc['extras']['corneaSourceSha256'] = audit['sourceSha256']
    doc['buffers'][0]['byteLength'] = len(binary)
    assert bytes(binary[:len(original)]) == original
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    output.mkdir(parents=True, exist_ok=True)
    for image in doc['images']:
        link = output / image['uri']
        if not link.exists(): link.symlink_to((source.parent / image['uri']).resolve())
    temporary = output / 'smith.glb.tmp'; temporary.write_bytes(result); temporary.replace(output / 'smith.glb')
    report = {'sourceSha256':audit['sourceSha256'], 'candidateSha256':hashlib.sha256(result).hexdigest(),
              'inspectionSha256':hashlib.sha256(inspection.read_bytes()).hexdigest(),
              'opaqueEyeTriangles':len(groups[0]), 'transmissiveTriangles':len(groups[1]),
              'addedTriangles':0, 'preservedBinaryBytes':len(original), 'addedBytes':len(result) - len(raw),
              'ior':1.4, 'roughness':.04, 'transmission':1,
              'limitation':'Thin optical surface, artistic IOR; no volumetric refraction or dynamic tear film.',
              'userAcceptance':'pending'}
    (output / 'cornea-report.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True); parser.add_argument('--inspection', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); main(args.source, args.inspection, args.output)
