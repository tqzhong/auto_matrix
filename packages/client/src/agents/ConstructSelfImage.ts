import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { reach } from './SpoonPerformance.js';

const sleeves = new WeakMap<HeroRig, { mesh: THREE.SkinnedMesh; index: number }>();
const feeling = new WeakMap<HeroRig, Map<string, THREE.Quaternion[]>>();

/** Fit the folded-back sleeve ends once; the GPU applies the saved shape. */
export function prepareConstructSleeves(rig: HeroRig): THREE.BufferGeometry {
  const mesh = rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh, geometry = mesh.geometry.clone(), fitted = geometry.clone();
  const position = geometry.attributes.position, output = fitted.attributes.position, moved = new Set<number>();
  for (const side of ['R', 'L']) {
    const joint = mesh.skeleton.bones.indexOf(rig.bones.get(`wrist_${side}`)!), toWrist = mesh.skeleton.boneInverses[joint].clone().multiply(mesh.bindMatrix), back = toWrist.clone().invert();
    const axis = rig.bones.get(`wrist_${side}`)!.position.clone().normalize(), point = new THREE.Vector3();
    for (let id = 0; id < position.count; id++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) {
        const bone = mesh.skeleton.bones[geometry.attributes.skinIndex.getComponent(id, k)].name;
        if (bone === `elbow_${side}` || bone === `wrist_${side}` || bone.startsWith(`forearm_twist_${side}_`)) weight += geometry.attributes.skinWeight.getComponent(id, k);
      }
      if (weight < .5) continue;
      point.fromBufferAttribute(position, id).applyMatrix4(toWrist);
      const along = point.dot(axis), radius = point.clone().addScaledVector(axis, -along).length();
      const amount = THREE.MathUtils.smoothstep(along, -.3, -.02);
      if (!amount || radius > .3) continue;
      point.addScaledVector(axis, -.16 * amount).applyMatrix4(back); output.setXYZ(id, point.x, point.y, point.z); moved.add(id);
    }
  }
  fitted.computeVertexNormals();
  const normal = geometry.attributes.normal, changedNormals = new Set(moved), index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const face = [0, 1, 2].map(k => index.getX(i + k)); if (face.some(id => moved.has(id))) face.forEach(id => changedNormals.add(id));
  }
  const relative = geometry.morphTargetsRelative, shape = output.clone(), normals = normal.clone();
  for (let id = 0; id < position.count; id++) for (let k = 0; k < 3; k++) {
    shape.setComponent(id, k, output.getComponent(id, k) - (relative ? position.getComponent(id, k) : 0));
    normals.setComponent(id, k, (changedNormals.has(id) ? fitted.attributes.normal : normal).getComponent(id, k) - (relative ? normal.getComponent(id, k) : 0));
  }
  shape.name = normals.name = 'construct-sleeve-ends';
  (geometry.morphAttributes.position ??= []).push(shape); (geometry.morphAttributes.normal ??= []).push(normals); fitted.dispose();
  const previous = mesh.morphTargetInfluences?.slice(); mesh.geometry = geometry; mesh.updateMorphTargets();
  previous?.forEach((value, i) => { mesh.morphTargetInfluences![i] = value; });
  sleeves.set(rig, { mesh, index: mesh.morphTargetDictionary!['construct-sleeve-ends'] }); return geometry;
}

export function poseConstructSleeves(rig: HeroRig, input: MotionInput): void {
  const fitted = sleeves.get(rig); if (!fitted) return;
  fitted.mesh.morphTargetInfluences![fitted.index] = input.performance === 'construct' || input.construct?.role === 'neo' || input.reveal?.role === 'neo'
    || input.truth?.role === 'neo' && (input.truth.phase === 'ready' || input.truth.phase === 'exit') ? 1 : 0;
}

function feelingHand(rig: HeroRig, side: 'R' | 'L', amount: number): void {
  if (!amount) return;
  let hands = feeling.get(rig); if (!hands) feeling.set(rig, hands = new Map());
  let target = hands.get(side);
  if (!target) {
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, attributes = skin.geometry.attributes, sign = side === 'R' ? 1 : -1;
    const tips = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0], point = new THREE.Vector3();
    const distal = new Map(tips.map((_, digit) => [skin.skeleton.bones.indexOf(rig.bones.get(`finger${digit + 1}-3_${side}`)!), digit]));
    for (let id = 0; id < attributes.position.count; id++) for (let k = 0; k < 4; k++) {
      if (attributes.skinWeight.getComponent(id, k) <= .95) continue;
      const joint = attributes.skinIndex.getComponent(id, k), digit = distal.get(joint); if (digit === undefined) continue;
      tips[digit].add(point.fromBufferAttribute(attributes.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint])); counts[digit]++; break;
    }
    target = [];
    for (let digit = 1; digit <= 5; digit++) {
      const names = [1, 2, 3].map(joint => `finger${digit}-${joint}_${side}`), pad = tips[digit - 1].divideScalar(counts[digit - 1]);
      const axes = [rig.rest.get(names[1])!, rig.rest.get(names[2])!, pad], parent = new THREE.Quaternion();
      const thumbDirections = [[.83, -.5, .23], [.65, -.73, -.21], [-.1, -.45, -.88]];
      const joints = axes.map((axis, joint) => {
        const direction = digit === 1 ? new THREE.Vector3(sign * thumbDirections[joint][0], thumbDirections[joint][1], thumbDirections[joint][2]) : new THREE.Vector3(sign * [.02, .06, .1][joint], -1, 0);
        const world = new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(), direction.normalize()), local = parent.clone().invert().multiply(world); parent.copy(world);
        return digit === 1 ? new THREE.Quaternion().slerp(local, .2 * .2) : local;
      });
      if (digit === 1) {
        // Keep the relaxed thumb articulation, then open it beside the palm.
        // An opposed fist thumb would dig into the other forearm or nape.
        joints[0].premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * .55 * Math.sin(Math.PI * .2)));
        joints[0].premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * .14 * .2));
        joints[0].premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * 1.2));
      }
      target.push(...joints);
    }
    hands.set(side, target);
  }
  for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
    rig.bones.get(`finger${digit}-${joint}_${side}`)!.quaternion.slerp(target[(digit - 1) * 3 + joint - 1], amount);
  rig.bones.get(`wrist_${side}`)!.updateWorldMatrix(false, true);
}

function hand(rig: HeroRig, side: 'R' | 'L', point: THREE.Vector3, orientation: THREE.Quaternion, pole: THREE.Vector3, amount: number): void {
  if (!amount) return;
  const shoulder = rig.bones.get(`shoulder_${side}`)!, elbow = rig.bones.get(`elbow_${side}`)!, wrist = rig.bones.get(`wrist_${side}`)!;
  const before = wrist.quaternion.clone(), start = wrist.getWorldPosition(new THREE.Vector3());
  const pad = new THREE.Vector3(side === 'R' ? .09 : -.07, -.18, 0);
  const goal = point.sub(pad.applyQuaternion(orientation)), target = start.clone().lerp(goal, amount);
  // Keep the wrist outside the torso and shoulder before settling onto skin.
  const arc = side === 'L' ? new THREE.Vector3(.2, 0, -.6) : new THREE.Vector3(0, .35, .2);
  target.add(arc.applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(Math.sin(Math.PI * amount)));
  const origin = shoulder.getWorldPosition(new THREE.Vector3()), restDirection = start.sub(origin).normalize();
  const restPole = elbow.getWorldPosition(new THREE.Vector3()).sub(origin); restPole.addScaledVector(restDirection, -restPole.dot(restDirection)).normalize();
  const finalDirection = goal.clone().sub(origin).normalize(), direction = target.clone().sub(origin).normalize();
  pole.addScaledVector(finalDirection, -pole.dot(finalDirection)).normalize();
  const transported = restPole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restDirection, finalDirection));
  const roll = Math.atan2(finalDirection.dot(new THREE.Vector3().crossVectors(transported, pole)), transported.dot(pole));
  const bend = restPole.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(restDirection, direction)).applyAxisAngle(direction, roll * amount);
  reach(shoulder, elbow, wrist.position, target, bend);
  const local = elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation);
  wrist.quaternion.copy(before.slerp(local, THREE.MathUtils.smoothstep(amount, .55, 1)));
  const axis = wrist.position.clone().normalize(), q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
  const swing = q.clone().multiply(twist.clone().invert()), angle = swing.angleTo(new THREE.Quaternion());
  if (angle > Math.PI / 3) q.copy(new THREE.Quaternion().slerp(swing, Math.PI / 3 / angle)).multiply(twist);
  wrist.updateWorldMatrix(false, true);
}

/** Neo first checks the clothed forearm, then feels the absent jack with his left hand. */
export function inspectConstructImage(rig: HeroRig, elapsed: number): void {
  const smooth = THREE.MathUtils.smoothstep, forearm = smooth(elapsed, .3, 1) * (1 - smooth(elapsed, 2.1, 2.8));
  const neck = smooth(elapsed, 2.4, 3.6) * (1 - smooth(elapsed, 5, 6));
  rig.root.updateWorldMatrix(true, true);
  const root = rig.root.getWorldQuaternion(new THREE.Quaternion());
  feelingHand(rig, 'R', forearm); feelingHand(rig, 'L', neck);
  if (forearm) {
    const elbow = rig.bones.get('elbow_L')!.getWorldPosition(new THREE.Vector3()), wrist = rig.bones.get('wrist_L')!.getWorldPosition(new THREE.Vector3());
    const axis = wrist.clone().sub(elbow).normalize(), normal = new THREE.Vector3(0, 1, 0).applyQuaternion(root);
    normal.addScaledVector(axis, -normal.dot(axis)).normalize();
    const x = normal.clone().negate(), y = new THREE.Vector3(-1, 0, 0).applyQuaternion(root); y.addScaledVector(x, -y.dot(x)).normalize();
    const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)));
    hand(rig, 'R', elbow.lerp(wrist, .7).addScaledVector(normal, .13), orientation, new THREE.Vector3(-.8, -1, .6).applyQuaternion(root), forearm);
  }
  if (neck) {
    const head = rig.bones.get('head')!, point = head.localToWorld(new THREE.Vector3(0, 0, -.22)), angle = 25 * Math.PI / 180;
    const frame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0)));
    const orientation = head.getWorldQuaternion(new THREE.Quaternion()).multiply(frame);
    hand(rig, 'L', point, orientation, new THREE.Vector3(1, 1, -.2).applyQuaternion(root), neck);
  }
}
