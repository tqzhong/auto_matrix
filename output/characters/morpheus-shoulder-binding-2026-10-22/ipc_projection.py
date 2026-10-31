"""Geometric pose correction: retain clear authored motion and project unsafe motion.
No cloth material, mass or gravity model is implied by this quadratic objective.
"""
import time
import numpy as np
from scipy.sparse.linalg import spsolve
import ipctk


def feasible_line_search(mesh, positions, direction, initial_step, energy, evaluate, slope):
    step = initial_step
    feasibility_rejections = energy_rejections = 0
    while step > 1e-12:
        candidate = positions + step * direction
        if not ipctk.is_step_collision_free(mesh, positions, candidate) or ipctk.has_intersections(mesh, candidate):
            step *= .5
            feasibility_rejections += 1
            continue
        candidate_energy = evaluate(candidate)
        if not np.isfinite(candidate_energy) or candidate_energy > energy + 1e-4 * step * slope:
            step *= .5
            energy_rejections += 1
            continue
        return step, feasibility_rejections, energy_rejections
    raise RuntimeError('No feasible decreasing pose-correction step')


def project(mesh, positions, target, quadratic, dhat, context, log):
    value = positions.copy()
    barrier = ipctk.BarrierPotential(dhat)
    stiffness = 1 / dhat ** 2
    records = []
    start = time.perf_counter()
    assert not ipctk.has_intersections(mesh, value), 'Projection requires a valid initial surface'
    if not ipctk.has_intersections(mesh, target):
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, target, dhat)
        if contacts.compute_minimum_distance(mesh, target) > 1e-12 and ipctk.is_step_collision_free(mesh, value, target):
            return target.copy(), dict(context=context, mode='clear-authored-motion', iterations=[],
                seconds=time.perf_counter() - start, maximumCorrection=0.,
                targetMotion=float(np.linalg.norm(target - positions, axis=1).max()),
                actualMotion=float(np.linalg.norm(target - positions, axis=1).max()))

    def evaluate(points, derivatives=False):
        collisions = ipctk.NormalCollisions()
        collisions.build(mesh, points, dhat)
        delta = (points - target).ravel()
        energy = float(.5 * delta @ (quadratic @ delta) + stiffness * barrier(collisions, mesh, points))
        if derivatives:
            gradient = quadratic @ delta + stiffness * barrier.gradient(collisions, mesh, points)
            hessian = quadratic + stiffness * barrier.hessian(collisions, mesh, points, ipctk.PSDProjectionMethod.CLAMP)
            return energy, gradient, hessian, len(collisions), collisions.compute_minimum_distance(mesh, points)
        return energy

    for iteration in range(100):
        energy, gradient, hessian, contacts, minimum = evaluate(value, True)
        residual = float(np.abs(gradient).max())
        if residual < 1e-7:
            records.append(dict(iteration=iteration, energy=energy, residual=residual, contacts=contacts,
                minimumSquaredDistance=minimum, converged=True, criterion='gradient'))
            break
        direction = spsolve(hessian.tocsc(), -gradient).reshape(-1, 3)
        slope = float(gradient @ direction.ravel())
        assert np.isfinite(direction).all() and slope < 0, (context, iteration, slope)
        # This is the unscaled Newton direction, not a tiny CCD-clipped move:
        # a contact jam cannot masquerade as convergence by shrinking the step.
        direction_size = float(np.abs(direction).max())
        if direction_size < 1e-8:
            records.append(dict(iteration=iteration, energy=energy, residual=residual, contacts=contacts,
                minimumSquaredDistance=minimum, unscaledDirectionMetres=direction_size,
                converged=True, criterion='newton-direction'))
            break
        reported_step = ipctk.compute_collision_free_stepsize(mesh, value, value + direction)
        step, feasibility_rejections, energy_rejections = feasible_line_search(
            mesh, value, direction, reported_step, energy, evaluate, slope)
        candidate = value + step * direction
        assert ipctk.is_step_collision_free(mesh, value, candidate), (context, iteration, 'accepted swept collision')
        value = candidate
        row = dict(iteration=iteration, energy=energy, residual=residual, contacts=contacts,
            minimumSquaredDistance=minimum, reportedStep=reported_step, step=step,
            maximumStep=float(np.abs(step * direction).max()),
            feasibilityRejections=feasibility_rejections, energyRejections=energy_rejections)
        records.append(row)
        log(dict(context=context, **row, seconds=time.perf_counter() - start))
    assert records[-1].get('converged'), (context, 'not converged', records[-1])
    assert not ipctk.has_intersections(mesh, value), (context, 'final mesh intersects')
    return value, dict(context=context, mode='constrained-projection', iterations=records,
        seconds=time.perf_counter() - start, maximumCorrection=float(np.linalg.norm(value - target, axis=1).max()),
        targetMotion=float(np.linalg.norm(target - positions, axis=1).max()),
        actualMotion=float(np.linalg.norm(value - positions, axis=1).max()))
