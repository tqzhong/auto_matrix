"""Author continuous contact on all displayed coat faces, not its coarse cage.

The native guide retains its rejected solver report. This projection does not
claim native or cloth-energy convergence, natural materials or gameplay.
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
guide_name = sys.argv[1] if len(sys.argv) > 1 else 'preparation-full-physics'
guide, folder = base / guide_name, base / 'preparation-input'
out = base / (guide_name + '-contact')
data = json.loads((folder / 'manifest.json').read_text())
controls = json.loads((base / 'boundary-controls.json').read_text())
native = json.loads((guide / 'metadata.json').read_text())
native_rows = json.loads((guide / 'summary.json').read_text())
assert len(data['frames']) == len(native_rows) == 49
assert native['displayFaces'] == len(data['indices']) // 3 == 26916
count = len(data['points'])
out.mkdir(exist_ok=True)

def sample(frame):
    cloth = np.fromfile(guide / f'cloth-{frame}.bin', dtype='<f4').reshape(-1, 3)
    body = np.fromfile(folder / f'body-{frame}.bin', dtype='<f4').reshape(-1, 3)
    assert len(cloth) == count
    return np.vstack([cloth, body]).astype(np.float64)

value = sample(1)
cloth_faces = np.asarray(data['indices']).reshape(-1, 3)
faces, offset = [cloth_faces], count
for part in data['bodies']:
    faces.append(np.asarray(part['indices']).reshape(-1, 3) + offset)
    offset += part['count']
assert len(data['bodies']) == 13
faces = np.vstack(faces).astype(np.int32)
mesh = ipctk.CollisionMesh(value, ipctk.edges(faces), faces)
assert mesh.num_vertices == len(value)
mesh.can_collide = ipctk.VertexPatchesCanCollide(np.r_[np.arange(count, dtype=np.int32), np.full(len(value) - count, count, dtype=np.int32)])
assert not ipctk.has_intersections(mesh, value)
pins = np.zeros(count, dtype=bool)
pins[controls['protected']] = True
assert int(pins.sum()) == 189
anchors = np.r_[pins, np.ones(len(value) - count, dtype=bool)]
edges = ipctk.edges(cloth_faces)
row, column = np.r_[edges[:, 0], edges[:, 1]], np.r_[edges[:, 1], edges[:, 0]]
degree = np.bincount(row, minlength=count)
laplace = sparse.eye(count, format='csr') - sparse.coo_matrix((1 / degree[row], (row, column)), shape=(count, count)).tocsr()
quadratic = sparse.kron(sparse.block_diag([sparse.diags(np.where(pins, 1e10, 1.)) + 20 * (laplace.T @ laplace),
    sparse.eye(len(value) - count) * 1e10]), sparse.eye(3), format='csc')
source_files = ['construct-preparation-contact.py', 'feasible_shirt_projection.py', 'boundary-controls.json', 'preparation-input/manifest.json',
    guide_name + '/metadata.json', guide_name + '/summary.json']
hashes = {file:hashlib.sha256((base / file).read_bytes()).hexdigest() for file in source_files}
digest = hashlib.sha256()
for frame in data['frames']:
    for path in [guide / f"cloth-{frame['frame']}.bin", folder / f"body-{frame['frame']}.bin"]:
        digest.update(str(path.relative_to(base)).encode() + b'\0' + hashlib.sha256(path.read_bytes()).digest())
metadata = dict(sourceHashes=hashes, guideGeometrySha256=digest.hexdigest(), nativeGuide=guide_name,
    nativeGuideConverged=all(row['solverStatus'] == ['SUCCESS'] for row in native_rows[1:]),
    displayVertices=count, displayFaces=len(cloth_faces), allFaces=len(faces), innerLayers=13, boundaryAnchors=189, frames=49,
    coordinateType='float64', acceptedForProduction=False, energyEquilibriumProven=False,
    scope='All original visible garment faces, including vertex-neighbour intersections omitted by the native cloth guide. CCD covers linear keys; actual bone curves, appearance and full removal require independent checks.')
metadata_file = out / 'metadata.json'
if metadata_file.exists():
    assert json.loads(metadata_file.read_text()) == metadata, 'Resume only the identical authoring inputs.'
else:
    metadata_file.write_text(json.dumps(metadata, indent=2))
    value[:count].astype('<f8').tofile(out / 'cloth-1.bin')

def advance(before, raw_before, raw_after, frame, begin=0., end=1., depth=0):
    target = raw_after + before - raw_before
    target[anchors] = raw_after[anchors]
    try:
        corrected, report = project(mesh, before, target, quadratic, anchors, 2e-4,
            f'preparation-{frame}-{begin:.10f}-{end:.10f}', lambda row: print(json.dumps(row), flush=True))
    except NoFeasibleFrame as error:
        print(json.dumps(dict(rejectedFrame=frame, begin=begin, end=end, depth=depth, reason=str(error))), flush=True)
        assert depth < 8, (frame, begin, end, 'No continuous displayed-coat interval')
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
        displacementFromGuideMetres=float(np.linalg.norm(corrected[:count] - raw_after[:count], axis=1).max()))]

report_file = out / 'report.json'
reports = json.loads(report_file.read_text()) if report_file.exists() else []
first = reports[-1]['frame'] + 1 if reports else 2
if first > 2:
    value = sample(first - 1)
    value[:count] = np.fromfile(out / f'cloth-{first - 1}.bin', dtype='<f8').reshape(-1, 3)
    assert not ipctk.has_intersections(mesh, value)
started = time.perf_counter()
for frame in range(first, 50):
    value, keys = advance(value, sample(frame - 1), sample(frame), frame)
    value[:count].astype('<f8').tofile(out / f'cloth-{frame}.bin')
    reports.append(dict(frame=frame, time=data['frames'][frame - 1]['time'], keys=keys))
    temporary = out / 'report.json.tmp'
    temporary.write_text(json.dumps(reports, indent=2))
    temporary.replace(report_file)
    print(json.dumps(dict(acceptedFrame=frame, time=data['frames'][frame - 1]['time'], keys=len(keys),
        maximumGuideDisplacement=max(key['displacementFromGuideMetres'] for key in keys), seconds=time.perf_counter() - started)), flush=True)
