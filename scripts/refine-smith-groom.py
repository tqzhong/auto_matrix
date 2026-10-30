"""Replace Smith's jagged alpha hair cards with a fitted, side-swept strand groom.

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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--film-volume', action='store_true', help='Fuller swept-back film silhouette with a narrower, tapered sideburn')
parser.add_argument('--fine-hairline', action='store_true', help='Stagger fine tapered roots across a translucent scalp transition')
parser.add_argument('--film-sweep', action='store_true', help='Side-swept crown, fuller back and short vertically trimmed sideburns')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
assert not args.fine_hairline or args.film_volume, 'Fine roots use the fitted film-volume scalp normals'
assert not args.film_sweep or args.fine_hairline, 'Film sweep uses the fine-root scalp topology'
raw = args.source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
assert doc['extras']['character'] == 'smith' and not doc['extras'].get('groomVersion')
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
skin_normals = array(primitive['attributes']['NORMAL'], 3)

surface = BVHTree.FromPolygons([Vector(p) for p in skin_points], skin_faces.tolist(), all_triangles=True)
center = np.array([0, eye[1] + .025, .10])


def scalp(direction):
    hit, normal, face, _ = surface.ray_cast(Vector(center), Vector(direction))
    if hit is None: raise RuntimeError('A groom ray missed the scalp.')
    if args.film_volume:
        # A flat triangle normal makes a lifted strand jump at every scalp
        # triangle boundary. Interpolate the existing smooth skin normals.
        a, b, c = skin_points[skin_faces[face]]
        u, v, w = b - a, c - a, np.array(hit) - a
        uu, vv, uv = np.dot(u,u), np.dot(v,v), np.dot(u,v)
        denominator = uu * vv - uv * uv
        s = (np.dot(w,u) * vv - np.dot(w,v) * uv) / denominator
        t = (np.dot(w,v) * uu - np.dot(w,u) * uv) / denominator
        normal = np.array([1 - s - t, s, t]) @ skin_normals[skin_faces[face]]
        normal /= np.linalg.norm(normal)
    return np.array(hit), np.array(normal)


def direction(phi, theta):
    return np.array([math.sin(phi) * math.sin(theta), math.cos(theta), math.cos(phi) * math.sin(theta)])


def boundary(phi):
    # Frontal widow's peak, receded corners, short sideburns and a clean nape.
    a = abs((phi + math.pi) % math.tau - math.pi)
    angles = [0, .42, .8, 1.05, 1.20, 1.40, 1.57, 1.88, 2.35, math.pi]
    heights = [.17, .195, .215, .135, .015, .015, .075, .035, -.10, -.12]
    if args.film_volume:
        angles = [0, .42, .8, 1.05, 1.21, 1.30, 1.37, 1.57, 1.88, 2.35, math.pi]
        heights = [.205, .235, .24, .145, .075, .015, .03, .095, .035, -.14, -.16]
    if args.fine_hairline:
        angles = [0, .42, .8, 1.05, 1.16, 1.20, 1.27, 1.34, 1.40, 1.57, 1.88, 2.35, math.pi]
        heights = [.205, .235, .24, .145, .075, -.04, -.045, .07, .105, .095, .035, -.14, -.16]
    if args.film_sweep:
        heights = [.205, .225, .235, .145, .075, -.015, -.015, .07, .105, .095, .035, -.14, -.16]
    i = min(len(angles) - 2, np.searchsorted(angles, a, side='right') - 1)
    t = (a - angles[i]) / (angles[i + 1] - angles[i]); t = t * t * (3 - 2 * t)
    edge = .0009 * math.sin(phi * 31) + .0006 * math.sin(phi * 73) if args.fine_hairline else 0
    return eye[1] + heights[i] * (1 - t) + heights[i + 1] * t + .003 * math.sin(phi * 2) * max(0, math.cos(phi)) + edge


phis = np.linspace(-math.pi, math.pi, 241 if args.fine_hairline else 161)
limits = []
for phi in phis:
    lo, hi = .02, 2.8
    for _ in range(20):
        mid = (lo + hi) / 2
        point, _ = scalp(direction(phi, mid))
        if point[1] > boundary(phi): lo = mid
        else: hi = mid
    limits.append((lo + hi) / 2)


def hair_surface(d, anchor=None):
    point, normal = scalp(d) if anchor is None else anchor
    phi = math.atan2(d[0], d[2]); theta = math.acos(np.clip(d[1], -1, 1))
    t = theta / np.interp(phi, phis, limits)
    loft = .004 + .009 * max(0, 1 - t ** 4)
    upper = np.clip((point[1] - eye[1] - .08) / .14, 0, 1)
    loft += .009 * math.exp(-((point[0] + .04) / .18) ** 2) * upper
    if args.film_volume:
        # The film has a raised swept crown, not a close-cut scalp cap. Keep
        # the lift inside the hairline so its roots still meet the real skin.
        interior = max(0, 1 - t ** 4)
        loft += interior * (.012 + .045 * upper * math.exp(-((point[0] + .045) / .22) ** 2))
        if args.film_sweep:
            back = np.clip((.12 - point[2]) / .20, 0, 1)
            loft += interior * (.018 * upper + .025 * back)
    if args.fine_hairline:
        # Carry every source of crown lift down to the real hairline. A
        # constant frontal lift makes the translucent cap hang over its roots.
        rise = np.clip((1 - t) / .22, 0, 1); rise = rise * rise * (3 - 2 * rise)
        loft = .0008 + (loft - .0008) * rise
    return point + normal * loft, normal


def add_mesh(name, positions, normals, uv, faces, material, colors=None):
    count = len(positions)
    if args.film_volume:
        normals = smooth_normals(np.array(positions), np.array(faces))
    joints = np.zeros((count, 4), dtype=np.uint16); joints[:, 0] = head_joint
    weights = np.zeros((count, 4)); weights[:, 0] = 1
    attrs = {'POSITION': append(positions, 'VEC3'), 'NORMAL': append(normals, 'VEC3'),
             'TEXCOORD_0': append(uv, 'VEC2'), 'JOINTS_0': append(joints, 'VEC4', 5123),
             'WEIGHTS_0': append(weights, 'VEC4')}
    if colors is not None: attrs['COLOR_0'] = append(colors, 'VEC4' if len(colors[0]) == 4 else 'VEC3')
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
doc['materials'].append({'name': 'Groom undercoat', 'alphaMode':'BLEND', 'pbrMetallicRoughness': {
    'baseColorFactor': [.010, .007, .005, 1], 'roughnessFactor': .68 if args.fine_hairline else .54, 'metallicFactor': 0},
    'extensions': {'KHR_materials_specular': {'specularFactor': .15}}})
strand_mat = len(doc['materials'])
doc['materials'].append({'name': 'Groomed hair', 'doubleSided': True, 'pbrMetallicRoughness': {
    'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .48, 'metallicFactor': 0},
    'extensions': {'KHR_materials_anisotropy': {'anisotropyStrength': .75, 'anisotropyRotation': math.pi / 2},
                   'KHR_materials_specular': {'specularFactor': .18}}})
if 'KHR_materials_anisotropy' not in doc.setdefault('extensionsUsed', []): doc['extensionsUsed'].append('KHR_materials_anisotropy')
positions, normals, uv, faces, cap_colors = [], [], [], [], []
if args.fine_hairline:
    # The ear-front surface is not radial: a latitude grid bridges its folds.
    # Reuse the real scalp triangles so the undercoat follows that anatomy.
    cap_points = list(skin_points); cap_normals = list(skin_normals); cap_faces = []; midpoints = {}
    def midpoint(a, b):
        key = tuple(sorted((int(a), int(b))))
        if key not in midpoints:
            midpoints[key] = len(cap_points); cap_points.append((skin_points[a] + skin_points[b]) / 2)
            normal = skin_normals[a] + skin_normals[b]; cap_normals.append(normal / np.linalg.norm(normal))
        return midpoints[key]
    for a, b, c in skin_faces[np.any(skin_points[skin_faces, 1] > eye[1] - .25, axis=1)]:
        ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
        cap_faces.extend([(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)])
    cap_points = np.array(cap_points); cap_normals = np.array(cap_normals); cap_faces = np.array(cap_faces)
    alpha = np.zeros(len(cap_points)); coordinates = np.zeros((len(cap_points), 2))
    for i, point in enumerate(cap_points):
        if point[1] < eye[1] - .25: continue
        d = point - center; d /= np.linalg.norm(d)
        phi = math.atan2(d[0], d[2]); t = math.acos(np.clip(d[1], -1, 1)) / np.interp(phi, phis, limits)
        edge = np.clip((1 - t) / .065, 0, 1)
        sideburn = np.clip((abs(phi) - 1.12) / .06, 0, 1) * np.clip((1.40 - abs(phi)) / .06, 0, 1)
        trim = np.clip((eye[1] + .08 - point[1]) / .10, 0, 1) * sideburn
        alpha[i] = edge * edge * (3 - 2 * edge) * (1 - (.85 if args.film_sweep else .5) * trim); coordinates[i] = [(phi + math.pi) / math.tau, t]
    selected = cap_faces[np.any(alpha[cap_faces] > 0, axis=1)]
    used = np.unique(selected); remap = {int(old): i for i, old in enumerate(used)}
    for i in used:
        d = cap_points[i] - center; d /= np.linalg.norm(d)
        point, normal = hair_surface(d, (cap_points[i], cap_normals[i]))
        positions.append(point); normals.append(normal); uv.append(coordinates[i]); cap_colors.append([1, 1, 1, alpha[i]])
    faces = [[remap[int(i)] for i in face] for face in selected]
else:
    rows = 24
    for j in range(rows + 1):
        for i, phi in enumerate(phis):
            theta = max(.001, j / rows * (limits[i] - (.004 if args.film_volume else .024))); point, normal = hair_surface(direction(phi, theta))
            positions.append(point); normals.append(normal); uv.append([i / (len(phis) - 1), j / rows])
            edge = min(1, (rows - j) / (1 if args.film_volume else 1.5)); cap_colors.append([1, 1, 1, edge * edge * (3 - 2 * edge)])
    for j in range(rows):
        for i in range(len(phis) - 1):
            a = j * len(phis) + i; b = a + len(phis)
            faces += [(a, b, a + 1), (a + 1, b, b + 1)]
add_mesh('Close-cut scalp undercoat', positions, normals, uv, faces, base_mat, cap_colors)

rng = np.random.default_rng(1999)
positions, normals, uv, faces, colors = [], [], [], [], []
strand_count = 3300 if args.film_sweep else 3000 if args.fine_hairline else 2200
for strand in range(strand_count):
    sideburn = args.fine_hairline and strand < 400
    phi = rng.uniform(1.18, 1.30) * (-1 if strand % 2 else 1) if sideburn else rng.uniform(-math.pi, math.pi)
    limit = np.interp(phi, phis, limits)
    # Dense short roots at the hairline avoid the opaque, jagged old card edge.
    fine_root = args.fine_hairline and strand < 1550
    theta = limit - rng.uniform(.002, .30) if sideburn else limit - rng.uniform(.002, .11) if fine_root else limit - rng.uniform(0, .035 if args.film_volume else .07) if strand < 750 else math.acos(rng.uniform(math.cos(limit), 1))
    d = direction(phi, theta); root, _ = scalp(d)
    length = rng.uniform(.22 if fine_root else .35, .52 if fine_root else .70) * (1 if root[1] > eye[1] + .09 else .60)
    width = rng.uniform(.00015, .00030) if fine_root else rng.uniform(.0004, .00075)
    if sideburn:
        length = rng.uniform(.035, .09); width = rng.uniform(.00010, .00018)
    if args.film_sweep and not fine_root:
        width *= .85
    color = np.array([.020, .013, .009]) * rng.uniform(.60, 1.45)
    path = []
    segments = 5 if sideburn else 10
    for j in range(segments + 1):
        t = j / segments
        sweep = np.array([-.14, -.22, -1.0])
        if args.film_sweep:
            top = np.clip((root[1] - eye[1] - .10) / .12, 0, 1)
            sweep = np.array([-.14 - .42 * top, -.30 + .15 * top, -1.0])
            if sideburn: sweep = np.array([0, -1.0, -.12])
        tangent = sweep - d * np.dot(sweep, d); tangent /= np.linalg.norm(tangent)
        point, normal = hair_surface(d)
        if j > 1 and point[1] < boundary(math.atan2(d[0], d[2])): break
        if args.film_volume and j < 2:
            # Root the fiber in the real scalp before it rises into the groom.
            # Starting every fiber on the lofted shell leaves an air gap.
            root_point, _ = scalp(d)
            rise = min(1, t / .2); rise = rise * rise * (3 - 2 * rise)
            point = (root_point + normal * .0008) * (1 - rise) + point * rise
        clump = .5 + .5 * math.sin(phi * 13 + root[1] * 19)
        lift = .001 + (.003 + .005 * clump) * math.sin(math.pi * t) * max(0, (root[1] - eye[1]) / .25)
        point += normal * lift
        across = np.cross(normal, tangent); across /= max(np.linalg.norm(across), 1e-8)
        path.append((point, normal, across))
        d += tangent * length / segments; d /= np.linalg.norm(d)
    start = len(positions)
    for j, (point, normal, across) in enumerate(path):
        t = j / (len(path) - 1)
        radius = width * (.35 + .65 * math.sin(math.pi * min(.85, t + .16))) * (1 - t ** 4)
        if fine_root:
            root_taper = min(1, t / .22); root_taper = root_taper * root_taper * (3 - 2 * root_taper)
            radius *= .12 + .88 * root_taper
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
    minimum = float('inf'); closest = None
    for point in samples:
        delta = point - center; distance = np.linalg.norm(delta)
        hit, _, _, hit_distance = surface.ray_cast(Vector(center), Vector(delta / distance))
        assert hit is not None, 'A groom check ray missed the scalp'
        clearance = float(distance - hit_distance)
        if clearance < minimum: minimum = clearance; closest = point.tolist()
    assert minimum > 0, f'{mesh["name"]} enters the skin: {minimum} at {closest}'
    checks.append({'mesh':mesh['name'], 'vertices':len(points), 'triangles':len(triangles), 'minimumSampledScalpClearance':minimum})
triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives'])
assert triangles < 160000, f'Matrix outfit exceeds the existing geometry budget: {triangles}'
args.output.mkdir(parents=True, exist_ok=True)
for image in doc['images']:
    link = args.output / image['uri']
    if not link.exists(): link.symlink_to((args.source.parent / image['uri']).resolve())
doc['extras'].update(groomVersion=4 if args.film_sweep else 3 if args.fine_hairline else 2 if args.film_volume else 1, groomSourceSha256=hashlib.sha256(raw).hexdigest(), groomUserAcceptance='pending')
doc['buffers'][0]['byteLength'] = len(binary)
encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
temporary = args.output / 'smith.glb.tmp'; temporary.write_bytes(result); temporary.replace(args.output / 'smith.glb')
report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
          'strandCount':strand_count, 'matrixWardrobeTriangles':triangles, 'scalpChecks':checks, 'userAcceptance':'pending'}
if args.film_volume:
    report['filmVolume'] = 'Raised swept crown and tapered sideburn, visually compared with the original film at the fixed fitted camera; user acceptance pending.'
if args.fine_hairline:
    report['fineHairline'] = {'taperedEdgeStrands':1550, 'shortSideburnStrands':400, 'edgeStrandHalfWidthRange':[.00015,.00030], 'sideburnHalfWidthRange':[.00010,.00018], 'rootAngularSpread':[.002,.11], 'undercoat':'Subdivided actual scalp topology with .065 angular-fraction alpha transition; thinner sideburn density'}
if args.film_sweep:
    report['filmSweep'] = {'crownLift':.018, 'backLift':.025, 'upperSweep':[-.56,-.15,-1.0], 'sideburnSweep':[0,-1.0,-.12], 'sideburnBottomRelativeToEye':-.015, 'sideburnUndercoatDensityReduction':.85, 'interiorStrandWidthScale':.85}
(args.output / 'groom-report.json').write_text(json.dumps(report, indent=2) + '\n'); print(json.dumps(report))
