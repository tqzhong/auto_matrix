"""Bake continuous scalp/temple material onto the existing Morpheus UVs.

No mesh, rig, eye or wardrobe edits. The frontal authoring portrait and the
existing CC0 ear skin are read-only material sources, not likeness evidence.
Run with Blender 4.5; paths are recorded in the output report.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import OVAL


def smooth(x):
    x = np.clip(x, 0, 1)
    return x*x*(3-2*x)


def main(args):
    raw = args.source.read_bytes(); length = struct.unpack_from('<I', raw, 12)[0]
    assert hashlib.sha256(raw).hexdigest() == '7a10662552610faa32751488440dc5ba0784c59e16232cfdcb9cf29468142178'
    doc = json.loads(raw[20:20+length]); binary = raw[28+length:]
    def read(i):
        a = doc['accessors'][i]; view = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}[a['type']]
        dtype = np.dtype({5126:'<f4', 5125:'<u4', 5123:'<u2', 5121:'u1'}[a['componentType']])
        return np.ndarray((a['count'], width), dtype, buffer=binary,
                          offset=view.get('byteOffset', 0)+a.get('byteOffset', 0),
                          strides=(view.get('byteStride', width*dtype.itemsize), dtype.itemsize))
    p = next(m for m in doc['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
    points = read(p['attributes']['POSITION']); normals = read(p['attributes']['NORMAL'])
    uv = read(p['attributes']['TEXCOORD_0']).copy(); uv[:, 1] = 1-uv[:, 1]
    triangles = read(p['indices']).reshape(-1, 3)
    triangles = triangles[np.all(points[triangles, 1] > 3.86, axis=1)]
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    mesh = bpy.data.meshes.new('Unmodified head surface for material baking')
    mesh.from_pydata(points[:, [0, 2, 1]]*[1, -1, 1], [], triangles.tolist()); mesh.update()
    mesh.polygons.foreach_set('use_smooth', [True]*len(mesh.polygons))
    mesh.normals_split_custom_set_from_vertices(normals[:, [0, 2, 1]]*[1, -1, 1])
    obj = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(obj)
    loops = np.array([loop.vertex_index for loop in mesh.loops])
    mesh.uv_layers.new(name='Original UV').data.foreach_set('uv', uv[loops].ravel())
    material = bpy.data.materials.new('Morpheus continuous scalp authoring'); material.use_nodes = True
    mesh.materials.append(material); nodes = material.node_tree.nodes; links = material.node_tree.links; nodes.clear()
    def attribute(name, values):
        if values.ndim == 1:
            mesh.attributes.new(name, 'FLOAT', 'POINT').data.foreach_set('value', values)
            node = nodes.new('ShaderNodeAttribute'); node.attribute_name = name
            return node.outputs['Fac']
        mesh.color_attributes.new(name, 'FLOAT_COLOR', 'POINT').data.foreach_set('color', np.column_stack((values, np.ones(len(values)))).ravel())
        node = nodes.new('ShaderNodeAttribute'); node.attribute_name = name
        return node.outputs['Color']
    def texture(path, coordinates):
        node = nodes.new('ShaderNodeTexImage'); node.image = bpy.data.images.load(str(path.resolve()), check_existing=True)
        links.new(coordinates, node.inputs['Vector']); return node
    def mix(factor, a, b, mode='MIX'):
        node = nodes.new('ShaderNodeMixRGB'); node.blend_type = mode
        if isinstance(factor, (int, float)): node.inputs[0].default_value = factor
        else: links.new(factor, node.inputs[0])
        links.new(a, node.inputs[1]); links.new(b, node.inputs[2]); return node.outputs[0]
    def math(operation, a, b):
        node = nodes.new('ShaderNodeMath'); node.operation = operation
        links.new(a, node.inputs[0]); node.inputs[1].default_value = b
        return node.outputs[0]
    original_uv = nodes.new('ShaderNodeUVMap'); original_uv.uv_map = 'Original UV'
    original = texture(args.source.parent/'morpheus-portrait-albedo.png', original_uv.outputs[0])
    source = json.loads((args.evidence/'source-landmarks.json').read_text())
    target = json.loads((args.evidence/'portrait-landmarks.json').read_text())
    camera = json.loads((args.evidence/'source-calibration/morpheus-camera.json').read_text())
    xy = np.array(source['points'])[:, :2]
    xy = np.column_stack(((xy[:, 0]-.5)*camera['ortho']*camera['width']/camera['height'],
                          camera['center']+(.5-xy[:, 1])*camera['ortho']))
    source_eye = xy[[468, 473]].mean(axis=0)
    px = np.array(target['points'])[:, :2]*target['size']; target_eye = px[[468, 473]].mean(axis=0)
    scale = np.linalg.norm(xy[468]-xy[473])/np.linalg.norm(px[468]-px[473])
    projected = (target_eye+(points[:, :2]-source_eye)/[scale, -scale])/target['size']
    projected[:, 1] = 1-projected[:, 1]
    mesh.uv_layers.new(name='Read-only portrait projection').data.foreach_set('uv', projected[loops].ravel())
    portrait_uv = nodes.new('ShaderNodeUVMap'); portrait_uv.uv_map = 'Read-only portrait projection'
    portrait = texture(args.evidence/'references/morpheus-frontal-diffuse-v1.png', portrait_uv.outputs[0])
    # Broad clean skin patches exclude eyebrows, eyes, lips and stubble. Sample
    # their means rather than extending a one-pixel row around the whole head.
    image = portrait.image; w, h = image.size; pixels = np.array(image.pixels[:]).reshape(h, w, 4)
    # Blender exposes loaded 8-bit pixel buffers in their encoded color space;
    # vertex colors, unlike image texture nodes, expect scene-linear values.
    pixels[:, :, :3] = np.where(pixels[:, :, :3] <= .04045, pixels[:, :, :3]/12.92,
                                ((pixels[:, :, :3]+.055)/1.055)**2.4)
    anchors = [(1140, 735), (900, 745), (710, 792), (420, 788), (210, 690), (95, 545)]
    colors = []
    for y, x in anchors:
        patches = [pixels[h-y-18:h-y+18, xx-18:xx+18, :3] for xx in [x, w-x]]
        colors.append(np.concatenate([patch.reshape(-1, 3) for patch in patches]).mean(axis=0))
    heights = source_eye[1]+(target_eye[1]-np.array(anchors)[:, 0])*scale
    tones = np.column_stack([np.interp(points[:, 1], heights, np.array(colors)[:, c]) for c in range(3)])
    tone = attribute('Matched side skin tone', tones)
    geometry = nodes.new('ShaderNodeNewGeometry')
    grain = nodes.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 340; grain.inputs['Detail'].default_value = 2
    links.new(geometry.outputs['Position'], grain.inputs['Vector'])
    pigment = math('ADD', math('MULTIPLY', grain.outputs['Fac'], .42), .79)
    side = mix(1, tone, pigment, 'MULTIPLY')
    # Existing anatomically mapped CC0 ears provide helix/concha coloration.
    # Its scalp has hair, so restrict it to the actual protruding ear surface.
    ear = texture(args.ear_skin, original_uv.outputs[0])
    ear_mask = smooth((np.abs(points[:, 0])-.174)/.035)*smooth((points[:, 1]-4.035)/.025)*smooth((4.24-points[:, 1])/.035)
    ear_mask *= smooth((.18-points[:, 2])/.05)*smooth((points[:, 2]+.015)/.04)
    ear_gain = nodes.new('ShaderNodeRGB'); ear_gain.outputs[0].default_value = (1.40, 1.35, 1.28, 1)
    side = mix(attribute('Ear skin mask', ear_mask), side, mix(1, ear.outputs['Color'], ear_gain.outputs[0], 'MULTIPLY'))
    eye = doc['extras']['eye'][1]
    front = np.clip((normals[:, 2]-.08)/.52, 0, 1)*np.clip((points[:, 2]-.16)/.08, 0, 1)
    front *= np.clip((points[:, 1]-eye+.365)/.06, 0, 1)*np.clip((.205-np.abs(points[:, 0]))/.055, 0, 1)
    front = smooth(front)
    # The grey background is slightly warm near the jaw, so chroma alone is
    # insufficient. Restrict the lower-face projection to its traced oval.
    outline = px[OVAL]; left = outline[outline[:, 0] < target_eye[0]]; right = outline[outline[:, 0] >= target_eye[0]]
    left = left[np.argsort(left[:, 1])]; right = right[np.argsort(right[:, 1])]
    projected_px = projected*[w, h]; projected_px[:, 1] = h-projected_px[:, 1]
    edge = np.minimum(projected_px[:, 0]-np.interp(projected_px[:, 1], left[:, 1], left[:, 0]),
                      np.interp(projected_px[:, 1], right[:, 1], right[:, 0])-projected_px[:, 0])
    lower_face = smooth((projected_px[:, 1]-target_eye[1]+40)/40)
    front *= 1-lower_face*(1-smooth((edge-2)/12))
    # The frontal portrait's grey background enters the projected lower cheek
    # at grazing angles. Reject it per texel; keep dark eyebrows/lashes in the
    # central, fully weighted face rather than treating them as background.
    split = nodes.new('ShaderNodeSeparateColor'); links.new(portrait.outputs['Color'], split.inputs[0])
    red_green = nodes.new('ShaderNodeMath'); red_green.operation = 'SUBTRACT'
    links.new(split.outputs['Red'], red_green.inputs[0]); links.new(split.outputs['Green'], red_green.inputs[1])
    valid = nodes.new('ShaderNodeMapRange'); valid.interpolation_type = 'SMOOTHERSTEP'
    valid.inputs['From Min'].default_value = .005; valid.inputs['From Max'].default_value = .04
    links.new(red_green.outputs[0], valid.inputs['Value'])
    preserve = nodes.new('ShaderNodeMath'); preserve.operation = 'MAXIMUM'
    links.new(valid.outputs[0], preserve.inputs[0]); links.new(attribute('Central face protection', smooth((front-.55)/.25)), preserve.inputs[1])
    feather = nodes.new('ShaderNodeMath'); feather.operation = 'MULTIPLY'
    links.new(preserve.outputs[0], feather.inputs[0]); links.new(attribute('Continuous portrait feather', front), feather.inputs[1])
    color = mix(feather.outputs[0], side, portrait.outputs['Color'])
    head_mask = smooth((points[:, 1]-3.89)/.13)
    color = mix(attribute('Protected lower neck', head_mask), original.outputs['Color'], color)
    output = nodes.new('ShaderNodeOutputMaterial'); emission = nodes.new('ShaderNodeEmission')
    links.new(color, emission.inputs['Color']); links.new(emission.outputs[0], output.inputs['Surface'])
    args.output.mkdir(parents=True, exist_ok=True)
    for im in doc['images']:
        if im['uri'] == 'morpheus-portrait-albedo.png': continue
        link = args.output/im['uri']
        if not link.exists(): link.symlink_to((args.source.parent/im['uri']).resolve())
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
    mesh.uv_layers.active_index = 0
    def bake(image, kind, name):
        target_node = nodes.new('ShaderNodeTexImage'); target_node.image = image; nodes.active = target_node
        bpy.ops.object.bake(type=kind, margin=0, use_clear=False)
        image.filepath_raw = str((args.output/name).resolve()); image.file_format = 'PNG'; image.save()
        nodes.remove(target_node)
    baked = original.image.copy(); bake(baked, 'EMIT', 'morpheus-portrait-albedo.png')
    # A tangent normal map gives skin grain a lighting response. It does not
    # displace vertices, so contact and eye/ear silhouettes remain unchanged.
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Distance'].default_value = .00052
    links.new(attribute('Skin relief strength', head_mask*.52), bump.inputs['Strength']); links.new(grain.outputs['Fac'], bump.inputs['Height'])
    shader = nodes.new('ShaderNodeBsdfPrincipled'); links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    links.new(shader.outputs[0], output.inputs['Surface'])
    normal = bpy.data.images.new('Morpheus scalp tangent normals', width=2048, height=2048, alpha=False)
    normal.colorspace_settings.name = 'Non-Color'; normal.generated_color = (.5, .5, 1, 1)
    bake(normal, 'NORMAL', 'morpheus-scalp-normal.png')
    doc['images'].append({'uri':'morpheus-scalp-normal.png'})
    doc['textures'].append({'source':len(doc['images'])-1, 'sampler':0})
    doc['materials'][p['material']]['normalTexture'] = {'index':len(doc['textures'])-1, 'scale':1}
    doc['extras']['scalpMaterialVersion'] = 1
    doc['extras']['scalpMaterialSourceSha256'] = hashlib.sha256(raw).hexdigest()
    doc['extras']['scalpAlbedoSha256'] = hashlib.sha256((args.output/'morpheus-portrait-albedo.png').read_bytes()).hexdigest()
    doc['extras']['scalpNormalSha256'] = hashlib.sha256((args.output/'morpheus-scalp-normal.png').read_bytes()).hexdigest()
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' '*(-len(encoded)%4)
    result = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    (args.output/'morpheus.glb').write_bytes(result)
    report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256(result).hexdigest(),
              'binaryUnchanged':True, 'albedoSha256':hashlib.sha256((args.output/'morpheus-portrait-albedo.png').read_bytes()).hexdigest(),
              'normalSha256':hashlib.sha256((args.output/'morpheus-scalp-normal.png').read_bytes()).hexdigest(),
              'skinAnchors':anchors, 'linearSkinColors':np.array(colors).tolist(), 'userAcceptance':'pending'}
    (args.output/'material-report.json').write_text(json.dumps(report, indent=2)+'\n'); print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'evidence', 'ear-skin', 'output']: parser.add_argument('--'+name, type=Path, required=True)
    main(parser.parse_args(sys.argv[sys.argv.index('--')+1:]))
