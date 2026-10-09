import * as THREE from 'three';
import { HEL_COATCHECK, helAttendantPose, type HelCoatcheckEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** Use the posed, visible arm surface, including the shipped skin topology. */
export function helAttendantContact(attendant: THREE.Object3D): { point: THREE.Vector3; normal: THREE.Vector3 } | undefined {
  const shoulder = attendant.getObjectByName('shoulder_L'); if (!shoulder) return;
  attendant.updateWorldMatrix(true, false); attendant.updateMatrixWorld(true);
  const center = shoulder.localToWorld(new THREE.Vector3(0, -.15, 0));
  const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(attendant.getWorldQuaternion(new THREE.Quaternion()));
  const meshes: THREE.Mesh[] = [];
  attendant.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingSphere(); }
    meshes.push(object);
  });
  const hit = new THREE.Raycaster(center.clone().addScaledVector(normal, .6), normal.clone().negate(), 0, 1.2).intersectObjects(meshes, false)[0];
  return hit ? { point: hit.point, normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : normal } : undefined;
}

export function poseHelProtection(rig: CharacterRig, attendant?: THREE.Object3D, state?: HelCoatcheckEncounter): void {
  if (rig.detail.userData.helProtectionContact) {
    rig.mobilWrists?.forEach(wrist => wrist.rotation.set(0, 0, 0)); delete rig.detail.userData.helProtectionContact;
  }
  if (!attendant || !state?.rescuePhysical || state.rescuePaused || state.phase !== 'combat') return;
  const t = state.rescueElapsed ?? 0;
  const weight = THREE.MathUtils.smoothstep(t, 1.25, HEL_COATCHECK.approachSeconds) * (1 - THREE.MathUtils.smoothstep(t, 3.15, 3.5));
  if (!weight) return;
  rig.detail.userData.helProtectionContact = true;
  rig.root.updateMatrixWorld(true);
  const feet = rig.ankles.map(ankle => ankle.getWorldPosition(new THREE.Vector3())), crouch = helAttendantPose(state).crouch;
  rig.torso.position.y -= .9 * crouch;
  rig.hips.forEach(hip => { hip.position.y -= .9 * crouch; });
  rig.torso.rotation.x += .19 * weight; rig.head.rotation.x += .18 * weight;
  rig.root.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    reach(rig.hips[i], rig.knees[i], rig.ankles[i].position.clone(), feet[i],
      new THREE.Vector3(i ? .2 : -.2, .25, 1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
    rig.ankles[i].quaternion.copy(rig.knees[i].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  }
  const contact = helAttendantContact(attendant), wrist = rig.mobilWrists?.[0]; if (!contact || !wrist) return;
  const shoulder = rig.shoulders[0], elbow = rig.elbows[0], offset = new THREE.Vector3(0, -.10, .005);
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), contact.normal.clone().negate());
  const target = wrist.localToWorld(offset.clone()).lerp(contact.point.clone().addScaledVector(contact.normal, .065), weight);
  reach(shoulder, elbow, wrist.position.clone(), target.sub(offset.clone().applyQuaternion(orientation)),
    new THREE.Vector3(-.4, -.7, .4).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  rig.fingers[0].forEach(finger => { finger.rotation.x = -.18 * weight; });
  rig.root.updateMatrixWorld(true);
}

export function poseHelPistol(rig: CharacterRig, pitch = 0): void {
  const shoulder = rig.hero?.bones.get('shoulder_R') ?? rig.shoulders[0];
  const elbow = rig.hero?.bones.get('elbow_R') ?? rig.elbows[0];
  const wrist = rig.hero?.bones.get('wrist_R') ?? rig.mobilWrists?.[0];
  if (!wrist) return;
  rig.root.updateMatrixWorld(true);
  const head = rig.hero?.bones.get('head') ?? rig.head, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const eye = head.localToWorld((head.userData.cameraEye as THREE.Vector3 | undefined)?.clone() ?? new THREE.Vector3(0, .1, .25));
  const aim = Math.max(-1.35, Math.min(1.35, pitch)), orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), aim));
  // The shipped right palm faces +X and rests on the side of the grip.
  const handRotation = orientation.clone();
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation), recoil = Math.max(0, 1 - rig.motion.shotAge / .18) ** 2;
  const anchor = eye.add(new THREE.Vector3(-.12, -.08, 0).applyQuaternion(rotation))
    .sub(new THREE.Vector3(0, -.13, .03).applyQuaternion(handRotation));
  const fromShoulder = anchor.clone().sub(shoulder.getWorldPosition(new THREE.Vector3())), scale = shoulder.getWorldScale(new THREE.Vector3()).x;
  const armLength = (elbow.position.length() + wrist.position.length()) * scale - .01, along = fromShoulder.dot(forward);
  const extension = Math.min(.95, Math.max(.15, -along + Math.sqrt(Math.max(0, along * along - fromShoulder.lengthSq() + armLength * armLength))) * .96);
  const target = anchor.addScaledVector(forward, extension - recoil * .06).add(new THREE.Vector3(0, recoil * .04, 0));
  reach(shoulder, elbow, wrist.position.clone(), target, new THREE.Vector3(-.4, -.8, -.2).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handRotation));
  const gun = rig.weapons?.[0];
  if (gun?.userData.helPistol) {
    gun.position.set(rig.hero ? .14 : 0, rig.hero ? .018 : -.08, rig.hero ? .015 : .13);
    gun.rotation.set(0, 0, 0);
  }
  if (rig.hero) {
    rig.hero.bones.get('finger1-1_R')!.rotation.set(0, -.7, .2);
    rig.hero.bones.get('finger1-2_R')!.rotation.set(0, 0, .4);
    rig.hero.bones.get('finger1-3_R')!.rotation.set(0, 0, .5);
    for (let finger = 3; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      rig.hero.bones.get(`finger${finger}-${segment}_R`)!.rotation.set(0, 0, segment === 1 ? .65 : segment === 2 ? .8 : .6);
  }
  rig.detail.userData.helPistol = true;
  rig.root.updateMatrixWorld(true);
}
