"""Test a reduced solve while keeping the complete displayed material/contact.

This is a separate control, not an accepted replacement for the live bake.
The existing cage supplies displacement DOFs. All original visible triangles
supply membrane energy, collision and exported strain checks.
"""
import hashlib
from pathlib import Path
import subprocess
import sys

base = Path(__file__).parent
source = subprocess.run(['git', 'show',
    '43d46b7:output/characters/morpheus-sleeve-contact-2026-10-20/ipc_cloth.py'],
    cwd=base, check=True, capture_output=True, text=True).stdout
assert hashlib.sha256(source.encode()).hexdigest() == '94189724200f26251a9863a237a7be370244106a3ae61e9c2167fded5010e163'
replacements = {
    'from cloth_embedding import embed_panels':
        'from cloth_embedding import embed_panels\nfrom embedded_membrane import embedded_membrane',
    "    points = np.asarray(cage['points'])[:, [0, 2, 1]]*[.4, -.4, .4]":
    '''    if not full_surface:
        rim = json.loads((BASE/'lifted-band/collar-guide.json').read_text())
        ids = [cage['mappedControls'][str(i)] for i in rim['ids']]
        initial = np.asarray(rim['frames'][0]['points'])
        rest_rim = np.asarray(cage['points'])[ids]
        guide = {'ids': ids, 'frames': [{**frame,
            'points': (rest_rim+np.asarray(frame['points'])-initial).tolist()}
            for frame in rim['frames']]}
    points = np.asarray(cage['points'])[:, [0, 2, 1]]*[.4, -.4, .4]''',
    '    membrane_rest = prepare_membrane(points, faces) if full_surface else None\n': '',
    "    display_faces = np.asarray(manifest['indices']).reshape(-1, 3)":
    '''    display_faces = np.asarray(manifest['indices']).reshape(-1, 3)
    membrane_rest = prepare_membrane(shown, display_faces)
    membrane_dofs = sp.kron(embedding, sp.eye(3), format='csr')
    display_edges = ipctk.edges(display_faces)
    display_rest = np.linalg.norm(shown[display_edges[:, 0]]-shown[display_edges[:, 1]], axis=1)''',
    '''    def material(state, project=True, derivatives=True):
        result = springs(state[:n], edges, rest, stiffness, project=project,
            strain_count=structural_count, structural_elastic=not full_surface, derivatives=derivatives)
        if not derivatives:
            energy = result
            if full_surface:
                energy += membrane_energy(state[:n], faces, membrane_rest, project=project, derivatives=False)
            return energy
        energy, gradient, hessian = result
        if full_surface:
            membrane_e, membrane_g, membrane_h = membrane_energy(state[:n], faces, membrane_rest, project=project)
            energy += membrane_e
            gradient += membrane_g
            hessian += membrane_h
        return energy, gradient, hessian''':
    '''    def material(state, project=True, derivatives=True):
        result = springs(state[:n], edges, rest, stiffness, project=project,
            strain_count=structural_count, structural_elastic=False, derivatives=derivatives)
        fine = embedded_membrane(state[:n]-points, shown, display_faces, membrane_rest,
            embedding, membrane_dofs, project=project, derivatives=derivatives)
        if not derivatives:
            return result+fine
        energy, gradient, hessian = result
        return energy+fine[0], gradient+fine[1], hessian+fine[2]''',
    '''            if np.max(np.abs(displacement)) < 1e-6:
                return iteration, residual
            direction = np.zeros_like(x)
            direction.ravel()[free] = displacement''':
    '''            direction = np.zeros_like(x)
            direction.ravel()[free] = displacement
            if np.max(np.abs(embedding@direction[:n])) < 1e-6:
                return iteration, residual''',
    "'sourceSha256': hashlib.sha256((BASE/'membrane.py').read_bytes()).hexdigest()} if full_surface else None,":
    "'sourceSha256': hashlib.sha256((BASE/'membrane.py').read_bytes()).hexdigest(),\n"
    "                     'displayMaterialVertices': visible_count,\n"
    "                     'embeddingSourceSha256': hashlib.sha256((BASE/'embedded_membrane.py').read_bytes()).hexdigest()},",
    "        exported = x[:n].astype(np.float32).astype(float)":
    '''        display_lengths = np.linalg.norm(visible[display_edges[:, 0]].astype(float)-visible[display_edges[:, 1]], axis=1)/display_rest
        if display_lengths.max() >= STRAIN_LIMIT:
            raise ClothStepError(f'the displayed edges exceed their strain limit: {display_lengths.max()}')
        exported = x[:n].astype(np.float32).astype(float)''',
    "               'maximumEdgeStretch': float(np.max(lengths)),":
        "               'maximumEdgeStretch': float(np.max(lengths)),\n"
        "               'maximumDisplayEdgeStretch': float(display_lengths.max()),",
    "            if not material_within_limits(triangle_stretch(shown, cached, display_faces)):":
    '''            cached_lengths = np.linalg.norm(cached[display_edges[:, 0]]-cached[display_edges[:, 1]], axis=1)/display_rest
            if cached_lengths.max() >= STRAIN_LIMIT:
                raise ClothStepError('the resumed displayed edges exceed their strain limit')
            if not material_within_limits(triangle_stretch(shown, cached, display_faces)):''',
}
for before, after in replacements.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
for indent in ('            ', '                '):
    before = '\n'+indent+'alpha = min(alpha, strain_free_stepsize(x, direction, edges[:structural_count], rest[:structural_count]))'
    assert source.count(before) == 1
    source = source.replace(before, before+'\n'+indent+
        'alpha = min(alpha, strain_free_stepsize(surface(x), surface(x+direction)-surface(x), display_edges, display_rest))')
target = base/'ipc_cloth-embedded-membrane-guarded-control.py'
assert not target.exists(), 'Preserve an existing control'
target.write_text(source)
scope = {'__file__': str(target), '__name__': 'embedded_membrane_control'}
exec(compile(source, str(target), 'exec'), scope)
if '--build-only' not in sys.argv:
    scope['bake'](2, 4, 'ipc-embedded-membrane-guarded-control', full_surface=False)
