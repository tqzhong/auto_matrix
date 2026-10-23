import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { CONSTRUCT } from '@auto_matrix/shared';
import { constructLesson } from './helpers/construct-lesson.mjs';
import { wristSwing } from './helpers/core-connector.mjs';
import { inspectionBodyCrossings } from './helpers/construct-inspection.mjs';

test('Neo supports the chair with anatomically limited wrists and continuous reach and release',async t=>{
 const h=await constructLesson('neo',t);let maximum=0,jump=0,largestAt:unknown,previous:THREE.Vector3[]|undefined;
 for(let f=0;f<=1100;f++){h.at(f/100);for(const side of ['R','L'])maximum=Math.max(maximum,wristSwing(h.rig.bones.get(`wrist_${side}`)!));const points=['elbow_R','wrist_R','elbow_L','wrist_L'].map(n=>h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()));if(previous)points.forEach((p,i)=>{const distance=p.distanceTo(previous![i]);if(distance>jump){jump=distance;largestAt={elapsed:f/100,joint:i};}});previous=points;}
 t.diagnostic(JSON.stringify({maximumWristSwing:maximum,largestJointStepPer10ms:jump,largestAt}));assert.ok(maximum<=70,`chair wrist swing ${maximum}`);assert.ok(jump<.05,`chair reach jumps ${jump} world units per10ms`);
});
test('both complete delivered hands stay outside the actual upholstered chair throughout the gesture',async t=>{
 const h=await constructLesson('neo',t),failures:unknown[]=[];
 for(const elapsed of [0,.65,.85,1,1.3,1.65,2,3,5,6.5,6.8,7,7.3,7.6,8,11]){h.at(elapsed);const hands=h.hands();if(hands.some(p=>p.chair||p.self))failures.push({elapsed,hands});}assert.deepEqual(failures,[]);
});
test('Neo rests both actual palms on the chair crown rather than putting wrist markers near it',async t=>{
 const h=await constructLesson('neo',t);
 for(const elapsed of [2.3,2.5,3.5,5,6.5]){h.at(elapsed);for(const hand of h.hands()){assert.ok(hand.palmGap>=-.003&&hand.palmGap<=.04,`${elapsed} ${hand.side} palm gap ${hand.palmGap}`);assert.ok(hand.palmNormalY<-.65,`${elapsed} ${hand.side} palm does not face its support`);}}
});
test('chair-reaching hands also clear the delivered body, sleeve and opposite hand',async t=>{
 const h=await constructLesson('neo',t),failures:unknown[]=[];for(const elapsed of [0,.65,1,1.65,3,6.5,7,7.6,8]){h.at(elapsed);const contacts=inspectionBodyCrossings(h.rig);if(contacts.length)failures.push({elapsed,contacts});}assert.deepEqual(failures,[]);
});
test('Morpheus holds the real remote without intersecting his own hand or the casing',async t=>{
 const h=await constructLesson('morpheus',t);for(const elapsed of [0,.5,1,3,7,8,9,11]){h.at(elapsed);const remote=h.remote();assert.equal(remote.self,0,`${elapsed}: actual right hand self contact`);assert.equal(remote.inside,0,`${elapsed}: hand vertices inside the actual remote casing`);assert.equal(remote.propCrossings,0,`${elapsed}: actual casing/buttons cross the real hand`);for(const [digit,gap]of remote.tipGaps.entries())assert.ok(gap<=.04,`${elapsed}: finger ${digit+1} floats ${gap} from the casing`);}
});
test('a cold first-person lesson reconstructs the same hand contacts after seeking',async t=>{
 for(const role of ['neo','morpheus'] as const){
 const warm=await constructLesson(role,t),cold=await constructLesson(role,t);if(role==='morpheus')warm.atArrival(5);warm.at(3);const joints=['shoulder_R','elbow_R','wrist_R','shoulder_L','elbow_L','wrist_L',...Array.from({length:15},(_,i)=>`finger${Math.floor(i/3)+1}-${i%3+1}_R`)],expected=joints.map(n=>warm.rig.bones.get(n)!.quaternion.clone());for(const elapsed of [11,0,7,1])warm.at(elapsed);warm.at(3);cold.at(3,true);for(const h of [warm,cold])joints.forEach((n,i)=>assert.ok(h.rig.bones.get(n)!.quaternion.angleTo(expected[i])<1e-6,`${role} cold ${n}`));
 }

});

test('the playable leather cue places Neo behind the chair with a matching final stance',()=>{
 assert.ok(Math.abs(CONSTRUCT.neo.x-CONSTRUCT.chairX.neo)<CONSTRUCT.chair.width/2,'stand behind the upholstered back, not outside its side');
 assert.ok(CONSTRUCT.neo.z>CONSTRUCT.chair.z+CONSTRUCT.chair.backOffset+CONSTRUCT.chair.depth/2+.45,'the body capsule clears the back of the chair');
 assert.ok(Math.hypot(CONSTRUCT.neo.x-CONSTRUCT.approach.x,CONSTRUCT.neo.z-CONSTRUCT.approach.z)<.15,'ordinary walking reaches the same stance used by the gesture');
 assert.equal(CONSTRUCT.neo.yaw,Math.PI,'the body faces the chair and television');
});

test('Morpheus points the held remote without breaking wrist limits or jumping an arm joint',async t=>{
 const h=await constructLesson('morpheus',t);let maximum=0,jump=0,previous:THREE.Vector3[]|undefined;
 for(let frame=0;frame<=1100;frame++){h.at(frame/100);for(const side of ['R','L'])maximum=Math.max(maximum,wristSwing(h.rig.bones.get(`wrist_${side}`)!));const points=['elbow_R','wrist_R','elbow_L','wrist_L'].map(n=>h.rig.bones.get(n)!.getWorldPosition(new THREE.Vector3()));if(previous)points.forEach((p,i)=>jump=Math.max(jump,p.distanceTo(previous![i])));previous=points;}
 t.diagnostic(JSON.stringify({maximumWristSwing:maximum,largestJointStepPer10ms:jump}));assert.ok(maximum<=70);assert.ok(jump<.05);
});

test('normal elapsed animation retains the actual chair contacts through the full reach and release',async t=>{
 const h=await constructLesson('neo',t),motion=newMotion(),frames=new Set([30,60,100,138,210,300,420,480,540]);
 for(let frame=0;frame<=660;frame++){h.at(frame/60,false,motion,1/60);for(const side of ['R','L'])assert.ok(wristSwing(h.rig.bones.get(`wrist_${side}`)!)<=70);
 if(frames.has(frame)){const hands=h.hands();assert.ok(hands.every(p=>!p.chair&&!p.self),`${frame}: actual moving hand/chair surface`);assert.deepEqual(inspectionBodyCrossings(h.rig),[],`${frame}: actual moving hand/body surface`);if(frame>=138&&frame<=420)assert.ok(hands.every(p=>p.palmGap>=-.003&&p.palmGap<=.04));}
 }
});
