"""Reproduce the rejected full-mesh interval without running its whole worker."""
from pathlib import Path
import hashlib
import json
import sys
import time

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base))
source = base / 'construct-shirt-contact-bvh.py'
metadata = json.loads((base / 'shirt-contact-bvh/metadata.json').read_text())
for name, expected in metadata['sourceHashes'].items():
    assert hashlib.sha256((base / name).read_bytes()).hexdigest() == expected
# Reuse exactly the rejected producer's mesh, pin and quadratic construction;
# stop before its metadata writes and frame loop. The source hash is pinned.
prefix, remainder = source.read_text().split('metadata_file =', 1)
assert "out / 'metadata.json'" in remainder
fixture = {'__file__': str(source)}
exec(compile(prefix, str(source), 'exec'), fixture)
np, ipc, sample = fixture['np'], fixture['ipctk'], fixture['sample']
mesh, count, anchors = fixture['mesh'], fixture['count'], fixture['anchors']
from shirt_targets import transport_target

frame, begin, end = 104, .125, .12890625
a, z = sample(frame - 1), sample(frame)
raw_before, raw_after = a + (z - a) * begin, a + (z - a) * end
before = raw_before.copy()
before[:count] = np.fromfile(base / 'shirt-contact-bvh/cloth-104-0.1250000000.bin', dtype='<f8').reshape(-1, 3)
target = transport_target(before, raw_before, raw_after, 1.7 + begin/60, 1.7 + end/60, anchors)
fixed = before.copy()
fixed[anchors] = raw_after[anchors]
rows = []
for name, points in [('stationary', before), ('fixed-body-only', fixed), ('transported-target', target), ('raw-target', raw_after)]:
    rows.append(dict(name=name, intersections=ipc.has_intersections(mesh, points),
        wholeIntervalClear=ipc.is_step_collision_free(mesh, before, points),
        maximumStepMetres=float(np.linalg.norm(points - before, axis=1).max())))
started = time.perf_counter()
value, report = fixture['project'](mesh, before, target, fixture['quadratic'], anchors, 2e-4,
    'transported-full-mesh-reproduction', lambda row: print(json.dumps(row), flush=True))
assert np.array_equal(value[anchors], raw_after[anchors])
assert not ipc.has_intersections(mesh, value)
assert ipc.is_step_collision_free(mesh, before, value)
result = dict(frame=frame, begin=begin, end=end, seconds=time.perf_counter() - started,
    mode=report['mode'], iterations=len(report['iterations']), passed=True,
    maximumStep=float(np.linalg.norm(value - before, axis=1).max()),
    maximumRawCorrection=float(np.linalg.norm(value[:count] - raw_after[:count], axis=1).max()),
    allFaces=len(fixture['faces']), sourceHashes={name:hashlib.sha256((base / name).read_bytes()).hexdigest()
        for name in ['diagnose-shirt-transport.py', 'shirt_targets.py', 'construct-shirt-contact-bvh.py', 'feasible_shirt_projection.py']},
    rawTargetDiagnostics=rows, acceptedForProduction=False)
(base / 'shirt-transport-reproduction.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
