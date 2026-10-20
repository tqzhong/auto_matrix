"""Compare linear solvers on the actual complete-garment contact matrix."""
import json
from pathlib import Path
import time
import scipy.sparse as sp
from scipy.sparse.linalg import splu, spilu, gmres, LinearOperator

base = Path(__file__).parent
setup = (base/'probe-convergence.py').read_text().split(
    'initial_energy, gradient, hessian = context[', 1)[0]
scope = {'__file__': __file__, '__name__': 'full_linear_profile'}
exec(compile(setup, str(base/'probe-convergence.py'), 'exec'), scope)
_, gradient, hessian = scope['context']['evaluate'](scope['x'], scope['predicted'])
free, np = scope['free'], scope['np']
matrix = hessian[free][:, free].tocsc()
rhs = -gradient[free]
folder = base/'full-linear-profile'
folder.mkdir(exist_ok=False)
sp.save_npz(folder/'matrix.npz', matrix)
np.save(folder/'rhs.npy', rhs)
rows = []
reference = None
for method in ('COLAMD', 'MMD_AT_PLUS_A', 'MMD_ATA', 'ilu-gmres', 'COLAMD'):
    started = time.perf_counter()
    if method == 'ilu-gmres':
        factor = spilu(matrix, drop_tol=1e-4, fill_factor=10)
        preconditioner = LinearOperator(matrix.shape, matvec=factor.solve)
        iterations = []
        solution, info = gmres(matrix, rhs, M=preconditioner, rtol=1e-10,
            atol=0, restart=50, maxiter=60, callback_type='pr_norm',
            callback=lambda _: iterations.append(1))
    else:
        factor = splu(matrix, permc_spec=method)
        solution = factor.solve(rhs)
        info, iterations = 0, []
    seconds = time.perf_counter()-started
    if reference is None:
        reference = solution.copy()
    row = {'method': method, 'seconds': seconds, 'info': info,
        'iterations': len(iterations), 'factorNonzeros': factor.L.nnz+factor.U.nnz,
        'relativeResidual': float(np.max(np.abs(matrix@solution-rhs))/np.max(np.abs(rhs))),
        'maximumDisplacementDifferenceMetres': float(np.max(np.abs(solution-reference)))}
    row['matchesDirectSolve'] = info == 0 and row['relativeResidual'] < 1e-7 \
        and row['maximumDisplacementDifferenceMetres'] < 1e-9
    rows.append(row)
    report = {'matrixShape': matrix.shape, 'matrixNonzeros': matrix.nnz, 'rows': rows,
        'sourceState': 'ipc-membrane-energy-physics/substeps/rejected-1.npz',
        'scope': 'Same complete-garment matrix; other bakes were running. Not a full trajectory comparison.'}
    (folder/'results.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(row), flush=True)
