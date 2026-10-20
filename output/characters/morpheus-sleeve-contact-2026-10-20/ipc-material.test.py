"""Check the actual energy derivatives before trusting cloth optimization."""
import unittest
import json
import numpy as np
import ipctk
from ipc_cloth import springs, BASE
from cloth_embedding import embed_panels

class MaterialTests(unittest.TestCase):
    def test_complete_display_embedding_preserves_rigid_motion(self):
        cage=json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
        display=json.loads((BASE/'input/manifest.json').read_text())
        mapping, report=embed_panels(cage,display)
        points=np.asarray(cage['points'])*.4
        visible=np.asarray(display['points'])*.4
        rotation=np.array([[np.cos(.7),0,np.sin(.7)],[0,1,0],[-np.sin(.7),0,np.cos(.7)]])
        displacement=points@rotation.T+[3.,-2.,7.]-points
        actual=visible+mapping@displacement
        # Authored controls were preserved through Blender float32 coordinates.
        # Their single physical owner retains that measured sub-micrometre offset.
        np.testing.assert_allclose(actual,visible@rotation.T+[3.,-2.,7.],atol=1e-7,rtol=0)
        self.assertLess(report['maximumAbsoluteWeight'],2.)
        self.assertEqual(mapping.shape,(13386,3005))

    def test_authored_cuffs_and_neck_are_independent_of_free_panels(self):
        cage=json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
        display=json.loads((BASE/'input/manifest.json').read_text())
        mapping, _=embed_panels(cage,display)
        displacement=np.random.default_rng(7).normal(0,.01,(3005,3))
        actual=mapping@displacement
        for source, owner in cage['mappedControls'].items():
            np.testing.assert_allclose(actual[int(source)],displacement[owner],atol=1e-12)

    def test_spring_derivatives_match_energy_differences(self):
        x=np.array([[0., 0., 0.], [1.1, .2, .1], [.1, 1.2, -.1]])
        edges=np.array([[0, 1], [1, 2], [2, 0]])
        rest=np.array([1., 1.5, 1.]); stiffness=np.array([15., 20., 30.])
        energy, gradient, hessian=springs(x, edges, rest, stiffness, project=False)
        for i in range(x.size):
            delta=np.zeros(x.size);delta[i]=1e-6;delta=delta.reshape(x.shape)
            high=springs(x+delta, edges, rest, stiffness, project=False)
            low=springs(x-delta, edges, rest, stiffness, project=False)
            self.assertAlmostEqual((high[0]-low[0])/2e-6, gradient[i], places=7)
            np.testing.assert_allclose((high[1]-low[1])/2e-6, hessian.toarray()[:, i], atol=1e-7)

    def test_ccd_catches_a_crossing_missed_by_endpoint_checks(self):
        start=np.array([[-1., -1., 0.], [1., -1., 0.], [0., 1., 0.], [-.1, -.1, 1.], [.1, -.1, 1.], [0., .1, 1.]])
        end=start.copy();end[3:, 2]=-1.
        faces=np.array([[0, 1, 2], [3, 4, 5]])
        mesh=ipctk.CollisionMesh(start,ipctk.edges(faces),faces)
        self.assertFalse(ipctk.has_intersections(mesh,start))
        self.assertFalse(ipctk.has_intersections(mesh,end))
        alpha=ipctk.compute_collision_free_stepsize(mesh,start,end)
        self.assertGreater(alpha,0)
        self.assertLess(alpha,.5)
        self.assertTrue(ipctk.is_step_collision_free(mesh,start,start+alpha*(end-start)))

if __name__ == '__main__':
    unittest.main()
