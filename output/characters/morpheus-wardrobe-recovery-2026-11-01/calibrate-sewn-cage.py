"""Require the actual complete garment to fall and retain its rest shape."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
import numpy as np

base = Path(__file__).resolve().parent
data = json.loads((base / 'current-input/manifest.json').read_text())
normalized = '--normalized-drag' in sys.argv
working = '--working-material' in sys.argv
full = '--full-mesh' in sys.argv
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 10
scene.gravity = (0, 0, -981)
points = np.asarray(data['points'])[:, [0, 2, 1]] * [40, -40, 40]
sys.path.insert(0, str(base))
from cage_garment import build
cage_data = data if full else json.loads((base / 'boundary-cage-fit-4.json').read_text())
cage_points = np.asarray(cage_data['points'])
cloth, display, stitches = build(data, cage_data)
if full:
    display = cloth
    assert len(stitches) == 648, 'The full-density control must retain the original seam connections.'
simulation = cloth.modifiers.new('current garment material', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(cage_points)
settings.air_damping = 2 * settings.mass / .3 if normalized else 2
settings.tension_stiffness = settings.tension_stiffness_max = 35 if working else 3500
settings.compression_stiffness = settings.compression_stiffness_max = 35 if working else 3500
settings.shear_stiffness = settings.shear_stiffness_max = 15 if working else 1500
settings.bending_stiffness = .03
settings.bending_damping = .003
simulation.collision_settings.use_collision = False
simulation.collision_settings.use_self_collision = False
simulation.point_cache.frame_start, simulation.point_cache.frame_end = 1, 10
rows = []
for frame in range(1, 11):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    owner = display.evaluated_get(graph)
    actual = owner.to_mesh()
    assert len(actual.vertices) == len(points)
    assert [int(i) for face in actual.polygons for i in face.vertices] == data['indices']
    values = np.empty(points.size, dtype=np.float32)
    actual.vertices.foreach_get('co', values)
    owner.to_mesh_clear()
    if frame == 1:
        prefix = 'full-sewn' if full else 'sewn-cage'
        (values / 100).astype('<f4').tofile(base / f'{prefix}-bound-rest.bin')
    delta = (values.reshape(-1, 3) - points) / 100
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    assert frame == 1 or solved is not None
    row = dict(frame=frame, time=(frame - 1) / 30, centreDropMetres=-float(delta[:, 2].mean()),
        maximumDriftMetres=float(np.linalg.norm(delta, axis=1).max()),
        maximumRelativeDriftMetres=float(np.linalg.norm(delta - delta.mean(axis=0), axis=1).max()),
        solverStatus=sorted(solved.status) if frame > 1 else [],
        maximumSolverIterations=solved.max_iterations if frame > 1 else 0)
    rows.append(row)
label = 'normalized-material' if working else 'normalized' if normalized else 'original'
report = dict(stitches=len(stitches), vertices=len(points), faces=len(data['indices']) // 3, physicalVertices=len(cage_points), massTotal=settings.mass * len(cage_points),
    nativeVersion=bpy.app.version_string, acceptedForProduction=False,
    scope='Free fall without body, floor, collision or pins; does not accept a removal animation.',
    sourceHashes={name:hashlib.sha256((base / name).read_bytes()).hexdigest() for name in
        ['calibrate-sewn-cage.py', 'cage_garment.py', 'boundary-cage-fit-4.json', 'current-input/manifest.json']},
    restSurfaceSha256=hashlib.sha256((base / f'{prefix}-bound-rest.bin').read_bytes()).hexdigest(),
    airDamping=settings.air_damping, tension=settings.tension_stiffness, rows=rows)
prefix = 'full-sewn' if full else 'sewn-cage'
(base / f'{prefix}-fall-{label}.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
assert rows[0]['maximumDriftMetres'] < .00001, 'The starting surface exceeds the established display-binding precision.'
assert .2 < rows[-1]['centreDropMetres'] < .5, 'The released garment stays suspended.'
assert rows[-1]['maximumRelativeDriftMetres'] < .001, 'The released garment distorts in free fall.'
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'The full garment solve does not converge.'
