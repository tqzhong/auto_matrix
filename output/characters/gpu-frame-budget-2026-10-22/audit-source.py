import hashlib, json, re, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
unit = Path(__file__).resolve().parent
candidate = unit / 'candidate-release'
baseline = '4badd2d206a08e00c5adccdd1a86660c28481a65'
sha = lambda data: hashlib.sha256(data).hexdigest()
listing = subprocess.check_output(['git', 'ls-tree', '-r', '-z', baseline, 'packages', 'tests', 'scripts'], cwd=root)
rows = [entry.split(b'\t', 1) for entry in listing.split(b'\0') if entry]
assert len(rows) == 1152
changed = []
for metadata, path in rows:
    name = path.decode(); data = (candidate / name).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != metadata.split()[2].decode():
        original = subprocess.check_output(['git', 'show', baseline + ':' + name], cwd=root)
        changed.append({'path': name, 'before': sha(original), 'candidate': sha(data)})
assert {row['path'] for row in changed} == {'packages/client/src/player/PerformancePanel.ts'}
protected = json.loads((unit / 'protected-worktree.json').read_text())
for name, digest in protected.items(): assert sha((root / name).read_bytes()) == digest, name
new_runtime = ['packages/client/src/player/GpuTimer.ts']
new_tests = ['tests/gpu-timer.test.mts']
report = {'baseline': baseline, 'verifiedBaselineFiles': len(rows), 'packageFilesBefore': 704, 'packageFilesAfter': 705,
    'changed': changed, 'unchangedBaselineFiles': len(rows) - len(changed), 'newRuntimeFiles': new_runtime, 'newTests': new_tests,
    'newFileSha256': {name: sha((candidate / name).read_bytes()) for name in new_runtime + new_tests},
    'protectedWipFilesUnchanged': len(protected), 'assetsChanged': False, 'dependenciesChanged': False,
    'serverSourceChanged': False, 'renderReconnected': False}
assert sum(path.startswith(b'packages/') for _, path in rows) == 704
(unit / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
dist = candidate / 'packages/client/dist'
name = re.search(r'/assets/(index-[^" ]+\.js)', (dist / 'index.html').read_text()).group(1)
data = (dist / 'assets' / name).read_bytes()
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release/packages/client/dist'
assert data == (live / 'assets' / name).read_bytes()
assert (dist / 'index.html').read_bytes() == (live / 'index.html').read_bytes()
build = {'js': {'file': name, 'bytes': len(data), 'sha256': sha(data)}, 'identicalToCurrentProduction': True,
    'diagnosticsExcludedFromProduction': True}
(unit / 'candidate-build.json').write_text(json.dumps(build, indent=2) + '\n')
print(json.dumps({'audit': report, 'build': build}, indent=2))
