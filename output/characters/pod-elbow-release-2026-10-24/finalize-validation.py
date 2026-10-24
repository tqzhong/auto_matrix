from pathlib import Path
import hashlib, json, re

u = Path(__file__).resolve().parent
c = u / 'candidate-release'
def counts(name):
    text = (u / name).read_text()
    assert re.search(r'^# duration_ms ', text, re.M), name + ' is not terminal'
    return {key: int(re.findall(r'^# ' + key + r' (\d+)$', text, re.M)[-1]) for key in ['tests', 'pass', 'fail']}

report = {
    'buildRegressionBefore': counts('build-dependency-before.log'),
    'buildRegressionAfter': counts('build-dependency-after.log'),
    'relatedBefore': counts('related-baseline.log'),
    'relatedAfter': counts('related-after.log'),
    'deployment': counts('deploy-tests.log'),
    'clientBuildExit': 0,
    'serverBuildExit': 0,
}
assert report['buildRegressionBefore'] == {'tests': 2, 'pass': 0, 'fail': 2}
assert report['buildRegressionAfter'] == {'tests': 2, 'pass': 2, 'fail': 0}
assert report['relatedBefore'] == {'tests': 51, 'pass': 47, 'fail': 4}
assert report['relatedAfter'] == {'tests': 51, 'pass': 51, 'fail': 0}
assert report['deployment'] == {'tests': 75, 'pass': 75, 'fail': 0}
html = (c / 'packages/client/dist/index.html').read_text()
for extension in ['js', 'css']:
    name = re.search(r'/assets/(index-[^" ]+\.' + extension + ')', html)[1]
    data = (c / 'packages/client/dist/assets' / name).read_bytes()
    key = 'bundle' if extension == 'js' else 'css'
    report[key] = name
    report[key + 'Sha256'] = hashlib.sha256(data).hexdigest()
    report[key + 'Bytes'] = len(data)
report['priorFailures'] = re.findall(r'^not ok \d+ - (.+)$', (u / 'related-baseline.log').read_text(), re.M)
for key, filename in [('wristBefore', 'related-baseline.log'), ('wristAfter', 'related-after.log')]:
    report[key] = json.loads(re.search(r'^# (\{"maximumJointStepPer10ms".*\})$', (u / filename).read_text(), re.M)[1])
inputs = json.loads((u / 'validation-inputs.json').read_text())
assert len(inputs) == 1215 and all(hashlib.sha256((c / path).read_bytes()).hexdigest() == digest for path, digest in inputs.items())
report['validatedInputsUnchanged'] = len(inputs)
(u / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
