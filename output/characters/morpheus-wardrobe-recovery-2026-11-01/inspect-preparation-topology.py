"""Inspect the actual saved simulation meshes and their pinned contact gaps."""
from pathlib import Path
import json
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

base = Path(__file__).resolve().parent
rows = []
for name in ['preparation-physics', 'preparation-full-probe']:
    bpy.ops.wm.open_mainfile(filepath=str(base / name / 'preparation.blend'))
    cloth = next(obj for obj in bpy.data.objects if any(modifier.type == 'CLOTH' for modifier in obj.modifiers))
    collider = bpy.data.objects['actual animated preparation body']
    points = np.asarray([list(vertex.co) for vertex in cloth.data.vertices]) / 100
    faces = np.asarray([list(face.vertices) for face in cloth.data.polygons])
    area = np.linalg.norm(np.cross(points[faces[:, 1]] - points[faces[:, 0]], points[faces[:, 2]] - points[faces[:, 0]]), axis=1) / 2
    face_edges = {tuple(sorted((int(face[i]), int(face[(i + 1) % 3])))) for face in faces for i in range(3)}
    seams = [tuple(edge.vertices) for edge in cloth.data.edges if tuple(sorted(edge.vertices)) not in face_edges]
    lengths = np.asarray([np.linalg.norm(points[a] - points[b]) for a, b in seams])
    group = cloth.vertex_groups['complete worn-coat boundaries'].index
    fixed = [vertex.index for vertex in cloth.data.vertices if any(g.group == group and g.weight > .999 for g in vertex.groups)]
    tree = BVHTree.FromPolygons([vertex.co for vertex in collider.data.vertices],
        [list(face.vertices) for face in collider.data.polygons], all_triangles=True)
    gaps = [tree.find_nearest(cloth.data.vertices[i].co)[3] / 100 for i in fixed]
    row = dict(name=name, vertices=len(points), faces=len(faces), smallestAreaMetresSquared=float(area.min()),
        degenerateFaces=int(np.sum(area < 1e-16)), stitches=len(seams),
        shortestStitchMetres=float(lengths.min()), medianStitchMetres=float(np.median(lengths)), longestStitchMetres=float(lengths.max()),
        fixedPoints=len(fixed), minimumPinnedBodyGapMetres=min(gaps), pinsInsideCollisionMargin=sum(gap < .0005 for gap in gaps))
    rows.append(row); print(json.dumps(row), flush=True)
(base / 'preparation-topology-diagnosis.json').write_text(json.dumps(rows, indent=2))
