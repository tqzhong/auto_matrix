import * as THREE from 'three';
import { FILM_SETS, WETWALL, WETWALL_SHAFT, type WetwallGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const trinityReleasePoses = new WeakMap<THREE.Object3D, Map<string, THREE.Quaternion[][]>>();

function releasedFingers(rig: CharacterRig, side: string): THREE.Quaternion[][] {
  const hero = rig.hero!;
  let poses = trinityReleasePoses.get(hero.root);
  if (!poses) { poses = new Map(); trinityReleasePoses.set(hero.root, poses); }
  const cached = poses.get(side); if (cached) return cached;
  const skin = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh, a = skin.geometry.attributes;
  const sign = side === 'R' ? 1 : -1, axis = new THREE.Vector3(0, 0, 1);
  const frame = (direction: THREE.Vector3) => {
    const y = direction.clone().normalize(), z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
  };
  const pose = [1, 2, 3, 4, 5].map(digit => {
    const index = digit - 2;
    const joint = skin.skeleton.bones.findIndex(b => b.name === `finger${digit}-3_${side}`), tip = new THREE.Vector3(); let count = 0;
    for (let id = 0; id < a.position.count; id++) if ([0, 1, 2, 3].some(k => a.skinIndex.getComponent(id, k) === joint && a.skinWeight.getComponent(id, k) > .95)) {
      tip.add(new THREE.Vector3().fromBufferAttribute(a.position, id).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[joint])); count++;
    }
    const rest = [hero.rest.get(`finger${digit}-2_${side}`)!, hero.rest.get(`finger${digit}-3_${side}`)!, tip.divideScalar(count)];
    // Phalanx axes differ in this rig. Build the relaxed finger frame from
    // those actual axes, with a small increasing curl toward the little finger.
    const first = rest[0].clone().normalize().applyAxisAngle(axis, sign * (digit === 1 ? .18 : .16 + index * .03));
    const pip = THREE.MathUtils.degToRad(digit === 1 ? 14 : 12 + index * 2), dip = THREE.MathUtils.degToRad(digit === 1 ? 12 : 8 + index);
    // The thumb retains its native opposition and bend plane. Minimum-turn
    // frames avoid flattening its nail orientation into the four-finger plane.
    const bendAxis = digit === 1 ? rest[0].clone().cross(rest[1]).normalize()
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(rest[0].clone().normalize(), first)) : axis.clone().multiplyScalar(sign);
    const directions = [first, first.clone().applyAxisAngle(bendAxis, pip), first.clone().applyAxisAngle(bendAxis, pip + dip)];
    const parent = new THREE.Quaternion();
    return directions.map((direction, segment) => {
      const world = digit === 1 ? new THREE.Quaternion().setFromUnitVectors(rest[segment].clone().normalize(), direction)
        : frame(direction).multiply(frame(rest[segment]).invert());
      const local = parent.clone().invert().multiply(world);
      parent.copy(world); return local;
    });
  });
  poses.set(side, pose); return pose;
}

export function wetwallHand(gesture: WetwallGesture, root: THREE.Vector3, side: number): THREE.Vector3 {
  const center = FILM_SETS.film_ambush_house.center, depth = Math.max(0, gesture.progress - gesture.entry);
  if (gesture.phase === 'breaking') return new THREE.Vector3(center.x - 18 + side * .23, center.y - 1 + WETWALL_SHAFT.top + 3.05, center.z + WETWALL_SHAFT.front + .13);
  if (gesture.progress < gesture.entry) return new THREE.Vector3(root.x + side * .2, center.y - 1 + WETWALL_SHAFT.top + 3.35, center.z + WETWALL_SHAFT.pipeZ + .09);
  if (gesture.grip) return new THREE.Vector3(root.x + side * .31, root.y + 3.15 + (side > 0 ? .45 : 0), center.z + WETWALL_SHAFT.pipeZ + .25);
  const step = depth / .9 + (side > 0 ? .5 : 0), fraction = step % 1;
  const stroke = THREE.MathUtils.smoothstep(fraction, .62, 1), swing = fraction < .62 ? 0 : Math.sin((fraction - .62) / .38 * Math.PI);
  return new THREE.Vector3(root.x + side * .31, center.y - 1 + WETWALL_SHAFT.top + 3.35 + (side > 0 ? .45 : 0) - Math.floor(step) * .9 - stroke * .9,
    center.z + WETWALL_SHAFT.pipeZ + .25 + swing * .2);
}

/** World-space pipe contacts use saved distance, so stopping and loading do not restart the stroke. */
export function poseWetwall(rig: CharacterRig, gesture?: WetwallGesture, holding = false): void {
  if (!gesture || (!gesture.hanging && !(gesture.role === 'neo' && gesture.phase === 'breaking')) || gesture.role === 'neo' && ['falling', 'failed'].includes(gesture.phase)) return;
  if (gesture.continued && holding && !gesture.grip) gesture = { ...gesture, grip: true };
  rig.root.updateWorldMatrix(true, true);
  const root = rig.root.getWorldPosition(new THREE.Vector3()), rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const breaking = gesture.role === 'neo' && gesture.phase === 'breaking';
  const punch = breaking ? THREE.MathUtils.smoothstep(gesture.elapsed, .55, WETWALL.impact) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, WETWALL.impact, 1.65)) : 0;
  const rescuing = gesture.phase === 'rescuing' && ['trinity', 'cypher'].includes(gesture.role);
  const rescue = rescuing ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, .55) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, 1.8, WETWALL.rescueSeconds)) : 0;
  if (rig.hero) {
    const bones = rig.hero.bones, bone = (name: string) => bones.get(name)!;
    const calibration = rig.hero.root.getObjectByName('Anatomical_head_and_hands')?.userData.wetwallGripCalibration;
    if (gesture.hanging) {
      bone('pelvis').position.copy(rig.hero.rest.get('pelvis')!); bone('pelvis').rotation.set(0, 0, 0);
      bone('spine').rotation.set(.08, 0, 0); bone('chest').rotation.set(.04, 0, 0); bone('head').rotation.set(.12, 0, 0);
    }
    rig.root.updateWorldMatrix(true, true);
    for (const [i, side] of ['R', 'L'].entries()) {
      const sign = i ? -1 : 1, wrist = bone(`wrist_${side}`), lower = bone(`elbow_${side}`), upper = bone(`shoulder_${side}`);
      const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3()));
      let contact = wetwallHand(gesture, root, sign), weight = breaking ? i ? punch * .45 : punch : 1;
      if (calibration?.version === 1 && gesture.hanging && !breaking && gesture.progress >= gesture.entry)
        contact.z += calibration.offsetZ[side];
      if (rescue > 0 && (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1)) {
        const center = FILM_SETS.film_ambush_house.center;
        contact.lerp(new THREE.Vector3(center.x - 19.1, center.y - 1 + WETWALL_SHAFT.top - WETWALL.jam + 3.75, center.z + WETWALL_SHAFT.bodyZ + .35), rescue);
      }
      contact = wrist.localToWorld(new THREE.Vector3(0, -.19, .035)).lerp(contact, weight);
      reach(upper, lower, wrist.position, contact.sub(palm.applyQuaternion(orientation)), new THREE.Vector3(sign, -.45, .22 + (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1 ? rescue : 0)));
      wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      const fraction = (Math.max(0, gesture.progress - gesture.entry) / .9 + (sign > 0 ? .5 : 0)) % 1;
      // Follow the existing saved-distance hand lift. The zero-slope ends
      // keep the held pose exact and close the fingers before pipe contact.
      const opening = gesture.role === 'trinity' && calibration?.version === 1 && gesture.phase === 'climbing'
        && gesture.hanging && gesture.progress >= gesture.entry && !gesture.grip
        ? Math.sin(THREE.MathUtils.smoothstep(fraction, .62, 1) * Math.PI) ** 2 : 0;
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
        const held = finger === 1 ? .24 : segment === 1 ? .62 : .85;
        const joint = bone(`finger${finger}-${segment}_${side}`); joint.rotation.z = sign * held * weight;
        if (opening > 0) joint.quaternion.slerp(releasedFingers(rig, side)[finger - 1][segment - 1], opening);
      }
      wrist.updateWorldMatrix(false, true);
      if (gesture.hanging) {
        const hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
        const step = gesture.grip ? 0 : .22 * Math.sin((gesture.progress - gesture.entry) / .9 * Math.PI + i * Math.PI);
        const foot = new THREE.Vector3(root.x + sign * .33, root.y + .6 + step, FILM_SETS.film_ambush_house.center.z + WETWALL_SHAFT.pipeZ + .55);
        reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign, .1, -.25));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
      }
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const sign = i ? -1 : 1, palm = new THREE.Vector3(0, -.79, .055), lower = rig.elbows[i];
      const contact = wetwallHand(gesture, root, sign);
      if (rescue > 0 && (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1)) {
        const center = FILM_SETS.film_ambush_house.center;
        contact.lerp(new THREE.Vector3(center.x - 19.1, center.y - 1 + WETWALL_SHAFT.top - WETWALL.jam + 3.75, center.z + WETWALL_SHAFT.bodyZ + .35), rescue);
      }
      const target = lower.localToWorld(palm.clone()).lerp(contact, breaking ? i ? punch * .45 : punch : 1);
      reach(rig.shoulders[i], lower, palm, target, new THREE.Vector3(sign, -.45, .2 + (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1 ? rescue : 0)));
      for (const finger of rig.fingers[i]) finger.rotation.x = -1.7;
      if (gesture.hanging) {
        const ankle = rig.ankles[i], knee = rig.knees[i], hip = rig.hips[i];
        const step = gesture.grip ? 0 : .22 * Math.sin((gesture.progress - gesture.entry) / .9 * Math.PI + i * Math.PI);
        const foot = new THREE.Vector3(root.x + sign * .33, root.y + .6 + step, FILM_SETS.film_ambush_house.center.z + WETWALL_SHAFT.pipeZ + .55);
        reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign, .1, -.25));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
      }
    }
  }
}
