"""Compare the optimized material with a frozen pre-change implementation."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
import numpy as np
import ipc_cloth as current
from membrane import prepare_membrane, membrane_energy

baseline = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('baseline_cloth', baseline)
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
points, faces, edges, rest, stiffness, _, _, _, _, _, count = current.prepare(True)
reference = prepare_membrane(points, faces)
folder = current.BASE/'ipc-membrane-review-14'
rows = []
for number in range(1, 15):
    path = folder/f'cloth-{number}.bin'
    state = np.fromfile(path, np.float32).reshape(-1, 3).astype(float)
    for elastic in (True, False):
        for project in (True, False):
            options = dict(project=project, strain_count=count, structural_elastic=elastic)
            before = old.springs(state, edges, rest, stiffness, **options)
            after = current.springs(state, edges, rest, stiffness, **options)
            energy_only = current.springs(state, edges, rest, stiffness, **options, derivatives=False)
            assert before[0] == after[0] == energy_only
            np.testing.assert_array_equal(before[1], after[1])
            assert (before[2] != after[2]).nnz == 0
            membrane = membrane_energy(state, faces, reference, project=project)
            membrane_only = membrane_energy(state, faces, reference, project=project, derivatives=False)
            assert membrane[0] == membrane_only
            assert before[0]+membrane[0] == energy_only+membrane_only
            rows.append({'sample': number, 'structuralElastic': elastic, 'project': project,
                         'energy': before[0], 'membraneEnergy': membrane_only})
    print(f'sample {number}: all four material/projection combinations identical', flush=True)

report = {
    'baselineSourceSha256': hashlib.sha256(baseline.read_bytes()).hexdigest(),
    'optimizedSourceSha256': hashlib.sha256(Path(current.__file__).read_bytes()).hexdigest(),
    'membraneSourceSha256': hashlib.sha256((current.BASE/'membrane.py').read_bytes()).hexdigest(),
    'displayVertices': len(points),
    'triangles': len(faces),
    'comparisons': len(rows),
    'springEnergyExactlyEqual': True,
    'springGradientExactlyEqual': True,
    'springSparseHessianExactlyEqual': True,
    'combinedEnergyExactlyEqual': True,
    'sampleSha256': {f'cloth-{number}.bin': hashlib.sha256((folder/f'cloth-{number}.bin').read_bytes()).hexdigest()
                     for number in range(1, 15)},
    'rows': rows,
    'scope': 'Frozen accepted poses and unchanged membrane source; this does not establish a complete trajectory or end-to-end bake speed.',
}
(current.BASE/'energy-comparison.json').write_text(json.dumps(report, indent=2)+'\n')
