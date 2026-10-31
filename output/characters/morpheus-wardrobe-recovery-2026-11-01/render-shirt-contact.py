"""Actual complete shirt and twelve inner layers, before/after frame 94."""
from pathlib import Path
import hashlib
import json
import math
import bpy
import numpy as np
from mathutils import Vector

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'shirt-contact-input/manifest.json').read_text())
failed = json.loads((base / 'shirt-contact-render-faces.json').read_text())
assert failed['frame'] == 94
mapping = np.asarray(json.loads((base / 'shirt-contact-path/source-to-weld.json').read_text()))
raw = np.fromfile(base / 'shirt-contact-input/shirt-94.bin', dtype='<f8').reshape(-1, 3)
corrected = np.fromfile(base / 'shirt-contact-path/cloth-94.bin', dtype='<f8').reshape(-1, 3)[mapping]
body = np.fromfile(base / 'shirt-contact-input/body-94.bin', dtype='<f8').reshape(-1, 3)
assert raw.shape == corrected.shape == (manifest['shirt']['count'], 3)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 1800, 2100
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('neutral contact inspection')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12, .14, .17, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7


def material(name, color):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    shader = value.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .72
    return value


shirt = material('complete shirt', (.38, .42, .46))
skin = material('actual visible skin', (.40, .28, .22))
other = material('other complete visible layers', (.10, .12, .15))
crossing = material('actual intersecting raw faces', (.9, .025, .012))
label = material('labels', (.75, .80, .85))
for fixed in [False, True]:
    for rear in [False, True]:
        shift = ((int(fixed) - .5) * 1.55, 0, (1 - int(rear)) * 2.15)
        parts = [(manifest['shirt'], corrected if fixed else raw)]
        offset = 0
        for part in manifest['bodies']:
            parts.append((part, body[offset:offset + part['count']]))
            offset += part['count']
        assert offset == len(body)
        for part, points in parts:
            mesh = bpy.data.meshes.new(part['name'])
            ids = part['indices']
            mesh.from_pydata(points.tolist(), [], [ids[i:i + 3] for i in range(0, len(ids), 3)])
            mesh.update()
            owner = bpy.data.objects.new(part['name'], mesh)
            scene.collection.objects.link(owner)
            owner.location = shift
            owner.rotation_euler.z = math.pi if rear else 0
            is_shirt = part['name'] == manifest['shirt']['name']
            mesh.materials.append(shirt if is_shirt else skin if 'Anatomical' in part['name'] else other)
            mesh.materials.append(crossing)
            crossed = set(failed['crossedFaces']) if is_shirt and not fixed else set()
            for face in mesh.polygons:
                face.use_smooth = True
                face.material_index = int(face.index in crossed)
        text = bpy.data.curves.new('contact inspection label', 'FONT')
        text.body = ('CORRECTED' if fixed else 'RAW: ' + str(failed['self']) + ' PAIRS') + (' / BACK' if rear else ' / FRONT')
        text.size, text.align_x = .073, 'CENTER'
        owner = bpy.data.objects.new('inspection label', text)
        scene.collection.objects.link(owner)
        owner.location = (shift[0], -.65, shift[2] + 1.98)
        owner.rotation_euler.x = math.pi / 2
        text.materials.append(label)

target = Vector((0, 0, 2.05))
for name, position, power in [('key', (-3, -4, 6), 1100), ('fill', (3, -3, 4), 800), ('rim', (0, 3, 6), 1100)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size = power, 4
    owner = bpy.data.objects.new(name, light)
    scene.collection.objects.link(owner)
    owner.location = position
    owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.cameras.new('full surface inspection')
camera.type, camera.ortho_scale = 'ORTHO', 4.6
owner = bpy.data.objects.new('full surface inspection', camera)
scene.collection.objects.link(owner)
owner.location = (0, -10, 2.05)
owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = owner
scene.render.filepath = str(base / 'shirt-contact-frame-94-inspection.png')
bpy.ops.render.render(write_still=True)
source_files = ['render-shirt-contact.py', 'shirt-contact-render-faces.json', 'shirt-contact-input/manifest.json',
    'shirt-contact-input/shirt-94.bin', 'shirt-contact-input/body-94.bin', 'shirt-contact-path/cloth-94.bin', 'shirt-contact-path/source-to-weld.json']
(base / 'shirt-contact-render-receipt.json').write_text(json.dumps(dict(frame=94, time=93/60,
    sourceHashes={file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in source_files},
    shirtVertices=len(raw), shirtFaces=len(manifest['shirt']['indices']) // 3, otherVisibleLayers=len(manifest['bodies']),
    outerCoatIncluded=False, gameplay=False, acceptedForProduction=False), indent=2))
