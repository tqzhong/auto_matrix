"""Full-shirt contact authoring; retain CCD, split blocked time intervals early."""
import time
import numpy as np
from scipy.sparse.linalg import spsolve
import ipctk


class NoFeasibleFrame(RuntimeError):
    pass


def project(mesh, positions, target, quadratic, anchors, dhat, context, log):
    value = positions.copy()
    phase = ipctk.BVH()
    barrier = ipctk.BarrierPotential(dhat)
    stiffness = 1 / dhat**2
    records = []
    free = np.flatnonzero(~np.repeat(anchors, 3))
    started = time.perf_counter()
    assert not ipctk.has_intersections(mesh, positions, broad_phase=phase)

    def clear(points):
        return (not ipctk.has_intersections(mesh, points, broad_phase=phase)
            and ipctk.is_step_collision_free(mesh, positions, points, broad_phase=phase))

    def result(points, mode):
        return points.copy(), dict(context=context, mode=mode, iterations=records,
            seconds=time.perf_counter() - started, maximumCorrection=float(np.linalg.norm(points - target, axis=1).max()),
            fixedAnchors=True, wholeIntervalClear=True, energyEquilibriumProven=False)

    if clear(target):
        return result(target, 'clear-authored-motion')

    def evaluate(points, derivatives=False):
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, points, dhat, broad_phase=phase)
        delta = (points - target).ravel()
        energy = float(.5 * delta @ (quadratic @ delta) + stiffness * barrier(contacts, mesh, points))
        if derivatives:
            gradient = quadratic @ delta + stiffness * barrier.gradient(contacts, mesh, points)
            hessian = quadratic + stiffness * barrier.hessian(contacts, mesh, points, ipctk.PSDProjectionMethod.CLAMP)
            return energy, gradient, hessian, len(contacts)
        return energy

    for iteration in range(100):
        exact = value.copy()
        exact[anchors] = target[anchors]
        anchor_error = float(np.abs(value[anchors] - target[anchors]).max())
        if iteration > 0 and anchor_error < 1e-9 and not ipctk.has_intersections(mesh, exact, broad_phase=phase):
            if ipctk.is_step_collision_free(mesh, positions, exact, broad_phase=phase):
                return result(exact, 'feasible-anchored-frame')
            # The endpoint is already valid. Its straight sweep is the failed
            # constraint; retain temporal subkeys instead of converging the
            # same static pose and discovering that failure again later.
            raise NoFeasibleFrame(f'{context}: clear endpoint needs a temporal split')
        energy, gradient, hessian, contacts = evaluate(value, True)
        if anchor_error < 1e-9 and np.abs(gradient[free]).max() < 1e-7:
            raise NoFeasibleFrame(f'{context}: stationary endpoint has no clear whole interval')
        direction = spsolve(hessian.tocsc(), -gradient).reshape(-1, 3)
        if anchor_error < 1e-9 and np.abs(direction).max() < 1e-8:
            raise NoFeasibleFrame(f'{context}: stationary endpoint has no clear whole interval')
        slope = float(gradient @ direction.ravel())
        assert np.isfinite(direction).all() and slope < 0, (context, iteration, slope)
        step = ipctk.compute_collision_free_stepsize(mesh, value, value + direction, broad_phase=phase)
        feasibility_rejections = energy_rejections = 0
        while step > 1e-12:
            candidate = value + step * direction
            if not ipctk.is_step_collision_free(mesh, value, candidate, broad_phase=phase) or ipctk.has_intersections(mesh, candidate, broad_phase=phase):
                step *= .5
                feasibility_rejections += 1
                continue
            candidate_energy = evaluate(candidate)
            if not np.isfinite(candidate_energy) or candidate_energy > energy + 1e-4 * step * slope:
                step *= .5
                energy_rejections += 1
                continue
            break
        else:
            raise RuntimeError(f'{context}: no feasible decreasing pose-correction step')
        value = candidate
        row = dict(iteration=iteration, energy=energy, residual=float(np.abs(gradient).max()),
            contacts=contacts, step=step, maximumStep=float(np.abs(step * direction).max()),
            feasibilityRejections=feasibility_rejections, energyRejections=energy_rejections, anchorError=anchor_error)
        records.append(row)
        log(dict(context=context, **row, seconds=time.perf_counter() - started))
    raise NoFeasibleFrame(f'{context}: no anchored frame with a clear whole interval')
