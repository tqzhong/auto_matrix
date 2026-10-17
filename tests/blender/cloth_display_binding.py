"""Actual display detail must follow a deformed cage and restore its reference pose."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'scripts'))
from cloth_collision import keyframe_collider_vertices
from cloth_display import bind_display_to_cage

def sleeve(name, columns, rows, detailed):
    points = []
    faces = []
    for row in range(rows+1):
        z = .6*row/rows
        for column in range(columns):
            angle = 2*math.pi*column/columns
            radius = .12+(.002*math.sin(angle*7)*math.cos(z*8) if detailed else 0)
            points.append([radius*math.cos(angle), radius*math.sin(angle), z])
            if row < rows:
                a = row*columns+column
                b = row*columns+(column+1)%columns
                faces.extend([[a, b, b+columns], [a, b+columns, a+columns]])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj, [Vector(p) for p in points]

def evaluated(obj):
    owner = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = owner.to_mesh()
    points = [vertex.co.copy() for vertex in mesh.vertices]
    owner.to_mesh_clear()
    return points

bpy.ops.wm.read_factory_settings(use_empty=True)
cage, coarse = sleeve('simulation sleeve', 24, 12, False)
display, detail = sleeve('detailed display sleeve', 72, 36, True)
transform = Matrix.Translation(Vector((.15, -.07, .09))) @ Matrix.Rotation(.45, 4, 'Y')
keyframe_collider_vertices(cage, [(1, [v for p in coarse for v in p]),
    (2, [v for p in coarse for v in transform@p])])
bpy.context.scene.frame_set(1)
bind_display_to_cage(display, cage)
records = []
for frame in [1, 2, 1]:
    bpy.context.scene.frame_set(frame)
    actual = evaluated(display)
    expected = [transform@p if frame == 2 else p for p in detail]
    assert len(actual) == len(expected)
    maximum = max((a-b).length for a, b in zip(actual, expected))
    records.append({'frame': frame, 'maximumErrorMetres': maximum})
    assert maximum < 1e-5, records[-1]
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if args:
    out = Path(args[args.index('--output')+1])
    out.parent.mkdir(parents=True, exist_ok=True)
    blend = out.with_suffix('.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.wm.open_mainfile(filepath=str(blend), use_scripts=False)
    display = bpy.data.objects['detailed display sleeve']
    assert display.modifiers['Cloth display cage'].is_bound
    for frame in [1, 2]:
        bpy.context.scene.frame_set(frame)
        actual = evaluated(display)
        expected = [transform@p if frame == 2 else p for p in detail]
        assert len(actual) == len(expected)
        maximum = max((a-b).length for a, b in zip(actual, expected))
        records.append({'frame': frame, 'phase': 'saved-blend-reload', 'maximumErrorMetres': maximum})
        assert maximum < 1e-5, records[-1]
    out.write_text(json.dumps({'blenderVersion': bpy.app.version_string,
        'scope': 'Curved triangulated sleeve cage, independently detailed display, per-vertex rigid cage deformation, reference restoration and saved .blend reload. Binding contract only, not character/cloth collision, full doff, game saves or gameplay acceptance.',
        'cagePoints': len(coarse), 'displayPoints': len(detail), 'records': records}, indent=2))
print(json.dumps({'cagePoints': len(coarse), 'displayPoints': len(detail), 'records': records}), flush=True)
