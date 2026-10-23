import * as THREE from 'three';
import { CONSTRUCT, FILM_SETS } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

const fingers = new WeakMap<HeroRig, Map<string, THREE.Quaternion[]>>();

export function supportedHand(rig: HeroRig, side: 'R' | 'L', point: THREE.Vector3, normal: THREE.Vector3, amount: number, elbowPole = new THREE.Vector3(0, -.5, 1)): void {
  const shoulder = rig.bones.get(`shoulder_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!, wrist = rig.bones.get(`wrist_${side}`)!;
  const sign = side === 'R' ? 1 : -1, start = wrist.getWorldPosition(new THREE.Vector3()), rest = wrist.quaternion.clone();
  const offset = new THREE.Vector3(sign * .05575, -.19105, .00371);
  const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(normal.clone().multiplyScalar(sign),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3().crossVectors(normal.clone().multiplyScalar(sign), new THREE.Vector3(0, 0, 1))));
  const goal = point.clone().sub(offset.applyQuaternion(orientation)), control = new THREE.Vector3(goal.x, goal.y + .7, start.z - .7);
  // Lift outside the padding before reaching across its crown. Release follows
  // the same clear path, including when loading a saved moment halfway through.
  const target = start.clone().multiplyScalar((1 - amount) ** 2).addScaledVector(control, 2 * (1 - amount) * amount).addScaledVector(goal, amount * amount);
  const origin = shoulder.getWorldPosition(new THREE.Vector3()), restDirection = start.sub(origin).normalize();
  const direction = target.clone().sub(origin).normalize(), finalDirection = goal.clone().sub(origin).normalize();
  const restPole = elbow.getWorldPosition(new THREE.Vector3()).sub(origin); restPole.addScaledVector(restDirection, -restPole.dot(restDirection)).normalize();
  const pole = elbowPole.clone(); pole.addScaledVector(finalDirection, -pole.dot(finalDirection)).normalize();
  const transported = restPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restDirection, finalDirection));
  const roll = Math.atan2(finalDirection.dot(new THREE.Vector3().crossVectors(transported, pole)), transported.dot(pole));
  const bend = restPole.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restDirection, direction)).applyAxisAngle(direction, roll * amount);
  reach(shoulder, elbow, wrist.position, target, bend);
  const local = elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation);
  wrist.quaternion.copy(rest.slerp(local, THREE.MathUtils.smoothstep(amount, .55, 1)));
  const axis = wrist.position.clone().normalize(), q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
  const swing = q.clone().multiply(twist.clone().invert()), angle = swing.angleTo(new THREE.Quaternion()), limit = Math.PI / 3;
  if (angle > limit) q.copy(new THREE.Quaternion().slerp(swing, limit / angle)).multiply(twist);
  shoulder.updateWorldMatrix(true, true);
  let hands = fingers.get(rig); if (!hands) fingers.set(rig, hands = new Map()); let targets = hands.get(side);
  if (!targets) {
    targets = [];
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
    const tips = Array.from({ length: 4 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0], vertex = new THREE.Vector3();
    const distal = new Map(tips.map((_, i) => [skin.skeleton.bones.indexOf(rig.bones.get(`finger${i + 2}-3_${side}`)!), i]));
    for (let id = 0; id < a.position.count; id++) for (let k = 0; k < 4; k++) {
      const joint = a.skinIndex.getComponent(id, k), digit = distal.get(joint);
      if (digit === undefined || a.skinWeight.getComponent(id, k) <= .95) continue;
      tips[digit].add(vertex.fromBufferAttribute(a.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint])); counts[digit]++; break;
    }
    for (let digit = 2; digit <= 5; digit++) {
      const axes = [rig.rest.get(`finger${digit}-2_${side}`)!, rig.rest.get(`finger${digit}-3_${side}`)!, tips[digit - 2].divideScalar(counts[digit - 2])];
      const parent = new THREE.Quaternion();
      axes.forEach((axis, j) => {
        const world = new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(), new THREE.Vector3(sign * [.05, .25, .45][j], -1, 0).normalize());
        targets!.push(parent.clone().invert().multiply(world)); parent.copy(world);
      });
    }
    hands.set(side, targets);
  }
  for (let digit = 2; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
    rig.bones.get(`finger${digit}-${joint}_${side}`)!.quaternion.slerp(targets[(digit - 2) * 3 + joint - 1], amount);
  rig.bones.get(`finger1-1_${side}`)!.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * 1.2 * amount));
  wrist.updateWorldMatrix(false, true);
}

/** Both real palms settle onto the crown before the fingers curl over its front. */
export function touchConstructChair(rig: HeroRig, elapsed: number): void {
  const amount = THREE.MathUtils.smoothstep(elapsed, 0, 2.3) * (1 - THREE.MathUtils.smoothstep(elapsed, 7, 9)); if (!amount) return;
  rig.root.updateWorldMatrix(true, true);
  const center = FILM_SETS.film_white_construct.center, scale = CONSTRUCT.chair.scale;
  for (const [side, u] of [['L', .4], ['R', .9]] as const) {
    const x = CONSTRUCT.chairX.neo + u * (1.56 + .22 * Math.sin(Math.PI * .85)) * scale, y = (1.45 + 3.5 + .4 * (1 - u * u)) * scale;
    const z = CONSTRUCT.chair.z + (.94 + .55 - .62 * u ** 4 * Math.sin(Math.PI * .9)) * scale;
    supportedHand(rig, side, new THREE.Vector3(center.x + x, center.y - 1 + y + .05, center.z + z),
      new THREE.Vector3(-.8 * u / (1.56 + .22 * Math.sin(Math.PI * .85)), -1, 0).normalize(), amount);
  }
}
