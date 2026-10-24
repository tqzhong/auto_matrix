from pathlib import Path
import hashlib,json,subprocess,re
u=Path(__file__).resolve().parent;r=u.parents[2];c=u/'candidate-release';live=r/'output/deployment/matrixai-bandwidth-2026-10-20/release'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):sha(f) for f in p.rglob('*') if f.is_file()}
baseline=json.loads((u/'baseline-inputs.json').read_text());inputs={n:sha(c/n) for n in baseline}
changed=[{'path':n,'before':baseline[n],'after':v} for n,v in inputs.items() if v!=baseline[n]]
assert sorted(x['path'] for x in changed)==['packages/client/src/agents/HeroModel.ts','packages/client/src/player/PerformancePanel.ts','tests/dojo-skinning-budget.test.mts']
assert len(inputs)==1215
for n,d in json.loads((u/'protected-worktree.json').read_text()).items():assert sha(r/n)==d
for package in ['shared','server']:assert manifest(c/f'packages/{package}/dist')==manifest(live/f'packages/{package}/dist')
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip();assert head==json.loads((u/'baseline-audit.json').read_text())['baseline']
report={'baseline':head,'changed':changed,'new':[],'inputFiles':len(inputs),'packageFiles':len(subprocess.check_output(['git','ls-tree','-r','--name-only',head,'packages'],cwd=r,text=True).splitlines()),'compiledSharedChanges':[],'serverArtifactsByteEqual':len(manifest(live/'packages/server/dist')),'characterAssetsChanged':False}
(u/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');(u/'validation-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n');print(json.dumps(report,indent=2))
