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
  const take = gesture.phase === 'receiving' ? gesture.elapsed <= SPOON_LESSON.transfer
    ? smooth(gesture.elapsed, 0, SPOON_LESSON.transfer) : 1 - smooth(gesture.elapsed, SPOON_LESSON.transfer, SPOON_LESSON.receiving) : 0;
  bone('spine').rotation.x += (.08 + .14 * take) * seat; bone('head').rotation.x += .12 * seat;
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

function pinchSpoon(rig: HeroRig, point: THREE.Vector3, amount: number, turn: number): void {
  if (amount === 0) return;
  const wrist = rig.bones.get('wrist_R')!;
  let pads = wrist.userData.spoonPads as THREE.Vector3[] | undefined;
  if (!pads) {
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    pads = [new THREE.Vector3(), new THREE.Vector3()];
    const counts = [0, 0], vertex = new THREE.Vector3();
    const distal = skin.skeleton.bones.map(bone => /^finger([12])-3_R$/.exec(bone.name));
    for (let i = 0; i < position.count; i++) for (let part = 0; part < 4; part++) {
      const index = skinIndex.getComponent(i, part), digit = distal[index];
      if (!digit || skinWeight.getComponent(i, part) < .95) continue;
      vertex.fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
      pads[Number(digit[1]) - 1].add(vertex); counts[Number(digit[1]) - 1]++;
    }
    pads.forEach((pad, i) => pad.divideScalar(counts[i])); wrist.userData.spoonPads = pads;
  }
  // Follow the metal as the wrist straightens during the reach. Preserve the
  // pad's full orientation, including roll, so the stem cannot slide through it.
  pads.forEach((pad, i) => {
    const base = rig.rest.get(`finger${i + 1}-1_R`)!;
    const first = rig.rest.get(`finger${i + 1}-2_R`)!, second = rig.rest.get(`finger${i + 1}-3_R`)!;
    const direction = (i === 0 ? new THREE.Vector3(.4, -.86, .316) : new THREE.Vector3(-.2, .98, 0)).normalize();
    const tipRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), turn)
      .multiply(new THREE.Quaternion().setFromUnitVectors(pad.clone().normalize(), direction));
    const target = point.clone(); target.x += i === 0 ? .08 : -.041;
    const end = target.sub(pad.clone().applyQuaternion(tipRotation)), axis = end.clone().sub(base);
    const a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
    axis.normalize(); end.copy(base).addScaledVector(axis, distance);
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const bend = new THREE.Vector3(0, i === 0 ? 1 : -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
    const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    const parent = new THREE.Quaternion();
    [hinge.clone().sub(base), end.clone().sub(hinge), direction].forEach((desired, joint) => {
      const rotation = joint === 2 ? tipRotation : new THREE.Quaternion().setFromUnitVectors([first, second][joint].clone().normalize(), desired.normalize());
      const local = parent.clone().invert().multiply(rotation); parent.copy(rotation);
      rig.bones.get(`finger${i + 1}-${joint + 1}_R`)!.quaternion.slerp(local, amount);
    });
  });
}

export function poseSpoonHands(rig: CharacterRig, gesture?: SpoonGesture): void {
  if (!gesture && !(rig.hero && rig.spoon?.root.visible)) return;
  const { phase, elapsed: t, role } = gesture ?? { phase: 'focus', elapsed: 0, role: 'neo' };
  const offered = role === 'boy' ? phase === 'demonstrating' ? smooth(t, 1.8, 3.2) : phase === 'offered' ? 1 : phase === 'receiving' ? 1 - smooth(t, SPOON_LESSON.transfer, SPOON_LESSON.transfer + .65) : 0
    : phase === 'receiving' ? t <= SPOON_LESSON.transfer ? smooth(t, 0, SPOON_LESSON.transfer) : 1 - smooth(t, SPOON_LESSON.transfer, SPOON_LESSON.receiving) : 0;
  const center = FILM_SETS.film_oracle_home.center;
  const contact = new THREE.Vector3(center.x + SPOON_LESSON.contact.x, center.y - 1 + SPOON_LESSON.contact.y, center.z + SPOON_LESSON.contact.z);
  const upright = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SPOON_LESSON.neo.yaw);
  rig.root.updateWorldMatrix(true, true);
  if (rig.hero) {
    const bones = rig.hero.bones, wrist = bones.get('wrist_R')!, elbow = bones.get('elbow_R')!, shoulder = bones.get('shoulder_R')!;
    const pitch = 2.17 - .42 * offered;
    const pinch = new THREE.Vector3(.14, -.24, .12);
    pinchSpoon(rig.hero, pinch, phase === 'receiving' ? smooth(t, 0, SPOON_LESSON.transfer) : rig.spoon?.root.visible ? 1 : 0, pitch - 2.17);
    wrist.updateWorldMatrix(true, true);
    if (offered > 0) {
      const shoulderPose = shoulder.quaternion.clone(), elbowPose = elbow.quaternion.clone();
      const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(upright.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch)), offered);
      const target = wrist.localToWorld(pinch.clone()).lerp(contact, offered).sub(pinch.clone().applyQuaternion(orientation));
      reach(shoulder, elbow, wrist.position, target, new THREE.Vector3(-.7, -.8, .1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
      // Near either endpoint the IK pole may select another elbow pose even
      // though its hand target barely moves. Enter that pose with the reach.
      shoulder.quaternion.copy(shoulderPose.slerp(shoulder.quaternion, offered));
      elbow.quaternion.copy(elbowPose.slerp(elbow.quaternion, offered));
      shoulder.updateWorldMatrix(false, true);
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); wrist.updateWorldMatrix(false, true);
    }
    if (rig.spoon?.root.visible) {
      if (rig.spoon.root.parent !== wrist) wrist.add(rig.spoon.root);
      rig.spoon.root.rotation.set(pitch, 0, 0);
      rig.spoon.root.scale.setScalar(.55 / wrist.getWorldScale(new THREE.Vector3()).x);
      rig.spoon.root.position.copy(pinch.sub(new THREE.Vector3(0, .08, 0).multiply(rig.spoon.root.scale).applyQuaternion(rig.spoon.root.quaternion)));
    }
  } else {
    const elbow = rig.elbows[0], palm = new THREE.Vector3(0, -.79, .055);
    // Prop ownership switches at transfer. Keep the boy's gripping fingers
    // while his saved withdrawal eases out, rather than opening in one frame.
    if (role === 'boy' && phase === 'receiving') for (const finger of rig.fingers[0])
      finger.rotation.x = THREE.MathUtils.lerp(finger.rotation.x, -.12 - .65 * 2.1, offered);
    const grip = contact.clone().add(new THREE.Vector3(0, (.44 - .08) * .55, 0));
    if (offered > 0) {
      const shoulder = rig.shoulders[0], shoulderPose = shoulder.quaternion.clone(), elbowPose = elbow.quaternion.clone();
      reach(shoulder, elbow, palm, elbow.localToWorld(palm.clone()).lerp(grip, offered),
        new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
      shoulder.quaternion.copy(shoulderPose.slerp(shoulder.quaternion, offered));
      elbow.quaternion.copy(elbowPose.slerp(elbow.quaternion, offered));
      shoulder.updateWorldMatrix(false, true);
    }
    if (rig.spoon?.root.visible) {
      const spoon = rig.spoon.root, parentRotation = elbow.getWorldQuaternion(new THREE.Quaternion());
      const rotation = parentRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 2.17)).slerp(upright, offered);
      spoon.quaternion.copy(parentRotation.invert().multiply(rotation)); spoon.scale.setScalar(.55 / elbow.getWorldScale(new THREE.Vector3()).x);
      spoon.position.copy(palm).sub(new THREE.Vector3(0, .44, 0).multiply(spoon.scale).applyQuaternion(spoon.quaternion));
    }
  }
}
