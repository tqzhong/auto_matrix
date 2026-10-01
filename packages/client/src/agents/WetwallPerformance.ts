import * as THREE from 'three';
import { FILM_SETS, WETWALL, WETWALL_SHAFT, type WetwallGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

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
      if (rescue > 0 && (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1)) {
        const center = FILM_SETS.film_ambush_house.center;
        contact.lerp(new THREE.Vector3(center.x - 19.1, center.y - 1 + WETWALL_SHAFT.top - WETWALL.jam + 3.75, center.z + WETWALL_SHAFT.bodyZ + .35), rescue);
      }
      contact = wrist.localToWorld(new THREE.Vector3(0, -.19, .035)).lerp(contact, weight);
      reach(upper, lower, wrist.position, contact.sub(palm.applyQuaternion(orientation)), new THREE.Vector3(sign, -.45, .22 + (gesture.role === 'trinity' && i === 0 || gesture.role === 'cypher' && i === 1 ? rescue : 0)));
      wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
        bone(`finger${finger}-${segment}_${side}`).rotation.z = (i ? -1 : 1) * (finger === 1 ? .24 : segment === 1 ? .62 : .85) * weight;
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
