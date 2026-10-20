"""Audit linear playback separately from the optimizer's approach limit."""
import ipctk


def measure_step(mesh, start, end):
    # Default CCD preserves a fraction of the initial gap for Newton steps.
    # Playback validation checks zero-gap contact, with tighter numerical
    # precision, and reports the optimizer's separate approach limit as well.
    ccd = ipctk.TightInclusionCCD(tolerance=1e-9, conservative_rescaling=1.)
    return {
        'endpointIntersects': ipctk.has_intersections(mesh, end),
        'collisionFreeStep': ipctk.compute_collision_free_stepsize(mesh, start, end, narrow_phase_ccd=ccd),
        'stepCollisionFree': ipctk.is_step_collision_free(mesh, start, end, narrow_phase_ccd=ccd),
        'optimizerSafeStep': ipctk.compute_collision_free_stepsize(mesh, start, end),
    }
