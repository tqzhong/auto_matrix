"""Compare a complete rejected interval with a larger minimization budget.

Only the 200-iteration ceiling changes. The source checkpoint, body/cuff paths,
material, convergence tolerance, exported surface and CCD gates stay identical.
The generated solver and binary output are local experiment artifacts.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

base = Path(__file__).parent
source = base/'ipc_cloth.py'
original = source.read_text()
assert hashlib.sha256(source.read_bytes()).hexdigest() == \
    '6b4c74d8fb8589193b9331ebc26e598e0b5adcdce2d0752ae57a9262cc789f6a'
old, new = 'for iteration in range(200):', 'for iteration in range(600):'
assert original.count(old) == 1
candidate = original.replace(old, new)
experiment = base/'.ipc-cloth-budget600.py'
if experiment.exists():
    assert experiment.read_text() == candidate
else:
    experiment.write_text(candidate)
report = {
    'originalSourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'candidateSourceSha256': hashlib.sha256(experiment.read_bytes()).hexdigest(),
    'change': {'before': old, 'after': new},
    'checkpoint': 'ipc-membrane-energy-checkpoint',
    'checkpointSha256': hashlib.sha256(
        (base/'ipc-membrane-energy-checkpoint/substeps/checkpoint.npz').read_bytes()).hexdigest(),
    'requestedEnd': .8+2/30,
    'output': 'ipc-membrane-budget600-control',
}
assert not (base/report['output']).exists(), 'Do not overwrite or restart an existing run'
started = time.perf_counter()
process = subprocess.Popen([sys.executable, str(experiment), '--full-surface',
    '--resume', report['checkpoint'], '--frames', '3', '--substeps', '4',
    '--output', report['output']], cwd=base)
report['pid'] = process.pid
(base/'budget600-run.json').write_text(json.dumps(report, indent=2)+'\n')
report['exitCode'] = process.wait()
report['seconds'] = time.perf_counter()-started
(base/'budget600-run.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2), flush=True)
raise SystemExit(report['exitCode'])
