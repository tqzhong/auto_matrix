"""Linear affine embedding of every displayed panel into its own physical panel."""
import numpy as np
import scipy.sparse as sp
from scipy.linalg import qr
from scipy.spatial import cKDTree


def embed_panels(cage, display):
    physical = np.asarray(cage['points'])*.4
    visible = np.asarray(display['points'])*.4
    controls = {int(source): target for source, target in cage['mappedControls'].items()}
    rows, columns, weights = [], [], []
    maximum_weight = 0.
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
            target = visible[row]
            offsets = physical[ids[neighbors]]-target
            # Local distances condition the affine coordinates; the fourth
            # equation preserves constants (so translations remain exact).
            scale = max(float(ds[-1]), 1e-9)
            matrix = np.vstack((np.ones(len(neighbors)), (offsets/scale).T))
            _, _, selected = qr(matrix, pivoting=True, mode='economic')
            selected = selected[:4]
            coefficients = np.linalg.lstsq(matrix[:, selected], [1.,0.,0.,0.], rcond=1e-12)[0]
            maximum_weight = max(maximum_weight, float(np.abs(coefficients).max()))
            rows.extend([row]*len(selected)); columns.extend(ids[neighbors[selected]]); weights.extend(coefficients)
    mapping = sp.coo_matrix((weights, (rows, columns)), shape=(len(visible), len(physical))).tocsr()
    error = np.linalg.norm(mapping@physical-visible, axis=1)
    constant_error = np.max(np.abs(np.asarray(mapping.sum(axis=1)).ravel()-1))
    report = {'maximumRestErrorMetres': float(error.max()), 'maximumConstantError': float(constant_error),
              'maximumAbsoluteWeight': maximum_weight, 'nonzeros': mapping.nnz}
    if constant_error > 1e-8 or error.max() > 1e-6:
        raise RuntimeError(f'the display embedding cannot preserve the rest surface: {report}')
    return mapping, report
