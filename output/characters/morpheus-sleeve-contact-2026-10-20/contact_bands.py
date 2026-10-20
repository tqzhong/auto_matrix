"""Keep tiny sewn features separate from body-contact lookahead.

Both bands retain the complete surface. Their filters partition the original
dynamic pairs; the unfiltered mesh remains responsible for continuous checks.
"""
import numpy as np
import ipctk

# Measured rest gaps are 22.4 micrometres within the coat and 260.7
# micrometres to the shirt. Both bands start without artificial repulsion.
SELF_ACTIVATION = .00001
BODY_ACTIVATION = .0002


def contact_bands(reference, edges, faces, mapping, cloth_count):
    patches = (np.arange(len(reference)) >= cloth_count).astype(np.int32)
    cross = ipctk.make_vertex_patches_filter(patches)
    dynamic = ipctk.make_static_obstacle_filter(cloth_count)
    result = []
    for collision_filter, distance in ((dynamic & ~cross, SELF_ACTIVATION),
                                       (dynamic & cross, BODY_ACTIVATION)):
        mesh = ipctk.CollisionMesh(reference, edges, faces, mapping)
        mesh.can_collide = collision_filter
        result.append((mesh, distance))
    return result
