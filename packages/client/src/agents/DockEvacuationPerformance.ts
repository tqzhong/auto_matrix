import * as THREE from 'three';
import { FILM_SETS, DOCK_EVACUATION, dockCargoPose, shaftSealLever, SHAFT_SEAL, type DockEvacuationGesture, type ShaftSealGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

function hands(rig: CharacterRig, targets: THREE.Vector3[], grip = 1, blend = grip): void {
  if (!blend) return;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, side = i ? 'L' : 'R', hero = rig.hero;
    const upper = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i];
    const lower = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`);
    const upperRest = upper.quaternion.clone(), lowerRest = lower.quaternion.clone(), wristRest = wrist?.quaternion.clone();
    const end = wrist?.position ?? new THREE.Vector3(0, -.79, .055);
    const offset = wrist ? new THREE.Vector3(sign * .1, -.15, 0).applyQuaternion(rotation) : new THREE.Vector3();
    reach(upper, lower, end, targets[i].clone().sub(offset), new THREE.Vector3(sign * .9, -.65, -.2).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) {
        const bone = hero!.bones.get(`finger${finger}-${joint}_${side}`)!;
        bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, sign * -.55, grip);
      }
      wrist.quaternion.slerpQuaternions(wristRest!, wrist.quaternion.clone(), blend);
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = THREE.MathUtils.lerp(finger.rotation.x, -.65, grip); });
    upper.quaternion.slerpQuaternions(upperRest, upper.quaternion.clone(), blend);
    lower.quaternion.slerpQuaternions(lowerRest, lower.quaternion.clone(), blend);
  }
  rig.root.updateMatrixWorld(true);
}
export function poseDockEvacuation(rig: CharacterRig, gesture?: DockEvacuationGesture): void {
  if (!gesture || gesture.role !== 'kid') return;
  if (!rig.hero) for (let i = 0; i < 2; i++) { rig.hips[i].position.x = (i ? 1 : -1) * .225; rig.hips[i].position.z = 0; }
  if (!rig.hero && gesture.handling === 'continuous' && ['depositing', 'wind', 'order'].includes(gesture.phase)) {
    // A close approach leaves the crate beside the relaxed hands. Draw the
    // arms slightly back during release and retain that clearance afterwards.
    const gap = (gesture.approach?.z ?? DOCK_EVACUATION.delivery.z) - DOCK_EVACUATION.cargoRest[1].z;
    rig.shoulders.forEach(shoulder => { shoulder.rotation.x += Math.max(0, 1.2 - gap) * .6; });
  }
  if (!rig.dockCargo?.root.visible) return;
  const prop = rig.dockCargo, pose = dockCargoPose(gesture);
  if (!rig.hero && pose.bend > 0) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    const continuous = gesture.handling === 'continuous', drop = pose.bend * (continuous ? .75 : 1.1);
    const x = pose.x * pose.grip * (continuous ? .4 : 1);
    const z = continuous ? -.08 * pose.bend : (pose.z - DOCK_EVACUATION.crate.z) * pose.grip;
    rig.torso.position.y -= drop;
    rig.torso.position.x += x; rig.torso.position.z += z;
    if (continuous) {
      rig.torso.rotation.x += .68 * pose.bend; rig.head.rotation.x -= .68 * pose.bend;
    }
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.y -= drop;
      rig.hips[i].position.x += x; rig.hips[i].position.z += z; rig.root.updateWorldMatrix(true, true);
      const foot = rig.root.localToWorld(new THREE.Vector3((i ? 1 : -1) * .27, .155, 0));
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3((i ? 1 : -1) * .2, .1, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    }
    rig.root.updateWorldMatrix(true, true);
  }
  prop.root.position.set(pose.x, pose.y, pose.z); prop.root.updateWorldMatrix(true, true);
  const targets = prop.handles.map((handle, i) => {
    const target = handle.getWorldPosition(new THREE.Vector3());
    if (pose.grip === 1 || rig.hero) return target;
    const rest = rig.root.worldToLocal(rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055)));
    const end = rig.root.worldToLocal(target);
    const forward = THREE.MathUtils.smoothstep(pose.grip, .35, 1);
    const lateral = THREE.MathUtils.smoothstep(pose.grip, 0, .45);
    const x = THREE.MathUtils.lerp(rest.x, end.x + (i ? 1 : -1) * .18 * (1 - forward), lateral);
    rest.lerp(end, forward); rest.x = x;
    return rig.root.localToWorld(rest);
  });
  hands(rig, targets, pose.grip, THREE.MathUtils.smoothstep(pose.grip, 0, .25));
}
export function poseShaftSeal(rig: CharacterRig, gesture?: ShaftSealGesture): void {
  if (!gesture) return;
  const report = gesture.phase === 'reporting', aftermath = gesture.phase === 'detonating';
  const speaking = report ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, .4) * (1 - THREE.MathUtils.smoothstep(gesture.elapsed, SHAFT_SEAL.report + SHAFT_SEAL.order - .4, SHAFT_SEAL.report + SHAFT_SEAL.order)) : 0;
  if (gesture.role === 'lock') {
    const order = report ? THREE.MathUtils.smoothstep(gesture.elapsed, SHAFT_SEAL.report - .2, SHAFT_SEAL.report + .4) : 0;
    rig.head.rotation.y = (.42 - order * .9) * speaking;
    rig.head.rotation.x = gesture.phase === 'done' ? -.36 : aftermath ? -.04 - .32 * THREE.MathUtils.smoothstep(gesture.elapsed, 4.4, 5.6) : -.04;
    rig.shoulders[1].rotation.x = -.12 - order * .30 * speaking; rig.elbows[1].rotation.x = -.15 - order * .5 * speaking;
    return;
  }
  if (gesture.role === 'citizen_16') {
    rig.head.rotation.y = -.55 * speaking;
    rig.head.rotation.x = gesture.phase === 'done' ? -.24 : aftermath ? -.24 * THREE.MathUtils.smoothstep(gesture.elapsed, .6, 1.5) : .08;
    return;
  }
  if (report) { rig.head.rotation.y = .55 * Math.sin(Math.PI * gesture.elapsed / (SHAFT_SEAL.report + SHAFT_SEAL.order)); return; }
  if (gesture.phase === 'ready' || gesture.phase === 'done') return;
  const center = FILM_SETS.film_zion_command_bunker.center, lever = shaftSealLever(gesture);
  const release = aftermath ? THREE.MathUtils.smoothstep(gesture.elapsed, .2, 1.3) : 0;
  const t = (gesture.phase === 'reaching' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, SHAFT_SEAL.reach) : 1) * (1 - release);
  if (!t) return;
  rig.root.updateWorldMatrix(true, true);
  const targets = [-1, 1].map((sign, i) => {
    const end = rig.hero ? rig.hero.bones.get(`wrist_${i ? 'L' : 'R'}`)!.getWorldPosition(new THREE.Vector3())
      : rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
    return end.lerp(new THREE.Vector3(center.x + lever.x - sign * SHAFT_SEAL.lever.grip / 2, center.y - 1 + lever.y, center.z + lever.z), t);
  });
  hands(rig, targets, t, t);
}
