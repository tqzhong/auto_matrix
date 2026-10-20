"""Validate the neckline path against the actual animated body before pinning it."""
import bpy
import json
import sys
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

base = Path(__file__).parent
if '--' in sys.argv:
    base = Path(sys.argv[sys.argv.index('--')+1])
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
def samples():
    for index,frame in enumerate(guide['frames']):
        body = np.fromfile(source/f"body-{frame['frame']}.bin",np.float32).reshape(-1,3)
        yield frame,body
        if '--dense' in sys.argv and index+1 < len(guide['frames']):
            following = guide['frames'][index+1]
            next_body = np.fromfile(source/f"body-{following['frame']}.bin",np.float32).reshape(-1,3)
            current_points,next_points = np.asarray(frame['points']),np.asarray(following['points'])
            for alpha in [.25,.5,.75]:
                yield {'frame':frame['frame']+alpha,'time':frame['time']+(following['time']-frame['time'])*alpha,
                       'points':current_points+(next_points-current_points)*alpha},body+(next_body-body)*alpha

rows = []
for frame,body in samples():
    tree = BVHTree.FromPolygons(body.tolist(),faces,all_triangles=True)
    p = np.asarray(frame['points'])[:,[0,2,1]]*[.4,-.4,.4]
    crossing = []
    edge_clearance = float('inf')
    for a,b in edges:
        direction = Vector(p[b]-p[a]); length = direction.length
        hit,normal,index,distance = tree.ray_cast(Vector(p[a]),direction.normalized(),length)
        if hit is not None and 1e-7 < distance < length-1e-7:
            crossing.append([a,b,index,distance])
        steps = max(1,int(np.ceil(length/.0005)))
        distances = [tree.find_nearest(Vector(p[a]+(p[b]-p[a])*i/steps))[3] for i in range(steps+1)]
        # Distance to a surface is 1-Lipschitz. Subtract half the spacing
        # to bound every point between samples, including the edge interior.
        edge_clearance = min(edge_clearance,min(distances)-length/steps/2)
    clearance = min(tree.find_nearest(Vector(point))[3] for point in p)
    rows.append({'frame':frame['frame'],'time':frame['time'],'minimumVertexClearanceMetres':clearance,
                 'minimumEdgeClearanceMetres':edge_clearance,'crossings':crossing})
name = 'collar-clearance-dense.json' if '--dense' in sys.argv else 'collar-clearance.json'
(base/name).write_text(json.dumps(rows,indent=2))
print(json.dumps({'samples':len(rows),'minimumVertexClearanceMetres':min(row['minimumVertexClearanceMetres'] for row in rows),
                  'minimumEdgeClearanceMetres':min(row['minimumEdgeClearanceMetres'] for row in rows),
                  'edgeCrossings':sum(len(row['crossings']) for row in rows)}))
assert all(not row['crossings'] for row in rows), 'neckline edge cuts through the body'
assert min(row['minimumEdgeClearanceMetres'] for row in rows) >= .0035, 'pinned neckline leaves less than the combined 3.5 mm collision margin'
