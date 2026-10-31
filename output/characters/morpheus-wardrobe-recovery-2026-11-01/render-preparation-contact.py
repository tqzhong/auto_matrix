"""Inspect the complete corrected coat and thirteen real layers at three times."""
from pathlib import Path
import hashlib
import json
import math

import bpy
import numpy as np
from mathutils import Vector

base = Path(__file__).resolve().parent
data = json.loads((base / 'preparation-input/manifest.json').read_text())
verified = json.loads((base / 'preparation-contact-display-verification.json').read_text())
assert verified['geometryPassed'] and verified['wholePreparationPresent']
assert len(data['indices']) // 3 == 26916 and len(data['bodies']) == 13
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 2400, 2100
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('complete garment inspection')
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


coat_material = material('all complete coat parts', (.25, .28, .31))
skin = material('actual visible skin', (.40, .28, .22))
other = material('all other actual inner layers', (.10, .12, .15))
labels = material('inspection labels', (.8, .85, .9))
source_files = ['render-preparation-contact.py', 'preparation-input/manifest.json', 'preparation-contact-display-verification.json']
for column, frame in enumerate([1, 25, 49]):
    cloth_file = f'preparation-full-physics-contact/cloth-{frame}.bin'
    body_file = f'preparation-input/body-{frame}.bin'
    source_files.extend([cloth_file, body_file])
    cloth = np.fromfile(base / cloth_file, dtype='<f8').reshape(-1, 3)
    body = np.fromfile(base / body_file, dtype='<f4').reshape(-1, 3)
    assert len(cloth) == len(data['points'])
    parts = [(surface, cloth[part['vertices']], True) for surface, part in zip(data['surfaces'], data['parts'])]
    offset = 0
    for part in data['bodies']:
        parts.append((part, body[offset:offset + part['count']], False))
        offset += part['count']
    assert offset == len(body)
    assert sum(len(part['indices']) // 3 for part, _, outer in parts if outer) == 26916
    for rear in [False, True]:
        shift = ((column - 1) * 1.6, 0, 0 if rear else 2.15)
        for part, points, outer in parts:
            mesh = bpy.data.meshes.new(part['name'])
            ids = part['indices']
            mesh.from_pydata(points.tolist(), [], [ids[i:i + 3] for i in range(0, len(ids), 3)])
            mesh.update()
            mesh.materials.append(coat_material if outer else skin if 'Anatomical' in part['name'] else other)
            for face in mesh.polygons:
                face.use_smooth = True
            owner = bpy.data.objects.new(part['name'], mesh)
            scene.collection.objects.link(owner)
            owner.location, owner.rotation_euler.z = shift, math.pi if rear else 0
        label = bpy.data.curves.new('inspection time', 'FONT')
        label.body = f"{data['frames'][frame - 1]['time']:.2f} s / " + ('BACK' if rear else 'FRONT')
        label.size, label.align_x = .075, 'CENTER'
        owner = bpy.data.objects.new('inspection time', label)
        scene.collection.objects.link(owner)
        owner.location, owner.rotation_euler.x = (shift[0], -.65, shift[2] + 1.98), math.pi / 2
        label.materials.append(labels)
target = Vector((0, 0, 2.03))
for name, position, power in [('key', (-4, -4, 6), 1400), ('fill', (4, -3, 5), 1000), ('rim', (0, 3, 6), 1400)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size = power, 4
    owner = bpy.data.objects.new(name, light)
    scene.collection.objects.link(owner)
    owner.location = position
    owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.cameras.new('complete surface inspection')
camera.type, camera.ortho_scale = 'ORTHO', 5.15
owner = bpy.data.objects.new('complete surface inspection', camera)
scene.collection.objects.link(owner)
owner.location = (0, -10, 2.03)
owner.rotation_euler = (target - owner.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = owner
scene.render.filepath = str(base / 'preparation-contact-inspection.png')
bpy.ops.render.render(write_still=True)
(base / 'preparation-contact-render-receipt.json').write_text(json.dumps(dict(
    sourceHashes={file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in source_files},
    imageSha256=hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest(),
    frames=[1, 25, 49], displayFaces=26916, actualInnerLayers=13, gameplay=False, acceptedForProduction=False), indent=2))
