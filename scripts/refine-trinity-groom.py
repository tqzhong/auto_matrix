"""Replace Trinity's jagged alpha hair cards with a fitted, side-swept strand groom.

Blender authoring only; preserve the portrait candidate's body and rig. The
cap and strands are attached to the actual scalp and use the existing head
joint. This is a review candidate, not actor-likeness acceptance.
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

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
raw = args.source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
assert doc['extras']['character'] == 'trinity' and not doc['extras'].get('groomVersion')
eye = np.array(doc['extras']['eye'])
head_joint = doc['skins'][0]['joints'].index(next(i for i, n in enumerate(doc['nodes']) if n['name'] == 'head'))

def array(index, width):
    a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
    dtype = np.dtype({5126:'<f4', 5125:'<u4', 5123:'<u2'}[a['componentType']])
    return np.ndarray((a['count'], width), dtype, buffer=binary, offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                      strides=(v.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()

def append(values, kind, component=5126):
    values = np.asarray(values, dtype={5126:'<f4', 5125:'<u4', 5123:'<u2'}[component])
    assert np.isfinite(values).all()
    binary.extend(b'\0' * (-len(binary) % 4)); view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0, 'byteOffset':len(binary), 'byteLength':values.nbytes}); binary.extend(values.tobytes())
    doc['accessors'].append({'bufferView':view, 'componentType':component, 'count':len(values), 'type':kind,
                             'min':np.atleast_1d(values.min(axis=0)).tolist(), 'max':np.atleast_1d(values.max(axis=0)).tolist()})
    return len(doc['accessors']) - 1

primitive = next(m for m in doc['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
skin_points = array(primitive['attributes']['POSITION'], 3); skin_faces = array(primitive['indices'], 1).reshape(-1, 3)

surface = BVHTree.FromPolygons([Vector(p) for p in skin_points], skin_faces.tolist(), all_triangles=True)
center = np.array([0, eye[1] + .025, .10])


def scalp(direction):
    hit, normal, _, _ = surface.ray_cast(Vector(center), Vector(direction))
    if hit is None: raise RuntimeError('A groom ray missed the scalp.')
    return np.array(hit), np.array(normal)


def direction(phi, theta):
    return np.array([math.sin(phi) * math.sin(theta), math.cos(theta), math.cos(phi) * math.sin(theta)])


def boundary(phi):
    # Frontal widow's peak, receded corners, short sideburns and a clean nape.
    a = abs((phi + math.pi) % math.tau - math.pi)
    angles = [0, .42, .8, 1.05, 1.30, 1.57, 1.88, 2.35, math.pi]
    heights = [.145, .153, .13, .07, -.025, .085, .045, -.12, -.14]
    i = min(len(angles) - 2, np.searchsorted(angles, a, side='right') - 1)
    t = (a - angles[i]) / (angles[i + 1] - angles[i]); t = t * t * (3 - 2 * t)
    return eye[1] + heights[i] * (1 - t) + heights[i + 1] * t + .008 * math.sin(phi * 2) * max(0, math.cos(phi))


phis = np.linspace(-math.pi, math.pi, 161)
limits = []
for phi in phis:
    lo, hi = .02, 2.8
    for _ in range(20):
        mid = (lo + hi) / 2
        point, _ = scalp(direction(phi, mid))
        if point[1] > boundary(phi): lo = mid
        else: hi = mid
    limits.append((lo + hi) / 2)


def hair_surface(d):
    point, normal = scalp(d)
    phi = math.atan2(d[0], d[2]); theta = math.acos(np.clip(d[1], -1, 1))
    t = theta / np.interp(phi, phis, limits)
    loft = .004 + .013 * max(0, 1 - t ** 4)
    upper = np.clip((point[1] - eye[1] - .08) / .14, 0, 1)
    loft += .012 * math.exp(-((point[0] + .04) / .18) ** 2) * upper
    return point + normal * loft, normal


def add_mesh(name, positions, normals, uv, faces, material, colors=None):
    count = len(positions)
    joints = np.zeros((count, 4), dtype=np.uint16); joints[:, 0] = head_joint
    weights = np.zeros((count, 4)); weights[:, 0] = 1
    attrs = {'POSITION': append(positions, 'VEC3'), 'NORMAL': append(normals, 'VEC3'),
             'TEXCOORD_0': append(uv, 'VEC2'), 'JOINTS_0': append(joints, 'VEC4', 5123),
             'WEIGHTS_0': append(weights, 'VEC4')}
    if colors is not None: attrs['COLOR_0'] = append(colors, 'VEC3')
    mesh = len(doc['meshes']); doc['meshes'].append({'name': name, 'primitives': [
        {'attributes': attrs, 'indices': append(np.array(faces).reshape(-1), 'SCALAR', 5125), 'material': material}]})
    doc['scenes'][0]['nodes'].append(len(doc['nodes'])); doc['nodes'].append({'name': name, 'mesh': mesh, 'skin': 0})


old_hair = next(i for i, mesh in enumerate(doc['meshes']) if mesh['name'] == 'short04')
# Remove the node itself: Blender also imports unattached nodes, whereas the
# game loads only scene roots. Leaving an orphan would resurrect the old hair.
kept = [i for i, node in enumerate(doc['nodes']) if node.get('mesh') != old_hair]
remap = {old: new for new, old in enumerate(kept)}
doc['nodes'] = [doc['nodes'][i] for i in kept]
for node in doc['nodes']:
    if 'children' in node: node['children'] = [remap[i] for i in node['children'] if i in remap]
    if node.get('mesh', -1) > old_hair: node['mesh'] -= 1
for scene in doc['scenes']: scene['nodes'] = [remap[i] for i in scene['nodes'] if i in remap]
for skeleton in doc['skins']:
    skeleton['joints'] = [remap[i] for i in skeleton['joints']]
    skeleton['skeleton'] = remap[skeleton['skeleton']]
doc['meshes'].pop(old_hair)
base_mat = len(doc['materials'])
doc['materials'].append({'name': 'Groom undercoat', 'pbrMetallicRoughness': {
    'baseColorFactor': [.006, .007, .008, 1], 'roughnessFactor': .54, 'metallicFactor': 0},
    'extensions': {'KHR_materials_specular': {'specularFactor': .15}}})
strand_mat = len(doc['materials'])
doc['materials'].append({'name': 'Groomed hair', 'doubleSided': True, 'pbrMetallicRoughness': {
    'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .48, 'metallicFactor': 0},
    'extensions': {'KHR_materials_anisotropy': {'anisotropyStrength': .75, 'anisotropyRotation': math.pi / 2},
                   'KHR_materials_specular': {'specularFactor': .18}}})
if 'KHR_materials_anisotropy' not in doc.setdefault('extensionsUsed', []): doc['extensionsUsed'].append('KHR_materials_anisotropy')
positions, normals, uv, faces = [], [], [], []
rows = 24
for j in range(rows + 1):
    for i, phi in enumerate(phis):
        theta = max(.001, j / rows * (limits[i] - .024)); point, normal = hair_surface(direction(phi, theta))
        positions.append(point); normals.append(normal); uv.append([i / (len(phis) - 1), j / rows])
for j in range(rows):
    for i in range(len(phis) - 1):
        a = j * len(phis) + i; b = a + len(phis)
        faces += [(a, b, a + 1), (a + 1, b, b + 1)]
add_mesh('Close-cut scalp undercoat', positions, normals, uv, faces, base_mat)

rng = np.random.default_rng(1999)
positions, normals, uv, faces, colors = [], [], [], [], []
for strand in range(2200):
    phi = rng.uniform(-math.pi, math.pi); limit = np.interp(phi, phis, limits)
    # Dense short roots at the hairline avoid the opaque, jagged old card edge.
    theta = limit - rng.uniform(0, .07) if strand < 750 else math.acos(rng.uniform(math.cos(limit), 1))
    d = direction(phi, theta); root, _ = scalp(d)
    length = rng.uniform(.30, .65) * (1 if root[1] > eye[1] + .09 else .60)
    width = rng.uniform(.0004, .00075)
    color = np.array([.012, .014, .016]) * rng.uniform(.60, 1.45)
    path = []
    for j in range(11):
        t = j / 10
        sweep = np.array([-.38 if root[0] < .035 else .24, -.30, -1.0])
        tangent = sweep - d * np.dot(sweep, d); tangent /= np.linalg.norm(tangent)
        point, normal = hair_surface(d)
        if j > 1 and point[1] < boundary(math.atan2(d[0], d[2])): break
        clump = .5 + .5 * math.sin(phi * 13 + root[1] * 19)
        lift = .001 + (.003 + .005 * clump) * math.sin(math.pi * t) * max(0, (root[1] - eye[1]) / .25)
        point += normal * lift
        across = np.cross(normal, tangent); across /= max(np.linalg.norm(across), 1e-8)
        path.append((point, normal, across))
        d += tangent * length / 10; d /= np.linalg.norm(d)
    start = len(positions)
    for j, (point, normal, across) in enumerate(path):
        t = j / (len(path) - 1)
        radius = width * (.35 + .65 * math.sin(math.pi * min(.85, t + .16))) * (1 - t ** 4)
        for side in [-1, 1]:
            positions.append(point + across * side * radius); normals.append(normal)
            uv.append([(side + 1) / 2, t]); colors.append(color)
        if j < len(path) - 1:
            a = start + j * 2; faces += [(a, a + 2, a + 1), (a + 1, a + 2, a + 3)]
add_mesh('Swept individual hair strands', positions, normals, uv, faces, strand_mat, colors)

# Check vertices and face centroids, not just control points, against the
# actual fitted scalp. Reject candidates with embedded hair surfaces.
checks = []
for mesh in doc['meshes'][-2:]:
    p = mesh['primitives'][0]; points = array(p['attributes']['POSITION'], 3)
    triangles = array(p['indices'], 1).reshape(-1, 3)
    samples = np.vstack((points, points[triangles].mean(axis=1)))
    minimum = float('inf')
    for point in samples:
        delta = point - center; distance = np.linalg.norm(delta)
        hit, _, _, hit_distance = surface.ray_cast(Vector(center), Vector(delta / distance))
        assert hit is not None, 'A groom check ray missed the scalp'
        minimum = min(minimum, float(distance - hit_distance))
    assert minimum > 0, f'{mesh["name"]} enters the skin: {minimum}'
    checks.append({'mesh':mesh['name'], 'vertices':len(points), 'triangles':len(triangles), 'minimumSampledScalpClearance':minimum})
triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] if not m['name'].startswith('trinity-logos') for p in m['primitives'])
assert triangles < 160000, f'Matrix outfit exceeds the existing geometry budget: {triangles}'
args.output.mkdir(parents=True, exist_ok=True)
for image in doc['images']:
    link = args.output / image['uri']
    if not link.exists(): link.symlink_to((args.source.parent / image['uri']).resolve())
doc['extras'].update(groomVersion=1, groomSourceSha256=hashlib.sha256(raw).hexdigest(), groomUserAcceptance='pending')
doc['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
temporary = args.output / 'trinity.glb.tmp'; temporary.write_bytes(result); temporary.replace(args.output / 'trinity.glb')
report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
          'strandCount':2200, 'matrixWardrobeTriangles':triangles, 'scalpChecks':checks, 'userAcceptance':'pending'}
(args.output / 'groom-report.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report))
