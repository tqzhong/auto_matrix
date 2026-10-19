"""Retain the authored cuff/neck controls while simplifying only simulation geometry."""
import bpy
import json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
import numpy as np

base = Path(__file__).parent
data = json.loads((base.parent/'morpheus-withdrawal-path-2026-10-20/clearance-input/manifest.json').read_text())
metadata = json.loads((base/'shoulder-physics/metadata.json').read_text())
guide = json.loads((base/'collar-guide.json').read_text())
points = np.asarray(data['points'])[:,[0,2,1]] * [40,-40,40]
faces = np.asarray(data['indices']).reshape(-1,3)
protected = sorted(set(guide['ids'] + [i for cuff in metadata['cuffs'] for i in cuff['ring']]))
bpy.ops.wm.read_factory_settings(use_empty=True)
rows = []
for invert in [False,True]:
    mesh = bpy.data.meshes.new('full simulation input')
    mesh.from_pydata(points.tolist(), [], faces.tolist())
    mesh.update()
    cage = bpy.data.objects.new('physical cage',mesh)
    bpy.context.collection.objects.link(cage)
    bpy.context.view_layer.objects.active = cage
    group = cage.vertex_groups.new(name='authored cuff and collar')
    group.add(protected,1,'REPLACE')
    for part in data['parts']:
        region = cage.vertex_groups.new(name=part['name'])
        region.add(sorted(set(part['vertices'])),1,'REPLACE')
    modifier = cage.modifiers.new('physical resolution','DECIMATE')
    modifier.ratio = .15
    modifier.vertex_group = group.name
    modifier.invert_vertex_group = invert
    modifier.vertex_group_factor = 1000
    assert bpy.ops.object.modifier_apply(modifier=modifier.name) == {'FINISHED'}
    tree = KDTree(len(cage.data.vertices))
    for vertex in cage.data.vertices:
        tree.insert(vertex.co,vertex.index)
    tree.balance()
    mapped = [tree.find(Vector(points[i])) for i in protected]
    maximum = max(hit[2] for hit in mapped)/100
    physical = np.asarray([list(v.co) for v in cage.data.vertices])
    row = {'invert':invert,'vertices':len(physical),'faces':len(cage.data.polygons),
           'protected':len(protected),'exactControls':sum(hit[2]/100 < 1e-6 for hit in mapped),
           'maximumControlErrorMetres':maximum}
    rows.append(row)
    if maximum < 1e-6:
        mapped_ids = {str(original):int(hit[1]) for original,hit in zip(protected,mapped)}
        assert len(set(mapped_ids.values())) == len(protected)
        original_tree = KDTree(len(points))
        for i,p in enumerate(points):
            original_tree.insert(Vector(p),i)
        original_tree.balance()
        nearest = [original_tree.find(v.co)[1] for v in cage.data.vertices]
        parts = [{'name':part['name'], 'vertices':[v.index for v in cage.data.vertices
                  if any(g.group == i+1 and g.weight > .999 for g in v.groups)]}
                 for i,part in enumerate(data['parts'])]
        assert sum(len(part['vertices']) for part in parts) == len(physical)
        result = {'points':(physical[:,[0,2,1]]/[40,40,-40]).tolist(),
                  'indices':[int(i) for face in cage.data.polygons for i in face.vertices],
                  'mappedControls':mapped_ids,'nearestSource':nearest,'parts':parts,'metadata':row}
        (base/'cage-rest.json').write_text(json.dumps(result))
    bpy.data.objects.remove(cage,do_unlink=True)
(base/'cage-controls.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows),flush=True)
assert any(row['maximumControlErrorMetres'] < 1e-6 for row in rows), 'decimation moved an authored boundary control'
