import * as THREE from 'three';
import { MAGGIE_DISCOVERY, FILM_SETS, maggieDiscoveryRoot, maggieDiscoverySpeaker, type MaggieDiscoveryGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { poseHammerPatient } from './HammerPatientPerformance.js';

/** Bedside actions and restrained crew gestures use only the saved encounter clock. */
export function poseMaggieDiscovery(rig: CharacterRig, gesture?: MaggieDiscoveryGesture): void {
  if (!gesture) {
    if (rig.detail.userData.maggieDiscoveryPose) {
      delete rig.detail.userData.maggieDiscoveryPose; rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity());
      poseHammerPatient(rig);
      if (!rig.hero) { rig.torso.position.set(0, 1.86, 0); rig.hips.forEach(hip => { hip.position.y = 1.82; }); }
    }
    return;
  }
  rig.detail.userData.maggieDiscoveryPose = true;
  const { role, phase, elapsed } = gesture;
  if (role === 'maggie') { poseHammerPatient(rig, 'maggie'); return; }
  const hero = rig.hero, speaker = maggieDiscoverySpeaker(gesture);
  if (role === 'colt' && gesture.arrival < MAGGIE_DISCOVERY.arrivalSeconds && phase === 'searching') {
    const gait = Math.sin(gesture.arrival * 9) * .3;
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      (hero?.bones.get(`hip_${i ? 'L' : 'R'}`) ?? rig.hips[i]).rotation.x = gait * sign;
      (hero?.bones.get(`knee_${i ? 'L' : 'R'}`) ?? rig.knees[i]).rotation.x = Math.max(0, -gait * sign) * 1.6;
      rig.shoulders[i].rotation.x = -gait * sign * .6;
    }
  }
  const talking = speaker === role || phase === 'responding' && role === 'roland';
  const beat = talking ? Math.sin(elapsed % MAGGIE_DISCOVERY.lineSeconds / MAGGIE_DISCOVERY.lineSeconds * Math.PI) : 0;
  const head = hero?.bones.get('head') ?? rig.head;
  head.rotation.x = role === 'roland' && phase === 'covering' ? .30 : talking ? Math.sin(elapsed * 1.5) * .02 * beat : -.018;
  const looking = role === 'roland' ? undefined : maggieDiscoveryRoot(gesture, role as keyof typeof MAGGIE_DISCOVERY.roots);
  if (looking) {
    const angle = Math.atan2(MAGGIE_DISCOVERY.report.x - looking.x, MAGGIE_DISCOVERY.report.z - looking.z) - looking.yaw;
    head.rotation.y = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -.5, .5);
  }
  if (role === 'roland' && phase === 'covering') {
    if (hero) { hero.bones.get('pelvis')!.position.y = 1.3; hero.bones.get('spine')!.rotation.x = .45; }
    else { rig.torso.position.set(0, 1.3, .1); rig.torso.rotation.x = .45; rig.hips.forEach(hip => { hip.position.y = 1.3; }); }
    rig.root.updateWorldMatrix(true, true);
    const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const side = i ? 'L' : 'R', sign = i ? 1 : -1;
      const upper = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], lower = hero?.bones.get(`knee_${side}`) ?? rig.knees[i], ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
      const step = gesture.cover < MAGGIE_DISCOVERY.coverSeconds ? Math.sin(gesture.cover * 8 + i * Math.PI) : 0;
      const foot = new THREE.Vector3(sign * .27 + step * .08, hero ? hero.footHeight + .025 : .02, -.18);
      foot.y += Math.max(0, step) * .06;
      reach(upper, lower, ankle.position, rig.root.localToWorld(foot), new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(orientation));
      ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
  }
  rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const hand = new THREE.Vector3(sign * (.56 + beat * .05), 1.85 + beat * .8, .19 + beat * .36);
    let target = rig.root.localToWorld(hand), palm = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.45 + beat * .25, 0, sign * .2)));
    if (role === 'roland' && phase === 'covering' && i === 0) {
      const f = THREE.MathUtils.smoothstep(gesture.cover, 0, MAGGIE_DISCOVERY.coverSeconds);
      const center = FILM_SETS.film_hammer_deck.center;
      target = new THREE.Vector3(center.x - 8.65, center.y - 1 + 1.96, center.z - 23 + THREE.MathUtils.lerp(-.25, -2.75, f));
      palm = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2));
    }
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      const endpoint = target.sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palm));
      reach(shoulder, elbow, wrist.position, endpoint, new THREE.Vector3(sign * .9, -.4, .1).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), target, new THREE.Vector3(sign * .9, -.4, .1).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * -.12);
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.16; });
  }
  rig.root.updateWorldMatrix(true, true);
}
