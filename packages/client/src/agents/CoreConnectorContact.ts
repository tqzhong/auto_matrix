import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import { ConsoleGrip } from './ConsoleGrip.js';
import { reach } from './SpoonPerformance.js';

const grips = new WeakMap<HeroRig, THREE.Quaternion[]>();
const names = Array.from({ length: 5 }, (_, digit) => [1, 2, 3].map(joint => `finger${digit + 1}-${joint}_R`)).flat();
const offset = new THREE.Vector3(.26, -.24, 0);

/** Reach above the chair, then close onto the shaft along its world-X axis. */
export function coreConnectorContact(rig: HeroRig, contact: THREE.Vector3, amount: number): void {
  const root = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)));
  rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -25 * Math.PI / 180));
  const shoulder = rig.bones.get('shoulder_R')!, elbow = rig.bones.get('elbow_R')!, wrist = rig.bones.get('wrist_R')!;
  const start = wrist.getWorldPosition(new THREE.Vector3()), before = wrist.getWorldQuaternion(new THREE.Quaternion());
  const goal = contact.clone().sub(offset.clone().applyQuaternion(rotation));
  // Turn and close behind the cap before sliding onto the actual grip. A
  // radial shortcut cuts through the barrel or folds the arm at the shoulder.
  const enter = THREE.MathUtils.smoothstep(amount, 0, .65), settle = THREE.MathUtils.smoothstep(amount, .65, 1);
  const target = start.lerp(goal.clone().add(new THREE.Vector3(.5, 0, 0)), enter).lerp(goal, settle);
  const shoulderPoint = shoulder.getWorldPosition(new THREE.Vector3());
  const restingDirection = wrist.getWorldPosition(new THREE.Vector3()).sub(shoulderPoint).normalize();
  const restingPole = elbow.getWorldPosition(new THREE.Vector3()).sub(shoulderPoint);
  restingPole.addScaledVector(restingDirection, -restingPole.dot(restingDirection)).normalize();
  const finalDirection = goal.clone().sub(shoulderPoint).normalize(), direction = target.clone().sub(shoulderPoint).normalize();
  const finalPole = new THREE.Vector3(-1, 0, 0).applyQuaternion(root);
  finalPole.addScaledVector(finalDirection, -finalPole.dot(finalDirection)).normalize();
  // Transport the original elbow plane; interpolating pole vectors can pass
  // through a straight line and flip the elbow during the return.
  const transported = restingPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restingDirection, finalDirection));
  const roll = Math.atan2(finalDirection.dot(new THREE.Vector3().crossVectors(transported, finalPole)), transported.dot(finalPole));
  const pole = restingPole.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restingDirection, direction)).applyAxisAngle(direction, roll * amount);
  const orientation = before.slerp(rotation, enter);
  reach(shoulder, elbow, wrist.position, target, pole);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  const axis = wrist.position.clone().normalize(), q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
  const swing = q.clone().multiply(twist.clone().invert()), angle = swing.angleTo(new THREE.Quaternion());
  if (angle > Math.PI / 3) q.copy(new THREE.Quaternion().slerp(swing, Math.PI / 3 / angle)).multiply(twist);
  wrist.updateWorldMatrix(false, true);
  let grip = grips.get(rig);
  if (!grip) {
    // The final palm-relative articulation is fixed. Solve it once, rather
    // than twisting fingers toward the world prop while the wrist is turning.
    const original = names.map(name => rig.bones.get(name)!.quaternion.clone());
    const local = rotation.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2));
    const frame = wrist.matrixWorld.clone().multiply(new THREE.Matrix4().compose(offset, local, new THREE.Vector3(1, 1, 1)));
    new ConsoleGrip(rig).update(rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, 1, 'connector', 1, frame);
    grip = names.map((name, index) => index < 3 ? original[index].clone() : rig.bones.get(name)!.quaternion.clone()); grips.set(rig, grip);
    grip[0].premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.3));
    names.forEach((name, index) => rig.bones.get(name)!.quaternion.copy(original[index]));
  }
  names.forEach((name, index) => rig.bones.get(name)!.quaternion.slerp(grip[index], enter * (index < 3 ? 1 : .96)));
  rig.bones.get('wrist_R')!.updateWorldMatrix(false, true);
}
