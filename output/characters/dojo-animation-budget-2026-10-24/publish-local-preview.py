from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,urllib.request

u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release'
live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha=lambda b:hashlib.sha256(b).hexdigest()
def manifest(folder):return {str(p.relative_to(folder)):sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=15) as r:return r.read()
def replace(source,target):
 target.parent.mkdir(parents=True,exist_ok=True)
 temp=target.with_name(target.name+'.dojo-budget-tmp');shutil.copy2(source,temp);os.replace(temp,target)

audit=json.loads((u/'source-audit.json').read_text());validation=json.loads((u/'validation.json').read_text())
inputs=json.loads((u/'validation-inputs.json').read_text());protected=json.loads((u/'protected-worktree.json').read_text())
native=json.loads((u/'native-verification.json').read_text());restart=json.loads((u/'restart-verification.json').read_text())
assert validation['finalRelated']=={'tests':33,'pass':33,'fail':0} and validation['clientBuildExit']==0
assert validation['redSkinning']=={'tests':2,'pass':0,'fail':2}
assert [r['path'] for r in audit['changed']]==['packages/client/src/agents/HeroModel.ts']
assert [r['path'] for r in audit['new']]==['tests/dojo-skinning-budget.test.mts']
assert len(inputs)==1213 and all(sha((c/name).read_bytes())==digest for name,digest in inputs.items())
assert native['nativeColdReloadVerified'] and native['nativeJumpFailureAndReturnVerified'] and native['paused']
assert restart['fullWorldEqual'] and restart['memoriesEqual'] and restart['memoryFiles']==7
assert json.loads((u/'pose-verification.json').read_text())=={'poses':72,'identical':True,'differences':[]}
assert json.loads((u/'production-console.json').read_text())==[]
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==audit['baseline']
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for row in audit['changed']:assert sha((root/row['path']).read_bytes())==row['before'],row['path']
for row in audit['new']:assert not (root/row['path']).exists(),row['path']
pid=43571;command='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
backend=live/'packages/server/dist';before_backend=manifest(backend)
shared_before={str(folder):manifest(folder/'packages/shared/dist') for folder in [root,live]}
memories=root/'output/local-preview/data/memories';before_memories=manifest(memories)
before_world=fetch('api/world');(u/'local-world-before-publication.json').write_bytes(before_world)
names=subprocess.check_output(['git','ls-tree','-r','--name-only',audit['baseline'],'packages'],cwd=root,text=True).splitlines()
assert len(names)==audit['packageFiles'];changed={row['path']:row for row in audit['changed']}
for name in names:assert sha((live/name).read_bytes())==(changed[name]['before'] if name in changed else sha((c/name).read_bytes())),name
client=live/'packages/client/dist';dist=c/'packages/client/dist'
before_index=(client/'index.html').read_bytes();(u/'local-index-before.html').write_bytes(before_index)
html=(dist/'index.html').read_text();bundle=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1]
old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',before_index)[1].decode();old_js=(client/'assets'/old_bundle).read_bytes();new_js=(dist/'assets'/bundle).read_bytes()
assert bundle==native['productionBundle'] and sha(new_js)==validation['bundleSha256']
assert sha((dist/'assets'/css).read_bytes())==validation['cssSha256'] and (client/'assets'/css).read_bytes()==(dist/'assets'/css).read_bytes()
for row in audit['changed']+audit['new']:
 replace(c/row['path'],root/row['path'])
 if row['path'].startswith('packages/'):replace(c/row['path'],live/row['path'])
replace(dist/'assets'/bundle,client/'assets'/bundle);replace(dist/'index.html',client/'index.html')
assert fetch('')==(dist/'index.html').read_bytes() and fetch('assets/'+bundle)==new_js
assert fetch('assets/'+css)==(dist/'assets'/css).read_bytes()
assert (client/'assets'/old_bundle).read_bytes()==old_js and manifest(backend)==before_backend
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
for name in names:assert (live/name).read_bytes()==(c/name).read_bytes(),name
for row in audit['changed']+audit['new']:assert (root/row['path']).read_bytes()==(c/row['path']).read_bytes(),row['path']
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for folder in [root,live]:assert manifest(folder/'packages/shared/dist')==shared_before[str(folder)]
after_world=fetch('api/world');(u/'local-world-after-publication.json').write_bytes(after_world)
before=json.loads(before_world);after=json.loads(after_world);after_memories=manifest(memories)
report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(new_js),'bundleBytesDelta':len(new_js)-len(old_js),'servedBundleSha256':sha(new_js),'backendDistFilesUnchanged':len(before_backend),'serverRestartedForPublication':False,'serverPid':pid,'mainSaveWrittenOrRestored':False,'worldByteEqualAcrossPublication':before_world==after_world,'beforeTick':before['simulation']['tick'],'afterTick':after['simulation']['tick'],'beforeRunning':before['simulation']['running'],'afterRunning':after['simulation']['running'],'memoryFilesBefore':len(before_memories),'memoryFilesAfter':len(after_memories),'memoriesEqualAcrossPublication':before_memories==after_memories,'css':css,'cssUnchanged':True,'previousBundleRetained':True,'previousBundle':old_bundle,'livePackageFilesMatchCandidate':len(names),'ownedSourceAndTestFilesCopied':2,'protectedWipFilesUnchanged':len(protected),'compiledSharedFilesCopied':0,'allCompiledSharedFilesPreserved':True,'renderReconnected':False,'characterAssetsChanged':False,'nativeReloadPending':True,'note':'The main world is allowed to keep running. Only source, the owned test, the new JS bundle and index.html were written; no save mutation or server restart.'}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
