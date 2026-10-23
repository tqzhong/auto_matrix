from pathlib import Path
import gzip, hashlib, json, tarfile

u = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
required = [
    'README.md', 'baseline-audit.json', 'source-audit.json', 'validation-inputs.json',
    'validation.json', 'candidate-build.json', 'compiled-shared-changes.json',
    'film-reference.json', 'native-seed.json', 'native-walk-trace.jsonl',
    'desert-cold-checkpoint-restart.json', 'native-verification.json',
    'native-production-dom.json', 'native-development-console.json',
    'native-production-console.json', 'native-main-dom.json', 'native-main-console.json',
    'local-update-verification.json', 'qa-stop.json', 'animation-cpu.json',
    'native-baseline-held.png', 'native-production-cold-held.png',
    'native-production-cold-look.png', 'native-production-truth-ready.png',
    'native-main-current.png', 'native-observer-limit.png',
    'run-validation.py', 'restart-owned-qa.py', 'stop-owned-qa.py',
    'publish-local-preview.py', 'benchmark-desert.mts', 'capture-walk.py', 'curate-evidence.py',
]
for name in required:
    assert (u / name).is_file(), name

logs = ['baseline-existing-tests.log', 'baseline-story-camera-tests.log',
        'baseline-final-nine-tests.log', 'new-tests.log', 'related-tests.log',
        'deploy-tests.log', 'typecheck-final.log', 'build-final.log']
compressed = []
for name in logs:
    target = u / (name + '.gz')
    target.write_bytes(gzip.compress((u / name).read_bytes(), mtime=0))
    compressed.append({'source': name, 'sourceSha256': sha(u / name),
                       'file': target.name, 'sha256': sha(target)})

experiments = sorted(p for p in u.iterdir() if p.is_file() and (
    p.name.startswith(('rejected-', 'early-', 'before-', 'support-only-', 'fit-', 'probe-', 'trace-'))
    or p.name in ['baseline-guide-probe.jsonl', 'baseline-feet.jsonl']
    or p.suffix in ['.jsonl', '.log'] and p.name not in logs + [
        'native-walk-trace.jsonl', 'qa-backend.log', 'qa-client.log', 'validation-driver.log']
))
archive = u / 'rejected-candidates-and-probes.tar.gz'
with tarfile.open(archive, 'w:gz') as out:
    for p in experiments:
        out.add(p, arcname=p.name, recursive=False)
report = {'required': {name: sha(u / name) for name in required},
          'logs': compressed, 'experiments': {p.name: sha(p) for p in experiments},
          'experimentArchive': {'file': archive.name, 'sha256': sha(archive)},
          'privateRawWorldsAndDataExcluded': True,
          'releaseCopiesNodeModulesAndDistExcluded': True}
(u / 'evidence-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
files = required + [row['file'] for row in compressed] + [archive.name, 'evidence-manifest.json']
(u / 'curated-files.json').write_text(json.dumps(files, indent=2) + '\n')
print(json.dumps({'files': len(files), 'bytes': sum((u / name).stat().st_size for name in files),
                  'experimentFiles': len(experiments)}))
