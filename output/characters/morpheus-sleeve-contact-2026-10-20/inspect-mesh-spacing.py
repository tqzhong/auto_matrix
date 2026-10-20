"""Locate real narrow features before changing any garment geometry or contact."""
import json
from collections import Counter
from pathlib import Path
import numpy as np
import ipctk
from ipc_cloth import prepare

base = Path(__file__).parent
ipctk.set_num_threads(4)
points, faces, edges, rest, stiffness, mass, pins, pin_frames, body, all_faces, count = prepare(True)
n = len(points)
manifest = json.loads((base/'input/manifest.json').read_text())
labels = [[] for _ in points]
for index, part in enumerate(manifest['parts']):
    for vertex in set(part['vertices']):
        labels[vertex].append(part['name'] or f'tail-{index}')
body_labels = []
for index, part in enumerate(manifest['bodies']):
    body_labels.extend([part['name'] or f'body-{index}']*part['count'])
labels += [[name] for name in body_labels]
reference = np.vstack((points, body[0]))
mesh = ipctk.CollisionMesh(reference, ipctk.edges(all_faces), all_faces)
mesh.can_collide = ipctk.make_static_obstacle_filter(n)
lengths = np.linalg.norm(points[faces]-points[np.roll(faces, 1, axis=1)], axis=2)
twice_area = np.linalg.norm(np.cross(points[faces[:, 1]]-points[faces[:, 0]],
                                     points[faces[:, 2]]-points[faces[:, 0]]), axis=1)
aspect = lengths.max(axis=1)**2/twice_area
short = np.argsort(twice_area/lengths.max(axis=1))[:6]
report = {'vertices': n, 'triangles': len(faces),
    'triangleAspectQuantiles': np.quantile(aspect, [0, .5, .95, .99, 1]).tolist(),
    'triangleMinimumHeightQuantilesMetres': np.quantile(twice_area/lengths.max(axis=1), [0, .01, .05, .5, 1]).tolist(),
    'smallestTriangles': [{'face': int(face), 'ids': faces[face].tolist(),
        'labels': [labels[i] for i in faces[face]], 'points': points[faces[face]].tolist(),
        'aspect': float(aspect[face]), 'minimumHeightMetres': float(twice_area[face]/lengths[face].max())}
        for face in short], 'states': []}
saved = np.load(base/'ipc-linear-resume-checkpoint/substeps/checkpoint.npz')
for name, state in [('rest', reference), ('accepted-27', saved['positions'])]:
    visible = mesh.displace_vertices(state-reference)
    contacts = ipctk.NormalCollisions()
    contacts.build(mesh, visible, .001)
    rows = []
    groups = Counter()
    for index in range(len(contacts)):
        collision = contacts[index]
        ids = [mesh.to_full_vertex_id(i) for i in collision.vertex_ids(mesh.edges, mesh.faces) if i >= 0]
        distance = float(np.sqrt(collision.compute_distance(visible, mesh.edges, mesh.faces)))
        group = '|'.join(sorted({label for i in ids for label in labels[i]}))
        groups[group] += 1
        rows.append({'type': type(collision).__name__, 'distanceMetres': distance,
            'ids': ids, 'labels': [labels[i] for i in ids], 'body': any(i >= n for i in ids),
            'points': state[ids].tolist()})
    rows.sort(key=lambda row: row['distanceMetres'])
    result = {'name': name, 'time': .8 if name == 'rest' else float(saved['time']),
        'contactCountWithin1mm': len(contacts), 'groups': dict(groups.most_common()),
        'closest': rows[:3], 'closestBody': [row for row in rows if row['body']][:3]}
    report['states'].append(result)
    print(json.dumps({'name': name, 'count': len(contacts), 'groups': result['groups'],
                      'closest': rows[:3]}), flush=True)
(base/'mesh-spacing.json').write_text(json.dumps(report, indent=2)+'\n')
