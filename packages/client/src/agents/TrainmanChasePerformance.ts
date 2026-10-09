import * as THREE from 'three';
import { FILM_SETS, TRAINMAN_CHASE, type TrainmanChaseGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Hands meet the same emergency handle, vertical rail and gate shown in the set. */
export function poseTrainmanChase(rig: CharacterRig, gesture?: TrainmanChaseGesture): void {
  if (rig.detail.userData.trainmanContact) {
    rig.mobilWrists?.forEach(wrist => wrist.rotation.set(0, 0, 0)); delete rig.detail.userData.trainmanContact;
  }
  if (!gesture) return;
  rig.detail.userData.trainmanContact = true;
  const center = FILM_SETS[TRAINMAN_CHASE.set].center;
  const point = (x: number, y: number, z: number) => new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z);
  rig.root.updateWorldMatrix(true, true);
  const arm = (i: number, target: THREE.Vector3, flat = false) => {
    const side = i ? 'L' : 'R', shoulder = rig.hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = rig.hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = rig.hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const end = wrist?.position.clone() ?? new THREE.Vector3(0, -.79, .055);
    const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    if (flat) orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const offset = new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005);
    reach(shoulder, elbow, end, wrist ? target.clone().sub(offset.clone().applyQuaternion(orientation)) : target,
      new THREE.Vector3(i ? .5 : -.5, -.5, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  };
  if (gesture.role === 'trainman' && gesture.phase === 'braking') {
    const lever = TRAINMAN_CHASE.lever, target = point(lever.x - .13, lever.y, lever.z);
    arm(1, target); rig.fingers[1].forEach(finger => { finger.rotation.x = -.85; });
  } else if (gesture.bracing) {
    const location = rig.root.getWorldPosition(new THREE.Vector3());
    const shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], x = shoulder.getWorldPosition(new THREE.Vector3()).x - center.x;
    const z = [18, 23, 29, 35, 41, 45].reduce((closest, value) => Math.abs(value - location.z + center.z) < Math.abs(closest - location.z + center.z) ? value : closest, 18);
    arm(0, point(x > -30 ? -28.7 : -31.3, 3.65, z));
  }
  if (gesture.vault !== undefined && gesture.phase !== 'crossing') {
    // Plant the palm before takeoff, release it once the body clears the gate.
    if (gesture.vault < .24) {
      arm(0, point(0, TRAINMAN_CHASE.upper + TRAINMAN_CHASE.gate.height + .06, TRAINMAN_CHASE.gate.z), true);
      rig.fingers[0].forEach(finger => { finger.rotation.x = 0; });
    }
  }
  if (gesture.role === 'trainman' && ['confronting', 'cover'].includes(gesture.phase) && rig.weapons?.[0]) {
    const raise = gesture.phase === 'cover' ? 1 : THREE.MathUtils.smoothstep(gesture.elapsed, 1.4, 2.1);
    const shoulder = rig.shoulders[0], elbow = rig.elbows[0]; shoulder.rotation.set(-1.4 * raise + (gesture.recoil ?? 0) * .12, 0, -.1);
    elbow.rotation.set(-.21 * raise, 0, 0);
    const gun = rig.weapons[0]; gun.rotation.set(0, 0, 0);
    if (rig.mobilWrists) {
      rig.mobilWrists[0].rotation.set(0, 0, 0); rig.mobilWrists[0].updateWorldMatrix(true, true);
      gun.position.copy(elbow.worldToLocal(rig.mobilWrists[0].localToWorld(new THREE.Vector3(0, -.13, .035))));
    }
  }
  rig.root.updateWorldMatrix(true, true);
}
