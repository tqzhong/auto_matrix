from pathlib import Path
import hashlib,json,re,shutil,subprocess,urllib.request

u=Path(__file__).resolve().parent;root=u.parents[2];c=u/'candidate-release'
live=root/'output/deployment/matrixai-bandwidth-2026-10-20/release'
b=json.loads((u/'baseline.json').read_text())
sources=['packages/client/src/engine/SentinelSetRenderer.ts','packages/client/src/agents/AgentRenderer.ts']
tests=['tests/neb-crew-appearance.test.mts','tests/sentinel-power-model.test.mts']
old_wardrobe="      input.nebCrewEarly = input.realWorld && state.currentLocation === 'film_neb_deck' && shipScene?.startsWith('m1_') === true\n"
new_wardrobe="      input.nebCrewEarly = input.realWorld && (state.currentLocation === 'film_neb_deck'\n        || state.currentLocation === 'film_service_tunnels' && shipScene === 'm1_sentinels') && shipScene?.startsWith('m1_') === true\n"
sha=lambda data:hashlib.sha256(data).hexdigest()
def blob(p):
 data=p.read_bytes();return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def protected():
 for category in ['protected','compiled']:
  for path,digest in b[category].items():
   data=(root/path).read_bytes()
   if category=='protected' and path==sources[1]:
    assert data.count(new_wardrobe.encode())==1
    data=data.replace(new_wardrobe.encode(),old_wardrobe.encode())
   assert sha(data)==digest,path
protected()
for path,digest in b['inputs'].items():
 if path not in sources+tests:assert blob(c/path)==digest,path
for src in sources:
 assert blob(live/src)==b['inputs'][src],src
 if src==sources[1]:
  head=subprocess.check_output(['git','show',b['head']+':'+src])
  assert head.count(old_wardrobe.encode())==1
  assert (c/src).read_bytes()==head.replace(old_wardrobe.encode(),new_wardrobe.encode())
 else:assert (root/src).read_bytes()==(c/src).read_bytes(),src
for path in tests+['tests/sentinel-cockpit-light.test.mts']:assert (root/path).read_bytes()==(c/path).read_bytes(),path
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()=='83388'
assert subprocess.check_output(['ps','-p','83388','-o','command='],text=True).strip()=='node output/deployment/matrixai-bandwidth-2026-10-20/release/packages/server/dist/index.js'
assert 'n'+str(root) in subprocess.check_output(['lsof','-a','-p','83388','-d','cwd','-Fn'],text=True).splitlines()
old=live/'packages/client/dist';new=c/'packages/client/dist'
old_index=(old/'index.html').read_bytes();new_index=(new/'index.html').read_bytes()
old_js=re.search(rb'src="/([^\"]+\.js)"',old_index)[1].decode();new_js=re.search(rb'src="/([^\"]+\.js)"',new_index)[1].decode()
assert old_js=='assets/index-mxn8UiMy.js' and new_js!=old_js
assert sha((old/old_js).read_bytes())=='07b22381d3ecd6832c6969f5d4c59024ee4c2cfc9188164bc8b7dc57824fb746'
css=re.search(rb'href="/([^\"]+\.css)"',new_index)[1].decode();assert (old/css).read_bytes()==(new/css).read_bytes()
before=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
(u/'main-index-before.html').write_bytes(old_index)
assert not (old/new_js).exists();shutil.copyfile(new/new_js,old/new_js)
for src in sources:shutil.copyfile(c/src,live/src)
staged=old/'index.sentinel-next.html';assert not staged.exists();staged.write_bytes(new_index);staged.replace(old/'index.html')
assert urllib.request.urlopen('http://localhost:5173/').read()==new_index
served=urllib.request.urlopen('http://localhost:5173/'+new_js).read();assert served==(new/new_js).read_bytes()
after=json.load(urllib.request.urlopen('http://localhost:5173/api/world'))
assert subprocess.check_output(['lsof','-tiTCP:5173','-sTCP:LISTEN'],text=True).strip()=='83388'
protected()
result={'entry':'http://localhost:5173/','pid':83388,'bundle':new_js,'sha256':sha(served),'bundleBytes':len(served),'javascriptDeltaBytes':len(served)-(old/old_js).stat().st_size,'newGameAssetBytes':0,'cssIdentical':True,'backendAndSharedFilesUnchanged':len(b['compiled']),'priorExperimentsPreserved':len(b['protected']),'mainMemories':len(list((root/'output/local-preview/data/memories').glob('*'))),'mainTickBefore':before['simulation']['tick'],'mainTickAfter':after['simulation']['tick'],'mainRunning':after['simulation']['running'],'mainSaveWritten':False,'renderReconnected':False}
(u/'publication.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
