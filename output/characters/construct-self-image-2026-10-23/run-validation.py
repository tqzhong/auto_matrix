from pathlib import Path
import json,hashlib,re,subprocess,time
u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release';b=u/'baseline-release';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
audit=json.loads((u/'source-audit.json').read_text());inputs=json.loads((u/'validation-inputs.json').read_text());assert len(inputs)==1177
assert all(sha(c/name)==digest for name,digest in inputs.items())
def failures(text):
 result={}
 for match in re.finditer(r'^not ok \d+ - (.+)$',text,re.M):
  block=text[match.end():];stop=re.search(r'^# Subtest:',block,re.M)
  if stop:block=block[:stop.start()]
  message=re.search(r'\n  error: ([\s\S]*?)(?=\n  (?:code|name|stack|operator):)',block)
  code=re.search(r'^  code: (.+)$',block,re.M)
  result[match[1]]={'error':message[1].replace('baseline-release','{release}').replace('candidate-release','{release}') if message else None,'code':code[1] if code else None}
 return result
known={}
for name in ['baseline-related-tests.log','baseline-character-tests.log']:known.update(failures((u/name).read_text()))
assert len(known)==8
blobrows=subprocess.check_output(['git','ls-tree','-r',audit['baseline'],'packages','tests','scripts','package.json','package-lock.json','tsconfig.base.json'],cwd=root,text=True).splitlines()
for row in blobrows:
 meta,name=row.split('\t');data=(b/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==meta.split()[2],name
results=[]
def run(name,command,cwd,expected=None):
 (u/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n');start=time.monotonic()
 with (u/name).open('w') as log:process=subprocess.run(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 row={'log':name,'command':command,'cwd':str(cwd.relative_to(u)),'exitCode':process.returncode,'elapsedSeconds':time.monotonic()-start}
 if expected is not None:
  text=(u/name).read_text();row.update({key:int(re.findall(r'^# '+key+r' (\d+)$',text,re.M)[-1]) for key in ['tests','pass','fail','skipped']});actual=failures(text)
  messages_match=actual==expected if isinstance(expected,dict) else None
  row.update(failureNames=list(actual),newFailures=sorted(set(actual)-set(expected)),baselineFailureMessagesUnchanged=messages_match)
  okay=set(actual)==set(expected) and messages_match is not False and row['skipped']==0 and process.returncode==(1 if expected else 0)
 else:okay=process.returncode==0
 results.append(row);(u/'validation.json').write_text(json.dumps({'allRequiredGatesPassed':False,'results':results,'baselineKnownFailures':known,'baselineGitBlobsReverified':len(blobrows)},indent=2)+'\n')
 if not okay:raise SystemExit(process.returncode or 1)
# The original 21- and 87-test baselines were run before edits. Reverify every
# original Git blob above; only the new regression files are copied here.
for name in ['tests/construct-self-image.test.mts','tests/helpers/construct-inspection.mts']:(b/name).write_bytes((c/name).read_bytes())
regressions=re.findall(r"^test\('([^']+)'",(c/'tests/construct-self-image.test.mts').read_text(),re.M);assert len(regressions)==7
run('baseline-final-seven-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/construct-self-image.test.mts'],b,{regressions[i] for i in [0,1,3,4,6]})
related=['tests/construct-self-image.test.mts','tests/character-asset.test.mts','tests/neb-crew-appearance.test.mts','tests/reveal-renderer.test.mts','tests/cabin.test.mts','tests/truth-recovery.test.mts','tests/fighting-hand-surface.test.mts','tests/pill-hand-surface.test.mts','tests/mirror-hand-surface.test.mts','tests/core-connector-contact.test.mts','tests/hand-curve-cache.test.mts','tests/skinned-rebind-bounds.test.mts','tests/patient-skin-continuity.test.mts','tests/interlude-visibility.test.mts']
assert all((c/name).exists() for name in related)
run('related-tests.log',['node','--import','tsx','--test','--test-concurrency=1']+related,c,known)
run('deploy-tests.log',['npm','run','test:deploy'],c,{})
run('typecheck-final.log',['npm','run','typecheck'],c)
run('build-final.log',['npm','run','build'],c)
assert all(sha(c/name)==digest for name,digest in inputs.items()),'A frozen source input changed during validation'
backend=json.loads((u/'backend-dist-before.json').read_text());assert {str(p.relative_to(c/'packages/server/dist')):sha(p) for p in (c/'packages/server/dist').rglob('*') if p.is_file()}==backend
html=(c/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1]
body=(c/'packages/client/dist/assets'/js).read_text();assert 'data-medical-idle' not in body and 'performance-panel' not in body
build={'js':{'name':js,'bytes':(c/'packages/client/dist/assets'/js).stat().st_size,'sha256':sha(c/'packages/client/dist/assets'/js)},'css':{'name':css,'sha256':sha(c/'packages/client/dist/assets'/css)},'developmentProbeExcluded':True,'backendFilesUnchanged':len(backend)}
(u/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n')
report={'allRequiredGatesPassed':True,'entireRelatedSuitePassed':False,'baselineKnownFailures':known,'baselineGitBlobsReverified':len(blobrows),'baselineOriginalRuns':[{'log':'baseline-related-tests.log','tests':21,'pass':20,'fail':1},{'log':'baseline-character-tests.log','tests':87,'pass':80,'fail':7}],'results':results,'frozenInputs':len(inputs),'inputsUnchanged':True,'build':build}
(u/'validation.json').write_text(json.dumps(report,indent=2)+'\n');(u/'validation-progress.json').write_text(json.dumps({'running':None,'allRequiredGatesPassed':True,'completed':results},indent=2)+'\n');print(json.dumps(report,indent=2))
