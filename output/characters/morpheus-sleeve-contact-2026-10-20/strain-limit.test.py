"""Verify the material limit and optimizer steps, independently of contact."""
import unittest
import numpy as np
import ipctk
import ipc_cloth as cloth


class StrainLimitTests(unittest.TestCase):
    def test_unstrained_complete_surface_has_no_artificial_contact_force(self):
        points, _, _, _, _, _, _, _, body, faces, _ = cloth.prepare(full_surface=True)
        positions = np.vstack((points, body[0]))
        mesh = ipctk.CollisionMesh(positions, ipctk.edges(faces), faces)
        mesh.can_collide = ipctk.make_static_obstacle_filter(len(points))
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, positions, cloth.CONTACT_ACTIVATION)
        potential = ipctk.BarrierPotential(cloth.CONTACT_ACTIVATION, 1.)
        self.assertEqual(potential(contacts, mesh, positions), 0.)
        self.assertEqual(np.linalg.norm(potential.gradient(contacts, mesh, positions)), 0.)

    def test_limit_preserves_unstretched_material_and_matches_derivatives(self):
        edges = np.array([[0, 1]])
        rest = np.array([.3])
        stiffness = np.array([120.])
        quiet = np.array([[0., 0., 0.], [.306, 0., 0.]])
        before = cloth.springs(quiet, edges, rest, stiffness, project=False)
        after = cloth.springs(quiet, edges, rest, stiffness, project=False, strain_count=1)
        self.assertEqual(before[0], after[0])
        np.testing.assert_array_equal(before[1], after[1])
        np.testing.assert_array_equal(before[2].toarray(), after[2].toarray())

        x = np.array([[0., 0., 0.], [.319, .008, -.012]])
        energy, gradient, hessian = cloth.springs(x, edges, rest, stiffness,
                                                project=False, strain_count=1)
        self.assertGreater(energy, cloth.springs(x, edges, rest, stiffness)[0])
        for i in range(x.size):
            delta = np.zeros(x.size)
            delta[i] = 1e-7
            delta = delta.reshape(x.shape)
            high = cloth.springs(x+delta, edges, rest, stiffness, project=False, strain_count=1)
            low = cloth.springs(x-delta, edges, rest, stiffness, project=False, strain_count=1)
            self.assertAlmostEqual((high[0]-low[0])/2e-7, gradient[i], places=6)
            np.testing.assert_allclose((high[1]-low[1])/2e-7,
                                       hessian.toarray()[:, i], atol=2e-5, rtol=1e-7)

    def test_overextended_cloth_cannot_be_accepted_as_finite_energy(self):
        x = np.array([[0., 0., 0.], [.331, 0., 0.]])
        for structural_elastic in (True, False):
            with self.subTest(structural_elastic=structural_elastic):
                with self.assertRaises(cloth.ClothStepError):
                    cloth.springs(x, np.array([[0, 1]]), np.array([.3]),
                                  np.array([120.]), strain_count=1,
                                  structural_elastic=structural_elastic)

    def test_step_limits_stretch_including_prescribed_boundary_motion(self):
        x = np.array([[0., 0., 0.], [.3, 0., 0.]])
        edges, rest = np.array([[0, 1]]), np.array([.3])
        for direction in (
            np.array([[0., 0., 0.], [.2, 0., 0.]]),
            np.array([[0., 0., 0.], [0., .2, 0.]]),
            np.array([[-.1, .04, 0.], [.1, -.02, 0.]]),
        ):
            alpha = cloth.strain_free_stepsize(x, direction, edges, rest)
            self.assertGreater(alpha, 0.)
            self.assertLess(alpha, 1.)
            for amount in np.linspace(0., alpha, 21):
                end = x+amount*direction
                self.assertLess(np.linalg.norm(end[1]-end[0])/rest[0], 1.1)
        translation = np.tile([3., -2., 1.], (2, 1))
        self.assertEqual(cloth.strain_free_stepsize(x, translation, edges, rest), 1.)
        compression = np.array([[0., 0., 0.], [-.1, 0., 0.]])
        self.assertEqual(cloth.strain_free_stepsize(x, compression, edges, rest), 1.)


if __name__ == '__main__':
    unittest.main()
