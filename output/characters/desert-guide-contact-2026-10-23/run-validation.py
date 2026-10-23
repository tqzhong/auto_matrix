from pathlib import Path
import json,hashlib,re,subprocess,time
u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release';b=u/'baseline-release';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((u/'validation-inputs.json').read_text());audit=json.loads((u/'source-audit.json').read_text());assert len(inputs)==1183 and all(sha(c/n)==d for n,d in inputs.items())
def failures(text):
 result={}
 for m in re.finditer(r'^not ok \d+ - (.+)$',text,re.M):
  block=text[m.end():];end=re.search(r'^# Subtest:',block,re.M)
  if end:block=block[:end.start()]
  message=re.search(r'\n  error: ([\s\S]*?)(?=\n  (?:code|name|stack|operator):)',block);code=re.search(r'^  code: (.+)$',block,re.M)
  result[m[1]]={'error':message[1].replace('baseline-release','{release}').replace('candidate-release','{release}')if message else None,'code':code[1]if code else None}
 return result
known={}
for n in ['baseline-existing-tests.log','baseline-story-camera-tests.log']:known.update(failures((u/n).read_text()))
assert len(known)==11
rows=subprocess.check_output(['git','ls-tree','-r',audit['baseline'],'packages','tests','scripts','package.json','package-lock.json','tsconfig.base.json'],cwd=root,text=True).splitlines()
for row in rows:
 meta,name=row.split('\t');data=(b/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==meta.split()[2],name
regression=failures((u/'baseline-final-nine-tests.log').read_text());assert len(regression)==7
results=[]
def run(name,args,cwd,expected=None):
 (u/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n');start=time.monotonic()
 with (u/name).open('w') as log:p=subprocess.run(args,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 row={'log':name,'command':args,'cwd':str(cwd.relative_to(u)),'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-start}
 if expected is not None:
  text=(u/name).read_text();row.update({key:int(re.findall(r'^# '+key+r' (\d+)$',text,re.M)[-1])for key in ['tests','pass','fail','skipped']});actual=failures(text);row.update(failureNames=list(actual),newFailures=sorted(set(actual)-set(expected)),baselineFailureMessagesUnchanged=actual==expected)
  okay=actual==expected and row['skipped']==0 and p.returncode==(1 if expected else 0)
 else:okay=p.returncode==0
 results.append(row);(u/'validation.json').write_text(json.dumps({'allRequiredGatesPassed':False,'entireRelatedSuitePassed':False,'baselineKnownFailures':known,'results':results},indent=2)+'\n')
 if not okay:raise SystemExit(p.returncode or 1)
run('new-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/desert-guide-contact.test.mts'],c,{})
related=['tests/reveal-renderer.test.mts','tests/construct-lesson-contact.test.mts','tests/truth-recovery.test.mts','tests/character-asset.test.mts','tests/neb-crew-appearance.test.mts','tests/film-story.test.mts','tests/camera.test.mts']
run('related-tests.log',['node','--import','tsx','--test','--test-concurrency=1']+related,c,known)
run('deploy-tests.log',['npm','run','test:deploy'],c,{})
run('typecheck-final.log',['npm','run','typecheck'],c)
run('build-final.log',['npm','run','build'],c)
assert all(sha(c/n)==d for n,d in inputs.items()),'Frozen source changed during validation'
backend=json.loads((u/'backend-dist-before.json').read_text());assert {str(p.relative_to(c/'packages/server/dist')):sha(p)for p in (c/'packages/server/dist').rglob('*')if p.is_file()}==backend
html=(c/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1];body=(c/'packages/client/dist/assets'/js).read_text();assert 'performance-panel'not in body
build={'js':{'name':js,'sha256':sha(c/'packages/client/dist/assets'/js),'bytes':(c/'packages/client/dist/assets'/js).stat().st_size},'css':{'name':css,'sha256':sha(c/'packages/client/dist/assets'/css)},'developmentProbeExcluded':True,'backendFilesUnchanged':len(backend)};(u/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n')
def manifest(p):return {str(f.relative_to(p)):sha(f)for f in p.rglob('*')if f.is_file()}
a=manifest(b/'packages/shared/dist');d=manifest(c/'packages/shared/dist');changes={n:{'before':a.get(n),'after':d.get(n)}for n in set(a)|set(d)if a.get(n)!=d.get(n)};assert not changes,'Client-only correction changed shared runtime';(u/'compiled-shared-changes.json').write_text(json.dumps(changes,indent=2)+'\n')
report={'allRequiredGatesPassed':True,'entireRelatedSuitePassed':False,'baselineKnownFailures':known,'baselineOriginalRuns':[{'log':'baseline-existing-tests.log','tests':111,'pass':103,'fail':8},{'log':'baseline-story-camera-tests.log','tests':341,'pass':338,'fail':3}],'baselineNewRegression':{'tests':9,'pass':2,'fail':7},'baselineGitBlobsReverified':len(rows),'results':results,'frozenInputs':len(inputs),'inputsUnchanged':True,'build':build,'compiledSharedChanges':changes}
(u/'validation.json').write_text(json.dumps(report,indent=2)+'\n');(u/'validation-progress.json').write_text(json.dumps({'running':None,'allRequiredGatesPassed':True,'completed':results},indent=2)+'\n');print(json.dumps(report,indent=2))
