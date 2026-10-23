import * as THREE from 'three';
import { COMBAT_SKILLS, MELEE_COMBO } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput, MotionState } from './CharacterMotion.js';

const start = new THREE.Vector3(), middle = new THREE.Vector3(), end = new THREE.Vector3();
const direction = new THREE.Vector3(), bend = new THREE.Vector3(), hinge = new THREE.Vector3();
const target = new THREE.Vector3(), pole = new THREE.Vector3(), point = new THREE.Vector3();
const axis = new THREE.Vector3(), rotation = new THREE.Quaternion(), rootRotation = new THREE.Quaternion();
const footRotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion();
const firstRotation = new THREE.Quaternion(), secondRotation = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);

function placeLimb(root: THREE.Group, first: THREE.Bone, second: THREE.Bone, last: THREE.Bone, weight: number): void {
  firstRotation.copy(first.quaternion); secondRotation.copy(second.quaternion);
  root.worldToLocal(first.getWorldPosition(start));
  root.worldToLocal(second.getWorldPosition(middle));
  root.worldToLocal(last.getWorldPosition(end));
  const upper = start.distanceTo(middle), lower = middle.distanceTo(end);
  direction.copy(target).sub(start);
  const reach = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
  direction.normalize(); target.copy(start).addScaledVector(direction, reach);
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  bend.copy(pole).addScaledVector(direction, -pole.dot(direction)).normalize();
  hinge.copy(start).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
  const aim = (joint: THREE.Bone, child: THREE.Bone, at: THREE.Vector3) => {
    joint.parent!.worldToLocal(root.localToWorld(point.copy(at))).sub(joint.position).normalize();
    joint.quaternion.setFromUnitVectors(axis.copy(child.position).normalize(), point);
    joint.updateWorldMatrix(false, true);
  };
  aim(first, second, hinge); aim(second, last, target);
  // Blend the joints themselves: changing only the target
  // position leaves a different elbow/knee plane even at nearly zero weight.
  first.quaternion.slerp(firstRotation, 1 - weight); second.quaternion.slerp(secondRotation, 1 - weight);
  first.updateWorldMatrix(false, true);
}

/** The training guard uses the delivered limb lengths. Movement, evasions and
 * the raised kicking leg blend back to their ordinary authored trajectories. */
export function poseDojoStance(rig: HeroRig, input: MotionInput, motion: MotionState): void {
  if (!input.dojoSparring || !input.dojoOutfit || !input.grounded || input.armed) return;
  const smooth = THREE.MathUtils.smoothstep;
  const dodge = motion.skill === 'dodge' ? smooth(motion.skillAge, 0, .08) * (1 - smooth(motion.skillAge, COMBAT_SKILLS.dodge.duration, COMBAT_SKILLS.dodge.duration + .25)) : 0;
  const weight = (1 - smooth(motion.speed, .2, 2.2)) * (1 - dodge) * smooth(motion.hitAge, 0, .35);
  if (weight <= 0) return;
  const strike = MELEE_COMBO[motion.combo];
  const attack = smooth(motion.attackAge, 0, .06) * (1 - smooth(motion.attackAge, strike.duration, strike.duration + .2));
  const feet = weight * (motion.combo === 2 ? 1 - attack : 1), turn = weight * (1 - attack);
  const bone = (name: string) => rig.bones.get(name)!;
  bone('pelvis').position.y -= .1 * feet;
  bone('pelvis').rotation.y -= .08 * turn; bone('spine').rotation.y -= .08 * turn;
  bone('chest').rotation.y -= .16 * turn; bone('head').rotation.y += .32 * turn;
  rig.root.updateWorldMatrix(true, true); rig.root.getWorldQuaternion(rootRotation);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1, ankle = bone('ankle_' + side);
    if (feet > 0) {
      ankle.getWorldQuaternion(footRotation);
      target.set(rig.rest.get('hip_' + side)!.x + sign * .14, rig.footHeight, i ? -.32 : .38);
      pole.set(sign * .12, 0, 1);
      placeLimb(rig.root, bone('hip_' + side), bone('knee_' + side), ankle, feet);
      rotation.setFromAxisAngle(up, i ? -.2 : .04).premultiply(rootRotation);
      footRotation.slerp(rotation, feet);
      ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(parentRotation).invert().multiply(footRotation));
      ankle.updateWorldMatrix(false, true);
    }
    const hand = weight * (motion.combo === i && motion.combo !== 2 ? 1 - attack : 1);
    if (hand <= 0) continue;
    const shoulder = bone('shoulder_' + side), wrist = bone('wrist_' + side);
    rig.root.worldToLocal(shoulder.getWorldPosition(point));
    target.set(sign * .36, point.y - (i ? .28 : .09), i ? .7 : .9);
    pole.set(sign * .7, -.8, -.12);
    placeLimb(rig.root, shoulder, bone('elbow_' + side), wrist, hand);
  }
}
