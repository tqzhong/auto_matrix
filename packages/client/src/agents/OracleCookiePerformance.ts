import * as THREE from 'three';
import { FILM_SETS, ORACLE_COOKIE, type OracleVisitGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { connectGardenWrists } from './OracleParkHands.js';

const cookieFrame = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, 0, 'YXZ'));
// The giver holds the opposite rim; turn the local biscuit within her grip so
// its disc extends beyond the fingers instead of back through the palm.
const oracleCookieFrame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(cookieFrame);

export function cookiePinch(rig: CharacterRig, amount = 1): THREE.Vector3 {
  const anatomy = rig.parkHands?.[0].root.visible ? rig.parkHands[0] : undefined;
  if (!rig.hero && !anatomy) return new THREE.Vector3(0, -.79, .055);
  const hero = rig.hero, bones = hero?.bones ?? new Map(anatomy!.bones.flat().map(bone => [bone.name, bone]));
  const hand = hero ? bones.get('wrist_R')! : anatomy!.wrist, point = new THREE.Vector3(anatomy ? .085 : .14, anatomy ? -.28 : -.24, anatomy ? .15 : .12);
  if (amount === 0) return point;
  let pose = hand.userData.cookiePinch as THREE.Quaternion[][] | undefined;
  if (!pose) {
    const skin = hero ? hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh : anatomy!.skin;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const pads = [new THREE.Vector3(), new THREE.Vector3()], counts = [0, 0], vertex = new THREE.Vector3();
    const distal = skin.skeleton.bones.map(bone => /^finger([12])-3_R$/.exec(bone.name));
    for (let i = 0; i < position.count; i++) for (let part = 0; part < 4; part++) {
      const index = skinIndex.getComponent(i, part), digit = distal[index];
      if (!digit || skinWeight.getComponent(i, part) < .95) continue;
      vertex.fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
      pads[Number(digit[1]) - 1].add(vertex); counts[Number(digit[1]) - 1]++;
    }
    // The cookie's faces lie across the palm's Y axis. Oppose the actual
    // thumb and index pads there without changing the finger lengths.
    pose = pads.map((pad, i) => {
      pad.divideScalar(counts[i]);
      const base = hero?.rest.get(`finger${i + 1}-1_R`) ?? bones.get(`finger${i + 1}-1_R`)!.position;
      const first = hero?.rest.get(`finger${i + 1}-2_R`) ?? bones.get(`finger${i + 1}-2_R`)!.position;
      const second = hero?.rest.get(`finger${i + 1}-3_R`) ?? bones.get(`finger${i + 1}-3_R`)!.position;
      const direction = (i === 0 ? new THREE.Vector3(0, -.98, .2) : anatomy ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-.2, .98, 0)).normalize();
      const target = point.clone(); target.y += i === 0 ? .033 : anatomy ? -.044 : -.037;
      const end = target.addScaledVector(direction, -pad.length()), axis = end.clone().sub(base);
      const a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
      axis.normalize(); end.copy(base).addScaledVector(axis, distance);
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      const bend = anatomy && i === 1 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, i === 0 ? 1 : -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
      return [hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, joint) => {
        const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][joint].clone().normalize(), desired.normalize());
        const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
      });
    });
    hand.userData.cookiePinch = pose;
  }
  for (let finger = 1; finger <= 2; finger++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${finger}-${segment}_R`)!.quaternion.slerp(pose[finger - 1][segment - 1], amount);
  if (anatomy) for (let finger = 3; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${finger}-${segment}_R`)!.rotation.z = [.4, .7, .35][segment - 1] * amount;
  hand.updateWorldMatrix(true, true);
  return point;
}

export function holdOracleCookie(rig: CharacterRig, pinch: THREE.Vector3, edge: THREE.Vector3, rotation = new THREE.Quaternion()): void {
  if (!rig.cookie) return;
  const anatomy = rig.parkHands?.[0].root.visible ? rig.parkHands[0] : undefined;
  const hand = rig.hero?.bones.get('wrist_R') ?? anatomy?.wrist ?? rig.elbows[0], cookie = rig.cookie;
  if (cookie.parent !== hand) hand.add(cookie);
  cookie.scale.set(1, 1, 1).divide(hand.getWorldScale(new THREE.Vector3()));
  if (rig.hero || anatomy) {
    const frame = anatomy ? oracleCookieFrame : cookieFrame;
    cookie.quaternion.copy(frame);
    cookie.position.copy(pinch).sub(edge.clone().applyQuaternion(rotation.clone().invert()).multiply(cookie.scale).applyQuaternion(frame));
    return;
  }
  const grip = hand.localToWorld(pinch.clone()).sub(edge);
  cookie.position.copy(hand.worldToLocal(grip));
  cookie.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
}

export function poseOracleCookie(rig: CharacterRig, gesture?: OracleVisitGesture): void {
  if (!gesture || gesture.phase === 'waiting') return;
  const t = gesture.phase === 'examining' ? gesture.elapsed : 10.8;
  if (t < 7) return;
  const blend = gesture.role === 'oracle'
    ? THREE.MathUtils.smoothstep(t, 7.2, 8.65) * (1 - THREE.MathUtils.smoothstep(t, ORACLE_COOKIE.transfer, 9.85))
    : THREE.MathUtils.smoothstep(t, 8.2, ORACLE_COOKIE.transfer) * (1 - THREE.MathUtils.smoothstep(t, ORACLE_COOKIE.transfer, 10.8));
  const center = FILM_SETS.film_oracle_home.center, point = ORACLE_COOKIE.contact;
  const contact = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
  const edge = new THREE.Vector3(gesture.role === 'neo' ? .1 : -.1, 0, 0);
  const anatomy = rig.parkHands?.[0].root.visible ? rig.parkHands[0] : undefined;
  if (anatomy && gesture.role === 'oracle') {
    // Lean from the hips to offer the biscuit inside the measured arm reach.
    // The feet/root stay planted and the tilt returns with the hand release.
    rig.torso.rotation.x += .3 * blend; rig.head.rotation.x -= .18 * blend;
  }
  rig.root.updateWorldMatrix(true, true);
  const upper = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0], lower = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const hand = rig.hero?.bones.get('wrist_R') ?? anatomy?.wrist ?? lower;
  const pinch = cookiePinch(rig, gesture.role === 'neo' ? THREE.MathUtils.smoothstep(t, 8.2, ORACLE_COOKIE.transfer)
    : THREE.MathUtils.smoothstep(t, 7, 7.35) * (1 - THREE.MathUtils.smoothstep(t, ORACLE_COOKIE.transfer, 9.85)));
  if (blend > 0) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    if (rig.hero || anatomy) {
      const offered = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, -Math.PI / 2, 0));
      if (anatomy) offered.multiply(cookieFrame).multiply(oracleCookieFrame.clone().invert());
      const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(offered, blend);
      const target = hand.localToWorld(pinch.clone()).lerp(contact.clone().add(edge), blend)
        .sub(pinch.clone().multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
      const startUpper = upper.quaternion.clone(), startLower = lower.quaternion.clone();
      reach(upper, lower, hand.position, target, new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rotation));
      if (anatomy) {
        upper.quaternion.slerpQuaternions(startUpper, upper.quaternion.clone(), blend);
        lower.quaternion.slerpQuaternions(startLower, lower.quaternion.clone(), blend);
        lower.updateWorldMatrix(true, true);
      }
      hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    } else {
      reach(upper, lower, pinch, hand.localToWorld(pinch.clone()).lerp(contact.clone().add(edge), blend),
        new THREE.Vector3(-.6, -.8, .1).applyQuaternion(rotation));
    }
    hand.updateWorldMatrix(false, true);
  }
  holdOracleCookie(rig, pinch, edge);
  if (anatomy) connectGardenWrists(rig);
}
