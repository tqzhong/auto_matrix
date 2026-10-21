from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import urllib.request

unit = Path(__file__).resolve().parent
root = unit.parents[2]
release = unit / 'release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
expected = {
    'elbow-complete-gate.log': 16,
    'elbow-wardrobe-gate.log': 17,
    'elbow-phone-gate.log': 16,
    'elbow-deploy-gate.log': 75,
    'elbow-cached-focused.log': 6,
    'elbow-complete-skin-gate.log': 1,
}
for name, tests in expected.items():
    text = (unit / name).read_text()
    for key, count in [('tests', tests), ('pass', tests), ('fail', 0), ('cancelled', 0)]:
        assert re.search(rf'^# {key} {count}$', text, re.M), (name, key)
assert 'built in ' in (unit / 'elbow-cached-build.log').read_text()
assert json.loads((unit / 'elbow-cache-equivalence.json').read_text())['frames'] == 540
audit = json.loads((unit / 'source-audit.json').read_text())
protected = json.loads((unit / 'protected-worktree.json').read_text())
assert all(digest(root / path) == sha for path, sha in protected.items())
paths = audit['changedBaselineFiles'] + audit['addedRuntimeFiles']
for path in audit['changedBaselineFiles']:
    assert (root / path).read_bytes() == subprocess.check_output(['git', 'show', f"{audit['baselineRuntimeCommit']}:{path}"], cwd=root), path
for path in audit['addedRuntimeFiles'] + list(audit['testSha256']):
    assert not (root / path).exists(), path
for path, sha in {**audit['sourceSha256'], **audit['testSha256']}.items():
    assert digest(release / path) == sha, path

backend = lambda directory: {str(path.relative_to(directory)): digest(path) for path in directory.rglob('*') if path.is_file()}
current_backend = backend(live / 'packages/server/dist')
assert current_backend == backend(release / 'packages/server/dist'), 'backend update needs a separate restart audit'
status = json.load(urllib.request.urlopen('http://localhost:5173/api/status', timeout=15))
assert status['ready'] and not status['running'] and status['tick'] == 3757
world = urllib.request.urlopen('http://localhost:5173/api/world', timeout=15).read()
assert world == (unit / 'local-world-before.json').read_bytes(), 'the user world changed during validation'
server_pid = subprocess.check_output(['lsof', '-t', '-iTCP:5173', '-sTCP:LISTEN'], text=True).strip()

source = release / 'packages/client/dist'
target = live / 'packages/client/dist'
(unit / 'local-index-before.html').write_bytes((target / 'index.html').read_bytes())
copied = []
for path in source.rglob('*'):
    if not path.is_file() or path.name == 'index.html':
        continue
    relative = path.relative_to(source)
    destination = target / relative
    if destination.exists() and digest(path) == digest(destination):
        continue
    assert str(relative) == 'assets/' + audit['clientBundle'], relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)
    copied.append(str(relative))
for path in paths + list(audit['testSha256']):
    shutil.copy2(release / path, root / path)
for path in paths:
    shutil.copy2(release / path, live / path)
temporary = target / 'index.next.html'
temporary.write_bytes((source / 'index.html').read_bytes())
os.replace(temporary, target / 'index.html')
assert all(digest(root / path) == sha for path, sha in protected.items())
assert backend(live / 'packages/server/dist') == current_backend
assert subprocess.check_output(['lsof', '-t', '-iTCP:5173', '-sTCP:LISTEN'], text=True).strip() == server_pid
after = urllib.request.urlopen('http://localhost:5173/api/world', timeout=15).read()
assert after == world
served = urllib.request.urlopen('http://localhost:5173/assets/' + audit['clientBundle'], timeout=15).read()
assert hashlib.sha256(served).hexdigest() == audit['clientBundleSha256']
assert (target / 'assets/index-py2UkB9Q.js').exists()
audit.update(candidateOnly=False, adoptedFilesMatchCandidate=True, sourceAssetsAndBackendChanged=False)
(unit / 'source-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
report = dict(url='http://localhost:5173/', bundle=audit['clientBundle'], servedBundleSha256=audit['clientBundleSha256'],
              copiedClientFiles=copied, backendDistFilesUnchanged=len(current_backend), serverRestarted=False,
              serverPid=int(server_pid), fullWorldSnapshotPreserved=True, tick=status['tick'], running=status['running'],
              previousBundleRetained=True, protectedWorktreeFilesUnchanged=len(protected), cloudSave=False,
              dataDirectory='output/local-preview/data')
(unit / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
