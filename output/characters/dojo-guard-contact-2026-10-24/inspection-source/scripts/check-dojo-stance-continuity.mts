import * as THREE from 'three';
import { actor } from '../tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion,newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { MELEE_COMBO,COMBAT_SKILLS } from '@auto_matrix/shared';
for(const id of ['neo','morpheus'] as const){
 const h=await actor(id),input={speed:0,grounded:true,verticalVelocity:0,turn:0,dojoOutfit:id,dojoSparring:true};
 const names=['hip_R','knee_R','ankle_R','hip_L','knee_L','ankle_L','shoulder_R','elbow_R','wrist_R','shoulder_L','elbow_L','wrist_L'];
 const tracks=[...MELEE_COMBO.map((strike,combo)=>({name:'combo-'+combo,end:strike.duration+.3,make:(time:number)=>Object.assign(newMotion(),{combo,attackAge:time})})),{name:'dodge',end:COMBAT_SKILLS.dodge.duration+.35,make:(time:number)=>Object.assign(newMotion(),{skill:'dodge',skillAge:time})},{name:'walk',end:2.5,make:(time:number)=>Object.assign(newMotion(),{speed:time})}];
 for(const track of tracks){let previous:{name:string;q:THREE.Quaternion;p:THREE.Vector3}[]|undefined;let maxAngle={amount:0,name:'',at:0},maxDistance={amount:0,name:'',at:0};
  for(let frame=0;frame<=Math.ceil(track.end*120);frame++){
   const time=frame/120,motion=track.make(time),moving={...input,speed:motion.speed};h.models.animate(h.rig,advanceMotion(motion,moving,0),motion,moving,0);h.rig.root.updateMatrixWorld(true);
   const bones=names.map(name=>{const b=h.rig.bones.get(name)!;return{name,q:b.quaternion.clone(),p:b.getWorldPosition(new THREE.Vector3())}});
   if(previous)bones.forEach((b,i)=>{const angle=b.q.angleTo(previous![i].q),distance=b.p.distanceTo(previous![i].p);if(angle>maxAngle.amount)maxAngle={amount:angle,name:b.name,at:time};if(distance>maxDistance.amount)maxDistance={amount:distance,name:b.name,at:time};});previous=bones;
  }
  console.log(JSON.stringify({id,track:track.name,maxAngle,maxDistance}));
 }
 h.models.dispose();
}
