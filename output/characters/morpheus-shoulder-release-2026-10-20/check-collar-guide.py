"""Validate the neckline path against the actual animated body before pinning it."""
import bpy
import json
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

base = Path(__file__).parent
guide = json.loads((base/'collar-guide.json').read_text())
source = base/guide['source']
data = json.loads((source/'manifest.json').read_text())
ids = {vertex:i for i,vertex in enumerate(guide['ids'])}
edges = [(ids[a],ids[b]) for arc in guide['arcs'] for a,b in zip(arc,arc[1:])]
faces = []
offset = 0
for part in data['bodies']:
    faces.extend((np.asarray(part['indices']).reshape(-1,3)+offset).tolist())
    offset += part['count']
rows = []
for frame in guide['frames']:
    body = np.fromfile(source/f"body-{frame['frame']}.bin",np.float32).reshape(-1,3)
    tree = BVHTree.FromPolygons(body.tolist(),faces,all_triangles=True)
    p = np.asarray(frame['points'])[:,[0,2,1]]*[.4,-.4,.4]
    crossing = []
    for a,b in edges:
        direction = Vector(p[b]-p[a]); length = direction.length
        hit,normal,index,distance = tree.ray_cast(Vector(p[a]),direction.normalized(),length)
        if hit is not None and 1e-7 < distance < length-1e-7:
            crossing.append([a,b,index,distance])
    clearance = min(tree.find_nearest(Vector(point))[3] for point in p)
    rows.append({'frame':frame['frame'],'time':frame['time'],'minimumVertexClearanceMetres':clearance,'crossings':crossing})
(base/'collar-clearance.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({'samples':len(rows),'minimumVertexClearanceMetres':min(row['minimumVertexClearanceMetres'] for row in rows),
                  'edgeCrossings':sum(len(row['crossings']) for row in rows)}))
assert all(not row['crossings'] for row in rows), 'neckline edge cuts through the body'
