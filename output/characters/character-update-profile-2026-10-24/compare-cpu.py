from pathlib import Path
import json,subprocess
u=Path(__file__).resolve().parent;r=u.parents[2];c=u/'candidate-release';p=Path('packages/client/src/agents/HeroModel.ts')
baseline=json.loads((u/'baseline-audit.json').read_text())['baseline']
before=subprocess.check_output(['git','show',f'{baseline}:{p}'],cwd=r);after=(c/p).read_bytes();reports=[]
try:
 for name,source in [('before-a',before),('after-a',after),('after-b',after),('before-b',before)]:
  (c/p).write_bytes(source)
  result=subprocess.run(['node','--import','tsx',str(u/'profile-animation.mts'),name],cwd=r,capture_output=True)
  (u/f'cpu-{name}.log').write_bytes(result.stdout+result.stderr)
  assert result.returncode==0,name
  report=json.loads((u/f'{name}.json').read_text());reports.append({'sample':name,**{k:report[k] for k in ['iterations','averageCpuMs','p95CpuMs']}})
  print(json.dumps(reports[-1]),flush=True)
finally:
 (c/p).write_bytes(after)
(u/'cpu-comparison.json').write_text(json.dumps({'note':'Offline CPU animation only; A/B/B/A, native QA tab closed, no concurrent build or tests. Not FPS or GPU.', 'samples':reports},indent=2)+'\n')
