import * as THREE from 'three';
import type { OracleDepartureGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { cookiePinch, holdOracleCookie, poseOracleCookie } from './OracleCookiePerformance.js';
import { reach } from './SpoonPerformance.js';

export function poseOracleDeparture(rig: CharacterRig, gesture?: OracleDepartureGesture): void {
  if (!gesture) return;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  if (gesture.role === 'morpheus') {
    if (rig.hero) {
      const bones = rig.hero.bones, standing = THREE.MathUtils.smoothstep(gesture.rise, 0, 2.2);
      bones.get('pelvis')!.position.y = THREE.MathUtils.lerp(2.05, rig.hero.rest.get('pelvis')!.y, standing);
      bones.get('spine')!.rotation.x += Math.sin(standing * Math.PI) * .22;
      rig.root.updateWorldMatrix(true, true);
      for (const side of ['R', 'L']) {
        const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
        const foot = rig.root.localToWorld(new THREE.Vector3(hip.position.x, rig.hero.footHeight + .055, .72 * (1 - standing)));
        reach(hip, knee, ankle.position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(rotation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      }
      if (gesture.phase === 'talking' && gesture.target) {
        const blend = THREE.MathUtils.smoothstep(gesture.elapsed, .9, 2) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 4.8, 6.1));
        const upper = bones.get('shoulder_R')!, lower = bones.get('elbow_R')!, hand = bones.get('wrist_R')!;
        const palm = new THREE.Vector3(0, -.19, .035);
        const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, .08))), blend);
        const target = hand.localToWorld(palm.clone()).lerp(new THREE.Vector3(gesture.target.x, gesture.target.y, gesture.target.z), blend)
          .sub(palm.multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
        reach(upper, lower, hand.position, target, new THREE.Vector3(-.5, -.75, -.15).applyQuaternion(rotation));
        hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
        for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
          bones.get(`finger${finger}-${segment}_R`)!.rotation.z = finger === 1 ? -.05 : .08;
      }
    }
    return;
  }
  poseOracleCookie(rig, { phase: 'done', elapsed: 0, role: 'neo' });
  if (gesture.phase !== 'biting') return;
  const lift = THREE.MathUtils.smoothstep(gesture.elapsed, .25, 1.2) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 1.9, 2.75));
  const head = rig.hero?.bones.get('head') ?? rig.head;
  head.rotation.x += Math.sin(Math.min(1, gesture.elapsed / .8) * Math.PI) * .1;
  rig.root.updateWorldMatrix(true, true);
  const mouth = head.localToWorld(new THREE.Vector3(0, -.12, .24));
  const pinch = cookiePinch(rig), upper = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], lower = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const hand = rig.hero?.bones.get('wrist_R') ?? lower;
  const cookieRotation = new THREE.Quaternion().slerp(rotation, lift), edge = new THREE.Vector3(.1, 0, 0).applyQuaternion(cookieRotation);
  const bite = THREE.MathUtils.smoothstep(gesture.elapsed, 1.32, 1.5);
  const contact = mouth.sub(new THREE.Vector3(0, THREE.MathUtils.lerp(.115, .075, bite), 0)).add(edge);
  const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, -Math.PI / 2, 0))), lift);
  const point = hand.localToWorld(pinch.clone()).lerp(contact, lift);
  if (rig.hero) {
    reach(upper, lower, hand.position, point.sub(pinch.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation)), new THREE.Vector3(-.6, -.8, .15).applyQuaternion(rotation));
    hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  } else reach(upper, lower, pinch, point, new THREE.Vector3(-.6, -.8, .15).applyQuaternion(rotation));
  hand.updateWorldMatrix(false, true);
  holdOracleCookie(rig, pinch, edge, cookieRotation);
}
