from pathlib import Path
import hashlib, json, os, re, shutil, subprocess, urllib.request

u = Path(__file__).resolve().parent
root = u.parents[2]
c = u / 'candidate-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha = lambda b: hashlib.sha256(b).hexdigest()
def manifest(folder):
    return {str(p.relative_to(folder)): sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}
def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:5173/' + path, timeout=15) as response:
        return response.read()
def replace(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + '.shared-build-tmp')
    shutil.copy2(source, temp)
    os.replace(temp, target)

audit = json.loads((u / 'source-audit.json').read_text())
validation = json.loads((u / 'validation.json').read_text())
inputs = json.loads((u / 'validation-inputs.json').read_text())
protected = json.loads((u / 'protected-worktree.json').read_text())
native = json.loads((u / 'native-verification.json').read_text())
restart = json.loads((u / 'restart-verification.json').read_text())
assert validation['buildRegressionAfter'] == {'tests': 2, 'pass': 2, 'fail': 0}
assert validation['relatedAfter'] == {'tests': 51, 'pass': 51, 'fail': 0}
assert validation['deployment'] == {'tests': 75, 'pass': 75, 'fail': 0}
assert validation['clientBuildExit'] == validation['serverBuildExit'] == 0
assert [row['path'] for row in audit['changed']] == ['packages/client/package.json']
assert [row['path'] for row in audit['new']] == ['tests/client-build-dependencies.test.mts']
assert len(inputs) == 1215 and all(sha((c / path).read_bytes()) == digest for path, digest in inputs.items())
assert native['nativeColdReloadVerified'] and native['nativeMouseVerifiedWhileRunning']
assert native['scene'] == 'm1_recovery' and native['step'] == 0 and native['paused']
assert restart['fullWorldEqual'] and restart['memoriesEqual'] and restart['memoryFiles'] == 6
assert json.loads((u / 'production-console.json').read_text()) == []
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() == audit['baseline']
for port in [5200, 5201]:
    assert subprocess.run(['lsof', f'-tiTCP:{port}', '-sTCP:LISTEN'], capture_output=True).returncode != 0
for path, digest in protected.items():
    assert sha((root / path).read_bytes()) == digest
for row in audit['changed']:
    assert sha((root / row['path']).read_bytes()) == row['before']
for row in audit['new']:
    assert not (root / row['path']).exists()
pid = 43571
command = 'node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip() == command
assert subprocess.check_output(['lsof', '-tiTCP:5173', '-sTCP:LISTEN'], text=True).strip() == str(pid)
before_backend = manifest(live / 'packages/server/dist')
assert before_backend == manifest(c / 'packages/server/dist') and len(before_backend) == 280
before_shared = {str(folder): manifest(folder / 'packages/shared/dist') for folder in [root, live]}
candidate_shared = manifest(c / 'packages/shared/dist')
compiled = audit['compiledSharedChanges']
assert compiled == ['constants/awakening.js', 'constants/awakening.js.map']
assert sorted(n for n in before_shared[str(live)].keys() | candidate_shared.keys() if before_shared[str(live)].get(n) != candidate_shared.get(n)) == compiled
memories = root / 'output/local-preview/data/memories'
before_memories = manifest(memories)
before_world = fetch('api/world')
(u / 'local-world-before-publication.json').write_bytes(before_world)
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', audit['baseline'], 'packages'], cwd=root, text=True).splitlines()
assert len(names) == audit['packageFiles']
changes = {row['path']: row for row in audit['changed']}
for path in names:
    assert sha((live / path).read_bytes()) == (changes[path]['before'] if path in changes else sha((c / path).read_bytes())), path
client = live / 'packages/client/dist'
dist = c / 'packages/client/dist'
old_index = (client / 'index.html').read_bytes()
(u / 'local-index-before.html').write_bytes(old_index)
html = (dist / 'index.html').read_text()
bundle = re.search(r'/assets/(index-[^" ]+\.js)', html)[1]
css = re.search(r'/assets/(index-[^" ]+\.css)', html)[1]
old_bundle = re.search(rb'/assets/(index-[^" ]+\.js)', old_index)[1].decode()
old_js = (client / 'assets' / old_bundle).read_bytes()
new_js = (dist / 'assets' / bundle).read_bytes()
assert bundle == native['productionBundle'] and sha(new_js) == validation['bundleSha256']
assert (client / 'assets' / css).read_bytes() == (dist / 'assets' / css).read_bytes()
for row in audit['changed'] + audit['new']:
    replace(c / row['path'], root / row['path'])
    if row['path'].startswith('packages/'):
        replace(c / row['path'], live / row['path'])
for folder in [root, live]:
    for path in compiled:
        replace(c / 'packages/shared/dist' / path, folder / 'packages/shared/dist' / path)
replace(dist / 'assets' / bundle, client / 'assets' / bundle)
replace(dist / 'index.html', client / 'index.html')
assert fetch('') == (dist / 'index.html').read_bytes() and fetch('assets/' + bundle) == new_js
assert fetch('assets/' + css) == (dist / 'assets' / css).read_bytes()
assert (client / 'assets' / old_bundle).read_bytes() == old_js
assert manifest(live / 'packages/server/dist') == before_backend
assert subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip() == command
for path in names:
    assert (live / path).read_bytes() == (c / path).read_bytes(), path
for path, digest in protected.items():
    assert sha((root / path).read_bytes()) == digest
for folder in [root, live]:
    expected = before_shared[str(folder)] | {path: candidate_shared[path] for path in compiled}
    assert manifest(folder / 'packages/shared/dist') == expected
after_world = fetch('api/world')
(u / 'local-world-after-publication.json').write_bytes(after_world)
before, after = json.loads(before_world), json.loads(after_world)
after_memories = manifest(memories)
report = {'url': 'http://localhost:5173/', 'bundle': bundle, 'bundleBytes': len(new_js), 'bundleBytesDelta': len(new_js) - len(old_js), 'servedBundleSha256': sha(new_js), 'backendDistFilesUnchanged': len(before_backend), 'serverRestartedForPublication': False, 'serverPid': pid, 'mainSaveWrittenOrRestored': False, 'worldByteEqualAcrossPublication': before_world == after_world, 'beforeTick': before['simulation']['tick'], 'afterTick': after['simulation']['tick'], 'beforeRunning': before['simulation']['running'], 'afterRunning': after['simulation']['running'], 'memoryFilesBefore': len(before_memories), 'memoryFilesAfter': len(after_memories), 'memoriesEqualAcrossPublication': before_memories == after_memories, 'css': css, 'cssUnchanged': True, 'previousBundleRetained': True, 'previousBundle': old_bundle, 'livePackageFilesMatchCandidate': len(names), 'ownedSourceAndTestFilesCopied': 2, 'protectedWipFilesUnchanged': len(protected), 'compiledSharedFilesCopiedPerRoot': compiled, 'otherCompiledSharedFilesPreserved': True, 'renderReconnected': False, 'characterAssetsChanged': False, 'nativeReloadPending': True, 'note': 'Main world may naturally advance. Only owned build/test files, two verified shared artifacts, the new browser bundle and index were written. No main save edit or server restart.'}
(u / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
