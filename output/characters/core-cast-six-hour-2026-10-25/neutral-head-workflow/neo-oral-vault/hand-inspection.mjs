import * as THREE from 'three';

// Display the actual driven mesh's connected hand without torso occlusion.
// Positions, normals, weights, skinning, morphs and materials remain shared.
export class HandInspection {
  views = new WeakMap();
  restore = () => {};

  apply(root, skin, side, source) {
    const original=skin.geometry;
    let views=this.views.get(original);
    if(!views){
      const position=source.attributes.position,keys=new Map(),weld=[];
      for(let id=0;id<position.count;id++){
        const key=[position.getX(id),position.getY(id),position.getZ(id)].map(v=>v.toFixed(6)).join(',');
        if(!keys.has(key))keys.set(key,keys.size);weld[id]=keys.get(key);
      }
      const neighbours=Array.from({length:keys.size},()=>new Set()),index=original.index;
      for(let face=0;face<index.count;face+=3){const ids=[0,1,2].map(k=>weld[index.getX(face+k)]);for(const a of ids)for(const b of ids)neighbours[a].add(b);}
      views={};
      for(const which of ['R','L']){
        const joint=skin.skeleton.bones.findIndex(b=>b.name==='finger3-3_'+which),indices=original.attributes.skinIndex,weights=original.attributes.skinWeight;
        let seed=-1;
        for(let id=0;id<position.count&&seed<0;id++)if([0,1,2,3].some(k=>indices.getComponent(id,k)===joint&&weights.getComponent(id,k)>.95))seed=weld[id];
        if(seed<0)throw Error('Missing hand inspection seed');
        const connected=new Set(),todo=[seed];
        while(todo.length){const id=todo.pop();if(connected.has(id))continue;connected.add(id);for(const next of neighbours[id])if(!connected.has(next))todo.push(next);}
        const retained=[];
        for(let face=0;face<index.count;face+=3){const ids=[0,1,2].map(k=>index.getX(face+k));if(ids.every(id=>connected.has(weld[id])))retained.push(...ids);}
        const geometry=new THREE.BufferGeometry();geometry.setIndex(retained);views[which]=geometry;
      }
      this.views.set(original,views);
    }
    const geometry=views[side];geometry.attributes=original.attributes;geometry.morphAttributes=original.morphAttributes;geometry.morphTargetsRelative=original.morphTargetsRelative;
    skin.skeleton.update();
    const bounds=new THREE.Box3(),point=new THREE.Vector3();
    for(const id of new Set(geometry.index.array))bounds.expandByPoint(skin.getVertexPosition(id,point).applyMatrix4(skin.matrixWorld));
    const visible=[];root.traverse(mesh=>{if(mesh.isMesh){visible.push([mesh,mesh.visible]);mesh.visible=mesh===skin;}});
    const culling=skin.frustumCulled;skin.frustumCulled=false;skin.geometry=geometry;
    this.restore=()=>{skin.geometry=original;skin.frustumCulled=culling;for(const [mesh,value]of visible)mesh.visible=value;this.restore=()=>{};};
    return {bounds,triangles:geometry.index.count/3,attributesShared:geometry.attributes===original.attributes,morphsShared:geometry.morphAttributes===original.morphAttributes};
  }
}
