"""Check contact coverage and the measured complete costume's rest forces."""
import unittest
import numpy as np
import scipy.sparse as sp
import ipctk
from ipc_cloth import prepare, prescribed_response, CONTACT_ACTIVATION
from contact_bands import contact_bands, SELF_ACTIVATION, BODY_ACTIVATION


class ContactBandTests(unittest.TestCase):
    def setUp(self):
        ipctk.set_num_threads(2)
        triangle = np.array([[-.002, -.002, 0.], [.002, -.002, 0.], [0., .002, 0.]])
        self.points = np.vstack((triangle, triangle+[0, 0, .000005],
                                 triangle+[0, 0, .00015]))
        self.faces = np.arange(9, dtype=np.int32).reshape(-1, 3)
        self.edges = ipctk.edges(self.faces)
        self.mapping = sp.eye(9, format='csc')
        self.mesh = ipctk.CollisionMesh(self.points, self.edges, self.faces)
        self.mesh.can_collide = ipctk.make_static_obstacle_filter(6)
        self.bands = contact_bands(self.points, self.edges, self.faces, self.mapping, 6)

    def test_bands_partition_all_original_pairs(self):
        for i in range(9):
            for j in range(i+1, 9):
                self.assertEqual(sum(mesh.can_collide(i, j) for mesh, _ in self.bands),
                                 int(self.mesh.can_collide(i, j)))

    def test_equal_radii_recover_original_contact_energy_and_derivatives(self):
        potential = ipctk.BarrierPotential(BODY_ACTIVATION, 1e10)
        original = ipctk.NormalCollisions()
        original.build(self.mesh, self.points, BODY_ACTIVATION)
        energy = 0.
        gradient = np.zeros(self.points.size)
        hessian = sp.csr_matrix((self.points.size, self.points.size))
        for mesh, _ in self.bands:
            contacts = ipctk.NormalCollisions()
            contacts.build(mesh, self.points, BODY_ACTIVATION)
            energy += potential(contacts, mesh, self.points)
            gradient += potential.gradient(contacts, mesh, self.points)
            hessian += potential.hessian(contacts, mesh, self.points)
        self.assertAlmostEqual(energy, potential(original, self.mesh, self.points), places=12)
        np.testing.assert_allclose(gradient, potential.gradient(original, self.mesh, self.points), atol=1e-10)
        np.testing.assert_allclose(hessian.toarray(), potential.hessian(original, self.mesh, self.points).toarray(),
                                   atol=1e-7, rtol=1e-12)

    def test_body_contact_responds_before_reaching_tiny_self_contact_radius(self):
        points = self.points[3:].copy()
        faces = np.arange(6, dtype=np.int32).reshape(-1, 3)
        edges = ipctk.edges(faces)
        old = ipctk.CollisionMesh(points, edges, faces)
        old.can_collide = ipctk.make_static_obstacle_filter(3)
        contacts = ipctk.NormalCollisions()
        contacts.build(old, points, CONTACT_ACTIVATION)
        self.assertEqual(len(contacts), 0, 'the current narrow band cannot anticipate this body motion')
        body, radius = contact_bands(points, edges, faces, sp.eye(6, format='csc'), 3)[1]
        contacts.build(body, points, radius)
        self.assertGreater(len(contacts), 0)
        potential = ipctk.BarrierPotential(radius, 1e10)
        gradient = potential.gradient(contacts, body, points)
        hessian = potential.hessian(contacts, body, points, project_hessian_to_psd=ipctk.PSDProjectionMethod.CLAMP)
        hessian += sp.diags(np.r_[np.full(9, 100.), np.zeros(9)], format='csr')
        fixed = np.zeros_like(points)
        fixed[3:, 2] = -.00005
        direction = prescribed_response(gradient, hessian, np.arange(9), fixed)
        self.assertLess(float(direction[:3, 2].max()), 0., 'the garment responds before the body hits it')
        self.assertTrue(ipctk.is_step_collision_free(old, points, points+direction))
        np.testing.assert_array_equal(direction[3:], fixed[3:])

    def test_complete_costume_has_no_added_rest_repulsion(self):
        points, faces, _, _, _, _, _, _, body, all_faces, _ = prepare(True)
        reference = np.vstack((points, body[0]))
        bands = contact_bands(reference, ipctk.edges(all_faces), all_faces,
                              sp.eye(len(reference), format='csc'), len(points))
        self.assertEqual([radius for _, radius in bands], [SELF_ACTIVATION, BODY_ACTIVATION])
        for mesh, radius in bands:
            contacts = ipctk.NormalCollisions()
            contacts.build(mesh, reference, radius)
            self.assertEqual(len(contacts), 0)
            self.assertEqual(ipctk.BarrierPotential(radius, 1.)(contacts, mesh, reference), 0.)


if __name__ == '__main__':
    unittest.main()
