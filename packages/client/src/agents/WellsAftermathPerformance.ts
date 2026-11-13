import * as THREE from 'three';
import { FILM_SETS, WELLS_AFTERMATH, WELLS_CURB, wellsAftermathPose, type WellsAftermathGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const smooth = THREE.MathUtils.smoothstep;

export function poseWellsAftermath(rig: CharacterRig, gesture?: WellsAftermathGesture): void {
  const hero = rig.hero;
  if (!hero || !gesture && !rig.root.userData.wellsSpeaking) return;
  const pose = gesture && wellsAftermathPose(gesture);
  const amount = pose?.speaking ?? 0;
  const face = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh | undefined;
  const jaw = face?.morphTargetDictionary?.jawOpen;
  if (jaw !== undefined && face?.morphTargetInfluences) face.morphTargetInfluences[jaw] = amount * .33;
  rig.root.userData.wellsSpeaking = amount > 0;
  if (!gesture || !pose) return;
  const { elapsed, role } = gesture, { bones } = hero;
  bones.get('head')!.rotation.y += pose.listen;
  bones.get('head')!.rotation.x += pose.inspect * .22 + amount * .035;
  bones.get('spine')!.rotation.x += pose.inspect * .25;
  bones.get('chest')!.rotation.x += pose.inspect * .16;
  if (role !== 'smith' || elapsed >= 2.48) return;

  const center = FILM_SETS.film_wells_phone.center, truckZ = center.z - 26, streetY = center.y - 1;
  const truckLift = gesture.curbside ? WELLS_CURB.truckLift : 0, sidewalk = gesture.curbside ? WELLS_CURB.height : 0;
  const { upperStep, lowerStep } = WELLS_AFTERMATH;
  const stepping = 1 - smooth(elapsed, 2.15, 2.48), brace = smooth(elapsed, .72, 1.05) * (1 - smooth(elapsed, 1.65, 2.12));
  // The cab crouch changes leg reach; the walking targets still sit on the street.
  const legs = (['L', 'R'] as const).map(side => {
    const ankle = bones.get(`ankle_${side}`)!;
    return { side, ankle, walkTarget: ankle.getWorldPosition(new THREE.Vector3()) };
  });
  const pelvis = bones.get('pelvis')!;
  pelvis.position.y -= (.5 + .36 * brace) * stepping;
  bones.get('spine')!.rotation.x += .26 * stepping;
  bones.get('head')!.rotation.x += .3 * stepping;
  rig.root.updateWorldMatrix(true, true);
  const facing = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const platform = (point: { x: number; y: number; z: number }, offset: number) =>
    new THREE.Vector3(center.x + point.x, streetY + point.y + hero.footHeight, truckZ + point.z + offset);
  for (const { side, ankle, walkTarget } of legs) {
    const lead = side === 'L';
    const upper = platform({ ...upperStep, y: upperStep.y + truckLift }, lead ? .28 : -.27);
    const lower = platform({ ...lowerStep, y: lowerStep.y + truckLift }, .25);
    const floor = platform({ x: lead ? -3.95 : -3.79, y: sidewalk, z: lead ? -.02 : -.93 }, 0);
    const step = smooth(elapsed, lead ? 1.28 : 1.64, lead ? 1.91 : 2.25);
    const foot = (lead ? upper.lerp(lower, smooth(elapsed, .81, 1.18)) : upper).lerp(floor, step);
    foot.y += Math.sin(Math.PI * step) * .15;
    const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!;
    const target = walkTarget.lerp(foot, stepping);
    const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(facing, stepping);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(lead ? .12 : -.12, .15, 1).applyQuaternion(facing));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
  if (brace > 0) {
    const upper = bones.get('shoulder_R')!, lower = bones.get('elbow_R')!, hand = bones.get('wrist_R')!;
    const support = new THREE.Vector3(center.x - 2.09, streetY + 3.37 + truckLift, truckZ - .13);
    const target = hand.getWorldPosition(new THREE.Vector3()).lerp(support, brace);
    const orientation = hand.getWorldQuaternion(new THREE.Quaternion());
    reach(upper, lower, hand.position, target, new THREE.Vector3(-.46, -.2, -.48));
    hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
}
