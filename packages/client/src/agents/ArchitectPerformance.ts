import * as THREE from 'three';
import { ARCHITECT_ROOM, FILM_SETS, architectDoorAngle, type ArchitectGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { crosscutPalm } from './CrosscutPerformance.js';

const seatedPoses = new WeakMap<CharacterRig, { elapsed: number; joints: { node: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }[] }>();
const bootPoints = new WeakMap<CharacterRig, THREE.Vector3[][]>();

export function architectSeatedPoseActive(rig: CharacterRig): boolean { return seatedPoses.has(rig); }

function supportArchitectFeet(rig: CharacterRig): void {
  let feet = bootPoints.get(rig);
  if (!feet) {
    const shoes = rig.detail.getObjectByName('architect-work-boots');
    if (!(shoes instanceof THREE.SkinnedMesh)) return;
    const attrs = shoes.geometry.attributes;
    feet = ['R', 'L'].map(side => {
      const joint = shoes.skeleton.bones.findIndex(bone => bone.name === 'ankle_' + side), points = [];
      for (let vertex = 0; vertex < attrs.position.count; vertex++) {
        if (![0, 1, 2, 3].some(part => attrs.skinIndex.getComponent(vertex, part) === joint && attrs.skinWeight.getComponent(vertex, part) > .999)) continue;
        points.push(new THREE.Vector3().fromBufferAttribute(attrs.position, vertex).applyMatrix4(shoes.bindMatrix).applyMatrix4(shoes.skeleton.boneInverses[joint]));
      }
      return points;
    });
    bootPoints.set(rig, feet);
  }
  rig.root.updateWorldMatrix(true, true);
  const inverse = rig.root.matrixWorld.clone().invert(), transform = new THREE.Matrix4(), sample = new THREE.Vector3();
  let minimum = Infinity;
  for (let side = 0; side < 2; side++) {
    transform.multiplyMatrices(inverse, rig.ankles[side].matrixWorld);
    for (const point of feet[side]) minimum = Math.min(minimum, sample.copy(point).applyMatrix4(transform).y);
  }
  if (minimum < 0) { rig.detail.position.y -= minimum; rig.root.updateWorldMatrix(true, true); }
}

export function poseArchitect(rig: CharacterRig, gesture?: ArchitectGesture, delta = 0): void {
  if (rig.architectThumbs) {
    rig.architectThumbs.forEach(thumb => thumb.quaternion.identity());
    for (const hand of [...rig.fingers, rig.architectThumbs]) for (const digit of hand)
      for (const part of ['mid', 'tip']) digit.getObjectByName(`architect-${part}`)?.quaternion.identity();
  }
  if (!gesture) {
    if (rig.architectPen) rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity());
    const previous = seatedPoses.get(rig);
    if (previous) {
      previous.elapsed += delta;
      const amount = THREE.MathUtils.smoothstep(previous.elapsed, 0, .4), target = new THREE.Quaternion();
      if (amount < 1) for (const joint of previous.joints) {
        joint.node.position.lerpVectors(joint.position, joint.node.position, amount);
        target.copy(joint.node.quaternion); joint.node.quaternion.copy(joint.quaternion).slerp(target, amount);
      }
      else seatedPoses.delete(rig);
      rig.root.updateWorldMatrix(true, true);
      supportArchitectFeet(rig);
    }
    return;
  }
  if (gesture.role === 'architect' && !rig.hero) {
    // AgentRenderer already offsets the character root by -1, matching the
    // film set floor. Do not apply that offset a second time inside the rig.
    rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
    const hipHeight = ARCHITECT_ROOM.chair.seat + .31;
    rig.torso.position.set(0, hipHeight, -.06); rig.torso.rotation.set(-.045, 0, 0);
    rig.head.rotation.set(.045, Math.sin(gesture.elapsed * .3) * .025, 0);
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.detail.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      rig.hips[i].position.set(sign * .225, hipHeight, -.06); rig.hips[i].updateWorldMatrix(false, true);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position,
        rig.detail.localToWorld(new THREE.Vector3(sign * .32, .16, 1.02)), new THREE.Vector3(sign * .1, .3, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      rig.ankles[i].updateWorldMatrix(false, true);
      const wrist = rig.mobilWrists![i], palm = new THREE.Vector3(0, -.14, -.05);
      const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i ? 0 : .6))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      const contact = rig.detail.localToWorld(new THREE.Vector3(sign * .84, ARCHITECT_ROOM.chair.arm + (i ? .0715 : .18), i ? .73 : .28));
      reach(rig.shoulders[i], rig.elbows[i], wrist.position,
        contact.sub(palm.applyQuaternion(orientation)), new THREE.Vector3(sign * (i ? .65 : .3), -1, -.35).applyQuaternion(rotation));
      wrist.quaternion.copy(rig.elbows[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      wrist.updateWorldMatrix(false, true);
      rig.fingers[i].forEach((finger, digit) => {
        finger.rotation.x = i ? -.04 : digit === 3 ? .1125 : .1575;
        const middle = finger.getObjectByName('architect-mid'), tip = finger.getObjectByName('architect-tip');
        if (middle) middle.rotation.x = i ? 0 : .36;
        if (tip) tip.rotation.x = i ? 0 : .2475;
      });
      rig.architectThumbs?.[i].rotation.set(0, i ? .7 : 0, i ? 0 : -.3);
    }
    if (rig.architectPen) {
      const grip = rig.mobilWrists![0].localToWorld(new THREE.Vector3(.089294, -.138959, -.026224));
      rig.architectPen.rotation.set(.05, 0, -.1);
      rig.architectPen.position.copy(rig.detail.worldToLocal(grip)).add(new THREE.Vector3(0, .05, 0).applyEuler(rig.architectPen.rotation));
    }
  } else if (gesture.role === 'neo' && rig.hero && gesture.opening !== undefined && gesture.opening < .65) {
    const room = ARCHITECT_ROOM, c = FILM_SETS.film_architect_room.center;
    const angle = architectDoorAngle({ phase: 'decision', sourceReviewed: true, trinityReviewed: true, remaining: 45, lastTick: 0, attempts: 0,
      room: { elapsed: gesture.elapsed, chairYaw: 0, exit: { elapsed: gesture.opening, x: 0, z: 0 } } });
    const length = room.doorWidth - .66;
    const contact = new THREE.Vector3(c.x + room.doors.matrix.x - room.doorWidth / 2 + length * Math.cos(angle) + .21 * Math.sin(angle),
      c.y - 1 + 3.05, c.z + room.doors.matrix.z - length * Math.sin(angle) + .21 * Math.cos(angle));
    const wrist = rig.hero.bones.get('wrist_R')!;
    rig.root.updateWorldMatrix(true, true);
    const hand = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
    hand.lerp(contact, THREE.MathUtils.smoothstep(gesture.opening, 0, .35)); crosscutPalm(rig, 'R', hand);
  }
  rig.root.updateWorldMatrix(true, true);
  if (gesture.role === 'architect' && !rig.hero) {
    const hands = [...rig.fingers.flat(), ...(rig.architectThumbs ?? [])];
    const nodes = [rig.detail, rig.torso, rig.head, ...rig.hips, ...rig.knees, ...rig.ankles,
      ...rig.shoulders, ...rig.elbows, ...(rig.mobilWrists ?? []), ...hands];
    for (const hand of hands) for (const part of ['mid', 'tip']) {
      const joint = hand.getObjectByName(`architect-${part}`); if (joint) nodes.push(joint);
    }
    seatedPoses.set(rig, { elapsed: 0, joints: nodes.map(node => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone() })) });
  }
}
