"""Locate actual exported crossings in one retained failed adaptive interval."""
import json
import sys
from pathlib import Path
import numpy as np
import scipy.sparse as sp
import ipctk
from cloth_embedding import embed_panels
from ipc_cloth import prepare, springs

base = Path(__file__).parent
folder = base/'ipc-adaptive-physics'
number = int(sys.argv[1])
state = np.load(folder/f'substeps/rejected-{number}.npz')
rejection = json.loads((folder/'rejections.json').read_text())[number-1]
cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
data = json.loads((base/'input/manifest.json').read_text())
embedding, _ = embed_panels(cage, data)
points = np.asarray(cage['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
shown = np.asarray(data['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
body = np.fromfile(base/'input/body-1.bin', np.float32).reshape(-1, 3).astype(float)
reference = np.vstack((points, body))
collision_reference = np.vstack((shown, body))
offset = len(shown)
faces = [np.asarray(data['indices'], dtype=np.int32).reshape(-1, 3)]
names = np.full(offset, 'coat', dtype=object).tolist()
for part in data['bodies']:
    faces.append(np.asarray(part['indices'], dtype=np.int32).reshape(-1, 3)+offset)
    names.extend([part['name']]*part['count'])
    offset += part['count']
faces = np.vstack(faces)
edges = ipctk.edges(faces)
mapping = sp.block_diag((embedding, sp.eye(len(body))), format='csc')
mesh = ipctk.CollisionMesh(collision_reference, edges, faces, mapping)
mesh.can_collide = ipctk.make_static_obstacle_filter(len(shown))
start, end = [mesh.displace_vertices(state[key]-reference).astype(np.float32).astype(float)
              for key in ('previous', 'positions')]
_, _, spring_edges, rest, stiffness, mass, pins, *_ = prepare()
free = (np.setdiff1d(np.arange(len(points)), pins)[:, None]*3+np.arange(3)).ravel()
h = rejection['endTime']-rejection['startTime']
predicted = state['previous'][:len(points)]+h*state['previous_velocity']
predicted[:, 2] -= h*h*9.81
_, energy_gradient, _ = springs(state['previous'][:len(points)], spring_edges, rest, stiffness)
energy_gradient += np.repeat(mass/h**2, 3)*(state['previous'][:len(points)]-predicted).ravel()
normal = ipctk.NormalCollisions()
normal.build(mesh, start, .001)
unit_barrier = ipctk.BarrierPotential(.001, 1.)
barrier_gradient = mesh.to_full_dof(unit_barrier.gradient(normal, mesh, start))
diagonal = float(np.linalg.norm(np.ptp(collision_reference, axis=0)))
balanced, maximum = ipctk.initial_barrier_stiffness(diagonal, ipctk.ClampedLogBarrier(),
    .001, float(mass.mean()/h**2), energy_gradient[free], barrier_gradient[free])
scales = {'currentStiffness': 1e6, 'balancedStiffness': balanced,
    'maximumStiffness': maximum, 'minimumDistanceSquared': normal.compute_minimum_distance(mesh, start),
    'energyGradientNorm': float(np.linalg.norm(energy_gradient[free])),
    'currentBarrierGradientNorm': float(np.linalg.norm(1e6*barrier_gradient[free]))}
print(json.dumps(scales), flush=True)
candidates = ipctk.Candidates()
candidates.build(mesh, start, end)
ccd = ipctk.TightInclusionCCD(tolerance=1e-9, conservative_rescaling=1.)
contacts = []
for index in range(len(candidates)):
    candidate = candidates[index]
    p, q = candidate.dof(start, edges, faces), candidate.dof(end, edges, faces)
    if not candidate.ccd(p, q)[0]:
        continue
    hit, toi = candidate.ccd(p, q, narrow_phase_ccd=ccd)
    if hit:
        ids = [v for v in candidate.vertex_ids(edges, faces) if v >= 0]
        contacts.append({'type': type(candidate).__name__, 'ids': ids, 'names': [names[v] for v in ids],
            'timeOfImpact': toi, 'start': start[ids].tolist(), 'end': end[ids].tolist()})
        print(json.dumps(contacts[-1]), flush=True)
report = {'rejection': rejection, 'scales': scales, 'candidates': len(candidates), 'contacts': contacts}
(folder/f'rejected-contact-{number}.json').write_text(json.dumps(report, indent=2))
