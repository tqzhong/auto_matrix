"""Measure strain on the complete displayed triangles, not only cage edges."""
import json
import sys
from pathlib import Path
import numpy as np


def triangle_stretch(reference, points, faces):
    first = reference[faces[:, 1]]-reference[faces[:, 0]]
    second = reference[faces[:, 2]]-reference[faces[:, 0]]
    length = np.linalg.norm(first, axis=1)
    assert np.all(length > 0), 'rest surface has a collapsed triangle edge'
    tangent = first/length[:, None]
    along = np.sum(second*tangent, axis=1)
    height = np.linalg.norm(second-tangent*along[:, None], axis=1)
    assert np.all(height > 0), 'rest surface has a degenerate triangle'
    a = (points[faces[:, 1]]-points[faces[:, 0]])/length[:, None]
    b = (points[faces[:, 2]]-points[faces[:, 0]]-a*along[:, None])/height[:, None]
    aa, ab, bb = np.sum(a*a, axis=1), np.sum(a*b, axis=1), np.sum(b*b, axis=1)
    gram = np.stack((np.stack((aa, ab), axis=1), np.stack((ab, bb), axis=1)), axis=1)
    return np.sqrt(np.maximum(0, np.linalg.eigvalsh(gram)))


def material_within_limits(stretch):
    return bool(np.max(stretch) < 1.5 and np.quantile(stretch[:, 1], .99) < 1.2)


def audit(folder, partial=False):
    base = Path(__file__).parent
    data = json.loads((base/'input/manifest.json').read_text())
    reference = np.asarray(data['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
    faces = np.asarray(data['indices']).reshape(-1, 3)
    assert len(reference) == 13386 and len(faces) == 25796
    frames = json.loads((folder/('progress.json' if partial else 'summary.json')).read_text())
    rows = []
    for frame in frames:
        points = np.fromfile(folder/f'cloth-{frame["frame"]}.bin', np.float32).reshape(-1, 3).astype(float)
        assert points.shape == reference.shape
        stretch = triangle_stretch(reference, points, faces)
        row = {'frame': frame['frame'], 'time': frame['time'], 'triangles': len(faces),
               'minimum': float(stretch.min()), 'maximum': float(stretch.max()),
               'p99': float(np.quantile(stretch[:, 1], .99)),
               'worstTriangle': int(np.argmax(stretch[:, 1])),
               'withinMaterialLimits': material_within_limits(stretch)}
        rows.append(row)
        print(json.dumps(row), flush=True)
    name = ('partial-' if partial else '')+'surface-strain-results.json'
    (folder/name).write_text(json.dumps(rows, indent=2)+'\n')
    # Preserve the existing authoring limits, now applied to the rendered cloth.
    # They are not a calibrated leather material specification.
    assert all(row['withinMaterialLimits'] for row in rows), 'the rendered cloth stretches out of shape'
    return rows


if __name__ == '__main__':
    audit(Path(__file__).parent/sys.argv[1], '--partial' in sys.argv)
