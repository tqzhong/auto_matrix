import * as THREE from 'three';
import { AMBUSH_CALL } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';
import { PHONE_HAND } from './PhoneModel.js';
import { reach } from './SpoonPerformance.js';

const smooth = THREE.MathUtils.smoothstep;
const mirror = (point: THREE.Vector3) => point.clone().setX(-point.x);
const leftGrip = new THREE.Quaternion(PHONE_HAND.rotation.x, -PHONE_HAND.rotation.y, -PHONE_HAND.rotation.z, PHONE_HAND.rotation.w);
const givingOffset = PHONE_HAND.position.clone().add(new THREE.Vector3(.009, 0, 0).applyQuaternion(PHONE_HAND.rotation));
const receivingGrip = PHONE_HAND.rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
const receivingOffset = PHONE_HAND.position.clone().add(new THREE.Vector3(0, -.195, 0).applyQuaternion(receivingGrip));

/** Calibrate the delivered fingertips in bind space, then mirror the mobile grip. */
function fingers(rig: HeroRig, side: 'R' | 'L', amount: number, opening = 0): void {
  const wrist = rig.bones.get(`wrist_${side}`)!;
  let pose = wrist.userData.ambushPhoneGrip as THREE.Quaternion[][][] | undefined;
  if (!pose) {
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), count = [0, 0, 0, 0, 0];
    const distal = skin.skeleton.bones.map(bone => new RegExp(`^finger([1-5])-3_${side}$`).exec(bone.name));
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) for (let k = 0; k < 4; k++) {
      const index = skinIndex.getComponent(i, k), digit = distal[index];
      if (!digit || skinWeight.getComponent(i, k) < .95) continue;
      pads[+digit[1] - 1].add(point.fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]));
      count[+digit[1] - 1]++;
    }
    pads.forEach((pad, i) => pad.divideScalar(count[i]));
    pose = [false, true].map(open => pads.map((pad, i) => { const digit = i + 1;
      const base = rig.rest.get(`finger${digit}-1_${side}`)!;
      const first = rig.rest.get(`finger${digit}-2_${side}`)!, second = rig.rest.get(`finger${digit}-3_${side}`)!;
      const direction = (open ? new THREE.Vector3(i === 0 ? -.4 : 0, -1, 0) : i === 0 ? new THREE.Vector3(0, -.15, -.989) : new THREE.Vector3(.55, .835, 0)).normalize();
      const target = i === 0 ? new THREE.Vector3(.158, -.078, .04)
        : new THREE.Vector3(i === 4 ? .13 : i === 3 ? .175 : .18, i === 4 ? -.26 : -.245, base.z);
      if (open) { target.x = .025; target.y = i === 0 ? -.03 : -.4; }
      if (side === 'L') { direction.x *= -1; target.x *= -1; }
      const end = target.clone().addScaledVector(direction, -pad.length()), axis = end.clone().sub(base);
      const a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
      axis.normalize(); end.copy(base).addScaledVector(axis, distance);
      const along = (a * a - b * b + distance * distance) / (2 * distance);
      const bend = new THREE.Vector3(0, i === 0 ? 1 : -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      const parent = new THREE.Quaternion();
      return [hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, j) => {
        const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][j].clone().normalize(), desired.normalize());
        const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
      });
    }));
    wrist.userData.ambushPhoneGrip = pose;
  }
  for (let digit = 1; digit <= 5; digit++) for (let joint = 1; joint <= 3; joint++)
    rig.bones.get(`finger${digit}-${joint}_${side}`)!.quaternion.slerp(pose[0][digit - 1][joint - 1].clone().slerp(pose[1][digit - 1][joint - 1], opening * .4), amount);
}

function hold(rig: CharacterRig, side: 'R' | 'L', position: THREE.Vector3, rotation: THREE.Quaternion, amount: number, receiving = false, opening = 0, settle = 0): void {
  if (!rig.hero || amount <= 0) return;
  const bones = rig.hero.bones, shoulder = bones.get(`shoulder_${side}`)!, elbow = bones.get(`elbow_${side}`)!, wrist = bones.get(`wrist_${side}`)!;
  const grip = side === 'L' ? leftGrip : receiving ? receivingGrip : PHONE_HAND.rotation, offset = side === 'L' ? mirror(PHONE_HAND.position) : receiving ? receivingOffset : givingOffset;
  const orientation = rotation.clone().multiply(grip.clone().invert());
  const scale = wrist.getWorldScale(new THREE.Vector3());
  const target = position.clone().sub(offset.clone().multiply(scale).applyQuaternion(orientation));
  const palm = wrist.getWorldQuaternion(new THREE.Quaternion());
  // Align the grip below the handset, then slide along its long axis. A
  // closed grip approaching through the thin face would intersect the case.
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
  target.addScaledVector(along, -.45).lerpVectors(wrist.getWorldPosition(new THREE.Vector3()), target, smooth(amount, 0, .65))
    .addScaledVector(along, .45 * smooth(amount, .65, 1));
  const basePole = elbow.getWorldPosition(new THREE.Vector3()).sub(shoulder.getWorldPosition(new THREE.Vector3())).normalize();
  const pole = (side === 'L' ? new THREE.Vector3(.35, -1.6, .8) : new THREE.Vector3(-.6, -.65, -.35)).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())).normalize();
  reach(shoulder, elbow, wrist.position, target, basePole.lerp(pole, amount * (1 - settle)));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(palm.slerp(orientation, smooth(amount, 0, .65))));
  fingers(rig.hero, side, smooth(amount, 0, .65) * (1 - settle), opening); wrist.updateWorldMatrix(false, true);
}

/** One saved clock, evaluated after both actors' base poses; no frame-history IK. */
export function poseAmbushCallPair(morpheus: CharacterRig, trinity: CharacterRig | undefined, gesture: NonNullable<MotionInput['ambushCall']>): void {
  if (!morpheus.hero) return;
  const t = gesture.ready ? 0 : gesture.elapsed, giving = !gesture.ready && t >= AMBUSH_CALL.handoff, left = t >= AMBUSH_CALL.exchange;
  morpheus.root.updateWorldMatrix(true, true); trinity?.root.updateWorldMatrix(true, true);
  const rootRotation = morpheus.root.getWorldQuaternion(new THREE.Quaternion());
  const rotation = rootRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, .14)));
  const heldRotation = rootRotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, .9)));
  const head = morpheus.hero.bones.get('head')!;
  const ear = head.localToWorld(new THREE.Vector3(.23, .08, .02)).sub(new THREE.Vector3(0, .175, .04).applyQuaternion(heldRotation));
  const handoff = morpheus.root.localToWorld(new THREE.Vector3(-.2, 3.05, 1.32));
  const exchange = morpheus.root.localToWorld(new THREE.Vector3(.08, 3.2, .7));
  const initial = trinity?.hero ? trinity.root.localToWorld(new THREE.Vector3(-.4, 2.85, .6)) : handoff.clone();
  const raised = smooth(t, AMBUSH_CALL.exchange, AMBUSH_CALL.connected), lower = smooth(t, AMBUSH_CALL.lower, AMBUSH_CALL.duration);
  const restingWrist = morpheus.hero.bones.get('wrist_L')!;
  const restRotation = restingWrist.getWorldQuaternion(new THREE.Quaternion()).multiply(leftGrip);
  const resting = restingWrist.localToWorld(mirror(PHONE_HAND.position));
  const phone = t < AMBUSH_CALL.handoff ? initial.clone().lerp(handoff, smooth(t, 0, AMBUSH_CALL.handoff)) : t < AMBUSH_CALL.exchange ? handoff.clone().lerp(exchange, smooth(t, AMBUSH_CALL.handoff, AMBUSH_CALL.exchange))
    : exchange.clone().lerp(ear, raised).lerp(resting, lower);
  // Carry the handset in front of the shirt while lowering it; the direct
  // ear-to-rest line cuts through the chest as the palm turns inward.
  phone.add(new THREE.Vector3(0, 0, .35 * Math.sin(Math.PI * lower)).applyQuaternion(rootRotation));
  const orientation = rotation.clone().slerp(heldRotation, raised).slerp(restRotation, lower);
  const right = gesture.ready ? 0 : smooth(t, 0, .85) * (1 - smooth(t, AMBUSH_CALL.exchange + .2, AMBUSH_CALL.connected - .05));
  const rightRelease = exchange.clone().add(new THREE.Vector3(-.35, 0, 0).applyQuaternion(rootRotation).multiplyScalar(smooth(t, AMBUSH_CALL.exchange, AMBUSH_CALL.exchange + .2)));
  // Withdraw off the back face of the handset, not across its face along the actor's heading.
  const giverRelease = handoff.clone().add(new THREE.Vector3(0, 0, -.4).applyQuaternion(rotation).multiplyScalar(smooth(t, AMBUSH_CALL.handoff, AMBUSH_CALL.handoff + .2)));
  hold(morpheus, 'R', t < AMBUSH_CALL.exchange ? phone : rightRelease, rotation, right, true, Math.max(1 - smooth(t, AMBUSH_CALL.handoff, AMBUSH_CALL.handoff + .2), smooth(t, AMBUSH_CALL.exchange - .25, AMBUSH_CALL.exchange)));
  hold(morpheus, 'L', phone, orientation, gesture.ready ? 0 : smooth(t, AMBUSH_CALL.handoff, AMBUSH_CALL.exchange - .05), false, 0, smooth(t, AMBUSH_CALL.duration - .25, AMBUSH_CALL.duration));
  if (trinity?.hero) hold(trinity, 'R', t < AMBUSH_CALL.handoff ? phone : giverRelease, rotation,
    (gesture.ready ? smooth(gesture.elapsed, 0, AMBUSH_CALL.approach) : 1) * (1 - smooth(t, AMBUSH_CALL.handoff + .2, AMBUSH_CALL.exchange + .1)), false,
    smooth(t, AMBUSH_CALL.handoff - .25, AMBUSH_CALL.handoff));
  // Trinity already carries the phone while approaching. Only her arm is blending from the retreat pose.
  if (trinity?.hero && gesture.ready) fingers(trinity.hero, 'R', 1);
  for (const [rig, side, owner] of [[morpheus, left ? 'L' : 'R', giving], [trinity, 'R', !giving]] as const) {
    if (!rig?.hero || !rig.phone) continue;
    const wrist = rig.hero.bones.get(`wrist_${side}`)!;
    wrist.add(rig.phone.root); rig.phone.root.position.copy(side === 'L' ? mirror(PHONE_HAND.position) : rig === morpheus ? receivingOffset : givingOffset);
    rig.phone.root.quaternion.copy(side === 'L' ? leftGrip : rig === morpheus ? receivingGrip : PHONE_HAND.rotation);
    rig.phone.root.visible = owner && t < AMBUSH_CALL.duration; rig.phone.update(smooth(t, AMBUSH_CALL.exchange, AMBUSH_CALL.connected) * (1 - lower));
  }
}
