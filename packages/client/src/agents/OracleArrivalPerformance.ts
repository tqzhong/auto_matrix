import * as THREE from 'three';
import { FILM_SETS, oracleArrivalDoor, oracleArrivalHandle, type OracleArrivalGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { poseOracleDeparture } from './OracleDeparturePerformance.js';
import { reach } from './SpoonPerformance.js';

export function poseOracleArrival(rig: CharacterRig, gesture?: OracleArrivalGesture): void {
  if (!gesture) return;
  if (gesture.role === 'morpheus') {
    if (gesture.seating > 0) poseOracleDeparture(rig, { phase: 'ready', elapsed: 0, rise: 2.2 - gesture.seating, role: 'morpheus' });
    return;
  }
  if (gesture.phase !== 'opening') return;
  const blend = THREE.MathUtils.smoothstep(gesture.elapsed, 0, .35) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 1.65, 1.8));
  if (!blend) return;
  const handle = oracleArrivalHandle(gesture), angle = oracleArrivalDoor(gesture), center = FILM_SETS.film_oracle_home.center;
  const target = new THREE.Vector3(center.x + handle.x - .13 * Math.sin(angle), center.y - 1 + handle.y, center.z + handle.z - .13 * Math.cos(angle));
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  if (rig.hero) {
    const bones = rig.hero.bones, upper = bones.get('shoulder_R')!, lower = bones.get('elbow_R')!, hand = bones.get('wrist_R')!;
    const palm = new THREE.Vector3(0, -.19, .035);
    rig.root.updateWorldMatrix(true, true);
    const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, .08))), blend);
    const contact = hand.localToWorld(palm.clone()).lerp(target, blend).sub(palm.multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
    reach(upper, lower, hand.position, contact, new THREE.Vector3(-.7, -.7, -.2).applyQuaternion(rotation));
    hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bones.get(`finger${finger}-${segment}_R`)!.rotation.z = (finger === 1 ? -.26 : .34) * blend;
  } else {
    const palm = new THREE.Vector3(0, -.79, .055), lower = rig.elbows[0];
    rig.root.updateWorldMatrix(true, true);
    reach(rig.shoulders[0], lower, palm, lower.localToWorld(palm.clone()).lerp(target, blend), new THREE.Vector3(-.7, -.7, -.2).applyQuaternion(rotation));
  }
}
