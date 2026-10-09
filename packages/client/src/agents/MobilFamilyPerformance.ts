import * as THREE from 'three';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { reach } from './SpoonPerformance.js';

function restHand(rig: CharacterRig, side: number, contact: THREE.Vector3, orientation: THREE.Quaternion, pole: THREE.Vector3): void {
  const wrist = rig.mobilWrists![side], palm = new THREE.Vector3(0, -.14, -.05);
  const target = contact.clone().sub(palm.applyQuaternion(orientation));
  reach(rig.shoulders[side], rig.elbows[side], wrist.position, target, pole);
  wrist.quaternion.copy(rig.elbows[side].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  wrist.updateWorldMatrix(false, true);
}

export function poseMobilFamily(rig: CharacterRig, gesture?: MotionInput['mobilFamily']): void {
  rig.mobilWrists?.forEach(wrist => wrist.rotation.set(0, 0, 0));
  if (!gesture) return;
  rig.root.updateWorldMatrix(true, true);
  const head = rig.hero?.bones.get('head') ?? rig.head;
  const local = head.parent!.worldToLocal(new THREE.Vector3(gesture.look.x, gesture.look.y, gesture.look.z)).sub(head.position);
  head.rotation.y = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -.62, .62);
  head.rotation.x = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.3, .24);
  const speaking = gesture.phase === 'hearing' && gesture.speaker === gesture.role;
  head.rotation.x += speaking ? Math.sin(gesture.elapsed * 2.1) * .025 : 0;
  if (gesture.role === 'neo' || rig.hero) return;
  if (gesture.role === 'kamala') {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    for (const side of [0, 1]) {
      const lap = rig.hips[side].getWorldPosition(new THREE.Vector3()).lerp(rig.knees[side].getWorldPosition(new THREE.Vector3()), .43);
      lap.y += .28; lap.add(new THREE.Vector3(side ? .12 : -.12, 0, 0).applyQuaternion(rotation));
      restHand(rig, side, lap, orientation, new THREE.Vector3(side ? .7 : -.7, -.2, .3).applyQuaternion(rotation));
      for (const finger of rig.fingers[side]) finger.rotation.x = -.2;
    }
  } else if (gesture.role === 'rama_kandra') {
    const amount = speaking ? Math.sin(Math.min(1, gesture.elapsed / .6) * Math.PI / 2) * .22 : 0;
    rig.shoulders[0].rotation.x -= amount;
    rig.elbows[0].rotation.x -= amount * 1.6;
    for (const finger of rig.fingers[0]) finger.rotation.x = -.18;
  }
  rig.root.updateWorldMatrix(true, true);
}

/** Rama keeps a real hand on his daughter's near shoulder while they wait. */
export function contactMobilFamily(rama: CharacterRig, sati: CharacterRig): void {
  rama.root.updateWorldMatrix(true, true); sati.root.updateWorldMatrix(true, true);
  const contact = sati.shoulders[0].localToWorld(new THREE.Vector3(-.045, .225, .005));
  const rotation = rama.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  restHand(rama, 1, contact, orientation, new THREE.Vector3(.7, -.35, .2).applyQuaternion(rotation));
  for (const finger of rama.fingers[1]) finger.rotation.x = -.25;
  rama.root.updateWorldMatrix(true, true);
}
