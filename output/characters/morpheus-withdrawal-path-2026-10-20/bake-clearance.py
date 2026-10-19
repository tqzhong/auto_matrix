"""Offline full-garment withdrawal control using today's actual fitted layers."""
import bpy
import json
import sys
import time
import numpy as np
from collections import defaultdict
from pathlib import Path
from mathutils import Matrix

base = Path(__file__).parent
sys.path.insert(0, str(base.parents[2] / 'scripts'))
from cloth_collision import keyframe_collider_vertices

folder = base / 'clearance-input'
scale = 100.0
out = base / 'clearance-physics'
out.mkdir(exist_ok=True)
data = json.loads((folder / 'manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 25
scene.gravity = (0, 0, -9.81 * scale)
assert abs(scene.gravity.z + 9.81 * scale) < 1e-4
model = np.asarray(data['points'], dtype=float)
points = model[:, [0, 2, 1]] * [.4, -.4, .4] * scale
faces = np.asarray(data['indices'], dtype=np.int32).reshape(-1, 3)
assert all(len(set(face)) == 3 for face in faces), 'welding collapsed a displayed face'

# Preserve every rendered triangle. Extra non-rendered structural edges retain
# the existing distance of the sewn waist and inner lapel strips; sewing-to-zero
# is intentionally disabled. No garment panel is discarded or replaced.
stitches = set()
coat_ids = np.unique(data['parts'][0]['vertices'])
for part_index, part in enumerate(data['parts'][1:], 1):
    for local, vertex in enumerate(part['vertices']):
        seam = local % 7 <= 1 if part_index == 1 else local < 82
        if not seam:
            continue
        distance = np.linalg.norm(points[coat_ids] - points[vertex], axis=1)
        for target in coat_ids[np.argsort(distance)[:3]]:
            assert target != vertex
            stitches.add(tuple(sorted((int(vertex), int(target)))))
mesh = bpy.data.meshes.new('actual complete coat with sewn waist and lapels')
mesh.from_pydata(points.tolist(), list(stitches), faces.tolist())
mesh.update()
cloth = bpy.data.objects.new('complete actual garment', mesh)
bpy.context.collection.objects.link(cloth)
for face in mesh.polygons:
    face.use_smooth = True

# Identify all boundary rings of the real upper coat, retaining the full cuffs.
edges = defaultdict(int)
upper_faces = faces[:len(data['surfaces'][0]['indices']) // 3]
for face in upper_faces:
    for i in range(3):
        edges[tuple(sorted((int(face[i]), int(face[(i+1) % 3]))))] += 1
graph = defaultdict(set)
for (a, b), count in edges.items():
    if count == 1:
        graph[a].add(b)
        graph[b].add(a)
remaining = set(graph)
loops = []
while remaining:
    component = {remaining.pop()}
    stack = list(component)
    while stack:
        for next_vertex in graph[stack.pop()]:
            if next_vertex in remaining:
                remaining.remove(next_vertex)
                component.add(next_vertex)
                stack.append(next_vertex)
    loops.append(sorted(component))
assert len(loops) == 3, len(loops)
assert all(len(graph[vertex]) == 2 for vertex in graph), 'garment boundary is not a ring'
cuff_loops = sorted(loops, key=len)[:2]
pin = cloth.vertex_groups.new(name='actual cuff constraints')
C = Matrix(((.4*scale, 0, 0, 0), (0, 0, -.4*scale, 0), (0, .4*scale, 0, 0), (0, 0, 0, 1)))
constraints = []
for side in ['R', 'L']:
    sign = -1 if side == 'R' else 1
    ring = next(loop for loop in cuff_loops if np.mean(model[loop, 0]) * sign > 0)
    group = cloth.vertex_groups.new(name='complete cuff ' + side)
    group.add(ring, 1, 'REPLACE')
    pin.add(ring, 1, 'REPLACE')
    owner = bpy.data.objects.new('authored cuff path ' + side, None)
    bpy.context.collection.objects.link(owner)
    owner.rotation_mode = 'QUATERNION'
    for frame in data['frames']:
        source = next(cuff for cuff in frame['cuffs'] if cuff['side'] == side)
        matrix = C @ Matrix(np.asarray(source['matrix']).reshape(4, 4, order='F').tolist()) @ C.inverted()
        owner.location = matrix.to_translation()
        owner.rotation_quaternion = matrix.to_quaternion()
        owner.keyframe_insert('location', frame=frame['frame'])
        owner.keyframe_insert('rotation_quaternion', frame=frame['frame'])
    scene.frame_set(1)
    bpy.context.view_layer.update()
    hook = cloth.modifiers.new('preserved cuff ' + side, 'HOOK')
    hook.object = owner
    hook.vertex_group = group.name
    hook.matrix_inverse = owner.matrix_world.inverted() @ cloth.matrix_world
    hook.falloff_type = 'NONE'
    constraints.append({'side': side, 'ring': ring})

bodyfaces = []
offset = 0
for part in data['bodies']:
    bodyfaces.extend(np.asarray(part['indices']).reshape(-1, 3) + offset)
    offset += part['count']
initial = np.fromfile(folder / 'body-1.bin', dtype=np.float32).reshape(-1, 3) * scale
bodymesh = bpy.data.meshes.new('thirteen actual visible body layers')
bodymesh.from_pydata(initial.tolist(), [], np.asarray(bodyfaces).tolist())
bodymesh.update()
body = bpy.data.objects.new('actual unchanged animated body', bodymesh)
bpy.context.collection.objects.link(body)
keyframe_collider_vertices(body, ((frame['frame'], np.fromfile(folder / f"body-{frame['frame']}.bin", dtype=np.float32) * scale) for frame in data['frames']))
body.modifiers.new('actual layer collision', 'COLLISION')
body.collision.thickness_outer = .05
body.collision.thickness_inner = .05
body.collision.cloth_friction = 8
floor_z = float(initial[:, 2].min())
bpy.ops.mesh.primitive_plane_add(size=10*scale, location=(0, 0, floor_z))
floor = bpy.context.object
floor.name = 'ground at actual soles'
floor.modifiers.new('ground collision', 'COLLISION')
floor.collision.thickness_outer = .001

simulation = cloth.modifiers.new('complete withdrawal authoring', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(points)
settings.tension_stiffness = 35 * scale
settings.tension_stiffness_max = settings.tension_stiffness
settings.compression_stiffness = 35 * scale
settings.compression_stiffness_max = settings.compression_stiffness
settings.shear_stiffness = 15 * scale
settings.shear_stiffness_max = settings.shear_stiffness
settings.bending_stiffness = .03
settings.bending_damping = .003
settings.air_damping = 2
settings.vertex_group_mass = pin.name
settings.pin_stiffness = 20
settings.use_sewing_springs = False
simulation.collision_settings.distance_min = .05
simulation.collision_settings.collision_quality = 5
simulation.collision_settings.use_self_collision = True
simulation.collision_settings.self_distance_min = .05
simulation.collision_settings.self_friction = 8
simulation.point_cache.frame_start = 1
simulation.point_cache.frame_end = scene.frame_end
scene.frame_set(1)
bpy.context.view_layer.update()
metadata = {'authoringScale': scale, 'bodyComparisonMetres': True, 'bodyMaximumScaledUlp': 2, 'bendingDamping': settings.bending_damping, 'vertices': len(points), 'faces': len(faces), 'stitches': len(stitches), 'cuffs': constraints, 'floorZ': floor_z,
            'bodyParts': [part['name'] for part in data['bodies']], 'frames': scene.frame_end, 'massTotal': settings.mass * len(points),
            'bodyThickness': body.collision.thickness_outer, 'clothDistance': simulation.collision_settings.distance_min,
            'selfDistance': simulation.collision_settings.self_distance_min, 'gravity': list(scene.gravity),
            'note': 'Offline authoring only; full original displayed triangles retained. Complete wrist rings drive the removal control; no production animation accepted.'}
(out / 'metadata.json').write_text(json.dumps(metadata, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'withdrawal.blend'))
started = time.perf_counter()
records = []
for frame in range(1, scene.frame_end + 1):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    owner = cloth.evaluated_get(graph)
    actual = owner.to_mesh()
    assert len(actual.vertices) == len(points)
    assert [int(id) for face in actual.polygons for id in face.vertices] == data['indices']
    coordinates = np.empty(len(points) * 3, dtype=np.float32)
    actual.vertices.foreach_get('co', coordinates)
    owner.to_mesh_clear()
    assert np.isfinite(coordinates).all()
    (coordinates / scale).tofile(out / f'cloth-{frame}.bin')
    owner = body.evaluated_get(graph)
    actual = owner.to_mesh()
    actual_body = np.empty(len(actual.vertices) * 3, dtype=np.float32)
    actual.vertices.foreach_get('co', actual_body)
    owner.to_mesh_clear()
    actual_body /= scale
    expected = np.fromfile(folder / f'body-{frame}.bin', dtype=np.float32)
    error = np.abs(actual_body - expected)
    scaled = float((error / np.spacing(np.abs(expected) + np.float32(1))).max())
    # The metre-space allowance includes the two float32 scale conversions.
    assert scaled <= 2, scaled
    actual_body.tofile(out / f'body-{frame}.bin')
    record = {'frame': frame, 'time': data['frames'][frame - 1]['time'], 'seconds': time.perf_counter() - started,
              'bodyDifference': float(error.max()), 'bodyScaledUlp': scaled,
              'lowest': float(coordinates.reshape(-1, 3)[:, 2].min()) / scale,
              'maximumDrift': float(np.linalg.norm(coordinates.reshape(-1, 3) - points, axis=1).max()) / scale}
    records.append(record)
    (out / 'progress.json').write_text(json.dumps(records))
    print(json.dumps(record), flush=True)
(out / 'summary.json').write_text(json.dumps(records, indent=2))
