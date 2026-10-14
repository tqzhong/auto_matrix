"""Offline diagnostic of the delivered posed mesh; this is not a game capture."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
folder=Path(__file__).parent
W,H=500,460
sheet=Image.new('RGB',(W*2,H*4),(26,31,33));draw=ImageDraw.Draw(sheet)
for row,(pose,forward,body) in enumerate([
 ('demonstrating-0',(-.65,.2,.8),False),('offered-0',(-.65,.2,.8),False),
 ('offered-0',(.8,.2,.65),False),('offered-0',(.7,.06,.7),True)]):
 for col,label in enumerate(['before','final']):
  data=json.loads((folder/label/f'{pose}.json').read_text());g=data['body'] if body else data['arm'];p=data['prop'];n=len(g['vertices'])
  vertices=np.array(g['vertices']+(p['vertices'] if not body else []));colors=np.array(g['colors']+(p['colors'] if not body else []))
  faces=np.array(g['indices']+([i+n for i in p['indices']] if not body else [])).reshape(-1,3)
  center=(vertices.min(axis=0)+vertices.max(axis=0))/2
  f=np.array(forward,dtype=float);f/=np.linalg.norm(f);r=np.cross([0,1,0],f);r/=np.linalg.norm(r);u=np.cross(f,r)
  v=vertices-center;scale=145 if body else 540
  projected=np.column_stack((v@r*scale+W/2,-v@u*scale+H/2,v@f))
  normals=np.zeros_like(vertices);raw=np.cross(vertices[faces[:,1]]-vertices[faces[:,0]],vertices[faces[:,2]]-vertices[faces[:,0]])
  for i in range(3):np.add.at(normals,faces[:,i],raw)
  normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8);light=f+[0,.6,0]+r*.4;light/=np.linalg.norm(light)
  illumination=.4+.65*np.maximum(normals@light,0)
  pixels=np.zeros((H,W,3),dtype=np.uint8)+[26,31,33];depth=np.zeros((H,W))-np.inf
  for tri in faces:
   q=projected[tri];lo=np.maximum(np.floor(q[:,:2].min(axis=0)).astype(int),[0,0]);hi=np.minimum(np.ceil(q[:,:2].max(axis=0)).astype(int),[W-1,H-1])
   if np.any(lo>hi):continue
   den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
   if abs(den)<1e-9:continue
   yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];xx=xx+.5;yy=yy+.5
   a=((q[1,1]-q[2,1])*(xx-q[2,0])+(q[2,0]-q[1,0])*(yy-q[2,1]))/den
   b=((q[2,1]-q[0,1])*(xx-q[2,0])+(q[0,0]-q[2,0])*(yy-q[2,1]))/den;c=1-a-b
   z=a*q[0,2]+b*q[1,2]+c*q[2,2];old=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1];mask=(a>=0)&(b>=0)&(c>=0)&(z>old);old[mask]=z[mask]
   rgb=a[...,None]*colors[tri[0]]*illumination[tri[0]]+b[...,None]*colors[tri[1]]*illumination[tri[1]]+c[...,None]*colors[tri[2]]*illumination[tri[2]]
   rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
   patch=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1];patch[mask]=np.clip(rgb[mask]*255,0,255).astype('uint8')
  sheet.paste(Image.fromarray(pixels.astype('uint8')),(col*W,row*H));draw.text((col*W+18,row*H+15),f'OFFLINE MESH / {label} / {pose} / view {row+1}',fill=(235,235,235))
sheet.save(folder/'comparison.png')
