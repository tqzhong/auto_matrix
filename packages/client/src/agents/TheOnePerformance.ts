import * as THREE from 'three';
import { theOnePose, type TheOneGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';
import { reach } from './SpoonPerformance.js';
import { groundCharacter } from './GroundContact.js';

/** The physical body uses the same cushion and footrest as the earlier ship crosscut. */
export function poseTheOneBody(rig: CharacterRig, gesture?: TheOneGesture): void {
  if (!gesture || !rig.hero) return;
  const pose = theOnePose(gesture), hero = rig.hero, bone = (name: string) => hero.bones.get(name)!;
  const leaning = gesture.kind === 'death' && gesture.role === 'trinity' && pose.kiss > 0;
  if (!pose.seated && !leaning) return;
  const pelvis = bone('pelvis'); pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
  if (pose.seated) {
    pelvis.position.y = 1.58; pelvis.position.z = -.23;
    bone('spine').rotation.set(-.22, 0, 0); bone('chest').rotation.set(-.12, 0, 0);
    bone('head').rotation.set(gesture.kind === 'death' ? .48 - pose.revive * .25 : .12, 0, 0);
  } else {
    pelvis.position.y -= .1 * pose.kiss; pelvis.position.z += .25 * pose.kiss;
    bone('spine').rotation.set(.32 * pose.kiss, 0, 0); bone('chest').rotation.set(.26 * pose.kiss, 0, 0);
    bone('head').rotation.set(-.12 * pose.kiss, 0, -.1 * pose.kiss);
  }
  for (const side of ['R', 'L']) for (const joint of ['hip', 'knee', 'ankle']) bone(`${joint}_${side}`).rotation.set(0, 0, 0);
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1, hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    const target = hero.root.localToWorld(pose.seated ? new THREE.Vector3(sign * .45, .25 + hero.footHeight, 1.45)
      : new THREE.Vector3(sign * .25, hero.footHeight + .05, sign * .16));
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .3, -.2, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    if (pose.seated) crosscutPalm(rig, side, rig.root.localToWorld(new THREE.Vector3(sign * .87, 1.83, .1)));
  }
  if (leaning) groundCharacter(rig, 1);
}

/** Read Neo’s supported pose after both actors have animated. */
export function poseResurrectionPair(neo: CharacterRig, trinity: CharacterRig, gesture?: TheOneGesture): void {
  if (!gesture || gesture.kind !== 'death' || !neo.hero || !trinity.hero) return;
  const weight = theOnePose({ ...gesture, role: 'trinity' }).kiss;
  if (weight === 0) return;
  neo.root.updateWorldMatrix(true, true); trinity.root.updateWorldMatrix(true, true);
  for (const side of ['R', 'L'] as const) {
    const shoulder = neo.hero.bones.get(`shoulder_${side}`)!;
    const target = shoulder.localToWorld(new THREE.Vector3(0, .08, .12));
    const rest = trinity.hero.bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
    crosscutPalm(trinity, side, rest.lerp(target, weight));
  }
}
