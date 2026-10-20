"""Triangle membrane using Green strain and an area-weighted plane-stress law.

The 50 kN/m in-plane modulus keeps the existing authoring stiffness scale.
These values are not measurements of the film costume's leather.
"""
import numpy as np
import scipy.sparse as sp

MODULUS = 50000.
POISSON_RATIO = .3
CONSTITUTIVE = MODULUS/(1-POISSON_RATIO**2)*np.array([
    [1., POISSON_RATIO, 0.],
    [POISSON_RATIO, 1., 0.],
    [0., 0., (1-POISSON_RATIO)/2],
])


def prepare_membrane(points, faces):
    first = points[faces[:, 1]]-points[faces[:, 0]]
    second = points[faces[:, 2]]-points[faces[:, 0]]
    length = np.linalg.norm(first, axis=1)
    tangent = first/length[:, None]
    along = np.sum(second*tangent, axis=1)
    height = np.linalg.norm(second-tangent*along[:, None], axis=1)
    assert np.all(length > 0) and np.all(height > 0)
    basis = np.zeros((len(faces), 3, 2))
    basis[:, 1, 0] = 1/length
    basis[:, 1, 1] = -along/(length*height)
    basis[:, 2, 1] = 1/height
    basis[:, 0] = -basis[:, 1]-basis[:, 2]
    indices = (faces[:, :, None]*3+np.arange(3)).reshape(-1, 9)
    rows = np.repeat(indices, 9, axis=1).ravel()
    columns = np.tile(indices, (1, 9)).ravel()
    return basis, .5*length*height, rows, columns


def membrane_energy(points, faces, rest, project=True, derivatives=True):
    basis, area, rows, columns = rest
    # Subtract the first vertex before multiplying the basis: this avoids
    # cancellation under translation on very thin authored cuff triangles.
    local = points[faces]-points[faces[:, :1]]
    deformation = np.einsum('mvi,mvj->mij', local, basis)
    a, b = deformation[:, :, 0], deformation[:, :, 1]
    strain = np.stack((.5*(np.sum(a*a, axis=1)-1),
                       .5*(np.sum(b*b, axis=1)-1),
                       np.sum(a*b, axis=1)), axis=1)
    stress = strain@CONSTITUTIVE
    energy = float(.5*np.sum(area[:, None]*strain*stress))
    if not derivatives:
        return energy
    du, dv = basis[:, :, 0, None], basis[:, :, 1, None]
    jacobian = np.stack((du*a[:, None], dv*b[:, None],
                         du*b[:, None]+dv*a[:, None]), axis=1).reshape(-1, 3, 9)
    forces = area[:, None]*np.einsum('ms,msi->mi', stress, jacobian)
    gradient = np.zeros_like(points)
    np.add.at(gradient, faces.ravel(), forces.reshape(-1, 3))
    blocks = np.einsum('msi,st,mtj->mij', jacobian, CONSTITUTIVE, jacobian)
    second = np.stack((np.stack((stress[:, 0], stress[:, 2]), axis=1),
                       np.stack((stress[:, 2], stress[:, 1]), axis=1)), axis=1)
    curvature = np.einsum('mis,mst,mjt->mij', basis, second, basis)
    blocks += np.einsum('mij,ab->miajb', curvature, np.eye(3)).reshape(-1, 9, 9)
    if project:
        # Project the complete triangle matrix. Projecting only its stress
        # curvature needlessly stiffens modes that the exact Hessian stabilizes.
        # This changes the search direction, not the energy or gradient.
        values, vectors = np.linalg.eigh(blocks)
        blocks = (vectors*np.maximum(values, 0)[:, None, :])@vectors.transpose(0, 2, 1)
    blocks *= area[:, None, None]
    hessian = sp.coo_matrix((blocks.ravel(), (rows, columns)),
                           shape=(points.size, points.size)).tocsr()
    return energy, gradient.ravel(), hessian
