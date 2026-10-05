import * as THREE from 'three';
import { streetResetPose, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

// Pelvis height and planted feet are authored independently: standing is a
// transfer of support from the side, through the palms, onto the two shoes.
const beats = [
  { t: 0, hip: .566, pitch: -Math.PI / 2, roll: Math.PI / 2, feet: [[.5, .72, 1.22], [.62, .175, 1.35]] },
  { t: 1.2, hip: .56, pitch: -1.0, roll: .65, feet: [[.5, .35, 1.12], [-.10, .175, 1.4]] },
  { t: 2.7, hip: 1.16, pitch: 1.4, roll: 0, feet: [[-.29, .156, -.75], [.29, .156, -.70]] },
  { t: 4, hip: 1.02, pitch: 1.3, roll: 0, feet: [[-.32, .156, .12], [.32, .156, -.38]] },
  { t: 4.6, hip: 1.2, pitch: 1, roll: 0, feet: [[-.30, .156, .12], [.30, .156, -.10]] },
  { t: 6.4, hip: 1.995, pitch: 0, roll: 0, feet: [[-.225, .156, 0], [.225, .156, 0]] },
  { t: 7.2, hip: 1.995, pitch: 0, roll: 0, feet: [[-.225, .156, 0], [.225, .156, 0]] },
];

export function poseStreetWake(rig: CharacterRig, gesture: TrilogyEpilogueGesture): void {
  const t = streetResetPose(gesture).rising * 7.2;
  const index = Math.max(1, beats.findIndex(beat => beat.t >= t));
  const a = beats[index - 1], b = beats[index], mix = THREE.MathUtils.smoothstep(t, a.t, b.t);
  const lerp = (first: number, second: number) => THREE.MathUtils.lerp(first, second, mix);
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  rig.torso.position.set(0, lerp(a.hip, b.hip), 0);
  rig.torso.quaternion.setFromEuler(new THREE.Euler(a.pitch, a.roll, 0))
    .slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(b.pitch, b.roll, 0)), mix);
  rig.head.rotation.set(-.18 * Math.sin(t / 7.2 * Math.PI), -.24 * THREE.MathUtils.smoothstep(t, 5.8, 7.2), 0);
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const upright = THREE.MathUtils.smoothstep(t, 1.2, 2.7);
  const resting = 1 - THREE.MathUtils.smoothstep(t, 0, 1.2);
  rig.head.rotation.z = -.32 * resting;
  rig.head.position.set(0, .52, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rig.head.rotation.z).add(new THREE.Vector3(0, 1.47, 0));
  const plant = THREE.MathUtils.smoothstep(t, .9, 2.7) * (1 - THREE.MathUtils.smoothstep(t, 4, 4.6));
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, hand = rig.root.getObjectByName(`sati-hand-${side}`)!;
    rig.hips[i].position.set(side * .225, 0, 0).applyQuaternion(rig.torso.quaternion).add(rig.torso.position);
    rig.hips[i].rotation.set(0, 0, 0); rig.knees[i].rotation.set(0, 0, 0); rig.ankles[i].rotation.set(0, 0, 0);
    rig.shoulders[i].rotation.set(-.7 * (1 - upright), 0, side * (.08 * upright - .18 * (1 - upright)));
    rig.elbows[i].rotation.set(-1.65 * (1 - upright) - .18 * upright, 0, 0); hand.rotation.set(0, 0, 0);
    rig.fingers[i].forEach(finger => { finger.rotation.x = -.12 * (1 - plant); });
    rig.root.updateWorldMatrix(true, true);
    const target = new THREE.Vector3().fromArray(a.feet[i]).lerp(new THREE.Vector3().fromArray(b.feet[i]), mix);
    const pole = new THREE.Vector3(1 - upright, .15, upright).applyQuaternion(orientation);
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, rig.root.localToWorld(target), pole);
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    if (plant > 0 || resting > 0) {
      const palm = new THREE.Vector3(0, -.07, .055);
      const flat = orientation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0)));
      const wristRotation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(flat, Math.max(plant, i ? resting : 0));
      const restingHand = new THREE.Vector3(i ? .28 : .45, i ? .06 : .40, i ? -1.75 : -1.10);
      const contact = hand.localToWorld(palm.clone()).lerp(rig.root.localToWorld(restingHand), resting)
        .lerp(rig.root.localToWorld(new THREE.Vector3(side * .54, .003, 1.1)), plant);
      const wrist = contact.sub(palm.clone().multiplyScalar(rig.root.scale.x).applyQuaternion(wristRotation));
      reach(rig.shoulders[i], rig.elbows[i], hand.position, wrist, new THREE.Vector3(side, resting * .3, -.4).applyQuaternion(orientation));
      hand.quaternion.copy(rig.elbows[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wristRotation));
    }
  }
}
