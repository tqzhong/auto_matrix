from pathlib import Path
import hashlib, json, os, shutil

u = Path(__file__).resolve().parent
root = u.parents[2]
c = u / 'candidate-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
def manifest(folder):
    return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file()}

before = json.loads((u / 'release-artifacts-before.json').read_text())
compiled = c / 'packages/shared/dist'
old = live / 'packages/shared/dist'
old_hash, new_hash = manifest(old), manifest(compiled)
changed = sorted(name for name in old_hash.keys() | new_hash.keys() if old_hash.get(name) != new_hash.get(name))
assert changed == ['constants/awakening.js', 'constants/awakening.js.map']
shutil.copytree(old, u / 'shared-dist-before')
shutil.copytree(c / 'packages/server/dist', u / 'server-dist-before')
# Separate every current compiler output before any further compiler invocation.
for part in ['shared', 'server']:
    folder = c / 'packages' / part / 'dist'
    detached = folder.with_name('dist.detached')
    shutil.copytree(folder, detached)
    shutil.rmtree(folder)
    os.replace(detached, folder)

restored = []
for name in ['jump-return-contact-2026-10-24', 'dojo-animation-budget-2026-10-24']:
    folder = root / 'output/characters' / name / 'candidate-release/packages/shared/dist'
    actual = manifest(folder)
    assert sorted(n for n in old_hash.keys() | actual.keys() if old_hash.get(n) != actual.get(n)) == changed
    for path in changed:
        target = folder / path
        tmp = target.with_name(target.name + '.restore-old')
        shutil.copy2(old / path, tmp)
        os.replace(tmp, target)
    assert manifest(folder) == old_hash
    restored.append(str(folder))
assert all(manifest(Path(folder)) == values for folder, values in before.items())
assert all(p.stat().st_nlink == 1 for part in ['shared', 'server'] for p in (c / 'packages' / part / 'dist').rglob('*') if p.is_file())
report = {
    'initialPreparationError': 'Isolation script was invoked from candidate cwd while expecting unit cwd. Its assertion failed before any detach, but the separate following shell command still ran the client build.',
    'effect': 'Two historical candidate directories shared compiled output inodes; only awakening.js and its map bytes changed. Main live and root compiled files were not linked and were unchanged.',
    'historicalCandidatesRestoredFromUnchangedLiveArtifacts': restored,
    'candidateSharedAndServerNowDetached': True,
    'rootAndLiveUnchanged': True,
    'compiledSharedChanges': changed,
}
(u / 'build-isolation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
