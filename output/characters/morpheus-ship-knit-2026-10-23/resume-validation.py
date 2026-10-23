from pathlib import Path
import json,hashlib,re,subprocess,time
u=Path(__file__).resolve().parent;c=u/'candidate-release';b=u/'baseline-release';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((u/'validation-inputs.json').read_text());old_inputs=json.loads((u/'validation-inputs-before-yarn-expectation.json').read_text());assert all(sha(c/n)==d for n,d in inputs.items());assert all(inputs[n]==d for n,d in old_inputs.items() if n not in ['tests/farewell-appearance.test.mts','packages/client/src/agents/ShipKnit.ts'])
def summary(body):return {key:int(re.findall(r'^# '+key+r' (\d+)$',body,re.M)[-1])for key in ['tests','pass','fail','skipped']}
def failures(body):
 result={}
 for m in re.finditer(r'^not ok \d+ - (.+)$',body,re.M):
  block=body[m.end():];end=re.search(r'^# Subtest:',block,re.M)
  if end:block=block[:end.start()]
  error=re.search(r'\n  error: ([\s\S]*?)(?=\n  (?:code|name|stack|operator):)',block);code=re.search(r'^  code: (.+)$',block,re.M)
  result[m[1]]={'error':error[1].replace('baseline-release','{release}').replace('candidate-release','{release}')if error else None,'code':code[1]if code else None}
 return result
known=failures((u/'baseline-existing-tests.log').read_text());assert len(known)==4
prior=json.loads((u/'validation-before-yarn-expectation.json').read_text());results=prior['results'];raw=(u/'related-before-yarn-expectation.log').read_text();actual=failures(raw);expectation='the early ship wake, escort and connection retain Neo and Morpheus knit clothing without Matrix lapels';assert expectation in actual;del actual[expectation];assert actual==known
assert summary((u/'new-tests.log').read_text())=={'tests':5,'pass':5,'fail':0,'skipped':0}
def run(name,args,expected=None):
 (u/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n');start=time.monotonic()
 with (u/name).open('w')as log:p=subprocess.run(args,cwd=c,stdout=log,stderr=subprocess.STDOUT)
 row={'log':name,'command':args,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-start}
 if expected is not None:
  body=(u/name).read_text();actual=failures(body);row.update(summary(body));row.update(failureNames=list(actual),newFailures=sorted(set(actual)-set(expected)),baselineFailureMessagesUnchanged=actual==expected);okay=actual==expected and row['skipped']==0 and p.returncode==(1 if expected else 0)
 else:okay=p.returncode==0
 results.append(row);(u/'validation.json').write_text(json.dumps({'allRequiredGatesPassed':False,'results':results},indent=2)+'\n')
 if not okay:raise SystemExit(p.returncode or 1)
base_yarn=(u/'baseline-yarn-expectation.log').read_text();assert summary(base_yarn)=={'tests':1,'pass':0,'fail':1,'skipped':0}
assert summary((u/'yarn-expectation-tests.log').read_text())=={'tests':1,'pass':1,'fail':0,'skipped':0}
results.append(next(r for r in json.loads((u/'validation.json').read_text())['results'] if r['log']=='yarn-expectation-tests.log'))
assert json.loads((u/'type-only-correction.json').read_text())['emittedJavaScriptIdentical']
run('typecheck-final.log',['npm','run','typecheck'])
run('build-final.log',['npm','run','build'])
def manifest(folder):return {str(p.relative_to(folder)):sha(p)for p in folder.rglob('*')if p.is_file()}
backend=json.loads((u/'backend-dist-before.json').read_text());assert manifest(c/'packages/server/dist')==backend;assert manifest(c/'packages/shared/dist')==manifest(b/'packages/shared/dist')
html=(c/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1];assert 'performance-panel'not in(c/'packages/client/dist/assets'/js).read_text()
build={'js':{'name':js,'sha256':sha(c/'packages/client/dist/assets'/js),'bytes':(c/'packages/client/dist/assets'/js).stat().st_size},'css':{'name':css,'sha256':sha(c/'packages/client/dist/assets'/css)},'developmentProbeExcluded':True,'backendFilesUnchanged':len(backend)};(u/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n')
run('deploy-tests.log',['npm','run','test:deploy'],{})
donor=(u/'baseline-donor-tests.log').read_text();assert summary(donor)['fail']==0
run('donor-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/construct-lesson-contact.test.mts','tests/desert-guide-contact.test.mts','tests/ambush-wardrobe-flow.test.mts'],{})
assert all(sha(c/n)==d for n,d in inputs.items())
report={'allRequiredGatesPassed':True,'entireRelatedSuitePassed':False,'baselineKnownFailures':known,'baselineExisting':summary((u/'baseline-existing-tests.log').read_text()),'relatedSummary':{'tests':30,'pass':26,'fail':4,'newFailures':[],'baselineFailureMessagesUnchanged':True,'updatedExpectationRetestedSeparately':True,'unchangedProductionInputsForReusedChecks':True},'baselineDonor':summary(donor),'baselineNew':summary((u/'baseline-final-new-tests.log').read_text()),'baselineUpdatedExpectation':summary(base_yarn),'results':results,'frozenInputs':len(inputs),'inputsUnchanged':True,'typeOnlyCorrection':json.loads((u/'type-only-correction.json').read_text()),'build':build,'compiledSharedChanges':{}}
(u/'validation.json').write_text(json.dumps(report,indent=2)+'\n');(u/'validation-progress.json').write_text(json.dumps({'running':None,'allRequiredGatesPassed':True,'completed':results},indent=2)+'\n');print(json.dumps(report,indent=2))
