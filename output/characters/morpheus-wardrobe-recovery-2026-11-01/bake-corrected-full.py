"""Full-duration native guide candidate; rejected clock/solver gates stay rejected."""
from pathlib import Path
import hashlib
import json
import math
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base))
sys.path.insert(0, str(base.parents[2] / 'scripts'))
from full_garment import build
from cloth_collision import cache_collider_vertices

data = json.loads((base / 'corrected-body-input/manifest.json').read_text())
cuffs = json.loads((base / 'corrected-cuff-input.json').read_text())
controls = json.loads((base / 'boundary-controls.json').read_text())
clock = json.loads((base / 'native-clock-damped-scaled.json').read_text())
assert len(data['frames']) == cuffs['frameCount'] == len(cuffs['frames']) == 587
assert data['frames'][0]['time'] == 0 and data['frames'][-1]['time'] == 8
assert len(data['points']) == 13960 and len(data['indices']) // 3 == 26916
assert len(data['bodies']) == 13
for record, support in zip(data['frames'], cuffs['frames']):
    assert record['frame'] == support['frame'] and record['time'] == support['time']
for file, sha in {**data['sourceHashes'], **cuffs['sourceHashes'], **clock['sourceHashes']}.items():
    assert hashlib.sha256((base / file).read_bytes()).hexdigest() == sha, file
assert all(row['solverStatus'] == ['SUCCESS'] for row in clock['rows'][1:])
clock_precision_passed = clock['maximumClockDropErrorMetres'] < .0001
assert clock_precision_passed or '--diagnostic' in sys.argv, 'Do not accept the rejected native clock as a production input.'
out = base / 'corrected-full-physics'
out.mkdir()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
scene.frame_start, scene.frame_end = 1, len(data['frames'])
scene.gravity = (0, 0, -981)
cloth, stitches = build(data)
pin = cloth.vertex_groups.new(name='complete original boundaries before release')
pin.add(controls['protected'], 1, 'REPLACE')
conversion = Matrix(((40, 0, 0, 0), (0, 0, -40, 0), (0, 40, 0, 0), (0, 0, 0, 1)))
regions = [('collar', controls['neck'], .8)] + [('cuff ' + cuff['side'], cuff['ring'], 1.7) for cuff in controls['cuffs']]
for region, source_ids, release_time in regions:
    group = cloth.vertex_groups.new(name=region)
    group.add(source_ids, 1, 'REPLACE')
    owner = bpy.data.objects.new('standing-reference support ' + region, None)
    scene.collection.objects.link(owner)
    owner.rotation_mode = 'QUATERNION'
    for frame, support in zip(data['frames'], cuffs['frames']):
        source = Matrix.Identity(4) if region == 'collar' else Matrix(np.asarray(next(row['matrix'] for row in support['cuffs'] if region.endswith(row['side']))).reshape(4, 4, order='F').tolist())
        transform = conversion @ source @ conversion.inverted()
        owner.location, owner.rotation_quaternion = transform.to_translation(), transform.to_quaternion()
        owner.keyframe_insert('location', frame=frame['frame'])
        owner.keyframe_insert('rotation_quaternion', frame=frame['frame'])
    for curve in owner.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    scene.frame_set(1)
    bpy.context.view_layer.update()
    hook = cloth.modifiers.new(region + ' follows the checked reference', 'HOOK')
    hook.object, hook.vertex_group = owner, group.name
    hook.matrix_inverse = owner.matrix_world.inverted() @ cloth.matrix_world
    hook.falloff_type = 'NONE'
    release = cloth.modifiers.new(region + ' releases at its actual timestamp', 'VERTEX_WEIGHT_MIX')
    release.vertex_group_a, release.vertex_group_b = pin.name, group.name
    release.default_weight_a = release.default_weight_b = 0
    release.mix_mode, release.mix_set = 'SUB', 'A'
    first_free = next(frame['frame'] for frame in data['frames'] if frame['time'] > release_time + 1e-12)
    for frame, value in [(1, 0), (first_free - 1, 0), (first_free, 1)]:
        release.mask_constant = value
        release.keyframe_insert('mask_constant', frame=frame)

faces, offset = [], 0
for part in data['bodies']:
    faces.extend((np.asarray(part['indices']).reshape(-1, 3) + offset).tolist())
    offset += part['count']
assert offset == 51490
folder = base / 'corrected-body-input'
initial = np.fromfile(folder / 'body-1.bin', dtype='<f4').reshape(-1, 3) * 100
mesh = bpy.data.meshes.new('all thirteen complete corrected inner layers')
mesh.from_pydata(initial.tolist(), [], faces)
mesh.update()
body = bpy.data.objects.new('actual corrected body at every adaptive key', mesh)
scene.collection.objects.link(body)
cache = cache_collider_vertices(body, ((frame['frame'], np.fromfile(folder / f"body-{frame['frame']}.bin", dtype='<f4') * 100)
    for frame in data['frames']), out / 'actual-body.pc2')
body.modifiers.new('all thirteen layers collide', 'COLLISION')
body.collision.thickness_outer = body.collision.thickness_inner = .05
body.collision.cloth_friction = 8
floor_z = float(initial[:, 2].min())
bpy.ops.mesh.primitive_plane_add(size=1000, location=(0, 0, floor_z))
floor = bpy.context.object
floor.modifiers.new('actual ground', 'COLLISION')
floor.collision.thickness_outer = .001

simulation = cloth.modifiers.new('complete corrected-path garment', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(data['points'])
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
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, len(data['frames'])
for frame in data['frames']:
    # Fixed 4.5.3 cloth gravity is scaled by .001 in SIM_mass_spring.cc.
    settings.time_scale = 1 if frame['frame'] == 1 else frame['deltaSeconds'] * math.sqrt(1000)
    settings.keyframe_insert('time_scale', frame=frame['frame'])
for curve in cloth.animation_data.action.fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'CONSTANT'
scene.frame_set(1)
source_files = ['bake-corrected-full.py', 'full_garment.py', 'boundary-controls.json', 'corrected-body-input/manifest.json',
    'corrected-cuff-input.json', 'native-clock-damped-scaled.json', '../../../scripts/cloth_collision.py']
metadata = dict(frames=len(data['frames']), startSeconds=0, endSeconds=8, irregularTimestamps=True,
    physicalVertices=len(data['points']), physicalFaces=len(data['indices']) // 3, displayVertices=len(data['points']), displayFaces=len(data['indices']) // 3,
    directFullDensity=True, innerLayers=13, boundaryControls=189, cuffReleaseAfterSeconds=1.7, collarReleaseAfterSeconds=.8,
    nativeTimeFactor=math.sqrt(1000), clockPrecisionPassed=clock_precision_passed, isolatedClockMaximumErrorMetres=clock['maximumClockDropErrorMetres'],
    floorZ=floor_z / 100, actualHandPinchProven=False, acceptedForProduction=False,
    sourceHashes={file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in source_files},
    scope='Full-duration diagnostic guide candidate. Clock precision, solver convergence, complete contact, actual grip/release, appearance and gameplay remain separate unmet gates.')
(out / 'metadata.json').write_text(json.dumps(metadata, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'corrected-full.blend'))
cache.filepath = bpy.path.relpath(cache.filepath)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'corrected-full.blend'))
rows, started = [], time.perf_counter()
for frame in data['frames']:
    scene.frame_set(frame['frame'])
    graph = bpy.context.evaluated_depsgraph_get()
    values = {}
    for name, obj, count in [('cloth', cloth, len(data['points'])), ('body', body, len(initial))]:
        owner = obj.evaluated_get(graph)
        actual = owner.to_mesh()
        assert len(actual.vertices) == count
        if name == 'cloth':
            assert [int(i) for face in actual.polygons for i in face.vertices] == data['indices']
            weights = {}
            for region, ids, release_time in regions:
                actual_weights = [next((item.weight for item in actual.vertices[i].groups if item.group == pin.index), 0) for i in ids]
                expected = int(frame['time'] <= release_time + 1e-12)
                assert all(abs(value - expected) < 1e-6 for value in actual_weights), (frame['frame'], region, actual_weights)
                weights[region] = [min(actual_weights), max(actual_weights)]
        coordinates = np.empty(count * 3, dtype=np.float32)
        actual.vertices.foreach_get('co', coordinates)
        owner.to_mesh_clear()
        assert np.isfinite(coordinates).all()
        if name == 'body':
            assert np.array_equal(coordinates, np.fromfile(folder / f"body-{frame['frame']}.bin", dtype='<f4') * 100)
        values[name] = coordinates.reshape(-1, 3) / 100
        values[name].astype('<f4').tofile(out / f"{name}-{frame['frame']}.bin")
    solver = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    row = dict(frame=frame['frame'], time=frame['time'], deltaSeconds=frame['deltaSeconds'], seconds=time.perf_counter() - started,
        solverStatus=sorted(solver.status) if frame['frame'] > 1 else [], maximumSolverIterations=solver.max_iterations if frame['frame'] > 1 else 0,
        pinWeights=weights, lowestMetres=float(values['cloth'][:, 2].min()), highestMetres=float(values['cloth'][:, 2].max()))
    rows.append(row)
    temporary = out / 'summary.json.tmp'
    temporary.write_text(json.dumps(rows, indent=2)); temporary.replace(out / 'summary.json')
    print(json.dumps(row), flush=True)
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'Some native garment steps did not converge.'
assert clock_precision_passed, 'The isolated native clock precision gate remains rejected.'
