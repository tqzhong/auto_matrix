"""Build one sewn simulation garment and its unchanged full displayed surface."""
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'scripts'))
from cloth_display import bind_display_to_cage


def build(data, cage):
    displayed = np.asarray(data['points'])[:, [0, 2, 1]] * [40, -40, 40]
    points = np.asarray(cage['points'])[:, [0, 2, 1]] * [40, -40, 40]
    mesh = bpy.data.meshes.new('complete original displayed coat')
    mesh.from_pydata(displayed.tolist(), [], np.asarray(data['indices']).reshape(-1, 3).tolist())
    mesh.update()
    display = bpy.data.objects.new('complete original displayed coat', mesh)
    bpy.context.collection.objects.link(display)
    stitches = set()
    coat_ids = np.unique(cage['parts'][0]['vertices'])
    for index, part in enumerate(cage['parts'][1:], 1):
        source = data['parts'][index]['vertices']
        for vertex in part['vertices']:
            local = int(np.argmin(np.linalg.norm(displayed[source] - points[vertex], axis=1)))
            seam = local % 7 <= 1 if index == 1 else local < 82
            if seam:
                distances = np.linalg.norm(points[coat_ids] - points[vertex], axis=1)
                for target in coat_ids[np.argsort(distances)[:3]]:
                    assert vertex != target
                    stitches.add(tuple(sorted((vertex, int(target)))))
    assert all(any(a in part['vertices'] or b in part['vertices'] for a, b in stitches)
        for part in cage['parts'][1:])
    mesh = bpy.data.meshes.new('sewn physical coat')
    mesh.from_pydata(points.tolist(), sorted(stitches), np.asarray(cage['indices']).reshape(-1, 3).tolist())
    mesh.update()
    cloth = bpy.data.objects.new('sewn physical coat', mesh)
    bpy.context.collection.objects.link(cloth)
    bind_display_to_cage(display, cloth)
    return cloth, display, stitches
