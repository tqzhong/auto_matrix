"""Move the candidate's complete spring material onto the displayed garment.

Keep the reduced inertia and displacement map for this isolated comparison.
No runtime assets or live full-surface bake are changed.
"""
import hashlib
from pathlib import Path

base = Path(__file__).resolve().parent
source = (base/'ipc_cloth-embedded-membrane-guarded-control.py').read_text()
assert hashlib.sha256(source.encode()).hexdigest() == 'f745dd98118865c547b7e23844deb5d131846c18ca3e2fa3134408ddc422ebed'
replacements = {
    "    membrane_rest = prepare_membrane(shown, display_faces)":
    "    _, _, fine_edges, fine_rest, fine_stiffness, *fine_data = prepare(True)\n"
    "    fine_structural_count = fine_data[-1]\n"
    "    membrane_rest = prepare_membrane(shown, display_faces)",
    '''        result = springs(state[:n], edges, rest, stiffness, project=project,
            strain_count=structural_count, structural_elastic=False, derivatives=derivatives)''':
    '''        visible = shown+embedding@(state[:n]-points)
        result = springs(visible, fine_edges, fine_rest, fine_stiffness, project=project,
            strain_count=fine_structural_count, structural_elastic=False, derivatives=derivatives)''',
    '        return energy+fine[0], gradient+fine[1], hessian+fine[2]':
    '''        return (energy+fine[0], membrane_dofs.T@gradient+fine[1],
                (membrane_dofs.T@hessian@membrane_dofs).tocsr()+fine[2])''',
    '''        if np.max(lengths) >= STRAIN_LIMIT:
            raise ClothStepError(f'the exported garment exceeds its strain limit: {np.max(lengths)}')
''': '',
    "        'displayVertices': visible_count, 'prescribedVertices': len(pins),":
    "        'displayVertices': visible_count, 'prescribedVertices': len(pins),\n"
    "        'materialDomain': 'complete displayed membrane, stitches, bending and strain barrier',\n"
    "        'inertiaDomain': 'area-lumped reduced cage, total 3 kg',\n"
    "        'coarseEdgeStretchDiagnosticOnly': True,",
}
for before, after in replacements.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
for indent in ('            ', '                '):
    before = '\n'+indent+'alpha = min(alpha, strain_free_stepsize(x, direction, edges[:structural_count], rest[:structural_count]))\n'
    assert source.count(before) == 1
    source = source.replace(before, '\n')
target = base/'ipc_cloth-embedded-material-control.py'
assert not target.exists(), 'Preserve an existing control'
target.write_text(source)
print(target.name, hashlib.sha256(source.encode()).hexdigest())
