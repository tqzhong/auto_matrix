"""Offline sewn-coat control with continuous contact; never edits runtime assets."""
import argparse
import json
import hashlib
import shutil
import time
from pathlib import Path
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import spsolve
import ipctk
from cloth_embedding import embed_panels
from continuous_check import measure_step

BASE = Path(__file__).parent
STRAIN_ONSET = 1.03
STRAIN_LIMIT = 1.1


class ClothStepError(RuntimeError):
    pass


def prescribed_response(gradient, hessian, free, fixed_motion):
    """Move the free garment with imposed cuff/body motion before CCD."""
    motion = fixed_motion.ravel().copy()
    rhs = -gradient[free]-(hessian[free]@motion)
    motion[free] = spsolve(hessian[free][:, free].tocsc(), rhs)
    return motion.reshape(fixed_motion.shape)


def strain_free_stepsize(x, direction, edges, rest):
    """Keep every structural edge below its length limit along the whole step."""
    a, b = edges.T
    delta = x[a]-x[b]
    step = direction[a]-direction[b]
    square_limit = (STRAIN_LIMIT*rest)**2
    constant = np.sum(delta**2, axis=1)-square_limit
    if np.any(constant >= 0):
        raise ClothStepError('the structural edges already exceed their strain limit')
    crossing = np.sum((delta+step)**2, axis=1) >= square_limit
    if not np.any(crossing):
        return 1.
    quadratic = np.sum(step[crossing]**2, axis=1)
    linear = 2*np.sum(delta[crossing]*step[crossing], axis=1)
    constant = constant[crossing]
    discriminant = np.sqrt(linear**2-4*quadratic*constant)
    roots = np.empty_like(linear)
    forward = linear >= 0
    roots[forward] = -2*constant[forward]/(linear[forward]+discriminant[forward])
    roots[~forward] = (-linear[~forward]+discriminant[~forward])/(2*quadratic[~forward])
    return float(.99*np.min(roots))


def springs(x, edges, rest, stiffness, project=True, strain_count=0):
    """Length springs, including explicit stitches and weak bending diagonals."""
    n = len(x)
    a, b = edges.T
    delta = x[a]-x[b]
    length = np.linalg.norm(delta, axis=1)
    unit = delta/length[:, None]
    stretch = length-rest
    energy = .5*np.sum(stiffness*stretch**2)
    radial_force = stiffness*stretch
    radial_hessian = stiffness.copy()
    transverse = 1-rest/length
    if project:
        transverse = np.maximum(0, transverse)
    transverse *= stiffness
    # A smooth logarithmic barrier augments the existing spring material.
    # It limits structural edges, not stitches or bending diagonals.
    ratio = length[:strain_count]/rest[:strain_count]
    if np.any(ratio >= STRAIN_LIMIT):
        raise ClothStepError('the structural edges exceed their strain limit')
    active = np.flatnonzero(ratio > STRAIN_ONSET)
    amount = ratio[active]-STRAIN_ONSET
    gap = STRAIN_LIMIT-ratio[active]
    logarithm = np.log(gap/(STRAIN_LIMIT-STRAIN_ONSET))
    barrier = -amount**2*logarithm
    first = -2*amount*logarithm+amount**2/gap
    second = -2*logarithm+4*amount/gap+(amount/gap)**2
    energy += np.sum(stiffness[active]*rest[active]**2*barrier)
    added_force = stiffness[active]*rest[active]*first
    radial_force[active] += added_force
    radial_hessian[active] += stiffness[active]*second
    transverse[active] += added_force/length[active]
    force = radial_force[:, None]*unit
    gradient = np.zeros_like(x)
    np.add.at(gradient, a, force)
    np.add.at(gradient, b, -force)
    outer = unit[:, :, None]*unit[:, None, :]
    blocks = radial_hessian[:, None, None]*outer+transverse[:, None, None]*(np.eye(3)-outer)
    ia = (3*a[:, None]+np.arange(3)).repeat(3, axis=1).ravel()
    ja = np.tile(3*a[:, None]+np.arange(3), (1, 3)).ravel()
    ib = (3*b[:, None]+np.arange(3)).repeat(3, axis=1).ravel()
    jb = np.tile(3*b[:, None]+np.arange(3), (1, 3)).ravel()
    values = blocks.ravel()
    hessian = sp.coo_matrix((np.r_[values, values, -values, -values],
        (np.r_[ia, ib, ia, ib], np.r_[ja, jb, jb, ja])), shape=(3*n, 3*n)).tocsr()
    return float(energy), gradient.ravel(), hessian


def prepare(full_surface=False):
    cage = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
    manifest = json.loads((BASE/'input/manifest.json').read_text())
    guide = json.loads((BASE/'lifted-band/band-guide.json').read_text())
    cuffs = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/boundary-controls.json').read_text())['cuffs']
    if full_surface:
        cage = {**manifest, 'mappedControls': {str(i): i for i in range(len(manifest['points']))}}
        # The real rim follows the same authored path. Interior facing vertices
        # remain material DOFs: transporting that strip as hard pins distorted it.
        guide = json.loads((BASE/'lifted-band/collar-guide.json').read_text())
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


def bake(frame_end, substeps, output, raw_newton=False, resume=None, full_surface=False):
    ipctk.set_num_threads(4)
    points, faces, edges, rest, stiffness, mass, pins, pin_frames, body, all_faces, structural_count = prepare(full_surface)
    n = len(points)
    x = np.vstack((points, body[0]))
    reference = x.copy()
    cage = json.loads((BASE.parent/'morpheus-shoulder-release-2026-10-20/cage-fit-4.json').read_text())
    manifest = json.loads((BASE/'input/manifest.json').read_text())
    if full_surface:
        embedding = sp.eye(n, format='csc')
        embedding_report = {'type': 'identity', 'physicalVertices': n, 'displayVertices': n,
                            'nonzeros': n, 'maximumRestErrorMetres': 0.}
    else:
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
    unit_barrier = ipctk.BarrierPotential(dhat, 1.)
    potential = unit_barrier
    diagonal = float(np.linalg.norm(np.ptp(collision_reference, axis=0)))
    h = 1/(30*substeps)
    inertial = np.repeat(mass/h**2, 3)
    inertial_hessian = sp.diags(inertial, format='csr')
    velocity = np.zeros_like(points)
    out = BASE/output
    out.mkdir(exist_ok=False)
    samples = out/'substeps'
    samples.mkdir(exist_ok=True)
    (out/'embedding.json').write_text(json.dumps(embedding_report, indent=2))
    rows = []
    sample_rows = []
    rejections = []
    started = time.perf_counter()
    resumed_at = None
    if resume:
        source = BASE/resume
        checkpoint = np.load(source/'substeps/checkpoint.npz')
        x[:] = checkpoint['positions']
        velocity[:] = checkpoint['velocity']
        resumed_at = float(checkpoint['time'])
        coordinate = (resumed_at-.8)*30
        lower = min(int(np.floor(coordinate)), len(body)-2)
        blend = coordinate-lower
        body_error = float(np.max(np.abs(x[n:]-((1-blend)*body[lower]+blend*body[lower+1]))))
        pin_error = float(np.max(np.abs(x[pins]-((1-blend)*pin_frames[lower]+blend*pin_frames[lower+1]))))
        assert body_error < 1e-12 and pin_error < 1e-12, 'checkpoint does not match the current body/cuff paths'
        rows = json.loads((source/'progress.json').read_text())
        sample_rows = json.loads((source/'substeps/progress.json').read_text())
        assert sample_rows[-1]['time'] == resumed_at
        assert sample_rows[-1]['stepCollisionFree'] and not sample_rows[-1]['endpointIntersects']
        last = sample_rows[-1]['frame']
        shown_before = np.vstack([np.fromfile(source/f'substeps/{part}-{last}.bin', np.float32).reshape(-1, 3)
                                  for part in ('cloth', 'body')])
        assert np.array_equal(surface(x).astype(np.float32), shown_before), 'checkpoint changed the displayed surface'
        for target, origin, records in ((out, source, rows), (samples, source/'substeps', sample_rows)):
            for row in records:
                for part in ('cage', 'cloth', 'body'):
                    name = f'{part}-{row["frame"]}.bin'
                    shutil.copyfile(origin/name, target/name)
            (target/'progress.json').write_text(json.dumps(records, indent=2))
        shutil.copyfile(source/'substeps/checkpoint.npz', samples/'checkpoint.npz')
        assert not ipctk.has_intersections(mesh, surface(x)), 'checkpoint intersects'
        print(json.dumps({'resumedAt': resumed_at, 'acceptedSamples': len(sample_rows),
            'bodyErrorMetres': body_error, 'pinErrorMetres': pin_error, 'displayUnchanged': True}), flush=True)
    (out/'run.json').write_text(json.dumps({'resume': resume, 'resumedAt': resumed_at,
        'requestedEnd': .8+(frame_end-1)/30, 'maximumStepSeconds': h,
        'fullSurfacePhysics': full_surface, 'physicalVertices': n,
        'displayVertices': visible_count, 'prescribedVertices': len(pins),
        'structuralStrainOnset': STRAIN_ONSET, 'structuralStrainLimit': STRAIN_LIMIT,
        'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}, indent=2))

    def evaluate(state, predicted, derivatives=True, project=True):
        energy, gradient, hessian = springs(state[:n], edges, rest, stiffness,
            project=project, strain_count=structural_count)
        delta = (state[:n]-predicted).ravel()
        energy += .5*np.dot(inertial*delta, delta)
        visible = surface(state)
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, visible, dhat)
        energy += potential(contacts, mesh, visible)
        if not derivatives:
            return energy
        full_gradient = mesh.to_full_dof(potential.gradient(contacts, mesh, visible))
        full_gradient[:3*n] += gradient + inertial*delta
        full_hessian = mesh.to_full_dof(potential.hessian(contacts, mesh, visible,
            project_hessian_to_psd=ipctk.PSDProjectionMethod.CLAMP))
        full_hessian += sp.block_diag((hessian+inertial_hessian,
            sp.csr_matrix((x[n:].size, x[n:].size))), format='csr')
        return energy, full_gradient, full_hessian

    def relax(predicted):
        for iteration in range(200):
            energy, full_gradient, full_hessian = evaluate(x, predicted, project=not raw_newton)
            gradient, hessian = full_gradient[free], full_hessian[free][:, free]
            displacement = spsolve(hessian.tocsc(), -gradient)
            if gradient@displacement >= 0:
                energy, full_gradient, full_hessian = evaluate(x, predicted, project=True)
                gradient, hessian = full_gradient[free], full_hessian[free][:, free]
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
            alpha = min(alpha, strain_free_stepsize(x, direction, edges[:structural_count], rest[:structural_count]))
            slope = float(gradient@displacement)
            assert slope < 0, ('non-descent direction', slope)
            while alpha > 1e-10:
                if evaluate(x+alpha*direction, predicted, False) <= energy+1e-4*alpha*slope:
                    break
                alpha *= .5
            if alpha <= 1e-10:
                raise ClothStepError(f'line search stalled: residual={residual}, energy={energy}')
            x[:] += alpha*direction
            if iteration % 20 == 0:
                print(json.dumps({'iteration': iteration, 'energy': energy, 'residual': residual,
                    'maximumNewtonStep': float(np.max(np.abs(displacement))), 'alpha': alpha}), flush=True)
        raise ClothStepError(f'contact solve did not converge: residual={residual}')

    def save_sample(at, source_frame, substep):
        visible = surface(x).astype(np.float32)
        exported = x[:n].astype(np.float32).astype(float)
        lengths = np.linalg.norm(exported[edges[:structural_count, 0]]-exported[edges[:structural_count, 1]], axis=1)/rest[:structural_count]
        if np.max(lengths) >= STRAIN_LIMIT:
            raise ClothStepError(f'the exported garment exceeds its strain limit: {np.max(lengths)}')
        number = len(sample_rows)+1
        previous = np.fromfile(samples/f'cloth-{number-1}.bin', np.float32).reshape(-1, 3) if number > 1 else visible[:visible_count]
        previous_body = np.fromfile(samples/f'body-{number-1}.bin', np.float32).reshape(-1, 3) if number > 1 else visible[visible_count:]
        check = measure_step(mesh, np.vstack((previous, previous_body)).astype(float), visible.astype(float))
        row = {'frame': number, 'time': at, 'sourceFrame': source_frame, 'substep': substep,
               'integrationSeconds': h if number > 1 else 0.,
               'maximumEdgeStretch': float(np.max(lengths)), **check}
        if check['endpointIntersects'] or not check['stepCollisionFree']:
            raise ClothStepError(f'the exported substep crosses: {row}')
        x[:n].astype(np.float32).tofile(samples/f'cage-{number}.bin')
        visible[:visible_count].tofile(samples/f'cloth-{number}.bin')
        visible[visible_count:].tofile(samples/f'body-{number}.bin')
        sample_rows.append(row)
        (samples/'progress.json').write_text(json.dumps(sample_rows, indent=2))
        np.savez(samples/'checkpoint.npz', positions=x, velocity=velocity, time=at,
            source_frame=source_frame, substep=substep)
        print(json.dumps({'acceptedSample': row}), flush=True)

    def advance_interval(frame, start_blend, blend, steps, depth=0):
        nonlocal h, inertial, inertial_hessian, velocity, potential
        previous = x.copy()
        previous_velocity = velocity.copy()
        h = (blend-start_blend)/30
        inertial = np.repeat(mass/h**2, 3)
        inertial_hessian = sp.diags(inertial, format='csr')
        wanted_body = body[frame-1]*(1-blend)+body[frame]*blend
        wanted_pins = pin_frames[frame-1]*(1-blend)+pin_frames[frame]*blend
        predicted = previous[:n]+h*velocity
        predicted[:, 2] -= h*h*9.81
        visible = surface(x)
        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, visible, dhat)
        _, physical_gradient, _ = springs(x[:n], edges, rest, stiffness, strain_count=structural_count)
        physical_gradient += inertial*(x[:n]-predicted).ravel()
        barrier_gradient = mesh.to_full_dof(unit_barrier.gradient(contacts, mesh, visible))
        # This objective uses M/h² rather than M, so scale the toolkit's
        # mass-based lower stiffness bound by the same time factor.
        barrier_stiffness, maximum_stiffness = ipctk.initial_barrier_stiffness(
            diagonal, ipctk.ClampedLogBarrier(), dhat, float(mass.mean()/h**2),
            physical_gradient[free], barrier_gradient[free])
        potential = ipctk.BarrierPotential(dhat, barrier_stiffness)
        print(json.dumps({'sourceFrame': frame+1, 'sourceBlend': blend,
            'integrationSeconds': h, 'barrierStiffness': barrier_stiffness,
            'maximumBarrierStiffness': maximum_stiffness,
            'minimumGapMetres': float(np.sqrt(contacts.compute_minimum_distance(mesh, visible)))}), flush=True)
        try:
            for advance in range(80):
                fixed = np.zeros_like(x)
                fixed[n:] = wanted_body-x[n:]
                fixed[pins] = wanted_pins-x[pins]
                _, gradient, hessian = evaluate(x, predicted)
                direction = prescribed_response(gradient, hessian, free, fixed)
                alpha = ipctk.compute_collision_free_stepsize(mesh, surface(x), surface(x+direction))
                alpha = min(alpha, strain_free_stepsize(x, direction, edges[:structural_count], rest[:structural_count]))
                x[:] += alpha*direction
                iterations, residual = relax(predicted)
                print(json.dumps({'sourceFrame': frame+1, 'sourceBlend': blend, 'advance': advance+1,
                    'prescribedFraction': alpha, 'remainingBodyMetres': float(np.max(np.abs(x[n:]-wanted_body))),
                    'remainingPinsMetres': float(np.max(np.abs(x[pins]-wanted_pins)))}), flush=True)
                if alpha == 1:
                    break
            else:
                raise ClothStepError('prescribed body/cuff advance stalled')
            velocity = (x[:n]-previous[:n])/h
            save_sample(.8+(frame-1+blend)/30, frame+1, blend*substeps)
        except ClothStepError as error:
            rejection = {'number': len(rejections)+1, 'sourceFrame': frame+1,
                'startTime': .8+(frame-1+start_blend)/30, 'endTime': .8+(frame-1+blend)/30,
                'depth': depth, 'error': str(error)}
            np.savez(samples/f'rejected-{rejection["number"]}.npz', previous=previous,
                previous_velocity=previous_velocity, positions=x, velocity=velocity)
            rejections.append(rejection)
            (out/'rejections.json').write_text(json.dumps(rejections, indent=2))
            print(json.dumps({'rejected': rejection}), flush=True)
            x[:] = previous
            velocity[:] = previous_velocity
            if depth >= 8:
                raise
            middle = (start_blend+blend)/2
            advance_interval(frame, start_blend, middle, steps, depth+1)
            advance_interval(frame, middle, blend, steps, depth+1)
            return
        steps.append({'sourceBlend': blend, 'integrationSeconds': h, 'advances': advance+1,
            'iterations': iterations, 'residual': residual})

    if not resume:
        save_sample(.8, 1, 0)
    for frame in range(frame_end):
        if resumed_at is not None and .8+frame/30 <= resumed_at+1e-10:
            continue
        steps = []
        if frame:
            for substep in range(1, substeps+1):
                blend = substep/substeps
                start_blend = (sample_rows[-1]['time']-.8)*30-(frame-1)
                if blend <= start_blend+1e-9:
                    continue
                advance_interval(frame, start_blend, blend, steps)
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
    (samples/'summary.json').write_text(json.dumps(sample_rows, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames', type=int, default=25)
    parser.add_argument('--substeps', type=int, default=4)
    parser.add_argument('--output', default='ipc-physics')
    parser.add_argument('--raw-newton', action='store_true')
    parser.add_argument('--resume')
    parser.add_argument('--full-surface', action='store_true')
    args = parser.parse_args()
    bake(args.frames, args.substeps, args.output, args.raw_newton, args.resume, args.full_surface)
