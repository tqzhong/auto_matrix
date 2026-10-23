import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { truthGround } from './helpers/truth-ground.mjs';
import { wristSwing } from './helpers/core-connector.mjs';

test('Neo braces his fall with anatomically limited wrists throughout disconnection and collapse',async t=>{
 const h=await truthGround(t);let maximum=0,jump=0,previous:THREE.Vector3[]|undefined;
 for(let frame=0;frame<=1400;frame++){h.at(frame/100);for(const side of ['R','L'])maximum=Math.max(maximum,wristSwing(h.rig.bones.get(`wrist_${side}`)!));const points=['elbow_R','wrist_R','elbow_L','wrist_L'].map(name=>h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));if(previous)points.forEach((p,i)=>jump=Math.max(jump,p.distanceTo(previous![i])));previous=points;}
 t.diagnostic(JSON.stringify({maximumWristSwing:maximum,largestJointStepPer10ms:jump}));assert.ok(maximum<=70);assert.ok(jump<.05);
});
test('both real palmar skin patches bear on the deck with all fingers above the floor',async t=>{
 const h=await truthGround(t);for(const elapsed of [10.8,11.4,12.3,13.9]){h.at(elapsed);const hands=h.hands();t.diagnostic(JSON.stringify({elapsed,hands}));for(const hand of hands){assert.ok(hand.palmGap>=0&&hand.palmGap<=.04,`${elapsed} ${hand.side} actual palm gap ${hand.palmGap}`);assert.ok(hand.palmNormalY<-.9,`${elapsed} ${hand.side} palm must face the deck`);assert.ok(hand.minimum>=-.003,`${elapsed} ${hand.side} complete skin below floor ${hand.minimum}`);assert.equal(hand.self,0);}}
});
test('both complete hands clear their skin and the delivered ship garments during the fall',async t=>{
 const h=await truthGround(t);for(const elapsed of [0,3,5,7.5,8.3,9,9.7,10.2,10.8,13.9]){h.at(elapsed);assert.deepEqual(h.body(),[],`${elapsed} complete hand and visible wardrobe intersection`);assert.ok(h.hands().every(hand=>hand.self===0));}
});
test('kneeling support keeps the actual visible body and clothing above the deck',async t=>{
 const h=await truthGround(t);for(const elapsed of [8,8.7,9.4,10.1,10.8,13.9]){h.at(elapsed);const surfaces=h.floorSurfaces();t.diagnostic(JSON.stringify({elapsed,surfaces}));assert.ok(surfaces.every(surface=>surface.minimum>=-.003),`${elapsed} a delivered surface passes through the deck`);}
});
test('cold first person reconstruction preserves the same fall and support as normal animation',async t=>{
 const warm=await truthGround(t),cold=await truthGround(t),motion=newMotion(),joints=['pelvis','shoulder_R','elbow_R','wrist_R','shoulder_L','elbow_L','wrist_L',...Array.from({length:30},(_,i)=>`finger${Math.floor((i%15)/3)+1}-${i%3+1}_${i<15?'R':'L'}`)];
 for(let frame=0;frame<=840;frame++){warm.at(frame/60,false,motion,1/60);if([150,300,480,555,600,648,750,840].includes(frame)){cold.at(frame/60,true);for(const name of joints){const a=warm.rig.bones.get(name)!,b=cold.rig.bones.get(name)!;assert.ok(a.quaternion.angleTo(b.quaternion)<1e-6,`${frame} ${name} rotation`);assert.ok(a.position.distanceTo(b.position)<1e-8,`${frame} ${name} position`);}}}
});
test('Neo ship cuffs follow the forearms instead of being dragged by individual fingers',async t=>{
 const h=await truthGround(t);h.at(11);const sleeve=h.rig.root.getObjectByName('neo-logos-sweater')as THREE.SkinnedMesh;
 const points=()=>{sleeve.skeleton.update();return Array.from({length:sleeve.geometry.attributes.position.count},(_,id)=>sleeve.getVertexPosition(id,new THREE.Vector3()));};
 const before=points();for(const side of ['R','L'])for(let finger=1;finger<=5;finger++)for(let joint=1;joint<=3;joint++)h.rig.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(.3,.2,.6);
 h.rig.root.updateMatrixWorld(true);const maximum=Math.max(...points().map((p,i)=>p.distanceTo(before[i])));t.diagnostic(JSON.stringify({largestFingerDrivenCuffDisplacement:maximum}));assert.ok(maximum<1e-6);
});
