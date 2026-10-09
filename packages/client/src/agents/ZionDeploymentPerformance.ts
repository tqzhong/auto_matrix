import * as THREE from 'three';
import { ZION_DEPLOYMENT, zionDeploymentSpeaker, type ZionDeploymentGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

export function poseZionDeployment(rig: CharacterRig, gesture?: ZionDeploymentGesture): void {
  if (!gesture) {
    if (rig.detail.userData.zionDeploymentPose) {
      delete rig.detail.userData.zionDeploymentPose; rig.detail.position.set(0, .04, 0);
      rig.hips.forEach((hip, i) => { hip.position.x = (i ? 1 : -1) * .225; hip.position.z = 0; });
      rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity());
    }
    return;
  }
  rig.detail.userData.zionDeploymentPose = true; rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  const { role, elapsed, phase } = gesture, hero = rig.hero, seated = role !== 'lock';
  const hip = seated ? ZION_DEPLOYMENT.seat.top + .27 : 1.98;
  if (hero) { hero.bones.get('pelvis')!.position.y = hip; hero.bones.get('spine')!.rotation.x = seated ? .035 : 0; }
  else {
    rig.torso.position.set(0, hip, 0); rig.torso.rotation.set(seated ? .025 : 0, 0, 0);
    rig.hips.forEach((joint, i) => { joint.position.set((i ? 1 : -1) * .225, hip, 0); });
  }
  const speaker = zionDeploymentSpeaker(gesture), talking = speaker === role || phase === 'responding' && role === 'lock';
  const beat = talking ? Math.sin(elapsed % ZION_DEPLOYMENT.lineSeconds / ZION_DEPLOYMENT.lineSeconds * Math.PI) : 0;
  const head = hero?.bones.get('head') ?? rig.head;
  const root = role === 'lock' ? ZION_DEPLOYMENT.report : ZION_DEPLOYMENT.roots[role];
  const target = speaker && speaker !== 'lock' ? ZION_DEPLOYMENT.roots[speaker] : role === 'lock' ? ZION_DEPLOYMENT.roots.hamann : ZION_DEPLOYMENT.report;
  const yaw = role === 'lock' ? Math.PI : ZION_DEPLOYMENT.roots[role].yaw;
  const turn = Math.atan2(target.x - root.x, target.z - root.z) - yaw;
  head.rotation.set(talking ? Math.sin(elapsed * 1.6) * .017 * beat : -.02, THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -.5, .5), 0);
  if (role === 'lock' && phase === 'allocating') head.rotation.set(.12, 0, 0);
  rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const upper = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], lower = hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    const foot = new THREE.Vector3(sign * .25, hero ? hero.footHeight + .025 : .15, seated ? .92 : .04);
    reach(upper, lower, ankle.position, rig.root.localToWorld(foot), new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(orientation));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const hand = new THREE.Vector3(sign * (seated ? .3 : .53), seated ? hip + .33 : 1.98, seated ? .52 : .26);
    if (talking && i === 0) { hand.y += beat * .48; hand.z += beat * .2; }
    // The plan is observed, not touched through its backing or glass.
    const palm = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(seated ? Math.PI / 2 : .42, 0, sign * .15)));
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      const point = rig.root.localToWorld(hand).sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palm));
      reach(shoulder, elbow, wrist.position, point, new THREE.Vector3(sign * .75, -.3, .2).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), rig.root.localToWorld(hand), new THREE.Vector3(sign * .75, -.3, .2).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * -.07);
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.08; });
  }
  rig.root.updateWorldMatrix(true, true);
}
