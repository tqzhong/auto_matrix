import hashlib,json,os,re,shutil,subprocess,urllib.request
from pathlib import Path
u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release';live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha=lambda data:hashlib.sha256(data).hexdigest()
def manifest(folder):return {str(p.relative_to(folder)):sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=15) as response:return response.read()
def replace(source,target):
 target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_name(target.name+'.construct-image-tmp');shutil.copy2(source,temp);os.replace(temp,target)
audit=json.loads((u/'source-audit.json').read_text());validation=json.loads((u/'validation.json').read_text());native=json.loads((u/'native-verification.json').read_text());inputs=json.loads((u/'validation-inputs.json').read_text());protected=json.loads((u/'protected-worktree.json').read_text())
assert validation['allRequiredGatesPassed'] and validation['inputsUnchanged'] and validation['entireRelatedSuitePassed'] is False
related=next(r for r in validation['results'] if r['log']=='related-tests.log');assert related['tests']==158 and related['pass']==150 and related['fail']==8 and related['baselineFailureMessagesUnchanged'] and not related['newFailures']
deploy=next(r for r in validation['results'] if r['log']=='deploy-tests.log');assert deploy['tests']==deploy['pass']==75 and deploy['fail']==0
assert all(next(r for r in validation['results'] if r['log']==name)['exitCode']==0 for name in ['typecheck-final.log','build-final.log'])
assert len(inputs)==1177 and all(sha((c/name).read_bytes())==digest for name,digest in inputs.items())
assert native['productionColdLoadChecked'] and native['bothViewsAndMouseLookChecked'] and native['walkingToChairChecked'] and native['leatherAndTelevisionLessonChecked'] and native['reflectionChoiceChecked'] and native['desertArrivalChecked']
assert native['finalScene']=='m1_desert' and native['finalStep']==0 and native['neoHealth']==100 and native['walk']['sampledHorizontalPathLowerBound']>9
assert native['heldImage']=={'tick':7222,'phase':'image','elapsed':4.434}
assert native['realBackendRestart']['byteIdenticalWorld'] and native['realBackendRestart']['memoryBytesUnchanged']
assert all(value==0 for value in native['consoleCounts'].values())
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for name,digest in json.loads((u/'root-package-before.json').read_text()).items():assert sha((root/name).read_bytes())==digest,name
for row in audit['changed']:assert sha((root/row['path']).read_bytes())==row['before'],row['path']
for row in audit['new']:assert not (root/row['path']).exists(),row['path']
backend=live/'packages/server/dist';before_backend=json.loads((u/'backend-dist-before.json').read_text());assert manifest(backend)==before_backend
pid=json.loads((u/'baseline-audit.json').read_text())['mainPid'];command='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
before_world=fetch('api/world');(u/'local-world-before-publication.json').write_bytes(before_world);assert before_world==(u/'main-world-before.json').read_bytes()
memories=root/'output/local-preview/data/memories';before_memories=manifest(memories);assert before_memories==json.loads((u/'main-memories-before.json').read_text())
names=subprocess.check_output(['git','ls-tree','-r','--name-only',audit['baseline'],'packages'],cwd=root,text=True).splitlines();assert len(names)==audit['packageFiles']==708
changed={row['path']:row for row in audit['changed']}
for name in names:assert sha((live/name).read_bytes())==(changed[name]['before'] if name in changed else sha((c/name).read_bytes())),name
# This unit changes client code only. Preserve every existing compiled shared file.
shared_before={str(folder):manifest(folder/'packages/shared/dist') for folder in [root,live]}
client=live/'packages/client/dist';dist=c/'packages/client/dist';before_index=(client/'index.html').read_bytes();(u/'local-index-before.html').write_bytes(before_index)
html=(dist/'index.html').read_text();bundle=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1];old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',before_index)[1].decode();old_js=(client/'assets'/old_bundle).read_bytes();new_js=(dist/'assets'/bundle).read_bytes()
assert bundle==native['productionBundle'] and sha(new_js)==validation['build']['js']['sha256']
assert (dist/'assets'/css).read_bytes()==(client/'assets'/css).read_bytes()
for row in audit['changed']+audit['new']:
 replace(c/row['path'],root/row['path'])
 if row['path'].startswith('packages/'):replace(c/row['path'],live/row['path'])
replace(dist/'assets'/bundle,client/'assets'/bundle);replace(dist/'index.html',client/'index.html')
assert fetch('')==(dist/'index.html').read_bytes() and fetch('assets/'+bundle)==new_js
assert (client/'assets'/old_bundle).read_bytes()==old_js and manifest(backend)==before_backend
assert fetch('api/world')==before_world and manifest(memories)==before_memories
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
published=names+[r['path'] for r in audit['new'] if r['path'].startswith('packages/')]
for name in published:assert (live/name).read_bytes()==(c/name).read_bytes(),name
for row in audit['changed']+audit['new']:assert (root/row['path']).read_bytes()==(c/row['path']).read_bytes(),row['path']
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for folder in [root,live]:assert manifest(folder/'packages/shared/dist')==shared_before[str(folder)]
w=json.loads(before_world);report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(new_js),'servedBundleSha256':sha(new_js),'backendDistFilesUnchanged':len(before_backend),'serverRestartedForPublication':False,'serverPid':pid,'fullWorldSnapshotPreservedAcrossPublication':True,'fullWorldSha256':sha(before_world),'memoryFilesPreservedAcrossPublication':len(before_memories),'tick':w['simulation']['tick'],'running':w['simulation']['running'],'previousBundleRetained':True,'previousBundle':old_bundle,'livePackageFilesMatchCandidate':len(published),'ownedSourceAndTestFilesCopied':len(audit['changed'])+len(audit['new']),'protectedWipFilesUnchanged':len(protected),'compiledSharedFilesCopied':0,'allCompiledSharedFilesPreserved':True,'renderReconnected':False,'characterAssetsChanged':False,'nativeReloadPending':True,'knownRelatedBaselineFailures':8,'newRelatedFailures':0}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
