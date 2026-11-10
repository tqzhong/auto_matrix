import * as THREE from 'three';
import { FILM_SETS, OPENING_PHONE, type OpeningPhoneAnswer } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** The same receiver meets the palm at the cradle and its upper cup meets the ear. */
export function poseOpeningPhone(rig: Pick<CharacterRig, 'root' | 'hero' | 'handset'>, answer?: OpeningPhoneAnswer): void {
  if (!answer || !rig.hero || !rig.handset) return;
  const center = FILM_SETS.film_wells_phone.center, bones = rig.hero.bones;
  const wrist = bones.get('wrist_R')!, elbow = bones.get('elbow_R')!, shoulder = bones.get('shoulder_R')!;
  rig.root.updateWorldMatrix(true, true);
  const base = new THREE.Vector3(center.x + OPENING_PHONE.receiver.x, center.y - 1 + OPENING_PHONE.receiver.y, center.z + OPENING_PHONE.receiver.z);
  const lifted = THREE.MathUtils.smoothstep(answer.elapsed, OPENING_PHONE.graspSeconds, OPENING_PHONE.liftSeconds);
  const body = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const held = body.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
  const orientation = new THREE.Quaternion().slerp(held, lifted);
  const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.23, -.08, .13));
  const atEar = ear.sub(new THREE.Vector3(0, .31, .1425).applyQuaternion(held));
  const receiver = base.lerp(atEar, lifted);
  const weight = THREE.MathUtils.smoothstep(answer.elapsed, OPENING_PHONE.alignSeconds, OPENING_PHONE.graspSeconds);
  const palm = new THREE.Vector3(0, -.19, .035), target = wrist.localToWorld(palm.clone()).lerp(receiver, weight);
  const hand = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2)), weight);
  const offset = palm.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(hand);
  reach(shoulder, elbow, wrist.position, target.sub(offset), new THREE.Vector3(-.6, -.35, .4).applyQuaternion(body));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${finger}-${segment}_R`)!.rotation.z = (finger === 1 ? .2 : segment === 1 ? .6 : .75) * weight;
  wrist.updateWorldMatrix(false, true);
  const prop = rig.handset.root, scale = wrist.getWorldScale(new THREE.Vector3());
  prop.position.copy(wrist.worldToLocal(receiver.clone()));
  prop.quaternion.copy(wrist.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  prop.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  prop.visible = answer.elapsed >= OPENING_PHONE.graspSeconds;
}
