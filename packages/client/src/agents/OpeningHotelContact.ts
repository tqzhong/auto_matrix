import * as THREE from 'three';
import { FILM_SETS, OPENING_HOTEL, openingHotelClimbPose } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

const { ladderZ, ladderHeight, ladderRungs: rungs, ladderRails: rails } = OPENING_HOTEL;
const center = FILM_SETS.film_heart_hotel.center;
const smooth = THREE.MathUtils.smoothstep;
const up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(0, 0, 1);
const wristAbove = .224, wristBehind = .196;

function climbStep(height: number, phase: number, bottom: number = rungs.bottom, top: number = ladderHeight, spacing: number = rungs.spacing) {
  const last = Math.floor((top - bottom) / spacing);
  const step = THREE.MathUtils.clamp((height - bottom) / spacing + phase, 0, last);
  const held = Math.floor(step), swing = smooth(step - held, .56, 1);
  return { y: bottom + spacing * (held + swing), clearance: Math.sin(Math.PI * swing) };
}

function plant(upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone, target: THREE.Vector3,
  pole: THREE.Vector3, orientation: THREE.Quaternion, weight: number): void {
  const upperBase = upper.quaternion.clone(), lowerBase = lower.quaternion.clone();
  orientation.slerp(end.getWorldQuaternion(new THREE.Quaternion()), 1 - weight);
  reach(upper, lower, end.position, target, pole);
  upper.quaternion.slerp(upperBase, 1 - weight); lower.quaternion.slerp(lowerBase, 1 - weight);
  end.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  upper.updateWorldMatrix(false, true);
}

export function placeOpeningHotelClimber(rig: HeroRig, climbed: number): void {
  if (climbed >= ladderHeight) return;
  const { y, transfer } = openingHotelClimbPose(climbed);
  const feet = 1 - smooth(climbed, 5.20, 5.62);
  const baseY = center.y - 1, railZ = center.z + ladderZ + rungs.offsetZ;
  const bone = (name: string) => rig.bones.get(name)!;
  // Sit the hips back from the steel while the upper body leans into the climb.
  bone('pelvis').position.z -= .68 * feet;
  bone('spine').rotation.x += .22 * feet;
  bone('head').rotation.x -= .22 * feet;
  rig.root.updateWorldMatrix(true, true);

  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? -1 : 1;
    const hand = 1 - smooth(transfer, i ? .76 : .56, i ? 1 : .9);
    // Half a rung separates the two sides, so one hand and one boot stay planted.
    if (hand) {
      const rung = climbStep(y + 3.8, i * .5);
      const overhand = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -sign * Math.PI / 2, 'ZYX'));
      const grip = overhand.clone();
      // The wrist rests above and behind the bar so the curled fingers can clear its far edge.
      const target = new THREE.Vector3(center.x + sign * .48, baseY + rung.y + wristAbove + .24 * rung.clearance, railZ + wristBehind + .25 * rung.clearance);
      const ontoPost = smooth(y, 3.93 + i * .26, 4.27 + i * .26);
      if (ontoPost) {
        const post = climbStep(y + 3, i * .5, ladderHeight + .18, rails.top, .56);
        target.lerp(new THREE.Vector3(center.x + sign * (rails.x - wristAbove - .2 * post.clearance), baseY + post.y, railZ + wristBehind), ontoPost);
        target.z += .18 * Math.sin(Math.PI * ontoPost);
        grip.slerp(overhand.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(forward, sign * Math.PI / 2)), smooth(ontoPost, .17, .83));
      }
      const ontoRail = smooth(climbed, 5.06 + i * .16, 5.24 + i * .16);
      if (ontoRail) {
        target.lerp(new THREE.Vector3(center.x + sign * (rails.x - wristBehind), baseY + rails.top + wristAbove, railZ - .36 - 1.18 * transfer), ontoRail);
        grip.slerp(overhand.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(up, -sign * Math.PI / 2)), ontoRail);
      }
      plant(bone('shoulder_' + side), bone('elbow_' + side), bone('wrist_' + side), target, new THREE.Vector3(sign * .4, -.8, 1), grip, hand);
    }
    if (feet) {
      const rung = climbStep(y + .57, (1 - i) * .5);
      const target = new THREE.Vector3(center.x + sign * .26, baseY + rung.y + rungs.height / 2 + rig.footHeight + .24 * rung.clearance, railZ + .35 + .24 * rung.clearance);
      const flat = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
      plant(bone('hip_' + side), bone('knee_' + side), bone('ankle_' + side), target, new THREE.Vector3(sign * .78, 0, -.78), flat, feet);
    }
  }
}
