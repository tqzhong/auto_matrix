from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,urllib.request
u=Path(__file__).resolve().parent;r=u.parents[2];c=u/'candidate-release';live=r/'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):sha(f) for f in p.rglob('*') if f.is_file()}
def fetch(p):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+p,timeout=20) as f:return f.read()
def replace(a,b):
 b.parent.mkdir(parents=True,exist_ok=True);tmp=b.with_name(b.name+'.character-profile-tmp');shutil.copy2(a,tmp);os.replace(tmp,b)
audit=json.loads((u/'source-audit.json').read_text());v=json.loads((u/'validation.json').read_text());native=json.loads((u/'native-verification.json').read_text());restart=json.loads((u/'restart-verification.json').read_text());inputs=json.loads((u/'validation-inputs.json').read_text());protected=json.loads((u/'protected-worktree.json').read_text())
assert v['after']=={'tests':15,'pass':15,'fail':0} and v['clientBuildExit']==0
assert v['poseComparison']['identicalGeometry']==72 and v['poseComparison']['maxTransformDelta']<1e-12
assert native['nativeColdReloadVerified'] and native['nativeWalkDistance']>2 and native['paused'] and native['consoleErrors']==0
assert restart['fullWorldEqual'] and restart['memoriesEqual'] and restart['memoryFiles']==7
assert len(inputs)==1215 and all(sha(c/n)==d for n,d in inputs.items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()==audit['baseline']
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
for n,d in protected.items():assert sha(r/n)==d
for row in audit['changed']:assert sha(r/row['path'])==row['before']
pid=43571;command='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
compiled={str(p):manifest(p) for p in [r/'packages/shared/dist',live/'packages/shared/dist',live/'packages/server/dist']}
assert compiled[str(live/'packages/shared/dist')]==manifest(c/'packages/shared/dist')
assert compiled[str(live/'packages/server/dist')]==manifest(c/'packages/server/dist')
names=subprocess.check_output(['git','ls-tree','-r','--name-only',audit['baseline'],'packages'],cwd=r,text=True).splitlines();assert len(names)==721
changes={row['path']:row for row in audit['changed']}
for n in names:assert sha(live/n)==(changes[n]['before'] if n in changes else sha(c/n)),n
memories=r/'output/local-preview/data/memories';before_memories=manifest(memories);before_world=fetch('api/world');(u/'local-world-before-publication.json').write_bytes(before_world)
dist=c/'packages/client/dist';target=live/'packages/client/dist';old_index=(target/'index.html').read_bytes();(u/'local-index-before.html').write_bytes(old_index)
old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',old_index)[1].decode();old_js=(target/'assets'/old_bundle).read_bytes();bundle=v['js']['name'];css=v['css']['name'];new_js=(dist/'assets'/bundle).read_bytes()
assert bundle==native['productionBundle'] and sha(dist/'assets'/bundle)==v['js']['sha256']
assert (dist/'assets'/css).read_bytes()==(target/'assets'/css).read_bytes()
for row in audit['changed']:
 n=row['path'];replace(c/n,r/n)
 if n.startswith('packages/'):replace(c/n,live/n)
replace(dist/'assets'/bundle,target/'assets'/bundle);replace(dist/'index.html',target/'index.html')
assert fetch('')==(dist/'index.html').read_bytes() and fetch('assets/'+bundle)==new_js
assert (target/'assets'/old_bundle).read_bytes()==old_js
for p,files in compiled.items():assert manifest(Path(p))==files
for n in names:assert sha(live/n)==sha(c/n),n
for n,d in protected.items():assert sha(r/n)==d
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
after_world=fetch('api/world');(u/'local-world-after-publication.json').write_bytes(after_world);before=json.loads(before_world);after=json.loads(after_world);after_memories=manifest(memories)
report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(new_js),'bundleBytesDelta':len(new_js)-len(old_js),'servedBundleSha256':hashlib.sha256(new_js).hexdigest(),'serverPid':pid,'serverRestarted':False,'mainSaveWrittenOrRestored':False,'beforeTick':before['simulation']['tick'],'afterTick':after['simulation']['tick'],'beforeRunning':before['simulation']['running'],'afterRunning':after['simulation']['running'],'memoryFiles':len(after_memories),'memoriesEqual':before_memories==after_memories,'protectedWipFilesUnchanged':len(protected),'backendFilesUnchanged':len(compiled[str(live/'packages/server/dist')]),'rootAndLiveSharedOutputsUnchanged':True,'livePackageFilesMatchCandidate':len(names),'cssUnchanged':True,'oldBundleRetained':old_bundle,'assetsChanged':False,'renderReconnected':False,'nativeReloadPending':True}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
