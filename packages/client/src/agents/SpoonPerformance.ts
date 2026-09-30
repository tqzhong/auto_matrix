import * as THREE from 'three';
import { FILM_SETS, SPOON_LESSON, spoonLessonSeat, type SpoonGesture } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import type { CharacterRig } from './CharacterModel.js';

const smooth = THREE.MathUtils.smoothstep;

function aim(joint: THREE.Object3D, child: THREE.Vector3, point: THREE.Vector3): void {
  joint.quaternion.setFromUnitVectors(child.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize());
  joint.updateWorldMatrix(false, true);
}

// Used by the adult's skinned wrist and the child's procedural forearm.
export function reach(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3): void {
  const start = upper.getWorldPosition(new THREE.Vector3()), direction = target.clone().sub(start);
  const scale = upper.getWorldScale(new THREE.Vector3()).x;
  const a = lower.position.length() * scale, b = end.length() * scale;
  const length = THREE.MathUtils.clamp(direction.length(), .01, a + b - .001); direction.normalize();
  target = start.clone().addScaledVector(direction, length);
  const along = (a * a - b * b + length * length) / (2 * length);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  aim(upper, lower.position, hinge); aim(lower, end, target);
}

export function poseSpoonBody(rig: HeroRig, gesture?: SpoonGesture): void {
  if (!gesture || gesture.role !== 'neo') return;
  const seat = spoonLessonSeat(gesture); if (!seat) return;
  const bone = (name: string) => rig.bones.get(name)!;
  rig.root.updateWorldMatrix(true, true);
  const feet = ['R', 'L'].map(side => rig.root.worldToLocal(bone(`ankle_${side}`).getWorldPosition(new THREE.Vector3())));
  const pelvis = bone('pelvis'); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .65, seat);
  bone('spine').rotation.x += .08 * seat; bone('head').rotation.x += .12 * seat;
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1, upper = bone(`hip_${side}`), lower = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    const foot = feet[i].lerp(new THREE.Vector3(sign * .13, rig.footHeight + .055, i ? .78 : 1.12), seat);
    reach(upper, lower, ankle.position, rig.root.localToWorld(foot), new THREE.Vector3(sign, .35, .18).applyQuaternion(rotation));
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sign * Math.PI / 2 * seat));
    ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    ankle.updateWorldMatrix(false, true);
  }
}

export function poseSpoonHands(rig: CharacterRig, gesture?: SpoonGesture): void {
  if (!gesture) return;
  const { phase, elapsed: t, role } = gesture;
  const offered = role === 'boy' ? phase === 'demonstrating' ? smooth(t, 1.8, 3.2) : phase === 'offered' ? 1 : phase === 'receiving' ? 1 - smooth(t, SPOON_LESSON.transfer, SPOON_LESSON.transfer + .65) : 0
    : phase === 'receiving' ? t <= SPOON_LESSON.transfer ? smooth(t, 0, SPOON_LESSON.transfer) : 1 - smooth(t, SPOON_LESSON.transfer, SPOON_LESSON.receiving) : 0;
  const center = FILM_SETS.film_oracle_home.center;
  const contact = new THREE.Vector3(center.x + SPOON_LESSON.contact.x, center.y - 1 + SPOON_LESSON.contact.y, center.z + SPOON_LESSON.contact.z);
  const upright = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SPOON_LESSON.neo.yaw);
  rig.root.updateWorldMatrix(true, true);
  if (rig.hero) {
    const bones = rig.hero.bones, wrist = bones.get('wrist_R')!, elbow = bones.get('elbow_R')!, shoulder = bones.get('shoulder_R')!;
    if (phase === 'receiving') for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      bones.get(`finger${finger}-${segment}_R`)!.rotation.z = finger === 1 ? segment === 1 ? -.28 : .35 : segment === 1 ? .5 : .75;
    wrist.updateWorldMatrix(true, true);
    const pinch = wrist.worldToLocal(bones.get('finger1-3_R')!.localToWorld(new THREE.Vector3(.02, -.02, .012))
      .lerp(bones.get('finger2-3_R')!.localToWorld(new THREE.Vector3(.015, -.015, 0)), .5));
    if (offered > 0) {
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(upright.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -2.17)), offered);
      const target = wrist.localToWorld(pinch.clone()).lerp(contact, offered).sub(pinch.clone().applyQuaternion(orientation));
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-.7, -.8, .1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
    }
    if (rig.spoon?.root.visible) {
      rig.spoon.root.rotation.set(2.17, 0, 0);
      rig.spoon.root.scale.setScalar(.55 / wrist.getWorldScale(new THREE.Vector3()).x);
      rig.spoon.root.position.copy(pinch.sub(new THREE.Vector3(0, .08, 0).multiply(rig.spoon.root.scale).applyQuaternion(rig.spoon.root.quaternion)));
    }
  } else {
    const elbow = rig.elbows[0], palm = new THREE.Vector3(0, -.79, .055);
    const grip = contact.clone().add(new THREE.Vector3(0, (.44 - .08) * .55, 0));
    if (offered > 0) reach(rig.shoulders[0], elbow, palm, elbow.localToWorld(palm.clone()).lerp(grip, offered),
      new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    if (rig.spoon?.root.visible) {
      const spoon = rig.spoon.root, parentRotation = elbow.getWorldQuaternion(new THREE.Quaternion());
      const rotation = parentRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 2.17)).slerp(upright, offered);
      spoon.quaternion.copy(parentRotation.invert().multiply(rotation)); spoon.scale.setScalar(.55 / elbow.getWorldScale(new THREE.Vector3()).x);
      spoon.position.copy(palm).sub(new THREE.Vector3(0, .44, 0).multiply(spoon.scale).applyQuaternion(spoon.quaternion));
    }
  }
}
