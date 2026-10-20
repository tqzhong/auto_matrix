"""Apply an IPC cage cache to every original displayed garment face."""
import bpy
import json
import sys
from pathlib import Path
import numpy as np

base = Path(__file__).parent
sys.path.insert(0, str(base.parents[2]/'scripts'))
from cloth_collision import keyframe_collider_vertices
from cloth_display import bind_display_to_cage

cage = json.loads((base.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
data = json.loads((base/'input/manifest.json').read_text())
folder = base/(sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'ipc-physics')
frames = json.loads((folder/'summary.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def surface(name, points, indices):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(points.tolist(), [], np.asarray(indices).reshape(-1, 3).tolist())
    mesh.update()
    obj=bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj
points=np.asarray(cage['points'])[:, [0, 2, 1]]*[40, -40, 40]
physical=surface('continuous-contact cage',points,cage['indices'])
display=surface('all original display panels',np.asarray(data['points'])[:, [0, 2, 1]]*[40, -40, 40],data['indices'])
bind_display_to_cage(display,physical)
keyframe_collider_vertices(physical,((row['frame'], np.fromfile(folder/f'cage-{row["frame"]}.bin',np.float32)*100) for row in frames))
for row in frames:
    bpy.context.scene.frame_set(row['frame'])
    evaluated=display.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    assert len(mesh.vertices)==len(data['points'])
    assert [int(i) for face in mesh.polygons for i in face.vertices]==data['indices']
    values=np.empty(len(mesh.vertices)*3,dtype=np.float32)
    mesh.vertices.foreach_get('co',values)
    evaluated.to_mesh_clear()
    (values/100).tofile(folder/f'cloth-{row["frame"]}.bin')
print(json.dumps({'frames':len(frames),'vertices':len(data['points']),'faces':len(data['indices'])//3}))
