"""Measure iterative solves against the same frozen full-contact Newton system."""
import json
import time
from pathlib import Path
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import cg, gmres, spilu, spsolve, LinearOperator

out = Path(__file__).parent/'linear-profile'
matrix = sp.load_npz(out/'matrix.npz').tocsr()
rhs = np.load(out/'rhs.npy')
reference = spsolve(matrix.tocsc(), rhs)
rows = []
for method in ('diagonal-cg', 'ilu-gmres'):
    start = time.perf_counter()
    iterations = []
    if method == 'diagonal-cg':
        inverse = 1/matrix.diagonal()
        preconditioner = LinearOperator(matrix.shape, matvec=lambda x: inverse*x)
        solution, info = cg(matrix, rhs, M=preconditioner, rtol=1e-10, atol=0,
            maxiter=3000, callback=lambda _: iterations.append(1))
    else:
        factor = spilu(matrix.tocsc(), drop_tol=1e-4, fill_factor=10)
        preconditioner = LinearOperator(matrix.shape, matvec=factor.solve)
        solution, info = gmres(matrix, rhs, M=preconditioner, rtol=1e-10, atol=0,
            restart=50, maxiter=60, callback=lambda _: iterations.append(1), callback_type='pr_norm')
    row = {'method': method, 'seconds': time.perf_counter()-start, 'info': info,
        'iterations': len(iterations),
        'relativeResidual': float(np.linalg.norm(matrix@solution-rhs, np.inf)/np.linalg.norm(rhs, np.inf)),
        'maximumDisplacementDifferenceMetres': float(np.max(np.abs(solution-reference)))}
    row['matchesDirectSolve'] = info == 0 and row['relativeResidual'] < 1e-7 and row['maximumDisplacementDifferenceMetres'] < 1e-9
    rows.append(row)
    print(json.dumps(row), flush=True)
(out/'iterative-results.json').write_text(json.dumps(rows, indent=2))
