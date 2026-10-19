"""Bake the complete displayed coat through a cage with intact wrist/neck controls."""
import bpy
import json
import sys
import time
from pathlib import Path
from mathutils import Matrix
import numpy as np

base = Path(__file__).parent
sys.path.insert(0,str(base.parents[2]/'scripts'))
from cloth_collision import keyframe_collider_vertices
from cloth_display import bind_display_to_cage

folder = base.parent/'morpheus-withdrawal-path-2026-10-20/clearance-input'
data = json.loads((folder/'manifest.json').read_text())
cage = json.loads((base/'cage-fit-4.json').read_text())
original_controls = json.loads((base/'shoulder-physics/metadata.json').read_text())['cuffs']
guide = json.loads((base/'collar-guide.json').read_text())
out = base/'cage-clearance-physics'
out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 25
scene.gravity = (0,0,-981)
scale = 100
model = np.asarray(cage['points'])
points = model[:,[0,2,1]]*[40,-40,40]
faces = np.asarray(cage['indices']).reshape(-1,3)
display_points = np.asarray(data['points'])[:,[0,2,1]]*[40,-40,40]
display_mesh = bpy.data.meshes.new('complete original display geometry')
display_mesh.from_pydata(display_points.tolist(),[],np.asarray(data['indices']).reshape(-1,3).tolist())
display_mesh.update()
display = bpy.data.objects.new('full coat with lapels and tails',display_mesh)
bpy.context.collection.objects.link(display)

stitches = set()
coat_ids = cage['parts'][0]['vertices']
for part_index,part in enumerate(cage['parts'][1:],1):
    source = data['parts'][part_index]['vertices']
    for vertex in part['vertices']:
        local = int(np.argmin(np.linalg.norm(display_points[source]-points[vertex],axis=1)))
        seam = local % 7 <= 1 if part_index == 1 else local < 82
        if seam:
            distances = np.linalg.norm(points[coat_ids]-points[vertex],axis=1)
            for target in np.asarray(coat_ids)[np.argsort(distances)[:3]]:
                stitches.add(tuple(sorted((vertex,int(target)))))
mesh = bpy.data.meshes.new('sewn physical panels')
mesh.from_pydata(points.tolist(),list(stitches),faces.tolist())
mesh.update()
cloth = bpy.data.objects.new('physical garment cage',mesh)
bpy.context.collection.objects.link(cloth)
pin = cloth.vertex_groups.new(name='complete original wrist and neck controls')
mapped = lambda ids: [cage['mappedControls'][str(i)] for i in ids]
C = Matrix(((40,0,0,0),(0,0,-40,0),(0,40,0,0),(0,0,0,1)))
for cuff in original_controls:
    ring = mapped(cuff['ring'])
    assert len(ring) == 61
    pin.add(ring,1,'REPLACE')
    group = cloth.vertex_groups.new(name='cuff '+cuff['side'])
    group.add(ring,1,'REPLACE')
    owner = bpy.data.objects.new('validated cuff path '+cuff['side'],None)
    bpy.context.collection.objects.link(owner)
    owner.rotation_mode = 'QUATERNION'
    for frame in data['frames']:
        source = next(item for item in frame['cuffs'] if item['side'] == cuff['side'])
        matrix = C @ Matrix(np.asarray(source['matrix']).reshape(4,4,order='F').tolist()) @ C.inverted()
        owner.location = matrix.to_translation()
        owner.rotation_quaternion = matrix.to_quaternion()
        owner.keyframe_insert('location',frame=frame['frame'])
        owner.keyframe_insert('rotation_quaternion',frame=frame['frame'])
    scene.frame_set(1)
    bpy.context.view_layer.update()
    hook = cloth.modifiers.new('unchanged complete cuff '+cuff['side'],'HOOK')
    hook.object = owner
    hook.vertex_group = group.name
    hook.matrix_inverse = owner.matrix_world.inverted() @ cloth.matrix_world
    hook.falloff_type = 'NONE'
collar_ids = mapped(guide['ids'])
pin.add(collar_ids,1,'REPLACE')
def collar_frames():
    for frame in guide['frames']:
        coordinates = points.copy()
        coordinates[collar_ids] = np.asarray(frame['points'])[:,[0,2,1]]*[40,-40,40]
        yield frame['frame'],coordinates.ravel()
keyframe_collider_vertices(cloth,collar_frames())
scene.frame_set(1)
bind_display_to_cage(display,cloth)

bodyfaces = []
offset = 0
for part in data['bodies']:
    bodyfaces.extend((np.asarray(part['indices']).reshape(-1,3)+offset).tolist())
    offset += part['count']
initial = np.fromfile(folder/'body-1.bin',np.float32).reshape(-1,3)*scale
bodymesh = bpy.data.meshes.new('thirteen complete visible body layers')
bodymesh.from_pydata(initial.tolist(),[],bodyfaces)
bodymesh.update()
body = bpy.data.objects.new('actual animated body',bodymesh)
bpy.context.collection.objects.link(body)
keyframe_collider_vertices(body,((frame['frame'],np.fromfile(folder/f"body-{frame['frame']}.bin",np.float32)*scale) for frame in data['frames']))
body.modifiers.new('actual body collision','COLLISION')
body.collision.thickness_outer = .05
body.collision.thickness_inner = .05
body.collision.cloth_friction = 8
bpy.ops.mesh.primitive_plane_add(size=1000,location=(0,0,float(initial[:,2].min())))
floor = bpy.context.object
floor.modifiers.new('floor collision','COLLISION')
floor.collision.thickness_outer = .001

simulation = cloth.modifiers.new('stable cage material','CLOTH')
settings = simulation.settings
settings.quality = 20
settings.mass = 3/len(points)
settings.tension_stiffness = settings.tension_stiffness_max = 35
settings.compression_stiffness = settings.compression_stiffness_max = 35
settings.shear_stiffness = settings.shear_stiffness_max = 15
settings.bending_stiffness = .03
settings.bending_damping = .003
settings.air_damping = 2*settings.mass/.3
settings.vertex_group_mass = pin.name
settings.pin_stiffness = 20
settings.use_sewing_springs = False
# The displayed detail reaches 2.01 mm inside the cage; retain 1 mm beyond it.
simulation.collision_settings.distance_min = .3
simulation.collision_settings.collision_quality = 5
simulation.collision_settings.use_self_collision = True
simulation.collision_settings.self_distance_min = .05
simulation.collision_settings.self_friction = 8
simulation.point_cache.frame_start = 1
simulation.point_cache.frame_end = scene.frame_end
scene.frame_set(1)
bpy.context.view_layer.update()
(out/'metadata.json').write_text(json.dumps({'physicalVertices':len(points),'physicalFaces':len(faces),
    'displayVertices':len(display_points),'displayFaces':len(data['indices'])//3,'stitches':len(stitches),
    'clothDistanceMetres':simulation.collision_settings.distance_min/scale,'massTotal':settings.mass*len(points),'airDamping':settings.air_damping,'frames':scene.frame_end,
    'bodyParts':[part['name'] for part in data['bodies']],
    'scope':'Offline cage control; all displayed triangles and actual body layers retained. Not accepted for production.'},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'withdrawal.blend'))
started = time.perf_counter()
rows = []
for frame in range(1,scene.frame_end+1):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = {}
    for name,obj,count in [('cloth',display,len(display_points)),('cage',cloth,len(points)),('body',body,len(initial))]:
        owner = obj.evaluated_get(graph)
        actual = owner.to_mesh()
        assert len(actual.vertices) == count
        if name == 'cloth':
            assert [int(i) for face in actual.polygons for i in face.vertices] == data['indices']
        coordinates = np.empty(count*3,dtype=np.float32)
        actual.vertices.foreach_get('co',coordinates)
        owner.to_mesh_clear()
        assert np.isfinite(coordinates).all()
        evaluated[name] = coordinates/scale
        evaluated[name].tofile(out/f'{name}-{frame}.bin')
    expected = np.fromfile(folder/f'body-{frame}.bin',np.float32)
    error = np.abs(evaluated['body']-expected)
    assert float((error/np.spacing(np.abs(expected)+np.float32(1))).max()) <= 2
    solved = cloth.evaluated_get(graph).modifiers[simulation.name].solver_result
    row = {'frame':frame,'time':data['frames'][frame-1]['time'],'seconds':time.perf_counter()-started,
           'solverStatus':sorted(solved.status) if frame > 1 else [],'bodyDifference':float(error.max()),
           'displayMaximumDrift':float(np.linalg.norm(evaluated['cloth'].reshape(-1,3)-display_points/scale,axis=1).max())}
    rows.append(row)
    (out/'progress.json').write_text(json.dumps(rows))
    print(json.dumps(row),flush=True)
(out/'summary.json').write_text(json.dumps(rows,indent=2))
