"""Render the complete failed garment and all actual inner layers for inspection."""
from pathlib import Path
import json
import sys
import bpy
import numpy as np
from mathutils import Vector

base = Path(__file__).resolve().parent
candidate = 'front-exit' if '--front-exit' in sys.argv else 'shoulder-release' if '--shoulder-release' in sys.argv else 'full-removal'
data = json.loads((base / f'{candidate}-input/manifest.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1400
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('diagnostic studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.24, .26, .29, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65

def material(name, color):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    value.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
    value.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .72
    return value

coat_material = material('diagnostic coat', (.085, .10, .13))
shirt_material = material('diagnostic shirt', (.34, .37, .40))
skin_material = material('diagnostic skin', (.42, .29, .23))
body_material = material('diagnostic lower layers', (.15, .17, .20))

def add_mesh(name, points, faces, shift, color):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points.tolist(), [], np.asarray(faces).reshape(-1, 3).tolist())
    mesh.update()
    owner = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(owner)
    owner.location.x = shift
    owner.data.materials.append(color)
    for polygon in mesh.polygons:
        polygon.use_smooth = True

mid = '--mid' in sys.argv
for frame, shift in ([(28, -.62), (73, .62)] if mid else [(73, -.62), (217, .62)]):
    coat = np.fromfile(base / f'{candidate}-physics/cloth-{frame}.bin', dtype='<f4').reshape(-1, 3)
    add_mesh(f'complete coat frame {frame}', coat, data['indices'], shift, coat_material)
    body = np.fromfile(base / f'{candidate}-input/body-{frame}.bin', dtype='<f4').reshape(-1, 3)
    offset = 0
    for part in data['bodies']:
        points = body[offset:offset + part['count']]
        offset += part['count']
        name = part['name']
        color = shirt_material if 'ambush-shirt' in name or 'ambush-collar' in name else skin_material if 'Anatomical' in name else body_material
        add_mesh(f'{frame}/{name}', points, part['indices'], shift, color)

target = Vector((0, 0, 1.0))
for name, position, power, size in [('key', (-3, -4, 5), 650, 4), ('fill', (4, -2, 3), 300, 3), ('rim', (0, 3, 4), 600, 3)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size = power, size
    owner = bpy.data.objects.new(name, light)
    scene.collection.objects.link(owner)
    owner.location = position
    owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.cameras.new('complete garment inspection')
camera.type = 'ORTHO'
camera.ortho_scale = 2.6
owner = bpy.data.objects.new('complete garment inspection', camera)
scene.collection.objects.link(owner)
owner.location = (1.5, -6, 2.1)
owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = owner
scene.render.filepath = str(base / f'{candidate}-{"mid" if mid else "end"}-diagnostic.png')
bpy.ops.render.render(write_still=True)
