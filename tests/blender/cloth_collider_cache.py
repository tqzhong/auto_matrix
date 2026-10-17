"""Blender 4.5.3 behavioural regression: a moving collision mesh must lift cloth.

Run in a factory-startup background process; see docs/cloth-authoring.md.
"""
import argparse
import json
from pathlib import Path
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from cloth_collision import keyframe_collider_vertices

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
results = []
for mode in ['keyed-vertices', 'keyed-translation']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 61
    scene.gravity = (0, 0, 0)
    width = 10
    vertices = [[(i/(width-1)-.5)*.4, (j/(width-1)-.5)*.4, .5] for j in range(width) for i in range(width)]
    faces = [[j*width+i, j*width+i+1, (j+1)*width+i+1, (j+1)*width+i] for j in range(width-1) for i in range(width-1)]
    mesh = bpy.data.meshes.new('Free cloth patch')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    cloth = bpy.data.objects.new('Free cloth patch', mesh)
    bpy.context.collection.objects.link(cloth)
    plane_points = np.asarray([[-2, -2, 0], [2, -2, 0], [2, 2, 0], [-2, 2, 0]], dtype=np.float32)
    plane_mesh = bpy.data.meshes.new('Rising collider')
    plane_mesh.from_pydata(plane_points.tolist(), [], [[0, 1, 2], [0, 2, 3]])
    plane_mesh.update()
    plane = bpy.data.objects.new('Rising collider', plane_mesh)
    bpy.context.collection.objects.link(plane)

    def sample(frame):
        positions = plane_points.copy()
        positions[:, 2] = min(1, max(0, (frame-1)/30))
        return positions

    if mode == 'keyed-vertices':
        keyframe_collider_vertices(plane, ((frame, sample(frame).ravel()) for frame in range(1, 62)))
    else:
        for frame in range(1, 62):
            plane.location.z = min(1, max(0, (frame-1)/30))
            plane.keyframe_insert('location', frame=frame)
    plane.modifiers.new('Collision', 'COLLISION')
    plane.collision.thickness_outer = .001
    simulation = cloth.modifiers.new('Cloth', 'CLOTH')
    simulation.settings.quality = 20
    simulation.settings.mass = 3/len(vertices)
    simulation.settings.bending_stiffness = .03
    simulation.collision_settings.distance_min = .001
    simulation.collision_settings.collision_quality = 5
    simulation.point_cache.frame_start = 1
    simulation.point_cache.frame_end = 61
    records = []
    for frame in range(1, 62):
        scene.frame_set(frame)
        graph = bpy.context.evaluated_depsgraph_get()
        owner = cloth.evaluated_get(graph)
        actual = owner.to_mesh()
        heights = np.asarray([vertex.co.z for vertex in actual.vertices])
        owner.to_mesh_clear()
        owner = plane.evaluated_get(graph)
        actual = owner.to_mesh()
        expected = sample(frame)
        points = np.asarray([list(owner.matrix_world @ vertex.co) for vertex in actual.vertices], dtype=np.float32)
        owner.to_mesh_clear()
        assert np.abs(points-expected).max() < 1e-6, 'collision mesh differs from its input sample'
        records.append({'frame': frame, 'bodyHeight': float(expected[0, 2]),
                        'clothMinimum': float(heights.min()), 'clothMaximum': float(heights.max())})
    results.append({'mode': mode, 'records': records})

args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({
    'blenderVersion': bpy.app.version_string,
    'scope': 'Moving-collider adapter regression only. A rising plane must physically lift a zero-gravity cloth patch; all 61 evaluated collider samples also match input. Not character contact, full-garment or gameplay acceptance.',
    'results': results,
}, indent=2))
for result in results:
    records = result['records']
    assert records[0]['clothMinimum'] == .5
    assert all(record['clothMinimum'] > record['bodyHeight']-.003 for record in records), 'cloth crossed the moving collider'
    assert records[-1]['clothMinimum'] > .99, 'visible collider moved without physically lifting the cloth'
    print(result['mode'], records[-1], flush=True)
