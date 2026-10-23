import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { desertGuide } from './helpers/desert-guide.mjs';
import { wristSwing } from './helpers/core-connector.mjs';

test('the seated desert guide keeps both wrists anatomically limited through the entire explanation',async t=>{
 const h=await desertGuide(t);let maximum=0,jump=0,previous:THREE.Vector3[]|undefined;
 for(let frame=0;frame<=1300;frame++){h.at(frame/100);for(const side of ['R','L'])maximum=Math.max(maximum,wristSwing(h.rig.bones.get(`wrist_${side}`)!));const points=['elbow_R','wrist_R','elbow_L','wrist_L'].map(n=>h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()));if(previous)points.forEach((p,i)=>jump=Math.max(jump,p.distanceTo(previous![i])));previous=points;}
 t.diagnostic(JSON.stringify({maximumWristSwing:maximum,largestJointStepPer10ms:jump}));assert.ok(maximum<=70);assert.ok(jump<.05);
});
test('the complete supporting hand stays outside the real curved chair and holds its actual top surface',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,1,1.5,2,2.4,2.8,4,6,8,9.5,10,10.5,11,11.2,13]){h.at(elapsed);for(const hand of h.hands()){assert.equal(hand.self,0,`${elapsed} ${hand.side} hand self contact`);assert.equal(hand.chair,0,`${elapsed} ${hand.side} hand crosses real chair`);if(hand.side==='L'){assert.ok(hand.palmGap>=-.003&&hand.palmGap<=.04,`${elapsed} actual palm gap ${hand.palmGap}`);assert.ok(hand.palmNormalY<-.65);}}}
});
test('both desert hands clear all delivered visible skin and garments including the lesson suit',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,1,1.5,2,2.4,2.8,5,8,9.5,10,10.5,11.2,13]){h.at(elapsed);assert.deepEqual(h.body(),[],`${elapsed} actual body and wardrobe crossing`);}
});
test('the raised boot clears the opposite leg while the supporting sole stays on the floor',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,3,6.5,10,13]){h.at(elapsed);const feet=h.feet();t.diagnostic(JSON.stringify({elapsed,...feet}));assert.ok(feet.leftSole>=0&&feet.leftSole<=.04);for(const key of ['boots','rightBootLeftLeg','leftBootRightLeg','legs']as const)assert.equal(feet[key].count,0,`${elapsed} ${key} intersection`);assert.ok(feet.supportGap<=.04,'the raised calf must have a real support on the opposite leg');assert.ok(feet.chairContacts.every(contact=>contact.count===0),`${elapsed} delivered legs and boots cross the chair`);}
});
test('releasing the remote does not expose a second arm gesture above the seated guide face',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,.5,1.3,2.8,5,7.5,8.5,9,9.5,10.2,11.2,13]){h.at(elapsed);assert.ok(h.rig.bones.get('wrist_R')!.getWorldPosition(new THREE.Vector3()).y<h.rig.bones.get('head')!.getWorldPosition(new THREE.Vector3()).y-.1,`${elapsed}: remote arm rises above the speaking face`);}
});
test('cold loading and normal elapsed animation reconstruct both support and remote poses',async t=>{
 const warm=await desertGuide(t),cold=await desertGuide(t),joints=['shoulder_R','elbow_R','wrist_R','shoulder_L','elbow_L','wrist_L','hip_R','knee_R','ankle_R','hip_L','knee_L','ankle_L',...Array.from({length:30},(_,i)=>`finger${Math.floor((i%15)/3)+1}-${i%3+1}_${i<15?'R':'L'}`)];
 const motion=newMotion();for(let frame=0;frame<=210;frame++)warm.at(frame/60,false,motion,1/60);const expected=joints.map(n=>warm.rig.bones.get(n)!.quaternion.clone());cold.at(3.5,true);for(const [i,name]of joints.entries())assert.ok(cold.rig.bones.get(name)!.quaternion.angleTo(expected[i])<1e-6,name);
 for(let frame=211;frame<=780;frame++){warm.at(frame/60,false,motion,1/60);if([300,480,600,660,780].includes(frame)){assert.deepEqual(warm.body(),[]);assert.ok(warm.hands().every(hand=>hand.self===0&&hand.chair===0));}}
});
test('the remote casing and buttons stay clear of the complete hand while all five fingertips retain contact',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,1.5,2.8,5,9.5,10.5,11.2,13]){h.at(elapsed);const remote=h.remote();assert.equal(remote.self,0);assert.equal(remote.inside,0);assert.equal(remote.propCrossings,0);assert.ok(remote.tipGaps.every(gap=>gap<=.04));}
});
test('both complete sleeve regions clear their own coat, inner shirt and physical upholstery',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,1.9,3.5,10.3,13]){h.at(elapsed);const sleeves=h.sleeves();t.diagnostic(JSON.stringify({elapsed,sleeves}));assert.ok(sleeves.every(s=>s.self===0&&s.shirt===0&&s.chair===0),`${elapsed}: actual sleeve surfaces intersect`);}
});
test('the held remote also clears all visible skin, clothing and the actual armchair',async t=>{
 const h=await desertGuide(t);for(const elapsed of [0,1.5,2.8,5,9.5,10.5,11.2,13]){h.at(elapsed);assert.deepEqual(h.remoteBody(),[],`${elapsed}: remote through a body or furniture surface`);}
});
