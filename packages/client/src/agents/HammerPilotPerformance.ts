import * as THREE from 'three';
import { HAMMER_COCKPIT, hammerControlGrip, hammerHandoverPose, type HammerPilotGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** The saved ship controls drive hands; render time never replays a seating transition. */
export function poseHammerPilot(rig: CharacterRig, gesture?: HammerPilotGesture): void {
  if (!gesture) {
    if (rig.detail.userData.hammerPilotPose) {
      delete rig.detail.userData.hammerPilotPose; rig.detail.position.set(0, .04, 0);
      rig.hips.forEach((hip, i) => { hip.position.x = (i ? 1 : -1) * .225; hip.position.z = 0; });
      rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity());
    }
    return;
  }
  rig.detail.userData.hammerPilotPose = true; rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  const handover = gesture.handover && gesture.role !== 'roland' ? hammerHandoverPose(gesture.handover, gesture.role) : undefined;
  const sitting = handover?.sitting ?? (gesture.role !== 'roland' ? 1 : 0), holding = handover?.grip ?? 1;
  const hero = rig.hero, hip = THREE.MathUtils.lerp(1.98, HAMMER_COCKPIT.seat + (gesture.role === 'ghost' ? .31 : .27), sitting);
  if (hero) {
    hero.bones.get('pelvis')!.position.y = hip;
    hero.bones.get('spine')!.rotation.set(0, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0);
  } else {
    rig.torso.position.set(0, hip, 0); rig.torso.rotation.set(0, 0, 0);
    rig.hips.forEach((joint, i) => joint.position.set((i ? 1 : -1) * .225, hip, 0));
  }
  const head = hero?.bones.get('head') ?? rig.head;
  head.rotation.set(.015, gesture.role === 'morpheus' ? -.09 : 0, 0);
  rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const upper = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], lower = hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    const stride = handover?.walk ? Math.sin((gesture.handover!.elapsed - (gesture.role === 'ghost' ? 2 : 6.2)) * 8 + i * Math.PI) : 0;
    const foot = new THREE.Vector3(sign * .25, (hero ? hero.footHeight + .025 : .15) + Math.max(0, stride) * .12,
      .05 + sitting + stride * .26);
    reach(upper, lower, ankle.position, rig.root.localToWorld(foot), new THREE.Vector3(sign * .12, .1, 1).applyQuaternion(orientation));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    const grip = gesture.role === 'roland' ? { x: sign * .6, y: 2.2, z: .45 } : hammerControlGrip(gesture.flight, sign);
    if (handover) {
      grip.x = THREE.MathUtils.lerp(sign * .52, grip.x, holding);
      grip.y = THREE.MathUtils.lerp(hip - .25 + sitting * .6, grip.y, holding);
      grip.z = THREE.MathUtils.lerp(.12 + sitting * .35 - stride * .3, grip.z, holding);
    }
    const hand = new THREE.Vector3(grip.x, grip.y, grip.z);
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const palm = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.15, 0, sign * .1)));
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      const target = rig.root.localToWorld(hand).sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palm));
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign * .9, -.3, .05).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), rig.root.localToWorld(hand), new THREE.Vector3(sign * .9, -.3, .05).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
      hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * (finger === 1 ? -.25 : -.15 - .6 * holding));
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.15 - .65 * holding; });
  }
  rig.root.updateWorldMatrix(true, true);
}
