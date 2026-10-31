"""Construct a valid frame; this does not claim a cloth-energy equilibrium."""
import time
import numpy as np
from scipy.sparse.linalg import spsolve
import ipctk
from ipc_projection import feasible_line_search


class NoFeasibleFrame(RuntimeError):
    pass


def project(mesh, positions, target, quadratic, anchors, dhat, context, log, floor=None):
    value = positions.copy()
    barrier = ipctk.BarrierPotential(dhat)
    stiffness = 1 / dhat**2
    records = []
    free = np.flatnonzero(~np.repeat(anchors, 3))
    started = time.perf_counter()
    assert not ipctk.has_intersections(mesh, positions)

    def above_floor(points):
        return floor is None or float(points[:floor[1], 2].min()) > floor[0]

    assert above_floor(positions)

    def acceptable(points):
        return (np.array_equal(points[anchors], target[anchors])
            and above_floor(points)
            and not ipctk.has_intersections(mesh, points)
            and ipctk.is_step_collision_free(mesh, positions, points))

    def result(points, mode):
        assert acceptable(points)
        return points.copy(), dict(context=context, mode=mode, iterations=records,
            seconds=time.perf_counter() - started, maximumCorrection=float(np.linalg.norm(points - target, axis=1).max()),
            fixedAnchors=True, wholeIntervalClear=True, energyEquilibriumProven=False)

    if acceptable(target):
        return result(target, 'clear-authored-motion')

    def evaluate(points, derivatives=False):
        if not above_floor(points):
            return float('inf')
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, points, dhat)
        if floor is not None:
            near = np.flatnonzero(points[:floor[1], 2] - floor[0] < dhat)
            contacts.pv_collisions = [ipctk.PlaneVertexNormalCollision(
                np.asarray([0., 0., floor[0]]), np.asarray([0., 0., 1.]), int(i)) for i in near]
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
        if iteration > 0 and anchor_error < 1e-9 and acceptable(exact):
            return result(exact, 'feasible-anchored-frame')
        energy, gradient, hessian, contacts = evaluate(value, True)
        if anchor_error < 1e-9 and np.abs(gradient[free]).max() < 1e-7:
            raise NoFeasibleFrame(f'{context}: stationary endpoint has no clear whole interval')
        direction = spsolve(hessian.tocsc(), -gradient).reshape(-1, 3)
        if anchor_error < 1e-9 and np.abs(direction).max() < 1e-8:
            raise NoFeasibleFrame(f'{context}: stationary endpoint has no clear whole interval')
        slope = float(gradient @ direction.ravel())
        assert np.isfinite(direction).all() and slope < 0, (context, iteration, slope)
        reported = ipctk.compute_collision_free_stepsize(mesh, value, value + direction)
        if floor is not None:
            falling = np.flatnonzero(direction[:floor[1], 2] < 0)
            if len(falling):
                contact = float(np.min((value[falling, 2] - floor[0]) / -direction[falling, 2]))
                reported = min(reported, ipctk.TightInclusionCCD.DEFAULT_CONSERVATIVE_RESCALING * contact)
        step, rejected, energy_rejected = feasible_line_search(mesh, value, direction, reported,
            energy, evaluate, slope)
        candidate = value + step * direction
        assert ipctk.is_step_collision_free(mesh, value, candidate)
        value = candidate
        row = dict(iteration=iteration, energy=energy, residual=float(np.abs(gradient).max()),
            contacts=contacts, step=step, maximumStep=float(np.abs(step * direction).max()),
            feasibilityRejections=rejected, energyRejections=energy_rejected, anchorError=anchor_error)
        records.append(row)
        log(dict(context=context, **row, seconds=time.perf_counter() - started))
    raise NoFeasibleFrame(f'{context}: no anchored frame with a clear whole interval')
