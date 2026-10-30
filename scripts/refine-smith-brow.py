"""Author a reversible Smith brow raise from two eyes-visible movie frames.

Keep the neutral mesh, eyelid margin, mouth, hands, hair and textures intact.
The detected movie points constrain height only; they do not recover depth.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_fitting import radial_field, smooth_normals


def main(source, diagnostic_path, output):
    raw=source.read_bytes(); size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]); original=raw[28+size:]; binary=bytearray(original)
    diagnostic=json.loads(diagnostic_path.read_text())
    assert hashlib.sha256(raw).hexdigest()==diagnostic['sourceSha256']
    mesh=next(m for m in doc['meshes'] if m['name']=='Anatomical head and hands'); primitive=mesh['primitives'][0]
    assert not primitive.get('targets') and not doc['extras'].get('browRaiseVersion')
    def read(index):
        a=doc['accessors'][index]; v=doc['bufferViews'][a['bufferView']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dtype=np.dtype({5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        return np.ndarray((a['count'],width),dtype,buffer=original,offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                          strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()
    position=read(primitive['attributes']['POSITION']); normal=read(primitive['attributes']['NORMAL'])
    faces=read(primitive['indices']).reshape(-1,3); controls=[]; values=[]
    for measurement in diagnostic['measurements']:
        a,b=[next(row for row in diagnostic['frames'][0]['brows'] if row['id']==i) for i in measurement['ids']]
        center=(np.array(a['xyz'][:2])*[-1,1]+np.array(b['xyz'][:2]))/2
        controls.extend([center*[-1,1],center]); values.extend([[measurement['raisedTarget']]]*2)
    anchors=np.array([[x,y] for x in [-.21,-.12,0,.12,.21] for y in [4.09,4.31]])
    field=radial_field(np.vstack((controls,anchors)),np.vstack((values,np.zeros((len(anchors),1)))),.05,.001)
    smooth=lambda x: np.clip(x,0,1)**2*(3-2*np.clip(x,0,1))
    # The lower limit follows the upper-lid arc plus a .001-unit margin in
    # this 4.4-unit rig. It does not move the free eyelid edge or the eyeball.
    lid_x=np.array([.0378,.0426,.0530,.0667,.0800,.0919,.0992,.1065])
    lid_y=np.array([4.1194,4.1238,4.1297,4.1338,4.1342,4.1319,4.1285,4.1232])
    lower=np.interp(np.abs(position[:,0]),lid_x,lid_y)+.001
    # Spread strain across the lid-to-brow strip. Rounded ends keep the
    # displacement slope continuous without concentrating it in the middle.
    t=np.clip((position[:,1]-lower)/.019,0,1); rounding=.08
    rise=np.where(t<rounding,t*t/(2*rounding*(1-rounding)),
                  np.where(t>1-rounding,1-(1-t)**2/(2*rounding*(1-rounding)),
                           (t-rounding/2)/(1-rounding)))
    mask=rise*smooth((4.31-position[:,1])/.09)
    mask*=smooth((.185-np.abs(position[:,0]))/.04)*smooth((position[:,2]-.20)/.09)
    target=position.copy(); target[:,1]+=field(position[:,:2])[:,0]*mask
    delta=target-position
    assert np.linalg.norm(delta,axis=1).max()<.03
    cross=lambda p:np.cross(p[faces[:,1]]-p[faces[:,0]],p[faces[:,2]]-p[faces[:,0]])
    assert np.all((cross(position)*cross(target)).sum(axis=1)>=-1e-15), 'Brow raise inverted a triangle'
    normal_change=smooth_normals(target,faces)-smooth_normals(position,faces)
    raised_normal=normal+normal_change; raised_normal/=np.maximum(np.linalg.norm(raised_normal,axis=1,keepdims=True),1e-8)
    normal_delta=raised_normal-normal; normal_delta[np.linalg.norm(normal_change,axis=1)<1e-8]=0
    def append(value):
        value=value.astype('<f4'); binary.extend(b'\0'*(-len(binary)%4)); view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':value.nbytes,'target':34962}); binary.extend(value.tobytes())
        index=len(doc['accessors']); doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(value),'type':'VEC3',
                                                           'min':value.min(axis=0).tolist(),'max':value.max(axis=0).tolist()})
        return index
    primitive['targets']=[{'POSITION':append(delta),'NORMAL':append(normal_delta)}]
    mesh['weights']=[0]; mesh.setdefault('extras',{})['targetNames']=['smithBrowRaise']
    doc['extras'].update(browRaiseVersion=1,browRaiseSourceSha256=diagnostic['sourceSha256'])
    doc['buffers'][0]['byteLength']=len(binary); assert bytes(binary[:len(original)])==original
    encoded=json.dumps(doc,separators=(',',':')).encode(); encoded+=b' '*(-len(encoded)%4)
    binary.extend(b'\0'*(-len(binary)%4))
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    output.mkdir(parents=True,exist_ok=True)
    for image in doc['images']:
        link=output/image['uri']
        if not link.exists():link.symlink_to((source.parent/image['uri']).resolve())
    temporary=output/'smith.glb.tmp'; temporary.write_bytes(result); temporary.replace(output/'smith.glb')
    report={'sourceSha256':diagnostic['sourceSha256'],'candidateSha256':hashlib.sha256(result).hexdigest(),
            'diagnosticSha256':hashlib.sha256(diagnostic_path.read_bytes()).hexdigest(),
            'morph':'smithBrowRaise','defaultWeight':0,'changedVertices':int(np.count_nonzero(np.linalg.norm(delta,axis=1))),
            'maxDisplacement':float(np.linalg.norm(delta,axis=1).max()),'neutralBinaryUnchanged':True,'addedBytes':len(result)-len(raw),
            'protectedLidBoundary':{'x':lid_x.tolist(),'y':lid_y.tolist(),'margin':.001},
            'limitation':'Brow height and broad forehead movement only. Fine expression wrinkles, gaze, mouth and likeness remain unfinished.',
            'userAcceptance':'pending'}
    (output/'brow-report.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True); parser.add_argument('--diagnostic',type=Path,required=True); parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]); main(args.source,args.diagnostic,args.output)
