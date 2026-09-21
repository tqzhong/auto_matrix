"""Fit skinned heads to the generated front/profile references in Blender.

The calibration records landmarks measured on unprojected source renders, not
on a face texture pretending to be geometry. Only positions, normals and UVs
change. The original skeleton, skin weights and bind matrices stay intact.
"""
import json
from pathlib import Path

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

CALIBRATION = json.loads(Path(__file__).with_name('character-landmarks.json').read_text())
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
        152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
FEATURES = [33, 133, 159, 145, 263, 362, 386, 374, 70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
            300, 293, 334, 296, 336, 285, 295, 282, 283, 276, 168, 6, 197, 195, 5, 4, 1, 2,
            98, 97, 326, 327, 48, 278, 220, 440, 45, 275, 115, 344, 50, 280, 205, 425,
            61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 13, 14, 78, 308, 87, 317,
            82, 312, 181, 405, 199, 200]
# Inner-lip landmarks are deliberately excluded: a ray through the mouth opening
# hits the back of the mouth, which is not a valid front-surface depth constraint.
MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 11, 17, 18, 200, 199, 175, 152]


def radial_field(controls, values, radius, smoothing):
    centers = controls / radius
    kernel = np.exp(-((centers[:, None] - centers[None, :]) ** 2).sum(axis=2) / 2)
    coefficients = np.linalg.solve(kernel + np.eye(len(centers)) * smoothing, values)

    def evaluate(points):
        result = []
        for block in np.array_split(points, max(1, len(points) // 512)):
            kernel = np.exp(-((block[:, None] / radius - centers[None, :]) ** 2).sum(axis=2) / 2)
            result.append(kernel @ coefficients)
        return np.concatenate(result)
    return evaluate


def smooth_normals(position, triangles):
    surface = np.cross(position[triangles[:, 1]] - position[triangles[:, 0]], position[triangles[:, 2]] - position[triangles[:, 0]])
    normals = np.zeros_like(position)
    for corner in range(3): np.add.at(normals, triangles[:, corner], surface)
    _, welded = np.unique(np.round(position, 5), axis=0, return_inverse=True)
    sums = np.zeros((welded.max() + 1, 3)); np.add.at(sums, welded, normals)
    normals = sums[welded]
    return normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)


def fit_head(document, binary, character, accessor):
    reference = CALIBRATION['characters'][character]
    source = np.array(reference['source']['points']); target = np.array(reference['front']['points'])
    profile = np.array(reference['profile']['points']); camera = reference['camera']
    aspect = camera['width'] / camera['height']; ortho = camera['ortho']; center = camera['center']
    xy = np.column_stack(((source[:, 0] - .5) * ortho * aspect, center + (.5 - source[:, 1]) * ortho))
    source_eye = xy[[468, 473]].mean(axis=0); target_eye = target[[468, 473], :2].mean(axis=0)
    face_height = source_eye[1] - xy[152, 1]
    scale = face_height / (target[152, 1] - target_eye[1])
    target_aspect = reference['front']['size'][0] / reference['front']['size'][1]
    to_xy = np.column_stack(((target[:, 0] - target_eye[0]) * scale * target_aspect,
                            source_eye[1] - (target[:, 1] - target_eye[1]) * scale))
    ids = np.array(OVAL + FEATURES)
    controls = xy[ids]; values = to_xy[ids] - controls
    # Fit a symmetric rest shape; keep subtle expression asymmetry in the map.
    controls = np.vstack((controls, controls * [-1, 1])); values = np.vstack((values, values * [-1, 1]))
    anchors = np.array([[x, y] for x in [-.4, 0, .4] for y in [source_eye[1] - .46, source_eye[1] + .38]])
    controls = np.vstack((controls, anchors)); values = np.vstack((values, np.zeros_like(anchors)))
    frontal = radial_field(controls, values, .075, .0006)

    def array(index, width): return accessor(document, binary, index, width)
    primitive = next(m for m in document['meshes'] if m['name'] == 'Anatomical head and hands')['primitives'][0]
    position = array(primitive['attributes']['POSITION'], 3)
    triangles = array(primitive['indices'], 1).reshape(-1, 3)
    surface = BVHTree.FromPolygons([Vector(p) for p in position], triangles.tolist(), all_triangles=True)

    def depth_at(index):
        hit, _, _, _ = surface.ray_cast(Vector((xy[index, 0], xy[index, 1], 2)), Vector((0, 0, -1)))
        if hit is None: raise RuntimeError(f'{character}: source landmark {index} misses the head; recalibrate the reference.')
        return hit.z

    profile_eye = profile[33, :2]  # Visible outer canthus in the right-facing reference.
    profile_scale = face_height / (profile[152, 1] - profile_eye[1])
    profile_aspect = reference['profile']['size'][0] / reference['profile']['size'][1]
    target_z = (profile[MIDLINE, 0] - profile_eye[0]) * profile_scale * profile_aspect + depth_at(33)
    depth_values = target_z - np.array([depth_at(i) for i in MIDLINE])
    depth_controls = np.vstack((to_xy[MIDLINE, 1:2], [[source_eye[1] - .43], [source_eye[1] + .35]]))
    depth = radial_field(depth_controls, np.concatenate((depth_values, [0, 0]))[:, None], .025, .003)

    def deform(points):
        result = points.copy()
        head = np.clip((result[:, 1] - xy[152, 1] + .045) / .09, 0, 1)
        head = head * head * (3 - 2 * head)
        crown = np.clip((source_eye[1] + .21 - result[:, 1]) / .13, 0, 1)
        head *= crown * crown * (3 - 2 * crown)
        front = np.clip((result[:, 2] + .05) / .13, 0, 1)
        result[:, :2] += frontal(result[:, :2]) * (head * (.25 + .75 * front))[:, None]
        width = .065 + .055 * np.clip((source_eye[1] - .14 - result[:, 1]) / .14, 0, 1)
        result[:, 2] += depth(result[:, 1:2])[:, 0] * np.exp(-(result[:, 0] / width) ** 2 / 2) * head * front
        return result

    column = ['neo', 'trinity', 'smith', 'morpheus'].index(character)
    for mesh in document['meshes']:
        if mesh['name'] not in ['Anatomical head and hands', 'high-poly', 'short04']: continue
        primitive = mesh['primitives'][0]; attributes = primitive['attributes']
        position = array(attributes['POSITION'], 3); position[:] = deform(position)
        if mesh['name'] == 'short04':
            # Trace the reference hair/skin boundary onto the existing hair
            # cards, so the swept fringe is no longer a straight helmet edge.
            hairline = np.array(reference['hairline'])
            front = (position[:, 2] > document['extras']['eye'][2] - .08) & (position[:, 1] > source_eye[1] + .025)
            roots = position[front].copy()
            for i in np.where(front)[0]:
                x, y, z = position[i]
                neighbors = roots[np.abs(roots[:, 0] - x) < .015]
                root_y = neighbors[:, 1].min()
                u = target_eye[0] + x / (scale * target_aspect)
                target_y = source_eye[1] + (target_eye[1] - np.interp(u, hairline[:, 0], hairline[:, 1])) * scale
                delta = np.clip(target_y - root_y, -.065, .05)
                position[i, 1] += delta * np.exp(-((y - root_y) / .075) ** 2)
            for i, point in enumerate(position):
                nearest, normal, _, _ = fitted_skin.find_nearest(Vector(point))
                distance = np.dot(point - nearest, normal)
                if distance < .003: position[i] += np.array(normal) * (.003 - distance)
        normals = smooth_normals(position, array(primitive['indices'], 1).reshape(-1, 3))
        array(attributes['NORMAL'], 3)[:] = normals
        document['accessors'][attributes['NORMAL']].update(min=normals.min(axis=0).tolist(), max=normals.max(axis=0).tolist())
        document['accessors'][attributes['POSITION']].update(min=position.min(axis=0).tolist(), max=position.max(axis=0).tolist())
        if mesh['name'] != 'Anatomical head and hands': continue
        fitted_skin = BVHTree.FromPolygons([Vector(p) for p in position], triangles.tolist(), all_triangles=True)
        u = target_eye[0] + position[:, 0] / (scale * target_aspect)
        v = target_eye[1] + (source_eye[1] - position[:, 1]) / scale
        outline = target[OVAL, :2]
        left = outline[outline[:, 0] < target_eye[0]]; right = outline[outline[:, 0] >= target_eye[0]]
        left = left[np.argsort(left[:, 1])]; right = right[np.argsort(right[:, 1])]
        lo = np.interp(v, left[:, 1], left[:, 0]); hi = np.interp(v, right[:, 1], right[:, 0])
        # The detector's top oval ends midway up the forehead. Extend it to the
        # hairline, instead of leaving a conspicuous untextured forehead band.
        lo = np.where(v < target_eye[1], np.interp(target_eye[1], left[:, 1], left[:, 0]), lo)
        hi = np.where(v < target_eye[1], np.interp(target_eye[1], right[:, 1], right[:, 0]), hi)
        edge = np.minimum(u - lo, hi - u)
        weight = np.clip(edge / .045, 0, 1) * np.clip((normals[:, 2] - .05) / .55, 0, 1)
        weight *= np.clip((target[152, 1] + .035 - v) / .07, 0, 1) * np.clip((v - target[10, 1] + .20) / .045, 0, 1)
        weight *= np.clip((position[:, 2] - .08) / .07, 0, 1)
        sample_u = np.clip(u, lo + .018, hi - .018)
        uv = np.column_stack(((sample_u + column % 2) / 2, 1 - (v + column // 2) / 2))
        array(attributes['TEXCOORD_1'], 2)[:] = uv
        document['accessors'][attributes['TEXCOORD_1']].update(min=uv.min(axis=0).tolist(), max=uv.max(axis=0).tolist())
        array(attributes['_FACE_WEIGHT'], 1)[:, 0] = weight * weight * (3 - 2 * weight)

    metadata = document['extras']
    metadata['eye'] = deform(np.array([metadata['eye']]))[0].tolist()
    metadata['faceReference'] = CALIBRATION['referenceFront']
    metadata['profileReference'] = CALIBRATION['referenceProfile']
    metadata['skinSample'] = [(target_eye[0] + column % 2) / 2,
                              1 - ((target[10, 1] + target_eye[1]) / 2 + column // 2) / 2]
    metadata['imageFitted'] = True
    return {
        'sourceSha256': reference['sourceSha256'],
        'frontControlRmsBefore': float(np.sqrt((values[:len(ids)] ** 2).sum(axis=1).mean())),
        'unmaskedFrontFieldRmsAfter': float(np.sqrt(((frontal(xy[ids]) - values[:len(ids)]) ** 2).sum(axis=1).mean())),
        'profileDepthOffsets': depth_values.tolist(),
        'note': 'Field residual before neck/crown masking; not final surface error or a measure of actor likeness.',
    }
