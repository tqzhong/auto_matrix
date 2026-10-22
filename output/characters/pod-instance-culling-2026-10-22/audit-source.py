import hashlib, json, re, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
unit = Path(__file__).resolve().parent
candidate = unit / 'candidate-release'
baseline = '76f3284f67381c58c912fff0a40a2e65238daa9c'
sha = lambda data: hashlib.sha256(data).hexdigest()
listing = subprocess.check_output(['git', 'ls-tree', '-r', '-z', baseline, 'packages', 'tests', 'scripts'], cwd=root)
rows = [entry.split(b'\t', 1) for entry in listing.split(b'\0') if entry]
assert len(rows) == 1151
changed = []
for metadata, path in rows:
    name = path.decode()
    data = (candidate / name).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != metadata.split()[2].decode():
        original = subprocess.check_output(['git', 'show', baseline + ':' + name], cwd=root)
        changed.append({'path': name, 'before': sha(original), 'candidate': sha(data)})
expected = {'packages/client/src/engine/PodSetRenderer.ts', 'packages/client/src/engine/FilmSetRenderer.ts', 'packages/client/src/player/PerformancePanel.ts'}
assert {row['path'] for row in changed} == expected
protected = json.loads((unit / 'protected-worktree.json').read_text())
for name, digest in protected.items(): assert sha((root / name).read_bytes()) == digest, name
report = {'baseline': baseline, 'verifiedFiles': len(rows), 'packageFiles': sum(path.startswith(b'packages/') for _, path in rows),
    'changed': changed, 'unchangedFiles': len(rows) - len(changed), 'changedRuntimeFiles': 3, 'newTests': ['tests/pod-instance-culling.test.mts'],
    'protectedWipFilesUnchanged': len(protected), 'assetsChanged': False, 'dependenciesChanged': False,
    'serverSourceChanged': False, 'renderReconnected': False}
assert report['packageFiles'] == 704
report['newTestSha256'] = sha((candidate / report['newTests'][0]).read_bytes())
(unit / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
dist = candidate / 'packages/client/dist'
html = (dist / 'index.html').read_text()
name = re.search(r'/assets/(index-[^" ]+\.js)', html).group(1)
data = (dist / 'assets' / name).read_bytes()
build = {'js': {'file': name, 'bytes': len(data), 'sha256': sha(data)},
    'css': re.search(r'/assets/(index-[^" ]+\.css)', html).group(1)}
(unit / 'candidate-build.json').write_text(json.dumps(build, indent=2) + '\n')
print(json.dumps({'verifiedFiles': len(rows), 'changed': [r['path'] for r in changed], 'build': build}, indent=2))
