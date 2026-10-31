"""Check the actual welded upper coat's neck, front, hem and cuff boundaries."""
from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import json

base = Path(__file__).resolve().parent
source = base / 'full-removal-input/manifest.json'
data = json.loads(source.read_text())
controls = json.loads((base / 'boundary-controls.json').read_text())
points = data['points']
indices = data['indices'][:len(data['surfaces'][0]['indices'])]
edges = Counter()
for i in range(0, len(indices), 3):
    a, b, c = indices[i:i + 3]
    edges.update([tuple(sorted(pair)) for pair in [(a, b), (b, c), (c, a)]])
adjacent = defaultdict(set)
for (a, b), count in edges.items():
    if count == 1:
        adjacent[a].add(b)
        adjacent[b].add(a)
unseen = set(adjacent)
rows = []
while unseen:
    todo = [unseen.pop()]
    component = set(todo)
    while todo:
        for vertex in adjacent[todo.pop()]:
            if vertex not in component:
                component.add(vertex)
                unseen.discard(vertex)
                todo.append(vertex)
    rows.append(dict(vertices=len(component), minimum=[min(points[i][axis] for i in component) for axis in range(3)],
        maximum=[max(points[i][axis] for i in component) for axis in range(3)],
        neck=len(component.intersection(controls['neck'])),
        cuffs=[len(component.intersection(cuff['ring'])) for cuff in controls['cuffs']],
        degrees=sorted({len(adjacent[i]) for i in component})))
report = dict(part=data['parts'][0]['name'], faces=len(indices) // 3,
    nonmanifoldEdges=sum(count > 2 for count in edges.values()), boundaryComponents=rows,
    sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest())
(base / 'coat-opening-topology.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
assert report['nonmanifoldEdges'] == 0 and len(rows) == 3
assert all(row['degrees'] == [2] for row in rows)
opening = next(row for row in rows if row['neck'] == len(controls['neck']))
assert opening['minimum'][1] < 2.5 and opening['maximum'][1] > 3.8, 'The neck and front must share the opening to the waist.'
assert sorted(row['cuffs'] for row in rows) == [[0, 0], [0, 61], [61, 0]]
