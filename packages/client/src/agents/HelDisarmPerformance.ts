import * as THREE from 'three';
import { FILM_SETS, HEL_DISARM, helDisarmGun, helSoleFloor, type HelDisarmGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { poseHelPistol } from './HelCoatcheckPerformance.js';
import { reach } from './SpoonPerformance.js';

export function poseHelDisarm(rig: CharacterRig, gesture?: HelDisarmGesture): void {
  if (!gesture) return;
  const shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], elbow = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists?.[0], gun = rig.weapons?.[0]; if (!wrist || !gun) return;
  const t = gesture.elapsed, lower = THREE.MathUtils.smoothstep(t, 0, HEL_DISARM.release), retract = THREE.MathUtils.smoothstep(t, HEL_DISARM.release, HEL_DISARM.release + 1.1);
  rig.root.updateMatrixWorld(true);
  const center = FILM_SETS.film_club_hel.center, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const [i, side] of ['R', 'L'].entries()) {
    const hip = rig.hero?.bones.get('hip_' + side) ?? rig.hips[i], knee = rig.hero?.bones.get('knee_' + side) ?? rig.knees[i];
    const ankle = rig.hero?.bones.get('ankle_' + side) ?? rig.ankles[i], target = ankle.getWorldPosition(new THREE.Vector3());
    const support = helSoleFloor(target.x - center.x, target.z - center.z, gesture.starts[gesture.role].yaw);
    target.y += support - gesture.starts[gesture.role].y;
    reach(hip, knee, ankle.position.clone(), target, new THREE.Vector3(i ? .2 : -.2, .3, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }
  rig.root.updateMatrixWorld(true);
  const resting = wrist.getWorldPosition(new THREE.Vector3()), restRotation = wrist.getWorldQuaternion(new THREE.Quaternion());
  poseHelPistol(rig, 0); rig.root.updateMatrixWorld(true);
  const release = helDisarmGun({ ...gesture, elapsed: HEL_DISARM.release }, gesture.role);
  const orientation = gun.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(release.pitch, release.yaw, 0, 'YXZ')), lower);
  const scale = wrist.getWorldScale(new THREE.Vector3()), target = gun.getWorldPosition(new THREE.Vector3())
    .lerp(new THREE.Vector3(center.x + release.x, center.y - 1 + release.y, center.z + release.z), lower)
    .sub(gun.position.clone().multiply(scale).applyQuaternion(orientation)).lerp(resting, retract);
  orientation.slerp(restRotation, retract);
  reach(shoulder, elbow, wrist.position.clone(), target, new THREE.Vector3(-.4, -.8, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  const grip = 1 - THREE.MathUtils.smoothstep(t, HEL_DISARM.release, HEL_DISARM.release + .25);
  if (rig.hero) for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) {
    const joint = rig.hero.bones.get(`finger${f}-${s}_R`)!; joint.rotation.x *= grip; joint.rotation.y *= grip; joint.rotation.z *= grip;
  }
  else rig.fingers[0].forEach(finger => { finger.rotation.x *= grip; });
  gun.visible = t < HEL_DISARM.release; rig.root.updateMatrixWorld(true);
}
