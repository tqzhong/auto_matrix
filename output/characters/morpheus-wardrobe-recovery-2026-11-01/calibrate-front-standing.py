"""Bind the complete standing garment and verify its released free fall."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
import numpy as np

authoring = Path(__file__).resolve().parent
base = authoring / 'front-standing-work'
sys.path.insert(0, str(authoring))
from cage_garment import build

data = json.loads((base / 'current-input/manifest.json').read_text())
cage = json.loads((base / 'boundary-cage-fit-4.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 10
scene.gravity = (0, 0, -981)
points = np.asarray(data['points'])[:, [0, 2, 1]] * [40, -40, 40]
cloth, display, stitches = build(data, cage)
simulation = cloth.modifiers.new('standing calibrated garment', 'CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3 / len(cage['points'])
settings.air_damping = 2 * settings.mass / .3
settings.tension_stiffness = settings.tension_stiffness_max = 35
settings.compression_stiffness = settings.compression_stiffness_max = 35
settings.shear_stiffness = settings.shear_stiffness_max = 15
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
        (values / 100).astype('<f4').tofile(base / 'sewn-cage-bound-rest.bin')
    delta = (values.reshape(-1, 3) - points) / 100
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    assert frame == 1 or solved is not None
    rows.append(dict(frame=frame, time=(frame - 1) / 30, centreDropMetres=-float(delta[:, 2].mean()),
        maximumDriftMetres=float(np.linalg.norm(delta, axis=1).max()),
        maximumRelativeDriftMetres=float(np.linalg.norm(delta - delta.mean(axis=0), axis=1).max()),
        solverStatus=sorted(solved.status) if frame > 1 else []))
files = ['calibrate-front-standing.py', 'cage_garment.py', '../../../scripts/cloth_display.py', 'front-standing-work/boundary-cage-fit-4.json',
    'front-standing-work/current-input/manifest.json']
report = dict(stitches=len(stitches), vertices=len(points), faces=len(data['indices']) // 3,
    physicalVertices=len(cage['points']), nativeVersion=bpy.app.version_string, acceptedForProduction=False,
    sourceHashes={file:hashlib.sha256((authoring / file).read_bytes()).hexdigest() for file in files},
    restSurfaceSha256=hashlib.sha256((base / 'sewn-cage-bound-rest.bin').read_bytes()).hexdigest(),
    scope='Complete standing display binding and free fall without body, floor, collision or pins; does not accept a removal animation.', rows=rows)
(authoring / 'front-standing-native-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
assert rows[0]['maximumDriftMetres'] < .00001, 'The starting display binding exceeds the established precision.'
assert .2 < rows[-1]['centreDropMetres'] < .5, 'The released garment stays suspended.'
assert rows[-1]['maximumRelativeDriftMetres'] < .001, 'The released garment distorts in free fall.'
assert all(row['solverStatus'] == ['SUCCESS'] for row in rows[1:]), 'The full garment solve does not converge.'
