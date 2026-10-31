"""Bake the calibrated sewn cage and retain every displayed coat triangle."""
from pathlib import Path
import hashlib
import json
import sys
import time
import bpy
import numpy as np
from mathutils import Matrix, Vector

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base))
sys.path.insert(0, str(base.parents[2] / 'scripts'))
from cage_garment import build
from cloth_collision import cache_collider_vertices

full = '--full-removal' in sys.argv
shoulder_release = '--shoulder-release' in sys.argv
assert not shoulder_release or full
folder = base / ('shoulder-release-input' if shoulder_release else 'full-removal-input' if full else 'current-input')
data = json.loads((folder / 'manifest.json').read_text())
cage = json.loads((base / 'boundary-cage-fit-4.json').read_text())
controls = json.loads((base / 'boundary-controls.json').read_text())
out = base / ('shoulder-release-physics' if shoulder_release else 'full-removal-physics' if full else 'sewn-cage-verified-physics')
out.mkdir(exist_ok=True)
scale = 100
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, len(data['frames']) if full else 25
scene.gravity = (0, 0, -9.81 * scale)
cloth, display, stitches = build(data, cage)
pin = cloth.vertex_groups.new(name='validated complete cuff constraints')
C = Matrix(((40, 0, 0, 0), (0, 0, -40, 0), (0, 40, 0, 0), (0, 0, 0, 1)))
for cuff in controls['cuffs']:
    ring = [cage['mappedControls'][str(i)] for i in cuff['ring']]
    assert len(ring) == 61
    pin.add(ring, 1, 'REPLACE')
    group = cloth.vertex_groups.new(name='complete cuff ' + cuff['side'])
    group.add(ring, 1, 'REPLACE')
    owner = bpy.data.objects.new('validated cuff path ' + cuff['side'], None)
    bpy.context.collection.objects.link(owner)
    owner.rotation_mode = 'QUATERNION'
    for frame in data['frames']:
        source = next(value for value in frame['cuffs'] if value['side'] == cuff['side'])
        matrix = C @ Matrix(np.asarray(source['matrix']).reshape(4, 4, order='F').tolist()) @ C.inverted()
        owner.location, owner.rotation_quaternion = matrix.to_translation(), matrix.to_quaternion()
        owner.keyframe_insert('location', frame=frame['frame'])
        owner.keyframe_insert('rotation_quaternion', frame=frame['frame'])
    for curve in owner.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    scene.frame_set(1)
    bpy.context.view_layer.update()
    hook = cloth.modifiers.new('complete cuff ' + cuff['side'], 'HOOK')
    hook.object, hook.vertex_group = owner, group.name
    hook.matrix_inverse = owner.matrix_world.inverted() @ cloth.matrix_world
    hook.falloff_type = 'NONE'

all_cuffs = [cage['mappedControls'][str(vertex)] for cuff in controls['cuffs'] for vertex in cuff['ring']]
release_frame = 29 if full else None
if release_frame:
    released = cloth.vertex_groups.new(name='cuffs after measured hand passage')
    released.add(all_cuffs, 1, 'REPLACE')
    release = cloth.modifiers.new('release complete cuffs after 1.7 seconds', 'VERTEX_WEIGHT_MIX')
    release.vertex_group_a, release.vertex_group_b = pin.name, released.name
    release.default_weight_a = release.default_weight_b = 0
    release.mix_mode, release.mix_set = 'SUB', 'A'
    for frame, weight in [(1, 0), (release_frame - 1, 0), (release_frame, 1)]:
        release.mask_constant = weight
        release.keyframe_insert('mask_constant', frame=frame)
    for curve in cloth.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'

faces, offset = [], 0
for part in data['bodies']:
    faces.extend((np.asarray(part['indices']).reshape(-1, 3) + offset).tolist())
    offset += part['count']
initial = np.fromfile(folder / 'body-1.bin', dtype='<f4').reshape(-1, 3) * scale
mesh = bpy.data.meshes.new('all thirteen actual inner layers')
mesh.from_pydata(initial.tolist(), [], faces)
mesh.update()
body = bpy.data.objects.new('actual unchanged animated body', mesh)
bpy.context.collection.objects.link(body)
cache = cache_collider_vertices(body, ((frame['frame'], np.fromfile(folder / f"body-{frame['frame']}.bin", dtype='<f4') * scale)
    for frame in data['frames']), out / 'actual-body.pc2')
body.modifiers.new('all actual layers collide', 'COLLISION')
body.collision.thickness_outer = body.collision.thickness_inner = .05
body.collision.cloth_friction = 8
floor_z = float(initial[:, 2].min())
bpy.ops.mesh.primitive_plane_add(size=1000, location=(0, 0, floor_z))
floor = bpy.context.object
floor.modifiers.new('actual ground', 'COLLISION')
floor.collision.thickness_outer = .001

simulation = cloth.modifiers.new('calibrated sewn garment', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(cage['points'])
settings.air_damping = 2 * settings.mass / .3
settings.tension_stiffness = settings.tension_stiffness_max = 35
settings.compression_stiffness = settings.compression_stiffness_max = 35
settings.shear_stiffness = settings.shear_stiffness_max = 15
settings.bending_stiffness, settings.bending_damping = .03, .003
settings.vertex_group_mass, settings.pin_stiffness = pin.name, 20
settings.use_sewing_springs = False
simulation.collision_settings.distance_min = .05
simulation.collision_settings.collision_quality = 5
simulation.collision_settings.use_self_collision = True
simulation.collision_settings.self_distance_min = .05
simulation.collision_settings.self_friction = 8
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, scene.frame_end
scene.frame_set(1)
bpy.context.view_layer.update()
metadata = dict(displayVertices=len(data['points']), displayFaces=len(data['indices']) // 3,
    physicalVertices=len(cage['points']), physicalFaces=len(cage['indices']) // 3, stitches=len(stitches),
    massTotal=settings.mass * len(cage['points']), airDamping=settings.air_damping, tension=settings.tension_stiffness,
    frames=scene.frame_end, cuffReleaseFrame=release_frame, bodyParts=[part['name'] for part in data['bodies']], floorZ=floor_z / scale,
    sourceHashes={name:hashlib.sha256((base / name).read_bytes()).hexdigest()
        for name in ['bake-sewn-cage.py', 'cage_garment.py', 'boundary-cage-fit-4.json', 'boundary-controls.json', f'{folder.name}/manifest.json']},
    acceptedForProduction=False, scope='Body/cuff authoring only; complete displayed-garment contact and actual gameplay remain separate gates.')
(out / 'metadata.json').write_text(json.dumps(metadata, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'withdrawal.blend'))
cache.filepath = bpy.path.relpath(cache.filepath)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'withdrawal.blend'))
rows, started = [], time.perf_counter()
for frame in range(1, scene.frame_end + 1):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    values = {}
    for name, obj, count, expected_faces in [
        ('cloth', display, len(data['points']), data['indices']),
        ('cage', cloth, len(cage['points']), cage['indices']),
        ('body', body, len(initial), None)]:
        owner = obj.evaluated_get(graph)
        actual = owner.to_mesh()
        assert len(actual.vertices) == count
        if expected_faces is not None:
            assert [int(i) for face in actual.polygons for i in face.vertices] == expected_faces
        if name == 'cage':
            weights = [next((group.weight for group in actual.vertices[i].groups if group.group == pin.index), 0) for i in all_cuffs]
            pin_weights = [min(weights), max(weights)]
            expected_weight = 0 if release_frame and frame >= release_frame else 1
            assert all(abs(weight - expected_weight) < 1e-6 for weight in weights), (frame, pin_weights)
        coordinates = np.empty(count * 3, dtype=np.float32)
        actual.vertices.foreach_get('co', coordinates)
        owner.to_mesh_clear()
        assert np.isfinite(coordinates).all()
        values[name] = coordinates / scale
        values[name].tofile(out / f'{name}-{frame}.bin')
        if name == 'body':
            assert np.array_equal(coordinates, np.fromfile(folder / f'body-{frame}.bin', dtype='<f4') * scale)
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    assert frame == 1 or solved is not None
    cuff_error = 0
    for cuff in controls['cuffs']:
        path = next(value for value in data['frames'][frame - 1]['cuffs'] if value['side'] == cuff['side'])
        transform = C @ Matrix(np.asarray(path['matrix']).reshape(4, 4, order='F').tolist()) @ C.inverted()
        initial_cuff = np.asarray(data['points'])[cuff['ring']][:, [0, 2, 1]] * [40, -40, 40]
        for source, point in zip(cuff['ring'], initial_cuff):
            expected = np.asarray(transform @ Vector(point)) / scale
            actual = values['cloth'].reshape(-1, 3)[source]
            cuff_error = max(cuff_error, float(np.linalg.norm(actual - expected)))
    row = dict(frame=frame, time=data['frames'][frame - 1]['time'], seconds=time.perf_counter() - started,
        solverStatus=sorted(solved.status) if frame > 1 else [],
        maximumSolverIterations=solved.max_iterations if frame > 1 else 0,
        cuffErrorMetres=cuff_error if not release_frame or frame < release_frame else None,
        freedCuffMotionMetres=cuff_error if release_frame and frame >= release_frame else 0,
        pinWeights={'cuffs': pin_weights}, lowest=float(values['cloth'].reshape(-1, 3)[:, 2].min()),
        highest=float(values['cloth'].reshape(-1, 3)[:, 2].max()))
    rows.append(row)
    (out / 'summary.json').write_text(json.dumps(rows, indent=2))
    print(json.dumps(row), flush=True)
assert max(row['cuffErrorMetres'] for row in rows if row['cuffErrorMetres'] is not None) < .0001, 'The displayed cuff left its authored path before release.'
if release_frame:
    assert max(row['freedCuffMotionMetres'] for row in rows) > .001, 'The released display still follows the imposed cuff path.'
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'Some dynamic cloth steps did not converge.'
