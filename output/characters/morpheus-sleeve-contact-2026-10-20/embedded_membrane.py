"""Evaluate all displayed cloth triangles through a reduced displacement map."""
from membrane import membrane_energy


def embedded_membrane(displacement, reference, faces, rest, embedding, dof_map,
                      project=True, derivatives=True):
    shown = reference + embedding @ displacement
    result = membrane_energy(shown, faces, rest, project=project, derivatives=derivatives)
    if not derivatives:
        return result
    energy, gradient, hessian = result
    return energy, dof_map.T @ gradient, (dof_map.T @ hessian @ dof_map).tocsr()
