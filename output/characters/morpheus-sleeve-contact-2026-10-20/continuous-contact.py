"""Check cached coat steps for intersections between frame samples."""
import json
import sys
import time
from pathlib import Path
import numpy as np
import ipctk
from continuous_check import measure_step

base = Path(__file__).parent
folder = base / (sys.argv[1] if len(sys.argv) > 1 else 'facing-physics')
display = '--display' in sys.argv
partial = '--partial' in sys.argv
if display:
    data = json.loads((base/'input/manifest.json').read_text())
    visible_count = len(data['points'])
    offset = visible_count
    faces = [np.asarray(data['indices'], dtype=np.int32).reshape(-1, 3)]
    for part in data['bodies']:
        faces.append(np.asarray(part['indices'], dtype=np.int32).reshape(-1, 3)+offset)
        offset += part['count']
    faces = np.vstack(faces)
else:
    cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
    faces = np.asarray(cage['indices'], dtype=np.int32).reshape(-1, 3)
frames = json.loads((folder/('progress.json' if partial else 'summary.json')).read_text())
def positions(frame):
    if display:
        return np.vstack([np.fromfile(folder/f'{part}-{frame}.bin', np.float32).reshape(-1, 3)
                          for part in ('cloth', 'body')]).astype(float)
    return np.fromfile(folder/f'cage-{frame}.bin', np.float32).reshape(-1, 3).astype(float)
start = positions(1)
mesh = ipctk.CollisionMesh(start, ipctk.edges(faces), faces)
if display:
    mesh.can_collide = ipctk.make_static_obstacle_filter(visible_count)
rows = []
for frame in frames:
    end = positions(frame['frame'])
    now = time.perf_counter()
    row = {'frame': frame['frame'], 'time': frame['time'], **measure_step(mesh, start, end)}
    row['seconds'] = time.perf_counter()-now
    rows.append(row)
    print(json.dumps(row), flush=True)
    start = end
    # CCD requires a valid starting configuration; retain the first failure.
    if row['endpointIntersects'] or not row['stepCollisionFree']:
        break
name = ('partial-' if partial else '')+('display-' if display else '')+'geometric-continuous-contact.json'
(folder/name).write_text(json.dumps(rows, indent=2))
assert not any(r['endpointIntersects'] or not r['stepCollisionFree'] for r in rows), rows[-1]
