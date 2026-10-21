"""The reduced solve must retain the displayed material's energy and forces."""
import json
from pathlib import Path
import unittest
import numpy as np
import scipy.sparse as sp
from membrane import prepare_membrane, membrane_energy
from embedded_membrane import embedded_membrane
from cloth_embedding import embed_panels


class EmbeddedMembraneTests(unittest.TestCase):
    def test_identity_mapping_preserves_full_material_exactly(self):
        reference = np.array([[0., 0., 0.], [.4, 0., 0.], [.08, .3, 0.]])
        faces = np.array([[0, 1, 2]])
        rest = prepare_membrane(reference, faces)
        displacement = np.array([[.002, .003, 0.], [.009, -.003, .001], [.002, -.004, -.002]])
        for project in (False, True):
            a = membrane_energy(reference + displacement, faces, rest, project=project)
            b = embedded_membrane(displacement, reference, faces, rest, sp.eye(3), sp.eye(9), project=project)
            self.assertEqual(a[0], b[0])
            np.testing.assert_array_equal(a[1], b[1])
            np.testing.assert_array_equal(a[2].toarray(), b[2].toarray())
            self.assertEqual(embedded_membrane(displacement, reference, faces, rest,
                sp.eye(3), sp.eye(9), derivatives=False), a[0])

    def test_reduced_gradient_and_hessian_match_finite_differences(self):
        reference = np.array([[0., 0., 0.], [.4, 0., 0.], [.08, .3, 0.], [.14, .08, .001]])
        faces = np.array([[0, 1, 3], [1, 2, 3], [2, 0, 3]])
        embedding = sp.csr_matrix([[1., 0., 0.], [0., 1., 0.], [0., 0., 1.], [.45, .25, .3]])
        dof_map = sp.kron(embedding, sp.eye(3), format='csr')
        rest = prepare_membrane(reference, faces)
        x = np.array([[.002, .003, 0.], [.009, -.003, .001], [.002, -.004, -.002]])
        energy, gradient, hessian = embedded_membrane(x, reference, faces, rest, embedding, dof_map, project=False)
        self.assertGreater(energy, 0)
        for i in range(x.size):
            delta = np.zeros(x.size); delta[i] = 1e-7; delta = delta.reshape(x.shape)
            high = embedded_membrane(x + delta, reference, faces, rest, embedding, dof_map, project=False)
            low = embedded_membrane(x - delta, reference, faces, rest, embedding, dof_map, project=False)
            np.testing.assert_allclose((high[0] - low[0]) / 2e-7, gradient[i], atol=1e-5, rtol=1e-6)
            np.testing.assert_allclose((high[1] - low[1]) / 2e-7, hessian.toarray()[:, i], atol=2e-4, rtol=1e-6)

    def test_complete_displayed_costume_contributes_its_material(self):
        base = Path(__file__).resolve().parent
        cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
        display = json.loads((base/'input/manifest.json').read_text())
        embedding, _ = embed_panels(cage, display)
        dof_map = sp.kron(embedding, sp.eye(3), format='csr')
        reference = np.asarray(display['points'])*.4
        physical = np.asarray(cage['points'])*.4
        faces = np.asarray(display['indices']).reshape(-1, 3)
        rest = prepare_membrane(reference, faces)
        self.assertEqual(len(faces), 25796)
        displacement = physical @ np.diag([.005, -.003, .002])
        energy, gradient, hessian = embedded_membrane(displacement, reference, faces, rest, embedding, dof_map)
        full = membrane_energy(reference + embedding @ displacement, faces, rest)
        self.assertEqual(energy, full[0])
        self.assertEqual(hessian.shape, (physical.size, physical.size))
        direction = np.random.default_rng(7).normal(0, 1, physical.shape)
        np.testing.assert_allclose(gradient @ direction.ravel(), full[1] @ (embedding @ direction).ravel(), atol=1e-7)
        self.assertGreaterEqual(float(direction.ravel() @ (hessian @ direction.ravel())), -1e-7)
        self.assertEqual(embedded_membrane(displacement, reference, faces, rest,
            embedding, dof_map, derivatives=False), energy)


if __name__ == '__main__':
    unittest.main()
