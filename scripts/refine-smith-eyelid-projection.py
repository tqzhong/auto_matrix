"""Register existing portrait colors on the actual eyelid skin and bake its UV patch.

The generated portrait is read-only authoring input. The GLB binary, primary UVs,
rig, morphs, materials, hands and all non-eye atlas pixels remain unchanged.
"""
import argparse
import bpy
import hashlib
import json
from pathlib import Path
import struct
import sys
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from character_fitting import OVAL,FEATURES,MIDLINE,radial_field


def load(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=bytearray(raw[28+n:])
    def read(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];t=np.dtype({5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
        return np.ndarray((a['count'],w),t,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*t.itemsize),t.itemsize))
    return raw,doc,binary,read


def portrait_projection(evidence):
    source=json.loads((evidence/'source-landmarks.json').read_text());target=json.loads((evidence/'portrait-landmarks.json').read_text());revised=json.loads((evidence/'delit-landmarks.json').read_text());camera=json.loads((evidence/'source-calibration/smith-camera.json').read_text())
    xy=np.array(source['points'])[:,:2];xy=np.column_stack(((xy[:,0]-.5)*camera['ortho']*camera['width']/camera['height'],camera['center']+(.5-xy[:,1])*camera['ortho']))
    source_eye=xy[[468,473]].mean(axis=0);target_px=np.array(target['points'])[:,:2]*target['size'];target_eye=target_px[[468,473]].mean(axis=0);scale=np.linalg.norm(xy[468]-xy[473])/np.linalg.norm(target_px[468]-target_px[473])
    a=np.array(target['points'])[:,:2]*target['size']/target['size'][1];b=np.array(revised['points'])[:,:2]*revised['size']/revised['size'][1];ids=np.unique(OVAL+FEATURES+MIDLINE+[468,473]);field=radial_field(a[ids],b[ids]-a[ids],.06,.01)
    def project(points):
        px=(target_eye+(points-source_eye)/[scale,-scale])/target['size'][1]
        return (px+field(px))*revised['size'][1]
    return project


def targets(diagnostic):
    result=[]
    for side in [-1,1]:
        samples=[r for r in diagnostic['rimSamples'] if r['side']==side]
        xs=np.array([r['xyz'][0] for r in samples]);lo,hi=xs.min()-.000333333333, xs.max()+.000333333333
        for row in samples:
            contour=np.array(diagnostic['portraitSkinContours'][str(side)][row['region']])
            t=(row['xyz'][0]-lo)/(hi-lo);x=contour[0,0]+t*(contour[-1,0]-contour[0,0])
            result.append({**row,'targetPixel':[float(x),float(np.interp(x,contour[:,0],contour[:,1]))]})
    return result


def main(source,diagnostic_path,evidence,output):
    raw,doc,binary,read=load(source);diagnostic=json.loads(diagnostic_path.read_text())
    assert hashlib.sha256(raw).hexdigest()==diagnostic['sourceSha256'] and not doc['extras'].get('eyelidProjectionVersion')
    source_raw,source_doc,source_binary,source_read=load(evidence/'delit-skin-candidate/smith.glb')
    p=next(m for m in doc['meshes'] if m['name']=='Anatomical head and hands')['primitives'][0]
    q=next(m for m in source_doc['meshes'] if m['name']=='Anatomical head and hands')['primitives'][0]
    position=read(p['attributes']['POSITION']);uv=read(p['attributes']['TEXCOORD_0']);faces=read(p['indices']).reshape(-1,3)
    original=source_read(q['attributes']['POSITION']);rows=targets(diagnostic);project=portrait_projection(evidence)
    selected=[]
    for side in [-1,1]:
        for region in ['lower','upper']:
            indices=[i for i,r in enumerate(rows) if r['side']==side and r['region']==region]
            selected.extend(sorted(set(indices[::4]+[indices[-1]])))
    smooth=lambda t:np.clip(t,0,1)**2*(3-2*np.clip(t,0,1))
    # The front skin atlas is separate from the internal eye socket chart.
    # Only the contiguous UV neighborhood containing the actual aperture is baked.
    rim_uv=np.array([r['uv'] for r in rows]);chart=(uv[:,0]>rim_uv[:,0].min()-.05)&(uv[:,0]<rim_uv[:,0].max()+.05)
    weight=np.zeros(len(position));displacement=np.zeros((len(position),2));x,y=position[:,:2].T
    # Carry the adjacent eyelid fold with its aperture edge. A free 2-D radial
    # fit matched the boundary but bent the upper fold into two extra peaks.
    for side in [-1,1]:
        curves={}
        for region in ['lower','upper']:
            samples=sorted([rows[i] for i in selected if rows[i]['side']==side and rows[i]['region']==region],key=lambda r:r['xyz'][0])
            sx=np.array([r['xyz'][0] for r in samples]);sy=np.array([r['xyz'][1] for r in samples])
            delta=np.array([np.array(r['targetPixel'])-r['portraitPixel'] for r in samples])
            curves[region]=(np.interp(x,sx,sy),np.column_stack([np.interp(x,sx,delta[:,k]) for k in [0,1]]))
        lo,hi=sx[0],sx[-1];lower,lower_delta=curves['lower'];upper,upper_delta=curves['upper']
        distance=np.maximum.reduce([lower-y,y-upper,np.zeros(len(position))])
        extent=(1-smooth(np.maximum(lo-x,x-hi)/.025))*smooth((position[:,2]-.22)/.06)*chart
        collar=(1-smooth((distance-.012)/.028))*extent
        # Restrict replacement to the contaminated wet-rim strip. Carrying
        # the source's entire upper crease also changed its expression shape.
        color_weight=(1-smooth((distance-.0015)/.002))*extent
        blend=np.clip((y-lower)/np.maximum(upper-lower,1e-6),0,1)
        displacement+=((1-blend[:,None])*lower_delta+blend[:,None]*upper_delta)*collar[:,None]
        weight+=color_weight
    assert weight.max()<=1 and not np.any(weight[position[:,1]<4.05]),'Color patch reached protected skin'
    patch=faces[np.any(weight[faces]>0,axis=1)&np.all(chart[faces],axis=1)]
    assert patch.max()<len(original),'The rim patch reached subdivided forehead skin'
    pixels=np.zeros((len(position),2));pixels[:len(original)]=project(original[:,:2]);pixels+=displacement
    residuals=[]
    for row in rows:
        actual=np.array(row['barycentric'])@pixels[faces[row['face']]]
        residuals.append(float(np.linalg.norm(actual-np.array(row['targetPixel']))))
    assert np.sqrt(np.mean(np.array(residuals)**2))<2 and max(residuals)<6,'Eyelid projection did not fit its withheld aperture samples'
    output.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    mesh=bpy.data.meshes.new('Eyelid baking patch');mesh.from_pydata(position.tolist(),[],patch.tolist());mesh.update()
    obj=bpy.data.objects.new('Eyelid baking patch',mesh);bpy.context.collection.objects.link(obj)
    loops=np.array([loop.vertex_index for loop in mesh.loops]);base_uv=uv.copy();base_uv[:,1]=1-base_uv[:,1]
    layer=mesh.uv_layers.new(name='Original atlas');layer.data.foreach_set('uv',base_uv[loops].ravel())
    projected=pixels/[1024,1536];projected[:,1]=1-projected[:,1]
    layer=mesh.uv_layers.new(name='Registered portrait');layer.data.foreach_set('uv',projected[loops].ravel())
    attribute=mesh.attributes.new('eyelid_weight','FLOAT','POINT');attribute.data.foreach_set('value',weight)
    material=bpy.data.materials.new('Eyelid color registration');material.use_nodes=True;mesh.materials.append(material)
    nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
    final=nodes.new('ShaderNodeOutputMaterial');emission=nodes.new('ShaderNodeEmission');links.new(emission.outputs[0],final.inputs['Surface'])
    old_image=bpy.data.images.load(str((source.parent/'smith-portrait-albedo.png').resolve()))
    original_map=nodes.new('ShaderNodeTexImage');original_map.image=old_image
    old_coordinates=nodes.new('ShaderNodeUVMap');old_coordinates.uv_map='Original atlas';links.new(old_coordinates.outputs[0],original_map.inputs['Vector'])
    portrait=nodes.new('ShaderNodeTexImage');portrait.image=bpy.data.images.load(str((evidence/diagnostic['portraitReference']).resolve()))
    coordinates=nodes.new('ShaderNodeUVMap');coordinates.uv_map='Registered portrait';links.new(coordinates.outputs[0],portrait.inputs['Vector'])
    mask=nodes.new('ShaderNodeAttribute');mask.attribute_name='eyelid_weight'
    mix=nodes.new('ShaderNodeMixRGB');links.new(mask.outputs['Fac'],mix.inputs[0]);links.new(original_map.outputs['Color'],mix.inputs[1]);links.new(portrait.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],emission.inputs['Color'])
    baked=old_image.copy();baked.name='Smith corrected eyelid atlas'
    target=nodes.new('ShaderNodeTexImage');target.image=baked;nodes.active=target;mesh.uv_layers.active_index=0
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
    bpy.ops.object.bake(type='EMIT',margin=0,use_clear=False)
    temporary=output/'smith-portrait-albedo.tmp.png';baked.filepath_raw=str(temporary.resolve());baked.file_format='PNG';baked.save();temporary.replace(output/'smith-portrait-albedo.png')
    for image in doc['images']:
        link=output/image['uri']
        if not link.exists():link.symlink_to((source.parent/image['uri']).resolve())
    albedo_sha=hashlib.sha256((output/'smith-portrait-albedo.png').read_bytes()).hexdigest()
    doc['extras'].update(eyelidProjectionVersion=1,eyelidProjectionSourceSha256=hashlib.sha256(raw).hexdigest(),eyelidAlbedoSha256=albedo_sha)
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    temporary=output/'smith.glb.tmp';temporary.write_bytes(result);temporary.replace(output/'smith.glb')
    candidate_sha=hashlib.sha256(result).hexdigest();source_sha=hashlib.sha256(raw).hexdigest()
    prior_validation=json.loads((source.parent/'validation.json').read_text())
    validation={'candidateSha256':candidate_sha,'geometryInheritedFromSha256':source_sha,
                'geometryValidation':'Entire GLB binary unchanged; frame weights and barycentric bindings are inherited from the verified wrinkle geometry.',
                'frames':prior_validation['frames'],'limitation':'Only eyelid color projection changed. Actor likeness and overall gaze remain pending.'}
    (output/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
    binding=json.loads((source.parent/'brow-diagnostic.json').read_text());binding.update(geometryInheritedFromSha256=source_sha,reboundCandidateSha256=candidate_sha)
    (output/'brow-diagnostic.json').write_text(json.dumps(binding,indent=2)+'\n')
    report={'sourceSha256':hashlib.sha256(raw).hexdigest(),'candidateSha256':hashlib.sha256(result).hexdigest(),'albedoSha256':albedo_sha,
            'diagnosticSha256':hashlib.sha256(diagnostic_path.read_bytes()).hexdigest(),'albedoProjectionGeometrySha256':hashlib.sha256(source_raw).hexdigest(),
            'fitSamples':len(selected),'availableApertureSamples':len(rows),'apertureProjectionRmsPixels':float(np.sqrt(np.mean(np.array(residuals)**2))),
            'apertureProjectionMaximumPixels':max(residuals),'bakedTriangles':len(patch),'binaryUnchanged':True,'sourcePortraitUnchanged':True,
            'limitation':'Repairs eyelid color projection only; does not establish eye anatomy or actor likeness.','userAcceptance':'pending'}
    (output/'eyelid-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
    (output/'eyelid-projection.json').write_text(json.dumps({'vertices':[{'id':int(i),'pixel':pixels[i].tolist(),'weight':float(weight[i])} for i in np.unique(patch)],'faces':patch.tolist()},separators=(',',':'))+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','diagnostic','evidence','output']:parser.add_argument('--'+name,type=Path,required=True)
    a=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);main(a.source,a.diagnostic,a.evidence,a.output)
