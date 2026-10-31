"""Refine only cage faces that cut the real body; retain every boundary control."""
import json
import sys
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

base = Path(__file__).parent
iteration = int(sys.argv[sys.argv.index('--')+1])
source = 'boundary-cage-rest.json' if iteration == 1 else f'boundary-cage-fit-{iteration-1}.json'
cage = json.loads((base/source).read_text())
contacts = json.loads((base/('boundary-cage-rest-contacts.json' if iteration == 1 else f'boundary-cage-fit-{iteration-1}-contacts.json')).read_text())
data = json.loads((base/'current-input/manifest.json').read_text())
points = [Vector(p) for p in cage['points']]
faces = np.asarray(cage['indices']).reshape(-1,3).tolist()
protected = set(cage['mappedControls'].values())
owner = {i:part for part,region in enumerate(cage['parts']) for i in region['vertices']}
trees = [BVHTree.FromPolygons(surface['vertices'],np.asarray(surface['indices']).reshape(-1,3).tolist(),all_triangles=True)
         for surface in data['surfaces']]
original = [p.copy() for p in points]
for i,p in enumerate(points):
    if i not in protected:
        points[i] = trees[owner[i]].find_nearest(p)[0]
edges = set()
for face in {pair['envelope'] for pair in contacts['body']}:
    a,b,c = faces[face]
    for i,j in [(a,b),(b,c),(c,a)]:
        if not (i in protected and j in protected):
            edges.add(tuple(sorted((i,j))))
mid = {}
for i,j in sorted(edges):
    assert owner[i] == owner[j]
    part = owner[i]
    midpoint = trees[part].find_nearest((points[i]+points[j])*.5)[0]
    vertex = len(points)
    mid[(i,j)] = vertex
    points.append(midpoint)
    owner[vertex] = part
    cage['parts'][part]['vertices'].append(vertex)
triangles = []
for a,b,c in faces:
    ab,bc,ca = [mid.get(tuple(sorted(edge))) for edge in [(a,b),(b,c),(c,a)]]
    count = sum(value is not None for value in [ab,bc,ca])
    if count == 0:
        triangles.append([a,b,c])
    elif count == 3:
        triangles.extend([[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])
    else:
        vertices,halves = [a,b,c],[ab,bc,ca]
        # Rotate the triangle so the one split edge (one split), or the
        # corner between the two split edges (two splits), is first.
        k = next(i for i in range(3) if (halves[i] is not None and count == 1)
                 or (count == 2 and halves[i] is not None and halves[(i+2)%3] is not None))
        a,b,c = vertices[k:]+vertices[:k]
        ab,bc,ca = halves[k:]+halves[:k]
        if count == 1:
            triangles.extend([[a,ab,c],[ab,b,c]])
        else:
            triangles.extend([[a,ab,ca],[ab,b,c],[ab,c,ca]])
assert all((points[i]-original[i]).length == 0 for i in protected)
cage['points'] = [list(p) for p in points]
cage['indices'] = [i for face in triangles for i in face]
cage['metadata'] = {'iteration':iteration,'vertices':len(points),'faces':len(triangles),
                    'addedVertices':len(mid),'protected':len(protected),
                    'scope':'Contact-directed refinement of the simulation cage; original display mesh unchanged.'}
(base/f'boundary-cage-fit-{iteration}.json').write_text(json.dumps(cage))
print(json.dumps(cage['metadata']),flush=True)
