"""Energy-only evaluations must keep every material and strain-limit decision."""
import unittest
import numpy as np
from ipc_cloth import springs, ClothStepError
from membrane import prepare_membrane, membrane_energy


class EnergyOnlyTests(unittest.TestCase):
    def test_energy_matches_full_derivatives_in_both_material_modes(self):
        reference = np.array([[0., 0., 0.], [.3, 0., 0.], [.1, .2, .01]])
        edges = np.array([[0, 1], [1, 2], [2, 0]])
        rest = np.linalg.norm(reference[edges[:, 0]]-reference[edges[:, 1]], axis=1)
        stiffness = np.array([120., 140., .03])
        faces = np.array([[0, 1, 2]])
        membrane_rest = prepare_membrane(reference, faces)
        for scale in (.97, 1., 1.025, 1.06, 1.099):
            points = reference*scale+[3., -2., 1.]
            for elastic in (True, False):
                for project in (True, False):
                    with self.subTest(scale=scale, elastic=elastic, project=project):
                        full = springs(points, edges, rest, stiffness, project=project,
                                       strain_count=2, structural_elastic=elastic)[0]
                        only = springs(points, edges, rest, stiffness, project=project,
                                       strain_count=2, structural_elastic=elastic,
                                       derivatives=False)
                        self.assertEqual(only, full)
                        membrane = membrane_energy(points, faces, membrane_rest, project=project)[0]
                        membrane_only = membrane_energy(points, faces, membrane_rest,
                                                        project=project, derivatives=False)
                        self.assertEqual(membrane_only, membrane)
                        self.assertEqual(only+membrane_only, full+membrane)

    def test_energy_only_still_rejects_overextended_structural_edges(self):
        for elastic in (True, False):
            with self.subTest(elastic=elastic):
                with self.assertRaises(ClothStepError):
                    springs(np.array([[0., 0., 0.], [.331, 0., 0.]]),
                            np.array([[0, 1]]), np.array([.3]), np.array([120.]),
                            strain_count=1, structural_elastic=elastic, derivatives=False)


if __name__ == '__main__':
    unittest.main()
