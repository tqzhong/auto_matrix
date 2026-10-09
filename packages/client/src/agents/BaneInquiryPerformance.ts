import * as THREE from 'three';
import { BANE_INQUIRY, baneInquiryRoot, baneInquirySeat, type BaneInquiryGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Seated inspection and restrained speaking gestures are driven by the saved interview clock. */
export function poseBaneInquiry(rig: CharacterRig, gesture?: BaneInquiryGesture): void {
  if (!gesture) {
    if (rig.detail.userData.baneInquiryPose) {
      delete rig.detail.userData.baneInquiryPose; rig.detail.position.set(0, .04, 0);
      rig.hips.forEach((hip, i) => { hip.position.x = (i ? 1 : -1) * .225; hip.position.z = 0; });
      rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity());
    }
    return;
  }
  const { role, phase, step, elapsed } = gesture, seat = baneInquirySeat(gesture, role), hero = rig.hero;
  rig.detail.userData.baneInquiryPose = true; rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  const hip = THREE.MathUtils.lerp(1.98, BANE_INQUIRY.seat.top + .27, seat);
  const line = phase === 'hearing' ? Math.floor(elapsed / BANE_INQUIRY.lineSeconds) : -1;
  const talking = phase === 'responding' ? role === 'roland' : step === 1 ? role === (line === 1 || line >= 4 ? 'bane' : 'roland')
    : step === 2 ? role === (line === 2 ? 'bane' : 'roland') : role === (line > 0 ? 'maggie' : 'roland');
  const beat = phase === 'hearing' || phase === 'responding' ? Math.sin(elapsed % BANE_INQUIRY.lineSeconds / BANE_INQUIRY.lineSeconds * Math.PI) : 0;
  const showing = role === 'bane' && step === 1 && phase === 'hearing' ? THREE.MathUtils.smoothstep(elapsed, 8.4, 10.6) : 0;
  if (hero) {
    hero.bones.get('pelvis')!.position.y = hip;
    hero.bones.get('spine')!.rotation.x = .08 * seat;
  } else {
    rig.torso.position.set(0, hip, 0); rig.torso.rotation.set(.055 * seat, 0, 0);
    rig.hips.forEach((joint, i) => { joint.position.set((i ? 1 : -1) * .225, hip, 0); });
  }
  const head = hero?.bones.get('head') ?? rig.head;
  head.rotation.set(showing ? .12 : .025 + (talking ? Math.sin(elapsed * 2) * .022 * beat : 0), role === 'maggie' ? -.12 : 0, 0);
  rig.root.updateWorldMatrix(true, true);
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const upper = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], lower = hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    const foot = new THREE.Vector3(sign * .25, hero ? hero.footHeight + .025 : .15, (hero ? 1 : .88) * seat);
    reach(upper, lower, ankle.position, rig.root.localToWorld(foot), new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(orientation));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    ankle.updateWorldMatrix(false, true);
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const table = role === 'bane' ? seat : role === 'roland' ? seat : 0;
    const hand = new THREE.Vector3(sign * .32, hip + .35, .68);
    hand.lerp(new THREE.Vector3(sign * .38, BANE_INQUIRY.table.top + (role === 'roland' ? .15 : .16), 1.42), table);
    // Keep the fingers above the lip until Roland's withdrawing hands are clear of it.
    if (role === 'roland' && baneInquiryRoot(gesture, role).x - hand.z < BANE_INQUIRY.table.width / 2 + .22)
      hand.y = Math.max(hand.y, BANE_INQUIRY.table.top + .15 + Math.sin(seat * Math.PI) * .08);
    if (role === 'bane' && i === 1 && showing) hand.y += .035 * showing;
    if (role === 'roland' && talking && i === 0) hand.y += beat * .16;
    if (role === 'maggie' && step === 3 && phase === 'hearing' && line >= 1 && i === 0) hand.lerp(new THREE.Vector3(-.34, BANE_INQUIRY.table.top + .2, 1.3), beat);
    const palmOrientation = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - (i === 1 ? showing * Math.PI : 0)));
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      const point = rig.root.localToWorld(hand).sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palmOrientation));
      reach(shoulder, elbow, wrist.position, point, new THREE.Vector3(sign * .7, -.3, .2).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palmOrientation));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), rig.root.localToWorld(hand), new THREE.Vector3(sign * .7, -.3, .2).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * -.06);
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.08; });
  }
  rig.root.updateWorldMatrix(true, true);
}
