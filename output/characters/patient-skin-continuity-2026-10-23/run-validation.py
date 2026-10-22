from pathlib import Path
import hashlib,json,re,subprocess,time

unit=Path(__file__).resolve().parent
candidate=unit/'candidate-release';baseline=unit/'baseline-release';root=unit.parents[2]
revision='5e4f8d78b223657c5f0b767d71caec4661a8015c'
files=subprocess.check_output(['git','ls-tree','-r','--name-only',revision,'packages','tests','scripts'],cwd=root,text=True).splitlines()
new=['packages/client/src/agents/SkinContinuity.ts','tests/helpers/patient-skin.mts','tests/patient-skin-continuity.test.mts','tests/skin-normal-field.test.mts']
configs=['package.json','package-lock.json','tsconfig.base.json']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs={n:sha(candidate/n) for n in files+new+configs}
(unit/'validation-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
results=[]

def run(name,cmd,cwd,test=False,expected_failure=False):
    (unit/'validation-progress.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
    start=time.monotonic()
    with (unit/name).open('w') as log: result=subprocess.run(cmd,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
    report={'log':name,'command':cmd,'cwd':str(cwd.relative_to(unit)),'exitCode':result.returncode,'elapsedSeconds':time.monotonic()-start}
    if test:
        text=(unit/name).read_text();report.update({key:int(re.findall(r'^# '+key+r' (\d+)$',text,re.M)[-1]) for key in ['tests','pass','fail','skipped']})
    if expected_failure:report['expectedFailure']=True
    results.append(report)
    (unit/'validation.json').write_text(json.dumps({'allGatesPassed':False,'results':results},indent=2)+'\n')
    if expected_failure:
        assert result.returncode!=0 and report['fail']>0 and report['skipped']==0,'baseline did not reproduce'
    elif result.returncode or test and (report['fail'] or report['skipped']):raise SystemExit(result.returncode or 1)

run('baseline-final-reproduction.log',['node','--import','tsx','--test','tests/patient-skin-continuity.test.mts'],baseline,True,True)
run('baseline-mirror-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/mirror-liquid.test.mts','tests/mirror-hand-surface.test.mts','tests/tracking-eye.test.mts'],baseline,True)
run('shared-build-final.log',['npm','run','build','-w','packages/shared'],candidate)
run('related-tests.log',['node','--import','tsx','--test','--test-concurrency=1','tests/pod-connection-contact.test.mts','tests/forearm-twist.test.mts','tests/pod-wrist-contact.test.mts','tests/pod-feed-surface.test.mts','tests/pod-renderer.test.mts','tests/pod-rescue-rig-contact.test.mts','tests/pod-instance-culling.test.mts','tests/pod-eye-view.test.mts','tests/patient-skin-continuity.test.mts','tests/wrist-skin.test.mts','tests/hand-curve-cache.test.mts','tests/mirror-liquid.test.mts','tests/mirror-hand-surface.test.mts','tests/tracking-eye.test.mts','tests/skin-normal-field.test.mts'],candidate,True)
run('deploy-tests.log',['npm','run','test:deploy'],candidate,True)
run('typecheck-final.log',['npm','run','typecheck'],candidate)
run('build-final.log',['npm','run','build'],candidate)
assert inputs=={n:sha(candidate/n) for n in files+new+configs},'validation inputs changed while checks ran'
html=(candidate/'packages/client/dist/index.html').read_text();js=re.search(r'/assets/(index-[^" ]+\.js)',html).group(1);css=re.search(r'/assets/(index-[^" ]+\.css)',html).group(1)
build={'js':{'name':js,'bytes':(candidate/'packages/client/dist/assets'/js).stat().st_size,'sha256':sha(candidate/'packages/client/dist/assets'/js)},'css':{'name':css,'sha256':sha(candidate/'packages/client/dist/assets'/css)},'inputsUnchanged':True}
(unit/'candidate-build.json').write_text(json.dumps(build,indent=2)+'\n')
(unit/'validation.json').write_text(json.dumps({'allGatesPassed':True,'results':results,'inputsUnchanged':True,'build':build},indent=2)+'\n')
(unit/'validation-progress.json').write_text(json.dumps({'running':None,'completed':results,'allGatesPassed':True},indent=2)+'\n')
print(json.dumps({'allGatesPassed':True,'results':results,'build':build},indent=2))
