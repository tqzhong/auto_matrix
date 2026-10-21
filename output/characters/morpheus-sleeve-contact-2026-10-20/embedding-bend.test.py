"""A smooth, small garment bend must not create false tears between samples."""
import importlib
import json
import os
from pathlib import Path
import unittest
import numpy as np
import ipctk
from surface_strain import triangle_stretch


class EmbeddingBendTests(unittest.TestCase):
    def test_smooth_lateral_bend_keeps_the_complete_display_within_material_limits(self):
        base = Path(__file__).resolve().parent
        cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
        # Retain the actual rest geometry without requiring the large local
        # body-animation export to reproduce this binding failure.
        fixture = np.load(base/'embedding-bend-fixture.npz')
        display = {'points': fixture['points'], 'indices': fixture['indices'],
                   'parts': [{'vertices': fixture[f'part_{i}']} for i in range(len(cage['parts']))]}
        embedding = importlib.import_module(os.environ.get('EMBEDDING_MODULE', 'cloth_embedding'))
        mapping, _ = embedding.embed_panels(cage, display)
        physical, visible = np.asarray(cage['points'])*.4, np.asarray(display['points'])*.4
        faces = np.asarray(display['indices']).reshape(-1, 3)
        edges = ipctk.edges(faces)
        rest = np.linalg.norm(visible[edges[:, 0]]-visible[edges[:, 1]], axis=1)
        # A 15 mm lateral bend. Its displacement gradient is at most 0.12,
        # the directly sampled triangles remain below 1.07 stretch.
        cases = []
        for axis in (0, 2):
            motion = np.zeros_like(physical)
            motion[:, axis] = .015*np.sin(8*physical[:, 1])
            exact = visible.copy(); exact[:, axis] += .015*np.sin(8*visible[:, 1])
            cases.append((f'bend-{axis}', motion, exact))
        def twist(points):
            angle = .08*np.sin(4*points[:, 1])
            result = points.copy()
            result[:, 0] = np.cos(angle)*points[:, 0]-np.sin(angle)*points[:, 2]
            result[:, 2] = np.sin(angle)*points[:, 0]+np.cos(angle)*points[:, 2]
            return result
        cases.append(('twist', twist(physical)-physical, twist(visible)))
        for name, motion, exact in cases:
            with self.subTest(motion=name):
                self.assertLess(triangle_stretch(visible, exact, faces).max(), 1.07)
                actual = visible+mapping@motion
                lengths = np.linalg.norm(actual[edges[:, 0]]-actual[edges[:, 1]], axis=1)/rest
                self.assertLess(lengths.max(), 1.1, 'binding creates edge stretching absent from the authored bend')
                self.assertLess(triangle_stretch(visible, actual, faces).max(), 1.1,
                                'binding creates triangle shear absent from the authored bend')


if __name__ == '__main__':
    unittest.main()
