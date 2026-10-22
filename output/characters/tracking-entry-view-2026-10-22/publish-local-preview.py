import json, hashlib, re, shutil, subprocess, urllib.request, os
from pathlib import Path

root = Path(__file__).resolve().parents[3]
p = Path(__file__).resolve().parent
candidate = p / 'candidate-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
def sha(data): return hashlib.sha256(data).hexdigest()
def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:5173/' + path, timeout=15) as response: return response.read()
def manifest(path): return {str(f.relative_to(path)): sha(f.read_bytes()) for f in path.rglob('*') if f.is_file()}

audit = json.loads((p / 'source-audit.json').read_text())
for name, count in [('camera-regression-final.log', 240), ('deploy-tests.log', 75)]:
    log = (p / name).read_text()
    assert re.search(r'^# pass ' + str(count) + r'$', log, re.M) and re.search(r'^# fail 0$', log, re.M), name
native = json.loads((p / 'native-verification.json').read_text())
assert native['actualNativeUiRun'] and native['restart']['actualBackendRestart'] and native['final']['scene'] == 'm1_pod'
scan = json.loads((p / 'mirror-hand-scan.json').read_text())
assert scan['completeHandSurfaces'] == 116 and all(r['selfIntersections'] == 0 for r in scan['frames'])
for row in audit['changed']:
    assert sha((root / row['path']).read_bytes()) == row['candidate']
    assert sha((candidate / row['path']).read_bytes()) == row['candidate']
for name in audit['newTests']: assert (root / name).read_bytes() == (candidate / name).read_bytes()
protected = json.loads((p / 'protected-worktree.json').read_text())
for name, digest in protected.items(): assert sha((root / name).read_bytes()) == digest, name
backend = live / 'packages/server/dist'
before_backend = json.loads((p / 'backend-dist-before.json').read_text())
assert manifest(backend) == before_backend
command = 'node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps', '-p', '82106', '-o', 'command='], text=True).strip() == command
old_world = (p / 'full-world-before.json').read_bytes()
assert fetch('api/world') == old_world
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', audit['baseline'], 'packages'], cwd=root, text=True).splitlines()
assert len(names) == audit['packageFiles'], 'package audit must resolve the complete repository list'
changed = {row['path']: row for row in audit['changed']}
for name in names:
    expected = changed[name]['before'] if name in changed else sha((candidate / name).read_bytes())
    assert sha((live / name).read_bytes()) == expected, name
client = live / 'packages/client/dist'
dist = candidate / 'packages/client/dist'
before_index = (client / 'index.html').read_bytes()
(p / 'local-index-before.html').write_bytes(before_index)
html = (dist / 'index.html').read_text()
bundle = re.search(r'/assets/(index-[^" ]+\.js)', html).group(1)
css = re.search(r'/assets/(index-[^" ]+\.css)', html).group(1)
old_bundle = re.search(rb'/assets/(index-[^" ]+\.js)', before_index).group(1).decode()
old_js = (client / 'assets' / old_bundle).read_bytes()
assert (dist / 'assets' / css).read_bytes() == (client / 'assets' / css).read_bytes()
new_js = (dist / 'assets' / bundle).read_bytes()
assert sha(new_js) == json.loads((p / 'candidate-build.json').read_text())['js']['sha256']
temp = client / 'assets' / (bundle + '.tmp'); temp.write_bytes(new_js); os.replace(temp, client / 'assets' / bundle)
for row in audit['changed']:
    if row['path'].startswith('packages/'): shutil.copy2(candidate / row['path'], live / row['path'])
temp = client / 'index.html.tmp'; temp.write_bytes((dist / 'index.html').read_bytes()); os.replace(temp, client / 'index.html')
assert fetch('') == (dist / 'index.html').read_bytes() and fetch('assets/' + bundle) == new_js
assert (client / 'assets' / old_bundle).read_bytes() == old_js
assert manifest(backend) == before_backend and fetch('api/world') == old_world
assert subprocess.check_output(['ps', '-p', '82106', '-o', 'command='], text=True).strip() == command
for name in names: assert (live / name).read_bytes() == (candidate / name).read_bytes(), name
for name, digest in protected.items(): assert sha((root / name).read_bytes()) == digest, name
world = json.loads(old_world)
report = {'url': 'http://localhost:5173/', 'bundle': bundle, 'bundleBytes': len(new_js), 'servedBundleSha256': sha(new_js),
    'backendDistFilesUnchanged': len(before_backend), 'serverRestarted': False, 'serverPid': 82106,
    'fullWorldSnapshotPreserved': True, 'fullWorldSha256': sha(old_world), 'tick': world['simulation']['tick'], 'running': world['simulation']['running'],
    'previousBundleRetained': True, 'previousBundle': old_bundle, 'livePackageFilesMatchCandidate': len(names),
    'protectedWipFilesUnchanged': len(protected), 'renderReconnected': False, 'assetsChanged': False, 'nativeReloadPending': True}
(p / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
