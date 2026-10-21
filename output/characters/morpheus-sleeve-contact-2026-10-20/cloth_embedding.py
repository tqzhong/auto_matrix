"""Distance-weighted affine displacement binding for the complete garment."""
import numpy as np
import scipy.sparse as sp
from scipy.spatial import cKDTree


def embed_panels(cage, display):
    physical = np.asarray(cage['points'])*.4
    visible = np.asarray(display['points'])*.4
    controls = {int(source): target for source, target in cage['mappedControls'].items()}
    rows, columns, weights = [], [], []
    maximum_weight = 0.
    bounded_rows = 0
    for physical_part, display_part in zip(cage['parts'], display['parts']):
        ids = np.asarray(physical_part['vertices'])
        shown = np.unique(display_part['vertices'])
        distances, nearest = cKDTree(physical[ids]).query(visible[shown], k=min(32, len(ids)))
        for row, ds, neighbors in zip(shown, distances, nearest):
            if row in controls:
                rows.append(row); columns.append(controls[row]); weights.append(1.)
                continue
            if ds[0] < 1e-10:
                rows.append(row); columns.append(ids[neighbors[0]]); weights.append(1.)
                continue
            offsets = physical[ids[neighbors]]-visible[row]
            scale = max(float(ds[-1]), 1e-9)
            matrix = np.vstack((np.ones(len(neighbors)), (offsets/scale).T))
            # Taper the farthest neighbours out instead of switching four
            # pivots independently at adjacent visible vertices. The inverse
            # distance factor approaches a real control continuously.
            distance = ds/scale
            influence = np.maximum(1-distance**2, 1e-6)**2/np.maximum(distance, 1e-6)
            influence /= influence.max()
            coefficients = influence*np.linalg.lstsq(matrix*influence, [1., 0., 0., 0.], rcond=1e-12)[0]
            limit = 2.-1e-8
            if np.max(np.abs(coefficients)) > limit:
                # Both solutions reproduce affine motion. Blend toward the
                # minimum-norm one before extrapolation amplifies an input
                # control beyond the existing twofold bound.
                uniform = np.linalg.lstsq(matrix, [1., 0., 0., 0.], rcond=1e-12)[0]
                assert np.max(np.abs(uniform)) < limit, 'the local support cannot safely reproduce affine motion'
                delta = coefficients-uniform
                moving = delta != 0
                amount = np.min((np.sign(delta[moving])*limit-uniform[moving])/delta[moving])
                coefficients = uniform+min(1., float(amount))*delta
                bounded_rows += 1
            maximum_weight = max(maximum_weight, float(np.abs(coefficients).max()))
            rows.extend([row]*len(neighbors)); columns.extend(ids[neighbors]); weights.extend(coefficients)
    mapping = sp.coo_matrix((weights, (rows, columns)), shape=(len(visible), len(physical))).tocsr()
    error = np.linalg.norm(mapping@physical-visible, axis=1)
    constant_error = np.max(np.abs(np.asarray(mapping.sum(axis=1)).ravel()-1))
    report = {'maximumRestErrorMetres': float(error.max()), 'maximumConstantError': float(constant_error),
              'maximumAbsoluteWeight': maximum_weight, 'nonzeros': mapping.nnz,
              'boundedAffineRows': bounded_rows}
    if constant_error > 1e-8 or error.max() > 1e-6:
        raise RuntimeError(f'the display embedding cannot preserve the rest surface: {report}')
    return mapping, report
