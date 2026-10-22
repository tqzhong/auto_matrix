import hashlib, json, os, re, shutil, subprocess, urllib.request
from pathlib import Path

unit = Path(__file__).resolve().parent
root = unit.parents[2]
candidate = unit / 'candidate-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha = lambda data: hashlib.sha256(data).hexdigest()
def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:5173/' + path, timeout=15) as response:
        return response.read()
def manifest(folder):
    return {str(p.relative_to(folder)): sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}

audit = json.loads((unit / 'source-audit.json').read_text())
validation = json.loads((unit / 'validation.json').read_text())
assert validation['allGatesPassed'] and validation['inputsUnchanged']
for name, count in [('related-tests.log', 285), ('deploy-tests.log', 75)]:
    log = (unit / name).read_text()
    assert re.search(r'^# pass ' + str(count) + r'$', log, re.M) and re.search(r'^# fail 0$', log, re.M), name
for name, digest in json.loads((unit / 'validation-inputs.json').read_text()).items():
    assert sha((candidate / name).read_bytes()) == digest, name
native = json.loads((unit / 'native-verification.json').read_text())
assert native['productionColdLoadChecked'] and native['bothViewsAndMouseLookChecked']
assert native['realBackendRestart']['changedPaths'] == []
assert native['finalScene'] == 'm1_recovery' and native['neoHealth'] == 100
assert native['qaPortsStopped'] == [5200, 5201]
assert all(count == 0 for count in native['consoleCounts'].values())
protected = json.loads((unit / 'protected-worktree.json').read_text())
for name, digest in protected.items():
    assert sha((root / name).read_bytes()) == digest, name
for name, digest in json.loads((unit / 'owned-root-before.json').read_text()).items():
    assert sha((root / name).read_bytes()) == digest, name
for row in audit['changed']:
    assert sha((root / row['path']).read_bytes()) == row['before'], row['path']
for row in audit['new']:
    assert not (root / row['path']).exists(), row['path']
backend = live / 'packages/server/dist'
before_backend = json.loads((unit / 'backend-dist-before.json').read_text())
assert manifest(backend) == before_backend
pid = json.loads((unit / 'baseline-audit.json').read_text())['mainPid']
command = 'node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip() == command
assert subprocess.check_output(['lsof', '-tiTCP:5173', '-sTCP:LISTEN'], text=True).strip() == str(pid)
before_world = fetch('api/world')
(unit / 'local-world-before-publication.json').write_bytes(before_world)
memories = root / 'output/local-preview/data/memories'
before_memories = manifest(memories)
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', audit['baseline'], 'packages'], cwd=root, text=True).splitlines()
assert len(names) == audit['packageFiles'] == 705
changed = {row['path']: row for row in audit['changed']}
for name in names:
    expected = changed[name]['before'] if name in changed else sha((candidate / name).read_bytes())
    assert sha((live / name).read_bytes()) == expected, name
client = live / 'packages/client/dist'
dist = candidate / 'packages/client/dist'
before_index = (client / 'index.html').read_bytes()
(unit / 'local-index-before.html').write_bytes(before_index)
html = (dist / 'index.html').read_text()
bundle = re.search(r'/assets/(index-[^" ]+\.js)', html).group(1)
css = re.search(r'/assets/(index-[^" ]+\.css)', html).group(1)
old_bundle = re.search(rb'/assets/(index-[^" ]+\.js)', before_index).group(1).decode()
old_js = (client / 'assets' / old_bundle).read_bytes()
new_js = (dist / 'assets' / bundle).read_bytes()
assert sha(new_js) == json.loads((unit / 'candidate-build.json').read_text())['js']['sha256']
assert (dist / 'assets' / css).read_bytes() == (client / 'assets' / css).read_bytes()

# Copy only this verified unit; the other eleven working files remain untouched.
for row in audit['changed'] + audit['new']:
    target = root / row['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(candidate / row['path'], target)
temp = client / 'assets' / (bundle + '.tmp')
temp.write_bytes(new_js)
os.replace(temp, client / 'assets' / bundle)
for row in audit['changed']:
    if row['path'].startswith('packages/'):
        shutil.copy2(candidate / row['path'], live / row['path'])
temp = client / 'index.html.tmp'
temp.write_bytes((dist / 'index.html').read_bytes())
os.replace(temp, client / 'index.html')

assert fetch('') == (dist / 'index.html').read_bytes()
assert fetch('assets/' + bundle) == new_js
assert (client / 'assets' / old_bundle).read_bytes() == old_js
assert manifest(backend) == before_backend
after_world = fetch('api/world')
(unit / 'local-world-after-publication.json').write_bytes(after_world)
assert after_world == before_world
assert manifest(memories) == before_memories
assert subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip() == command
for name in names:
    assert (live / name).read_bytes() == (candidate / name).read_bytes(), name
for row in audit['changed'] + audit['new']:
    assert (root / row['path']).read_bytes() == (candidate / row['path']).read_bytes(), row['path']
for name, digest in protected.items():
    assert sha((root / name).read_bytes()) == digest, name
world = json.loads(before_world)
report = {'url': 'http://localhost:5173/', 'bundle': bundle, 'bundleBytes': len(new_js), 'servedBundleSha256': sha(new_js),
    'backendDistFilesUnchanged': len(before_backend), 'serverRestartedForPublication': False, 'serverPid': pid,
    'mainRelaunchedEarlierInUnit': False,
    'fullWorldSnapshotPreservedAcrossPublication': True, 'fullWorldSha256': sha(before_world),
    'memoryFilesPreservedAcrossPublication': len(before_memories), 'tick': world['simulation']['tick'], 'running': world['simulation']['running'],
    'previousBundleRetained': True, 'previousBundle': old_bundle, 'livePackageFilesMatchCandidate': len(names),
    'ownedSourceAndTestFilesCopied': len(audit['changed']) + len(audit['new']), 'protectedWipFilesUnchanged': len(protected),
    'renderReconnected': False, 'characterAssetsChanged': False, 'nativeReloadPending': True}
(unit / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
