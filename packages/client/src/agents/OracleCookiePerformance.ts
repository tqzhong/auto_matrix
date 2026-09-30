import * as THREE from 'three';
import { FILM_SETS, ORACLE_COOKIE, type OracleVisitGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export function cookiePinch(rig: CharacterRig): THREE.Vector3 {
  if (!rig.hero) return new THREE.Vector3(0, -.79, .055);
  const bones = rig.hero.bones, hand = bones.get('wrist_R')!;
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${finger}-${segment}_R`)!.rotation.z = finger === 1 ? segment === 1 ? -.28 : .35 : segment === 1 ? .5 : .75;
  hand.updateWorldMatrix(true, true);
  return hand.worldToLocal(bones.get('finger1-3_R')!.localToWorld(new THREE.Vector3(.02, -.02, .012))
    .lerp(bones.get('finger2-3_R')!.localToWorld(new THREE.Vector3(.015, -.015, 0)), .5));
}

export function holdOracleCookie(rig: CharacterRig, pinch: THREE.Vector3, edge: THREE.Vector3, rotation = new THREE.Quaternion()): void {
  if (!rig.cookie) return;
  const hand = rig.hero?.bones.get('wrist_R') ?? rig.elbows[0], cookie = rig.cookie;
  if (cookie.parent !== hand) hand.add(cookie);
  const grip = hand.localToWorld(pinch.clone()).sub(edge);
  cookie.position.copy(hand.worldToLocal(grip));
  cookie.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  cookie.scale.set(1, 1, 1).divide(hand.getWorldScale(new THREE.Vector3()));
}

export function poseOracleCookie(rig: CharacterRig, gesture?: OracleVisitGesture): void {
  if (!gesture || gesture.phase === 'waiting') return;
  const t = gesture.phase === 'examining' ? gesture.elapsed : 10.8;
  if (t < 7.2) return;
  const blend = gesture.role === 'oracle'
    ? THREE.MathUtils.smoothstep(t, 7.2, 8.65) * (1 - THREE.MathUtils.smoothstep(t, ORACLE_COOKIE.transfer, 9.85))
    : THREE.MathUtils.smoothstep(t, 8.2, ORACLE_COOKIE.transfer) * (1 - THREE.MathUtils.smoothstep(t, ORACLE_COOKIE.transfer, 10.8));
  const center = FILM_SETS.film_oracle_home.center, point = ORACLE_COOKIE.contact;
  const contact = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
  const edge = new THREE.Vector3(gesture.role === 'neo' ? .1 : -.1, 0, 0);
  rig.root.updateWorldMatrix(true, true);
  const upper = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], lower = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const hand = rig.hero?.bones.get('wrist_R') ?? lower;
  const pinch = cookiePinch(rig);
  if (blend > 0) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    if (rig.hero) {
      const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, gesture.role === 'neo' ? -Math.PI / 2 : Math.PI / 2, 0)), blend);
      const target = hand.localToWorld(pinch.clone()).lerp(contact.clone().add(edge), blend)
        .sub(pinch.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
      reach(upper, lower, hand.position, target, new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rotation));
      hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    } else {
      reach(upper, lower, pinch, hand.localToWorld(pinch.clone()).lerp(contact.clone().add(edge), blend),
        new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rotation));
    }
    hand.updateWorldMatrix(false, true);
  }
  holdOracleCookie(rig, pinch, edge);
}
