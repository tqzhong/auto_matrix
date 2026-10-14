import json
from pathlib import Path
import numpy as np
folder=Path(__file__).parent; results=[]
for label in ['before','final']:
 for case in json.loads((folder/f'{label}-head-contact.json').read_text()):
  vertices=np.array(case['head']['vertices']);faces=np.array(case['head']['indices']).reshape(-1,3);tri=vertices[faces]
  low=vertices[:,:2].min(axis=0);size=vertices[:,:2].max(axis=0)-low;bins={}
  for i,t in enumerate(tri):
   a=np.clip(np.floor((t[:,:2].min(axis=0)-low)/size*48).astype(int),0,47);b=np.clip(np.floor((t[:,:2].max(axis=0)-low)/size*48).astype(int),0,47)
   for y in range(a[1],b[1]+1):
    for x in range(a[0],b[0]+1):bins.setdefault((x,y),[]).append(i)
  rows=[]
  for frame in case['frames']:
   maximum=0;matched=0;minimum=float('inf')
   for p in np.array(frame['points']):
    xy=np.floor((p[:2]-low)/size*48).astype(int)
    ids=bins.get(tuple(xy),[])
    if not ids:continue
    t=tri[ids];den=(t[:,1,1]-t[:,2,1])*(t[:,0,0]-t[:,2,0])+(t[:,2,0]-t[:,1,0])*(t[:,0,1]-t[:,2,1]);safe=np.abs(den)>1e-10
    t=t[safe];den=den[safe]
    a=((t[:,1,1]-t[:,2,1])*(p[0]-t[:,2,0])+(t[:,2,0]-t[:,1,0])*(p[1]-t[:,2,1]))/den
    b=((t[:,2,1]-t[:,0,1])*(p[0]-t[:,2,0])+(t[:,0,0]-t[:,2,0])*(p[1]-t[:,2,1]))/den;c=1-a-b;inside=(a>=-1e-8)&(b>=-1e-8)&(c>=-1e-8)
    if not inside.any():continue
    front=(a*t[:,0,2]+b*t[:,1,2]+c*t[:,2,2])[inside].max();gap=float(p[2]-front);maximum=max(maximum,-gap);minimum=min(minimum,gap);matched+=1
   rows.append({'elapsed':frame['elapsed'],'matched':matched,'maximumPenetration':maximum,'minimumFrontGap':minimum if matched else None})
  results.append({'label':label,'choice':case['choice'],'handVertices':case['handVertices'],'headTriangles':len(faces),'frames':rows})
(folder/'head-contact-result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
