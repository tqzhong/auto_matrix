from pathlib import Path
import hashlib,json,os,re,shutil,signal,subprocess,time,urllib.request

u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release'
live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release';data=root/'output/local-preview/data'
sha=lambda b:hashlib.sha256(b).hexdigest()
def manifest(folder):return {str(p.relative_to(folder)):sha(p.read_bytes())for p in folder.rglob('*')if p.is_file()}
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=10)as response:return response.read()
def replace(source,target):
 target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_name(target.name+'.construct-lesson-tmp');shutil.copy2(source,temp);os.replace(temp,target)

assert not(u/'publication-started.json').exists(),'Publication already attempted; inspect its recorded process/state instead of repeating it'
v=json.loads((u/'validation.json').read_text());a=json.loads((u/'source-audit.json').read_text());n=json.loads((u/'native-verification.json').read_text())
assert v['allRequiredGatesPassed']and v['inputsUnchanged']and not v['entireRelatedSuitePassed']
related=next(row for row in v['results']if row['log']=='related-tests.log')
assert(related['tests'],related['pass'],related['fail'])==(486,475,11)and related['baselineFailureMessagesUnchanged']and not related['newFailures']
assert all(row['exitCode']==0 for row in v['results']if row['log']!='related-tests.log')
assert n['productionColdLoadChecked']and n['bothViewsAndMouseLookChecked']and n['walkingToChairChecked']and n['reflectionChoiceChecked']and n['desertArrivalChecked']
assert(n['finalScene'],n['finalStep'],n['neoHealth'])==('m1_desert',0,100)and n['realBackendRestart']['byteIdenticalWorld']and n['realBackendRestart']['memoryBytesUnchanged']
assert all(value==0 for value in n['consoleCounts'].values())
inputs=json.loads((u/'validation-inputs.json').read_text());assert len(inputs)==1181 and all(sha((c/name).read_bytes())==digest for name,digest in inputs.items())
for port in [5200,5201]:assert subprocess.run(['lsof',f'-tiTCP:{port}','-sTCP:LISTEN'],capture_output=True).returncode!=0
protected=json.loads((u/'protected-worktree.json').read_text())
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for name,digest in json.loads((u/'root-package-before.json').read_text()).items():assert sha((root/name).read_bytes())==digest,name
for row in a['changed']:assert sha((root/row['path']).read_bytes())==row['before'],row['path']
for row in a['new']:assert not(root/row['path']).exists(),row['path']
backend=json.loads((u/'backend-dist-before.json').read_text());assert manifest(live/'packages/server/dist')==backend
names=subprocess.check_output(['git','ls-tree','-r','--name-only',a['baseline'],'packages'],cwd=root,text=True).splitlines();assert len(names)==709
changed={row['path']:row for row in a['changed']}
for name in names:assert sha((live/name).read_bytes())==(changed[name]['before']if name in changed else sha((c/name).read_bytes())),name
shared_changes=json.loads((u/'compiled-shared-changes.json').read_text())
assert set(shared_changes)=={'constants/construct.js','constants/construct.js.map','constants/construct.d.ts','constants/awakening.d.ts'}
shared_before={str(folder):manifest(folder/'packages/shared/dist')for folder in [root,live]}
for folder in [root,live]:
 for name,row in shared_changes.items():assert shared_before[str(folder)][name]==row['before']and sha((c/'packages/shared/dist'/name).read_bytes())==row['after'],name
pid=json.loads((u/'baseline-audit.json').read_text())['mainPid'];command='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()==command
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()==str(pid)
assert 'n'+str(root)in subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn'],text=True).splitlines()
before=fetch('api/world');assert before==(u/'main-world-before.json').read_bytes();w=json.loads(before);assert not w['simulation']['running']
before_memories=manifest(data/'memories');assert before_memories==json.loads((u/'main-memories-before.json').read_text())
client=live/'packages/client/dist';dist=c/'packages/client/dist';before_index=(client/'index.html').read_bytes();html=(dist/'index.html').read_text()
bundle=re.search(r'/assets/(index-[^" ]+\.js)',html)[1];css=re.search(r'/assets/(index-[^" ]+\.css)',html)[1];old_bundle=re.search(rb'/assets/(index-[^" ]+\.js)',before_index)[1].decode()
new_js=(dist/'assets'/bundle).read_bytes();old_js=(client/'assets'/old_bundle).read_bytes()
assert bundle==n['productionBundle']==v['build']['js']['name']and sha(new_js)==v['build']['js']['sha256']
assert(dist/'assets'/css).read_bytes()==(client/'assets'/css).read_bytes()
backup=u/'publication-backup';assert not backup.exists();backup.mkdir()
subprocess.run(['cp','-cR',str(data),str(backup/'main-data')],check=True)
for folder,label in [(root,'root'),(live,'live')]:
 for row in a['changed']:
  target=backup/label/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(folder/row['path'],target)if(folder/row['path']).exists()else None
 for name in shared_changes:
  target=backup/label/'packages/shared/dist'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(folder/'packages/shared/dist'/name,target)
(backup/'index.html').write_bytes(before_index);(u/'local-world-before-publication.json').write_bytes(before)
(u/'publication-started.json').write_text(json.dumps({'oldPid':pid,'reason':'Load the intentionally changed Construct chair approach and performer placement','backupDirectory':str(backup),'sharedFiles':list(shared_changes)},indent=2)+'\n')
for row in a['changed']+a['new']:
 replace(c/row['path'],root/row['path'])
 if row['path'].startswith('packages/'):replace(c/row['path'],live/row['path'])
for folder in [root,live]:
 for name in shared_changes:replace(c/'packages/shared/dist'/name,folder/'packages/shared/dist'/name)
replace(dist/'assets'/bundle,client/'assets'/bundle);replace(dist/'index.html',client/'index.html')
# The backend implementation is unchanged. Its cached shared scene constants need
# one deliberate restart, with the existing paused local save and cloud disabled.
os.kill(pid,signal.SIGTERM)
for attempt in range(150):
 state=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True)
 if state.returncode or state.stdout.strip().startswith('Z'):break
 time.sleep(.1)
else:raise RuntimeError('The confirmed main process is still live; inspect the same PID')
assert subprocess.run(['lsof','-tiTCP:5173','-sTCP:LISTEN'],capture_output=True).returncode!=0
assert manifest(data/'memories')==before_memories
env=os.environ.copy();env.update(HOST='127.0.0.1',PORT='5173',MATRIX_DATA_DIR=str(data),MATRIX_CLOUD_SAVE='',SUPABASE_URL='',SUPABASE_SECRET_KEY='',LLM_API_KEY='')
with(u/'local-main-server.log').open('ab')as log:p=subprocess.Popen(command.split(),cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(u/'local-main-process.json').write_text(json.dumps({'pid':p.pid,'port':5173,'command':command.split(),'cwd':str(root),'dataDirectory':str(data),'cloudDisabled':True,'intentionalRestart':True},indent=2)+'\n')
for attempt in range(150):
 try:after=fetch('api/world');break
 except(OSError,urllib.error.URLError):
  assert p.poll()is None,'The new main process exited; inspect its existing log'
  time.sleep(.1)
else:raise RuntimeError('Readiness observation expired; poll the recorded live process, never start a duplicate')
assert after==before,'The full main API world changed; inspect the current saved process without restarting it'
assert manifest(data/'memories')==before_memories and manifest(live/'packages/server/dist')==backend
assert fetch('')==(dist/'index.html').read_bytes()and fetch('assets/'+bundle)==new_js
assert(client/'assets'/old_bundle).read_bytes()==old_js
published=names+[row['path']for row in a['new']if row['path'].startswith('packages/')]
for name in published:assert(live/name).read_bytes()==(c/name).read_bytes(),name
for row in a['changed']+a['new']:assert(root/row['path']).read_bytes()==(c/row['path']).read_bytes(),row['path']
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
for folder in [root,live]:
 expected=shared_before[str(folder)]|{name:row['after']for name,row in shared_changes.items()};assert manifest(folder/'packages/shared/dist')==expected
report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(new_js),'servedBundleSha256':sha(new_js),'backendDistFilesUnchanged':len(backend),'serverRestartedForPublication':True,'oldServerPid':pid,'serverPid':p.pid,'restartReason':'Intentionally load shared Construct placement constants','fullWorldSnapshotPreservedAcrossPublication':True,'fullWorldSha256':sha(before),'memoryFilesPreservedAcrossPublication':len(before_memories),'tick':w['simulation']['tick'],'running':w['simulation']['running'],'previousBundleRetained':True,'previousBundle':old_bundle,'livePackageFilesMatchCandidate':len(published),'ownedSourceAndTestFilesCopied':len(a['changed'])+len(a['new']),'protectedWipFilesUnchanged':len(protected),'compiledSharedFilesCopied':list(shared_changes),'allOtherCompiledSharedFilesPreserved':True,'preexistingAwakeningRuntimeDifferencePreserved':True,'renderReconnected':False,'characterAssetsChanged':False,'nativeReloadPending':True,'knownRelatedBaselineFailures':11,'newRelatedFailures':0}
(u/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
