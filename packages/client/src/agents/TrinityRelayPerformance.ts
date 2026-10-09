import * as THREE from 'three';
import { trinityRelaySeat, type TrinityRelayGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';
import { reach } from './SpoonPerformance.js';

/** Use the existing ship cushions and footrests for both delivered skeletons. */
export function poseTrinityRelay(rig: CharacterRig, gesture?: TrinityRelayGesture): void {
  if (!gesture || !rig.hero) return;
  const hero = rig.hero, b = hero.bones, pelvis = b.get('pelvis')!;
  const seat = trinityRelaySeat(gesture);
  if (!seat) {
    if (gesture.role === 'link' && ['connecting', 'connected'].includes(gesture.phase)) {
      const plug = THREE.MathUtils.smoothstep(gesture.elapsed, 13.2, 14.4) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 15.8, 16.5));
      b.get('spine')!.rotation.x += .18 * plug; b.get('chest')!.rotation.x += .22 * plug;
      b.get('head')!.rotation.x -= .25 * plug;
      rig.root.updateWorldMatrix(true, true);
    }
    return;
  }
  pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, 1.56, seat);
  pelvis.position.z = THREE.MathUtils.lerp(pelvis.position.z, -.23, seat);
  b.get('spine')!.rotation.x = THREE.MathUtils.lerp(b.get('spine')!.rotation.x, -.22, seat);
  b.get('chest')!.rotation.x = THREE.MathUtils.lerp(b.get('chest')!.rotation.x, -.12, seat);
  b.get('head')!.rotation.x = THREE.MathUtils.lerp(b.get('head')!.rotation.x, .12, seat);
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1, hip = b.get(`hip_${side}`)!, knee = b.get(`knee_${side}`)!, ankle = b.get(`ankle_${side}`)!;
    // Their delivered soles have different offsets from the ankle joint.
    const foot = hero.root.localToWorld(new THREE.Vector3(sign * .45, (gesture.role === 'link' ? .21 : .13) + hero.footHeight, 1.45));
    const target = ankle.getWorldPosition(new THREE.Vector3()).lerp(foot, seat);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .3, -.2, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    ankle.updateWorldMatrix(false, true);
    const wrist = b.get(`wrist_${side}`)!;
    const palm = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
    crosscutPalm(rig, side, palm.lerp(rig.root.localToWorld(new THREE.Vector3(sign * .87, 1.83, .1)), seat));
  }
}

/** Link reaches the rendered connector, so the hand and plug share one contact point. */
export function relayPlugContact(body: THREE.Object3D, point: THREE.Vector3, blend: number): void {
  if (!blend) return;
  const shoulder = body.getObjectByName('shoulder_R') as THREE.Bone;
  const elbow = body.getObjectByName('elbow_R') as THREE.Bone, wrist = body.getObjectByName('wrist_R') as THREE.Bone;
  if (!shoulder || !elbow || !wrist) return;
  body.updateWorldMatrix(true, true);
  const rotation = body.getWorldQuaternion(new THREE.Quaternion());
  const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)));
  const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
  const target = wrist.localToWorld(new THREE.Vector3(0, -.19, .035)).lerp(point, blend).sub(palm);
  reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-.4, -.8, -.3).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const bone = body.getObjectByName(`finger${finger}-${segment}_R`) as THREE.Bone;
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, finger === 1 ? .2 : .5, blend);
  }
  wrist.updateWorldMatrix(false, true);
}
