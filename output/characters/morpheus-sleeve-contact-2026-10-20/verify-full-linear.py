"""Check the faster symmetric factorization against recorded full-body states."""
import hashlib
import json
from pathlib import Path
import time
from scipy.sparse.linalg import splu

base = Path(__file__).parent
setup = (base/'probe-convergence.py').read_text().split(
    'initial_energy, gradient, hessian = context[', 1)[0]
scope = {'__file__': __file__, '__name__': 'full_linear_verification'}
exec(compile(setup, str(base/'probe-convergence.py'), 'exec'), scope)
np, sp, ipctk = scope['np'], scope['sp'], scope['ipctk']
context, x, free = scope['context'], scope['x'], scope['free']
intervals = {}
for line in (base/'ipc-membrane-energy-physics.log').read_text().splitlines():
    row = json.loads(line)
    if 'barrierStiffness' in row:
        interval = row
    if 'rejected' in row:
        intervals[row['rejected']['number']] = interval

rows = []
for number in (1, 2, 4, 5, 6, 7, 8):
    state_file = base/f'ipc-membrane-energy-physics/substeps/rejected-{number}.npz'
    saved = np.load(state_file)
    interval = intervals[number]
    h, n = interval['integrationSeconds'], scope['n']
    x[:] = saved['positions']
    predicted = saved['previous'][:n]+h*saved['previous_velocity']
    predicted[:, 2] -= h*h*9.81
    context['inertial'] = np.repeat(scope['mass']/h**2, 3)
    context['inertial_hessian'] = sp.diags(context['inertial'], format='csr')
    context['potential'] = ipctk.BarrierPotential(
        scope['cloth'].CONTACT_ACTIVATION, interval['barrierStiffness'])
    _, gradient, hessian = context['evaluate'](x, predicted)
    matrix = hessian[free][:, free].tocsc()
    blend, frame = interval['sourceBlend'], interval['sourceFrame']-1
    fixed = np.zeros_like(x)
    fixed[n:] = (1-blend)*scope['body'][frame-1]+blend*scope['body'][frame]-x[n:]
    fixed[scope['pins']] = (1-blend)*scope['pin_frames'][frame-1] \
        +blend*scope['pin_frames'][frame]-x[scope['pins']]
    rhs = np.column_stack((-gradient[free], -gradient[free]-hessian[free]@fixed.ravel()))
    solutions, timings = [], []
    for method in ('COLAMD', 'symmetric-MMD', 'COLAMD'):
        started = time.perf_counter()
        options = {'permc_spec': 'COLAMD'} if method == 'COLAMD' else {
            'permc_spec': 'MMD_AT_PLUS_A', 'diag_pivot_thresh': 0,
            'options': {'SymmetricMode': True}}
        factor = splu(matrix, **options)
        solution = factor.solve(rhs)
        timings.append({'method': method, 'seconds': time.perf_counter()-started,
            'factorNonzeros': factor.L.nnz+factor.U.nnz,
            'relativeResiduals': (np.max(np.abs(matrix@solution-rhs), axis=0) /
                                  np.max(np.abs(rhs), axis=0)).tolist()})
        solutions.append(solution)
    differences = np.max(np.abs(solutions[1]-solutions[0]), axis=0)
    assert all(max(timing['relativeResiduals']) < 1e-7 for timing in timings)
    assert np.max(differences) < 1e-9
    actual = np.column_stack([scope['cloth'].solve_contact(matrix, rhs[:, index])
                              for index in range(rhs.shape[1])])
    actual_differences = np.max(np.abs(actual-solutions[0]), axis=0)
    assert np.max(actual_differences) < 1e-9
    result = {'rejection': number, 'integrationSeconds': h,
        'stateSha256': hashlib.sha256(state_file.read_bytes()).hexdigest(),
        'maximumMatrixAsymmetry': float(abs(matrix-matrix.T).max()),
        'maximumDisplacementDifferencesMetres': differences.tolist(), 'solves': timings,
        'productionSolverDifferencesMetres': actual_differences.tolist()}
    rows.append(result)
    print(json.dumps(result), flush=True)
    (base/'full-linear-verification.json').write_text(json.dumps({
        'matrixShape': matrix.shape, 'vertices': n, 'triangles': len(scope['faces']),
        'solverSourceSha256': hashlib.sha256((base/'ipc_cloth.py').read_bytes()).hexdigest(),
        'rhsKinds': ['free Newton motion', 'response to body and cuff motion'],
        'rows': rows,
        'scope': 'Recorded full-garment systems; no animation or runtime asset has changed.'
    }, indent=2)+'\n')
