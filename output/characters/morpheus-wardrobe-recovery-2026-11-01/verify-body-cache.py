"""Reopen the actual authoring file and verify all thirteen cached inner layers."""
from pathlib import Path
import json
import bpy
import numpy as np

base = Path(__file__).resolve().parent
folder = base / 'sewn-cage-verified-physics'
bpy.ops.wm.open_mainfile(filepath=str(folder / 'withdrawal.blend'), use_scripts=False)
body = bpy.data.objects['actual unchanged animated body']
cache = body.modifiers['Collider vertex cache']
assert cache.filepath.startswith('//'), 'The saved body cache must use its relative sidecar.'
assert Path(bpy.path.abspath(cache.filepath)).resolve() == (folder / 'actual-body.pc2').resolve()
records = []
for frame in [1, 25, 16, 10, 16.5]:
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    owner = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    actual = owner.to_mesh()
    coordinates = np.empty(len(actual.vertices) * 3, dtype=np.float32)
    actual.vertices.foreach_get('co', coordinates)
    owner.to_mesh_clear()
    low = int(frame)
    expected = np.fromfile(base / f'current-input/body-{low}.bin', dtype='<f4') * 100
    if frame == low:
        equal = coordinates.tobytes() == expected.tobytes()
        assert equal, (frame, float(np.abs(coordinates - expected).max()))
    else:
        next_frame = np.fromfile(base / f'current-input/body-{low + 1}.bin', dtype='<f4') * 100
        expected += (next_frame - expected) * (frame - low)
        error = np.abs(coordinates - expected)
        assert np.all(error <= np.abs(np.spacing(expected)) * 2)
        equal = None
    records.append(dict(frame=frame, vertices=len(coordinates) // 3,
        bitIdentical=equal, maximumScaledError=float(np.abs(coordinates - expected).max())))
report = dict(blenderVersion=bpy.app.version_string, relativeSidecar=cache.filepath, records=records,
    scope='Only the actual saved thirteen-layer collider cache; does not accept cloth dynamics or gameplay.')
(base / 'body-cache-reopen.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
