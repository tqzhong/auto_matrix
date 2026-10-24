from pathlib import Path
import json,gzip
u=Path(__file__).resolve().parent
before=json.loads(gzip.decompress((u/'before-poses.json.gz').read_bytes()));after=json.loads(gzip.decompress((u/'after-poses.json.gz').read_bytes()));errors=[]
def compare(a,b):
 if isinstance(a,list):
  assert len(a)==len(b)
  for x,y in zip(a,b):compare(x,y)
 elif isinstance(a,(float,int)):errors.append(abs(a-b))
 else:assert a==b
assert len(before)==len(after)==72
for a,b in zip(before,after):
 assert all(a[k]==b[k] for k in ['id','pose','meshes','vertices','sha256']);compare(a['transforms'],b['transforms'])
assert max(errors)<1e-12
print(json.dumps({'poses':len(before),'identicalGeometry':len(before),'matrixComponents':len(errors),'maxTransformDelta':max(errors)}))
