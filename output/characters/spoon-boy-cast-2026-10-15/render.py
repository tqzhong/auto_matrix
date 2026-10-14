"""Actual posed mesh/registered face shading, offline; not a browser capture."""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
folder=Path(__file__).parent
im=np.array(Image.open(folder/'staging/spoon_boy-face-reference.png').convert('RGB'),dtype=float)/255
im=np.where(im<=.04045,im/12.92,((im+.055)/1.055)**2.4)
def sample(uv):
 xy=np.asarray(uv)*[im.shape[1],im.shape[0]]-.5;lo=np.floor(xy).astype(int);f=xy-lo;r=np.zeros((len(xy),3))
 for dx,dy in [(0,0),(1,0),(0,1),(1,1)]:
  w=(f[:,0] if dx else 1-f[:,0])*(f[:,1] if dy else 1-f[:,1]);r+=im[np.clip(lo[:,1]+dy,0,im.shape[0]-1),np.clip(lo[:,0]+dx,0,im.shape[1]-1)]*w[:,None]
 return r
smooth=lambda a,b,x:np.clip((x-a)/(b-a),0,1)**2*(3-2*np.clip((x-a)/(b-a),0,1))
def head_color(front_uv,p,rn,uv,fw,m):
 pc=sample(uv);w=smooth(.2,.7,np.abs(rn[:,0]))*smooth(-.48,-.35,p[:,1])
 px=uv*np.array(m['atlasSize'])-np.array(m['profileOrigin']);ear=1-smooth(.75,1.2,np.linalg.norm((px-m['profileEar'])/[65,92],axis=1));es=smooth(.258,.275,np.abs(p[:,0]))
 eye=(1-smooth(.7,1.3,np.linalg.norm((px-m['profileEye'])/[52,37],axis=1)))*smooth(.14,.18,np.abs(p[:,0]));cheek=sample(np.tile(m['cheekSample'],(len(p),1)))
 hide=np.maximum(ear*(1-es),eye);pc=pc*(1-hide[:,None])+cheek*hide[:,None]
 nu=np.tile(m['neckSample'],(len(p),1));nu[:,0]+=p[:,0]*.1;nu[:,1]+=np.clip(-p[:,1]-.30,0,.2)*.03;neck=sample(nu)
 nb=1-smooth(-.43,-.27,p[:,1]);pc=pc*(1-nb[:,None])+neck*nb[:,None]
 skin=smooth(.035,.085,pc[:,0]-pc[:,2])*smooth(.015,.045,pc[:,0]-pc[:,1]);hair=(1-smooth(.12,.24,pc.max(axis=1)))*smooth(-.16,-.06,p[:,1])*(1-smooth(.08,.16,p[:,2]));w*=np.maximum(skin,hair)
 base=neck*(1-smooth(-.32,-.18,p[:,1])[:,None])+cheek*smooth(-.32,-.18,p[:,1])[:,None]
 side=base*(1-w[:,None])+pc*w[:,None]
 return side*(1-fw[:,None])+sample(front_uv)*fw[:,None]
W,H=520,640
sheet=Image.new('RGB',(W*2,H*2),(27,31,32));draw=ImageDraw.Draw(sheet)
for row,head in enumerate([True,False]):
 for col,forward in enumerate([(0,.03,1),(1,.03,0)]):
  data=json.loads((folder/'poses/offered-0.json').read_text());f=np.array(forward,dtype=float);f/=np.linalg.norm(f);right=np.cross([0,1,0],f);right/=np.linalg.norm(right);up=np.cross(f,right)
  center=np.array([0,2.60,0]) if head else np.array([0,1.5,.1]);scale=650 if head else 172
  light=f+[0,.55,0]+right*.4;light/=np.linalg.norm(light)
  pixels=np.zeros((H,W,3),dtype=np.uint8)+[27,31,32];depth=np.zeros((H,W))-np.inf
  for s in data['surfaces']:
   v=np.array(s['vertices']);faces=np.array(s['indices']).reshape(-1,3)
   head_arrays={key:np.asarray(s[key]) for key in ['texcoords','rest','normal','profile','faceWeight']} if s['head'] else {}
   normals=np.zeros_like(v);n=np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]])
   for part in range(3):np.add.at(normals,faces[:,part],n)
   normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
   color=np.zeros_like(v)+s['color']
   if s['texture']:color*=sample(s['texcoords'])
   color*= (.4+.65*np.maximum(normals@light,0))[:,None]
   centered=v-center;q=np.column_stack((centered@right*scale+W/2,-centered@up*scale+H/2,centered@f))
   for tri in faces:
    p=q[tri];lo=np.maximum(np.floor(p[:,:2].min(axis=0)).astype(int),[0,0]);hi=np.minimum(np.ceil(p[:,:2].max(axis=0)).astype(int),[W-1,H-1])
    if np.any(lo>hi):continue
    den=(p[1,1]-p[2,1])*(p[0,0]-p[2,0])+(p[2,0]-p[1,0])*(p[0,1]-p[2,1])
    if abs(den)<1e-9:continue
    yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];xx=xx+.5;yy=yy+.5
    a=((p[1,1]-p[2,1])*(xx-p[2,0])+(p[2,0]-p[1,0])*(yy-p[2,1]))/den;b=((p[2,1]-p[0,1])*(xx-p[2,0])+(p[0,0]-p[2,0])*(yy-p[2,1]))/den;c=1-a-b
    z=a*p[0,2]+b*p[1,2]+c*p[2,2];old=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1];mask=(a>=0)&(b>=0)&(c>=0)&(z>old);old[mask]=z[mask]
    rgb=a[...,None]*color[tri[0]]+b[...,None]*color[tri[1]]+c[...,None]*color[tri[2]];rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
    patch=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
    if s['head'] and np.any(mask):
     weights=np.column_stack((a[mask],b[mask],c[mask]))
     blend=lambda key:weights@head_arrays[key][tri]
     nc=weights@normals[tri];nc/=np.maximum(np.linalg.norm(nc,axis=1,keepdims=True),1e-9)
     hc=head_color(blend('texcoords'),blend('rest'),blend('normal'),blend('profile'),blend('faceWeight'),s['head'])*(.4+.65*np.maximum(nc@light,0))[:,None]
     hc=np.where(hc<=.0031308,hc*12.92,1.055*np.maximum(hc,0)**(1/2.4)-.055)
     patch[mask]=np.clip(hc*255,0,255).astype('uint8')
    else:patch[mask]=np.clip(rgb[mask]*255,0,255).astype('uint8')
  sheet.paste(Image.fromarray(pixels.astype('uint8')),(col*W,row*H));draw.text((col*W+16,row*H+15),'ACTUAL POSED MESH / OFFLINE / '+('HEAD' if head else 'BODY')+(' FRONT' if col==0 else ' PROFILE'),fill=(235,235,235))
sheet.save(folder/'candidate-model.png')
