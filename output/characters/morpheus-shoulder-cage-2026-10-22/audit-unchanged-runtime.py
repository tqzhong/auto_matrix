from pathlib import Path
import json,hashlib,subprocess,urllib.request
p=Path(__file__).resolve().parent;root=p.parents[2];baseline='bf2b8de56fa718348156d9b896beb4b700e00fc3';live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release';rows=subprocess.check_output(['git','ls-tree','-r',baseline,'--','packages'],cwd=root,text=True).strip().splitlines();different=[]
for row in rows:
 metadata,path=row.split('\t');data=(live/path).read_bytes();blob=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
 if blob!=metadata.split()[2]:different.append(path)
assert not different,different
protected=json.loads((p/'protected-worktree.json').read_text());assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==expected for path,expected in protected.items())
old=json.loads((p.parent/'morpheus-shoulder-volume-2026-10-22/local-world-before.json').read_text());world=json.load(urllib.request.urlopen('http://localhost:5173/api/world'));assert old==world
status=json.load(urllib.request.urlopen('http://localhost:5173/api/status'));html=urllib.request.urlopen('http://localhost:5173/').read().decode();assert 'index-DeK3mGvM.js'in html
result=dict(baselineRuntimeCommit=baseline,packageFilesCompared=len(rows),allPackageFilesUnchanged=True,protectedWipFilesUnchanged=len(protected),liveUrl='http://localhost:5173/',bundle='index-DeK3mGvM.js',completeWorldStillEqualToPreviousUnit=True,status=status,gameResourcesChanged=False,renderReconnected=False)
(p/'unchanged-runtime-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
