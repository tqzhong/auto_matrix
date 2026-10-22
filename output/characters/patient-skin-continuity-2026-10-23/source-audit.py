from pathlib import Path
import hashlib,json,os,subprocess

unit=Path(__file__).resolve().parent;root=unit.parents[2];candidate=unit/'candidate-release';baseline=unit/'baseline-release'
revision='5e4f8d78b223657c5f0b767d71caec4661a8015c'
sha=lambda b:hashlib.sha256(b).hexdigest()
owned={'packages/client/src/agents/HeroModel.ts'}
new=['packages/client/src/agents/SkinContinuity.ts','tests/helpers/patient-skin.mts','tests/patient-skin-continuity.test.mts','tests/skin-normal-field.test.mts']
records=subprocess.check_output(['git','ls-tree','-rz',revision,'packages','tests','scripts'],cwd=root).split(b'\0')
changed=[];names=[]
for record in records:
    if not record:continue
    header,path=record.split(b'\t',1);mode,kind,blob=header.split();name=path.decode();names.append(name)
    data=(baseline/name).read_bytes() if mode!=b'120000' else os.readlink(baseline/name).encode()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==blob.decode(),name
    current=(candidate/name).read_bytes() if mode!=b'120000' else os.readlink(candidate/name).encode()
    if data!=current:changed.append({'path':name,'before':sha(data),'candidate':sha(current)})
assert {r['path'] for r in changed}==owned
configs=['package.json','package-lock.json','tsconfig.base.json']
for name in configs:
    original=subprocess.check_output(['git','show',revision+':'+name],cwd=root)
    assert (root/name).read_bytes()==(candidate/name).read_bytes()==(baseline/name).read_bytes()==original,name
protected=json.loads((unit/'protected-worktree.json').read_text())
for name,digest in protected.items():assert sha((root/name).read_bytes())==digest,name
unknownTests={str(p.relative_to(candidate)) for p in (candidate/'tests').rglob('*.test.mts')}-set(names)-set(new)
assert not unknownTests,unknownTests
report={'baseline':revision,'verifiedBaselineFiles':len(names),'packageFiles':sum(n.startswith('packages/') for n in names),'changed':changed,'new':[{'path':n,'sha256':sha((candidate/n).read_bytes())} for n in new],'rootConfigsVerified':configs,'protectedWipFiles':len(protected),'assetsChanged':False,'dependenciesChanged':False,'serverSourceChanged':False}
(unit/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
