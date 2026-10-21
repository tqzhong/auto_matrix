"""A collider's evaluated samples must retain the supplied float32 coordinates."""
import argparse
import json
from pathlib import Path
import sys
import tempfile

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from cloth_collision import cache_collider_vertices

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
fixture = json.loads((ROOT / 'tests/fixtures/cloth-collider-vertices.json').read_text())
samples = [(frame, np.asarray(values, dtype=np.float32)) for frame, values in fixture['samples']]
bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('Actual collider triangle')
mesh.from_pydata(samples[0][1].reshape(-1, 3).tolist(), [], [[0, 1, 2]])
mesh.update()
body = bpy.data.objects.new('Actual collider triangle', mesh)
bpy.context.collection.objects.link(body)


def evaluated(frame):
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    owner = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    actual = owner.to_mesh()
    values = np.empty(len(actual.vertices) * 3, dtype=np.float32)
    actual.vertices.foreach_get('co', values)
    indices = [vertex for face in actual.polygons for vertex in face.vertices]
    owner.to_mesh_clear()
    assert indices == fixture['indices'], 'Collider cache changed the supplied topology'
    return values


records = []
args.output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='collider-cache-') as directory:
    cache = Path(directory) / 'body.pc2'
    modifier = cache_collider_vertices(body, samples, cache)
    body.modifiers.new('Collision', 'COLLISION')
    for frame, expected in samples:
        values = evaluated(frame)
        records.append({'frame': frame, 'phase': 'sequential', 'maximumError': float(np.abs(values - expected).max()),
                        'bitIdentical': values.tobytes() == expected.tobytes()})
    assert all(row['bitIdentical'] for row in records), f'Collider cache changed its exact supplied frame: {records}'
    for frame in [16.5, 38.25, 75.5, 12.75]:
        index = int(frame) - samples[0][0]
        expected = samples[index][1] + (samples[index + 1][1] - samples[index][1]) * (frame - int(frame))
        error = np.abs(evaluated(frame) - expected)
        assert np.all(error <= np.abs(np.spacing(expected)) * 2), 'Cache interpolates the wrong neighbouring samples'
        records.append({'frame': frame, 'phase': 'subframe', 'maximumError': float(error.max())})
    blend = Path(directory) / 'cached-collider.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    modifier.filepath = bpy.path.relpath(str(cache))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.wm.open_mainfile(filepath=str(blend), use_scripts=False)
    body = bpy.data.objects['Actual collider triangle']
    for frame, expected in reversed(samples):
        values = evaluated(frame)
        records.append({'frame': frame, 'phase': 'saved-blend-reverse', 'maximumError': float(np.abs(values - expected).max()),
                        'bitIdentical': values.tobytes() == expected.tobytes()})
    assert all(row.get('bitIdentical', True) for row in records), 'Saved cache did not restore exact samples'
    # Offset scene frames must not become offsets inside the PC2 stream.
    shifted = bpy.data.objects.new('Shifted scene frames', body.data.copy())
    bpy.context.collection.objects.link(shifted)
    shifted_samples = [(frame + 17, values) for frame, values in samples]
    cache_collider_vertices(shifted, shifted_samples, Path(directory) / 'shifted.pc2')
    original = body
    body = shifted
    for frame, expected in [shifted_samples[-1], shifted_samples[15], shifted_samples[0]]:
        assert evaluated(frame).tobytes() == expected.tobytes(), 'Scene-frame offset changed sample selection'
    body = original
    bad_samples = [[], [(1, samples[0][1]), (3, samples[1][1])], [(1, [0, 0, 0])], [(1, [float('nan')] * 9)]]
    for index, invalid in enumerate(bad_samples):
        destination = Path(directory) / f'invalid-{index}.pc2'
        try:
            cache_collider_vertices(body, invalid, destination)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid collider input was accepted')
        assert not destination.exists(), 'Invalid input left a partial point cache'
args.output.write_text(json.dumps({
    'blenderVersion': bpy.app.version_string,
    'scope': 'Exact float32 cache input, preserved triangle indices, subframe interpolation, relative-sidecar .blend reload, reverse seeking, offset scene frames and invalid input. Three actual collider vertices only; not complete anatomy, character contact or gameplay acceptance.',
    'sourceAssetSha256': fixture['sourceAssetSha256'], 'sourceVertexIds': fixture['sourceVertexIds'],
    'invalidInputsRejected': len(bad_samples), 'records': records,
}, indent=2))
print(json.dumps({'samples': len(samples), 'reloadSamples': len(samples), 'subframes': 4,
                  'shiftedSamples': 3, 'invalidInputsRejected': len(bad_samples),
                  'maximumIntegerError': max(row['maximumError'] for row in records if 'bitIdentical' in row)}), flush=True)
