from pathlib import Path
import json,hashlib,re,subprocess,time,shutil
u=Path(__file__).resolve().parent;c=u/'candidate-release';b=u/'baseline-release';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((u/'validation-inputs.json').read_text());assert all(sha(c/n)==d for n,d in inputs.items())
def summary(body):
 return {key:int(re.findall(r'^# '+key+r' (\d+)$',body,re.M)[-1]) for key in ['tests','pass','fail','skipped']}
def failures(body):
 result={}
 for m in re.finditer(r'^not ok \d+ - (.+)$',body,re.M):
  block=body[m.end():];end=re.search(r'^# Subtest:',block,re.M)
  if end:block=block[:end.start()]
  error=re.search(r'\n  error: ([\s\S]*?)(?=\n  (?:code|name|stack|operator):)',block);code=re.search(r'^  code: (.+)$',block,re.M)
  result[m[1]]={'error':error[1].replace('baseline-release','{release}').replace('candidate-release','{release}') if error else None,'code':code[1] if code else None}
 return result
known=failures((u/'baseline-existing-tests.log').read_text());assert len(known)==4
results=[]
def run(name,args,expected=None):
 (u/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n');start=time.monotonic()
 with (u/name).open('w')as log:p=subprocess.run(args,cwd=c,stdout=log,stderr=subprocess.STDOUT)
 row={'log':name,'command':args,'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-start}
 if expected is not None:
  body=(u/name).read_text();actual=failures(body);row.update(summary(body));row.update(failureNames=list(actual),newFailures=sorted(set(actual)-set(expected)),baselineFailureMessagesUnchanged=actual==expected)
  okay=actual==expected and row['skipped']==0 and p.returncode==(1 if expected else 0)
 else:okay=p.returncode==0
 results.append(row);(u/'validation.json').write_text(json.dumps({'allRequiredGatesPassed':False,'results':results},indent=2)+'\n')
 if not okay:raise SystemExit(p.returncode or 1)
# The final new-test run was already started against these frozen inputs.
new=(u/'iteration-07-tests.log').read_text();assert summary(new)=={'tests':5,'pass':5,'fail':0,'skipped':0}
shutil.copyfile(u/'iteration-07-tests.log',u/'new-tests.log');results.append({'log':'new-tests.log','exitCode':0,**summary(new),'reusedCompletedRun':True})
run('related-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/neb-crew-appearance.test.mts','tests/hammer-briefing-render.test.mts','tests/farewell-appearance.test.mts','tests/truth-ground-contact.test.mts'],known)
donor=(u/'baseline-donor-tests.log').read_text();assert summary(donor)['fail']==0
run('donor-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/construct-lesson-contact.test.mts','tests/desert-guide-contact.test.mts','tests/ambush-wardrobe-flow.test.mts'],{})
run('deploy-tests.log',['npm','run','test:deploy'],{})
run('typecheck-final.log',['npm','run','typecheck'])
run('build-final.log',['npm','run','build'])
assert all(sha(c/n)==d for n,d in inputs.items())
def manifest(folder):return {str(p.relative_to(folder)):sha(p) for p in folder.rglob('*') if p.is_file()}
backend=json.loads((u/'backend-dist-before.json').read_text());assert manifest(c/'packages/server/dist')==backend
assert manifest(c/'packages/shared/dist')==manifest(b/'packages/shared/dist')
html=(c/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1]
assert 'performance-panel'not in(c/'packages/client/dist/assets'/js).read_text()
build={'js':{'name':js,'sha256':sha(c/'packages/client/dist/assets'/js),'bytes':(c/'packages/client/dist/assets'/js).stat().st_size},'css':{'name':css,'sha256':sha(c/'packages/client/dist/assets'/css)},'developmentProbeExcluded':True,'backendFilesUnchanged':len(backend)}
(u/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n')
report={'allRequiredGatesPassed':True,'entireRelatedSuitePassed':False,'baselineKnownFailures':known,'baselineExisting':summary((u/'baseline-existing-tests.log').read_text()),'baselineDonor':summary(donor),'baselineNew':summary((u/'baseline-final-new-tests.log').read_text()),'results':results,'frozenInputs':len(inputs),'inputsUnchanged':True,'build':build,'compiledSharedChanges':{}}
(u/'validation.json').write_text(json.dumps(report,indent=2)+'\n');(u/'validation-progress.json').write_text(json.dumps({'running':None,'allRequiredGatesPassed':True,'completed':results},indent=2)+'\n');print(json.dumps(report,indent=2))
