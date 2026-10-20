"""Repeat the frozen convergence control with only the linear solver changed."""
from pathlib import Path

base = Path(__file__).parent
source = (base/'probe-convergence.py').read_text()
anchor = "exec(compile(ast.Module(body=functions, type_ignores=[]), cloth.__file__, 'exec'), context)\n"
assert source.count(anchor) == 1
source = source.replace(anchor, anchor+"""
from scipy.sparse.linalg import splu
def symmetric_solve(matrix, rhs):
    factor = splu(matrix, permc_spec='MMD_AT_PLUS_A', diag_pivot_thresh=0,
                  options={'SymmetricMode': True})
    solution = factor.solve(rhs)
    error = float(np.max(np.abs(matrix@solution-rhs))/np.max(np.abs(rhs)))
    assert error < 1e-7, ('linear residual', error)
    return solution
context['spsolve'] = symmetric_solve
""")
source = source.replace('convergence-probe.npz', 'linear-convergence-probe.npz')
source = source.replace('convergence-probe.json', 'linear-convergence-probe.json')
exec(compile(source, str(base/'probe-convergence.py'), 'exec'),
     {'__file__': __file__, '__name__': '__main__'})
