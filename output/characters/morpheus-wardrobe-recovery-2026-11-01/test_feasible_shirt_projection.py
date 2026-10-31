"""Test complete moving triangles and anchored obstacles, including tunnelling."""
from pathlib import Path
import sys
import unittest

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base.parents[1] / 'tools/ipctk-1.5.0'))
import numpy as np
import scipy.sparse as sparse
import ipctk
from feasible_shirt_projection import project, NoFeasibleFrame
from shirt_targets import transport_target

ipctk.set_num_threads(1)


class ShirtProjectionTest(unittest.TestCase):
    def setUp(self):
        self.start = np.array([[-.2, -.2, 1.], [.2, -.2, 1.], [0., .2, 1.],
            [-2., -2., 0.], [2., -2., 0.], [0., 2., 0.]])
        faces = np.array([[0, 1, 2], [3, 4, 5]], dtype=np.int32)
        self.mesh = ipctk.CollisionMesh(self.start, ipctk.edges(faces), faces)
        self.anchors = np.array([False] * 3 + [True] * 3)
        self.quadratic = sparse.diags(np.repeat([1.] * 3 + [1e10] * 3, 3), format='csc')

    def solve(self, start, target):
        return project(self.mesh, start, target, self.quadratic, self.anchors, 2e-4, 'test', lambda row: None)

    def test_clear_motion_retains_every_authored_coordinate(self):
        target = self.start + [0., 0., .1]
        value, report = self.solve(self.start, target)
        np.testing.assert_array_equal(value, target)
        self.assertFalse(ipctk.has_intersections(self.mesh, value))
        self.assertTrue(ipctk.is_step_collision_free(self.mesh, self.start, value))
        self.assertFalse(report['energyEquilibriumProven'])

    def test_clear_endpoints_do_not_allow_the_obstacle_to_tunnel_through_cloth(self):
        target = self.start.copy()
        target[3:, 2] = 2.
        self.assertFalse(ipctk.has_intersections(self.mesh, target))
        self.assertFalse(ipctk.is_step_collision_free(self.mesh, self.start, target))
        with self.assertRaises(NoFeasibleFrame):
            self.solve(self.start, target)

    def test_contact_moves_complete_cloth_without_moving_the_fixed_body(self):
        target = self.start.copy()
        target[3:, 2] = 1.0001
        # Approach the contact in continuous authored steps, as the actual
        # exporter does. A free triangle must remain above the rising body.
        current = self.start.copy()
        for fraction in [.5, .9, .99, .999, 1.]:
            goal = self.start + fraction * (target - self.start)
            corrected, _ = self.solve(current, goal)
            np.testing.assert_array_equal(corrected[self.anchors], goal[self.anchors])
            self.assertFalse(ipctk.has_intersections(self.mesh, corrected))
            self.assertTrue(ipctk.is_step_collision_free(self.mesh, current, corrected))
            current = corrected
        self.assertEqual(current.shape, self.start.shape)
        self.assertTrue(np.all(current[:3, 2] > target[3, 2]))

    def test_transported_contact_correction_does_not_snap_back_through_the_body(self):
        raw = self.start.copy()
        raw[3:, 2] = 2.
        before = raw.copy()
        before[:3, 2] = 2.01
        authored = raw.copy()
        authored[3:, 2] += .001
        self.assertFalse(ipctk.has_intersections(self.mesh, authored))
        self.assertFalse(ipctk.is_step_collision_free(self.mesh, before, authored))
        target = transport_target(before, raw, authored, 1.7, 1.7 + 1/60, self.anchors)
        value, _ = self.solve(before, target)
        np.testing.assert_array_equal(value[self.anchors], authored[self.anchors])
        np.testing.assert_array_equal(value[:3], before[:3])
        self.assertTrue(ipctk.is_step_collision_free(self.mesh, before, value))

    def test_recovery_removes_the_correction_continuously_and_restores_the_exact_end_pose(self):
        current = self.start.copy()
        current[:3, 2] += .01
        maximum_step = 0.
        for frame in range(193, 481):
            before_time, after_time = (frame - 1)/60, frame/60
            value = transport_target(current, self.start, self.start, before_time, after_time, self.anchors)
            self.assertTrue(ipctk.is_step_collision_free(self.mesh, current, value))
            maximum_step = max(maximum_step, float(np.linalg.norm(value - current, axis=1).max()))
            current = value
        np.testing.assert_array_equal(current, self.start)
        self.assertLess(maximum_step, .0001)


if __name__ == '__main__':
    unittest.main()
