"""Blender 4.5 authoring pass: image-constrained mesh fit, UV bake and editable cast.

Run after build-characters.py:
  blender --background --factory-startup --python scripts/finish-characters.py

The original glTF bind matrices are retained so Blender's bone-axis conventions
cannot change the game's motion solver. Positions/normals and baked materials
are written back to those same GLBs. No Blender dependency at game runtime.
"""
import json
import math
import hashlib
import argparse
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
REFERENCES = ROOT / 'packages/client/public/assets/characters'
parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, default=REFERENCES)
parser.add_argument('--output', type=Path, default=ROOT / 'output/characters')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ASSETS = args.assets; OUTPUT = args.output
OUTPUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import CALIBRATION, fit_head


def read_glb(path):
    data = path.read_bytes(); size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), bytearray(data[28 + size:])


def write_glb(path, document, binary):
    data = json.dumps(document, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    binary += b'\x00' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(data) + len(binary))
                     + struct.pack('<II', len(data), 0x4E4F534A) + data
                     + struct.pack('<II', len(binary), 0x004E4942) + binary)


def array(document, binary, index, width):
    accessor = document['accessors'][index]; view = document['bufferViews'][accessor['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']]
    return np.frombuffer(binary, dtype=dtype, count=accessor['count'] * width,
                         offset=view.get('byteOffset', 0) + accessor.get('byteOffset', 0)).reshape(-1, width)


def image_node(nodes, image):
    node = nodes.new('ShaderNodeTexImage'); node.image = image; return node


def bake_skin(obj, character, metadata):
    material = obj.data.materials[0]; nodes = material.node_tree.nodes; links = material.node_tree.links
    principled = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    base_color = principled.inputs['Base Color'].links[0].from_socket
    uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap.001'
    split = nodes.new('ShaderNodeSeparateXYZ'); links.new(uv.outputs[0], split.inputs[0])
    flip = nodes.new('ShaderNodeMath'); flip.operation = 'SUBTRACT'; flip.inputs[0].default_value = 1
    links.new(split.outputs['Y'], flip.inputs[1])
    combine = nodes.new('ShaderNodeCombineXYZ'); links.new(split.outputs['X'], combine.inputs['X']); links.new(flip.outputs[0], combine.inputs['Y'])
    portrait = image_node(nodes, bpy.data.images.load(str(REFERENCES / 'matrix-faces.png'), check_existing=True))
    links.new(combine.outputs[0], portrait.inputs['Vector'])
    if 'skinSample' in metadata:
        # Match the unprojected ears/neck to the reference's forehead in linear
        # color before blending, avoiding a pale ring around the fitted face.
        source = next(n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image and n.image.filepath.endswith(character + '-skin.png'))
        points = np.array([v.co[:] for v in obj.data.vertices])
        eye = metadata['eye'][1]
        forehead = (np.abs(points[:, 0]) < .06) & (points[:, 2] > eye + .055) & (points[:, 2] < eye + .105) & (points[:, 1] < -.2)
        loops = np.array([loop.vertex_index for loop in obj.data.loops])
        texcoords = np.array([value.uv[:] for value in obj.data.uv_layers[0].data])[forehead[loops]]
        pixels = np.array(source.pixels[:]).reshape(source.size[1], source.size[0], 4)
        samples = pixels[np.clip((texcoords[:, 1] * source.size[1]).astype(int), 0, source.size[1] - 1),
                         np.clip((texcoords[:, 0] * source.size[0]).astype(int), 0, source.size[0] - 1), :3]
        reference = np.array(portrait.image.pixels[:]).reshape(portrait.image.size[1], portrait.image.size[0], 4)
        u, v = metadata['skinSample']; x = int(u * portrait.image.size[0]); y = int(v * portrait.image.size[1])
        tone = np.median(reference[y - 5:y + 6, x - 5:x + 6, :3], axis=(0, 1))
        gain = tone / np.maximum(np.median(samples, axis=0), .02)
        match = nodes.new('ShaderNodeMixRGB'); match.blend_type = 'MULTIPLY'; match.inputs[0].default_value = 1
        match.inputs[2].default_value = (*gain, 1); links.new(base_color, match.inputs[1]); base_color = match.outputs[0]
    weight = nodes.new('ShaderNodeAttribute'); weight.attribute_name = '_FACE_WEIGHT'
    mix = nodes.new('ShaderNodeMixRGB'); links.new(weight.outputs['Fac'], mix.inputs[0])
    links.new(base_color, mix.inputs[1]); links.new(portrait.outputs['Color'], mix.inputs[2])
    if character == 'morpheus':
        # The stock male skin includes cropped hair. Replace that scalp region
        # with the portrait's bald forehead tone and fine albedo variation.
        forehead = image_node(nodes, portrait.image)
        sample = nodes.new('ShaderNodeCombineXYZ'); sample.inputs['X'].default_value = .75; sample.inputs['Y'].default_value = .44
        links.new(sample.outputs[0], forehead.inputs['Vector'])
        noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 210; noise.inputs['Detail'].default_value = 2
        grain = nodes.new('ShaderNodeMath'); grain.operation = 'MULTIPLY_ADD'; grain.inputs[1].default_value = .12; grain.inputs[2].default_value = .94
        links.new(noise.outputs['Fac'], grain.inputs[0])
        tone = nodes.new('ShaderNodeMixRGB'); tone.blend_type = 'MULTIPLY'; tone.inputs[0].default_value = 1
        links.new(forehead.outputs['Color'], tone.inputs[1]); links.new(grain.outputs[0], tone.inputs[2])
        geometry = nodes.new('ShaderNodeNewGeometry'); xyz = nodes.new('ShaderNodeSeparateXYZ'); links.new(geometry.outputs['Position'], xyz.inputs[0])
        mask = nodes.new('ShaderNodeMapRange'); mask.interpolation_type = 'SMOOTHERSTEP'
        mask.inputs['From Min'].default_value = metadata['eye'][1] + .045; mask.inputs['From Max'].default_value = metadata['eye'][1] + .18
        links.new(xyz.outputs['Z'], mask.inputs['Value'])
        back = nodes.new('ShaderNodeMapRange'); back.interpolation_type = 'SMOOTHERSTEP'
        back.inputs['From Min'].default_value = -.28; back.inputs['From Max'].default_value = -.12
        links.new(xyz.outputs['Y'], back.inputs['Value'])
        nape = nodes.new('ShaderNodeMapRange'); nape.interpolation_type = 'SMOOTHERSTEP'
        nape.inputs['From Min'].default_value = metadata['eye'][1] - .26; nape.inputs['From Max'].default_value = metadata['eye'][1] - .18
        links.new(xyz.outputs['Z'], nape.inputs['Value'])
        side = nodes.new('ShaderNodeMath'); side.operation = 'MULTIPLY'; links.new(back.outputs[0], side.inputs[0]); links.new(nape.outputs[0], side.inputs[1])
        bald = nodes.new('ShaderNodeMath'); bald.operation = 'MAXIMUM'; links.new(mask.outputs[0], bald.inputs[0]); links.new(side.outputs[0], bald.inputs[1])
        scalp = nodes.new('ShaderNodeMixRGB'); links.new(bald.outputs[0], scalp.inputs[0]); links.new(mix.outputs[0], scalp.inputs[1]); links.new(tone.outputs[0], scalp.inputs[2])
        mix = scalp
    emission = nodes.new('ShaderNodeEmission'); links.new(mix.outputs[0], emission.inputs['Color'])
    output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL'); links.new(emission.outputs[0], output.inputs['Surface'])
    baked = bpy.data.images.new(character + ' baked skin', width=2048, height=2048, alpha=False)
    target = image_node(nodes, baked); nodes.active = target
    obj.data.uv_layers.active_index = 0
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='EMIT', margin=16)
    baked.filepath_raw = str(ASSETS / (character + '-albedo.png')); baked.file_format = 'PNG'; baked.save()
    # The saved project uses the same final PBR material as the game.
    nodes.clear(); output = nodes.new('ShaderNodeOutputMaterial'); principled = nodes.new('ShaderNodeBsdfPrincipled')
    texture = image_node(nodes, baked); links.new(texture.outputs['Color'], principled.inputs['Base Color'])
    principled.inputs['Roughness'].default_value = .62
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    return baked


def add_reference(collection, offset):
    image = bpy.data.images.load(str(REFERENCES / 'matrix-faces.png'), check_existing=True)
    empty = bpy.data.objects.new('Frontal likeness reference — all four characters', None)
    empty.empty_display_type = 'IMAGE'; empty.data = image; empty.empty_display_size = 5.5
    empty.location = (offset, 1.6, 3.0); empty.rotation_euler = (math.pi / 2, 0, 0)
    empty.hide_render = True; empty.color[3] = .8; collection.objects.link(empty)


def finish_suit(document, objects):
    # Repaint only the tie's UV island. Its collar, seams and buttons remain.
    obj = next(o for o in objects if o.type == 'MESH' and o.name.startswith('Tailored coat upper'))
    mat = obj.data.materials[0]
    texture = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
    image = texture.image.copy(); width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    y, x = np.mgrid[0:height, 0:width]; u = x / width; v = 1 - y / height
    outline = [(.399, .079), (.408, .086), (.412, .099), (.404, .121), (.392, .148),
               (.360, .185), (.366, .150), (.370, .123), (.374, .107), (.382, .096), (.388, .085)]
    inside = np.zeros((height, width), dtype=bool)
    for a, b in zip(outline, outline[1:] + outline[:1]):
        if a[1] != b[1]:
            inside ^= ((a[1] > v) != (b[1] > v)) & (u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0])
    pixels[inside, :3] = [.045, .05, .052]
    image.pixels.foreach_set(pixels.ravel()); image.filepath_raw = str(ASSETS / 'smith-suit-refined.png'); image.file_format = 'PNG'; image.save()
    texture.image = image
    next(i for i in document['images'] if i['uri'] == 'smith-suit.png')['uri'] = 'smith-suit-refined.png'


def finish_eyes(document, objects, character):
    # Keep the real iris fibres and transparent cornea, with natural iris tones.
    obj = next(o for o in objects if o.type == 'MESH' and o.name.startswith('high-poly'))
    material = obj.data.materials[0]
    texture = next(n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE')
    original = texture.image; image = original.copy(); width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    y, x = np.mgrid[0:height, 0:width]; u = x / width; v = y / height
    radius = np.minimum(np.hypot(u - .706, v - .703), np.hypot(u - .293, v - .294))
    luminance = pixels[:, :, :3] @ np.array([.2126, .7152, .0722])
    mean = np.mean(luminance[(radius > .035) & (radius < .10)])
    detail = np.clip(luminance / mean, 0, 2) ** .7
    color = {'neo': [.18, .11, .07], 'trinity': [.27, .34, .32],
             'smith': [.30, .33, .34], 'morpheus': [.10, .055, .03]}[character]
    weight = np.clip((.12 - radius) / .012, 0, 1); weight = weight * weight * (3 - 2 * weight)
    pixels[:, :, :3] = pixels[:, :, :3] * (1 - weight[:, :, None]) + detail[:, :, None] * color * weight[:, :, None]
    image.pixels.foreach_set(pixels.ravel()); image.filepath_raw = str(ASSETS / (character + '-eyes.png')); image.file_format = 'PNG'; image.save()
    texture.image = image
    next(i for i in document['images'] if i['uri'] == Path(original.filepath).name)['uri'] = character + '-eyes.png'
    eye_material = next(m for m in document['materials'] if m['name'] == 'Eyes')
    eye_material['pbrMetallicRoughness']['roughnessFactor'] = .32
    eye_material['extensions'] = {'KHR_materials_specular': {'specularFactor': .25}}
    document.setdefault('extensionsUsed', []).append('KHR_materials_specular')
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Roughness'].default_value = .32; principled.inputs['Specular IOR Level'].default_value = .125


def accessory_material(name, color, roughness, metal=0):
    mat = bpy.data.materials.new(name); mat.diffuse_color = (*color, 1); mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness; p.inputs['Metallic'].default_value = metal
    return mat


def accessory_mesh(collection, name, positions, faces, material):
    mesh = bpy.data.meshes.new(name); mesh.from_pydata([(x, -z, y) for x, y, z in positions], [], faces); mesh.update()
    obj = bpy.data.objects.new(name, mesh); collection.objects.link(obj); obj.data.materials.append(material)
    for polygon in mesh.polygons: polygon.use_smooth = True
    return obj


def add_accessories(collection, meta, character):
    # Editable counterparts of the game's head accessories and simulated coat.
    eye = np.array(meta['eye']); width = .056 if character == 'morpheus' else .062 if character == 'smith' else .065 if character == 'trinity' else .064
    height = .053 if character == 'morpheus' else .031 if character == 'smith' else .025 if character == 'trinity' else .028
    spacing = max(eye[0], width + .01)
    lens_mat = accessory_material('Lenses / ' + character, (.002, .003, .003), .19, .55)
    frame_mat = accessory_material('Frames / ' + character, (.008, .01, .012), .3, .7)
    armature = next(o for o in collection.objects if o.type == 'ARMATURE')
    def attach(obj, bone):
        matrix = obj.matrix_world.copy(); obj.parent = armature; obj.parent_type = 'BONE'; obj.parent_bone = bone; obj.matrix_world = matrix
    def tube(name, points, radius):
        curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = radius; curve.bevel_resolution = 3
        line = curve.splines.new('POLY'); line.points.add(len(points) - 1)
        for p, (x, y, z) in zip(line.points, points): p.co = (x, -z, y, 1)
        obj = bpy.data.objects.new(name, curve); collection.objects.link(obj); curve.materials.append(frame_mat); attach(obj, 'head')
    for side in [-1, 1]:
        vertices = [(side * spacing, eye[1], eye[2] + .077)]
        for i in range(65):
            angle = i / 64 * math.tau
            x = width * math.cos(angle); y = height * math.sin(angle)
            if character == 'smith':
                x = math.copysign(width * abs(math.cos(angle)) ** .28, x); y = math.copysign(height * abs(math.sin(angle)) ** .4, y)
            vertices.append((side * spacing + x, eye[1] + y, eye[2] + .077 - .17 * x * side - x * x * 1.4))
        lens = accessory_mesh(collection, 'Lens ' + str(side), vertices, [(0, i, i + 1) for i in range(1, 65)], lens_mat); attach(lens, 'head')
        tube('Fine lens rim', vertices[1:], .0028)
        if character != 'morpheus':
            tube('Temple', [(side * (spacing + width), eye[1], eye[2] + .03), (side * (spacing + width + .025), eye[1] + .012, eye[2] - .08),
                            (side * (spacing + width + .025), eye[1] - .015, eye[2] - .26)], .004)
    tube('Bridge', [(-spacing + width, eye[1] + .006, eye[2] + .061), (0, eye[1] + .02, eye[2] + .072),
                    (spacing - width, eye[1] + .006, eye[2] + .061)], .0035)
    if character in ('neo', 'morpheus'):
        cloth = accessory_material('Coat panels / ' + character, (.012, .009, .008) if character == 'morpheus' else (.007, .009, .011), .36 if character == 'morpheus' else .72)
        for side in [-1, 1]:
            positions = []; faces = []; rows, columns = 32, 40
            for row in range(rows + 1):
                t = row / rows
                for column in range(columns + 1):
                    angle = side * (.25 + column / columns * (math.pi - .29)); fold = math.sin(angle * 11 + t * 1.8) * .012 * t
                    width = (.55 if character == 'morpheus' else .49) + .14 * t + fold
                    positions.append((math.sin(angle) * width, meta['waist'][1] - t * 1.97, math.cos(angle) * (.33 + .12 * t + fold) + .035))
            for row in range(rows):
                for column in range(columns):
                    a = row * (columns + 1) + column; b = a + columns + 1
                    faces.append((a, b, b + 1, a + 1) if side > 0 else (a + 1, b + 1, b, a))
            panel = accessory_mesh(collection, 'Coat panel ' + str(side), positions, faces, cloth); attach(panel, 'pelvis')


bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
for index, character in enumerate(['neo', 'trinity', 'smith', 'morpheus']):
    path = ASSETS / (character + '.glb'); document, binary = read_glb(path)
    if document.get('extras', {}).get('skinBaked'):
        raise RuntimeError('Rebuild the raw assets with build-characters.py before rerunning the finishing pass.')
    if hashlib.sha256(path.read_bytes()).hexdigest() != CALIBRATION['characters'][character]['sourceSha256']:
        raise RuntimeError(f'{character}: raw model changed; regenerate character-landmarks.json before fitting it.')
    report = fit_head(document, binary, character, array)
    (OUTPUT / (character + '-fit.json')).write_text(json.dumps(report, indent=2) + '\n')
    write_glb(path, document, binary)
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(path))
    objects = set(bpy.data.objects) - before
    collection = bpy.data.collections.new(character.upper() + ' / editable skinned model'); scene.collection.children.link(collection)
    for obj in objects:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        collection.objects.link(obj)
    skin = next(o for o in objects if o.type == 'MESH' and o.name.startswith('Anatomical'))
    bake_skin(skin, character, document['extras'])
    finish_eyes(document, objects, character)
    if character == 'smith': finish_suit(document, objects)
    mat = next(m for m in document['materials'] if m['name'] == 'Skin')
    texture = document['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
    document['images'][texture['source']]['uri'] = character + '-albedo.png'
    mat['pbrMetallicRoughness']['baseColorFactor'] = [1, 1, 1, 1]
    document['extras']['skinBaked'] = True; document['extras']['finisher'] = 'Blender 4.5 / finish-characters.py'
    write_glb(path, document, binary)
    add_accessories(collection, document['extras'], character)
    offset = (index - 1.5) * 2.6
    for obj in collection.objects:
        if obj.parent is None: obj.location.x += offset
    add_reference(collection, offset)
    print('Finished', character, flush=True)

scene.world.color = (.11, .11, .11)
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.view_settings.view_transform = 'AgX'
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.region_3d.view_distance = 12
            area.spaces.active.region_3d.view_location = (0, 0, 2.3)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / 'matrix-cast.blend'))
print('Saved editable cast:', OUTPUT / 'matrix-cast.blend', flush=True)
