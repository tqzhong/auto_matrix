from pathlib import Path
import hashlib,json,re,subprocess,time
u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release';b=u/'baseline-release'
audit=json.loads((u/'source-audit.json').read_text());rev=audit['baseline']
files=subprocess.check_output(['git','ls-tree','-r','--name-only',rev,'packages','tests','scripts'],cwd=root,text=True).splitlines()
new=[x['path'] for x in audit['new']];configs=['package.json','package-lock.json','tsconfig.base.json'];h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs={n:h(c/n) for n in files+new+configs};(u/'validation-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n');results=[]
def run(name,cmd,cwd,test=False):
 (u/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
 start=time.monotonic()
 with (u/name).open('w') as log:p=subprocess.run(cmd,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
 row={'log':name,'command':cmd,'cwd':str(cwd.relative_to(u)),'exitCode':p.returncode,'elapsedSeconds':time.monotonic()-start}
 if test:
  text=(u/name).read_text();row.update({key:int(re.findall(r'^# '+key+r' (\d+)$',text,re.M)[-1]) for key in ['tests','pass','fail','skipped']})
 results.append(row);(u/'validation.json').write_text(json.dumps({'allGatesPassed':False,'results':results},indent=2)+'\n')
 if p.returncode or test and (row['fail'] or row['skipped']):raise SystemExit(p.returncode or 1)
base=['tests/fighting-hand-surface.test.mts','tests/pill-hand-surface.test.mts','tests/mirror-hand-surface.test.mts','tests/neb-deck-renderer.test.mts','tests/neb-therapy-contact.test.mts','tests/neb-cabin-space.test.mts','tests/interlude-visibility.test.mts','tests/trinity-relay-renderer.test.mts','tests/betrayal-renderer.test.mts','tests/crew-meal-renderer.test.mts']
prior=json.loads((u/'first-validation/validation.json').read_text())['results'][0]
assert prior['exitCode']==0 and prior['pass']==prior['tests']==47
blobrows=subprocess.check_output(['git','ls-tree','-r',rev,'packages','tests','scripts','package.json','package-lock.json','tsconfig.base.json'],cwd=root,text=True).splitlines()
for row in blobrows:
 meta,name=row.split('\t');data=(b/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==meta.split()[2],name
results.append({**prior,'reusedFrom':'first-validation/validation.json','baselineBlobsReverified':len(blobrows)})
run('shared-build.log',['npm','run','build','-w','packages/shared'],c)
related=['tests/core-connector-contact.test.mts','tests/fighting-hand-surface.test.mts','tests/pill-hand-surface.test.mts','tests/mirror-hand-surface.test.mts','tests/hand-pose.test.mts','tests/hand-curve-cache.test.mts','tests/console-pour-model.test.mts','tests/steak-contact-model.test.mts','tests/crew-meal-model.test.mts','tests/pod-wrist-contact.test.mts','tests/camera.test.mts','tests/recovery-eye-view.test.mts','tests/pod-eye-view.test.mts','tests/tracking-eye.test.mts','tests/neb-therapy-contact.test.mts','tests/cabin.test.mts','tests/truth-recovery.test.mts','tests/download-setup.test.mts','tests/neb-deck-renderer.test.mts','tests/neb-cabin-space.test.mts','tests/patient-skin-continuity.test.mts','tests/lafayette-camera.test.mts','tests/neb-inactive-therapy.test.mts','tests/frame-rate.test.mts','tests/postprocessing.test.mts','tests/interlude-visibility.test.mts','tests/interlude-scenes.test.mts','tests/trinity-relay-renderer.test.mts','tests/betrayal-renderer.test.mts','tests/crew-meal-renderer.test.mts']
run('related-tests.log',['node','--import','tsx','--test','--test-concurrency=1']+related,c,True)
run('deploy-tests.log',['npm','run','test:deploy'],c,True)
run('typecheck-final.log',['npm','run','typecheck'],c)
run('build-final.log',['npm','run','build'],c)
assert inputs=={n:h(c/n) for n in files+new+configs},'inputs changed during validation'
html=(c/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html).group(1);css=re.search(r'/assets/(index-[^" ]+\.css)',html).group(1)
body=(c/'packages/client/dist/assets'/js).read_text();assert 'data-medical-idle' not in body and 'performance-panel' not in body and 'WORLD_FLAT_DENOISE' not in body
backend=json.loads((u/'backend-dist-before.json').read_text());assert {str(p.relative_to(c/'packages/server/dist')):h(p) for p in (c/'packages/server/dist').rglob('*') if p.is_file()}==backend
build={'js':{'name':js,'bytes':(c/'packages/client/dist/assets'/js).stat().st_size,'sha256':h(c/'packages/client/dist/assets'/js)},'css':{'name':css,'sha256':h(c/'packages/client/dist/assets'/css)},'developmentProbeExcluded':True,'backendFilesUnchanged':len(backend)}
(u/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n');(u/'validation.json').write_text(json.dumps({'allGatesPassed':True,'results':results,'frozenInputs':len(inputs),'inputsUnchanged':True,'build':build},indent=2)+'\n');(u/'validation-progress.json').write_text(json.dumps({'running':None,'allGatesPassed':True,'completed':results},indent=2)+'\n');print(json.dumps({'allGatesPassed':True,'results':results,'frozenInputs':len(inputs),'build':build},indent=2))
