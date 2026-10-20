"""Independent reference cases for full-triangle deformation measurements."""
import unittest
import json
from pathlib import Path
import numpy as np
import surface_strain
from surface_strain import triangle_stretch


class SurfaceStrainTests(unittest.TestCase):
    def test_actual_failed_triangles_are_rejected_by_the_material_guard(self):
        fixtures = json.loads(Path(__file__).with_name('surface-strain-fixtures.json').read_text())
        for case in fixtures:
            with self.subTest(name=case['name']):
                result = triangle_stretch(np.asarray(case['reference']), np.asarray(case['deformed']),
                                          np.array([[0, 1, 2]]))
                self.assertFalse(surface_strain.material_within_limits(result))
        self.assertTrue(surface_strain.material_within_limits(np.ones((100, 2))))

    def setUp(self):
        self.points = np.array([[0., 0., 0.], [1., 0., 0.], [0., 1., 0.]])
        self.faces = np.array([[0, 1, 2]])

    def test_rigid_motion_preserves_both_material_directions(self):
        rotation = np.array([[0., 0., 1.], [1., 0., 0.], [0., 1., 0.]])
        result = triangle_stretch(self.points, self.points@rotation.T+[3., -4., 7.], self.faces)
        np.testing.assert_allclose(result, [[1., 1.]], atol=1e-12)

    def test_uniaxial_stretch_is_measured_in_the_material_frame(self):
        result = triangle_stretch(self.points, self.points*[2., 1., 1.], self.faces)
        np.testing.assert_allclose(result, [[1., 2.]], atol=1e-12)

    def test_shear_is_detected_even_when_one_edge_keeps_its_length(self):
        points = self.points.copy()
        points[2, 0] = 1.
        result = triangle_stretch(self.points, points, self.faces)
        np.testing.assert_allclose(result, [[(np.sqrt(5)-1)/2, (np.sqrt(5)+1)/2]], atol=1e-12)


if __name__ == '__main__':
    unittest.main()
