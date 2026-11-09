import * as THREE from 'three';
import { FILM_SETS, seraphDoorKey, seraphDoorPalm, seraphDoorSet, type SeraphDoorGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export function poseSeraphDoor(rig: CharacterRig, state?: SeraphDoorGesture): void {
  if (rig.detail.userData.seraphDoorContact) { rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity()); delete rig.detail.userData.seraphDoorContact; }
  const props = rig.seraphKey; if (props) props.key.visible = state?.role === 'seraph';
  if (!state || state.role !== 'seraph' || !props) return;
  const center = FILM_SETS[seraphDoorSet(state.scene)].center, key = seraphDoorKey(state), palm = seraphDoorPalm(state);
  rig.root.updateWorldMatrix(true,true);
  if (palm.weight > 0) {
    rig.detail.userData.seraphDoorContact = true;
    const wrist = rig.mobilWrists![0], shoulder = rig.shoulders[0], elbow = rig.elbows[0], offset = new THREE.Vector3(0,-.14,.005);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
    const target = wrist.localToWorld(offset.clone()).lerp(new THREE.Vector3(center.x+palm.x,center.y-1+palm.y,center.z+palm.z),palm.weight);
    reach(shoulder,elbow,wrist.position.clone(),target.sub(offset.applyQuaternion(orientation)),new THREE.Vector3(-.5,-.4,.3).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); rig.fingers[0].forEach(finger => { finger.rotation.x = -.65; });
    rig.root.updateWorldMatrix(true,true);
  }
  props.key.position.copy(rig.detail.worldToLocal(new THREE.Vector3(center.x+key.x,center.y-1+key.y,center.z+key.z)));
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),key.yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),key.turn)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),key.tilt));
  props.key.quaternion.copy(rig.detail.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); rig.root.updateWorldMatrix(true,true);
}
