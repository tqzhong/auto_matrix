"""Check the actual candidate material against the complete visible garment."""
import ast
import json
import os
from pathlib import Path
from types import FunctionType
import unittest
import numpy as np
import scipy.sparse as sp
import ipc_cloth as cloth
from cloth_embedding import embed_panels
from embedded_membrane import embedded_membrane
from membrane import prepare_membrane, membrane_energy


class EmbeddedMaterialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base = Path(__file__).resolve().parent
        source = base/os.environ.get('MATERIAL_SOURCE', 'ipc_cloth.py')
        cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
        display = json.loads((base/'input/manifest.json').read_text())
        points, faces, edges, rest, stiffness, mass, pins, path, body, _, count = cloth.prepare(False)
        shown, display_faces, fine_edges, fine_rest, fine_stiffness, *_rest = cloth.prepare(True)
        fine_count = _rest[-1]
        embedding, _ = embed_panels(cage, display)
        dofs = sp.kron(embedding, sp.eye(3), format='csr')
        context = {**vars(cloth), 'n': len(points), 'points': points, 'edges': edges,
            'rest': rest, 'stiffness': stiffness, 'structural_count': count,
            'shown': shown, 'display_faces': display_faces,
            'membrane_rest': prepare_membrane(shown, display_faces),
            'embedding': embedding, 'membrane_dofs': dofs,
            'embedded_membrane': embedded_membrane, 'fine_edges': fine_edges,
            'fine_rest': fine_rest, 'fine_stiffness': fine_stiffness,
            'fine_structural_count': fine_count}
        tree = ast.parse(source.read_text())
        bake = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'bake')
        material = next(node for node in bake.body if isinstance(node, ast.FunctionDef) and node.name == 'material')
        exec(compile(ast.Module(body=[material], type_ignores=[]), str(source), 'exec'), context)
        cls.context = context
        cls.material = staticmethod(context['material'])
        fixture = np.load(base/'embedded-material-failure-fixture.npz')
        cls.failed = fixture['positions']
        cls.failed_mapping = sp.csr_matrix((fixture['mapping_data'], fixture['mapping_indices'],
            fixture['mapping_indptr']), shape=tuple(fixture['mapping_shape']))

    def test_actual_rejected_visible_edge_cannot_have_finite_material_energy(self):
        # Keep the failed visible surface fixed when improving the binding;
        # applying new weights to old control positions changes the test case.
        context = {**self.context, 'embedding': self.failed_mapping,
                   'membrane_dofs': sp.kron(self.failed_mapping, sp.eye(3), format='csr')}
        material = FunctionType(self.material.__code__, context, argdefs=self.material.__defaults__)
        for derivatives in (True, False):
            with self.subTest(derivatives=derivatives):
                with self.assertRaises(cloth.ClothStepError):
                    material(self.failed, derivatives=derivatives)

    def test_material_and_virtual_work_include_all_visible_seams_and_bending(self):
        c = self.context
        points = c['points']
        state = points+points@np.diag([.006, -.003, .002])
        visible = c['shown']+c['embedding']@(state-points)
        for project in (False, True):
            expected = cloth.springs(visible, c['fine_edges'], c['fine_rest'], c['fine_stiffness'],
                strain_count=c['fine_structural_count'], structural_elastic=False, project=project)
            membrane = membrane_energy(visible, c['display_faces'], c['membrane_rest'], project=project)
            energy, gradient, hessian = self.material(state, project=project)
            self.assertAlmostEqual(energy, expected[0]+membrane[0], delta=1e-10)
            self.assertEqual(energy, self.material(state, project=project, derivatives=False))
            direction = np.random.default_rng(7).normal(size=points.shape)
            visible_direction = (c['embedding']@direction).ravel()
            np.testing.assert_allclose(gradient@direction.ravel(),
                (expected[1]+membrane[1])@visible_direction, rtol=1e-10, atol=1e-8)
            np.testing.assert_allclose(direction.ravel()@(hessian@direction.ravel()),
                visible_direction@((expected[2]+membrane[2])@visible_direction), rtol=1e-10, atol=1e-5)

    def test_identity_mode_preserves_the_full_surface_material(self):
        c = self.context
        n = len(c['shown'])
        full = {**c, 'n': n, 'points': c['shown'], 'embedding': sp.eye(n, format='csr'),
                'membrane_dofs': sp.eye(3*n, format='csr')}
        material = FunctionType(self.material.__code__, full, argdefs=self.material.__defaults__)
        state = c['shown']@np.diag([1.06, .98, 1.01])
        for project in (False, True):
            expected = cloth.springs(state, c['fine_edges'], c['fine_rest'], c['fine_stiffness'],
                strain_count=c['fine_structural_count'], structural_elastic=False, project=project)
            membrane = membrane_energy(state, c['display_faces'], c['membrane_rest'], project=project)
            actual = material(state, project=project)
            np.testing.assert_allclose(actual[0], expected[0]+membrane[0], rtol=1e-12)
            np.testing.assert_allclose(actual[1], expected[1]+membrane[1], atol=1e-8, rtol=1e-9)
            difference = actual[2]-(expected[2]+membrane[2])
            self.assertLess(np.max(np.abs(difference.data), initial=0), 1e-6)


if __name__ == '__main__':
    unittest.main()
