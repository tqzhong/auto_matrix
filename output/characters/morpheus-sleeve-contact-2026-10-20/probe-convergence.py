"""Continue the actual fixed-contact minimization saved at an iteration limit.

This diagnostic uses the unchanged nested solver functions, not a second
implementation. Its output is not an accepted animation/cache frame.
"""
import ast
import hashlib
import json
import time
from pathlib import Path
import numpy as np
import scipy.sparse as sp
import ipctk
import ipc_cloth as cloth
from membrane import prepare_membrane

base = Path(__file__).parent
source = base/'ipc-membrane-energy-physics'
rejection = json.loads((source/'rejections.json').read_text())[0]
state_file = source/'substeps/rejected-1.npz'
saved = np.load(state_file)
interval = None
for line in (base/'ipc-membrane-energy-physics.log').read_text().splitlines():
    row = json.loads(line)
    if 'barrierStiffness' in row:
        interval = row
    if row.get('rejected', {}).get('number') == rejection['number']:
        break
assert interval is not None
h = interval['integrationSeconds']
ipctk.set_num_threads(4)
points, faces, edges, rest, stiffness, mass, pins, pin_frames, body, all_faces, count = cloth.prepare(True)
n = len(points)
reference = np.vstack((points, body[0]))
mesh = ipctk.CollisionMesh(reference, ipctk.edges(all_faces), all_faces,
                           sp.eye(len(reference), format='csc'))
mesh.can_collide = ipctk.make_static_obstacle_filter(n)
surface = lambda state: mesh.displace_vertices(state-reference)
x = saved['positions'].copy()
fixed_start = x[np.r_[pins, np.arange(n, len(x))]].copy()
assert not ipctk.has_intersections(mesh, surface(x))
predicted = saved['previous'][:n]+h*saved['previous_velocity']
predicted[:, 2] -= h*h*9.81
free = (np.setdiff1d(np.arange(n), pins)[:, None]*3+np.arange(3)).ravel()
inertial = np.repeat(mass/h**2, 3)
context = {**vars(cloth), 'n': n, 'faces': faces, 'edges': edges, 'rest': rest,
           'stiffness': stiffness, 'structural_count': count, 'full_surface': True,
           'membrane_rest': prepare_membrane(points, faces), 'x': x, 'free': free,
           'surface': surface, 'mesh': mesh, 'dhat': cloth.CONTACT_ACTIVATION,
           'inertial': inertial, 'inertial_hessian': sp.diags(inertial, format='csr'),
           'potential': ipctk.BarrierPotential(cloth.CONTACT_ACTIVATION, interval['barrierStiffness']),
           'raw_newton': False}
tree = ast.parse(Path(cloth.__file__).read_text())
bake = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'bake')
functions = [node for node in bake.body if isinstance(node, ast.FunctionDef)
             and node.name in ('material', 'evaluate', 'relax')]
assert len(functions) == 3
exec(compile(ast.Module(body=functions, type_ignores=[]), cloth.__file__, 'exec'), context)
initial_energy, gradient, hessian = context['evaluate'](x, predicted)
matrix = hessian[free][:, free].tocsc()
displacement = cloth.spsolve(matrix, -gradient[free])
initial = {'energy': initial_energy, 'maximumGradient': float(np.max(np.abs(gradient[free]))),
           'maximumNewtonStep': float(np.max(np.abs(displacement))),
           'relativeLinearResidual': float(np.max(np.abs(matrix@displacement+gradient[free])) /
                                          np.max(np.abs(gradient[free])))}
print(json.dumps({'frozenState': str(state_file), 'initial': initial}), flush=True)
started = time.perf_counter()
passes = []
converged = False
for pass_index in range(3):
    try:
        iterations, residual = context['relax'](predicted)
        passes.append({'pass': pass_index+1, 'converged': True, 'iterations': iterations,
                       'residual': residual})
        converged = True
        break
    except cloth.ClothStepError as error:
        passes.append({'pass': pass_index+1, 'converged': False, 'error': str(error)})
        print(json.dumps(passes[-1]), flush=True)
        if 'did not converge' not in str(error):
            break
np.testing.assert_array_equal(x[np.r_[pins, np.arange(n, len(x))]], fixed_start)
final_energy, final_gradient, final_hessian = context['evaluate'](x, predicted)
final_step = cloth.spsolve(final_hessian[free][:, free].tocsc(), -final_gradient[free])
np.savez(base/'convergence-probe.npz', positions=x, predicted=predicted)
report = {'solverSourceSha256': hashlib.sha256(Path(cloth.__file__).read_bytes()).hexdigest(),
          'rejectedStateSha256': hashlib.sha256(state_file.read_bytes()).hexdigest(),
          'rejection': rejection, 'interval': interval, 'initial': initial, 'passes': passes,
          'converged': converged, 'seconds': time.perf_counter()-started,
          'finalEnergy': final_energy, 'maximumFinalNewtonStep': float(np.max(np.abs(final_step))),
          'finalEndpointIntersects': bool(ipctk.has_intersections(mesh, surface(x))),
          'fixedBodyAndCuffsUnchanged': True,
          'scope': 'Fixed-contact solve only; further body/cuff advancement and exported animation checks are still required.'}
(base/'convergence-probe.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2), flush=True)
