import * as THREE from 'three';
import { FILM_SETS, HEL_ELEVATOR, helElevatorFloor, helElevatorHandle, type HelElevatorGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export function poseHelElevator(rig: CharacterRig, gesture?: HelElevatorGesture): void {
  if (rig.detail.userData.helElevatorContact) {
    rig.mobilWrists?.forEach(wrist => wrist.rotation.set(0, 0, 0)); delete rig.detail.userData.helElevatorContact;
  }
  if (!gesture || gesture.role !== 'trinity') return;
  const pressing = gesture.phase === 'descending' && gesture.elapsed < HEL_ELEVATOR.press;
  const pulling = gesture.phase === 'opening' && gesture.gateElapsed < .58;
  if (!pressing && !pulling) return;
  rig.detail.userData.helElevatorContact = true;
  const center = FILM_SETS.film_club_hel.center;
  const lift = { ...gesture, physical: true, lastTick: 0 };
  const point = pressing ? HEL_ELEVATOR.button : helElevatorHandle(lift);
  const shoulder = rig.hero?.bones.get('shoulder_L') ?? rig.shoulders[1], elbow = rig.hero?.bones.get('elbow_L') ?? rig.elbows[1];
  const wrist = rig.hero?.bones.get('wrist_L') ?? rig.mobilWrists?.[1];
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion())
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const offset = new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005);
  rig.root.updateWorldMatrix(true, true);
  const contact = new THREE.Vector3(center.x + point.x, center.y - 1 + helElevatorFloor(lift) + point.y, center.z + point.z);
  const current = wrist?.localToWorld(offset.clone()) ?? elbow.localToWorld(new THREE.Vector3(0, -.79, .055));
  const enter = THREE.MathUtils.smoothstep(pressing ? gesture.elapsed : gesture.gateElapsed, 0, .18);
  const leave = pressing ? 1 - THREE.MathUtils.smoothstep(gesture.elapsed, .78, HEL_ELEVATOR.press) : 1;
  const target = current.lerp(contact, enter * leave);
  reach(shoulder, elbow, wrist?.position.clone() ?? new THREE.Vector3(0, -.79, .055),
    wrist ? target.sub(offset.applyQuaternion(orientation)) : target,
    new THREE.Vector3(.5, -.55, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  rig.fingers[1].forEach(finger => { finger.rotation.x = pulling ? -.75 : 0; });
  rig.root.updateWorldMatrix(true, true);
}
