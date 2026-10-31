"""Correct the complete shirt while retaining every other visible inner layer.

CCD covers the linear geometry between the exported 60 Hz poses. This is a
contact-authoring trajectory, not a cloth-material or gameplay acceptance.
"""
from pathlib import Path
import hashlib
import json
import sys
import time

base = Path(__file__).resolve().parent
sys.path.insert(0, str(base.parents[1] / 'tools/ipctk-1.5.0'))
import numpy as np
import scipy.sparse as sparse
import ipctk
from feasible_shirt_projection import project, NoFeasibleFrame

ipctk.set_num_threads(1)
folder = base / 'shirt-contact-input'
data = json.loads((folder / 'manifest.json').read_text())
out = base / 'shirt-contact-bvh'
out.mkdir(exist_ok=True)
initial = np.fromfile(folder / 'shirt-1.bin', dtype='<f8').reshape(-1, 3)
_, mapping = np.unique(np.round(initial, 7), axis=0, return_inverse=True)
count = int(mapping.max() + 1)
members = np.bincount(mapping)

def sample(frame):
    raw = np.fromfile(folder / f'shirt-{frame}.bin', dtype='<f8').reshape(-1, 3)
    shirt = np.zeros((count, 3))
    np.add.at(shirt, mapping, raw)
    shirt /= members[:, None]
    body = np.fromfile(folder / f'body-{frame}.bin', dtype='<f8').reshape(-1, 3)
    return np.vstack([shirt, body])

value = sample(1)
shirt_faces = mapping[np.asarray(data['shirt']['indices']).reshape(-1, 3)]
assert not np.any(np.diff(np.sort(shirt_faces, axis=1), axis=1) == 0), 'No displayed shirt face may be dropped by welding.'
faces = [shirt_faces]
offset = count
for part in data['bodies']:
    faces.append(np.asarray(part['indices']).reshape(-1, 3) + offset)
    offset += part['count']
faces = np.vstack(faces).astype(np.int32)
mesh = ipctk.CollisionMesh(value, ipctk.edges(faces), faces)
assert mesh.num_vertices == len(value)
mesh.can_collide = ipctk.VertexPatchesCanCollide(np.concatenate([
    np.arange(count, dtype=np.int32), np.full(len(value) - count, count, dtype=np.int32)]))
assert not ipctk.has_intersections(mesh, value)
torso = np.ones(count)
np.minimum.at(torso, mapping, data['shirt']['torso'])
pins = torso >= .99
edges = ipctk.edges(shirt_faces)
row, column = np.concatenate([edges[:, 0], edges[:, 1]]), np.concatenate([edges[:, 1], edges[:, 0]])
degree = np.bincount(row, minlength=count)
laplace = sparse.eye(count, format='csr') - sparse.coo_matrix(
    (1 / np.maximum(1, degree[row]), (row, column)), shape=(count, count)).tocsr()
weights = np.where(pins, 1e10, 1.)
quadratic = sparse.kron(sparse.block_diag([
    sparse.diags(weights) + 20 * (laplace.T @ laplace),
    sparse.eye(len(value) - count) * 1e10]), sparse.eye(3), format='csc')
anchors = np.concatenate([pins, np.ones(len(value) - count, dtype=bool)])
source_names = ['construct-shirt-contact-bvh.py', 'feasible_shirt_projection.py', 'shirt-contact-input/manifest.json']
hashes = {name:hashlib.sha256((base / name).read_bytes()).hexdigest() for name in source_names}
digest = hashlib.sha256()
for frame in data['frames']:
    for part in ['shirt', 'body']:
        filename = f"{part}-{frame['frame']}.bin"
        digest.update(filename.encode() + b'\0' + hashlib.sha256((folder / filename).read_bytes()).digest())
metadata = dict(sourceHashes=hashes, inputGeometrySha256=digest.hexdigest(), sourceShirtVertices=len(mapping),
    weldedShirtVertices=count, shirtFaces=len(shirt_faces), otherLayers=[part['name'] for part in data['bodies']],
    allFaces=len(faces), torsoAnchors=int(pins.sum()), frames=len(data['frames']),
    acceptedForProduction=False, energyEquilibriumProven=False,
    scope='Complete shirt and twelve unchanged visible inner layers. CCD applies to the linear cache segments, not arbitrary runtime bone curves or the outer coat.')
metadata_file = out / 'metadata.json'
if metadata_file.exists():
    assert json.loads(metadata_file.read_text()) == metadata, 'Resume only the same source and input.'
else:
    metadata_file.write_text(json.dumps(metadata, indent=2))
    (out / 'source-to-weld.json').write_text(json.dumps(mapping.tolist()))
    value[:count].astype('<f8').tofile(out / 'cloth-1.bin')

def advance(before, raw_before, raw_after, frame, begin=0., end=1., depth=0):
    try:
        corrected, report = project(mesh, before, raw_after, quadratic, anchors, 2e-4,
            f'shirt-{frame}-{begin:.10f}-{end:.10f}', lambda row: print(json.dumps(row), flush=True))
    except NoFeasibleFrame as error:
        print(json.dumps(dict(rejectedFrame=frame, begin=begin, end=end, depth=depth, reason=str(error))), flush=True)
        assert depth < 8, (frame, begin, end, 'No continuous shirt interval')
        middle, half = (begin + end) / 2, (raw_before + raw_after) / 2
        left, left_keys = advance(before, raw_before, half, frame, begin, middle, depth + 1)
        right, right_keys = advance(left, half, raw_after, frame, middle, end, depth + 1)
        return right, left_keys + right_keys
    assert np.array_equal(corrected[anchors], raw_after[anchors])
    assert not ipctk.has_intersections(mesh, corrected)
    assert ipctk.is_step_collision_free(mesh, before, corrected)
    filename = f'cloth-{frame}-{end:.10f}.bin'
    corrected[:count].astype('<f8').tofile(out / filename)
    return corrected, [dict(fraction=end, file=filename, report=report,
        displacementFromRawMetres=float(np.linalg.norm(corrected[:count] - raw_after[:count], axis=1).max()))]

report_file = out / 'report.json'
reports = json.loads(report_file.read_text()) if report_file.exists() else []
first = reports[-1]['frame'] + 1 if reports else 2
if first > 2:
    value = sample(first - 1)
    value[:count] = np.fromfile(out / f'cloth-{first - 1}.bin', dtype='<f8').reshape(-1, 3)
    assert not ipctk.has_intersections(mesh, value)
started = time.perf_counter()
for frame in range(first, len(data['frames']) + 1):
    value, keys = advance(value, sample(frame - 1), sample(frame), frame)
    value[:count].astype('<f8').tofile(out / f'cloth-{frame}.bin')
    reports.append(dict(frame=frame, time=data['frames'][frame - 1]['time'], keys=keys))
    temporary = out / 'report.json.tmp'
    temporary.write_text(json.dumps(reports, indent=2))
    temporary.replace(report_file)
    print(json.dumps(dict(acceptedFrame=frame, time=data['frames'][frame - 1]['time'], keys=len(keys),
        maximumRawDisplacement=max(key['displacementFromRawMetres'] for key in keys),
        seconds=time.perf_counter() - started)), flush=True)
