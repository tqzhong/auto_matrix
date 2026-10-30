"""Fit Neo's finished head to a registered frontal portrait and bake its albedo.

Blender 4.5 authoring only. Inputs are the current unmodified playable Neo,
its orthographic calibration and a diffuse portrait with matching landmarks.
The portrait is a generated authoring input, not proof of actor likeness.
Only the head/eyes/oral geometry and face albedo change; the original rig,
wardrobe, hand geometry, primary UVs and skin weights remain intact.
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
from character_fitting import FEATURES, OVAL, radial_field, smooth_normals


def main(args):
    raw = args.source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
    if doc['extras'].get('character') != 'neo' or not doc['extras'].get('neoMouthVersion'):
        raise ValueError('Use the current finished Neo with oral surfaces.')
    if doc['extras'].get('likenessSculptVersion') or doc['extras'].get('portraitFitVersion'):
        raise ValueError('Start from the unchanged playable source, not a previous fit.')
    source = json.loads(args.source_landmarks.read_text())
    target = json.loads(args.portrait_landmarks.read_text())
    camera = json.loads(args.camera.read_text())
    source_xy = np.array(source['points'])[:, :2]
    source_xy = np.column_stack(((source_xy[:, 0] - .5) * camera['ortho'] * camera['width'] / camera['height'],
                                camera['center'] + (.5 - source_xy[:, 1]) * camera['ortho']))
    source_eye = source_xy[[468, 473]].mean(axis=0)
    target_px = np.array(target['points'])[:, :2] * target['size']
    target_eye = target_px[[468, 473]].mean(axis=0)
    scale = np.linalg.norm(source_xy[468] - source_xy[473]) / np.linalg.norm(target_px[468] - target_px[473])
    target_xy = source_eye + (target_px - target_eye) * [scale, -scale]
    ids = np.unique(OVAL + FEATURES + [468, 473])
    controls = source_xy[ids]; values = target_xy[ids] - controls
    controls = np.vstack((controls, controls * [-1, 1]))
    values = np.vstack((values, values * [-1, 1]))
    anchors = np.array([[x, y] for x in [-.4, 0, .4] for y in [3.64, 4.40]])
    field = radial_field(np.vstack((controls, anchors)), np.vstack((values, np.zeros_like(anchors))), .055, .006)
    depth_field = None
    if args.profile_fit:
        profile = json.loads(args.profile_fit.read_text())['film-oblique']
        # A frontal silhouette point is not the same surface point after a
        # turn. Use visible facial features and midline, not the side oval.
        from character_fitting import MIDLINE
        rows = [r for r in profile['visible'] if r['id'] in FEATURES + MIDLINE]
        controls = np.array([r['xyz'][:2] for r in rows])
        offsets = np.clip([r['zOffset'] for r in rows], -.025, .025)[:, None]
        controls = np.vstack((controls, controls * [-1, 1], anchors))
        offsets = np.vstack((offsets, offsets, np.zeros((len(anchors), 1))))
        depth_field = radial_field(controls, offsets, .045, .06)

    def deform(points):
        result = points.copy()
        head = np.clip((points[:, 1] - 3.68) / .13, 0, 1)
        crown = np.clip((4.39 - points[:, 1]) / .16, 0, 1)
        front = np.clip((points[:, 2] - .06) / .15, 0, 1)
        mask = head * head * (3 - 2 * head) * crown * crown * (3 - 2 * crown) * front
        result[:, :2] += field(points[:, :2]) * mask[:, None]
        if depth_field is not None:
            result[:, 2] += np.clip(depth_field(result[:, :2])[:, 0], -.025, .025) * mask
        return result.astype('<f4')

    def view(index, count, width, component, offset=0):
        buffer = doc['bufferViews'][index]
        dtype = np.dtype({5121:'<u1', 5123:'<u2', 5125:'<u4', 5126:'<f4'}[component])
        return np.ndarray((count, width), dtype=dtype, buffer=binary,
                          offset=buffer.get('byteOffset', 0) + offset,
                          strides=(buffer.get('byteStride', dtype.itemsize * width), dtype.itemsize))

    def read(index):
        a = doc['accessors'][index]; width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}[a['type']]
        values = view(a['bufferView'], a['count'], width, a['componentType'], a.get('byteOffset', 0)).copy() if 'bufferView' in a else np.zeros((a['count'], width), dtype='<f4')
        if 'sparse' in a:
            s = a['sparse']; i = s['indices']; v = s['values']
            selected = view(i['bufferView'], s['count'], 1, i['componentType'], i.get('byteOffset', 0)).ravel()
            values[selected] = view(v['bufferView'], s['count'], width, a['componentType'], v.get('byteOffset', 0))
        return values

    def write(index, values):
        a = doc['accessors'][index]
        if 'sparse' in a:
            a.pop('sparse'); a.pop('byteOffset', None)
            binary.extend(b'\0' * (-len(binary) % 4)); a['bufferView'] = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer':0, 'byteOffset':len(binary), 'byteLength':values.nbytes})
            binary.extend(values.astype('<f4').tobytes())
        else:
            view(a['bufferView'], a['count'], values.shape[1], a['componentType'], a.get('byteOffset', 0))[:] = values
        a.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())

    changed = []
    for mesh in doc['meshes']:
        if mesh['name'] not in ['Anatomical head and hands', 'high-poly', 'neo-teeth-upper', 'neo-teeth-lower', 'neo-tongue']: continue
        for primitive in mesh['primitives']:
            attrs = primitive['attributes']; old = read(attrs['POSITION']); new = deform(old)
            if mesh['name'] == 'Anatomical head and hands':
                lips = np.where((np.abs(old[:, 0]) < .018) & (old[:, 1] > 3.93) & (old[:, 1] < 3.96) & (old[:, 2] > .28))[0]
                assert len(lips), 'Source oral contact landmark is missing.'
                mesh.setdefault('extras', {})['mealLipVertices'] = lips.tolist()
            triangles = read(primitive['indices']).reshape(-1, 3)
            normal = smooth_normals(new, triangles).astype('<f4')
            moved = np.any(old != new, axis=1); normal[~moved] = read(attrs['NORMAL'])[~moved]
            cross = lambda p: np.cross(p[triangles[:, 1]] - p[triangles[:, 0]], p[triangles[:, 2]] - p[triangles[:, 0]])
            assert np.all((cross(old) * cross(new)).sum(axis=1) >= -1e-15), 'Fit inverted a triangle.'
            assert np.array_equal(old[old[:, 1] < 3.68], new[old[:, 1] < 3.68]), 'Hand/neck moved.'
            for morph in primitive.get('targets', []):
                posed = deform(old + read(morph['POSITION']))
                write(morph['POSITION'], posed - new)
                if 'NORMAL' in morph:
                    delta = smooth_normals(posed, triangles).astype('<f4') - normal
                    delta[~moved] = read(morph['NORMAL'])[~moved]; write(morph['NORMAL'], delta)
            write(attrs['POSITION'], new); write(attrs['NORMAL'], normal)
            changed.append({'mesh':mesh['name'], 'changedVertices':int(moved.sum()),
                            'maxDisplacement':float(np.linalg.norm(new - old, axis=1).max())})

    args.output.mkdir(parents=True, exist_ok=True)
    for image in doc['images']:
        link = args.output / image['uri']
        if not link.exists(): link.symlink_to((args.source.parent / image['uri']).resolve())

    def save():
        doc['buffers'][0]['byteLength'] = len(binary)
        encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
        binary.extend(b'\0' * (-len(binary) % 4))
        out = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
        temporary = args.output / 'neo.glb.tmp'; temporary.write_bytes(out); temporary.replace(args.output / 'neo.glb')

    doc['extras'].update(portraitFitVersion=1, portraitFitSourceSha256=hashlib.sha256(raw).hexdigest(),
                         portraitFitStatus='Generated diffuse-reference fit; film multiview review and user acceptance pending.')
    if args.profile_fit:
        doc['extras']['filmObliqueDepthSha256'] = hashlib.sha256(args.profile_fit.read_bytes()).hexdigest()
    save()

    # Bake only after registration. A separate authoring UV layer keeps the
    # exported primary UVs and all animation/skin attributes byte-for-byte.
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str((args.output / 'neo.glb').resolve()))
    obj = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Anatomical head and hands'))
    vertices = np.array([(v.co.x, v.co.z, -v.co.y) for v in obj.data.vertices])
    normals = np.array([(v.normal.x, v.normal.z, -v.normal.y) for v in obj.data.vertices])
    loops = np.array([loop.vertex_index for loop in obj.data.loops])
    px = target_eye + (vertices[:, :2] - source_eye) / [scale, -scale]
    uv = px / target['size']; uv[:, 1] = 1 - uv[:, 1]
    projected = obj.data.uv_layers.new(name='Portrait registration')
    projected.data.foreach_set('uv', uv[loops].ravel())
    # Use vertex-facing and anatomical bounds to exclude the ears, throat,
    # back of the head and mouth interior from frontal projection.
    weight = np.clip((normals[:, 2] - .08) / .52, 0, 1)
    weight *= np.clip((vertices[:, 2] - .16) / .08, 0, 1)
    weight *= np.clip((vertices[:, 1] - 3.77) / .06, 0, 1)
    weight *= np.clip((4.31 - vertices[:, 1]) / .045, 0, 1)
    weight *= np.clip((.205 - np.abs(vertices[:, 0])) / .055, 0, 1)
    weight = weight * weight * (3 - 2 * weight)
    attribute = obj.data.attributes.new('portrait_weight', 'FLOAT', 'POINT')
    attribute.data.foreach_set('value', weight)
    material = obj.data.materials[0]; nodes = material.node_tree.nodes; links = material.node_tree.links
    nodes.clear(); output = nodes.new('ShaderNodeOutputMaterial'); emission = nodes.new('ShaderNodeEmission')
    links.new(emission.outputs[0], output.inputs['Surface'])
    base_uv = nodes.new('ShaderNodeUVMap'); base_uv.uv_map = obj.data.uv_layers[0].name
    base = nodes.new('ShaderNodeTexImage'); base.image = bpy.data.images.load(str((args.source.parent / 'neo-albedo.png').resolve()), check_existing=True)
    links.new(base_uv.outputs[0], base.inputs['Vector'])
    portrait_uv = nodes.new('ShaderNodeUVMap'); portrait_uv.uv_map = projected.name
    portrait = nodes.new('ShaderNodeTexImage'); portrait.image = bpy.data.images.load(str(args.portrait.resolve()), check_existing=True)
    links.new(portrait_uv.outputs[0], portrait.inputs['Vector'])
    mask = nodes.new('ShaderNodeAttribute'); mask.attribute_name = 'portrait_weight'
    mix = nodes.new('ShaderNodeMixRGB'); links.new(mask.outputs['Fac'], mix.inputs[0]); links.new(base.outputs['Color'], mix.inputs[1]); links.new(portrait.outputs['Color'], mix.inputs[2])
    # The delivered scalp has dark portrait remnants hidden by the Matrix
    # groom. It is exposed in the recovery/meal outfit. Match its skin to the
    # registered forehead, as the existing Morpheus finishing pass does.
    sample = np.array(target['points'][151])[:2]
    coordinate = nodes.new('ShaderNodeCombineXYZ'); coordinate.inputs['X'].default_value = sample[0]; coordinate.inputs['Y'].default_value = 1 - sample[1]
    forehead = nodes.new('ShaderNodeTexImage'); forehead.image = portrait.image
    links.new(coordinate.outputs[0], forehead.inputs['Vector'])
    scalp = np.clip((vertices[:, 1] - 4.27) / .065, 0, 1); scalp = scalp * scalp * (3 - 2 * scalp)
    attribute = obj.data.attributes.new('scalp_weight', 'FLOAT', 'POINT'); attribute.data.foreach_set('value', scalp)
    scalp_mask = nodes.new('ShaderNodeAttribute'); scalp_mask.attribute_name = 'scalp_weight'
    noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 210; noise.inputs['Detail'].default_value = 2
    grain = nodes.new('ShaderNodeMath'); grain.operation = 'MULTIPLY_ADD'; grain.inputs[1].default_value = .08; grain.inputs[2].default_value = .96
    links.new(noise.outputs['Fac'], grain.inputs[0])
    skin = nodes.new('ShaderNodeMixRGB'); skin.blend_type = 'MULTIPLY'; skin.inputs[0].default_value = 1
    links.new(forehead.outputs['Color'], skin.inputs[1]); links.new(grain.outputs[0], skin.inputs[2])
    clean = nodes.new('ShaderNodeMixRGB'); links.new(scalp_mask.outputs['Fac'], clean.inputs[0]); links.new(mix.outputs[0], clean.inputs[1]); links.new(skin.outputs[0], clean.inputs[2])
    links.new(clean.outputs[0], emission.inputs['Color'])
    baked = bpy.data.images.new('Neo registered face albedo', width=2048, height=2048, alpha=False)
    target_node = nodes.new('ShaderNodeTexImage'); target_node.image = baked; nodes.active = target_node
    obj.data.uv_layers.active_index = 0
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
    bpy.ops.object.bake(type='EMIT', margin=16)
    baked.filepath_raw = str((args.output / 'neo-portrait-albedo.png').resolve()); baked.file_format = 'PNG'; baked.save()
    next(image for image in doc['images'] if image['uri'] == 'neo-albedo.png')['uri'] = 'neo-portrait-albedo.png'
    save()
    report = {'sourceSha256':hashlib.sha256(raw).hexdigest(), 'candidateSha256':hashlib.sha256((args.output / 'neo.glb').read_bytes()).hexdigest(),
              'portraitSha256':hashlib.sha256(args.portrait.read_bytes()).hexdigest(), 'changed':changed,
              'albedoSha256':hashlib.sha256((args.output / 'neo-portrait-albedo.png').read_bytes()).hexdigest(), 'cleanScalpFromRegisteredForehead':True,
              'landmarkFit':'2D frontal registration, not photogrammetry or an actor-likeness score', 'userAcceptance':'pending'}
    (args.output / 'fit-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'source-landmarks', 'portrait', 'portrait-landmarks', 'camera', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--profile-fit', type=Path, help='Optional visible-feature depth fit from a film oblique camera calibration')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    main(args)
