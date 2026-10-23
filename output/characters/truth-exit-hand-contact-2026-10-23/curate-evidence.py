from pathlib import Path
import gzip, hashlib, json, tarfile

u = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
required = [
    'README.md', 'baseline-audit.json', 'source-audit.json', 'validation-inputs.json',
    'validation.json', 'candidate-build.json', 'compiled-shared-changes.json',
    'film-reference-observations.json', 'native-seed.json', 'native-attempt-reset.json',
    'truth-kneel-checkpoint-restart.json', 'native-cold-state.json', 'native-verification.json',
    'native-development-dom.json', 'native-production-dom.json', 'native-main-dom.json',
    'native-development-console.json', 'native-production-console.json', 'native-main-console.json',
    'local-update-verification.json', 'qa-stop.json', 'animation-cpu.json',
    'crew-costume-observation.json', 'native-attempt-01-rest.png',
    'native-kneel-development.png', 'native-kneel-first-person.png', 'native-kneel-mouse-look.png',
    'native-production-cold-held.png', 'native-production-cold-look.png',
    'native-production-philosophy.png', 'native-production-final-paused.png',
    'native-main-current.png', 'run-validation.py', 'start-owned-qa.py',
    'reset-native-attempt.py', 'restart-owned-qa.py', 'stop-owned-qa.py',
    'publish-local-preview.py', 'benchmark-truth.mts', 'curate-evidence.py',
]
logs = ['baseline-related-tests.log', 'baseline-final-tests.log', 'new-tests.log',
        'related-tests.log', 'deploy-tests.log', 'typecheck-final.log', 'build-final.log']
experiments = [
    'baseline-cuff-test.log', 'baseline-new-tests.log',
    'baseline-ground-surfaces.jsonl', 'baseline-neo-hand-probe.jsonl',
    'baseline-neo-hand-probe-stderr.log', 'probe-truth-neo.mts',
    'iteration-01-tests.log', 'iteration-01-finger-floor.json',
    'iteration-02-tests.log', 'iteration-02-hand-detail.json',
    'iteration-03-tests.log', 'iteration-04-tests.log',
    'rejected-cold-field-check.json', 'setup-path-error.log', 'benchmark.log',
]
for name in required + logs + experiments:
    assert (u / name).is_file(), name

compressed = []
for name in logs:
    target = u / (name + '.gz')
    target.write_bytes(gzip.compress((u / name).read_bytes(), mtime=0))
    compressed.append({'source': name, 'sourceSha256': sha(u / name),
                       'file': target.name, 'sha256': sha(target)})

archive = u / 'rejected-candidates-and-probes.tar.gz'
with tarfile.open(archive, 'w:gz') as out:
    for name in experiments:
        out.add(u / name, arcname=name, recursive=False)
report = {'required': {name: sha(u / name) for name in required},
          'logs': compressed, 'experiments': {name: sha(u / name) for name in experiments},
          'experimentArchive': {'file': archive.name, 'sha256': sha(archive)},
          'privateRawWorldsMemoriesAndDatabasesExcluded': True,
          'releaseCopiesNodeModulesAndDistExcluded': True}
(u / 'evidence-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
files = required + [row['file'] for row in compressed] + [archive.name, 'evidence-manifest.json']
(u / 'curated-files.json').write_text(json.dumps(files, indent=2) + '\n')
print(json.dumps({'files': len(files), 'bytes': sum((u / name).stat().st_size for name in files),
                  'experimentFiles': len(experiments)}))
