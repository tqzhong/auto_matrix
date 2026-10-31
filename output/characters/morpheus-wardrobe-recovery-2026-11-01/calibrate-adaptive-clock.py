"""Check native cloth time against real seconds before using adaptive body keys."""
from pathlib import Path
import hashlib
import json
import sys

import bpy
import numpy as np

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base))
from full_garment import build

unscaled = '--unscaled-control' in sys.argv
data = json.loads((base / 'front-standing-work/current-input/manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
scene.gravity = (0, 0, -981)
# Three unequal intervals cover the same 1/30 s, including the shortest body key.
intervals = [value / 480 for _ in range(9) for value in (8, 1, 7)]
times = np.r_[0., np.cumsum(intervals)]
scene.frame_start, scene.frame_end = 1, len(times)
cloth, stitches = build(data)
simulation = cloth.modifiers.new('actual garment adaptive-time free fall', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(data['points'])
settings.air_damping = 0
settings.tension_stiffness = settings.compression_stiffness = 35
settings.shear_stiffness = 15
settings.bending_stiffness, settings.bending_damping = .03, .003
simulation.collision_settings.use_collision = False
simulation.collision_settings.use_self_collision = False
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, len(times)
for index, time in enumerate(times):
    settings.time_scale = 1 if unscaled or index == 0 else float(intervals[index - 1] * 60)
    settings.keyframe_insert('time_scale', frame=index + 1)
for curve in cloth.animation_data.action.fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'CONSTANT'
rows = []
for index, time in enumerate(times):
    scene.frame_set(index + 1)
    graph = bpy.context.evaluated_depsgraph_get()
    owner = cloth.evaluated_get(graph)
    mesh = owner.to_mesh()
    assert len(mesh.vertices) == len(data['points'])
    assert [int(i) for face in mesh.polygons for i in face.vertices] == data['indices']
    values = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', values)
    owner.to_mesh_clear()
    values = values.reshape(-1, 3) / 100
    assert np.isfinite(values).all()
    if index == 0:
        initial = values.copy()
    delta = values - initial
    solver = owner.modifiers[simulation.name].solver_result
    rows.append(dict(frame=index + 1, realTime=float(time), nativeTimeScale=float(owner.modifiers[simulation.name].settings.time_scale),
        expectedDropMetres=float(9.81 * time * time / 2), dropMetres=-float(delta[:, 2].mean()),
        maximumRelativeDriftMetres=float(np.linalg.norm(delta - delta.mean(axis=0), axis=1).max()),
        solverStatus=sorted(solver.status) if index else []))
files = ['calibrate-adaptive-clock.py', 'full_garment.py', 'front-standing-work/current-input/manifest.json']
report = dict(mode='unscaled-control' if unscaled else 'scaled', nativeVersion=bpy.app.version_string,
    vertices=len(data['points']), faces=len(data['indices']) // 3, frames=len(times), realEndSeconds=float(times[-1]),
    nominalEndSeconds=(len(times) - 1) / 60, minimumDeltaSeconds=min(intervals),
    sourceHashes={file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in files},
    acceptedForProduction=False, scope='Released complete garment, no pins, air drag or collisions. This checks physical clock mapping only.', rows=rows)
path = base / ('adaptive-clock-unscaled-control.json' if unscaled else 'adaptive-clock-scaled.json')
path.write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'The time control does not converge.'
assert max(row['maximumRelativeDriftMetres'] for row in rows) < .0001, 'Free fall deforms the complete garment.'
assert max(abs(row['dropMetres'] - row['expectedDropMetres']) for row in rows) < .003, 'Native time differs from real adaptive-key seconds.'
