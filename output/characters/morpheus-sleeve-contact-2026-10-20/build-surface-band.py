"""Transport the same 12 mm collar facing on the complete garment surface."""
import heapq
import json
from pathlib import Path
import numpy as np
import ipctk
from surface_strain import triangle_stretch

base = Path(__file__).parent
data = json.loads((base/'input/manifest.json').read_text())
guide = json.loads((base/'lifted-band/collar-guide.json').read_text())
points = np.asarray(data['points'])
faces = np.asarray(data['indices']).reshape(-1, 3)
edges = ipctk.edges(faces)
rim = guide['ids']
lookup = {vertex: index for index, vertex in enumerate(rim)}
neighbors = [[] for _ in points]
for a, b in edges:
    length = float(np.linalg.norm(points[a]-points[b]))
    neighbors[a].append((int(b), length))
    neighbors[b].append((int(a), length))
distance = np.full(len(points), np.inf)
queue = []
for vertex in rim:
    distance[vertex] = 0.
    heapq.heappush(queue, (0., vertex))
while queue:
    current, vertex = heapq.heappop(queue)
    if current != distance[vertex]:
        continue
    for other, length in neighbors[vertex]:
        value = current+length
        if value <= .03 and value < distance[other]:
            distance[other] = value
            heapq.heappush(queue, (value, other))
ids = np.flatnonzero(np.isfinite(distance))
rest = points[rim]
segments = np.asarray([(lookup[a], lookup[b]) for arc in guide['arcs'] for a, b in zip(arc, arc[1:])])
start, end = rest[segments[:, 0]], rest[segments[:, 1]]
delta = end-start
offset = points[ids, None, :]-start[None, :, :]
amounts = np.clip(np.sum(offset*delta[None, :, :], axis=2)/np.sum(delta**2, axis=1), 0., 1.)
closest = start[None, :, :]+amounts[:, :, None]*delta[None, :, :]
selected = np.argmin(np.linalg.norm(points[ids, None, :]-closest, axis=2), axis=1)
amount = amounts[np.arange(len(ids)), selected]
owners = segments[selected]
ordered = list(reversed(guide['arcs'][0]))+guide['arcs'][1][1:]
tangent_pairs = np.empty((len(rim), 2), dtype=int)
for i, vertex in enumerate(ordered):
    tangent_pairs[lookup[vertex]] = [lookup[ordered[max(0, i-1)]], lookup[ordered[min(len(ordered)-1, i+1)]]]
initial = np.asarray(guide['frames'][0]['points'])
frames = []
strain = []
fixed = np.zeros(len(points), dtype=bool)
fixed[ids] = True
fixed_edges = edges[np.all(fixed[edges], axis=1)]
rest_lengths = np.linalg.norm(points[fixed_edges[:, 0]]-points[fixed_edges[:, 1]], axis=1)
fixed_faces = faces[np.all(fixed[faces], axis=1)]
for frame in guide['frames']:
    line = rest+np.asarray(frame['points'])-initial
    before = rest[tangent_pairs[:, 1]]-rest[tangent_pairs[:, 0]]
    after = line[tangent_pairs[:, 1]]-line[tangent_pairs[:, 0]]
    angle = np.arctan2(after[:, 2], after[:, 0])-np.arctan2(before[:, 2], before[:, 0])
    rotation = np.zeros((len(rim), 3, 3))
    rotation[:, 0, 0] = rotation[:, 2, 2] = np.cos(angle)
    rotation[:, 0, 2] = -np.sin(angle)
    rotation[:, 2, 0] = np.sin(angle)
    rotation[:, 1, 1] = 1.
    transported = []
    for column in range(2):
        owner = owners[:, column]
        transported.append(line[owner]+np.einsum('nij,nj->ni', rotation[owner], points[ids]-rest[owner]))
    actual = transported[0]*(1-amount[:, None])+transported[1]*amount[:, None]
    # Adjacent facing points interpolate the same smooth boundary transform.
    # The actual rim keeps its measured path exactly (apart from input rounding).
    for index, vertex in enumerate(ids):
        if int(vertex) in lookup:
            actual[index] = line[lookup[int(vertex)]]
    whole = points.copy()
    whole[ids] = actual
    ratios = np.linalg.norm(whole[fixed_edges[:, 0]]-whole[fixed_edges[:, 1]], axis=1)/rest_lengths
    triangle = triangle_stretch(points, whole, fixed_faces)
    strain.append({'frame': frame['frame'], 'time': frame['time'],
                   'maximumFixedEdgeStretch': float(ratios.max()),
                   'maximumFixedTriangleStretch': float(triangle.max())})
    frames.append({'frame': frame['frame'], 'time': frame['time'], 'points': actual.tolist()})
assert np.max(np.abs(np.asarray(frames[0]['points'])-points[ids])) < 1e-12
result = {'ids': ids.tolist(), 'originalRim': rim, 'maximumGeodesicMetres': .012,
          'frames': frames, 'scope': 'Complete surface; same 12 mm collar facing and original rim path, with continuous adjacent anchor interpolation.'}
out = base/'surface-band'
out.mkdir(exist_ok=False)
(out/'band-guide.json').write_text(json.dumps(result))
report = {'facingVertices': len(ids), 'originalRimVertices': len(rim),
          'fixedEdges': len(fixed_edges), 'fixedTriangles': len(fixed_faces),
          'maximumRimRoundoffMetres': float(np.linalg.norm(rest-initial, axis=1).max())*.4,
          'rows': strain}
(out/'verification.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k != 'rows'}))
print(json.dumps(max(strain, key=lambda row: row['maximumFixedEdgeStretch'])))
assert all(row['maximumFixedEdgeStretch'] < 1.1 for row in strain), 'the prescribed collar motion itself exceeds the material limit'
