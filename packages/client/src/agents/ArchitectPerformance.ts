import * as THREE from 'three';
import { ARCHITECT_ROOM, FILM_SETS, architectDoorAngle, type ArchitectGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { crosscutPalm } from './CrosscutPerformance.js';

export function poseArchitect(rig: CharacterRig, gesture?: ArchitectGesture): void {
  if (rig.architectThumbs) {
    rig.architectThumbs.forEach(thumb => thumb.quaternion.identity());
    for (const hand of [...rig.fingers, rig.architectThumbs]) for (const digit of hand)
      for (const part of ['mid', 'tip']) digit.getObjectByName(`architect-${part}`)?.quaternion.identity();
  }
  if (!gesture) return;
  if (gesture.role === 'architect' && !rig.hero) {
    // AgentRenderer already offsets the character root by -1, matching the
    // film set floor. Do not apply that offset a second time inside the rig.
    rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
    rig.torso.position.set(0, 1.48, -.06); rig.torso.rotation.set(-.045, 0, 0);
    rig.head.rotation.set(.045, Math.sin(gesture.elapsed * .3) * .025, 0);
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.detail.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      rig.hips[i].position.set(sign * .225, 1.48, -.06); rig.hips[i].updateWorldMatrix(false, true);
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position,
        rig.detail.localToWorld(new THREE.Vector3(sign * .32, .16, 1.02)), new THREE.Vector3(sign * .1, .3, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      rig.ankles[i].updateWorldMatrix(false, true);
      const wrist = rig.mobilWrists![i], palm = new THREE.Vector3(0, -.14, -.05);
      const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i ? 0 : .6))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      const contact = rig.detail.localToWorld(new THREE.Vector3(sign * .84, i ? ARCHITECT_ROOM.chair.arm + .0715 : 2.22, i ? .73 : .28));
      reach(rig.shoulders[i], rig.elbows[i], wrist.position,
        contact.sub(palm.applyQuaternion(orientation)), new THREE.Vector3(sign * .3, -1, -.35).applyQuaternion(rotation));
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
}
