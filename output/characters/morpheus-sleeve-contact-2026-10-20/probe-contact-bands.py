"""Bounded full-surface control: change only self/body contact activation.

The current solver and every geometry, material, convergence, export and
continuous-playback gate remain in use. This does not replace its live bake.
"""
import hashlib
from pathlib import Path
import subprocess

base = Path(__file__).parent
source = subprocess.run(['git', 'show',
    '27915fa:output/characters/morpheus-sleeve-contact-2026-10-20/ipc_cloth.py'],
    cwd=base, check=True, capture_output=True, text=True).stdout
assert hashlib.sha256(source.encode()).hexdigest() == 'bd4b011851e36260ef08099cae7f9bd8eed7bcf76f491e360ac21c377e58c116'
replacements = {
    'from cloth_embedding import embed_panels':
        'from cloth_embedding import embed_panels\nfrom contact_bands import contact_bands',
    '    potential = unit_barrier\n':
        '    bands = contact_bands(collision_reference, ipctk.edges(all_faces), all_faces, mapping, visible_count)\n'
        '    potentials = [ipctk.BarrierPotential(radius, 1.) for _, radius in bands]\n',
    '''        contacts = ipctk.NormalCollisions()
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
        return energy, full_gradient, full_hessian''':
    '''        if derivatives:
            full_gradient = np.zeros(x.size)
            full_gradient[:3*n] = gradient + inertial*delta
            full_hessian = sp.block_diag((hessian+inertial_hessian,
                sp.csr_matrix((x[n:].size, x[n:].size))), format='csr')
        for (contact_mesh, radius), potential in zip(bands, potentials):
            contacts = ipctk.NormalCollisions()
            contacts.build(contact_mesh, visible, radius)
            energy += potential(contacts, contact_mesh, visible)
            if derivatives:
                full_gradient += contact_mesh.to_full_dof(potential.gradient(contacts, contact_mesh, visible))
                full_hessian += contact_mesh.to_full_dof(potential.hessian(contacts, contact_mesh, visible,
                    project_hessian_to_psd=ipctk.PSDProjectionMethod.CLAMP))
        return (energy, full_gradient, full_hessian) if derivatives else energy''',
    'nonlocal h, inertial, inertial_hessian, velocity, potential':
        'nonlocal h, inertial, inertial_hessian, velocity, potentials',
    '''        contacts = ipctk.NormalCollisions()
        contacts.build(mesh, visible, dhat)
        _, physical_gradient, _ = material(x)
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
            'minimumGapMetres': float(np.sqrt(contacts.compute_minimum_distance(mesh, visible))) if len(contacts) else None}), flush=True)''':
    '''        _, physical_gradient, _ = material(x)
        physical_gradient += inertial*(x[:n]-predicted).ravel()
        potentials = []
        for contact_mesh, radius in bands:
            contacts = ipctk.NormalCollisions()
            contacts.build(contact_mesh, visible, radius)
            unit = ipctk.BarrierPotential(radius, 1.)
            barrier_gradient = contact_mesh.to_full_dof(unit.gradient(contacts, contact_mesh, visible))
            barrier_stiffness, maximum_stiffness = ipctk.initial_barrier_stiffness(
                diagonal, ipctk.ClampedLogBarrier(), radius, float(mass.mean()/h**2),
                physical_gradient[free], barrier_gradient[free])
            potentials.append(ipctk.BarrierPotential(radius, barrier_stiffness))
            print(json.dumps({'sourceFrame': frame+1, 'sourceBlend': blend,
                'integrationSeconds': h, 'contactActivationMetres': radius,
                'barrierStiffness': barrier_stiffness, 'maximumBarrierStiffness': maximum_stiffness,
                'minimumGapMetres': float(np.sqrt(contacts.compute_minimum_distance(contact_mesh, visible))) if len(contacts) else None}), flush=True)''',
    "        'contactActivationMetres': CONTACT_ACTIVATION,":
        "        'contactActivationMetres': [radius for _, radius in bands],",
}
for before, after in replacements.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
target = base/'ipc_cloth-body-contact-control.py'
assert not target.exists(), 'Preserve an existing control'
target.write_text(source)
scope = {'__file__': str(target), '__name__': 'body_contact_control'}
exec(compile(source, str(target), 'exec'), scope)
scope['bake'](2, 4, 'ipc-body-lookahead-control', full_surface=True)
