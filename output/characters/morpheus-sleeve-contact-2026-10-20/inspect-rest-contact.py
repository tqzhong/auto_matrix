"""Measure artificial contact forces on the actual unstrained complete garment."""
import json
import numpy as np
import ipctk
from ipc_cloth import prepare, BASE

points, _, _, _, _, mass, pins, _, body, faces, _ = prepare(full_surface=True)
positions = np.vstack((points, body[0]))
mesh = ipctk.CollisionMesh(positions, ipctk.edges(faces), faces)
mesh.can_collide = ipctk.make_static_obstacle_filter(len(points))
h = 1/120
free = (np.setdiff1d(np.arange(len(points)), pins)[:, None]*3+np.arange(3)).ravel()
physical = np.zeros_like(points)
physical[:, 2] = mass*9.81
rows = []
for dhat in [.001, .00001]:
    contacts = ipctk.NormalCollisions()
    contacts.build(mesh, positions, dhat)
    unit = ipctk.BarrierPotential(dhat, 1.)
    gradient = unit.gradient(contacts, mesh, positions)
    stiffness, _ = ipctk.initial_barrier_stiffness(
        float(np.linalg.norm(np.ptp(positions, axis=0))), ipctk.ClampedLogBarrier(),
        dhat, float(mass.mean()/h**2), physical.ravel()[free], gradient[free])
    forces = stiffness*gradient[:points.size].reshape(-1, 3)
    row = {'activationMetres': dhat, 'contactCount': len(contacts),
           'restBarrierEnergy': float(stiffness*unit(contacts, mesh, positions)),
           'barrierStiffness': stiffness,
           'maximumRestForceNewtons': float(np.linalg.norm(forces, axis=1).max()),
           'restPhysicalEnergy': float(.5*mass.sum()*9.81**2*h**2)}
    rows.append(row)
    print(json.dumps(row), flush=True)
(BASE/'rest-contact-forces.json').write_text(json.dumps(rows, indent=2)+'\n')
