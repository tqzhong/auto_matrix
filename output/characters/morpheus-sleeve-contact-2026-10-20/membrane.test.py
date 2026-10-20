"""Check membrane forces and the actual thin cuff triangle that failed."""
import json
from pathlib import Path
import unittest
import numpy as np
from scipy.optimize import minimize
from ipc_cloth import springs
from surface_strain import triangle_stretch
from membrane import prepare_membrane, membrane_energy


class MembraneTests(unittest.TestCase):
    def setUp(self):
        self.points = np.array([[0., 0., 0.], [.4, 0., 0.], [.08, .3, 0.]])
        self.faces = np.array([[0, 1, 2]])
        self.rest = prepare_membrane(self.points, self.faces)

    def test_rest_and_rigid_motion_do_not_create_forces(self):
        rotation = np.array([[0., 0., 1.], [1., 0., 0.], [0., 1., 0.]])
        for points in (self.points, self.points@rotation.T+[3., -2., 4.]):
            energy, gradient, _ = membrane_energy(points, self.faces, self.rest)
            self.assertLess(energy, 1e-22)
            np.testing.assert_allclose(gradient, 0, atol=1e-9)

    def test_exact_gradient_and_hessian_match_finite_differences(self):
        x = self.points@np.array([[1.04, .05, .02], [.08, .98, .01], [0., 0., 1.]])
        energy, gradient, hessian = membrane_energy(x, self.faces, self.rest, project=False)
        self.assertGreater(energy, 0)
        for i in range(x.size):
            delta = np.zeros(x.size)
            delta[i] = 1e-7
            delta = delta.reshape(x.shape)
            high = membrane_energy(x+delta, self.faces, self.rest, project=False)
            low = membrane_energy(x-delta, self.faces, self.rest, project=False)
            np.testing.assert_allclose((high[0]-low[0])/2e-7, gradient[i], atol=1e-5, rtol=1e-7)
            np.testing.assert_allclose((high[1]-low[1])/2e-7, hessian.toarray()[:, i],
                                       atol=2e-4, rtol=1e-6)

    def test_projected_hessian_is_nonnegative_under_compression_and_shear(self):
        for transform in (np.diag([.8, .7, 1.]), np.array([[1., .6, 0.], [0., 1., 0.], [0., 0., 1.]])):
            _, _, hessian = membrane_energy(self.points@transform, self.faces, self.rest)
            self.assertGreater(np.linalg.eigvalsh(hessian.toarray()).min(), -1e-8)

    def test_uniform_deformation_does_not_depend_on_triangle_shape(self):
        skinny = np.array([[0., 0., 0.], [.4, 0., 0.], [.399, .00002, 0.]])
        transform = np.array([[1.04, .06, .01], [.02, .99, .02], [0., 0., 1.]])
        density = []
        for points in (self.points, skinny):
            rest = prepare_membrane(points, self.faces)
            energy, _, _ = membrane_energy(points@transform, self.faces, rest)
            area = np.linalg.norm(np.cross(points[1]-points[0], points[2]-points[0]))/2
            density.append(energy/area)
        np.testing.assert_allclose(density[0], density[1], rtol=1e-9)

    def test_failed_cuff_triangle_resists_the_same_applied_load(self):
        cases = json.loads(Path(__file__).with_name('surface-strain-fixtures.json').read_text())
        case = cases[-1]
        reference, failed = np.asarray(case['reference']), np.asarray(case['deformed'])
        rest = prepare_membrane(reference, self.faces)
        edges = np.array([[0, 1], [1, 2], [2, 0]])
        lengths = np.linalg.norm(reference[edges[:, 0]]-reference[edges[:, 1]], axis=1)
        area = np.linalg.norm(np.cross(reference[1]-reference[0], reference[2]-reference[0]))/2
        stiffness = 50000*area/(3*lengths**2)
        load = springs(failed, edges, lengths, stiffness, project=False)[1][-3:]
        self.assertGreater(triangle_stretch(reference, failed, self.faces).max(), 1.5)

        def objective(displacement):
            points = failed.copy()
            points[2] += displacement
            energy, gradient, _ = membrane_energy(points, self.faces, rest, project=False)
            return energy-load@displacement, gradient[-3:]-load

        def hessian(displacement):
            points = failed.copy()
            points[2] += displacement
            return membrane_energy(points, self.faces, rest, project=False)[2].toarray()[-3:, -3:]

        result = minimize(objective, np.zeros(3), jac=True, hess=hessian, method='trust-exact',
                          options={'gtol': 1e-8, 'maxiter': 100})
        corrected = failed.copy()
        corrected[2] += result.x
        self.assertLess(np.linalg.norm(result.jac), 1e-6)
        self.assertLess(triangle_stretch(reference, corrected, self.faces).max(), 1.1)


if __name__ == '__main__':
    unittest.main()
