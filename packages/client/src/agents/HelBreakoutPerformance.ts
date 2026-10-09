import * as THREE from 'three';
import { FILM_SETS, HEL_BREAKOUT, helSoleFloor, helBreakoutGuard, type HelBreakoutGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { poseHelPistol } from './HelCoatcheckPerformance.js';
import { reach } from './SpoonPerformance.js';

/** Pose the shipped limbs against the saved weapon, rather than an attack clip. */
export function poseHelBreakout(rig: CharacterRig, gesture?: HelBreakoutGesture): void {
  if (!gesture) return;
  const center = FILM_SETS.film_club_hel.center, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  rig.root.updateMatrixWorld(true);
  for (const [i, side] of ['R', 'L'].entries()) {
    const hip = rig.hero?.bones.get('hip_' + side) ?? rig.hips[i], knee = rig.hero?.bones.get('knee_' + side) ?? rig.knees[i];
    const ankle = rig.hero?.bones.get('ankle_' + side) ?? rig.ankles[i], target = ankle.getWorldPosition(new THREE.Vector3());
    const support = helSoleFloor(target.x - center.x, target.z - center.z, rig.root.rotation.y);
    const floor = rig.root.position.y - (center.y - 1); target.y += support - floor;
    if (gesture.role === 'seraph' && i === 0 && gesture.phase === 'airborne') {
      const t = gesture.elapsed, source = gesture.breakout.source;
      const kick = THREE.MathUtils.smoothstep(t, .08, HEL_BREAKOUT.kick) * (1 - THREE.MathUtils.smoothstep(t, HEL_BREAKOUT.kick, HEL_BREAKOUT.recover));
      const contact = new THREE.Vector3(center.x + source.x, center.y - 1 + source.y - .07, center.z + source.z);
      contact.sub(new THREE.Vector3(0, -.03, .25).applyQuaternion(rotation));
      target.lerp(contact, kick);
    }
    reach(hip, knee, ankle.position.clone(), target, new THREE.Vector3(i ? .25 : -.25, .5, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  }
  rig.root.updateMatrixWorld(true);
  if (gesture.role === 'trinity' && gesture.phase === 'airborne' && gesture.elapsed < .7) {
    const guard = helBreakoutGuard(gesture.breakout.guard, gesture.elapsed);
    const wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists?.[0]; if (!wrist) return;
    const shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], elbow = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
    const punch = THREE.MathUtils.smoothstep(gesture.elapsed, .03, .27) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, .32, .65));
    const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    const contact = new THREE.Vector3(center.x + guard.x + .2 * Math.sin(guard.yaw), center.y - 1 + guard.y + 3.1, center.z + guard.z + .2 * Math.cos(guard.yaw));
    const target = wrist.getWorldPosition(new THREE.Vector3()).lerp(contact.sub(new THREE.Vector3(.09, -.16, 0).applyQuaternion(orientation)), punch);
    reach(shoulder, elbow, wrist.position.clone(), target, new THREE.Vector3(-.4, -.5, -.2).applyQuaternion(rotation));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation.clone().slerp(orientation, punch)));
    if (rig.hero) for (let f = 2; f <= 5; f++) for (let s = 1; s <= 3; s++) rig.hero.bones.get(`finger${f}-${s}_R`)!.rotation.z = .95 * punch;
    rig.root.updateMatrixWorld(true);
  }
  if (gesture.role !== 'trinity' || gesture.phase !== 'catching' || !gesture.breakout.caught) return;
  const gun = rig.weapons?.[0], wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists?.[0]; if (!gun || !wrist) return;
  const shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], elbow = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  poseHelPistol(rig, 0); rig.root.updateMatrixWorld(true);
  const caught = gesture.breakout.caught, p = THREE.MathUtils.smoothstep(gesture.elapsed, 0, HEL_BREAKOUT.catch);
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(caught.pitch, caught.yaw, caught.roll, 'YXZ'))
    .slerp(gun.getWorldQuaternion(new THREE.Quaternion()), p);
  const target = new THREE.Vector3(center.x + caught.x, center.y - 1 + caught.y, center.z + caught.z)
    .lerp(gun.getWorldPosition(new THREE.Vector3()), p)
    .sub(gun.position.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
  reach(shoulder, elbow, wrist.position.clone(), target, new THREE.Vector3(-.4, -.8, -.2).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  // Keep the palm on the grip while the thumb and lower fingers close around it.
  if (rig.hero) for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
    const joint = rig.hero.bones.get(`finger${finger}-${segment}_R`)!;
    joint.rotation.x *= .4 + .6 * p; joint.rotation.y *= .4 + .6 * p; joint.rotation.z *= .4 + .6 * p;
  }
  gun.visible = true; rig.root.updateMatrixWorld(true);
}
