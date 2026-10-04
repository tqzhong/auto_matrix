import * as THREE from 'three';
import { smithFinalePose, type SmithFinaleEncounter } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

export function poseSmithFinaleContact(neo: HeroRig, smith: HeroRig, encounter: SmithFinaleEncounter): void {
  if (encounter.phase !== 'ground_counter' && encounter.phase !== 'shockwave') return;
  const blend = smithFinalePose(encounter).strike;
  if (blend < .00001) return;
  const side = encounter.hits % 2 ? 'R' : 'L', sign = side === 'R' ? 1 : -1;
  neo.root.updateWorldMatrix(true, true); smith.root.updateWorldMatrix(true, true);
  const chest = smith.bones.get('chest')!;
  // The delivered suit front is z=.46212/.46136 here; leave .01 outside its surface.
  const contact = chest.localToWorld(new THREE.Vector3(sign * .2, .15, side === 'R' ? .4722 : .4714));
  const shoulder = neo.bones.get(`shoulder_${side}`)!, elbow = neo.bones.get(`elbow_${side}`)!, wrist = neo.bones.get(`wrist_${side}`)!;
  const shoulderBase = shoulder.quaternion.clone(), elbowBase = elbow.quaternion.clone();
  const rotation = neo.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), blend);
  // Skin samples of the closed knuckles extend .32452 from the wrist along -Y.
  const knuckles = new THREE.Vector3(sign * .08182, -.326, 0);
  const target = wrist.localToWorld(knuckles.clone()).lerp(contact, blend).sub(knuckles.applyQuaternion(orientation));
  reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-sign, -.4, .2).applyQuaternion(rotation));
  shoulder.quaternion.copy(shoulderBase.slerp(shoulder.quaternion, blend));
  elbow.quaternion.copy(elbowBase.slerp(elbow.quaternion, blend));
  shoulder.updateWorldMatrix(false, true);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  wrist.updateWorldMatrix(false, true);
}
