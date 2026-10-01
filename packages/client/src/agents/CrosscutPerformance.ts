import * as THREE from 'three';
import { CROSSCUT, type CrosscutGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { groundCharacter } from './GroundContact.js';
import { reach } from './SpoonPerformance.js';

export function crosscutPalm(rig: CharacterRig, side: 'R' | 'L', target: THREE.Vector3, orientation?: THREE.Quaternion): void {
  if (!rig.hero) return;
  const b = rig.hero.bones, wrist = b.get(`wrist_${side}`)!, elbow = b.get(`elbow_${side}`)!, shoulder = b.get(`shoulder_${side}`)!;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), sign = side === 'R' ? 1 : -1;
  const aim = orientation ?? rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(aim);
  reach(shoulder, elbow, wrist.position, target.clone().sub(palm), new THREE.Vector3(sign, -.3, .5).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(aim));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
    b.get(`finger${finger}-${segment}_${side}`)!.rotation.z = sign * (finger === 1 ? .2 : segment === 1 ? .5 : .7);
  wrist.updateWorldMatrix(false, true);
}

/** Floor falls and chair contact use the delivered skeleton, not a rotated upright mesh. */
export function poseCrosscut(rig: CharacterRig, gesture?: CrosscutGesture): void {
  if (!gesture || !rig.hero) return;
  const hero = rig.hero, bone = (name: string) => hero.bones.get(name)!, pelvis = bone('pelvis');
  const seat = gesture.body === true;
  let down = THREE.MathUtils.smoothstep(gesture.fall ?? 0, 0, 1.35);
  if (gesture.role === 'tank' && gesture.phase === 'countering') down *= 1 - THREE.MathUtils.smoothstep(gesture.elapsed, .4, 2.1);
  if (gesture.role === 'tank' && ['return', 'trinity_ready', 'trinity_exit', 'neo_ready', 'neo_exit', 'done'].includes(gesture.phase)) down = 0;
  if (!seat && down === 0) return;
  pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(-Math.PI / 2 * down, 0, 0);
  pelvis.position.y = seat ? 1.58 : THREE.MathUtils.lerp(pelvis.position.y, .62, down);
  if (seat) pelvis.position.z = -.23;
  bone('spine').rotation.set(seat ? -.22 : 0, 0, 0); bone('chest').rotation.set(seat ? -.12 : 0, 0, 0); bone('head').rotation.set(seat ? .12 : .08 * down, 0, 0);
  for (const side of ['R', 'L'] as const) {
    bone(`hip_${side}`).rotation.set(0, 0, 0); bone(`knee_${side}`).rotation.set(0, 0, 0); bone(`ankle_${side}`).rotation.set(0, 0, 0);
    bone(`shoulder_${side}`).rotation.set(.2 * down, 0, 0); bone(`elbow_${side}`).rotation.set(.15 * down, 0, 0);
  }
  rig.root.updateWorldMatrix(true, true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  if (seat) for (const side of ['R', 'L'] as const) {
    const sign = side === 'R' ? 1 : -1, hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    const target = hero.root.localToWorld(new THREE.Vector3(sign * .45, .21 + hero.footHeight + .04, 1.45));
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .3, -.2, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    crosscutPalm(rig, side, rig.root.localToWorld(new THREE.Vector3(sign * .87, 1.83, .1)));
  }
  if (!seat && down > 0) groundCharacter(rig, THREE.MathUtils.smoothstep(down, .65, 1));
}

export function poseCrosscutContact(rig: CharacterRig, gesture?: CrosscutGesture): void {
  if (!gesture || !rig.hero || gesture.body) return;
  const gun = rig.weapons?.find(weapon => weapon.visible), b = rig.hero.bones;
  if (gun && gesture.contact) {
    rig.root.updateWorldMatrix(true, true);
    const target = new THREE.Vector3(gesture.contact.x, gesture.contact.y, gesture.contact.z);
    const grip = rig.root.localToWorld(new THREE.Vector3(.38, gesture.role === 'tank' ? 2.2 : 3.15, .66));
    const aim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(grip).normalize());
    crosscutPalm(rig, 'R', grip, aim); gun.updateWorldMatrix(true, true);
    crosscutPalm(rig, 'L', gun.localToWorld(new THREE.Vector3(0, -.68, .07)), aim);
  } else if (gesture.role === 'cypher' && gesture.phase === 'call' && gesture.contact) {
    const pull = gesture.elapsed < 14 ? CROSSCUT.apocPull : CROSSCUT.switchPull;
    const weight = THREE.MathUtils.smoothstep(gesture.elapsed, pull - 1.5, pull - .3);
    if (weight > 0) {
      rig.root.updateWorldMatrix(true, true);
      const palm = b.get('wrist_R')!.localToWorld(new THREE.Vector3(0, -.19, .035));
      crosscutPalm(rig, 'R', palm.lerp(new THREE.Vector3(gesture.contact.x, gesture.contact.y, gesture.contact.z), weight));
    }
  }
}
