"""Orthographic diagnostic of exported, genuinely skinned surfaces (not a game capture)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
folder=Path(sys.argv[1]); label=sys.argv[2]

W=560; H=480
sheet=Image.new('RGB',(W*2,H*3),(26,31,33)); draw=ImageDraw.Draw(sheet)
for row, direction in enumerate([(1,.12,.65),(.2,.2,1),(-1,.1,.5)]):
 for col, pose in enumerate(['receiving-1.101-0','focus-0-1']):
  data=json.loads((folder/f'{pose}.json').read_text()); count=len(data['vertices']); vertices=np.array(data['vertices']+data['prop']['vertices']); faces=np.array(data['indices']+[i+count for i in data['prop']['indices']]).reshape(-1,3)
  forward=np.array(direction,dtype=float); forward/=np.linalg.norm(forward); right=np.cross([0,1,0],forward); right/=np.linalg.norm(right); up=np.cross(forward,right)
  centered=vertices-np.array([.15,-.17,.08]); projected=np.column_stack((centered@right*880+W/2,-centered@up*880+H/2,centered@forward))
  normals=np.zeros(vertices.shape); raw=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
  for c in range(3): np.add.at(normals,faces[:,c],raw)
  normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8)
  light=(forward+np.array([0,1,0])*.55+right*.45); light/=np.linalg.norm(light); illumination=.35+.65*np.maximum(normals@light,0)
  pixels=np.zeros((H,W,3),dtype=np.uint8)+[26,31,33]; depth=np.zeros((H,W))-np.inf
  for tri in faces:
   p=projected[tri]; lo=np.maximum(np.floor(p[:,:2].min(axis=0)).astype(int),[0,0]); hi=np.minimum(np.ceil(p[:,:2].max(axis=0)).astype(int),[W-1,H-1]);
   if np.any(lo>hi): continue
   den=(p[1,1]-p[2,1])*(p[0,0]-p[2,0])+(p[2,0]-p[1,0])*(p[0,1]-p[2,1])
   if abs(den)<1e-9: continue
   yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]; xx=xx+.5; yy=yy+.5
   a=((p[1,1]-p[2,1])*(xx-p[2,0])+(p[2,0]-p[1,0])*(yy-p[2,1]))/den
   b=((p[2,1]-p[0,1])*(xx-p[2,0])+(p[0,0]-p[2,0])*(yy-p[2,1]))/den; c=1-a-b
   z=a*p[0,2]+b*p[1,2]+c*p[2,2]; old=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
   visible=(a>=0)&(b>=0)&(c>=0)&(z>old); old[visible]=z[visible]
   shade=a*illumination[tri[0]]+b*illumination[tri[1]]+c*illumination[tri[2]]
   colors=np.clip(shade[...,None]*np.array([224,172,137] if tri[0]<count else [125,150,157]),0,255).astype(np.uint8); patch=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1]; patch[visible]=colors[visible]
  sheet.paste(Image.fromarray(pixels.astype(np.uint8)),(col*W,row*H)); draw.text((col*W+24,row*H+20),f'{label} / {pose} / view {row+1}',fill=(235,235,235))
sheet.save(folder.parent/f'{label}-spoon-geometry.png')
