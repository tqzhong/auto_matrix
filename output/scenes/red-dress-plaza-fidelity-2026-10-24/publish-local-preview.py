from pathlib import Path
import hashlib,json,os,re,shutil,signal,subprocess,sys,time,urllib.request

u=Path(__file__).resolve().parent;r=u.parents[2];c=u/'candidate-release'
live=r/'output/deployment/matrixai-bandwidth-2026-10-20/release';data=r/'output/local-preview/data'
resume='--resume-saved' in sys.argv
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):sha(f) for f in p.rglob('*') if f.is_file()}
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=10) as response:return response.read()
def replace(source,target):
 target.parent.mkdir(parents=True,exist_ok=True)
 temporary=target.with_name(target.name+'.plaza-tmp');shutil.copy2(source,temporary);os.replace(temporary,target)

audit=json.loads((u/'source-audit.json').read_text());v=json.loads((u/'validation.json').read_text())
native=json.loads((u/'native-verification.json').read_text());restart=json.loads((u/'restart-verification.json').read_text())
inputs=json.loads((u/'validation-inputs.json').read_text());protected=json.loads((u/'protected-worktree.json').read_text())
assert v['plazaGeometryAndLighting']=={'tests':14,'pass':14,'fail':0}
assert v['expanded']=={'tests':162,'pass':159,'fail':3} and v['expandedFailuresReproducedAtHead']=={'tests':3,'pass':0,'fail':3}
assert v['deployment']=={'tests':75,'pass':75,'fail':0} and v['buildExit']==v['typecheckExit']==0
assert native['completedByPlayer'] and native['poolPositionUnchanged'] and native['consoleErrors']==0
assert restart['fullWorldEqual'] and restart['memoriesEqual']
assert all(sha(c/n)==h for n,h in inputs.items())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()==audit['baseline']
for name,digest in protected.items():assert sha(r/name)==digest
for row in audit['changed']:
 path=r/row['path'];assert sha(path)==row['before'] if row['before'] else not path.exists()
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
pid=43571;command=['node','output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js']
if not resume:
 assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==' '.join(command)
 assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
 assert 'n'+str(r) in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True).splitlines()
else:
 assert subprocess.run(['ps','-p',str(pid)],capture_output=True).returncode!=0
 assert subprocess.run(['lsof','-tiTCP:5173','-sTCP:LISTEN'],capture_output=True).returncode!=0
assert (live/'node_modules/@auto_matrix/shared').resolve()==live/'packages/shared'
server=manifest(live/'packages/server/dist');assert server==manifest(c/'packages/server/dist')
shared=manifest(live/'packages/shared/dist');root_shared=manifest(r/'packages/shared/dist')
assert {n for n in set(shared)|set(root_shared) if shared.get(n)!=root_shared.get(n)}=={
 'constants/ambush-escape.d.ts','constants/ambush-escape.d.ts.map','constants/ambush-escape.js','constants/ambush-escape.js.map'}
new_shared=manifest(c/'packages/shared/dist');changed_shared=[n for n,h in new_shared.items() if shared.get(n)!=h]
assert len(changed_shared)==11 and set(shared)<=set(new_shared)
expected_root_shared={**root_shared,**{n:new_shared[n] for n in changed_shared}}
dist=c/'packages/client/dist';target=live/'packages/client/dist';bundle=v['js']['name'];css=v['css']['name']
assert sha(dist/'assets'/bundle)==v['js']['sha256'] and sha(target/'assets'/css)==sha(dist/'assets'/css)
old_index=(target/'index.html').read_bytes();old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',old_index)[1].decode()
old_js=sha(target/'assets'/old_bundle);old_bytes=(target/'assets'/old_bundle).stat().st_size
before=json.loads((u/'main-world-before-publication.json').read_text()) if resume else json.loads(fetch('api/world'))
assert not any(a.get('controller') for a in before['agents'].values())
(u/'main-world-before-publication.json').write_text(json.dumps(before))
(u/'local-index-before.html').write_bytes(old_index)
backup=u/'publication-backup'
if resume:assert manifest(backup/'shared-dist')==shared and not (backup/'data').exists()
else:
 backup.mkdir(exist_ok=False);shutil.copytree(live/'packages/shared/dist',backup/'shared-dist')

if not resume:os.kill(pid,signal.SIGTERM)
for _ in range(150):
 state=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
 if state.returncode or state.stdout.lstrip().startswith('Z'):break
 time.sleep(.1)
else:raise RuntimeError('The old local server has not finished its normal save; inspect before continuing')
assert subprocess.run(['lsof','-tiTCP:5173','-sTCP:LISTEN'],capture_output=True).returncode!=0
saved=json.loads((data/'world.json').read_text());assert saved['simulation']['running']==before['simulation']['running']
assert saved['tick']>=before['simulation']['tick'] and saved['sandbox']['neoLife'].get('journey')==before['sandbox']['neoLife'].get('journey')
shutil.copytree(data,backup/'data');checkpoint_sha=sha(data/'world.json');memories=manifest(data/'memories')
for row in audit['changed']:
 name=row['path'];replace(c/name,r/name)
 if name.startswith('packages/'):replace(c/name,live/name)
for name in changed_shared:
 for folder in [r,live]:replace(c/'packages/shared/dist'/name,folder/'packages/shared/dist'/name)
replace(dist/'assets'/bundle,target/'assets'/bundle);replace(dist/'index.html',target/'index.html')
env=os.environ.copy();env.update({'HOST':'127.0.0.1','PORT':'5173','MATRIX_DATA_DIR':str(data),'MATRIX_CLOUD_SAVE':'','SUPABASE_URL':'','SUPABASE_SECRET_KEY':'','LLM_API_KEY':''})
with (u/'local-server.log').open('ab') as log:
 process=subprocess.Popen(command,cwd=r,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(u/'local-process.json').write_text(json.dumps({'pid':process.pid,'command':command,'cwd':str(r),'port':5173},indent=2)+'\n')
for _ in range(150):
 try:
  after=json.loads(fetch('api/world'));break
 except OSError:
  assert process.poll() is None,'Inspect local-server.log and publication-backup before recovery';time.sleep(.1)
else:raise RuntimeError('New local server is not ready; inspect log and saved process identity')
assert fetch('')==(dist/'index.html').read_bytes()
assert hashlib.sha256(fetch('assets/'+bundle)).hexdigest()==v['js']['sha256']
assert sha(target/'assets'/old_bundle)==old_js
assert manifest(live/'packages/server/dist')==server
assert manifest(live/'packages/shared/dist')==new_shared
assert manifest(r/'packages/shared/dist')==expected_root_shared
assert sha(data/'world.json')==checkpoint_sha and manifest(data/'memories')==memories
assert after['simulation']['running']==saved['simulation']['running'] and after['simulation']['tick']>=saved['tick']
assert after['sandbox']['neoLife'].get('journey')==saved['sandbox']['neoLife'].get('journey')
assert f'Restored world at tick {saved["tick"]}' in (u/'local-server.log').read_text()
for name,digest in protected.items():assert sha(r/name)==digest
report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytesDelta':v['js']['bytes']-old_bytes,'servedBundleSha256':v['js']['sha256'],
 'oldServerPid':pid,'serverPid':process.pid,'serverRestarted':True,'normalShutdownSaved':True,'mainSaveManuallyWrittenOrRestored':False,
 'beforeTick':before['simulation']['tick'],'savedTick':saved['tick'],'afterTick':after['simulation']['tick'],'running':after['simulation']['running'],
 'savedCheckpointFilePreservedOnRestart':True,'mainJourneyPreserved':True,'memoryFiles':len(memories),'savedMemoriesPreservedOnRestart':True,
 'backendFilesUnchanged':len(server),'sharedOutputsUpdated':changed_shared,'liveSharedMatchesCandidate':True,'rootProtectedAmbushBuildPreserved':True,
 'protectedWipFilesUnchanged':len(protected),'oldBundleRetained':old_bundle,'cssUnchanged':True,'publicAssetsChanged':False,
 'renderReconnected':False,'nativeReloadPending':True}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
