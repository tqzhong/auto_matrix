"""Measure actual complete-garment material evaluation on frozen valid poses."""
import cProfile
import hashlib
import inspect
import json
import pstats
import sys
import time
from pathlib import Path
import numpy as np
import ipc_cloth as cloth
from membrane import prepare_membrane, membrane_energy

label = sys.argv[1]
points, faces, edges, rest, stiffness, _, _, _, _, _, count = cloth.prepare(True)
reference = prepare_membrane(points, faces)
folder = cloth.BASE/'ipc-membrane-review-14'
samples = [np.fromfile(folder/f'cloth-{frame}.bin', np.float32).reshape(-1,3).astype(float) for frame in (2, 7, 14)]
rows = []
profiler = cProfile.Profile()
profiler.enable()
for repeat in range(3):
    for number, state in zip((2, 7, 14), samples):
        started = time.perf_counter()
        energy, gradient, hessian = cloth.springs(state, edges, rest, stiffness,
            strain_count=count, structural_elastic=False)
        spring_seconds = time.perf_counter()-started
        started = time.perf_counter()
        membrane_e, membrane_g, membrane_h = membrane_energy(state, faces, reference)
        membrane_seconds = time.perf_counter()-started
        started = time.perf_counter()
        only_membrane = membrane_energy(state, faces, reference, derivatives=False)
        energy_membrane_seconds = time.perf_counter()-started
        assert only_membrane == membrane_e
        row = {'sample':number, 'repeat':repeat, 'energy':energy+membrane_e,
            'springDerivativesSeconds':spring_seconds, 'membraneDerivativesSeconds':membrane_seconds,
            'membraneEnergyOnlySeconds':energy_membrane_seconds}
        if 'derivatives' in inspect.signature(cloth.springs).parameters:
            started = time.perf_counter()
            energy_only = cloth.springs(state, edges, rest, stiffness, strain_count=count,
                                        structural_elastic=False, derivatives=False)
            row['springEnergyOnlySeconds'] = time.perf_counter()-started
            assert energy_only == energy
        rows.append(row)
profiler.disable()
profiler.dump_stats(str(cloth.BASE/f'{label}.pstats'))
with (cloth.BASE/f'{label}-profile.txt').open('w') as report:
    pstats.Stats(profiler, stream=report).sort_stats('cumtime').print_stats(25)
result = {'sourceSha256':hashlib.sha256(Path(cloth.__file__).read_bytes()).hexdigest(),
    'samples':[2,7,14], 'vertices':len(points),'triangles':len(faces),'rows':rows,
    'scope':'Profiled material evaluations on frozen accepted poses in one process; not total bake time or game FPS.'}
(cloth.BASE/f'{label}.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2), flush=True)
