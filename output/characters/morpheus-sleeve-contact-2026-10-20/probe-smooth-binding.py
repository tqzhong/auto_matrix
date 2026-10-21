"""Compare the smooth binding from rest with unchanged cloth/contact physics."""
import hashlib
import json
from pathlib import Path
import subprocess

base = Path(__file__).resolve().parent
source = subprocess.run(['git', 'show',
    '2c1b2fd:output/characters/morpheus-sleeve-contact-2026-10-20/ipc_cloth.py'],
    cwd=base, check=True, capture_output=True, text=True).stdout
assert hashlib.sha256(source.encode()).hexdigest() == 'be48ba4ad7840296491d79204fb25f1fe698d5d04c7f5f46b1266aaeb2f89d81'
before = 'from cloth_embedding import embed_panels'
assert source.count(before) == 1
source = source.replace(before, 'from cloth_embedding_smooth import embed_panels')
target = base/'ipc_cloth-smooth-binding-control.py'
assert not target.exists(), 'Preserve an existing control'
binding = (base/'cloth_embedding.py').read_bytes()
assert hashlib.sha256(binding).hexdigest() == 'd269a97e9a73e10c908b48296fea9113ebcbd585d24083c438e53ef5e4a5ca3c'
snapshot = base/'cloth_embedding_smooth.py'
if snapshot.exists():
    assert snapshot.read_bytes() == binding, 'Preserve an existing binding candidate'
else:
    snapshot.write_bytes(binding)
target.write_text(source)
(base/'smooth-binding-control-source.json').write_text(json.dumps({
    'baseline': '2c1b2fd',
    'solverSha256': hashlib.sha256(source.encode()).hexdigest(),
    'bindingSha256': hashlib.sha256((base/'cloth_embedding_smooth.py').read_bytes()).hexdigest(),
    'change': 'Only the displacement binding import; no material, contact, path or acceptance-limit change.',
    'fromRest': True,
}, indent=2))
scope = {'__file__': str(target), '__name__': 'smooth_binding_control'}
exec(compile(source, str(target), 'exec'), scope)
scope['bake'](4, 4, 'ipc-smooth-binding-control', full_surface=False)
