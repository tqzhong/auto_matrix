from pathlib import Path
import hashlib, json, subprocess

u = Path(__file__).resolve().parent
root = u.parents[2]
c = u / 'candidate-release'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(folder):
    return {str(p.relative_to(folder)): sha(p) for p in folder.rglob('*') if p.is_file()}

baseline = json.loads((u / 'baseline-inputs.json').read_text())
changed = [{'path': n, 'before': digest, 'after': sha(c / n)} for n, digest in baseline.items() if sha(c / n) != digest]
assert [row['path'] for row in changed] == ['packages/client/package.json']
new = 'tests/client-build-dependencies.test.mts'
assert new not in baseline and (c / new).is_file()
inputs = {n: sha(c / n) for n in baseline}
inputs[new] = sha(c / new)
assert len(inputs) == 1215
(u / 'validation-inputs.json').write_text(json.dumps(inputs, indent=2) + '\n')
old_shared, new_shared = manifest(u / 'shared-dist-before'), manifest(c / 'packages/shared/dist')
compiled = sorted(n for n in old_shared.keys() | new_shared.keys() if old_shared.get(n) != new_shared.get(n))
assert compiled == ['constants/awakening.js', 'constants/awakening.js.map']
old_server, new_server = manifest(u / 'server-dist-before'), manifest(c / 'packages/server/dist')
assert old_server == new_server
for path, digest in json.loads((u / 'protected-worktree.json').read_text()).items():
    assert sha(root / path) == digest
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
package_files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', head, 'packages'], cwd=root, text=True).splitlines()
audit = {'baseline': head, 'changed': changed, 'new': [{'path': new, 'after': sha(c / new)}], 'inputFiles': len(inputs), 'packageFiles': len(package_files), 'compiledSharedChanges': compiled, 'serverArtifactsByteEqual': len(new_server), 'characterAssetsChanged': False}
(u / 'source-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(audit, indent=2))
