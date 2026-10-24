from pathlib import Path
import hashlib,json,re,shutil,subprocess,urllib.request

u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release'
live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
b=json.loads((u/'baseline.json').read_text())
sources=['packages/client/src/engine/PostProcessing.ts','packages/client/src/player/PerformancePanel.ts']
sha=lambda data:hashlib.sha256(data).hexdigest()
def blob(p):
 data=p.read_bytes();return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def protected():
 for category in ['protected','compiled']:
  for path,digest in b[category].items():assert sha((root/path).read_bytes())==digest,path
protected()
for path,digest in b['inputs'].items():
 if path not in sources:assert blob(c/path)==digest,path
for src in sources:
 assert blob(live/src)==b['inputs'][src],src
 assert (root/src).read_bytes()==(c/src).read_bytes(),src
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()=='83388'
old=live/'packages/client/dist';new=c/'packages/client/dist'
old_index=(old/'index.html').read_bytes();new_index=(new/'index.html').read_bytes()
old_js=re.search(rb'src="/([^"]+\.js)"',old_index)[1].decode();new_js=re.search(rb'src="/([^"]+\.js)"',new_index)[1].decode()
assert old_js=='assets/index-DTIDupUE.js';assert new_js=='assets/index-CCOTDEXi.js'
assert sha((old/old_js).read_bytes())=='0956244b859f5a7d25f4c90a47dfd69e1abe67ae3fe80b0b67859464b4db51f9'
css=re.search(rb'href="/([^"]+\.css)"',new_index)[1].decode();assert (old/css).read_bytes()==(new/css).read_bytes()
before=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
(u/'main-index-before.html').write_bytes(old_index)
assert not (old/new_js).exists();shutil.copyfile(new/new_js,old/new_js)
for src in sources:shutil.copyfile(c/src,live/src)
staged=old/'index.ao-channel-next.html';assert not staged.exists();staged.write_bytes(new_index);staged.replace(old/'index.html')
assert urllib.request.urlopen('http://localhost:5173/').read()==new_index
served=urllib.request.urlopen('http://localhost:5173/'+new_js).read();assert served==(new/new_js).read_bytes()
after=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()=='83388'
protected()
result={'entry':'http://localhost:5173/','pid':83388,'bundle':new_js,'sha256':sha(served),'bundleBytes':len(served),'javascriptDeltaBytes':len(served)-(old/old_js).stat().st_size,'newGameAssetBytes':0,'cssIdentical':True,'backendAndSharedFilesUnchanged':len(b['compiled']),'protectedFilesUnchanged':len(b['protected']),'mainMemories':len(list((root/'output/local-preview/data/memories').glob('*'))),'mainTickBefore':before['simulation']['tick'],'mainTickAfter':after['simulation']['tick'],'mainRunning':after['simulation']['running'],'mainSaveWritten':False,'renderReconnected':False}
(u/'publication.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
