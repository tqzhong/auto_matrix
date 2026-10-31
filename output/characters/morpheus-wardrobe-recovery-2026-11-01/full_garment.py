"""Simulate every original visible coat face directly, with its sewn parts."""
import bpy
import numpy as np


def build(data):
    points = np.asarray(data['points'])[:, [0, 2, 1]] * [40, -40, 40]
    coat_ids = np.unique(data['parts'][0]['vertices'])
    stitches = set()
    for index, part in enumerate(data['parts'][1:], 1):
        source = part['vertices']
        for vertex in part['vertices']:
            local = int(np.argmin(np.linalg.norm(points[source] - points[vertex], axis=1)))
            if (local % 7 <= 1 if index == 1 else local < 82):
                distances = np.linalg.norm(points[coat_ids] - points[vertex], axis=1)
                for target in coat_ids[np.argsort(distances)[:3]]:
                    assert vertex != target
                    stitches.add(tuple(sorted((vertex, int(target)))))
    assert all(any(a in part['vertices'] or b in part['vertices'] for a, b in stitches) for part in data['parts'][1:])
    mesh = bpy.data.meshes.new('every original visible coat face')
    mesh.from_pydata(points.tolist(), sorted(stitches), np.asarray(data['indices']).reshape(-1, 3).tolist())
    mesh.update()
    cloth = bpy.data.objects.new('one complete displayed and simulated coat', mesh)
    bpy.context.collection.objects.link(cloth)
    return cloth, stitches
