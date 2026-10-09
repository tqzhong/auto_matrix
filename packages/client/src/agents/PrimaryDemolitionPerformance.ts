import * as THREE from 'three';
import { FILM_SETS, PRIMARY_DEMOLITION, primaryMountPoint, primaryWatchAmount, type PrimaryDemolition } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Both palms carry the same saved-clock device shown by the power hall renderer. */
export function posePrimaryDemolition(rig: CharacterRig, state?: PrimaryDemolition): void {
  if (state?.blast && rig.hero) {
    const amount = primaryWatchAmount(state);
    if (amount > 0) {
      rig.root.updateMatrixWorld(true);
      const shoulder = rig.hero.bones.get('shoulder_L')!, elbow = rig.hero.bones.get('elbow_L')!, wrist = rig.hero.bones.get('wrist_L')!;
      const origin = wrist.getWorldPosition(new THREE.Vector3()), target = rig.root.localToWorld(new THREE.Vector3(.08, 2.5, .55));
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      const watchRotation = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2)));
      const wristRotation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(watchRotation, amount);
      reach(shoulder, elbow, wrist.position, origin.lerp(target, amount), new THREE.Vector3(.9, -.3, -.25).applyQuaternion(rotation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wristRotation));
      rig.hero.bones.get('head')!.rotation.x += .22 * amount;
    }
    const hand = rig.root.getObjectByName('primary-watch-second');
    if (hand) hand.rotation.z = -(54 + (state.blast.phase === 'countdown' ? state.blast.elapsed : 6)) / 60 * Math.PI * 2;
    rig.root.updateMatrixWorld(true); return;
  }
  if (state?.phase !== 'mounting') return;
  const site = PRIMARY_DEMOLITION.sites[state.selected!], point = primaryMountPoint(state), center = FILM_SETS.film_power_station.center;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()); rig.root.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, side = i ? 'L' : 'R';
    const hand = new THREE.Vector3(center.x + point.x + Math.cos(site.yaw) * sign * .31 - Math.sin(site.yaw) * .12,
      center.y - 1 + point.y - .08, center.z + point.z - Math.sin(site.yaw) * sign * .31 - Math.cos(site.yaw) * .12);
    if (rig.hero) {
      const shoulder = rig.hero.bones.get(`shoulder_${side}`)!, elbow = rig.hero.bones.get(`elbow_${side}`)!, wrist = rig.hero.bones.get(`wrist_${side}`)!;
      reach(shoulder, elbow, wrist.position, hand.sub(new THREE.Vector3(i ? -.13 : .13, -.18, .02).applyQuaternion(rotation)),
        new THREE.Vector3(sign * .9, -.5, -.3).applyQuaternion(rotation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    } else {
      reach(rig.shoulders[i], rig.elbows[i], new THREE.Vector3(0, -.79, .055), hand,
        new THREE.Vector3(sign * .9, -.5, -.3).applyQuaternion(rotation));
      rig.fingers[i].forEach(finger => { finger.rotation.x = -.16; });
    }
  }
  rig.root.updateMatrixWorld(true);
}
