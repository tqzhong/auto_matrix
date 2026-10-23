import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { constructInspection, inspectionContact, inspectionBodyCrossings } from './helpers/construct-inspection.mjs';
import { wristSwing } from './helpers/core-connector.mjs';
import { handSurface } from './helpers/hand-surface.mjs';
import { newMotion, advanceMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

test('Neo checks his residual image without folding either wrist backwards or jumping an arm joint', async t => {
  const h=await constructInspection(t);let previous:THREE.Vector3[]|undefined,maximum=0,jump=0,failures=0;
  for(let frame=0;frame<=600;frame++){
    const elapsed=frame/100;h.at(elapsed);
    for(const side of ['R','L']){const angle=wristSwing(h.rig.bones.get(`wrist_${side}`)!);maximum=Math.max(maximum,angle);if(angle>70)failures++;}
    const points=['elbow_R','wrist_R','elbow_L','wrist_L'].map(name=>h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    if(previous)points.forEach((p,i)=>jump=Math.max(jump,p.distanceTo(previous![i])));previous=points;
  }
  t.diagnostic(JSON.stringify({maximumWristSwing:maximum,largestJointStepPer10ms:jump}));
  assert.equal(failures,0,'use the same 70-degree wrist limit as the physical tube/core grips');
  assert.ok(jump<.05,`a self-inspection joint moves ${jump} world units in 10ms`);
});

test('Neo uses his left hand to feel the missing rear interface while the right arm has lowered', async t=>{
  const h=await constructInspection(t);h.at(4);
  const head=h.rig.bones.get('head')!.getWorldPosition(new THREE.Vector3()),left=h.rig.bones.get('wrist_L')!.getWorldPosition(new THREE.Vector3()),right=h.rig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3());
  assert.ok(left.distanceTo(head)<.8,'the released-film gesture raises Neo’s left hand toward the back of his head');
  assert.ok(right.y<head.y-1,'the earlier forearm-checking right hand must have lowered before the neck check');
});

test('the complete delivered hands retain their surface during the residual-image inspection', async t=>{
  const h=await constructInspection(t),surfaces=['R','L'].map(side=>handSurface(h.rig,side));
  for(const elapsed of [.3,.5,.75,1,1.6,2.2,2.7,3,3.5,4,4.8,5.2,5.6,6]){
    h.at(elapsed);
    for(const [which,surface] of surfaces.entries()){
      assert.equal(surface.vertices.length,6673);assert.equal(surface.triangles.length,12472);
      assert.equal(surface.draw().self.count,0,`${elapsed}: ${['R','L'][which]} actual hand surface`);
    }
  }
});

test('the inspected hands do not cut the delivered head, wrist skin or jacket through the reach and release',async t=>{
  const h=await constructInspection(t),failures:unknown[]=[];
  for(const elapsed of [0,.3,.5,.75,1,1.8,2.4,2.8,3.2,3.6,4.4,5,5.3,5.6,6]){
    h.at(elapsed);const contacts=inspectionBodyCrossings(h.rig) as {name:string;side?:string;count:number}[];
    if(contacts.length)failures.push({elapsed,contacts:contacts.map(({name,side,count})=>({name,side,count}))});
  }
  assert.deepEqual(failures,[],'actual hand/body and opposite-hand triangles through the complete sequence');
});

test('the actual palmar skin reaches the other forearm and visible rear head surface without floating away',async t=>{
  const h=await constructInspection(t);let maximum=0;
  for(const [side,times] of [['R',[1,1.5,2]],['L',[3.6,4,4.8,5]]] as const)for(const elapsed of times){
    h.at(elapsed);const contact=inspectionContact(h.rig,side);
    assert.ok(contact.vertices>10,'sample a physical palm patch, not a wrist marker');maximum=Math.max(maximum,contact.gap);
    assert.ok(contact.gap<=.04,`${elapsed}: ${side} actual palm floats ${contact.gap} world units from the body`);
  }
  t.diagnostic(JSON.stringify({maximumActualPalmGap:maximum}));
});

test('the inspection reconstructs after cold loading, restores ordinary clothes and keeps the jacket inside its culling bounds',async t=>{
  const h=await constructInspection(t),mesh=h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  const points=()=>{mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,id)=>mesh.getVertexPosition(id,new THREE.Vector3()));};
  h.idle();const ordinary=points();h.at(4);
  const names=['shoulder_R','elbow_R','wrist_R','shoulder_L','elbow_L','wrist_L',...['R','L'].flatMap(side=>Array.from({length:5},(_,digit)=>[1,2,3].map(j=>`finger${digit+1}-${j}_${side}`)).flat())];
  const expected=names.map(name=>h.rig.bones.get(name)!.quaternion.clone());
  for(const elapsed of [6,.5,3.2,1.8,5.6])h.at(elapsed);h.at(4);
  names.forEach((name,i)=>assert.ok(h.rig.bones.get(name)!.quaternion.angleTo(expected[i])<1e-6,`reordered ${name}`));
  const cold=await constructInspection(t);cold.at(4,true);names.forEach((name,i)=>assert.ok(cold.rig.bones.get(name)!.quaternion.angleTo(expected[i])<1e-6,`cold first-person ${name}`));
  for(const elapsed of [0,.5,1.5,3.2,4,5.6,6]){
    h.at(elapsed);for(const point of points()){
      assert.ok(mesh.boundingBox!.containsPoint(point),`${elapsed}: active sleeve escaped the actual bounding box`);
      assert.ok(mesh.boundingSphere!.distanceToPoint(point)<1e-6,`${elapsed}: active sleeve escaped the actual bounding sphere`);
    }
  }
  h.idle();const restored=points();assert.equal(restored.length,ordinary.length);restored.forEach((point,i)=>assert.ok(point.distanceTo(ordinary[i])<1e-6,`leaving preserves ordinary jacket vertex ${i}`));
});

test('ordinary elapsed animation preserves both body clearances and skin contact rather than relying on frozen poses',async t=>{
  const h=await constructInspection(t),motion=newMotion(),sampled=new Set([30,60,90,144,192,216,264,300,318,336]);
  for(let frame=0;frame<=360;frame++){
    const elapsed=frame/60,input:MotionInput={speed:0,grounded:true,verticalVelocity:0,turn:0,clubClothes:true,glasses:false,performance:'construct',construct:{role:'neo',phase:'image',elapsed}};
    h.models.animate(h.rig,advanceMotion(motion,input,1/60),motion,input,1/60);h.rig.root.updateMatrixWorld(true);
    for(const side of ['R','L'])assert.ok(wristSwing(h.rig.bones.get(`wrist_${side}`)!)<=70,`${elapsed}: warm ${side} wrist`);
    if(sampled.has(frame))assert.deepEqual(inspectionBodyCrossings(h.rig),[],`${elapsed}: actual moving-body contact`);
    const contactSide=[60,90,120].includes(frame)?'R':[216,264,300].includes(frame)?'L':undefined;
    if(contactSide)assert.ok(inspectionContact(h.rig,contactSide).gap<=.04,`${elapsed}: actual moving palm contact`);
  }
});
