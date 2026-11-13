import * as THREE from 'three';
import { FILM_SETS, OPENING_HOTEL, openingHotelBootGrip, openingHotelBootRung, openingHotelClimbPose, openingHotelPickupPose, type OpeningHotelPickupGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { HeroRig } from './HeroModel.js';
import { poseHelPistol } from './HelCoatcheckPerformance.js';
import { openingHotelPistolRest, openingHotelPistolRotation } from './HelPistolModel.js';
import { reach } from './SpoonPerformance.js';

const { ladderZ, ladderHeight, ladderRungs: rungs, ladderRails: rails } = OPENING_HOTEL;
const center = FILM_SETS.film_heart_hotel.center;
const smooth = THREE.MathUtils.smoothstep;
const up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(0, 0, 1);
const wristAbove = .224, wristBehind = .196;

export function poseOpeningHotelPickup(rig: CharacterRig, gesture: OpeningHotelPickupGesture, aimPitch?: number): void {
  const gun = rig.weapons?.[0];
  if (!gun) return;
  const { bent, time, held } = openingHotelPickupPose(gesture), { grasp, lift, end } = OPENING_HOTEL.pickup;
  const hero = rig.hero, body = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const shoulder = hero?.bones.get('shoulder_R') ?? rig.shoulders[0], elbow = hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const wrist = hero?.bones.get('wrist_R') ?? rig.mobilWrists?.[0];
  if (!wrist) { gun.visible = held; return; }
  const point = new THREE.Vector3(), resting = wrist.getWorldPosition(point).clone();
  const restRotation = wrist.getWorldQuaternion(new THREE.Quaternion());
  const grip = smooth(time, grasp - .15, grasp);
  const fingers = hero && grip < 1 ? Array.from({ length: 15 }, (_, i) => hero.bones.get(`finger${Math.floor(i / 3) + 1}-${i % 3 + 1}_R`)!) : [];
  const open = fingers.map(finger => finger.quaternion.clone());
  if (hero && bent > 0) {
    const bone = (name: string) => hero.bones.get(name)!;
    const feet = (['R', 'L'] as const).map(side => bone(`ankle_${side}`).getWorldPosition(new THREE.Vector3()));
    const pelvis = bone('pelvis'); pelvis.position.y -= 1.68 * bent; pelvis.position.z -= .16 * bent;
    bone('spine').rotation.x += .78 * bent; bone('chest').rotation.x += .5 * bent;
    bone('head').rotation.x -= .25 * bent;
    for (const [i, side] of (['R', 'L'] as const).entries()) {
      const hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
      const ankleRotation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(body, bent);
      const foot = feet[i].add(new THREE.Vector3(i ? .16 : -.10, 0, i ? -.19 : .14).applyQuaternion(body).multiplyScalar(bent));
      reach(hip, knee, ankle.position, foot, new THREE.Vector3(i ? .36 : -.36, .25, 1).applyQuaternion(body));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(ankleRotation));
    }
  }
  const reaching = smooth(time, .06, grasp), raising = smooth(time, grasp, lift), aiming = smooth(time, lift - .03, end);
  poseHelPistol(rig, aimPitch, false, gun);
  const floor = openingHotelPistolRest(gesture.fallen), carried = gun.getWorldPosition(point).clone();
  const ready = rig.root.localToWorld(new THREE.Vector3(-.31, 2.67, .89));
  const position = floor.lerp(ready.lerp(carried, aiming), raising);
  const upraised = body.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.25, .03, -.2, 'YXZ')));
  const direction = openingHotelPistolRotation.clone().slerp(upraised.slerp(gun.getWorldQuaternion(new THREE.Quaternion()), aiming), raising);
  const orientation = direction.multiply(gun.quaternion.clone().invert());
  const offset = gun.position.clone().multiply(wrist.getWorldScale(point)).applyQuaternion(orientation);
  const aimWrist = position.sub(offset);
  const pole = new THREE.Vector3(-1, -.5, -.8).lerp(new THREE.Vector3(-.65, .4, -.32), bent).applyQuaternion(body);
  reach(shoulder, elbow, wrist.position, resting.lerp(aimWrist, reaching), pole);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(restRotation.slerp(orientation, reaching)));
  fingers.forEach((finger, i) => finger.quaternion.slerp(open[i], 1 - grip));
  gun.visible = held;
}

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

export function placeOpeningHotelClimber(rig: HeroRig, climbed: number, weight = 1): void {
  if (climbed >= ladderHeight) return;
  const { y, transfer } = openingHotelClimbPose(climbed);
  const feet = weight * openingHotelBootGrip(climbed);
  const baseY = center.y - 1, railZ = center.z + ladderZ + rungs.offsetZ;
  const bone = (name: string) => rig.bones.get(name)!;
  // Sit the hips back from the steel while the upper body leans into the climb.
  bone('pelvis').position.z -= .68 * feet;
  bone('spine').rotation.x += .22 * feet;
  bone('head').rotation.x -= .22 * feet;
  rig.root.updateWorldMatrix(true, true);

  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? -1 : 1;
    const hand = weight * (1 - smooth(transfer, i ? .76 : .56, i ? 1 : .9));
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
      const rung = openingHotelBootRung(y, 1 - i);
      const target = new THREE.Vector3(center.x + sign * .26, baseY + rung.y + rungs.height / 2 + rig.footHeight + .24 * rung.clearance, railZ + .35 + .24 * rung.clearance);
      const flat = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
      plant(bone('hip_' + side), bone('knee_' + side), bone('ankle_' + side), target, new THREE.Vector3(sign * .78, 0, -.78), flat, feet);
    }
  }
}
