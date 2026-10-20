"""Identify contacts that limit interpolation of the complete exported garment."""
import json
import sys
from pathlib import Path
import numpy as np
import ipctk

base = Path(__file__).parent
folder = base/'ipc-bound-physics'
frame = int(sys.argv[1]) if len(sys.argv) > 1 else 2
data = json.loads((base/'input/manifest.json').read_text())
visible_count = len(data['points'])
offset = visible_count
faces = [np.asarray(data['indices'], dtype=np.int32).reshape(-1, 3)]
names = np.full(visible_count, 'coat', dtype=object).tolist()
for part in data['bodies']:
    faces.append(np.asarray(part['indices'], dtype=np.int32).reshape(-1, 3)+offset)
    names.extend([part['name']]*part['count'])
    offset += part['count']
faces = np.vstack(faces)
edges = ipctk.edges(faces)
def positions(number):
    return np.vstack([np.fromfile(folder/f'{part}-{number}.bin', np.float32).reshape(-1, 3)
                      for part in ('cloth', 'body')]).astype(float)
a, b = positions(frame-1), positions(frame)
mesh = ipctk.CollisionMesh(a, edges, faces)
mesh.can_collide = ipctk.make_static_obstacle_filter(visible_count)
candidates = ipctk.Candidates()
candidates.build(mesh, a, b)
print(json.dumps({'candidates': len(candidates)}), flush=True)
precision = []
for tolerance in (1e-6, 1e-9, 1e-12):
    ccd = ipctk.TightInclusionCCD(tolerance=tolerance)
    row = {'tolerance': tolerance, 'safeStep': candidates.compute_collision_free_stepsize(mesh, a, b, narrow_phase_ccd=ccd)}
    precision.append(row)
    print(json.dumps(row), flush=True)
rows = []
for index in range(len(candidates)):
    candidate = candidates[index]
    p, q = candidate.dof(a, edges, faces), candidate.dof(b, edges, faces)
    hit, toi = candidate.ccd(p, q)
    if not hit:
        continue
    ids = [v for v in candidate.vertex_ids(edges, faces) if v >= 0]
    fine = candidate.ccd(p, q, narrow_phase_ccd=ipctk.TightInclusionCCD(tolerance=1e-12))
    geometric = candidate.ccd(p, q, narrow_phase_ccd=ipctk.TightInclusionCCD(tolerance=1e-9, conservative_rescaling=1.))
    row = {'type': type(candidate).__name__, 'ids': ids, 'names': [names[v] for v in ids],
           'safeStep': toi, 'fineCCD': list(fine), 'geometricCCD': list(geometric),
           'start': a[ids].tolist(), 'end': b[ids].tolist()}
    rows.append(row)
rows.sort(key=lambda row: row['safeStep'])
report = {'frame': frame, 'precision': precision, 'contacts': rows}
(folder/f'continuous-contacts-{frame}.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'limitingContacts': len(rows), 'first': rows[:2]}), flush=True)
