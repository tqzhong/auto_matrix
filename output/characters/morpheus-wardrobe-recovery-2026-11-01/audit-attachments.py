"""Check the actual sewn structural edges against the delivered coat's arm weights."""
from pathlib import Path
import hashlib
import json
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

base = Path(__file__).resolve().parent
cage = json.loads((base / 'boundary-cage-fit-4.json').read_text())
semantics = json.loads((base / 'attachment-semantics.json').read_text())
metadata = json.loads((base / 'full-removal-physics/metadata.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(base / 'full-removal-physics/withdrawal.blend'), use_scripts=False)
cloth = bpy.data.objects['sewn physical coat']
face_edges = set()
for face in cloth.data.polygons:
    for i, a in enumerate(face.vertices):
        b = face.vertices[(i + 1) % len(face.vertices)]
        face_edges.add(tuple(sorted((int(a), int(b)))))
extra = [tuple(edge.vertices) for edge in cloth.data.edges if tuple(sorted(edge.vertices)) not in face_edges]
assert len(extra) == metadata['stitches']
owner = {vertex:index for index, part in enumerate(cage['parts']) for vertex in part['vertices']}
tree = KDTree(len(semantics['coatIds']))
for vertex in semantics['coatIds']:
    tree.insert(Vector(semantics['points'][vertex]), vertex)
tree.balance()
rows = []
for a, b in extra:
    anchor, detail = (a, b) if owner[a] == 0 else (b, a)
    assert owner[anchor] == 0 and owner[detail] != 0
    _, source, distance = tree.find(Vector(cage['points'][anchor]))
    rows.append(dict(anchor=anchor, detail=detail, part=owner[detail], source=source,
        armWeight=semantics['arm'][str(source)], torsoWeight=semantics['torso'][str(source)],
        sourceJoints=semantics['joints'][str(source)], sourceDistanceModel=distance,
        anchorPoint=cage['points'][anchor], detailPoint=cage['points'][detail]))
bad = [row for row in rows if row['armWeight'] > .5]
report = dict(structuralEdges=len(rows), armAnchors=len(bad),
    tailArmAnchors=sum(row['part'] >= 2 for row in bad), bad=bad,
    nonzeroArmAnchors=sum(row['armWeight'] > 0 for row in rows),
    maximumArmWeight=max(row['armWeight'] for row in rows),
    perPartMaximumArmWeight={str(part):max(row['armWeight'] for row in rows if row['part'] == part)
        for part in sorted({row['part'] for row in rows})},
    sourceHashes={name:hashlib.sha256((base / name).read_bytes()).hexdigest()
        for name in ['attachment-semantics.json', 'boundary-cage-fit-4.json', 'full-removal-physics/withdrawal.blend']},
    scope='Nearest delivered source-vertex weight classification of each actual structural edge anchor; not a dynamic garment acceptance.')
(base / 'attachment-audit.json').write_text(json.dumps(report, indent=2))
print(json.dumps(dict(structuralEdges=len(rows), armAnchors=len(bad), tailArmAnchors=report['tailArmAnchors'], examples=bad[:6])), flush=True)
