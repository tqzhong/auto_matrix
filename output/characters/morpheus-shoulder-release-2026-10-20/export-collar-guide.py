"""Unbend the actual open neckline by rotating its edges, not stretching them."""
import json
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np

base = Path(__file__).parent
source = base.parent / 'morpheus-withdrawal-path-2026-10-20/clearance-input'
data = json.loads((source / 'manifest.json').read_text())
points = np.asarray(data['points'], dtype=float)
faces = np.asarray(data['indices'][:len(data['surfaces'][0]['indices'])]).reshape(-1, 3)
counts = Counter(tuple(sorted((int(a), int(b)))) for face in faces for a,b in zip(face,np.roll(face,-1)))
graph = defaultdict(list)
for (a,b), count in counts.items():
    if count == 1:
        graph[a].append(b)
        graph[b].append(a)
assert all(len(neighbors) == 2 for neighbors in graph.values())
rear = min((i for i in graph if points[i,1] > 3.82), key=lambda i: abs(points[i,0]))
assert abs(points[rear,0]) < 1e-6 and points[rear,2] < 0
arcs = []
for neighbor in graph[rear]:
    arc = [rear,neighbor]
    while True:
        following = next(i for i in graph[arc[-1]] if i != arc[-2])
        if points[following,1] < 3.82:
            break
        assert following not in arc
        arc.append(following)
    arcs.append(arc)
assert len(arcs) == 2 and all(len(arc) > 20 for arc in arcs)
ids = sorted(set(i for arc in arcs for i in arc))

def smooth(value, start, end):
    t = min(1,max(0,(value-start)/(end-start)))
    return t*t*t*(t*(t*6-15)+10)

def pose(time):
    amount = smooth(time,.8,1.4)
    origin = points[rear] + [0,-1.25*smooth(time,1.35,2.8),-.55*amount]
    actual = {rear:origin}
    for arc in arcs:
        sign = np.sign(points[arc[1],0])
        for a,b in zip(arc,arc[1:]):
            delta = points[b]-points[a]
            length = np.linalg.norm(delta[[0,2]])
            angle = np.arctan2(delta[2],sign*delta[0])*(1-.9*amount)
            actual[b] = actual[a]+[sign*length*np.cos(angle),delta[1],length*np.sin(angle)]
    return actual

frames = []
maximum_edge_error = 0
for frame in data['frames']:
    actual = pose(frame['time'])
    for arc in arcs:
        for a,b in zip(arc,arc[1:]):
            maximum_edge_error = max(maximum_edge_error,abs(np.linalg.norm(actual[b]-actual[a])-np.linalg.norm(points[b]-points[a])))
    frames.append({'frame':frame['frame'],'time':frame['time'],'points':[actual[i].tolist() for i in ids]})
assert maximum_edge_error < 1e-12
assert np.max(np.abs(np.asarray(frames[0]['points'])-points[ids])) < 1e-12
(base / 'collar-guide.json').write_text(json.dumps({'source':'../morpheus-withdrawal-path-2026-10-20/clearance-input',
    'ids':ids,'arcs':arcs,'maximumEdgeError':maximum_edge_error,'frames':frames}))
print(json.dumps({'rear':rear,'vertices':len(ids),'arcLengths':[len(arc) for arc in arcs],'maximumEdgeError':maximum_edge_error,'frames':len(frames)}))
