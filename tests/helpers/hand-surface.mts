import * as THREE from 'three';
import type { HeroRig } from '../../packages/client/src/agents/HeroModel.js';
import { fingerGroups } from './fighting-hand-fixture.mjs';
import { crossings } from './hand-self-contact.mjs';

export function handSurface(rig: HeroRig, side: string) {
  const group=fingerGroups(rig,side),skin=group.skin,p=skin.geometry.attributes.position,index=skin.geometry.index!;
  const keys=new Map<string,number>(),weld=new Uint32Array(p.count);
  for(let v=0;v<p.count;v++){
    const key=[p.getX(v),p.getY(v),p.getZ(v)].map(n=>n.toFixed(6)).join(',');let id=keys.get(key);if(id===undefined){id=keys.size;keys.set(key,id);}weld[v]=id;
  }
  const neighbours=Array.from({length:keys.size},()=>new Set<number>());
  for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>weld[index.getX(f+k)]);for(const a of ids)for(const b of ids)neighbours[a].add(b);}
  const connected=new Set<number>(),todo=[weld[group.tips[2][0]]];
  while(todo.length){const id=todo.pop()!;if(connected.has(id))continue;connected.add(id);for(const next of neighbours[id])if(!connected.has(next))todo.push(next);}
  const triangles=[];
  for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>index.getX(f+k));if(ids.every(id=>connected.has(weld[id])))triangles.push({face:f/3,ids});}
  const vertices=Array.from(new Set(triangles.flatMap(t=>t.ids)));
  const posePoints=()=>{skin.skeleton.update();const inverse=rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert().multiply(skin.matrixWorld);return new Map(vertices.map(id=>[id,skin.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(inverse)]));};
  return {group,vertices,triangles,weld,posePoints,draw(override?:Map<number,THREE.Vector3>){
    skin.skeleton.update();const inverse=rig.bones.get(`wrist_${side}`)!.matrixWorld.clone().invert().multiply(skin.matrixWorld),points=override??new Map(vertices.map(id=>[id,skin.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(inverse)]));
    const faces=triangles.map(t=>{const v=t.ids.map(id=>points.get(id)!);return{face:t.face,ids:t.ids.map(id=>weld[id]),points:v,box:new THREE.Box3().setFromPoints(v)};});
    return {points,faces,self:crossings(faces,faces)};
  }};
}
