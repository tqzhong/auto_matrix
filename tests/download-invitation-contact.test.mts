import * as THREE from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { crossings } from './helpers/hand-self-contact.mjs';
import { advanceMotion,newMotion } from '../packages/client/src/agents/CharacterMotion.js';
test('Morpheus raises his chin-supporting hand clear of the trousers, sweater and wrist skin',async t=>{
const h=await actor('morpheus');t.after(()=>h.models.dispose());const surface=handSurface(h.rig,'R'),checks=[];
for(const elapsed of [0,2,5.8,8.8,9,...Array.from({length:37},(_,i)=>9.1+i/60),10]){
 const input={speed:0,grounded:true,verticalVelocity:0,turn:0,realWorld:true,nebCrew:'morpheus' as const,nebCrewEarly:true,glasses:false,training:{kind:'download' as const,role:'morpheus' as const,elapsed}},state=newMotion();
 h.models.animate(h.rig,advanceMotion(state,input,0),state,input,0);h.rig.root.updateMatrixWorld(true);
 const hand=surface.draw(),inverse=h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert(),contacts=[];let meshes=0;
 h.rig.root.traverseVisible(object=>{
  if(!(object instanceof THREE.Mesh)||object===surface.group.skin)return;
  meshes++;if(object instanceof THREE.SkinnedMesh)object.skeleton.update();
  const a=object.geometry.attributes.position,index=object.geometry.index,matrix=inverse.clone().multiply(object.matrixWorld),points=Array.from({length:a.count},(_,id)=>object.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(matrix));
  const triangles=Array.from({length:(index?.count??a.count)/3},(_,face)=>{const ids=[0,1,2].map(k=>index?index.getX(face*3+k):face*3+k),p=ids.map(id=>points[id]);return{face,ids,points:p,box:new THREE.Box3().setFromPoints(p)};});
  const contact=crossings(hand.faces,triangles,false);if(contact.count)contacts.push({mesh:object.name,...contact});
 });
 checks.push({elapsed,otherVisibleMeshesChecked:meshes,self:hand.self,contacts,passed:hand.self.count===0&&!contacts.length});console.log(JSON.stringify({elapsed,self:hand.self.count,contacts:contacts.map(c=>({mesh:c.mesh,count:c.count}))}));
}
assert.deepEqual(checks.filter(c=>!c.passed),[], 'the actual hand must clear itself and the visible outfit through the full lift');
});
