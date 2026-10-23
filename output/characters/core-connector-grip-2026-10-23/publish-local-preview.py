import hashlib, json, os, re, shutil, subprocess, urllib.request
from pathlib import Path

unit = Path(__file__).resolve().parent
root = unit.parents[2]
candidate = unit / 'candidate-release'
baseline = unit / 'baseline-release'
live = root / 'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha = lambda data: hashlib.sha256(data).hexdigest()
def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:5173/' + path, timeout=15) as response:
        return response.read()
def manifest(folder):
    return {str(p.relative_to(folder)): sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}
def replace_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.core-grip-tmp')
    shutil.copy2(source, temporary)
    os.replace(temporary, target)

audit = json.loads((unit / 'source-audit.json').read_text())
validation = json.loads((unit / 'validation.json').read_text())
assert validation['allGatesPassed'] and validation['inputsUnchanged']
for name, count in [('related-tests.log', 383), ('deploy-tests.log', 75)]:
    row = next(row for row in validation['results'] if row['log'] == name)
    assert row['tests'] == row['pass'] == count and row['fail'] == 0
    log = (unit / name).read_text()
    assert re.search(r'^# pass ' + str(count) + r'$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
inputs = json.loads((unit / 'validation-inputs.json').read_text())
assert len(inputs) == 1174
for name, digest in inputs.items():
    assert sha((candidate / name).read_bytes()) == digest, name
native = json.loads((unit / 'native-verification.json').read_text())
assert native['productionColdLoadChecked'] and native['bothViewsAndMouseLookChecked']
assert native['fullOrdinaryEscortToCoreChecked'] and native['coreConsentAndConnectionChecked'] and native['constructArrivalChecked']
assert native['finalScene'] == 'm1_construct' and native['finalStep'] == 0 and native['neoHealth'] == 100
assert native['coldHold']['tick'] == 7156 and 3 < native['coldHold']['elapsed'] < 5.8
assert native['realBackendRestart']['completeWorldEqual'] and native['realBackendRestart']['memoryBytesUnchanged']
assert native['walk']['sampledHorizontalPathLowerBound'] > 38 and native['qaPortsStopped'] == [5200, 5201]
assert all(count == 0 for count in native['consoleCounts'].values())
for port in native['qaPortsStopped']:
    assert subprocess.run(['lsof', f'-tiTCP:{port}', '-sTCP:LISTEN'], capture_output=True).returncode != 0
protected = json.loads((unit / 'protected-worktree.json').read_text())
for name, digest in protected.items():
    assert sha((root / name).read_bytes()) == digest, name
for name, digest in json.loads((unit / 'root-package-before.json').read_text()).items():
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
assert before_world == (unit / 'main-world-before.json').read_bytes()
assert before_memories == json.loads((unit / 'main-memories-before.json').read_text())
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', audit['baseline'], 'packages'], cwd=root, text=True).splitlines()
assert len(names) == audit['packageFiles'] == 707
changed = {row['path']: row for row in audit['changed']}
for name in names:
    expected = changed[name]['before'] if name in changed else sha((candidate / name).read_bytes())
    assert sha((live / name).read_bytes()) == expected, name

# Only the added connector export is needed in compiled shared code. Preserve
# the pre-existing awakening.js discrepancy instead of broadening this unit.
generated = ['constants/cabin.js', 'constants/cabin.js.map', 'constants/cabin.d.ts', 'constants/cabin.d.ts.map']
shared_before = {str(folder): manifest(folder / 'packages/shared/dist') for folder in [root, live]}
for name in generated:
    for folder in [root, live]:
        assert (folder / 'packages/shared/dist' / name).read_bytes() == (baseline / 'packages/shared/dist' / name).read_bytes(), name
old_cabin = (baseline / 'packages/shared/dist/constants/cabin.js').read_text()
new_cabin = (candidate / 'packages/shared/dist/constants/cabin.js').read_text()
export = 'export const CORE_CONNECTOR = { shaft: { radius: .09, length: .5 }, grip: { x: .24, radius: .135, length: .23 } };\n'
assert new_cabin.replace(export, '', 1) == old_cabin
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
assert sha(new_js) == validation['build']['js']['sha256'] and bundle == native['productionBundle']
assert (dist / 'assets' / css).read_bytes() == (client / 'assets' / css).read_bytes()

for row in audit['changed'] + audit['new']:
    replace_file(candidate / row['path'], root / row['path'])
    if row['path'].startswith('packages/'):
        replace_file(candidate / row['path'], live / row['path'])
for folder in [root, live]:
    for name in generated:
        replace_file(candidate / 'packages/shared/dist' / name, folder / 'packages/shared/dist' / name)
replace_file(dist / 'assets' / bundle, client / 'assets' / bundle)
replace_file(dist / 'index.html', client / 'index.html')

assert fetch('') == (dist / 'index.html').read_bytes() and fetch('assets/' + bundle) == new_js
assert (client / 'assets' / old_bundle).read_bytes() == old_js
assert manifest(backend) == before_backend
after_world = fetch('api/world')
(unit / 'local-world-after-publication.json').write_bytes(after_world)
assert after_world == before_world and manifest(memories) == before_memories
assert subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip() == command
published_names = names + [row['path'] for row in audit['new'] if row['path'].startswith('packages/')]
for name in published_names:
    assert (live / name).read_bytes() == (candidate / name).read_bytes(), name
for row in audit['changed'] + audit['new']:
    assert (root / row['path']).read_bytes() == (candidate / row['path']).read_bytes(), row['path']
for name, digest in protected.items():
    assert sha((root / name).read_bytes()) == digest, name
for folder in [root, live]:
    after = manifest(folder / 'packages/shared/dist')
    expected = shared_before[str(folder)].copy()
    for name in generated:
        expected[name] = sha((candidate / 'packages/shared/dist' / name).read_bytes())
    assert after == expected
world = json.loads(before_world)
report = {'url': 'http://localhost:5173/', 'bundle': bundle, 'bundleBytes': len(new_js), 'servedBundleSha256': sha(new_js),
    'backendDistFilesUnchanged': len(before_backend), 'serverRestartedForPublication': False, 'serverPid': pid,
    'fullWorldSnapshotPreservedAcrossPublication': True, 'fullWorldSha256': sha(before_world),
    'memoryFilesPreservedAcrossPublication': len(before_memories), 'tick': world['simulation']['tick'], 'running': world['simulation']['running'],
    'previousBundleRetained': True, 'previousBundle': old_bundle, 'livePackageFilesMatchCandidate': len(published_names),
    'ownedSourceAndTestFilesCopied': len(audit['changed']) + len(audit['new']), 'protectedWipFilesUnchanged': len(protected),
    'compiledSharedFilesCopiedPerDirectory': generated, 'otherCompiledSharedFilesPreserved': True,
    'renderReconnected': False, 'characterAssetsChanged': False, 'nativeReloadPending': True}
(unit / 'local-update-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
