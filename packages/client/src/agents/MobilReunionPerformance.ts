import * as THREE from 'three';
import { mobilReunionPose, type MobilReunionGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reunionBackContact } from './DockReunionPerformance.js';
import { reach } from './SpoonPerformance.js';

export function poseMobilReunion(rig: CharacterRig, gesture?: MobilReunionGesture, partner?: CharacterRig): void {
  if (gesture?.reunion.phase !== 'embracing') return;
  const pose = mobilReunionPose(gesture.reunion), hero = rig.hero, neo = gesture.role === 'neo';
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
    pelvis.position.y -= .025;
    hero.bones.get('spine')!.rotation.set((neo ? .1 : .07) * pose.kiss, 0, 0);
    hero.bones.get('chest')!.rotation.set(0, 0, 0);
    hero.bones.get('head')!.rotation.set((neo ? .11 : -.05) * pose.kiss, (neo ? -.15 : .15) * pose.kiss, -.16 * pose.kiss);
  } else {
    rig.torso.position.set(0, 1.955, 0); rig.torso.rotation.set(.08 * pose.kiss, 0, 0);
    rig.head.rotation.set((neo ? .11 : -.05) * pose.kiss, (neo ? -.15 : .15) * pose.kiss, -.16 * pose.kiss);
  }
  rig.root.updateMatrixWorld(true);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1, hip = hero?.bones.get('hip_' + side) ?? rig.hips[i];
    const knee = hero?.bones.get('knee_' + side) ?? rig.knees[i], ankle = hero?.bones.get('ankle_' + side) ?? rig.ankles[i];
    const foot = rig.root.localToWorld(new THREE.Vector3(sign * .28, hero ? hero.footHeight + .025 : .155, i ? -.12 : .12));
    if (!hero) hip.position.set(sign * .225, 1.955, 0);
    reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    if (!partner) continue;
    const shoulder = hero?.bones.get('shoulder_' + side) ?? rig.shoulders[i], elbow = hero?.bones.get('elbow_' + side) ?? rig.elbows[i];
    const wrist = hero?.bones.get('wrist_' + side), palm = new THREE.Vector3(i ? -.13 : .13, -.18, .02);
    const contact = reunionBackContact(partner, i === 1), rest = rig.root.localToWorld(new THREE.Vector3(sign * .89, 2.32, .08));
    const target = rest.lerp(contact, pose.embrace); target.y += Math.sin(pose.embrace * Math.PI) * .3;
    if (wrist) target.sub(palm.applyQuaternion(rotation));
    reach(shoulder, elbow, wrist?.position ?? new THREE.Vector3(0, -.79, .055), target, new THREE.Vector3(sign * 1.3, .15, -.12).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
        hero!.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(finger === 1 ? .12 : 0, 0, -sign * .18 * pose.embrace);
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.18 * pose.embrace; });
  }
  rig.root.updateMatrixWorld(true);
}

/** Both shipped base bodies precede the cloth queries, including the first cold frame. */
export function poseMobilReunionPair(neo: CharacterRig, trinity: CharacterRig, gesture: MobilReunionGesture): void {
  poseMobilReunion(neo, { ...gesture, role: 'neo' }); poseMobilReunion(trinity, { ...gesture, role: 'trinity' });
  poseMobilReunion(neo, { ...gesture, role: 'neo' }, trinity); poseMobilReunion(trinity, { ...gesture, role: 'trinity' }, neo);
}
