"""Refine the forehead and add film-traced relief to Smith's existing brow morph.

Neutral triangles remain on their original surface. Crease depth is authored,
not reconstructed from the reference photo. No new textures or runtime shader.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0,str(Path(__file__).resolve().parent))
from character_fitting import smooth_normals


def main(source,diagnostic_path,brow_path,output):
    raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
    diagnostic=json.loads(diagnostic_path.read_text());assert hashlib.sha256(raw).hexdigest()==diagnostic['sourceSha256']
    mesh=next(m for m in doc['meshes'] if m['name']=='Anatomical head and hands');p=mesh['primitives'][0]
    assert mesh['extras']['targetNames']==['smithBrowRaise'] and not doc['extras'].get('wrinkleReliefVersion')
    def read(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dt=np.dtype({5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        return np.ndarray((a['count'],w),dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*dt.itemsize),dt.itemsize)).copy()
    accessors={**p['attributes'],'BROW_POSITION':p['targets'][0]['POSITION'],'BROW_NORMAL':p['targets'][0]['NORMAL']}
    arrays={name:read(index) for name,index in accessors.items()}
    faces=read(p['indices']).reshape(-1,3);original_faces=faces.copy();original_count=len(arrays['POSITION'])
    def relief_at(raised):
        relief=np.zeros(len(raised));smooth=lambda t:np.clip(t,0,1)**2*(3-2*np.clip(t,0,1))
        for curve,strength in zip(diagnostic['curves'],[.55,.65,1,.95,1,.85]):
            points=np.array(curve['xyz']);xs,ys=points[:,0],points[:,1];slopes=np.gradient(ys,xs)
            x=raised[:,0];i=np.clip(np.searchsorted(xs,x)-1,0,len(xs)-2);span=xs[i+1]-xs[i];t=np.clip((x-xs[i])/span,0,1)
            y=(2*t**3-3*t*t+1)*ys[i]+(t**3-2*t*t+t)*span*slopes[i]+(-2*t**3+3*t*t)*ys[i+1]+(t**3-t*t)*span*slopes[i+1]
            slope=((6*t*t-6*t)*ys[i]+(3*t*t-4*t+1)*span*slopes[i]+(-6*t*t+6*t)*ys[i+1]+(3*t*t-2*t)*span*slopes[i+1])/span
            d=(raised[:,1]-y)/np.sqrt(1+slope*slope)
            taper=smooth((x-xs[0])/.012)*smooth((xs[-1]-x)/.012)
            profile=.35*np.exp(-.5*((d-.004)/.003)**2)+.35*np.exp(-.5*((d+.004)/.003)**2)-np.exp(-.5*(d/.002)**2)
            relief+=strength*profile*taper
        relief=.0042*np.tanh(relief*.0035/.0042)
        return relief*smooth((raised[:,1]-4.185)/.008)*smooth((4.31-raised[:,1])/.012)*smooth((raised[:,2]-.20)/.08)
    # Split where the actual relief would deviate from linear triangles.
    # Shared edge splits keep the patch watertight, including UV seams.
    for iteration in range(10):
        raised=arrays['POSITION']+arrays['BROW_POSITION']
        edges=np.unique(np.sort(np.concatenate((faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]])),axis=1),axis=0)
        height=relief_at(raised);error=np.zeros(len(edges))
        for t in [.25,.5,.75]:
            sample=raised[edges[:,0]]*(1-t)+raised[edges[:,1]]*t
            error=np.maximum(error,abs(relief_at(sample)-height[edges[:,0]]*(1-t)-height[edges[:,1]]*t))
        split={tuple(map(int,e)) for e in edges[error>.0002]}
        center=raised[faces].mean(axis=1);interior_error=abs(relief_at(center)-height[faces].mean(axis=1))
        for face in faces[interior_error>.0002]:
            e=[tuple(sorted((int(face[i]),int(face[(i+1)%3])))) for i in range(3)]
            split.add(max(e,key=lambda edge:np.linalg.norm((raised[edge[1]]-raised[edge[0]])/[.014,.0025,.014])))
        if not split:break
        # Longest-edge closure prevents alternating diagonals from repeatedly
        # spanning the same curved strip while generating sliver triangles.
        face_edges=[[tuple(sorted((int(f[i]),int(f[(i+1)%3])))) for i in range(3)] for f in faces]
        lengths=np.linalg.norm((raised[faces[:,[1,2,0]]]-raised[faces])/[.014,.0025,.014],axis=2)
        longest=np.argmax(lengths,axis=1)
        while True:
            previous=len(split)
            for e,index in zip(face_edges,longest):
                if any(edge in split for edge in e):split.add(e[index])
            if len(split)==previous:break
        split=sorted(split)
        endpoints=np.array(split);start=len(raised);mid={e:start+i for i,e in enumerate(split)}
        for name,a in arrays.items():
            if name=='JOINTS_0':
                assert np.array_equal(a[endpoints[:,0]],a[endpoints[:,1]]),'Refinement reached mixed joints'
                added=a[endpoints[:,0]]
            else:
                added=a[endpoints].mean(axis=1)
                if name=='NORMAL':added/=np.maximum(np.linalg.norm(added,axis=1,keepdims=True),1e-8)
            arrays[name]=np.vstack((a,added)).astype(a.dtype)
        kept=[];extra=[]
        for face in faces:
            ids=list(map(int,face));m=[mid.get(tuple(sorted((ids[i],ids[(i+1)%3])))) for i in range(3)]
            count=sum(i is not None for i in m)
            if count==0:kept.append(ids);continue
            if count==3:
                a,b,c=ids;ab,bc,ca=m;children=[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]
            else:
                k=next(i for i in range(3) if m[i] is not None and (count==1 or m[(i+1)%3] is not None))
                a,b,c=ids[k:]+ids[:k];ab=m[k]
                if count==1:children=[[a,ab,c],[ab,b,c]]
                else:
                    bc=m[(k+1)%3]
                    qa=raised[a];qc=raised[c];qab=(raised[a]+raised[b])/2;qbc=(raised[b]+raised[c])/2
                    if np.linalg.norm((qa-qbc)/[.014,.0025,.014])<np.linalg.norm((qab-qc)/[.014,.0025,.014]):
                        children=[[ab,b,bc],[a,ab,bc],[a,bc,c]]
                    else:children=[[ab,b,bc],[a,ab,c],[ab,bc,c]]
            kept.append(children[0]);extra.extend(children[1:])
        faces=np.array(kept+extra,dtype=original_faces.dtype)
        print(json.dumps({'refinementPass':iteration+1,'vertices':len(arrays['POSITION']),'skinTriangles':len(faces)}))
    else:raise AssertionError('Forehead refinement did not converge')
    triangles=sum(doc['accessors'][q['indices']]['count']//3 for m in doc['meshes'] for q in m['primitives'])+len(faces)-len(original_faces)
    assert triangles<160000,f'Character geometry budget exceeded: {triangles}'
    position=arrays['POSITION'];raised=position+arrays['BROW_POSITION'];relief=relief_at(raised)
    folded=raised.copy();folded[:,2]+=relief
    change=smooth_normals(folded,faces)-smooth_normals(raised,faces)
    changed=np.linalg.norm(change,axis=1)>1e-8
    normal=arrays['NORMAL']+arrays['BROW_NORMAL']+change
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-8)
    arrays['BROW_NORMAL'][changed]=normal[changed]-arrays['NORMAL'][changed]
    arrays['BROW_POSITION'][:,2]+=relief.astype('<f4')
    replacements={}
    def replace(index,value):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        assert not a.get('byteOffset') and not v.get('byteStride')
        assert sum(b['bufferView']==a['bufferView'] for b in doc['accessors'])==1
        replacements[a['bufferView']]=value.tobytes();a.update(count=len(value),min=value.min(axis=0).tolist(),max=value.max(axis=0).tolist())
    for name,index in accessors.items():replace(index,arrays[name])
    replace(p['indices'],faces.reshape(-1,1))
    packed=bytearray()
    for index,view in enumerate(doc['bufferViews']):
        data=replacements.get(index,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
        packed.extend(b'\0'*(-len(packed)%4));view.update(byteOffset=len(packed),byteLength=len(data));packed.extend(data)
    packed.extend(b'\0'*(-len(packed)%4));doc['buffers'][0]['byteLength']=len(packed)
    doc['extras'].update(wrinkleReliefVersion=1,wrinkleSourceSha256=diagnostic['sourceSha256'])
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
    output.mkdir(parents=True,exist_ok=True)
    brow=json.loads(brow_path.read_text());neutral=BVHTree.FromPolygons(position.tolist(),faces.tolist(),all_triangles=True)
    brow.update(reboundCandidateSha256=hashlib.sha256(result).hexdigest(),
                originalDiagnosticSha256=hashlib.sha256(brow_path.read_bytes()).hexdigest())
    for frame in brow['frames']:
        for row in frame['brows']:
            point=np.array(row['xyz']);hit,_,face,distance=neutral.find_nearest(Vector(point));assert hit is not None and distance<1e-6
            a,b,c=position[faces[face]];uv=np.linalg.lstsq(np.column_stack((b-a,c-a)),point-a,rcond=None)[0]
            row.update(triangle=int(face),barycentric=[float(1-uv.sum()),*uv.tolist()])
    (output/'brow-diagnostic.json').write_text(json.dumps(brow,indent=2)+'\n')
    for image in doc['images']:
        link=output/image['uri']
        if not link.exists():link.symlink_to((source.parent/image['uri']).resolve())
    temp=output/'smith.glb.tmp';temp.write_bytes(result);temp.replace(output/'smith.glb')
    report={'sourceSha256':diagnostic['sourceSha256'],'candidateSha256':hashlib.sha256(result).hexdigest(),
            'diagnosticSha256':hashlib.sha256(diagnostic_path.read_bytes()).hexdigest(),'originalSkinVertices':original_count,
            'skinVertices':len(position),'addedTriangles':len(faces)-len(original_faces),'characterTriangles':triangles,
            'reliefRange':[float(relief.min()),float(relief.max())],
            'changedReliefVertices':int(np.count_nonzero(abs(relief)>1e-8)),'addedBytes':len(result)-len(raw),
            'maximumSampledReliefError':float(max(error.max(),interior_error.max())),
            'originalVertexPositionsUnchanged':True,'neutralSurface':'Linear subdivision on original triangles; interpolated UVs and unit normals.',
            'limitation':'Trace placement from one film frame; authored depth. Other expressions, lighting, skin detail and actor likeness still require review.','userAcceptance':'pending'}
    (output/'wrinkle-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','diagnostic','brow','output']:parser.add_argument('--'+name,type=Path,required=True)
    a=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);main(a.source,a.diagnostic,a.brow,a.output)
