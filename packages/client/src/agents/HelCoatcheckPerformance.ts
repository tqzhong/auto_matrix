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

export function poseHelPistol(rig: CharacterRig, pitch = 0, trainingGrip = false): void {
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
  const gun = rig.weapons?.[0];
  if (rig.hero && gun?.userData.helPistol) {
    const middle = rig.hero.rest.get('finger3-1_R')!, index = rig.hero.rest.get('finger2-1_R')!;
    gun.position.set(.148, middle.y + .055, index.z + .045);
    gun.rotation.set(Math.PI / 2, 0, 0);
    handRotation.multiply(gun.quaternion.clone().invert());
  }
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation), recoil = Math.max(0, 1 - rig.motion.shotAge / .18) ** 2;
  const anchor = eye.add(new THREE.Vector3(-.12, -.08, 0).applyQuaternion(rotation))
    .sub(new THREE.Vector3(0, -.13, .03).applyQuaternion(orientation));
  if (rig.hero && gun?.userData.helPistol) anchor.add(new THREE.Vector3(.14, .018, .015).applyQuaternion(orientation))
    .sub(gun.position.clone().applyQuaternion(handRotation));
  const fromShoulder = anchor.clone().sub(shoulder.getWorldPosition(new THREE.Vector3())), scale = shoulder.getWorldScale(new THREE.Vector3()).x;
  const armLength = (elbow.position.length() + wrist.position.length()) * scale - .01, along = fromShoulder.dot(forward);
  const extension = Math.min(rig.hero ? armLength : .95, Math.max(.15, -along + Math.sqrt(Math.max(0, along * along - fromShoulder.lengthSq() + armLength * armLength))) * (rig.hero ? .98 : .96));
  const target = anchor.addScaledVector(forward, extension - recoil * .06).add(new THREE.Vector3(0, recoil * .04, 0));
  // Use the actual grip offset when finding arm reach, and keep the elbow
  // outside the body instead of folding the forearm up in front of the face.
  reach(shoulder, elbow, wrist.position.clone(), target, (rig.hero ? new THREE.Vector3(-1, -.5, -.8) : new THREE.Vector3(-.4, -.8, -.2)).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handRotation));
  if (gun?.userData.helPistol && !rig.hero) {
    gun.position.set(0, -.08, .13);
    gun.rotation.set(0, 0, 0);
  }
  if (rig.hero && gun?.userData.helPistol) posePistolFingers(rig, gun, trainingGrip);
  rig.detail.userData.helPistol = true;
  rig.root.updateMatrixWorld(true);
}

function posePistolFingers(rig: CharacterRig, gun: THREE.Group, trainingGrip: boolean): void {
  const hero = rig.hero!, wrist = hero.bones.get('wrist_R')!;
  const key = trainingGrip ? 'trainingPistolGrip' : 'pistolGrip';
  let grip = wrist.userData[key] as { pads: THREE.Vector3[]; fingers: THREE.Quaternion[][] } | undefined;
  if (!grip) {
    const skin = hero.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const { position, skinIndex, skinWeight } = skin.geometry.attributes;
    const pads = Array.from({ length: 5 }, () => new THREE.Vector3()), counts = [0, 0, 0, 0, 0], point = new THREE.Vector3();
    const distal = skin.skeleton.bones.map(bone => /^finger([1-5])-3_R$/.exec(bone.name));
    for (let vertex = 0; vertex < position.count; vertex++) for (let part = 0; part < 4; part++) {
      const index = skinIndex.getComponent(vertex, part), match = distal[index];
      if (!match || skinWeight.getComponent(vertex, part) < .95) continue;
      point.fromBufferAttribute(position, vertex).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[index]);
      pads[Number(match[1]) - 1].add(point); counts[Number(match[1]) - 1]++;
    }
    pads.forEach((pad, i) => pad.divideScalar(counts[i]));
    grip = { pads, fingers: pads.map((pad, i) => pistolFinger(rig, gun, pad, i, 0, trainingGrip)) };
    wrist.userData[key] = grip;
  }
  const trigger = trainingGrip ? 1 : 1 - THREE.MathUtils.smoothstep(rig.motion.shotAge, .09, .18);
  const index = pistolFinger(rig, gun, grip.pads[1], 1, trigger, trainingGrip);
  for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
    hero.bones.get(`finger${finger}-${joint}_R`)!.quaternion.copy((finger === 2 ? index : grip.fingers[finger - 1])[joint - 1]);
}

function pistolFinger(rig: CharacterRig, gun: THREE.Group, pad: THREE.Vector3, i: number, trigger: number, trainingGrip: boolean): THREE.Quaternion[] {
  const hero = rig.hero!, handle = gun.getObjectByName('hel-pistol-grip') as THREE.Mesh;
  const center = handle.position.clone().applyQuaternion(gun.quaternion).add(gun.position);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion).applyQuaternion(gun.quaternion);
  const base = hero.rest.get(`finger${i + 1}-1_R`)!, first = hero.rest.get(`finger${i + 1}-2_R`)!, second = hero.rest.get(`finger${i + 1}-3_R`)!;
  const direction = (i === 0 ? trainingGrip ? new THREE.Vector3(0, -.9, -Math.sqrt(.19)) : new THREE.Vector3(0, -.2, -.98) : i === 1 ? new THREE.Vector3(0, -1, 0).lerp(new THREE.Vector3(.55, .835, 0), trigger) : new THREE.Vector3(.55, .835, 0)).normalize();
  const thumbZ = gun.position.z - .08, fingerZ = base.z + (trainingGrip && i === 2 ? .004 : 0);
  const target = i === 0 ? new THREE.Vector3(.175, center.y + (-handle.scale.z / 2 - .035 - normal.z * (thumbZ - center.z)) / normal.y, thumbZ)
    : i === 1 ? new THREE.Vector3(gun.position.x - .112 + .124 * trigger, gun.position.y - .2 + .112 * trigger,
      gun.position.z - .012 - .014 * trigger - .02 * Math.sin(Math.PI * trigger))
    : new THREE.Vector3(i === 4 ? .12 : i === 3 ? .145 : .16,
      center.y + (handle.scale.z / 2 + .023 - normal.z * (fingerZ - center.z)) / normal.y, fingerZ);
  // Move the index pad out through the guard before straightening it beside
  // the slide. Interpolating joint rotations alone cuts across the metal.
  const end = target.clone().addScaledVector(direction, -pad.length()), axis = end.clone().sub(base);
  const a = first.length(), b = second.length(), distance = THREE.MathUtils.clamp(axis.length(), .001, a + b - .001);
  axis.normalize(); end.copy(base).addScaledVector(axis, distance);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const bend = i === 0 ? new THREE.Vector3(0, trainingGrip ? .5 : 1, trainingGrip ? .5 : 0) : new THREE.Vector3(0, -1, 0); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
  const hinge = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))), parent = new THREE.Quaternion();
  return [hinge.clone().sub(base), end.clone().sub(hinge), direction].map((desired, joint) => {
    const rotation = new THREE.Quaternion().setFromUnitVectors([first, second, pad][joint].clone().normalize(), desired.normalize());
    const local = parent.clone().invert().multiply(rotation); parent.copy(rotation); return local;
  });
}
