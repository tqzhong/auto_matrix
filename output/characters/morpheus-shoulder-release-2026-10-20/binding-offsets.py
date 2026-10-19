"""Measure how far real display details sit inside or outside the fitted cage."""
import json
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

base = Path(__file__).parent
cage = json.loads((base/'cage-fit-4.json').read_text())
data = json.loads((base.parent/'morpheus-withdrawal-path-2026-10-20/clearance-input/manifest.json').read_text())
faces = np.asarray(cage['indices']).reshape(-1,3)
rows = []
for part,original in zip(cage['parts'],data['parts']):
    ids = set(part['vertices'])
    triangles = [face.tolist() for face in faces if int(face[0]) in ids]
    tree = BVHTree.FromPolygons(cage['points'],triangles,all_triangles=True)
    signed = []
    for vertex in set(original['vertices']):
        point = Vector(data['points'][vertex])
        hit,normal,index,distance = tree.find_nearest(point)
        signed.append((point-hit).dot(normal)*.4)
    rows.append({'name':part['name'],'maximumInwardMetres':max(0,-min(signed)),
                 'maximumOutwardMetres':max(signed),'signedQuantilesMetres':np.quantile(signed,[0,.01,.5,.99,1]).tolist()})
(base/'binding-offsets.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows),flush=True)
