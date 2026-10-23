import * as THREE from 'three';
import { actor } from '../tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion,newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { handSurface } from '../tests/helpers/hand-surface.mjs';
import { crossings } from '../tests/helpers/hand-self-contact.mjs';
for(const id of ['neo','morpheus'] as const){
 const h=await actor(id),jacket=h.rig.root.getObjectByName(id+'-dojo-jacket') as THREE.SkinnedMesh;
 const input={speed:0,grounded:true,verticalVelocity:0,turn:0,dojoOutfit:id,dojoSparring:true},state=newMotion();
 h.models.animate(h.rig,advanceMotion(state,input,0),state,input,0);h.rig.root.updateMatrixWorld(true);jacket.skeleton.update();
 for(const side of ['R','L']){
  const surface=handSurface(h.rig,side),skin=surface.group.skin,wrist=h.rig.bones.get('wrist_'+side)!,inverse=wrist.matrixWorld.clone().invert(),bind=skin.skeleton.boneInverses[skin.skeleton.bones.indexOf(wrist)];skin.skeleton.update();
  const triangles=surface.triangles.filter(face=>face.ids.every(v=>new THREE.Vector3().fromBufferAttribute(skin.geometry.attributes.position,v).applyMatrix4(skin.bindMatrix).applyMatrix4(bind).y<-.14));
  const faces=triangles.map(face=>{const points=face.ids.map(v=>skin.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse));return{...face,points,box:new THREE.Box3().setFromPoints(points)}});
  const ci=jacket.geometry.index!,cloth=Array.from({length:ci.count/3},(_,face)=>{const ids=[0,1,2].map(k=>ci.getX(face*3+k)),points=ids.map(v=>jacket.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(jacket.matrixWorld).applyMatrix4(inverse));return{face,ids,points,box:new THREE.Box3().setFromPoints(points)}});
  const contact=crossings(faces,cloth,false);
  console.log(JSON.stringify({id,side,contact,examples:contact.examples.map(pair=>{const c=cloth[pair.second],f=faces.find(f=>f.face===pair.first)!;return{hand:f.points.map(p=>p.toArray()),cloth:c.points.map(p=>p.toArray()),weights:c.ids.map(v=>[0,1,2,3].map(k=>[jacket.skeleton.bones[jacket.geometry.attributes.skinIndex.getComponent(v,k)].name,jacket.geometry.attributes.skinWeight.getComponent(v,k)]))}})},null,2));
 }
 h.models.dispose();
}
