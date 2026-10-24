from pathlib import Path
import hashlib,json,os,subprocess,tempfile,urllib.request

u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release'
live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
b=json.loads((u/'baseline.json').read_text());comparison=json.loads((u/'asset-comparison.json').read_text())
asset_dir=Path('packages/client/public/assets/characters')
names=['plaza-crowd-male.glb','plaza-crowd-female.glb']
changed={'package.json','package-lock.json','scripts/build-plaza-crowd.mts','tests/red-dress-crowd.test.mts',
 str(asset_dir/'PLAZA-CROWD.md'),*(str(asset_dir/name) for name in names)}
sha=lambda data:hashlib.sha256(data).hexdigest()
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def protected():
 for category in ['protected','compiled']:
  for path,digest in b[category].items():assert sha((root/path).read_bytes())==digest,path
def main_process():
 assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()=='83388'
 assert subprocess.check_output(['ps','-p','83388','-o','command='],text=True).strip()=='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
 assert 'n'+str(root) in subprocess.check_output(['lsof','-a','-p','83388','-d','cwd','-Fn'],text=True).splitlines()
protected();main_process()
actual={p for p,h in b['inputs'].items() if blob((c/p).read_bytes())!=h};assert actual==changed,actual
for path in changed-{str(asset_dir/name) for name in names}:assert (root/path).read_bytes()==(c/path).read_bytes(),path
bundle='assets/index-CCOTDEXi.js';old=live/'packages/client/dist';new=c/'packages/client/dist'
for path in ['index.html',bundle,'assets/index-B0JUdutM.css']:
 assert (old/path).read_bytes()==(new/path).read_bytes(),path
assert sha((new/bundle).read_bytes())=='589fa46f26ecd034ac07152eb37bbccf376c80e2576391f154ebf398c2c97092'
updates=[]
for item in comparison:
 name='plaza-crowd-'+item['sex']+'.glb';source=(c/asset_dir/name).read_bytes()
 assert sha(source)==item['after']['sha256'] and len(source)==item['after']['bytes']
 assert (new/'assets/characters'/name).read_bytes()==source
 for target in [root/asset_dir/name,live/asset_dir/name,old/'assets/characters'/name]:
  assert sha(target.read_bytes())==item['before']['sha256'],target
  updates.append((target,source))
doc=(c/asset_dir/'PLAZA-CROWD.md').read_bytes()
assert (new/'assets/characters/PLAZA-CROWD.md').read_bytes()==doc
for target in [live/asset_dir/'PLAZA-CROWD.md',old/'assets/characters/PLAZA-CROWD.md']:
 assert blob(target.read_bytes())==b['inputs'][str(asset_dir/'PLAZA-CROWD.md')],target
 updates.append((target,doc))
before=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
memories=len(list((root/'output/local-preview/data/memories').glob('*')))
for target,data in updates:
 # These public files may have historical hardlinks. Replace the directory
 # entry rather than overwriting an inode used by another release.
 with tempfile.NamedTemporaryFile(dir=target.parent,prefix='.plaza-contact-',delete=False) as file:
  file.write(data);staged=Path(file.name)
 staged.chmod(target.stat().st_mode & 0o777);os.replace(staged,target)
served=[]
for item in comparison:
 name='plaza-crowd-'+item['sex']+'.glb'
 with urllib.request.urlopen('http://localhost:5173/assets/characters/'+name) as response:
  data=response.read();cache=response.headers.get('Cache-Control')
 assert sha(data)==item['after']['sha256'] and len(data)==item['after']['bytes']
 served.append({'name':name,'bytes':len(data),'sha256':sha(data),'cacheControl':cache})
assert urllib.request.urlopen('http://localhost:5173/').read()==(new/'index.html').read_bytes()
assert urllib.request.urlopen('http://localhost:5173/'+bundle).read()==(new/bundle).read_bytes()
after=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
assert len(list((root/'output/local-preview/data/memories').glob('*')))==memories
protected();main_process()
result={'entry':'http://localhost:5173/','pid':83388,'bundle':bundle,'javascriptUnchanged':True,
 'sha256':sha((new/bundle).read_bytes()),'servedAssets':served,
 'assetDeltaBytes':sum(x['after']['bytes']-x['before']['bytes'] for x in comparison),
 'publishedFiles':[str(p.relative_to(root)) for p,_ in updates],
 'candidateInputs':len(b['inputs']),'candidateChangedInputs':sorted(actual),
 'protectedFilesUnchanged':len(b['protected']),'backendAndSharedFilesUnchanged':len(b['compiled']),
 'mainMemories':memories,'mainTickBefore':before['simulation']['tick'],'mainTickAfter':after['simulation']['tick'],
 'mainRunning':after['simulation']['running'],'mainSaveWritten':False,'renderReconnected':False}
(u/'publication.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
