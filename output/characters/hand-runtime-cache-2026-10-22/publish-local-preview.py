import json,hashlib,re,shutil,subprocess,urllib.request,os
from pathlib import Path
root=Path(__file__).resolve().parents[3];p=Path(__file__).resolve().parent;candidate=p/'candidate-release';live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
def sha(data):return hashlib.sha256(data).hexdigest()
def fetch(path):
 with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=15) as response:return response.read()
def manifest(path):return {str(f.relative_to(path)):sha(f.read_bytes()) for f in path.rglob('*') if f.is_file()}
scan=json.loads((p/'pill-path-verification.json').read_text());assert scan['complete']
audit=json.loads((p/'source-audit.json').read_text())
assert scan['fullHandPoses']==1300
for name,expected in scan['sourceHashes'].items():
 assert sha((root/name).read_bytes())==expected
 assert sha((candidate/name).read_bytes())==expected
for row in audit['changed']:
 assert sha((root/row['path']).read_bytes())==row['candidate']
 assert sha((candidate/row['path']).read_bytes())==row['candidate']
for name,expected in json.loads((p/'protected-worktree.json').read_text()).items():assert sha((root/name).read_bytes())==expected,name
backend=live/'packages/server/dist';beforeBackend=json.loads((p/'backend-dist-before.json').read_text());assert manifest(backend)==beforeBackend
assert subprocess.check_output(['ps','-p','82106','-o','command='],text=True).strip()=='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
oldWorld=(p/'full-world-before.json').read_bytes();assert fetch('api/world')==oldWorld
packageNames=subprocess.check_output(['git','ls-tree','-r','--name-only',audit['baseline'],'packages'],text=True).splitlines();changed={r['path']:r for r in audit['changed']}
for name in packageNames:
 expected=changed[name]['before'] if name in changed else sha((candidate/name).read_bytes())
 assert sha((live/name).read_bytes())==expected,name
client=live/'packages/client/dist';dist=candidate/'packages/client/dist';beforeIndex=(client/'index.html').read_bytes();(p/'local-index-before.html').write_bytes(beforeIndex)
html=(dist/'index.html').read_text();bundle=re.search(r'/assets/(index-[^" ]+\.js)',html).group(1);css=re.search(r'/assets/(index-[^" ]+\.css)',html).group(1)
oldBundle=re.search(rb'/assets/(index-[^" ]+\.js)',beforeIndex).group(1).decode();oldJS=(client/'assets'/oldBundle).read_bytes();assert (dist/'assets'/css).read_bytes()==(client/'assets'/css).read_bytes()
newJS=(dist/'assets'/bundle).read_bytes();temp=client/'assets'/(bundle+'.tmp');temp.write_bytes(newJS);os.replace(temp,client/'assets'/bundle)
for name in [r['path'] for r in audit['changed']]+audit['newTests']:shutil.copy2(candidate/name,live/name)
temp=client/'index.html.tmp';temp.write_bytes((dist/'index.html').read_bytes());os.replace(temp,client/'index.html')
assert fetch('')==(dist/'index.html').read_bytes();assert fetch('assets/'+bundle)==newJS
assert (client/'assets'/oldBundle).read_bytes()==oldJS
assert manifest(backend)==beforeBackend
assert subprocess.check_output(['ps','-p','82106','-o','command='],text=True).strip()=='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert fetch('api/world')==oldWorld
for name in packageNames:assert (live/name).read_bytes()==(candidate/name).read_bytes(),name
for name,expected in json.loads((p/'protected-worktree.json').read_text()).items():assert sha((root/name).read_bytes())==expected,name
world=json.loads(oldWorld);simulation=world['simulation'];report={'url':'http://localhost:5173/','bundle':bundle,'bundleBytes':len(newJS),'servedBundleSha256':sha(newJS),'backendDistFilesUnchanged':len(beforeBackend),'serverRestarted':False,'serverPid':82106,'fullWorldSnapshotPreserved':True,'fullWorldSha256':sha(oldWorld),'tick':simulation['tick'],'running':simulation['running'],'previousBundleRetained':True,'previousBundle':oldBundle,'livePackageFilesMatchCandidate':len(packageNames),'protectedWipFilesUnchanged':11,'renderReconnected':False,'assetsChanged':False,'nativeReloadPending':True}
(p/'local-update-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
