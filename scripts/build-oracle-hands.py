"""Extract the shipped CC0 hand anatomy and its 15 finger joints; no new download.

The Oracle's park performance supplies the skin material and wrist placement.
Only geometry belonging to each hand is retained; actor heads are never copied.
"""
import hashlib
import json
from pathlib import Path
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'packages/client/public/assets/characters/trinity.glb'
raw = source.read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
src = json.loads(raw[20:20 + size])
binary = raw[28 + size:]
components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
dtypes = {5123: '<u2', 5125: '<u4', 5126: '<f4'}


def array(index):
    a = src['accessors'][index]; v = src['bufferViews'][a['bufferView']]
    return np.frombuffer(binary, dtype=dtypes[a['componentType']], count=a['count'] * components[a['type']],
                         offset=v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(a['count'], components[a['type']]).copy()


doc = {'asset': {'version': '2.0', 'generator': 'auto_matrix/build-oracle-hands.py'}, 'scene': 0,
       'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'skins': [], 'buffers': [], 'bufferViews': [], 'accessors': [],
       'materials': [{'name': 'Oracle hand skin', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .8}}],
       'extras': {'source': 'trinity.glb / CC0 MakeHuman anatomy', 'sourceSha256': hashlib.sha256(raw).hexdigest()}}
chunks = bytearray()


def accessor(values, kind, component=5126):
    values = np.asarray(values, dtype=dtypes[component]).reshape(-1, components[kind])
    while len(chunks) % 4: chunks.append(0)
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(chunks), 'byteLength': values.nbytes})
    chunks.extend(values.tobytes())
    item = {'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind}
    if kind == 'VEC3': item.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    doc['accessors'].append(item)
    return len(doc['accessors']) - 1


world = {}
def visit(index, parent):
    node = src['nodes'][index]
    assert 'matrix' not in node and 'rotation' not in node, 'Review transformed source skeleton before rebuilding'
    world[index] = parent + np.array(node.get('translation', [0, 0, 0]))
    for child in node.get('children', []): visit(child, world[index])
for index in src['scenes'][src.get('scene', 0)]['nodes']: visit(index, np.zeros(3))

primitive = next(m for m in src['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
attrs = {name: array(index) for name, index in primitive['attributes'].items()}
triangles = array(primitive['indices']).reshape(-1, 3)
skin = src['skins'][0]; indices = attrs['JOINTS_0']; weights = attrs['WEIGHTS_0']
for side in ['R', 'L']:
    selected = [i for i, n in enumerate(skin['joints']) if src['nodes'][n]['name'].startswith(('wrist', 'finger')) and src['nodes'][n]['name'].endswith('_' + side)]
    wrist = next(i for i in selected if src['nodes'][skin['joints'][i]]['name'] == 'wrist_' + side)
    origin = world[skin['joints'][wrist]]
    keep = (weights * np.isin(indices, selected)).sum(axis=1) >= .5
    faces = triangles[keep[triangles].all(axis=1)]; vertices = np.unique(faces)
    remap = np.zeros(len(keep), dtype=np.uint32); remap[vertices] = np.arange(len(vertices))
    root = len(doc['nodes']); doc['scenes'][0]['nodes'].append(root)
    doc['nodes'].append({'name': 'oracle-anatomical-hand-' + side, 'children': []})
    bones = {old: len(doc['nodes']) + i for i, old in enumerate(selected)}
    inverse = []
    for old in selected:
        n = skin['joints'][old]; original = src['nodes'][n]
        node = {'name': original['name'], 'translation': [0, 0, 0] if old == wrist else original['translation']}
        children = [bones[skin['joints'].index(child)] for child in original.get('children', []) if child in [skin['joints'][j] for j in selected]]
        if children: node['children'] = children
        doc['nodes'].append(node)
        matrix = np.eye(4); matrix[:3, 3] = origin - world[n]; inverse.append(matrix.T.ravel())
    doc['nodes'][root]['children'].append(bones[wrist])
    joint_remap = np.zeros(len(skin['joints']), dtype=np.uint16) + selected.index(wrist)
    for i, old in enumerate(selected): joint_remap[old] = i
    attributes = {'POSITION': accessor(attrs['POSITION'][vertices] - origin, 'VEC3'),
                  'NORMAL': accessor(attrs['NORMAL'][vertices], 'VEC3'), 'TEXCOORD_0': accessor(attrs['TEXCOORD_0'][vertices], 'VEC2'),
                  'JOINTS_0': accessor(joint_remap[indices[vertices]], 'VEC4', 5123), 'WEIGHTS_0': accessor(weights[vertices], 'VEC4')}
    doc['skins'].append({'joints': list(bones.values()), 'skeleton': bones[wrist], 'inverseBindMatrices': accessor(inverse, 'MAT4')})
    doc['meshes'].append({'name': 'oracle-hand-skin-' + side, 'primitives': [{'attributes': attributes, 'indices': accessor(remap[faces], 'SCALAR', 5125), 'material': 0}]})
    doc['nodes'][root]['children'].append(len(doc['nodes']))
    doc['nodes'].append({'name': 'oracle-hand-skin-' + side, 'mesh': len(doc['meshes']) - 1, 'skin': len(doc['skins']) - 1})
    print(side, len(vertices), 'vertices', len(faces), 'triangles')

doc['buffers'] = [{'byteLength': len(chunks)}]
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(chunks)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(chunks), 0x004e4942) + chunks
destination = ROOT / 'packages/client/public/assets/characters/oracle-park-hands.glb'
destination.write_bytes(result)
print(destination, len(result), 'bytes')
