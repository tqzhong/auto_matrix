"""A complete unpinned garment must fall, not remain suspended by per-vertex drag."""
import bpy
import json
import sys
from pathlib import Path
import numpy as np

base = Path(__file__).parent
data = json.loads((base.parent / 'morpheus-withdrawal-path-2026-10-20/clearance-input/manifest.json').read_text())
normalized = '--mass-normalized' in sys.argv
reference_mass = '--reference-mass' in sys.argv
no_springs = '--no-springs' in sys.argv
fine_steps = '--fine-steps' in sys.argv
use_cage = '--cage' in sys.argv
working_material = '--working-material' in sys.argv
fitted_cage = '--fitted-cage' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 10
scene.gravity = (0, 0, -981)
points = np.asarray(data['points'])[:, [0,2,1]] * [40,-40,40]
mesh = bpy.data.meshes.new('complete delivered coat')
mesh.from_pydata(points.tolist(), [], np.asarray(data['indices']).reshape(-1,3).tolist())
mesh.update()
cloth = bpy.data.objects.new('free-fall control', mesh)
bpy.context.collection.objects.link(cloth)
display = cloth
physical_count = len(points)
if use_cage:
    sys.path.insert(0, str(base.parents[2] / 'scripts'))
    from cloth_display import bind_display_to_cage
    cage = bpy.data.objects.new('physical garment cage', mesh.copy())
    bpy.context.collection.objects.link(cage)
    bpy.context.view_layer.objects.active = cage
    if fitted_cage:
        fitted = json.loads((base/'cage-fit-4.json').read_text())
        cage.data.clear_geometry()
        cage.data.from_pydata((np.asarray(fitted['points'])[:,[0,2,1]]*[40,-40,40]).tolist(),[],
                              np.asarray(fitted['indices']).reshape(-1,3).tolist())
        cage.data.update()
    else:
        decimate = cage.modifiers.new('coarse physical surface', 'DECIMATE')
        decimate.ratio = .15
        assert bpy.ops.object.modifier_apply(modifier=decimate.name) == {'FINISHED'}
    bind_display_to_cage(display, cage)
    cloth = cage
    physical_count = len(cage.data.vertices)
simulation = cloth.modifiers.new('same garment material', 'CLOTH')
settings = simulation.settings
settings.quality = 100 if fine_steps else 20
settings.mass = .3 if reference_mass else 3 / physical_count
settings.tension_stiffness = settings.tension_stiffness_max = 3500
settings.compression_stiffness = settings.compression_stiffness_max = 3500
settings.shear_stiffness = settings.shear_stiffness_max = 1500
settings.bending_stiffness = .03
settings.bending_damping = .003
settings.air_damping = 2 * settings.mass / .3 if normalized else 2
if working_material:
    settings.tension_stiffness = settings.tension_stiffness_max = 35
    settings.compression_stiffness = settings.compression_stiffness_max = 35
    settings.shear_stiffness = settings.shear_stiffness_max = 15
if no_springs:
    for name in ['tension_stiffness', 'tension_stiffness_max', 'compression_stiffness', 'compression_stiffness_max',
                 'shear_stiffness', 'shear_stiffness_max', 'bending_stiffness', 'bending_stiffness_max',
                 'tension_damping', 'compression_damping', 'shear_damping', 'bending_damping']:
        setattr(settings, name, 0)
simulation.collision_settings.use_collision = False
simulation.collision_settings.use_self_collision = False
simulation.point_cache.frame_start = 1
simulation.point_cache.frame_end = 10
rows = []
for frame in range(1,11):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    owner = display.evaluated_get(graph)
    actual = owner.to_mesh()
    assert len(actual.vertices) == len(points)
    assert [int(i) for face in actual.polygons for i in face.vertices] == data['indices']
    coordinates = np.empty(len(points)*3, dtype=np.float32)
    actual.vertices.foreach_get('co', coordinates)
    owner.to_mesh_clear()
    delta = (coordinates.reshape(-1,3) - points) / 100
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    assert frame == 1 or solved is not None, 'simulated frame has no solver diagnostics'
    rows.append({'frame':frame, 'time':(frame-1)/30, 'centreDropMetres':-float(delta[:,2].mean()),
                 'maximumRelativeDriftMetres':float(np.linalg.norm(delta-delta.mean(axis=0),axis=1).max()),
                 'solverStatus':sorted(solved.status) if frame > 1 else [], 'maximumSolverError':solved.max_error if frame > 1 else 0,
                 'maximumSolverIterations':solved.max_iterations if frame > 1 else 0})
result = {'massTotal':settings.mass*physical_count, 'airDamping':settings.air_damping, 'quality':settings.quality,
          'physicalVertices':physical_count, 'vertices':len(points), 'faces':len(data['indices'])//3, 'rows':rows}
label = 'no-springs' if no_springs else 'reference-mass' if reference_mass else 'normalized' if normalized else 'original'
if fine_steps:
    label += '-fine'
if use_cage:
    label += '-cage'
if working_material:
    label += '-material'
if fitted_cage:
    label += '-fitted'
(base / f'free-fall-{label}.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
assert .2 < rows[-1]['centreDropMetres'] < .5, 'unpinned coat remains almost suspended instead of falling under gravity'
assert rows[-1]['maximumRelativeDriftMetres'] < .001, 'free fall distorts an unconstrained garment'
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'some simulation steps did not converge'
