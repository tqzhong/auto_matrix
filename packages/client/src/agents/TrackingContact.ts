import * as THREE from 'three';
import { MIRROR_TIMING, mirrorEntryPose, type AwakeningBeat } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { reach } from './SpoonPerformance.js';

export function trackingContact(subject: THREE.Object3D): THREE.Vector3 | undefined {
  const elbow = subject.getObjectByName('elbow_L'), wrist = subject.getObjectByName('wrist_L');
  if (!elbow || !wrist) return;
  return elbow.getWorldPosition(new THREE.Vector3()).lerp(wrist.getWorldPosition(new THREE.Vector3()), .35).add(new THREE.Vector3(0, .13, 0));
}

export function placeTrackingFeet(rig: HeroRig, time: number = MIRROR_TIMING.sit, entry?: AwakeningBeat): void {
  const seated = THREE.MathUtils.smoothstep(time, .65, MIRROR_TIMING.sit);
  if (!seated && !entry) return;
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const root = rig.root.getWorldPosition(new THREE.Vector3()), floor = root.y + rig.footHeight + .015;
  const pose = entry && mirrorEntryPose(entry);
  if (pose?.sideways) {
    // A narrow sidestep needs a tall support leg, rather than a running knee
    // swinging into the nearby glass. Height comes from the shipped leg lengths.
    let rise = Infinity;
    for (const side of ['R', 'L'] as const) {
      const foot = pose.feet[side]; if (foot.lift > .001) continue;
      const hip = rig.bones.get('hip_' + side)!, knee = rig.bones.get('knee_' + side)!, ankle = rig.bones.get('ankle_' + side)!;
      const at = hip.getWorldPosition(new THREE.Vector3()), length = knee.position.length() + ankle.position.length() - .025;
      const horizontal = (root.x - pose.x + foot.x - at.x) ** 2 + (root.z - pose.z + foot.z - at.z) ** 2;
      rise = Math.min(rise, floor + Math.sqrt(Math.max(0, length ** 2 - horizontal)) - at.y);
    }
    rig.bones.get('pelvis')!.position.y += Math.max(0, Math.min(.2, rise)) * pose.sideways;
    rig.root.updateWorldMatrix(true, true);
  }
  for (const side of ['R', 'L']) {
    const hip = rig.bones.get('hip_' + side)!, knee = rig.bones.get('knee_' + side)!, ankle = rig.bones.get('ankle_' + side)!;
    const target = ankle.getWorldPosition(new THREE.Vector3()); target.y = THREE.MathUtils.lerp(target.y, floor, seated);
    const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, seated);
    if (pose) {
      const foot = pose.feet[side as 'R' | 'L'];
      target.set(root.x - pose.x + foot.x, floor + foot.lift, root.z - pose.z + foot.z);
      orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), foot.yaw);
    }
    reach(hip, knee, ankle.position, target, new THREE.Vector3(0, .1, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    ankle.updateWorldMatrix(false, true);
  }
}

export function wireTrackingElectrode(rig: HeroRig, time: number, contact: { x: number; y: number; z: number }): void {
  const blend = THREE.MathUtils.smoothstep(time, MIRROR_TIMING.sit, 1.9) * (1 - THREE.MathUtils.smoothstep(time, MIRROR_TIMING.wired, 3.25));
  if (!blend) return;
  // Lower through the knees rather than folding the head into Neo's eyeline.
  // Preserve the grounded soles while the arm solver keeps the pad in reach.
  const ankleHeight = () => Math.min(...['L', 'R'].map(side =>
    rig.root.worldToLocal(rig.bones.get('ankle_' + side)!.getWorldPosition(new THREE.Vector3())).y));
  const floor = ankleHeight();
  for (const side of ['L', 'R']) {
    rig.bones.get('hip_' + side)!.rotation.x -= blend * .32;
    rig.bones.get('knee_' + side)!.rotation.x += blend * .64;
    rig.bones.get('ankle_' + side)!.rotation.x -= blend * .32;
  }
  rig.root.updateWorldMatrix(true, true);
  rig.bones.get('pelvis')!.position.y += floor - ankleHeight();
  rig.bones.get('spine')!.rotation.x += blend * .23; rig.bones.get('chest')!.rotation.x += blend * .27;
  rig.bones.get('head')!.rotation.x += blend * .18;
  rig.root.updateWorldMatrix(true, true);
  const shoulder = rig.bones.get('shoulder_R')!, elbow = rig.bones.get('elbow_R')!, wrist = rig.bones.get('wrist_R')!;
  const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const rotation = rootRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)));
  const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(rotation, blend);
  const palm = new THREE.Vector3(.09, -.18, .02);
  const target = wrist.localToWorld(palm.clone()).lerp(new THREE.Vector3(contact.x, contact.y, contact.z), blend)
    .sub(palm.applyQuaternion(orientation));
  const start = shoulder.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const a = elbow.position.length(), b = wrist.position.length();
  const reach = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
  target.copy(start).addScaledVector(direction, reach);
  const along = (a * a - b * b + reach * reach) / (2 * reach);
  const pole = new THREE.Vector3(-.4, -1, -.1).applyQuaternion(rootRotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
    joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
    joint.updateWorldMatrix(false, true);
  };
  aim(shoulder, elbow, hinge); aim(elbow, wrist, target);
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const joint = rig.bones.get(`finger${finger}-${segment}_R`)!;
    joint.rotation.x = finger === 1 ? .28 * blend : 0;
    joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, segment === 1 ? .2 : .12, blend);
  }
}
