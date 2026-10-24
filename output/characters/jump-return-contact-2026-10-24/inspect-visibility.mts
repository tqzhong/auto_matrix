import * as THREE from 'three';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { handSurface } from './candidate-release/tests/helpers/hand-surface.mjs';
import { advanceMotion,newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
const h=await actor('neo'), hand=handSurface(h.rig,'R');
for(const elapsed of [4.5,6.6]){
const motion=newMotion(),input={speed:0,grounded:true,verticalVelocity:0,turn:0,seated:true,realWorld:true,nebCrew:'neo',nebCrewEarly:true,training:{kind:'jump_return' as const,role:'neo' as const,elapsed}};
h.models.animate(h.rig,advanceMotion(motion,input,0),motion,input,0);h.rig.root.updateMatrixWorld(true);hand.group.skin.skeleton.update();
const blood=h.rig.root.getObjectByName('jump-thumb-blood')!, head=h.rig.bones.get('head')!, point=blood.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).applyQuaternion(blood.getWorldQuaternion(new THREE.Quaternion()));
const eye=head.localToWorld(new THREE.Vector3(0,0,.23)),direction=point.clone().sub(eye).normalize(),ray=new THREE.Ray(eye,direction),hit=new THREE.Vector3();
let first=Infinity;
for(const f of hand.triangles){const p=f.ids.map(i=>hand.group.skin.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(hand.group.skin.matrixWorld));if(ray.intersectTriangle(p[0],p[1],p[2],false,hit))first=Math.min(first,hit.distanceTo(eye));}
console.log(JSON.stringify({elapsed,blood:head.worldToLocal(point.clone()).toArray(),normal:normal.toArray(),normalFacesEye:normal.dot(direction.clone().negate()),distanceToBlood:eye.distanceTo(point),firstSkinDistance:first,occlusion:eye.distanceTo(point)-first}));}
h.models.dispose();
