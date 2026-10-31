"""Retain the complete coat through the verified 0–0.8 s preparation prefix."""
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

folder, out = base / 'preparation-input', base / 'preparation-physics'
data = json.loads((folder / 'manifest.json').read_text())
cage = json.loads((base / 'front-standing-work/boundary-cage-fit-4.json').read_text())
controls = json.loads((base / 'boundary-controls.json').read_text())
assert len(data['frames']) == 49 and data['frames'][0]['time'] == 0 and data['frames'][-1]['time'] == .8
out.mkdir()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
scene.frame_start, scene.frame_end = 1, 49
scene.gravity = (0, 0, -981)
cloth, display, stitches = build(data, cage)
pin = cloth.vertex_groups.new(name='complete worn-coat boundaries')
pin.add(list(cage['mappedControls'].values()), 1, 'REPLACE')
conversion = Matrix(((40, 0, 0, 0), (0, 0, -40, 0), (0, 40, 0, 0), (0, 0, 0, 1)))
regions = [('collar', controls['neck'])] + [('cuff ' + cuff['side'], cuff['ring']) for cuff in controls['cuffs']]
assert len(set(controls['protected'])) == 189
for support, (name, source_ids) in enumerate(regions):
    group = cloth.vertex_groups.new(name=name)
    group.add([cage['mappedControls'][str(i)] for i in source_ids], 1, 'REPLACE')
    owner = bpy.data.objects.new('actual bone motion ' + name, None)
    bpy.context.collection.objects.link(owner)
    owner.rotation_mode = 'QUATERNION'
    for frame in data['frames']:
        transform = conversion @ Matrix(np.asarray(frame['supports'][support]).reshape(4, 4, order='F').tolist()) @ conversion.inverted()
        owner.location, owner.rotation_quaternion = transform.to_translation(), transform.to_quaternion()
        owner.keyframe_insert('location', frame=frame['frame'])
        owner.keyframe_insert('rotation_quaternion', frame=frame['frame'])
    for curve in owner.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    scene.frame_set(1)
    bpy.context.view_layer.update()
    hook = cloth.modifiers.new(name + ' follows its actual bone', 'HOOK')
    hook.object, hook.vertex_group = owner, group.name
    hook.matrix_inverse = owner.matrix_world.inverted() @ cloth.matrix_world
    hook.falloff_type = 'NONE'

faces, offset = [], 0
for part in data['bodies']:
    faces.extend((np.asarray(part['indices']).reshape(-1, 3) + offset).tolist())
    offset += part['count']
assert len(data['bodies']) == 13
initial = np.fromfile(folder / 'body-1.bin', dtype='<f4').reshape(-1, 3) * 100
mesh = bpy.data.meshes.new('all thirteen complete actual inner layers')
mesh.from_pydata(initial.tolist(), [], faces)
mesh.update()
body = bpy.data.objects.new('actual animated preparation body', mesh)
bpy.context.collection.objects.link(body)
cache = cache_collider_vertices(body, ((frame['frame'], np.fromfile(folder / f"body-{frame['frame']}.bin", dtype='<f4') * 100)
    for frame in data['frames']), out / 'actual-body.pc2')
body.modifiers.new('all actual layers collide', 'COLLISION')
body.collision.thickness_outer = body.collision.thickness_inner = .05
body.collision.cloth_friction = 8

simulation = cloth.modifiers.new('standing calibrated preparation', 'CLOTH')
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
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, 49
scene.frame_set(1)
source_files = ['bake-preparation.py', 'cage_garment.py', 'boundary-controls.json', 'front-standing-work/boundary-cage-fit-4.json',
    'preparation-input/manifest.json', '../../../scripts/cloth_collision.py', '../../../scripts/cloth_display.py']
(out / 'metadata.json').write_text(json.dumps(dict(frames=49, start=0, end=.8,
    displayVertices=len(data['points']), displayFaces=len(data['indices']) // 3, innerLayers=13,
    physicalVertices=len(cage['points']), physicalFaces=len(cage['indices']) // 3, fixedBoundaryPoints=189,
    sourceHashes={file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in source_files},
    acceptedForProduction=False, scope='Worn-coat preparation only. Collar and complete cuffs follow actual bones throughout this prefix; release, full removal and gameplay remain unaccepted.'), indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'preparation.blend'))
cache.filepath = bpy.path.relpath(cache.filepath)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'preparation.blend'))
rows, started = [], time.perf_counter()
for frame in data['frames']:
    scene.frame_set(frame['frame'])
    graph = bpy.context.evaluated_depsgraph_get()
    values = {}
    for name, obj, count, indices in [('cloth', display, len(data['points']), data['indices']),
        ('cage', cloth, len(cage['points']), cage['indices']), ('body', body, len(initial), None)]:
        owner = obj.evaluated_get(graph)
        actual = owner.to_mesh()
        assert len(actual.vertices) == count
        if indices is not None:
            assert [int(i) for face in actual.polygons for i in face.vertices] == indices
        if name == 'cage':
            weights = [next((group.weight for group in actual.vertices[i].groups if group.group == pin.index), 0)
                for i in cage['mappedControls'].values()]
            assert len(weights) == 189 and all(abs(weight - 1) < 1e-6 for weight in weights)
        coordinates = np.empty(count * 3, dtype=np.float32)
        actual.vertices.foreach_get('co', coordinates)
        owner.to_mesh_clear()
        assert np.isfinite(coordinates).all()
        if name == 'body':
            assert np.array_equal(coordinates, np.fromfile(folder / f"body-{frame['frame']}.bin", dtype='<f4') * 100)
        values[name] = coordinates.reshape(-1, 3) / 100
        values[name].astype('<f4').tofile(out / f"{name}-{frame['frame']}.bin")
    maximum_boundary_error = 0
    for support, (_, source_ids) in enumerate(regions):
        transform = conversion @ Matrix(np.asarray(frame['supports'][support]).reshape(4, 4, order='F').tolist()) @ conversion.inverted()
        original = np.asarray(data['points'])[source_ids][:, [0, 2, 1]] * [40, -40, 40]
        for source, point in zip(source_ids, original):
            expected = np.asarray(transform @ Vector(point)) / 100
            maximum_boundary_error = max(maximum_boundary_error, float(np.linalg.norm(values['cloth'][source] - expected)))
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    assert frame['frame'] == 1 or solved is not None
    row = dict(frame=frame['frame'], time=frame['time'], seconds=time.perf_counter() - started,
        solverStatus=sorted(solved.status) if solved else [], boundaryErrorMetres=maximum_boundary_error)
    rows.append(row)
    temporary = out / 'summary.json.tmp'
    temporary.write_text(json.dumps(rows, indent=2))
    temporary.replace(out / 'summary.json')
    print(json.dumps(row), flush=True)
assert max(row['boundaryErrorMetres'] for row in rows) < .0001
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'Some preparation cloth steps did not converge.'
