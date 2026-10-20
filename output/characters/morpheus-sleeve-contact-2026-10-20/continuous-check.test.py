"""Distinguish real inter-frame crossings from reduced positive clearance."""
import unittest
import json
from pathlib import Path
import numpy as np
import ipctk
from continuous_check import measure_step


class ContinuousChecks(unittest.TestCase):
    def test_actual_coat_and_shirt_intervals(self):
        fixtures = json.loads(Path(__file__).with_name('contact-fixtures.json').read_text())
        for fixture in fixtures:
            with self.subTest(fixture=fixture['name']):
                start, end = np.asarray(fixture['start']), np.asarray(fixture['end'])
                mesh = ipctk.CollisionMesh(start, np.array([[0, 1], [2, 3]]), np.empty((0, 3), dtype=np.int32))
                result = measure_step(mesh, start, end)
                self.assertEqual(result['stepCollisionFree'], fixture['collisionFree'])

    def setUp(self):
        self.start = np.array([[-1., -1., 0.], [1., -1., 0.], [0., 1., 0.],
                               [-.1, -.1, .001], [.1, -.1, .001], [0., .1, .001]])
        faces = np.array([[0, 1, 2], [3, 4, 5]])
        self.mesh = ipctk.CollisionMesh(self.start, ipctk.edges(faces), faces)

    def test_smaller_positive_gap_is_not_a_geometric_crossing(self):
        end = self.start.copy()
        end[3:, 2] = .00005
        # Tilt both parallel surfaces so their axis-aligned boxes overlap.
        # Otherwise broad-phase filtering hides the narrow-phase distinction.
        rotation = np.array([[1., 0., 0.], [0., np.cos(.7), -np.sin(.7)],
                             [0., np.sin(.7), np.cos(.7)]])
        start, end = self.start@rotation.T, end@rotation.T
        faces = np.array([[0, 1, 2], [3, 4, 5]])
        mesh = ipctk.CollisionMesh(start, ipctk.edges(faces), faces)
        result = measure_step(mesh, start, end)
        self.assertFalse(result['endpointIntersects'])
        self.assertTrue(result['stepCollisionFree'])
        self.assertEqual(result['collisionFreeStep'], 1.)

    def test_crossing_with_clear_endpoints_is_rejected(self):
        end = self.start.copy()
        end[3:, 2] = -.001
        result = measure_step(self.mesh, self.start, end)
        self.assertFalse(result['endpointIntersects'])
        self.assertFalse(result['stepCollisionFree'])
        self.assertLess(result['collisionFreeStep'], 1.)

    def test_contact_exactly_at_the_endpoint_is_rejected(self):
        end = self.start.copy()
        end[3:, 2] = 0.
        result = measure_step(self.mesh, self.start, end)
        self.assertFalse(result['stepCollisionFree'])


if __name__ == '__main__':
    unittest.main()
