import * as THREE from 'three';
import { FILM_SETS, OPENING_HOTEL, OPENING_PHONE, openingHotelPhoneHeld, type OpeningPhoneAnswer, type OpeningPhoneHit } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { groundCharacter } from './GroundContact.js';

/** The same receiver meets the palm at the cradle and its upper cup meets the ear. */
export function poseOpeningPhone(rig: Pick<CharacterRig, 'root' | 'hero' | 'handset'>, answer?: OpeningPhoneAnswer, hit?: OpeningPhoneHit): void {
  if (!rig.hero) return;
  if (!answer || !rig.handset) {
    if (hit && hit.elapsed > 0) poseOpeningHit(rig, hit, false);
    return;
  }
  const center = FILM_SETS.film_wells_phone.center, bones = rig.hero.bones;
  rig.root.updateWorldMatrix(true, true);
  const body = rig.root.getWorldQuaternion(new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Vector3(center.x + OPENING_PHONE.receiver.x, center.y - 1 + OPENING_PHONE.receiver.y, center.z + OPENING_PHONE.receiver.z);
  if (hit) {
    base.sub(new THREE.Vector3(center.x + hit.origin.x, center.y - 1 + hit.origin.y, center.z + hit.origin.z)).applyAxisAngle(up, -hit.yaw);
    rig.root.localToWorld(base);
  }
  const lifted = THREE.MathUtils.smoothstep(answer.elapsed, OPENING_PHONE.graspSeconds, OPENING_PHONE.liftSeconds);
  const held = body.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
  const orientation = (hit ? body.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, -hit.yaw)) : new THREE.Quaternion()).slerp(held, lifted);
  const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.23, -.08, .13));
  const atEar = ear.sub(new THREE.Vector3(0, .31, .1425).applyQuaternion(held));
  const receiver = base.lerp(atEar, lifted);
  const weight = THREE.MathUtils.smoothstep(answer.elapsed, OPENING_PHONE.alignSeconds, OPENING_PHONE.graspSeconds);
  placeReceiver(rig, receiver, orientation, body, weight, answer.elapsed >= OPENING_PHONE.graspSeconds);
  if (hit && hit.elapsed > 0) poseOpeningHit(rig, hit, rig.handset.root.visible);
}

export function poseHotelPhone(rig: Pick<CharacterRig, 'root' | 'hero' | 'handset'>, elapsed?: number): void {
  if (!rig.hero || !rig.handset || elapsed === undefined) return;
  const { center } = FILM_SETS.film_heart_hotel, phone = OPENING_HOTEL.phone, smooth = THREE.MathUtils.smoothstep;
  const { bones } = rig.hero, up = new THREE.Vector3(0, 1, 0);
  const lifted = smooth(elapsed, phone.grasp, phone.lift) * (1 - smooth(elapsed, phone.lower, phone.release));
  const weight = smooth(elapsed, phone.align, phone.grasp) * (1 - smooth(elapsed, phone.release, phone.end));
  const lean = weight * (1 - lifted);
  const glance = smooth(elapsed, 2.5, 3.2) * (1 - smooth(elapsed, 4.6, 5.9));
  bones.get('head')!.rotation.y -= .2 * glance;
  bones.get('head')!.rotation.x += .1 * (1 - lifted);
  bones.get('spine')!.rotation.x += .2 * lean;
  bones.get('chest')!.rotation.x += .14 * lean - .07 * lifted * Math.sin(elapsed * 2.6);
  rig.root.updateWorldMatrix(true, true);
  const body = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const held = body.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
  const cradle = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const receiver = new THREE.Vector3(center.x + phone.receiver.x, center.y - 1 + phone.receiver.y, center.z + phone.receiver.z);
  const ear = bones.get('head')!.localToWorld(new THREE.Vector3(-.23, -.08, .13));
  const atEar = ear.sub(new THREE.Vector3(0, .31, .1425).applyQuaternion(held));
  placeReceiver(rig, receiver.lerp(atEar, lifted), cradle.slerp(held, lifted), body, weight, openingHotelPhoneHeld(elapsed));
}

function placeReceiver(rig: Pick<CharacterRig, 'hero' | 'handset'>, receiver: THREE.Vector3, orientation: THREE.Quaternion,
  body: THREE.Quaternion, weight: number, visible: boolean): void {
  const bones = rig.hero!.bones, wrist = bones.get('wrist_R')!, elbow = bones.get('elbow_R')!, shoulder = bones.get('shoulder_R')!;
  const palm = new THREE.Vector3(0, -.19, .035), target = wrist.localToWorld(palm.clone()).lerp(receiver, weight);
  const hand = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2)), weight);
  const offset = palm.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(hand);
  reach(shoulder, elbow, wrist.position, target.sub(offset), new THREE.Vector3(-.6, -.35, .4).applyQuaternion(body));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand));
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${finger}-${segment}_R`)!.rotation.z = (finger === 1 ? .2 : segment === 1 ? .6 : .75) * weight;
  wrist.updateWorldMatrix(false, true);
  const prop = rig.handset!.root, scale = wrist.getWorldScale(new THREE.Vector3());
  prop.position.copy(wrist.worldToLocal(receiver.clone()));
  prop.quaternion.copy(wrist.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  prop.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  prop.visible = visible;
}

function poseOpeningHit(rig: Pick<CharacterRig, 'root' | 'hero' | 'handset'>, hit: OpeningPhoneHit, holding: boolean): void {
  const bones = rig.hero!.bones, fall = THREE.MathUtils.smoothstep(hit.elapsed, .02, .8), brace = THREE.MathUtils.smoothstep(hit.elapsed, .4, 1);
  const tuck = THREE.MathUtils.smoothstep(hit.elapsed, 0, .18) * (1 - THREE.MathUtils.smoothstep(hit.elapsed, .4, .75));
  const settle = THREE.MathUtils.smoothstep(hit.elapsed, OPENING_PHONE.hitAirSeconds, OPENING_PHONE.hitSeconds);
  const pelvis = bones.get('pelvis')!; pelvis.position.y -= fall * 1.45; pelvis.rotation.x += fall * 1.48;
  pelvis.rotation.y *= 1 - settle; pelvis.rotation.z *= 1 - settle;
  for (const [name, angle] of [['spine', -.15], ['chest', .14], ['head', -.25]] as const)
    bones.get(name)!.rotation.x = THREE.MathUtils.lerp(bones.get(name)!.rotation.x, angle, fall);
  for (const side of ['R', 'L'] as const) {
    for (const [name, angle] of [['hip', .08], ['knee', side === 'R' ? .35 : .5], ['ankle', -.15], ['shoulder', -.65], ['elbow', -.55]] as const) {
      const joint = bones.get(`${name}_${side}`)!; joint.rotation.x = THREE.MathUtils.lerp(joint.rotation.x, angle, fall);
    }
    bones.get(`hip_${side}`)!.rotation.x -= 1.25 * tuck; bones.get(`knee_${side}`)!.rotation.x += 1.2 * tuck;
    for (const [name, angle] of [['hip', -.15], ['knee', .06], ['ankle', -.08]] as const) {
      const joint = bones.get(`${name}_${side}`)!; joint.rotation.x = THREE.MathUtils.lerp(joint.rotation.x, angle, settle);
    }
  }
  groundCharacter(rig as CharacterRig, fall); rig.root.updateWorldMatrix(true, true);
  if (settle > 0) {
    const shoes = rig.hero!.wardrobe.find(({ mesh }) => mesh.name === 'shoes01')!.mesh, point = new THREE.Vector3();
    let lowest = Infinity;
    for (let i = 0; i < shoes.geometry.attributes.position.count; i++) { shoes.getVertexPosition(i, point); shoes.localToWorld(point); lowest = Math.min(lowest, point.y); }
    pelvis.position.y += (rig.root.getWorldPosition(point).y + .07 - lowest) * settle;
    rig.root.updateWorldMatrix(true, true);
  }
  const body = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (const side of ['R', 'L'] as const) {
    const wrist = bones.get(`wrist_${side}`)!, elbow = bones.get(`elbow_${side}`)!, shoulder = bones.get(`shoulder_${side}`)!;
    const right = side === 'R', desired = rig.root.localToWorld(new THREE.Vector3(right ? -.58 : .65, right ? .72 : .13, right ? 1.35 : 1.65));
    const palm = new THREE.Vector3(0, -.19, .035), target = wrist.localToWorld(palm.clone()).lerp(desired, brace);
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(body.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)), brace);
    const offset = palm.clone().multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
    reach(shoulder, elbow, wrist.position, target.sub(offset), new THREE.Vector3(right ? -1 : 1, .3, -.5).applyQuaternion(body));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) {
      const joint = bones.get(`finger${finger}-${segment}_${side}`)!, sign = right ? 1 : -1;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, sign * (holding && right ? .65 : .08), brace);
    }
    wrist.updateWorldMatrix(false, true);
  }
  groundCharacter(rig as CharacterRig);
  if (settle > 0) {
    const shoes = rig.hero!.wardrobe.find(({ mesh }) => mesh.name === 'shoes01')!.mesh as THREE.SkinnedMesh;
    const lowest = { R: Infinity, L: Infinity }, point = new THREE.Vector3(), attributes = shoes.geometry.attributes;
    for (let i = 0; i < attributes.position.count; i++) {
      let strongest = 0;
      for (let j = 1; j < 4; j++) if (attributes.skinWeight.getComponent(i, j) > attributes.skinWeight.getComponent(i, strongest)) strongest = j;
      const name = shoes.skeleton.bones[attributes.skinIndex.getComponent(i, strongest)].name;
      const side = name.endsWith('_R') ? 'R' : 'L'; shoes.getVertexPosition(i, point); shoes.localToWorld(point); lowest[side] = Math.min(lowest[side], point.y);
    }
    const floor = rig.root.getWorldPosition(point).y;
    for (const side of ['R', 'L'] as const) {
      const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
      const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()), target = ankle.getWorldPosition(new THREE.Vector3());
      target.add(new THREE.Vector3(0, 0, .12 * settle).applyQuaternion(body)); target.y += (floor + .07 - lowest[side]) * settle;
      reach(hip, knee, ankle.position, target, new THREE.Vector3(side === 'R' ? -.3 : .3, 1, -.3).applyQuaternion(body));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)); ankle.updateWorldMatrix(false, true);
    }
  }
}
