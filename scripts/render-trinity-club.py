"""Inspect Trinity's shipped head with the staged club costume in Blender 4.5.

These neutral studio views inspect the asset, not the game's lighting or FPS.
"""
import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, default=ROOT / 'packages/client/public/assets/characters')
parser.add_argument('--costume', type=Path)
parser.add_argument('--pose', type=Path, help='Surface snapshot from export-club-pose.mts')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str((args.assets / 'trinity.glb').resolve()))
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.name.startswith('Fitted leather jacket'):
        obj.hide_render = True
bpy.ops.import_scene.gltf(filepath=str((args.costume or args.assets / 'trinity-club.glb').resolve()))
if args.pose:
    surfaces = json.loads(args.pose.read_text())['surfaces']
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or obj.hide_render or all(collection.hide_render for collection in obj.users_collection):
            continue
        surface = surfaces[obj.name.replace(' ', '_')]
        assert len(obj.data.vertices) == len(surface['positions']), 'Imported vertex order changed: ' + obj.name
        for modifier in list(obj.modifiers):
            if modifier.type == 'ARMATURE': obj.modifiers.remove(modifier)
        for vertex, point in zip(obj.data.vertices, surface['positions']): vertex.co = (point[0], -point[2], point[1])
        obj.data.normals_split_custom_set_from_vertices([(n[0], -n[2], n[1]) for n in surface['normals']])
        obj.data.update()
scene = bpy.context.scene; scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'; scene.cycles.samples = 24; scene.cycles.use_denoising = True
scene.render.resolution_x = 768; scene.render.resolution_y = 1024; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.view_settings.view_transform = 'Standard'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.14, .16, .15, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
for name, location, power, size in [('Key', (-2, -3, 5), 190, 3), ('Fill', (2, -1, 3.6), 100, 3), ('Back', (1.5, 2, 4), 180, 2)]:
    light = bpy.data.lights.new(name, 'AREA'); light.energy = power; light.shape = 'DISK'; light.size = size
    obj = bpy.data.objects.new(name, light); scene.collection.objects.link(obj); obj.location = location
    obj.rotation_euler = (Vector((0, 0, 3.1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.cameras.new('Costume inspection'); camera.type = 'ORTHO'; camera.ortho_scale = 2.45
obj = bpy.data.objects.new('Costume inspection', camera); scene.collection.objects.link(obj); scene.camera = obj
for view, location in [('front', (0, -6, 3.2)), ('three-quarter', (-4, -5, 3.2)), ('back', (0, 6, 3.2))]:
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 3.2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    name = 'trinity-club-' + (args.pose.stem + '-' if args.pose else '') + view + '.png'
    scene.render.filepath = str((args.output / name).resolve())
    bpy.ops.render.render(write_still=True)
