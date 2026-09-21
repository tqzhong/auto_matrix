"""Render orthographic calibration/inspection views with Blender 4.5."""
import argparse
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, default=ROOT / 'packages/client/public/assets/characters')
parser.add_argument('--output', type=Path, default=ROOT / 'output/characters/calibration')
parser.add_argument('--character', choices=['neo', 'trinity', 'smith', 'morpheus'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.output.mkdir(parents=True, exist_ok=True)
for character in [args.character] if args.character else ['neo', 'trinity', 'smith', 'morpheus']:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    path = args.assets / (character + '.glb'); data = path.read_bytes()
    metadata = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])['extras']
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    center = metadata['eye'][1] - .025
    scene = bpy.context.scene; scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 768; scene.render.resolution_y = 1024; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.view_settings.view_transform = 'Standard'
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.42, .42, .42, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    for name, location, power, size in [('Key', (-2, -3, 5), 240, 4), ('Fill', (2, -1, 4), 90, 3)]:
        light = bpy.data.lights.new(name, 'AREA'); light.energy = power; light.shape = 'DISK'; light.size = size
        obj = bpy.data.objects.new(name, light); scene.collection.objects.link(obj); obj.location = location
        obj.rotation_euler = (Vector((0, 0, center)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    camera = bpy.data.cameras.new('Fitting camera'); camera.type = 'ORTHO'; camera.ortho_scale = .95
    obj = bpy.data.objects.new('Fitting camera', camera); scene.collection.objects.link(obj); scene.camera = obj
    for view, location in [('front', (0, -6, center)), ('profile', (-6, -.15, center))]:
        obj.location = location
        obj.rotation_euler = (Vector((0, -.15 if view == 'profile' else 0, center)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str((args.output / (character + '-' + view + '.png')).resolve())
        bpy.ops.render.render(write_still=True)
    (args.output / (character + '-camera.json')).write_text(json.dumps({'center': center, 'ortho': .95, 'width': 768, 'height': 1024}))
