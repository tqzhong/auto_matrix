"""Refine the playable Neo mesh, keeping its existing skeleton and skin weights.

Blender 4.5 authoring only. Run on the finished, unrefined character asset in a
staging directory; inspect the resulting GLB before publishing it to the game.
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--cast', type=Path, help='Update Neo in the existing editable four-character Blender project')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output.mkdir(parents=True, exist_ok=True)
data = (args.source / 'neo.glb').read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + length]); binary = bytearray(data[28 + length:])
if not doc['extras'].get('skinBaked') or doc['extras'].get('groomVersion'):
    raise RuntimeError('Use the finished, unrefined Neo as the source, not the output of this script.')
for entry in doc['images']:
    shutil.copy2(args.source / entry['uri'], args.output / entry['uri'])


def array(index, width):
    a = doc['accessors'][index]; view = doc['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    return np.frombuffer(binary, dtype=dtype, count=a['count'] * width,
                         offset=view.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, width)


def append(values, kind, component=5126):
    values = np.asarray(values, dtype={5126: '<f4', 5125: '<u4', 5123: '<u2'}[component])
    binary.extend(b'\0' * (-len(binary) % 4))
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
    binary.extend(values.tobytes())
    doc['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind,
                             'min': np.atleast_1d(values.min(axis=0)).tolist(), 'max': np.atleast_1d(values.max(axis=0)).tolist()})
    return len(doc['accessors']) - 1


def save():
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    (args.output / 'neo.glb').write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
        + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary)


eye = np.array(doc['extras']['eye'])
for mesh in doc['meshes']:
    if mesh['name'] not in ['Anatomical head and hands', 'high-poly']: continue
    primitive = mesh['primitives'][0]; attrs = primitive['attributes']; points = array(attrs['POSITION'], 3)
    x, y, z = points.T.copy(); front = np.clip((z - .18) / .10, 0, 1)
    # Soften the pinched cheeks and square the lower jaw without moving the
    # neck, hand vertices, or the skeleton that drives the existing animation.
    jaw = np.exp(-((y - (eye[1] - .22)) / .065) ** 2) * front
    points[:, 0] += np.sign(x) * .007 * jaw * np.clip(np.abs(x) / .12, 0, 1)
    cheek = np.exp(-((np.abs(x) - .11) / .045) ** 2 - ((y - (eye[1] - .08)) / .055) ** 2) * front
    points[:, 2] += .005 * cheek
    face = np.exp(-((y - (eye[1] - .16)) / .18) ** 4) * front
    points[:, 1] += (eye[1] - y) * .035 * face
    eyelid = np.exp(-((np.abs(x) - eye[0]) / .039) ** 4 - ((y - eye[1]) / .042) ** 4) * front
    points[:, 1] -= (y - eye[1]) * .14 * eyelid
    nose = np.exp(-(x / .033) ** 2 - ((y - (eye[1] - .105)) / .047) ** 2) * front
    points[:, 2] -= .006 * nose
    normals = smooth_normals(points, array(primitive['indices'], 1).reshape(-1, 3))
    array(attrs['NORMAL'], 3)[:] = normals
    doc['accessors'][attrs['POSITION']].update(min=points.min(axis=0).tolist(), max=points.max(axis=0).tolist())
    if mesh['name'] == 'Anatomical head and hands':
        skin_points = points.copy(); skin_faces = array(primitive['indices'], 1).reshape(-1, 3).copy()
    del points, normals

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
    heights = [.151, .166, .14, .075, .015, .10, .075, -.12, -.17]
    i = min(len(angles) - 2, np.searchsorted(angles, a, side='right') - 1)
    t = (a - angles[i]) / (angles[i + 1] - angles[i]); t = t * t * (3 - 2 * t)
    return eye[1] + heights[i] * (1 - t) + heights[i + 1] * t


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
    loft = .002 + .011 * max(0, 1 - t ** 4)
    return point + normal * loft, normal


def add_mesh(name, positions, normals, uv, faces, material, colors=None):
    count = len(positions)
    joints = np.zeros((count, 4), dtype=np.uint16); joints[:, 0] = 3
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
    'baseColorFactor': [.006, .007, .008, 1], 'roughnessFactor': .62, 'metallicFactor': 0},
    'extensions': {'KHR_materials_specular': {'specularFactor': .15}}})
strand_mat = len(doc['materials'])
doc['materials'].append({'name': 'Groomed hair', 'doubleSided': True, 'pbrMetallicRoughness': {
    'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .58, 'metallicFactor': 0},
    'extensions': {'KHR_materials_anisotropy': {'anisotropyStrength': .75, 'anisotropyRotation': math.pi / 2},
                   'KHR_materials_specular': {'specularFactor': .10}}})
doc.setdefault('extensionsUsed', []).append('KHR_materials_anisotropy')
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
for strand in range(3000):
    phi = rng.uniform(-math.pi, math.pi); limit = np.interp(phi, phis, limits)
    # Dense short roots at the hairline avoid the opaque, jagged old card edge.
    theta = limit - rng.uniform(0, .07) if strand < 1000 else math.acos(rng.uniform(math.cos(limit), 1))
    d = direction(phi, theta); root, _ = scalp(d)
    length = rng.uniform(.30, .65) * (1 if root[1] > eye[1] + .09 else .60)
    width = rng.uniform(.00035, .00065)
    color = np.array([.012, .014, .016]) * rng.uniform(.60, 1.45)
    path = []
    for j in range(11):
        t = j / 10
        sweep = np.array([-.13 + .05 * math.sin(phi * 8), -.35, -1.0])
        tangent = sweep - d * np.dot(sweep, d); tangent /= np.linalg.norm(tangent)
        point, normal = hair_surface(d)
        if j > 1 and point[1] < boundary(math.atan2(d[0], d[2])): break
        lift = .0005 + .003 * math.sin(math.pi * t) * max(0, (root[1] - eye[1]) / .25)
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

skin = next(m for m in doc['materials'] if m['name'] == 'Skin')
skin['pbrMetallicRoughness']['baseColorFactor'] = [.82, .79, .77, 1]
skin['pbrMetallicRoughness']['roughnessFactor'] = .63
skin['extensions'] = {'KHR_materials_specular': {'specularFactor': .45}}
doc['extras']['groomVersion'] = 1
save()

# Bake microrelief in the character's actual UV layout. The normal map carries
# surface detail, rather than painting light or shadows onto the skin color.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str((args.output / 'neo.glb').resolve()))
obj = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Anatomical'))
material = obj.data.materials[0]; nodes = material.node_tree.nodes; links = material.node_tree.links
principled = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
coordinate = nodes.new('ShaderNodeTexCoord')
noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 850; noise.inputs['Detail'].default_value = 2
links.new(coordinate.outputs['Object'], noise.inputs['Vector'])
bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .65; bump.inputs['Distance'].default_value = .0004
links.new(noise.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs['Normal'], principled.inputs['Normal'])
scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 8
scene.render.bake.normal_space = 'TANGENT'
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
obj.data.uv_layers.active_index = 0
normal = bpy.data.images.new('Neo skin microrelief', width=2048, height=2048, alpha=False)
normal.colorspace_settings.name = 'Non-Color'
target = nodes.new('ShaderNodeTexImage'); target.image = normal; nodes.active = target
bpy.ops.object.bake(type='NORMAL', margin=16)
normal.filepath_raw = str((args.output / 'neo-normal.png').resolve()); normal.file_format = 'PNG'; normal.save()
links.remove(principled.inputs['Normal'].links[0])
mapped = nodes.new('ShaderNodeNormalMap'); mapped.inputs['Strength'].default_value = .65
links.new(target.outputs['Color'], mapped.inputs['Color']); links.new(mapped.outputs['Normal'], principled.inputs['Normal'])
texture = len(doc['textures']); doc['images'].append({'uri': 'neo-normal.png'})
doc['textures'].append({'source': len(doc['images']) - 1, 'sampler': 0}); skin['normalTexture'] = {'index': texture, 'scale': .65}
save()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str((args.output / 'neo-refined.blend').resolve()))
if args.cast:
    bpy.ops.wm.open_mainfile(filepath=str(args.cast.resolve()))
    collection = bpy.data.collections['NEO / editable skinned model']
    rig = next(o for o in collection.objects if o.type == 'ARMATURE')
    bpy.context.view_layer.update(); placement = rig.matrix_world.copy()
    accessories = [(o, o.parent_bone, o.matrix_world.copy()) for o in collection.objects if o.parent_type == 'BONE']
    keep = {o for o, _, _ in accessories} | {o for o in collection.objects if o.type == 'EMPTY'}
    for obj, _, _ in accessories: obj.parent = None
    for obj in list(collection.objects):
        if obj not in keep: bpy.data.objects.remove(obj, do_unlink=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str((args.output / 'neo.glb').resolve()))
    imported = set(bpy.data.objects) - before
    for obj in imported:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.parent is None: obj.matrix_world = placement @ obj.matrix_world
    rig = next(o for o in imported if o.type == 'ARMATURE')
    bpy.context.view_layer.update()
    for obj, bone, transform in accessories:
        obj.parent = rig; obj.parent_type = 'BONE'; obj.parent_bone = bone; obj.matrix_world = transform
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.cast.resolve()))
print('Wrote refined Neo and 3,000 groom strands:', args.output / 'neo.glb', flush=True)
