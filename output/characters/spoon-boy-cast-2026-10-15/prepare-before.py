from pathlib import Path
import os,re,subprocess
root=Path(__file__).resolve().parents[3]
folder=Path(__file__).resolve().parent/'original';folder.mkdir(exist_ok=True)
files=['CharacterModel','SpoonPerformance','SpoonModel','SpoonBoyHands','OracleParkHands','DiggerBodies','EpilogueHeads']
for name in files:
 source=root/'packages/client/src/agents'/f'{name}.ts'
 text=subprocess.check_output(['git','show',f'2794207:{source.relative_to(root)}'],cwd=root,text=True)
 def link(m):
  spec=m.group(2)
  if not spec.startswith('.'):return m.group(0)
  target=(source.parent/spec).resolve()
  replacement='./'+target.stem+'.mts' if target.parent==source.parent and target.stem in files else os.path.relpath(target,folder)
  return m.group(1)+replacement+m.group(3)
 text=re.sub(r"(from\s+['\"])([^'\"]+)(['\"])",link,text)
 (folder/f'{name}.mts').write_text(text)
