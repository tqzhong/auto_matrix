import * as THREE from 'three';
import { MIRROR_TIMING } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

export function trackingContact(subject: THREE.Object3D): THREE.Vector3 | undefined {
  const elbow = subject.getObjectByName('elbow_L'), wrist = subject.getObjectByName('wrist_L');
  if (!elbow || !wrist) return;
  return elbow.getWorldPosition(new THREE.Vector3()).lerp(wrist.getWorldPosition(new THREE.Vector3()), .35).add(new THREE.Vector3(0, .13, 0));
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
