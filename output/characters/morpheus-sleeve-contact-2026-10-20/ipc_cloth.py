"""Offline sewn-coat control with continuous contact; never edits runtime assets."""
import argparse
import json
import time
from pathlib import Path
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import spsolve
import ipctk
from cloth_embedding import embed_panels

BASE = Path(__file__).parent


def springs(x, edges, rest, stiffness, project=True):
    """Length springs, including explicit stitches and weak bending diagonals."""
    n = len(x)
    a, b = edges.T
    delta = x[a]-x[b]
    length = np.linalg.norm(delta, axis=1)
    unit = delta/length[:, None]
    stretch = length-rest
    energy = .5*np.sum(stiffness*stretch**2)
    force = (stiffness*stretch)[:, None]*unit
    gradient = np.zeros_like(x)
    np.add.at(gradient, a, force)
    np.add.at(gradient, b, -force)
    transverse = 1-rest/length
    if project:
        transverse = np.maximum(0, transverse)
    outer = unit[:, :, None]*unit[:, None, :]
    blocks = stiffness[:, None, None]*(outer+transverse[:, None, None]*(np.eye(3)-outer))
    ia = (3*a[:, None]+np.arange(3)).repeat(3, axis=1).ravel()
    ja = np.tile(3*a[:, None]+np.arange(3), (1, 3)).ravel()
    ib = (3*b[:, None]+np.arange(3)).repeat(3, axis=1).ravel()
    jb = np.tile(3*b[:, None]+np.arange(3), (1, 3)).ravel()
    values = blocks.ravel()
    hessian = sp.coo_matrix((np.r_[values, values, -values, -values],
        (np.r_[ia, ib, ia, ib], np.r_[ja, jb, jb, ja])), shape=(3*n, 3*n)).tocsr()
    return float(energy), gradient.ravel(), hessian


def prepare():
    cage = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
    manifest = json.loads((BASE/'input/manifest.json').read_text())
    guide = json.loads((BASE/'lifted-band/band-guide.json').read_text())
    cuffs = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/boundary-controls.json').read_text())['cuffs']
    points = np.asarray(cage['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
    faces = np.asarray(cage['indices'], dtype=np.int32).reshape(-1, 3)
    edges = ipctk.edges(faces)
    area = np.linalg.norm(np.cross(points[faces[:, 1]]-points[faces[:, 0]], points[faces[:, 2]]-points[faces[:, 0]]), axis=1)/2
    mass = np.zeros(len(points))
    for column in faces.T:
        np.add.at(mass, column, area/3)
    mass *= 3/mass.sum()
    lookup = {tuple(sorted(e)): i for i, e in enumerate(edges)}
    edge_area = np.zeros(len(edges))
    opposite = [[] for _ in edges]
    for face, value in zip(faces, area):
        for i in range(3):
            a, b, other = face[i], face[(i+1)%3], face[(i+2)%3]
            index = lookup[tuple(sorted((a, b)))]
            edge_area[index] += value/3
            opposite[index].append(int(other))
    rest = np.linalg.norm(points[edges[:, 0]]-points[edges[:, 1]], axis=1)
    stiffness = 50000*edge_area/rest**2
    # Retain the same complete panels and sewn roots as the Blender control.
    stitches = set()
    display = np.asarray(manifest['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
    coat = np.asarray(cage['parts'][0]['vertices'])
    for part_index, part in enumerate(cage['parts'][1:], 1):
        source = manifest['parts'][part_index]['vertices']
        for vertex in part['vertices']:
            local = int(np.argmin(np.linalg.norm(display[source]-points[vertex], axis=1)))
            seam = local % 7 <= 1 if part_index == 1 else local < 82
            if seam:
                distances = np.linalg.norm(points[coat]-points[vertex], axis=1)
                for target in coat[np.argsort(distances)[:3]]:
                    stitches.add(tuple(sorted((vertex, int(target)))))
    bending = np.asarray([pair for pair in opposite if len(pair) == 2], dtype=np.int32)
    stitches = np.asarray(sorted(stitches), dtype=np.int32)
    structural_count = len(edges)
    edges = np.vstack((edges, stitches, bending))
    stiffness = np.r_[stiffness, np.full(len(stitches), 50000.), np.full(len(bending), .03)]
    rest = np.linalg.norm(points[edges[:, 0]]-points[edges[:, 1]], axis=1)
    assert np.all(rest > 0)
    pin_ids = list(guide['ids'])
    pin_frames = np.asarray([f['points'] for f in guide['frames']])[:, :, [0, 2, 1]]*[.4, -.4, .4]
    for cuff in cuffs:
        ids = [cage['mappedControls'][str(i)] for i in cuff['ring']]
        pin_ids.extend(ids)
        matrix = lambda f: np.asarray(next(v for v in f['cuffs'] if v['side'] == cuff['side'])['matrix']).reshape(4, 4, order='F')
        initial_inverse = np.linalg.inv(matrix(manifest['frames'][0]))
        source = np.c_[np.asarray(cage['points'])[ids], np.ones(len(ids))]
        path = [(source@(matrix(f)@initial_inverse).T)[:, :3] for f in manifest['frames']]
        pin_frames = np.concatenate((pin_frames, np.asarray(path)[:, :, [0, 2, 1]]*[.4, -.4, .4]), axis=1)
    assert np.max(np.abs(pin_frames[0]-points[pin_ids])) < 1e-10
    offset = len(points)
    combined_faces = [faces]
    for part in manifest['bodies']:
        combined_faces.append(np.asarray(part['indices']).reshape(-1, 3)+offset)
        offset += part['count']
    body = np.asarray([np.fromfile(BASE/f'input/body-{frame["frame"]}.bin', np.float32).reshape(-1, 3) for frame in manifest['frames']], dtype=float)
    return points, faces, edges, rest, stiffness, mass, np.asarray(pin_ids), pin_frames, body, np.vstack(combined_faces), structural_count


def bake(frame_end, substeps, output, raw_newton=False):
    ipctk.set_num_threads(4)
    points, faces, edges, rest, stiffness, mass, pins, pin_frames, body, all_faces, structural_count = prepare()
    n = len(points)
    x = np.vstack((points, body[0]))
    reference = x.copy()
    cage = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
    manifest = json.loads((BASE/'input/manifest.json').read_text())
    embedding, embedding_report = embed_panels(cage, manifest)
    shown = np.asarray(manifest['points'])[:, [0, 2, 1]]*[.4, -.4, .4]
    visible_count = len(shown)
    collision_reference = np.vstack((shown, body[0]))
    all_faces = np.vstack((np.asarray(manifest['indices']).reshape(-1, 3), all_faces[len(faces):]+visible_count-n))
    mapping = sp.block_diag((embedding, sp.eye(len(body[0]))), format='csc')
    mesh = ipctk.CollisionMesh(collision_reference, ipctk.edges(all_faces), all_faces, mapping)
    mesh.can_collide = ipctk.make_static_obstacle_filter(visible_count)
    surface = lambda state: mesh.displace_vertices(state-reference)
    assert not ipctk.has_intersections(mesh, surface(x)), 'the input garment already intersects'
    free_vertices = np.setdiff1d(np.arange(n), pins)
    free = (free_vertices[:, None]*3+np.arange(3)).ravel()
    dhat = .001
    potential = ipctk.BarrierPotential(dhat, 1e6)
    h = 1/(30*substeps)
    inertial = np.repeat(mass/h**2, 3)
    inertial_hessian = sp.diags(inertial, format='csr')
    velocity = np.zeros_like(points)
    out = BASE/output
    out.mkdir(exist_ok=True)
    (out/'embedding.json').write_text(json.dumps(embedding_report, indent=2))
    rows = []
    started = time.perf_counter()

    def evaluate(state, predicted, derivatives=True, project=True):
        energy, gradient, hessian = springs(state[:n], edges, rest, stiffness, project=project)
        delta = (state[:n]-predicted).ravel()
        energy += .5*np.dot(inertial*delta, delta)
        visible = surface(state)
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, visible, dhat)
        energy += potential(contacts, mesh, visible)
        if not derivatives:
            return energy
        gradient += inertial*delta + mesh.to_full_dof(potential.gradient(contacts, mesh, visible))[:3*n]
        hessian += inertial_hessian + mesh.to_full_dof(potential.hessian(contacts, mesh, visible,
            project_hessian_to_psd=ipctk.PSDProjectionMethod.CLAMP))[:3*n, :3*n]
        return energy, gradient[free], hessian[free][:, free]

    def relax(predicted):
        for iteration in range(200):
            energy, gradient, hessian = evaluate(x, predicted, project=not raw_newton)
            displacement = spsolve(hessian.tocsc(), -gradient)
            if gradient@displacement >= 0:
                energy, gradient, hessian = evaluate(x, predicted, project=True)
                displacement = spsolve(hessian.tocsc(), -gradient)
            residual = float(np.linalg.norm(gradient, np.inf))
            # A one-micrometre Newton update is below displayed cloth detail.
            # This only stops energy minimization; CCD and zero-intersection
            # checks remain independent and are not relaxed.
            if np.max(np.abs(displacement)) < 1e-6:
                return iteration, residual
            direction = np.zeros_like(x)
            direction.ravel()[free] = displacement
            alpha = ipctk.compute_collision_free_stepsize(mesh, surface(x), surface(x+direction))
            slope = float(gradient@displacement)
            assert slope < 0, ('non-descent direction', slope)
            while alpha > 1e-10:
                if evaluate(x+alpha*direction, predicted, False) <= energy+1e-4*alpha*slope:
                    break
                alpha *= .5
            if alpha <= 1e-10:
                raise RuntimeError(f'line search stalled: residual={residual}, energy={energy}')
            x[:] += alpha*direction
            if iteration % 20 == 0:
                print(json.dumps({'iteration': iteration, 'energy': energy, 'residual': residual,
                    'maximumNewtonStep': float(np.max(np.abs(displacement))), 'alpha': alpha}), flush=True)
        raise RuntimeError(f'contact solve did not converge: residual={residual}')

    for frame in range(frame_end):
        steps = []
        if frame:
            for substep in range(1, substeps+1):
                blend = substep/substeps
                wanted_body = body[frame-1]*(1-blend)+body[frame]*blend
                wanted_pins = pin_frames[frame-1]*(1-blend)+pin_frames[frame]*blend
                previous = x[:n].copy()
                predicted = previous+h*velocity
                predicted[:, 2] -= h*h*9.81
                # Move fixed geometry only as far as CCD permits; relax the free
                # panels before advancing again. Never teleport a collider through cloth.
                for advance in range(80):
                    target = x.copy()
                    target[n:] = wanted_body
                    target[pins] = wanted_pins
                    alpha = ipctk.compute_collision_free_stepsize(mesh, surface(x), surface(target))
                    x[:] += alpha*(target-x)
                    iterations, residual = relax(predicted)
                    if alpha == 1:
                        break
                else:
                    raise RuntimeError('prescribed body/cuff advance stalled')
                velocity = (x[:n]-previous)/h
                steps.append({'substep': substep, 'advances': advance+1, 'iterations': iterations, 'residual': residual})
        visible = surface(x)
        assert not ipctk.has_intersections(mesh, visible), f'frame {frame+1} intersects'
        x[:n].astype(np.float32).tofile(out/f'cage-{frame+1}.bin')
        visible[:visible_count].astype(np.float32).tofile(out/f'cloth-{frame+1}.bin')
        x[n:].astype(np.float32).tofile(out/f'body-{frame+1}.bin')
        lengths = np.linalg.norm(x[edges[:structural_count, 0]]-x[edges[:structural_count, 1]], axis=1)/rest[:structural_count]
        row = {'frame': frame+1, 'time': .8+frame/30, 'seconds': time.perf_counter()-started,
               'steps': steps, 'maximumEdgeStretch': float(lengths.max()), 'p99EdgeStretch': float(np.quantile(lengths, .99)),
               'bodyDifference': float(np.max(np.abs(x[n:]-body[frame])))}
        rows.append(row)
        (out/'progress.json').write_text(json.dumps(rows, indent=2))
        print(json.dumps(row), flush=True)
    (out/'summary.json').write_text(json.dumps(rows, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames', type=int, default=25)
    parser.add_argument('--substeps', type=int, default=4)
    parser.add_argument('--output', default='ipc-physics')
    parser.add_argument('--raw-newton', action='store_true')
    args = parser.parse_args()
    bake(args.frames, args.substeps, args.output, args.raw_newton)
