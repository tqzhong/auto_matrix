import * as THREE from 'three';
import { FILM_SETS, WELLS_AFTERMATH, WELLS_CURB, wellsAftermathDoor, wellsAftermathPose, type WellsAftermathGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

const smooth = THREE.MathUtils.smoothstep;
const up = new THREE.Vector3(0, 1, 0);
const cabPalm = new THREE.Vector3(.21, -.18, .02);

export function poseWellsAftermath(rig: CharacterRig, gesture?: WellsAftermathGesture): void {
  const hero = rig.hero;
  if (!hero || !gesture && !rig.root.userData.wellsSpeaking) return;
  const pose = gesture && wellsAftermathPose(gesture);
  const amount = pose?.speaking ?? 0;
  const face = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh | undefined;
  const jaw = face?.morphTargetDictionary?.jawOpen;
  if (jaw !== undefined && face?.morphTargetInfluences) face.morphTargetInfluences[jaw] = amount * .33;
  rig.root.userData.wellsSpeaking = amount > 0;
  if (!gesture || !pose) return;
  const { elapsed, role } = gesture, { bones } = hero;
  bones.get('head')!.rotation.x += pose.inspect * .22;
  bones.get('spine')!.rotation.x += pose.inspect * .25;
  bones.get('chest')!.rotation.x += pose.inspect * .16;
  if (elapsed >= 4.18) lookAroundBooth(rig, gesture, pose);
  bones.get('head')!.rotation.x += amount * .035;
  if (role !== 'smith' || elapsed >= 2.48) return;

  const center = FILM_SETS.film_wells_phone.center, truckZ = center.z - 26, streetY = center.y - 1;
  const truckLift = gesture.curbside ? WELLS_CURB.truckLift : 0, sidewalk = gesture.curbside ? WELLS_CURB.height : 0;
  const { upperStep, lowerStep, door, doorGrip } = WELLS_AFTERMATH;
  const stepping = 1 - smooth(elapsed, 2.15, 2.48), brace = smooth(elapsed, .72, 1.05) * (1 - smooth(elapsed, 1.65, 2.12));
  // The cab crouch changes leg reach; the walking targets still sit on the street.
  const legs = (['L', 'R'] as const).map(side => {
    const ankle = bones.get(`ankle_${side}`)!;
    return { side, ankle, walkTarget: ankle.getWorldPosition(new THREE.Vector3()) };
  });
  const pelvis = bones.get('pelvis')!;
  pelvis.position.y -= (.5 + .36 * brace) * stepping;
  bones.get('spine')!.rotation.x += .26 * stepping;
  bones.get('head')!.rotation.x += .3 * stepping;
  rig.root.updateWorldMatrix(true, true);
  const facing = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const platform = (point: { x: number; y: number; z: number }, offset: number) =>
    new THREE.Vector3(center.x + point.x, streetY + point.y + hero.footHeight, truckZ + point.z + offset);
  for (const { side, ankle, walkTarget } of legs) {
    const lead = side === 'L';
    const upper = platform({ ...upperStep, y: upperStep.y + truckLift }, lead ? .28 : -.27);
    const lower = platform({ ...lowerStep, y: lowerStep.y + truckLift }, .25);
    const floor = platform({ x: lead ? -3.95 : -3.79, y: sidewalk, z: lead ? -.02 : -.93 }, 0);
    const step = smooth(elapsed, lead ? 1.28 : 1.64, lead ? 1.91 : 2.25);
    const foot = (lead ? upper.lerp(lower, smooth(elapsed, .81, 1.18)) : upper).lerp(floor, step);
    foot.y += Math.sin(Math.PI * step) * .15;
    const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!;
    const target = walkTarget.lerp(foot, stepping);
    const orientation = ankle.getWorldQuaternion(new THREE.Quaternion()).slerp(facing, stepping);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(lead ? .12 : -.12, .15, 1).applyQuaternion(facing));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
  const handContact = smooth(elapsed, .74, .94) * (1 - smooth(elapsed, 1.65, 2.12));
  if (handContact > 0) {
    const upper = bones.get('shoulder_R')!, lower = bones.get('elbow_R')!, hand = bones.get('wrist_R')!;
    const angle = wellsAftermathDoor(elapsed);
    const support = new THREE.Vector3(doorGrip.x + doorGrip.width / 2 + .006, doorGrip.y, doorGrip.z)
      .applyAxisAngle(up, angle).add(new THREE.Vector3(center.x + door.x, streetY + truckLift, truckZ + door.z));
    const palm = cabPalm.clone();
    const flat = new THREE.Quaternion().setFromAxisAngle(up, angle + Math.PI);
    const orientation = hand.getWorldQuaternion(new THREE.Quaternion()).slerp(flat, handContact);
    const target = hand.localToWorld(palm.clone()).lerp(support, handContact)
      .sub(palm.multiply(hand.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
    reach(upper, lower, hand.position, target, new THREE.Vector3(-.65, -.35, .5).applyQuaternion(facing));
    hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  }
}

function lookAroundBooth(rig: CharacterRig, gesture: WellsAftermathGesture, pose: ReturnType<typeof wellsAftermathPose>): void {
  const { elapsed, role, curbside } = gesture;
  const { bones } = rig.hero!;
  const head = bones.get('head')!, spine = bones.get('spine')!, chest = bones.get('chest')!;
  const center = FILM_SETS.film_wells_phone.center;
  const point = head.getWorldPosition(new THREE.Vector3());
  const eyeY = point.y + (head.userData.cameraEye as THREE.Vector3).y;
  const lookAtAgent = (target: WellsAftermathGesture['role']) => {
    const other = wellsAftermathPose({ elapsed, role: target, curbside });
    return new THREE.Vector3(center.x + other.x, eyeY + other.y - pose.y, center.z + other.z);
  };
  let target: THREE.Vector3, weight: number;
  if (role === 'smith' && elapsed < 6.2) {
    const receiver = WELLS_AFTERMATH.receiver;
    target = new THREE.Vector3(center.x + receiver.x, center.y - 1 + receiver.y + (curbside ? WELLS_CURB.height : 0), center.z + receiver.z);
    weight = smooth(elapsed, 4.18, 4.96) * (1 - smooth(elapsed, 5.64, 6.2));
  } else if (role === 'smith') {
    target = lookAtAgent('agent_jones').lerp(lookAtAgent('agent_brown'), smooth(elapsed, 7.78, 8.43));
    weight = smooth(elapsed, 6.2, 6.88);
  } else if (role === 'agent_jones') {
    const brownSpeaks = smooth(elapsed, 7.83, 8.45) * (1 - smooth(elapsed, 10.13, 10.68));
    target = lookAtAgent('smith').lerp(lookAtAgent('agent_brown'), brownSpeaks);
    weight = smooth(elapsed, 5.36, 5.9);
  } else {
    const jonesSpeaks = smooth(elapsed, 6.23, 6.89) * (1 - smooth(elapsed, 7.8, 8.38));
    target = lookAtAgent('smith').lerp(lookAtAgent('agent_jones'), jonesSpeaks);
    weight = smooth(elapsed, 5.75, 6.21);
  }
  const { clamp } = THREE.MathUtils;
  const relative = rig.root.worldToLocal(target.clone()).sub(rig.root.worldToLocal(point));
  const turn = clamp(Math.atan2(relative.x, relative.z) * .21, -.39, .39) * weight;
  spine.rotation.y += turn;
  chest.rotation.y += turn;
  const aim = head.parent!.worldToLocal(target).sub(head.position);
  const yaw = clamp(Math.atan2(aim.x, aim.z), -1.27, 1.27);
  const pitch = clamp(-Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), -.27, .98);
  const facing = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, head.rotation.z, 'YXZ'));
  head.quaternion.slerp(facing, weight);
}
