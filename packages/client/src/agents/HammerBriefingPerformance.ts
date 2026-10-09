import * as THREE from 'three';
import { HAMMER_BRIEFING, hammerBriefingSpeaker, type HammerBriefingGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Restrained standing gestures, with feet planted and a saved speaking clock. */
export function poseHammerBriefing(rig: CharacterRig, gesture?: HammerBriefingGesture): void {
  if (!gesture) {
    if (rig.detail.userData.hammerBriefingPose) { delete rig.detail.userData.hammerBriefingPose; rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity()); }
    return;
  }
  rig.detail.userData.hammerBriefingPose = true;
  if (gesture.role === 'trinity' && gesture.phase === 'leaving') return;
  const { role, elapsed, phase } = gesture, hero = rig.hero, speaker = hammerBriefingSpeaker(gesture);
  const talking = speaker === role || phase === 'responding' && role === 'neo';
  const beat = talking ? Math.sin(elapsed % HAMMER_BRIEFING.lineSeconds / HAMMER_BRIEFING.lineSeconds * Math.PI) : 0;
  const head = hero?.bones.get('head') ?? rig.head;
  const target = speaker && speaker !== role && speaker !== 'neo' ? HAMMER_BRIEFING.roots[speaker] : HAMMER_BRIEFING.approach;
  const root = role === 'neo' ? HAMMER_BRIEFING.approach : HAMMER_BRIEFING.roots[role];
  const yaw = role === 'neo' ? Math.PI : HAMMER_BRIEFING.roots[role].yaw;
  const turn = Math.atan2(target.x - root.x, target.z - root.z) - yaw;
  head.rotation.set(talking ? Math.sin(elapsed * 1.7) * .015 * beat : -.018, THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -.55, .55), 0);
  rig.root.updateWorldMatrix(true, true); const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i];
    const folded = (role === 'roland' || role === 'niobe') && !(talking && role === 'niobe' && i === 0);
    const hand = folded ? new THREE.Vector3(-sign * .36, 2.46 + i * .12, .57 + i * .08)
      : new THREE.Vector3(sign * (.54 + beat * .1), 1.95 + beat * .72, .25 + beat * .45);
    if (role === 'neo' && phase === 'planning' && i === 0) {
      // The fingers remain in front of the actual CRT, rather than entering its glass.
      hand.set(-.1, 3.42, 1.1 + beat * .025);
    }
    const palm = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(folded ? .28 : .4 + beat * .3, 0, sign * (folded ? 1.15 : .2))));
    if (wrist) {
      const offset = hero ? new THREE.Vector3(i ? -.13 : .13, -.18, .02) : new THREE.Vector3(0, -.75 - wrist.position.y, .005);
      const target = rig.root.localToWorld(hand).sub(offset.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(palm));
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(sign * .9, -.4, .1).applyQuaternion(orientation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm));
    } else reach(shoulder, elbow, new THREE.Vector3(0, -.75, .005), rig.root.localToWorld(hand), new THREE.Vector3(sign * .9, -.4, .1).applyQuaternion(orientation));
    if (hero) for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, sign * -.08);
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.12; });
  }
  rig.root.updateWorldMatrix(true, true);
}
