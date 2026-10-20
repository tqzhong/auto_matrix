"""Transport the actual collar facing with its neckline, before cloth simulation."""
import heapq
import json
import os
import sys
from pathlib import Path
import numpy as np

base = Path(__file__).parent
cage = json.loads((base.parent / 'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
guide = json.loads((base / 'collar-guide.json').read_text())
output = base / 'lifted-band' if '--lift' in sys.argv else base
output.mkdir(exist_ok=True)
def smooth(time, start, end):
    t = min(1, max(0, (time - start) / (end - start)))
    return t*t*t*(t*(t*6-15)+10)
if '--lift' in sys.argv:
    for frame in guide['frames']:
        lift = .008 * smooth(frame['time'], .8, .94) * (1 - smooth(frame['time'], 1.04, 1.2))
        for point in frame['points']:
            point[1] += lift
    guide['source'] = '../input'
    (output / 'collar-guide.json').write_text(json.dumps(guide))
points = np.asarray(cage['points'])
faces = np.asarray(cage['indices']).reshape(-1, 3)
rim = [cage['mappedControls'][str(i)] for i in guide['ids']]
edges = {tuple(sorted((int(a), int(b)))) for face in faces for a, b in zip(face, np.roll(face, -1))}
neighbors = [[] for _ in points]
for a, b in edges:
    distance = float(np.linalg.norm(points[a] - points[b]))
    neighbors[a].append((b, distance))
    neighbors[b].append((a, distance))
distance = np.full(len(points), np.inf)
anchor = np.zeros(len(points), dtype=int)
queue = []
for index, vertex in enumerate(rim):
    distance[vertex] = 0
    anchor[vertex] = index
    heapq.heappush(queue, (0, vertex))
while queue:
    current, vertex = heapq.heappop(queue)
    if current != distance[vertex]:
        continue
    for other, length in neighbors[vertex]:
        value = current + length
        if value <= .03 and value < distance[other]:
            distance[other] = value
            anchor[other] = anchor[vertex]
            heapq.heappush(queue, (value, other))
ids = np.flatnonzero(np.isfinite(distance)).tolist()
assert set(rim).issubset(ids)
ordered = list(reversed(guide['arcs'][0])) + guide['arcs'][1][1:]
lookup = {vertex: i for i, vertex in enumerate(guide['ids'])}
tangents = {}
for i, vertex in enumerate(ordered):
    tangents[lookup[vertex]] = [lookup[ordered[max(0, i-1)]], lookup[ordered[min(len(ordered)-1, i+1)]]]
rest = np.asarray(guide['frames'][0]['points'])
frames = []
for frame in guide['frames']:
    line = np.asarray(frame['points'])
    actual = []
    for vertex in ids:
        parent = anchor[vertex]
        a, b = tangents[int(parent)]
        start, end = rest[b] - rest[a], line[b] - line[a]
        angle = np.arctan2(end[2], end[0]) - np.arctan2(start[2], start[0])
        c, s = np.cos(angle), np.sin(angle)
        rotation = np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])
        actual.append((line[parent] + rotation @ (points[vertex] - rest[parent])).tolist())
    frames.append({'frame': frame['frame'], 'time': frame['time'], 'points': actual})
assert np.max(np.abs(np.asarray(frames[0]['points']) - points[ids])) < 1e-12
result = {'ids': ids, 'originalRim': rim, 'maximumGeodesicMetres': .03 * .4,
          'frames': frames, 'scope': 'Original 12 mm collar facing follows the open edge; full display geometry retained.'}
(output / 'band-guide.json').write_text(json.dumps(result))
check = output / 'band-collar'
check.mkdir(exist_ok=True)
selected = set(ids)
(check / 'collar-guide.json').write_text(json.dumps({
    'source': os.path.relpath(base / 'input', check), 'ids': ids,
    'arcs': sorted(edge for edge in edges if set(edge).issubset(selected)), 'frames': frames[:28]}))
print(json.dumps({'vertices': len(ids), 'originalRim': len(rim), 'additional': len(ids) - len(rim)}))
