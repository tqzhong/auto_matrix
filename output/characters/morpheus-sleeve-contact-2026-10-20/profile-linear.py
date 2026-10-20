"""Compare sparse orderings on an actual rejected garment step, unchanged physics."""
import json
import time
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import splu
import ipctk
from ipc_cloth import prepare, springs, BASE
from cloth_embedding import embed_panels

ipctk.set_num_threads(4)
source = BASE/'ipc-adaptive-physics'
rejection = json.loads((source/'rejections.json').read_text())[26]
state = np.load(source/'substeps/rejected-27.npz')
points, faces, edges, rest, stiffness, mass, pins, _, body, all_faces, _ = prepare()
n = len(points)
x = state['previous']
h = rejection['endTime']-rejection['startTime']
predicted = x[:n]+h*state['previous_velocity']
predicted[:, 2] -= h*h*9.81
cage = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
manifest = json.loads((BASE/'input/manifest.json').read_text())
embedding, _ = embed_panels(cage, manifest)
shown = np.asarray(manifest['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
visible_count = len(shown)
reference = np.vstack((points, body[0]))
collision_reference = np.vstack((shown, body[0]))
all_faces = np.vstack((np.asarray(manifest['indices']).reshape(-1, 3), all_faces[len(faces):]+visible_count-n))
mapping = sp.block_diag((embedding, sp.eye(len(body[0]))), format='csc')
mesh = ipctk.CollisionMesh(collision_reference, ipctk.edges(all_faces), all_faces, mapping)
mesh.can_collide = ipctk.make_static_obstacle_filter(visible_count)
visible = mesh.displace_vertices(x-reference)
free = (np.setdiff1d(np.arange(n), pins)[:, None]*3+np.arange(3)).ravel()
contacts = ipctk.NormalCollisions()
contacts.build(mesh, visible, .001)
potential = ipctk.BarrierPotential(.001, 1e6)
_, gradient, hessian = springs(x[:n], edges, rest, stiffness)
inertial = np.repeat(mass/h**2, 3)
full_gradient = mesh.to_full_dof(potential.gradient(contacts, mesh, visible))
full_gradient[:3*n] += gradient+inertial*(x[:n]-predicted).ravel()
full_hessian = mesh.to_full_dof(potential.hessian(contacts, mesh, visible,
    project_hessian_to_psd=ipctk.PSDProjectionMethod.CLAMP))
full_hessian += sp.block_diag((hessian+sp.diags(inertial),
    sp.csr_matrix((x[n:].size, x[n:].size))), format='csr')
matrix = full_hessian[free][:, free].tocsc()
rhs = -full_gradient[free]
out = BASE/'linear-profile'
out.mkdir(exist_ok=False)
sp.save_npz(out/'matrix.npz', matrix)
np.save(out/'rhs.npy', rhs)
rows = []
reference_solution = None
for ordering in ['COLAMD', 'MMD_AT_PLUS_A', 'MMD_ATA', 'MMD_AT_PLUS_A', 'COLAMD']:
    start = time.perf_counter()
    factor = splu(matrix, permc_spec=ordering)
    solution = factor.solve(rhs)
    seconds = time.perf_counter()-start
    if reference_solution is None:
        reference_solution = solution.copy()
    row = {'ordering': ordering, 'seconds': seconds, 'factorNonzeros': factor.L.nnz+factor.U.nnz,
        'relativeResidual': float(np.linalg.norm(matrix@solution-rhs, np.inf)/np.linalg.norm(rhs, np.inf)),
        'maximumDisplacementDifferenceMetres': float(np.max(np.abs(solution-reference_solution)))}
    rows.append(row)
    print(json.dumps(row), flush=True)
    assert row['relativeResidual'] < 1e-7
    assert row['maximumDisplacementDifferenceMetres'] < 1e-9
report = {'source': rejection, 'matrixShape': matrix.shape, 'matrixNonzeros': matrix.nnz,
          'rows': rows, 'note': 'Same machine with the original bake still running; offline solve, not game FPS.'}
(out/'results.json').write_text(json.dumps(report, indent=2))
