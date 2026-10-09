import * as THREE from 'three';
import { FILM_SETS, helDanceDoorContact, helDanceDoorGrip, type HelDanceDoorEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

function palmOffset(rig: CharacterRig, wrist: THREE.Object3D, side: 'R' | 'L'): THREE.Vector3 {
  const key = `helDoorPalm${side}`, cached = rig.detail.userData[key] as THREE.Vector3 | undefined;
  if (cached && rig.detail.userData[`${key}Hero`] === rig.hero) return cached.clone();
  const sign = side === 'R' ? 1 : -1, skin = rig.hero?.trackingSkin?.mesh;
  let front = .045, palmFront = -Infinity;
  const offset = new THREE.Vector3(sign * front, -.15, 0), handBones = new RegExp(`^(wrist|finger).*_${side}$`);
  if (skin) {
    rig.root.updateMatrixWorld(true);
    skin.skeleton.update(); front = 0;
    for (let v = 0; v < skin.geometry.attributes.position.count; v++) {
      let hand = 0;
      for (let i = 0; i < 4; i++) if (handBones.test(skin.skeleton.bones[skin.geometry.attributes.skinIndex.getComponent(v, i)].name))
        hand += skin.geometry.attributes.skinWeight.getComponent(v, i);
      if (hand < .95) continue;
      const point = wrist.worldToLocal(skin.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
      front = Math.max(front, point.x * sign);
      if (point.y > -.24 && point.y < -.06 && point.x * sign > palmFront) { palmFront = point.x * sign; offset.copy(point); }
    }
  }
  // Use the visible palm pad, with enough clearance for the flattened fingers.
  offset.x = sign * front; rig.detail.userData[key] = offset.clone(); rig.detail.userData[`${key}Hero`] = rig.hero; return offset;
}

export function poseHelDanceDoor(rig: CharacterRig, door?: HelDanceDoorEncounter): void {
  if (rig.detail.userData.helDoorContact) {
    rig.mobilWrists?.forEach(wrist => wrist.quaternion.identity()); delete rig.detail.userData.helDoorContact;
  }
  if (!door?.physical || door.phase !== 'opening') return;
  const grip = helDanceDoorGrip(door); if (!grip) return;
  rig.detail.userData.helDoorContact = true;
  for (const [i, side] of (['R', 'L'] as const).entries()) {
    const shoulder = rig.hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = rig.hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = rig.hero?.bones.get(`wrist_${side}`) ?? rig.mobilWrists?.[i]; if (!wrist) continue;
    if (rig.hero) {
      for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) rig.hero.bones.get(`finger${f}-${s}_${side}`)!.rotation.set(0, 0, 0);
      rig.hero.bones.get(`finger1-1_${side}`)!.rotation.y = i ? 1.1 : -1.1;
      rig.root.updateMatrixWorld(true);
      const basis = wrist.getWorldQuaternion(new THREE.Quaternion());
      for (let f = 2; f <= 5; f++) for (let s = 1; s <= 3; s++) {
        const joint = rig.hero.bones.get(`finger${f}-${s}_${side}`)!, child = rig.hero.bones.get(`finger${f}-${s + 1}_${side}`);
        const flatFinger = new THREE.Quaternion().setFromUnitVectors((child?.position ?? joint.position).clone().normalize(), new THREE.Vector3(0, -1, 0));
        joint.quaternion.copy(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(basis.clone().multiply(flatFinger)));
        joint.updateWorldMatrix(false, true);
      }
    } else rig.fingers[i].forEach(finger => finger.rotation.set(0, 0, 0));
    rig.root.updateMatrixWorld(true);
    const point = helDanceDoorContact(door, i ? -1 : 1), center = FILM_SETS.film_club_hel.center;
    const normal = new THREE.Vector3(point.normal.x, 0, point.normal.z), x = normal.clone().multiplyScalar(i ? 1 : -1), y = new THREE.Vector3(0, -1, 0);
    const flat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
    const orientation = wrist.getWorldQuaternion(new THREE.Quaternion()).slerp(flat, grip), offset = palmOffset(rig, wrist, side);
    const scale = wrist.getWorldScale(new THREE.Vector3()), current = wrist.localToWorld(offset.clone());
    const target = current.lerp(new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z), grip)
      .sub(offset.multiply(scale).applyQuaternion(orientation));
    reach(shoulder, elbow, wrist.position.clone(), target,
      new THREE.Vector3(i ? .55 : -.55, -.65, .15).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    rig.root.updateWorldMatrix(true, true);
  }
}
