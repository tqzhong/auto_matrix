"""Run one recorded complete interval with only the linear solver replaced.

The original 200-iteration budget, material, body/cuff paths, float32 output
and every acceptance gate remain active. Stop only after save_sample accepts
a complete interval; this exception cannot be mistaken for a cloth rejection.
"""
import json
from pathlib import Path
import time
import numpy as np
from scipy.sparse.linalg import splu

base = Path(__file__).parent
checkpoint = 'ipc-membrane-linear-checkpoint'
output = 'ipc-membrane-linear-step'
at = json.loads((base/checkpoint/'snapshot.json').read_text())['lastTime']
interval = None
matched = False
for line in (base/'ipc-membrane-energy-physics.log').read_text().splitlines():
    row = json.loads(line)
    if row.get('acceptedSample', {}).get('time') == at:
        matched = True
    elif matched and 'barrierStiffness' in row:
        interval = row
        break
assert interval is not None
assert not (base/output).exists(), 'Do not overwrite a control'

class AcceptedInterval(Exception):
    pass

source = (base/'ipc_cloth.py').read_text()
substeps = 4
replacements = {
    'for frame in range(frame_end):': f"for frame in [{interval['sourceFrame']-1}]:",
    'for substep in range(1, substeps+1):':
        f"for substep in [{interval['sourceBlend']*substeps!r}]:",
    'save_sample(.8+(frame-1+blend)/30, frame+1, blend*substeps)':
        'save_sample(.8+(frame-1+blend)/30, frame+1, blend*substeps)\n'
        '            if abs(.8+(frame-1+blend)/30-target_time) < 1e-12:\n'
        '                raise AcceptedInterval()',
}
for before, after in replacements.items():
    assert source.count(before) == 1
    source = source.replace(before, after)
scope = {'__file__': str(base/'ipc_cloth.py'), '__name__': 'controlled_linear_step',
         'AcceptedInterval': AcceptedInterval,
         'target_time': at+interval['integrationSeconds']}
exec(compile(source, scope['__file__'], 'exec'), scope)
residuals = []
def symmetric_solve(matrix, rhs):
    factor = splu(matrix, permc_spec='MMD_AT_PLUS_A', diag_pivot_thresh=0,
                  options={'SymmetricMode': True})
    solution = factor.solve(rhs)
    error = float(np.max(np.abs(matrix@solution-rhs))/np.max(np.abs(rhs)))
    assert error < 1e-7, ('linear residual', error)
    residuals.append(error)
    return solution
scope['spsolve'] = symmetric_solve
started = time.perf_counter()
try:
    scope['bake'](interval['sourceFrame'], substeps, output,
                  resume=checkpoint, full_surface=True)
except AcceptedInterval:
    rows = json.loads((base/output/'substeps/progress.json').read_text())
    (base/output/'substeps/summary.json').write_text(json.dumps(rows, indent=2)+'\n')
    result = {'startTime': at, 'requestedInterval': interval, 'accepted': rows[-1],
        'linearSolves': len(residuals), 'maximumLinearResidual': max(residuals),
        'seconds': time.perf_counter()-started,
        'scope': 'One complete interval after a frozen prefix; not the full withdrawal.'}
    (base/'linear-step-verification.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2), flush=True)
else:
    raise AssertionError('The complete interval was not accepted')
