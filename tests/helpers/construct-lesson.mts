import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { CONSTRUCT,FILM_SETS,awakeningPose,constructGuidePose } from '@auto_matrix/shared';
import { actor,fingerGroups } from './fighting-hand-fixture.mjs';
import { newMotion,advanceMotion,type MotionInput } from '../../packages/client/src/agents/CharacterMotion.js';
import { createLoungeChair } from '../../packages/client/src/engine/LoungeChair.js';
import { handSurface } from './hand-surface.mjs';
import { crossings } from './hand-self-contact.mjs';
import { inspectionPalm } from './construct-inspection.mjs';

export async function constructLesson(role:'neo'|'morpheus',t?:TestContext){
 const h=await actor(role),center=FILM_SETS.film_white_construct.center,chair=createLoungeChair(new THREE.MeshStandardMaterial());
 chair.position.set(center.x+CONSTRUCT.chairX[role],center.y-1,center.z+CONSTRUCT.chair.z);chair.rotation.y=Math.PI;chair.updateMatrixWorld(true);
 const surfaces=['R','L'].map(side=>handSurface(h.rig,side));
 // Fix physical patch membership before story deformation changes its normals.
 for(const side of ['R','L'] as const)inspectionPalm(h.rig,side);
 const furniture:{face:number;ids:number[];points:THREE.Vector3[];box:THREE.Box3}[]=[];
 chair.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.attributes.position,index=o.geometry.index;
  for(let f=0;f<(index?.count??p.count);f+=3){const ids=[0,1,2].map(k=>index?index.getX(f+k):f+k),points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(o.matrixWorld));furniture.push({face:f/3,ids,points,box:new THREE.Box3().setFromPoints(points)});}});
 const dispose=()=>{h.models.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();chair.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};t?.after(dispose);
 const at=(elapsed:number,firstPerson=false,motion=newMotion(),delta=0)=>{
  const root=awakeningPose({kind:'construct',elapsed,approach:{x:CONSTRUCT.approach.x+.15,z:CONSTRUCT.approach.z+.1}});
  h.rig.root.position.set(center.x+(role==='neo'?root.x:CONSTRUCT.chairX.morpheus),center.y-1,center.z+(role==='neo'?root.z:CONSTRUCT.chair.z));h.rig.root.rotation.y=role==='neo'?CONSTRUCT.neo.yaw:Math.PI;
  const input:MotionInput={speed:0,grounded:true,verticalVelocity:0,turn:0,firstPerson,clubClothes:role==='neo',performance:'construct',reveal:{kind:'construct',elapsed,role,started:true}};
  h.models.animate(h.rig,advanceMotion(motion,input,delta),motion,input,delta);h.rig.root.updateMatrixWorld(true);
 };
 const atArrival=(elapsed:number)=>{const root=constructGuidePose(elapsed),motion=newMotion(),input:MotionInput={speed:root.speed,grounded:true,verticalVelocity:0,turn:0,construct:{role:'morpheus',phase:'approach',elapsed}};h.rig.root.position.set(center.x+root.x,center.y-1,center.z+root.z);h.rig.root.rotation.y=root.yaw;h.models.animate(h.rig,advanceMotion(motion,input,0),motion,input,0);h.rig.root.updateMatrixWorld(true);};
 const hands=()=>surfaces.map((surface,i)=>{const draw=surface.draw(),wrist=h.rig.bones.get(`wrist_${['R','L'][i]}`)!,inverse=wrist.matrixWorld.clone().invert();
  const worldBox=new THREE.Box3().setFromPoints([...draw.points.values()].map(p=>p.clone().applyMatrix4(wrist.matrixWorld)));
  const faces=furniture.filter(f=>worldBox.intersectsBox(f.box)).map(f=>{const points=f.points.map(p=>p.clone().applyMatrix4(inverse));return {...f,points,box:new THREE.Box3().setFromPoints(points)};});
  const palm=inspectionPalm(h.rig,['R','L'][i] as 'R'|'L'),hit=new THREE.Raycaster(palm.world.clone().add(new THREE.Vector3(0,.3,0)),new THREE.Vector3(0,-1,0),0,2).intersectObject(chair)[0];
  const contact=crossings(draw.faces,faces,false);const label=(face:number)=>{const raw=surface.triangles.find(f=>f.face===face)!;return raw.ids.map(id=>surface.group.digits[id]);};
  return {side:['R','L'][i],chairExamples:contact.examples.map(e=>({digits:label(e.first),line:e.line})),self:draw.self.count,chair:contact.count,palmGap:hit?hit.distance-.3:Infinity,palmNormalY:palm.normal.y};});
 const remote=()=>{const prop=h.rig.root.getObjectByName('construct-held-remote')!,g=fingerGroups(h.rig,'R');g.skin.skeleton.update();prop.updateWorldMatrix(true,true);
  const casing=prop.children[0] as THREE.Mesh;casing.geometry.computeBoundingBox();const box=casing.geometry.boundingBox!,matrix=casing.matrixWorld.clone().invert().multiply(g.skin.matrixWorld),point=(id:number)=>g.skin.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(matrix);
  const draw=surfaces[0].draw(),inverse=h.rig.bones.get('wrist_R')!.matrixWorld.clone().invert(),faces:{face:number;ids:number[];points:THREE.Vector3[];box:THREE.Box3}[]=[];
  prop.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const p=o.geometry.attributes.position,index=o.geometry.index!,toWrist=inverse.clone().multiply(o.matrixWorld);for(let f=0;f<index.count;f+=3){const ids=[0,1,2].map(k=>index.getX(f+k)),points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(toWrist));faces.push({face:f/3,ids,points,box:new THREE.Box3().setFromPoints(points)});}});
  return {inside:g.hand.filter(id=>{const p=point(id);return p.x>box.min.x+.003&&p.x<box.max.x-.003&&p.y>box.min.y+.003&&p.y<box.max.y-.003&&p.z>box.min.z+.003&&p.z<box.max.z-.003;}).length,self:draw.self.count,propCrossings:crossings(draw.faces,faces,false).count,tipGaps:g.tips.map(ids=>Math.min(...ids.map(id=>box.distanceToPoint(point(id)))))};};

 return {...h,chair,at,atArrival,hands,remote,dispose};
}
