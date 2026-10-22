from pathlib import Path
import hashlib, json, os, signal, subprocess, sys, time, urllib.request

unit = Path(__file__).resolve().parent
sha = lambda value: hashlib.sha256(value).hexdigest()
def fetch():
    with urllib.request.urlopen('http://127.0.0.1:5200/api/world', timeout=3) as response:
        return response.read()
def memories():
    folder = unit / 'qa-data/memories'
    return {str(p.relative_to(folder)): sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}

old = json.loads((unit / 'qa-backend-process.json').read_text())
assert subprocess.check_output(['lsof', '-tiTCP:5200', '-sTCP:LISTEN'], text=True).strip() == str(old['pid'])
before = fetch()
world = json.loads(before)
assert not world['simulation']['running'] and world['sandbox']['neoLife']['journey']['scene'] == 'm1_recovery'
(unit / 'native-world-before-restart.json').write_bytes(before)
before_memories = memories()
(unit / 'native-memories-before-restart.json').write_text(json.dumps(before_memories, indent=2) + '\n')
(unit / 'native-old-backend-process.json').write_text(json.dumps(old, indent=2) + '\n')
os.kill(old['pid'], signal.SIGTERM)
for _ in range(100):
    if subprocess.run(['lsof', '-tiTCP:5200', '-sTCP:LISTEN'], capture_output=True).returncode != 0:
        break
    time.sleep(.1)
else:
    raise RuntimeError('Owned QA backend did not terminate; no replacement launched')
subprocess.run([sys.executable, str(unit / 'start-qa.py'), 'backend'], check=True)
after = None
for _ in range(150):
    try:
        after = fetch()
        break
    except (OSError, urllib.error.HTTPError):
        time.sleep(.1)
assert after is not None, 'New QA backend not ready; inspect this same process'
(unit / 'native-world-after-restart.json').write_bytes(after)
restored = json.loads(after)
changed = [key for key in world if world[key] != restored.get(key)]
neo = world['agents']['neo']; restored_neo = restored['agents']['neo']
new = json.loads((unit / 'qa-backend-process.json').read_text())
report = {
    'oldPid': old['pid'], 'newPid': new['pid'],
    'mainPidUnchanged': subprocess.check_output(['lsof', '-tiTCP:5173', '-sTCP:LISTEN'], text=True).strip() == '82166',
    'simulationPreserved': world['simulation'] == restored['simulation'],
    'sandboxPreserved': world['sandbox'] == restored['sandbox'],
    'neoFieldsPreserved': {key: neo[key] == restored_neo[key] for key in ['position', 'rotation', 'health', 'currentLocation', 'isAwakened', 'isInMatrix']},
    'memoryFileCount': len(before_memories), 'memoryHashesPreserved': memories() == before_memories,
    'changedPaths': changed, 'fullApiBytesEqual': before == after,
    'beforeSha256': sha(before), 'afterSha256': sha(after),
}
(unit / 'native-restart-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
assert old['pid'] != new['pid'] and not changed and before == after and memories() == before_memories
assert report['mainPidUnchanged'] and all(report['neoFieldsPreserved'].values())
