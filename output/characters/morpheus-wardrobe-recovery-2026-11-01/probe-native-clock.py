"""Isolate time mapping from the rejected full-density garment's conditioning."""
from pathlib import Path
import hashlib
import json
import math
import sys

import bpy
import numpy as np

base = Path(__file__).resolve().parent
manifest = base / 'corrected-body-input/manifest.json'
data = json.loads(manifest.read_text())
unscaled = '--unscaled-control' in sys.argv
damped = '--damped' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
scene.gravity = (0, 0, -981)
scene.frame_start, scene.frame_end = 1, len(data['frames'])
mesh = bpy.data.meshes.new('clock-isolation sheet')
mesh.from_pydata([(-10, -10, 0), (10, -10, 0), (10, 10, 0), (-10, 10, 0)], [], [(0, 1, 2), (0, 2, 3)])
mesh.update()
cloth = bpy.data.objects.new('clock-isolation sheet', mesh)
scene.collection.objects.link(cloth)
simulation = cloth.modifiers.new('clock-isolation free fall', 'CLOTH')
settings = simulation.settings
settings.quality, settings.mass = 20, .03 if damped else .3
# Native drag is Cvi * .01 per vertex; map a known 20/s linear damping rate.
settings.air_damping = 20 * settings.mass / (.01 * math.sqrt(1000)) if damped else 0
simulation.collision_settings.use_collision = simulation.collision_settings.use_self_collision = False
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, len(data['frames'])
for frame in data['frames']:
    # Blender 4.5.3 scales cloth gravity by .001 and uses frame units, not FPS.
    # Map real seconds to that native clock instead of multiplying by render FPS.
    settings.time_scale = 1 if unscaled or frame['frame'] == 1 else frame['deltaSeconds'] * math.sqrt(1000)
    settings.keyframe_insert('time_scale', frame=frame['frame'])
for curve in cloth.animation_data.action.fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'CONSTANT'
rows, expected_velocity, expected_position = [], 0., 0.
for frame in data['frames']:
    scene.frame_set(frame['frame'])
    owner = cloth.evaluated_get(bpy.context.evaluated_depsgraph_get())
    actual = owner.to_mesh()
    points = np.asarray([v.co[:] for v in actual.vertices]) / 100
    owner.to_mesh_clear()
    assert len(points) == 4 and np.isfinite(points).all()
    solver = owner.modifiers[simulation.name].solver_result
    step = frame['deltaSeconds'] / settings.quality
    for _ in range(settings.quality):
        expected_velocity = (expected_velocity - 9.81 * step) / (1 + (20 if damped else 0) * step)
        expected_position += expected_velocity * step
    expected = -expected_position
    rows.append(dict(frame=frame['frame'], realTime=frame['time'],
        nativeTimeScale=float(owner.modifiers[simulation.name].settings.time_scale),
        gravityMetresPerSecondSquared=-9.81,
        dropMetres=-float(points[:, 2].mean()), expectedImplicitEulerDropMetres=expected,
        solverStatus=sorted(solver.status) if frame['frame'] > 1 else []))
report = dict(mode='unscaled-control' if unscaled else 'scaled', linearDampingPerSecond=20 if damped else 0, nativeVersion=bpy.app.version_string,
    frames=len(rows), realEndSeconds=rows[-1]['realTime'], nominalEndSeconds=(len(rows) - 1) / 60,
    maximumClockDropErrorMetres=max(abs(row['dropMetres'] - row['expectedImplicitEulerDropMetres']) for row in rows),
    sourceHashes={name:hashlib.sha256((base / name).read_bytes()).hexdigest()
        for name in ['probe-native-clock.py', 'corrected-body-input/manifest.json']},
    acceptedForProduction=False, scope='Four-vertex constant-gravity clock isolation using every actual adaptive body timestamp. Damped mode has a known 20/s linear drag and retains garment-scale coordinates for eight seconds. It does not accept garment dynamics.', rows=rows)
label = 'native-clock-' + ('damped-' if damped else '') + ('unscaled-control' if unscaled else 'scaled')
(base / (label + '.json')).write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}), flush=True)
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'Clock-isolation sheet solve failed.'
assert report['maximumClockDropErrorMetres'] < (.0001 if damped else .01), 'Native time differs from the actual adaptive schedule.'
