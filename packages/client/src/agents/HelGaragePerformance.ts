import * as THREE from 'three';
import { FILM_SETS, HEL_GARAGE, helGarageHandle, type HelGarageGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Paired hands use the same saved wrist, gun and door positions as the set. */
export function poseHelGarage(rig: CharacterRig, gesture?: HelGarageGesture): void {
  if (rig.detail.userData.helGarageContact) {
    rig.mobilWrists?.forEach(wrist => wrist.rotation.set(0, 0, 0)); delete rig.detail.userData.helGarageContact;
  }
  if (!gesture) return;
  rig.detail.userData.helGarageContact = true;
  const h = gesture, center = FILM_SETS[HEL_GARAGE.set].center, spot = HEL_GARAGE.pairs[h.pair];
  const point = (x: number, y: number, z: number) => new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z);
  const arm = (i: number, target: THREE.Vector3, flat = false) => {
    const side = i ? 'L' : 'R', shoulder = rig.hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = rig.hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = rig.hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    if (flat) orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const offset = new THREE.Vector3(0, rig.hero ? -.19 : -.14, .005);
    rig.root.updateWorldMatrix(true, true);
    reach(shoulder, elbow, wrist?.position.clone() ?? new THREE.Vector3(0, -.79, .055), wrist ? target.clone().sub(offset.applyQuaternion(orientation)) : target,
      new THREE.Vector3(i ? .5 : -.5, -.5, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    rig.fingers[i].forEach(finger => { finger.rotation.x = flat ? 0 : -.75; });
  };
  const wrist = point(spot.x - .46, 3.05, spot.z + 1.1);
  if (h.role === 'guard') {
    const draw = h.phase === 'drawing' ? THREE.MathUtils.smoothstep(h.elapsed, 0, HEL_GARAGE.drawing) : ['evade', 'counter', 'disarming', 'failed'].includes(h.phase) ? 1 : 0;
    if (draw) arm(0, point(spot.x - .46, 1.65 + draw * 1.4, spot.z + .1 + draw), true);
    if (['combo', 'striking'].includes(h.phase)) { arm(0, point(spot.x - .36, 3.15, spot.z + .7)); arm(1, point(spot.x + .45, 3.2, spot.z + .7)); }
  } else if (h.phase === 'disarming' || h.phase === 'counter') {
    arm(1, wrist, true); arm(0, point(spot.x + .08, 2.7, spot.z + .72));
  } else if (h.phase === 'striking') {
    const t = Math.sin(Math.PI * THREE.MathUtils.clamp(h.elapsed / HEL_GARAGE.strike, 0, 1)), side = h.hits % 2;
    arm(side, point(spot.x + (side ? .2 : -.2), 3.18 + (h.hits === 2 ? .55 : 0), spot.z + 1.25 - t * 1.05));
    arm(1 - side, point(spot.x + (side ? -.38 : .38), 3.15, spot.z + 1.3));
  } else if (h.phase === 'opening' && h.role === 'trinity') {
    const handle = helGarageHandle(h.door);
    if (h.door < .24) arm(0, point(handle.x, handle.y, handle.z), true);
  }
  rig.root.updateWorldMatrix(true, true);
}
