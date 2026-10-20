"""Profile complete Newton iterations at the frozen real failed contact state."""
import cProfile
import json
from pathlib import Path
import pstats
import time

base = Path(__file__).parent
setup = (base/'probe-convergence.py').read_text().split(
    'initial_energy, gradient, hessian = context[', 1)[0]
scope = {'__file__': __file__, '__name__': 'frozen_iteration_profile'}
exec(compile(setup, str(base/'probe-convergence.py'), 'exec'), scope)
context = scope['context']
x, predicted, free = scope['x'], scope['predicted'], scope['free']
np, cloth, ipctk = scope['np'], scope['cloth'], scope['ipctk']
rows = []
profile = cProfile.Profile()
profile.enable()
for repeat in range(3):
    started = time.perf_counter()
    energy, gradient, hessian = context['evaluate'](x, predicted)
    evaluated = time.perf_counter()
    matrix = hessian[free][:, free].tocsc()
    displacement = cloth.spsolve(matrix, -gradient[free])
    solved = time.perf_counter()
    direction = np.zeros_like(x)
    direction.ravel()[free] = displacement
    alpha = ipctk.compute_collision_free_stepsize(
        scope['mesh'], scope['surface'](x), scope['surface'](x+direction))
    alpha = min(alpha, cloth.strain_free_stepsize(
        x, direction, scope['edges'][:scope['count']], scope['rest'][:scope['count']]))
    collision_checked = time.perf_counter()
    slope = float(gradient[free]@displacement)
    assert slope < 0
    searches = 1
    while context['evaluate'](x+alpha*direction, predicted, False) > energy+1e-4*alpha*slope:
        alpha *= .5
        searches += 1
        assert alpha > 1e-10
    rows.append({'repeat': repeat, 'evaluationSeconds': evaluated-started,
        'linearSeconds': solved-evaluated, 'ccdSeconds': collision_checked-solved,
        'lineSearchSeconds': time.perf_counter()-collision_checked,
        'lineSearchEvaluations': searches, 'alpha': alpha, 'energy': energy,
        'maximumNewtonStep': float(np.max(np.abs(displacement))),
        'relativeLinearResidual': float(np.max(np.abs(matrix@displacement+gradient[free])) /
                                       np.max(np.abs(gradient[free])))})
profile.disable()
with (base/'iteration-profile.txt').open('w') as output:
    pstats.Stats(profile, stream=output).sort_stats('cumtime').print_stats(30)
report = {'rows': rows, 'sourceState': 'ipc-membrane-energy-physics/substeps/rejected-1.npz',
    'vertices': scope['n'], 'triangles': len(scope['faces']),
    'scope': 'Three frozen Newton iterations with real complete geometry; not total bake time or game FPS.'}
(base/'iteration-profile.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2), flush=True)
