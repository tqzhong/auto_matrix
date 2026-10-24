from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,urllib.request

u=Path(__file__).resolve().parent;r=u.parents[2];c=u/'candidate-release'
live=r/'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):sha(f) for f in p.rglob('*') if f.is_file()}
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=20) as response:return response.read()
def replace(source,target):
 target.parent.mkdir(parents=True,exist_ok=True)
 temporary=target.with_name(target.name+'.red-dress-tmp');shutil.copy2(source,temporary);os.replace(temporary,target)

audit=json.loads((u/'source-audit.json').read_text());v=json.loads((u/'validation.json').read_text())
native=json.loads((u/'native-verification.json').read_text());restart=json.loads((u/'restart-verification.json').read_text())
inputs=json.loads((u/'validation-inputs.json').read_text());protected=json.loads((u/'protected-worktree.json').read_text())
assert v['actor']=={'tests':8,'pass':8,'fail':0} and v['related']['fail']==0 and v['related']['pass']>=10
assert v['clientBuildExit']==0 and v['typecheckExit']==0
assert native['productionColdLoad'] and native['missedPassObserved'] and native['nativeRetry'] and native['frozenObserved']
assert native['completedByPlayer'] and native['consoleErrors']==0 and native['paused']
assert restart['fullWorldEqual'] and restart['memoriesEqual'] and restart['memoryFiles']==7
assert len(inputs)==1221 and all(sha(c/name)==digest for name,digest in inputs.items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()==audit['baseline']
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
for name,digest in protected.items():assert sha(r/name)==digest
for row in audit['changed']:
 path=r/row['path'];assert sha(path)==row['before'] if row['before'] else not path.exists()
pid=43571;command='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
compiled={str(p):manifest(p) for p in [r/'packages/shared/dist',live/'packages/shared/dist',live/'packages/server/dist']}
assert compiled[str(live/'packages/shared/dist')]==manifest(c/'packages/shared/dist')
assert compiled[str(live/'packages/server/dist')]==manifest(c/'packages/server/dist')
names=subprocess.check_output(['git','ls-tree','-r','--name-only',audit['baseline'],'packages'],cwd=r,text=True).splitlines()
changes={row['path']:row for row in audit['changed']}
for name in names:assert sha(live/name)==(changes[name]['before'] if name in changes else sha(c/name)),name
memories=r/'output/local-preview/data/memories';before_memories=manifest(memories)
before_world=fetch('api/world');(u/'local-world-before-publication.json').write_bytes(before_world)
dist=c/'packages/client/dist';target=live/'packages/client/dist'
old_index=(target/'index.html').read_bytes();(u/'local-index-before.html').write_bytes(old_index)
old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',old_index)[1].decode();old_js=(target/'assets'/old_bundle).read_bytes()
bundle=v['js']['name'];css=v['css']['name'];new_js=(dist/'assets'/bundle).read_bytes()
assert bundle==native['productionBundle'] and sha(dist/'assets'/bundle)==v['js']['sha256']
assert (dist/'assets'/css).read_bytes()==(target/'assets'/css).read_bytes()
assets=[row for row in audit['changed'] if row['path'].startswith('packages/client/public/')]
for row in assets:
 path=Path(row['path']).relative_to('packages/client/public')
 assert sha(dist/path)==row['after'] and not (target/path).exists()
for row in audit['changed']:
 name=row['path'];replace(c/name,r/name)
 if name.startswith('packages/'):replace(c/name,live/name)
for row in assets:
 path=Path(row['path']).relative_to('packages/client/public');replace(dist/path,target/path)
replace(dist/'assets'/bundle,target/'assets'/bundle)
replace(dist/'index.html',target/'index.html')
assert fetch('')==(dist/'index.html').read_bytes() and fetch('assets/'+bundle)==new_js
for row in assets:
 path=Path(row['path']).relative_to('packages/client/public')
 assert hashlib.sha256(fetch(str(path))).hexdigest()==row['after']
assert (target/'assets'/old_bundle).read_bytes()==old_js
for path,files in compiled.items():assert manifest(Path(path))==files
for name in names:assert sha(live/name)==sha(c/name),name
for name,digest in protected.items():assert sha(r/name)==digest
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
after_world=fetch('api/world');(u/'local-world-after-publication.json').write_bytes(after_world)
before=json.loads(before_world);after=json.loads(after_world);after_memories=manifest(memories)
report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(new_js),'bundleBytesDelta':len(new_js)-len(old_js),
 'servedBundleSha256':hashlib.sha256(new_js).hexdigest(),'serverPid':pid,'serverRestarted':False,'mainSaveWrittenOrRestored':False,
 'beforeTick':before['simulation']['tick'],'afterTick':after['simulation']['tick'],'beforeRunning':before['simulation']['running'],
 'afterRunning':after['simulation']['running'],'memoryFiles':len(after_memories),'memoriesEqual':before_memories==after_memories,
 'protectedWipFilesUnchanged':len(protected),'backendFilesUnchanged':len(compiled[str(live/'packages/server/dist')]),
 'rootAndLiveSharedOutputsUnchanged':True,'liveExistingPackageFilesMatchCandidate':len(names),'cssUnchanged':True,
 'oldBundleRetained':old_bundle,'newPublicFiles':[row['path'] for row in assets],
 'newRuntimeAssetBytes':sum(row['bytes'] for row in assets if not row['path'].endswith('.md')),
 'renderReconnected':False,'nativeReloadPending':True}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
