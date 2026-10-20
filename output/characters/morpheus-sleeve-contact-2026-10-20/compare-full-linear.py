"""Bounded solver comparison using the saved complete-garment Newton matrix.

The first unbounded MMD_AT_PLUS_A trial exceeded eight minutes while COLAMD
took two seconds. Each new candidate runs separately with a 20 second limit.
No result from this frozen-system experiment changes the garment baker.
"""
import json
from pathlib import Path
import subprocess
import sys
import time
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import splu, spilu, gmres, LinearOperator

folder = Path(__file__).parent/'full-linear-profile'
matrix = sp.load_npz(folder/'matrix.npz')
rhs = np.load(folder/'rhs.npy')

if len(sys.argv) > 1:
    method, name = sys.argv[1:]
    started = time.perf_counter()
    iterations = []
    if method == 'ilu-gmres':
        factor = spilu(matrix, drop_tol=1e-4, fill_factor=10)
        solution, info = gmres(matrix, rhs,
            M=LinearOperator(matrix.shape, matvec=factor.solve),
            rtol=1e-10, atol=0, restart=50, maxiter=60,
            callback_type='pr_norm', callback=lambda _: iterations.append(1))
    else:
        options = {'permc_spec': method}
        if method == 'symmetric-MMD':
            options = {'permc_spec': 'MMD_AT_PLUS_A', 'diag_pivot_thresh': 0,
                       'options': {'SymmetricMode': True}}
        factor = splu(matrix, **options)
        solution, info = factor.solve(rhs), 0
    seconds = time.perf_counter()-started
    np.save(folder/f'{name}.npy', solution)
    row = {'method': method, 'seconds': seconds, 'info': info,
        'iterations': len(iterations), 'factorNonzeros': factor.L.nnz+factor.U.nnz,
        'relativeResidual': float(np.max(np.abs(matrix@solution-rhs))/np.max(np.abs(rhs)))}
    (folder/f'{name}.json').write_text(json.dumps(row, indent=2)+'\n')
    raise SystemExit(0)

rows = []
reference = None
for index, method in enumerate(('COLAMD', 'MMD_ATA', 'symmetric-MMD', 'ilu-gmres', 'COLAMD')):
    name = f'bounded-{index}'
    started = time.perf_counter()
    try:
        result = subprocess.run([sys.executable, __file__, method, name],
            capture_output=True, text=True, timeout=20)
        if result.returncode:
            row = {'method': method, 'status': 'failed', 'exitCode': result.returncode,
                   'error': result.stderr}
        else:
            row = json.loads((folder/f'{name}.json').read_text())
            solution = np.load(folder/f'{name}.npy')
            if reference is None:
                reference = solution.copy()
            row['maximumDisplacementDifferenceMetres'] = float(np.max(np.abs(solution-reference)))
            row['matchesDirectSolve'] = row['info'] == 0 and row['relativeResidual'] < 1e-7 \
                and row['maximumDisplacementDifferenceMetres'] < 1e-9
            row['status'] = 'complete'
    except subprocess.TimeoutExpired:
        row = {'method': method, 'status': 'timed-out', 'limitSeconds': 20,
               'elapsedSeconds': time.perf_counter()-started}
    rows.append(row)
    report = {'matrixShape': matrix.shape, 'matrixNonzeros': matrix.nnz, 'rows': rows,
        'sourceState': 'ipc-membrane-energy-physics/substeps/rejected-1.npz',
        'scope': 'Frozen complete-garment linear system with concurrent bakes; not a trajectory or game FPS.'}
    (folder/'bounded-results.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(row), flush=True)
