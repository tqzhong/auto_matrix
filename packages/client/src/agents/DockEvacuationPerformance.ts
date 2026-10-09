import * as THREE from 'three';
import { FILM_SETS, DOCK_EVACUATION, dockCargoPose, shaftSealLever, SHAFT_SEAL, type DockEvacuationGesture, type ShaftSealGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

function hands(rig: CharacterRig, targets: THREE.Vector3[]): void {
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, side = i ? 'L' : 'R', hero = rig.hero;
    const upper = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i];
    const lower = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`);
    const end = wrist?.position ?? new THREE.Vector3(0, -.79, .055);
    const offset = wrist ? new THREE.Vector3(sign * .1, -.15, 0).applyQuaternion(rotation) : new THREE.Vector3();
    reach(upper, lower, end, targets[i].clone().sub(offset), new THREE.Vector3(sign * .9, -.65, -.2).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero!.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.z = sign * -.55;
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.65; });
  }
  rig.root.updateMatrixWorld(true);
}
export function poseDockEvacuation(rig: CharacterRig, gesture?: DockEvacuationGesture): void {
  if (!gesture || gesture.role !== 'kid') return;
  if (!rig.hero) for (let i = 0; i < 2; i++) { rig.hips[i].position.x = (i ? 1 : -1) * .225; rig.hips[i].position.z = 0; }
  if (!rig.dockCargo?.root.visible) return;
  const prop = rig.dockCargo, pose = dockCargoPose(gesture);
  if (!rig.hero && pose.bend > 0) {
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    rig.torso.position.y -= pose.bend * 1.1;
    rig.torso.position.x += pose.x; rig.torso.position.z += pose.z - DOCK_EVACUATION.crate.z;
    for (let i = 0; i < 2; i++) {
      rig.hips[i].position.y -= pose.bend * 1.1;
      rig.hips[i].position.x += pose.x; rig.hips[i].position.z += pose.z - DOCK_EVACUATION.crate.z; rig.root.updateWorldMatrix(true, true);
      const foot = rig.root.localToWorld(new THREE.Vector3((i ? 1 : -1) * .27, .155, 0));
      reach(rig.hips[i], rig.knees[i], rig.ankles[i].position, foot, new THREE.Vector3((i ? 1 : -1) * .2, .1, 1).applyQuaternion(rotation));
      rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    }
    rig.root.updateWorldMatrix(true, true);
  }
  prop.root.position.set(pose.x, pose.y, pose.z); prop.root.updateWorldMatrix(true, true);
  hands(rig, prop.handles.map(handle => handle.getWorldPosition(new THREE.Vector3())));
}
export function poseShaftSeal(rig: CharacterRig, gesture?: ShaftSealGesture): void {
  if (!gesture || gesture.role !== 'citizen_15' || gesture.phase === 'ready' || gesture.phase === 'done') return;
  const center = FILM_SETS.film_zion_command_bunker.center, lever = shaftSealLever(gesture);
  const t = gesture.phase === 'reaching' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, SHAFT_SEAL.reach) : 1;
  rig.root.updateWorldMatrix(true, true);
  const targets = [-1, 1].map((sign, i) => {
    const end = rig.hero ? rig.hero.bones.get(`wrist_${i ? 'L' : 'R'}`)!.getWorldPosition(new THREE.Vector3())
      : rig.elbows[i].localToWorld(new THREE.Vector3(0, -.79, .055));
    return end.lerp(new THREE.Vector3(center.x + lever.x - sign * SHAFT_SEAL.lever.grip / 2, center.y - 1 + lever.y, center.z + lever.z), t);
  });
  hands(rig, targets);
}
