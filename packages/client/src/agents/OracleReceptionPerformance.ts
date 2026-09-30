import * as THREE from 'three';
import type { OracleReceptionGesture, OracleWaitingGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export function poseOracleReception(rig: CharacterRig, gesture?: OracleReceptionGesture): void {
  if (!gesture || gesture.phase !== 'inviting' || !gesture.target) return;
  const blend = THREE.MathUtils.smoothstep(gesture.elapsed, 0, .65)
    * (gesture.rising === undefined ? gesture.seated ? 1 : 0 : 1 - THREE.MathUtils.smoothstep(gesture.rising, 0, .85));
  if (!blend) return;
  const target = new THREE.Vector3(gesture.target.x, gesture.target.y, gesture.target.z);
  if (rig.hero) {
    const bones = rig.hero.bones, upper = bones.get('shoulder_R')!, lower = bones.get('elbow_R')!, wrist = bones.get('wrist_R')!;
    rig.root.updateWorldMatrix(true, true);
    const feet = ['R', 'L'].map(side => ({ point: bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()), rotation: bones.get(`ankle_${side}`)!.getWorldQuaternion(new THREE.Quaternion()) }));
    bones.get('pelvis')!.position.y -= .72 * blend;
    bones.get('spine')!.rotation.x += .16 * blend; bones.get('head')!.rotation.x += .13 * blend;
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [i, side] of ['R', 'L'].entries()) {
      const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
      feet[i].point.y += .065 * blend;
      reach(hip, knee, ankle.position, feet[i].point, new THREE.Vector3(i ? .12 : -.12, 0, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(feet[i].rotation.slerp(rotation, blend)));
    }
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, .08)));
    const palm = new THREE.Vector3(0, -.19, .035);
    const point = wrist.localToWorld(palm.clone()).lerp(target, blend).sub(palm.applyQuaternion(orientation));
    reach(upper, lower, wrist.position, point, new THREE.Vector3(-.5, -.75, -.15).applyQuaternion(rotation));
    wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bones.get(`finger${finger}-${segment}_R`)!.rotation.z = finger === 1 ? -.05 : .08;
  } else {
    rig.torso.rotation.x += .14 * blend; rig.head.rotation.x += .12 * blend; rig.root.updateWorldMatrix(true, true);
    const palm = new THREE.Vector3(0, -.79, .055), lower = rig.elbows[0];
    reach(rig.shoulders[0], lower, palm, lower.localToWorld(palm.clone()).lerp(target, blend),
      new THREE.Vector3(-.5, -.75, -.15).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  }
}

export function poseOracleWaiting(rig: CharacterRig, gesture?: OracleWaitingGesture): void {
  if (!gesture) return;
  const t = gesture.elapsed, glance = gesture.kind === 'watching' ? Math.sin(t * .18) * .07 : gesture.kind === 'playing' ? Math.sin(t * .65) * .12 : 0;
  if (rig.hero) {
    const bones = rig.hero.bones;
    if (gesture.kind === 'watching') {
      bones.get('pelvis')!.position.y = 2.05;
      rig.root.updateWorldMatrix(true, true);
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      for (const side of ['R', 'L']) {
        const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
        const foot = rig.root.localToWorld(new THREE.Vector3(hip.position.x, rig.hero.footHeight + .055, .72));
        reach(hip, knee, ankle.position, foot, new THREE.Vector3(0, 0, 1).applyQuaternion(rotation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      }
    }
    bones.get('head')!.rotation.y += glance; return;
  }
  rig.head.rotation.y += glance;
  if (gesture.kind === 'meditating') rig.head.rotation.x += .13;
  if (gesture.kind === 'blocks' || gesture.kind === 'playing') for (let i = 0; i < 2; i++) {
    rig.shoulders[i].rotation.x = gesture.kind === 'blocks' ? -.85 + Math.sin(t * .55 + i) * .055 : -.48 + Math.sin(t * .8 + i * 2) * .16;
    rig.elbows[i].rotation.x = gesture.kind === 'blocks' ? -.8 : -1.25 + Math.cos(t * .8 + i) * .12;
    for (const finger of rig.fingers[i]) finger.rotation.x = -.1;
  }
}
