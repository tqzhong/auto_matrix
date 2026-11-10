import * as THREE from 'three';
import { BOOK_DOOR,FILM_SETS,bookDoorPalm,type BookDoorGesture }from '@auto_matrix/shared';
import type { CharacterRig }from './CharacterModel.js';
import { reach }from './SpoonPerformance.js';

export function poseBookDoor(rig:CharacterRig,s?:BookDoorGesture):void{
  if(rig.detail.userData.bookDoorContact){rig.mobilWrists?.[0].quaternion.identity();delete rig.detail.userData.bookDoorContact;}
  if(!s||s.role!=='persephone'||!rig.mobilWrists)return;const palm=bookDoorPalm(s);if(palm.weight<=0)return;
  const c=FILM_SETS[BOOK_DOOR.set].center,wrist=rig.mobilWrists[0],shoulder=rig.shoulders[0],elbow=rig.elbows[0],offset=new THREE.Vector3(0,-.1,.06);
  rig.root.updateWorldMatrix(true,true);const rotation=rig.root.getWorldQuaternion(new THREE.Quaternion()),orientation=rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI));
  const from=wrist.localToWorld(offset.clone()),target=from.lerp(new THREE.Vector3(c.x+palm.x,c.y-1+palm.y,c.z+palm.z),palm.weight);
  reach(shoulder,elbow,wrist.position.clone(),target.sub(offset.applyQuaternion(orientation)),new THREE.Vector3(-.6,-.3,.3).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));rig.fingers[0].forEach(f=>{f.rotation.x=s.phase==='unlatching'?-.4:-.08;});
  rig.detail.userData.bookDoorContact=true;rig.root.updateWorldMatrix(true,true);
}
