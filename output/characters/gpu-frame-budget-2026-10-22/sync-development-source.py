import hashlib, json, re, shutil, subprocess, urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[3]
unit = Path(__file__).resolve().parent
candidate = unit / 'candidate-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha = lambda data: hashlib.sha256(data).hexdigest()
def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:5173/' + path, timeout=15) as response: return response.read()
def manifest(folder): return {str(p.relative_to(folder)): sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}

audit = json.loads((unit / 'source-audit.json').read_text())
for name, count in [('related-tests.log', 23), ('deploy-tests.log', 75)]:
    log = (unit / name).read_text()
    assert re.search(r'^# pass ' + str(count) + r'$', log, re.M) and re.search(r'^# fail 0$', log, re.M), name
measurement = json.loads((unit / 'measurement-verification.json').read_text())
assert measurement['calibrationPassed'] and measurement['not60FpsAcceptance']
assert json.loads((unit / 'native-verification.json').read_text())['consoleWarningsAndErrors'] == []
protected = json.loads((unit / 'protected-worktree.json').read_text())
for name, digest in protected.items(): assert sha((root / name).read_bytes()) == digest, name
backend = live / 'packages/server/dist'
before_backend = json.loads((unit / 'backend-dist-before.json').read_text())
assert manifest(backend) == before_backend
command = 'node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps', '-p', '82106', '-o', 'command='], text=True).strip() == command
world = (unit / 'full-world-before.json').read_bytes(); assert fetch('api/world') == world
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', audit['baseline'], 'packages'], cwd=root, text=True).splitlines()
assert len(names) == audit['packageFilesBefore'] == 704
changed = {row['path']: row for row in audit['changed']}
for name in names:
    expected = changed[name]['before'] if name in changed else sha((candidate / name).read_bytes())
    assert sha((live / name).read_bytes()) == expected, name
for row in audit['changed']:
    assert sha((root / row['path']).read_bytes()) == row['candidate']
    assert sha((candidate / row['path']).read_bytes()) == row['candidate']
for name, digest in audit['newFileSha256'].items():
    assert sha((root / name).read_bytes()) == digest and sha((candidate / name).read_bytes()) == digest
for name in audit['newRuntimeFiles']: assert not (live / name).exists()
dist = candidate / 'packages/client/dist'; deployed = live / 'packages/client/dist'
build = json.loads((unit / 'candidate-build.json').read_text()); bundle = build['js']['file']
assert (dist / 'index.html').read_bytes() == fetch('') == (deployed / 'index.html').read_bytes()
assert (dist / 'assets' / bundle).read_bytes() == fetch('assets/' + bundle) == (deployed / 'assets' / bundle).read_bytes()
for name in list(changed) + audit['newRuntimeFiles']: shutil.copy2(candidate / name, live / name)
for name in names + audit['newRuntimeFiles']: assert (live / name).read_bytes() == (candidate / name).read_bytes(), name
assert len(names + audit['newRuntimeFiles']) == audit['packageFilesAfter'] == 705
assert manifest(backend) == before_backend and fetch('api/world') == world
assert subprocess.check_output(['ps', '-p', '82106', '-o', 'command='], text=True).strip() == command
report = {'url': 'http://localhost:5173/', 'bundle': bundle, 'bundleBytes': build['js']['bytes'], 'servedBundleSha256': build['js']['sha256'],
    'productionJsAndIndexUnchanged': True, 'developmentSourceSynced': list(changed) + audit['newRuntimeFiles'],
    'livePackageFilesMatchCandidate': 705, 'backendDistFilesUnchanged': len(before_backend), 'serverPid': 82106, 'serverRestarted': False,
    'fullWorldSnapshotPreserved': True, 'fullWorldSha256': sha(world), 'tick': json.loads(world)['simulation']['tick'],
    'protectedWipFilesUnchanged': len(protected), 'renderReconnected': False, 'normalGameEffectsChanged': False, 'nativeOpenPending': True}
(unit / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
