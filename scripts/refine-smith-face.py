"""Apply a small symmetric Smith face correction measured in three movie frames.

Blender authoring only. Use stable canthi / alar points, never expressive brows,
mouths or view-dependent silhouettes. Keep depth, rig, hands, hair and textures.
The existing eye-occlusion bake must run again after this geometric correction.
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


def main(args):
    raw = args.source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size]); binary = bytearray(raw[28 + size:])
    diagnostic = json.loads(args.diagnostic.read_text())
    assert diagnostic['sourceSha256'] == hashlib.sha256(raw).hexdigest()
    assert doc['extras']['character'] == 'smith' and not doc['extras'].get('filmFaceVersion')
    assert [f['frame'] for f in diagnostic['frames']] == [1543,1544,1552]
    eye_y = doc['extras']['eye'][1]
    controls = []; values = []; measured = []
    for left, right in [(33,263),(133,362),(98,326)]:
        offsets = []
        for frame in diagnostic['frames']:
            a,b = [next(r for r in frame['visible'] if r['id']==i) for i in [left,right]]
            left_offset,right_offset = a['xyOffsetIfDepthHeld'],b['xyOffsetIfDepthHeld']
            offsets.append([(right_offset[0]-left_offset[0])/2,(left_offset[1]+right_offset[1])/2])
        delta = np.median(offsets,axis=0)
        # Only inner-canthus height is consistent across all three expressions.
        if left != 133: delta[1] = 0
        assert 0 < delta[0] < .004 and -.004 < delta[1] <= 0
        a,b = [next(r for r in diagnostic['frames'][0]['visible'] if r['id']==i) for i in [left,right]]
        center = (np.array(b['xyz'][:2]) + np.array(a['xyz'][:2]) * [-1,1]) / 2
        controls.extend([center * [-1,1],center]); values.extend([delta * [-1,1],delta])
        measured.append({'ids':[left,right],'perFrameMirroredOffsets':offsets,'appliedSymmetricOffset':delta.tolist()})
    anchors = np.array([[x,y] for x in [-.17,-.09,-.03,0,.03,.09,.17] for y in [eye_y-.145,eye_y+.055]])
    anchors = np.vstack((anchors, [[0,eye_y+d] for d in [-.13,-.08,-.03,.02]]))
    field = radial_field(np.vstack((controls,anchors)),np.vstack((values,np.zeros_like(anchors))),.026,.002)

    def read(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dtype = np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        return np.ndarray((a['count'],width),dtype,buffer=binary,
                          offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                          strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))

    def smoothstep(x):
        x = np.clip(x,0,1); return x*x*(3-2*x)

    changed = []
    for mesh in doc['meshes']:
        if mesh['name'] not in ['Anatomical head and hands','high-poly']: continue
        primitive = mesh['primitives'][0]; assert not primitive.get('targets')
        attrs = primitive['attributes']; old = read(attrs['POSITION']).copy(); new = old.copy()
        mask = smoothstep((old[:,1]-eye_y+.145)/.022) * smoothstep((eye_y+.07-old[:,1])/.03)
        mask *= smoothstep((old[:,2]-.16)/.10) * smoothstep((.17-np.abs(old[:,0]))/.035)
        new[:,:2] += field(old[:,:2]) * mask[:,None]
        triangles = read(primitive['indices']).reshape(-1,3)
        cross = lambda p: np.cross(p[triangles[:,1]]-p[triangles[:,0]],p[triangles[:,2]]-p[triangles[:,0]])
        assert np.all((cross(old)*cross(new)).sum(axis=1) >= -1e-15), 'Inverted face'
        moved = np.any(new != old,axis=1); displacement = np.linalg.norm(new-old,axis=1)
        assert displacement.max() < .006
        normals = smooth_normals(new,triangles).astype('<f4'); normals[~moved] = read(attrs['NORMAL'])[~moved]
        for name, value in [('POSITION',new),('NORMAL',normals)]:
            read(attrs[name])[:] = value
            doc['accessors'][attrs[name]].update(min=value.min(axis=0).tolist(),max=value.max(axis=0).tolist())
        changed.append({'mesh':mesh['name'],'changedVertices':int(moved.sum()),'maxDisplacement':float(displacement.max())})

    # The source's AO UV is the final appended buffer. Remove only this known
    # bake, so refine-smith-eyes.py recomputes visibility against the new lids.
    eye = next(m for m in doc['meshes'] if m['name']=='high-poly')['primitives'][0]
    index = eye['attributes'].pop('TEXCOORD_1')
    assert index == len(doc['accessors'])-1 and doc['extras']['eyeOcclusionVersion']==1
    accessor = doc['accessors'].pop(); assert accessor['bufferView']==len(doc['bufferViews'])-1
    view = doc['bufferViews'].pop(); assert view['byteOffset']+view['byteLength']==len(binary)
    binary = binary[:view['byteOffset']]
    material = doc['materials'][eye['material']]; texture = material.pop('occlusionTexture')
    assert texture == {'index':len(doc['textures'])-1,'texCoord':1,'strength':1}
    texture = doc['textures'].pop(); assert texture=={'source':len(doc['images'])-1,'sampler':len(doc['samplers'])-1}
    assert doc['images'].pop()=={'uri':'smith-eye-occlusion.png'}
    doc['samplers'].pop(); del doc['extras']['eyeOcclusionVersion']
    doc['extras'].update(filmFaceVersion=1,filmFaceSourceSha256=hashlib.sha256(raw).hexdigest(),
                         filmFaceDiagnosticSha256=hashlib.sha256(args.diagnostic.read_bytes()).hexdigest(),
                         filmFaceStatus='Small stable-feature correction; user acceptance pending')
    doc['buffers'][0]['byteLength']=len(binary)
    args.output.mkdir(parents=True,exist_ok=True)
    for image in doc['images']:
        link = args.output / image['uri']
        if not link.exists(): link.symlink_to((args.source.parent / image['uri']).resolve())
    encoded = json.dumps(doc,separators=(',',':')).encode(); encoded += b' '*(-len(encoded)%4)
    result = struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    temporary = args.output / 'smith.glb.tmp'; temporary.write_bytes(result); temporary.replace(args.output / 'smith.glb')
    report = {'sourceSha256':hashlib.sha256(raw).hexdigest(),'preOcclusionCandidateSha256':hashlib.sha256(result).hexdigest(),
              'diagnosticSha256':hashlib.sha256(args.diagnostic.read_bytes()).hexdigest(),'measurements':measured,'changed':changed,
              'exclusions':'No brow, mouth, chin, pupil, silhouette, depth or texture fit. Eye AO must be recomputed.',
              'userAcceptance':'pending'}
    (args.output / 'face-refinement-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source','diagnostic','output']: parser.add_argument('--'+name,type=Path,required=True)
    main(parser.parse_args(sys.argv[sys.argv.index('--')+1:]))
