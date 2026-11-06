import * as THREE from 'three';
import { FILM_SETS, OFFICE_LADDER } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { reach } from './SpoonPerformance.js';

const center = FILM_SETS.film_office_ledge.center;
const { rung, rail, depth, z } = OFFICE_LADDER;
const floor = center.y - 1, base = floor - depth;
const maxRung = Math.floor((depth + rung.top) / rung.spacing);
const maxRail = Math.floor((depth + rail.top) / rung.spacing);
const smooth = THREE.MathUtils.smoothstep;
const footRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
const handRotations = [
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI),
];
const railRotations = handRotations.map((rotation, i) => new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), (i ? -1 : 1) * Math.PI / 2).multiply(rotation));

// Four staggered strokes keep three limbs planted on the same world rungs in either direction.
function contact(height: number, i: number, hand: boolean) {
  const phase = hand ? .25 + i * .5 : i * .5;
  const step = height / (rung.spacing * 2) + phase, whole = Math.floor(step);
  const stroke = smooth(step - whole, .78, 1), air = Math.sin(Math.PI * stroke);
  const first = whole * 2 + (hand ? 8 : 2) - i;
  const railHold = hand ? THREE.MathUtils.lerp(Number(first > maxRung), Number(first + 2 > maxRung), stroke) : 0;
  const row = Math.min(hand ? maxRail : maxRung, first + stroke * 2);
  const point = new THREE.Vector3(
    center.x + rung.x - (hand ? THREE.MathUtils.lerp(rung.width, rail.width, railHold) / 2 + .25 * air : .40 * air),
    base + row * rung.spacing + (hand ? -.27 * railHold : rung.height / 2 + .006 + .12 * air),
    center.z + z + (i ? -1 : 1) * (hand ? THREE.MathUtils.lerp(.45, rail.offset, railHold) : .29),
  );
  return { point, air, railHold };
}

export function poseOfficeLadder(rig: CharacterRig, gesture?: MotionInput['officeLadder']): void {
  if (!gesture) return;
  const origin = rig.root.getWorldPosition(new THREE.Vector3());
  const approach = Math.hypot(origin.x - center.x - OFFICE_LADDER.x, origin.z - center.z - z);
  const hold = gesture.exit === undefined ? 1 - smooth(approach, .08, 1.3) : 1;
  if (!hold) return;
  // Use the displayed root between authoritative snapshots so a planted limb cannot slide as the body interpolates.
  const height = THREE.MathUtils.clamp(origin.y - base, 0, depth);
  const brace = hold * (1 - smooth(gesture.exit ?? 0, .7, 1));
  const top = smooth(height, depth - 1.2, depth);
  const hero = rig.hero;
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!;
    pelvis.position.lerp(hero.rest.get('pelvis')!, brace);
    pelvis.position.y -= (.12 + .12 * top) * brace;
    pelvis.quaternion.slerp(new THREE.Quaternion(), brace);
    for (const name of ['spine', 'chest']) {
      const bone = hero.bones.get(name)!;
      bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, .08, brace);
      bone.rotation.y *= 1 - brace; bone.rotation.z *= 1 - brace;
    }
  } else {
    const drop = (.06 + .24 * top) * brace;
    rig.torso.position.y -= drop;
    for (const hip of rig.hips) hip.position.y -= drop;
  }
  rig.root.updateWorldMatrix(true, true);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? -1 : 1;
    const hip = hero?.bones.get('hip_' + side) ?? rig.hips[i], knee = hero?.bones.get('knee_' + side) ?? rig.knees[i];
    const ankle = hero?.bones.get('ankle_' + side) ?? rig.ankles[i];
    const sole = hero ? new THREE.Vector3(0, -hero.footHeight, .23) : new THREE.Vector3(0, -.155, .13);
    const shoe = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(footRotation, hold);
    const footPoint = contact(height, i, false).point;
    if (gesture.exit !== undefined) {
      const transfer = smooth(gesture.exit, i ? .55 : .1, i ? .96 : .55);
      footPoint.lerp(new THREE.Vector3(center.x + OFFICE_LADDER.x + OFFICE_LADDER.stepOff + .20, floor + .006, footPoint.z), transfer);
      footPoint.y += Math.sin(Math.PI * transfer) * .24;
    }
    const foot = ankle.localToWorld(sole.clone()).lerp(footPoint, hold);
    const footOffset = sole.multiply(ankle.getWorldScale(new THREE.Vector3())).applyQuaternion(shoe);
    reach(hip, knee, ankle.position, foot.sub(footOffset), new THREE.Vector3(.8, .1, sign * .45));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(shoe));
    ankle.updateWorldMatrix(false, true);

    const hand = contact(height, i, true), pole = new THREE.Vector3(-.4, -.7, sign * .5);
    const armHold = hold * (1 - smooth(gesture.exit ?? 0, i ? .44 : .28, i ? .86 : .68));
    if (!armHold) continue;
    const shoulder = hero?.bones.get('shoulder_' + side) ?? rig.shoulders[i], elbow = hero?.bones.get('elbow_' + side) ?? rig.elbows[i];
    if (hero) {
      const wrist = hero.bones.get('wrist_' + side)!;
      const palm = new THREE.Vector3(sign * .085, -.23, 0);
      const gripRotation = handRotations[i].clone().slerp(railRotations[i], hand.railHold);
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(gripRotation, armHold);
      const target = wrist.localToWorld(palm.clone()).lerp(hand.point, armHold);
      const offset = palm.multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
      reach(shoulder, elbow, wrist.position, target.sub(offset), pole);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      const grip = 1 - .88 * hand.air;
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) {
        const bone = hero.bones.get(`finger${finger}-${joint}_${side}`)!;
        bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, finger === 1 ? .35 * grip : 0, armHold);
        bone.rotation.y *= 1 - armHold;
        bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, sign * (finger === 1 ? .26 : joint === 1 ? .18 : .85) * grip, armHold);
      }
      wrist.updateWorldMatrix(false, true);
    } else {
      const palm = new THREE.Vector3(0, -.79, .055);
      reach(shoulder, elbow, palm, elbow.localToWorld(palm.clone()).lerp(hand.point, armHold), pole);
      for (const finger of rig.fingers[i]) finger.rotation.x = THREE.MathUtils.lerp(finger.rotation.x, -.85 * (1 - hand.air), armHold);
    }
  }
}
