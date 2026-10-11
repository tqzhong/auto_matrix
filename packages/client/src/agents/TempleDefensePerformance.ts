import * as THREE from 'three';
import { FILM_SETS, templeWheelHands, type TempleDefenseGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { poseDockBriefing } from './DockBriefingPerformance.js';
import { poseDockReunion } from './DockReunionPerformance.js';

export function poseTempleDefense(rig: CharacterRig, gesture?: TempleDefenseGesture, partner?: CharacterRig): void {
  if (!gesture) return;
  if (gesture.role === 'lock') {
    poseDockBriefing(rig, { role: 'lock', phase: gesture.phase === 'orders' ? 'warning' : 'ready', elapsed: gesture.elapsed, escort: 0 });
    const head = rig.hero?.bones.get('head') ?? rig.head;
    if (gesture.phase === 'orders') {
      const line = gesture.elapsed < 2.8 ? 0 : gesture.elapsed < 5.4 ? 1 : 2;
      const age = gesture.elapsed - [0, 2.8, 5.4][line], pulse = Math.sin(Math.min(1, age / [2.8, 2.6, 2.8][line]) * Math.PI);
      head.rotation.y = (line === 2 ? -.28 : .25) * pulse;
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      for (let i = 0; i < 2; i++) {
        const sign = i ? 1 : -1, side = i ? 'L' : 'R', pointing = line === 1 || i === (line === 2 ? 1 : 0) ? pulse : 0;
        const hand = rig.root.localToWorld(new THREE.Vector3(sign * (.64 + pointing * .2), 1.84 + pointing * 1.02, .1 + pointing * .83));
        const shoulder = rig.hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = rig.hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
        const wrist = rig.hero?.bones.get(`wrist_${side}`);
        if (wrist) hand.sub(new THREE.Vector3(-sign * .13, -.18, .02).applyQuaternion(rotation));
        reach(shoulder, elbow, wrist?.position ?? new THREE.Vector3(0, -.79, .055), hand, new THREE.Vector3(sign * .9, -.4, -.3).applyQuaternion(rotation));
        if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      }
    } else if (gesture.phase === 'breach') head.rotation.x = -.35 * THREE.MathUtils.smoothstep(gesture.elapsed, 0, 1.2);
    rig.root.updateMatrixWorld(true);
    return;
  }
  if (['breach', 'waiting', 'done'].includes(gesture.phase) && (gesture.role === 'link' || gesture.role === 'zee')) {
    const elapsed = gesture.phase === 'breach' ? Math.min(1.4, gesture.elapsed) : 1.4;
    // The film's couple stays standing. Reuse the delivered back/sole contacts,
    // without replaying the dock's kiss or dropping the embrace at the handoff.
    poseDockReunion(rig, { role: gesture.role, phase: 'embrace', elapsed, floor: 0 }, partner);
    const gaze = THREE.MathUtils.smoothstep(elapsed, 0, 1.4), head = rig.hero?.bones.get('head') ?? rig.head;
    head.rotation.set(gesture.role === 'link' ? -.13 * gaze : .06, gesture.role === 'link' ? .8 * gaze : -.2 * gaze, -.04 * gaze);
    rig.root.updateMatrixWorld(true); return;
  }
  const crew = (gesture.role === 'citizen_15' || gesture.role === 'citizen_16') && ['orders', 'breach', 'waiting', 'done'].includes(gesture.phase);
  if ((!crew && (gesture.role !== 'zee' || gesture.phase !== 'mounting')) || gesture.mount === undefined) return;
  const hero = rig.hero, center = FILM_SETS.film_zion_temple.center;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
    hero.bones.get('spine')!.rotation.set(0, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0);
    hero.bones.get('head')!.rotation.set(.18, 0, 0);
  } else { rig.torso.position.set(0, 1.99, 0); rig.torso.rotation.set(0, 0, 0); rig.head.rotation.set(.18, 0, 0); }
  rig.root.updateMatrixWorld(true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), points = templeWheelHands(gesture.mount, gesture.turn);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, side = i ? 'L' : 'R';
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`), end = wrist?.position ?? new THREE.Vector3(0, -.79, .055);
    const point = points[1 - i], hand = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
    const palm = wrist ? new THREE.Vector3(sign * .1, -.15, 0).applyQuaternion(rotation) : new THREE.Vector3();
    const rest = elbow.localToWorld(end.clone());
    reach(shoulder, elbow, end, rest.lerp(hand.sub(palm), THREE.MathUtils.smoothstep(gesture.grip, 0, 1)), new THREE.Vector3(sign * .9, -.5, -.25).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero!.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.z = sign * -.55;
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.55; });
  }
  rig.root.updateMatrixWorld(true);
}
