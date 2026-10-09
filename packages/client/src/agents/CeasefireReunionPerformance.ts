import * as THREE from 'three';
import { ceasefireReunionPose, type CeasefireReunionRole, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

function prepare(rig: CharacterRig, encounter: TrilogyEpilogueEncounter, role: CeasefireReunionRole): void {
  const pose = ceasefireReunionPose(encounter, role), hero = rig.hero;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!);
    pelvis.position.y -= .035 + Math.abs(pose.stride) * .025; pelvis.rotation.set(0, 0, 0);
    hero.bones.get('spine')!.rotation.set(.035 * pose.embrace, 0, 0);
    hero.bones.get('chest')!.rotation.set(0, 0, 0);
    hero.bones.get('head')!.rotation.set(.05 * pose.embrace, .22 * pose.embrace, -.06 * pose.embrace);
  } else {
    rig.torso.position.set(0, 1.95 - Math.abs(pose.stride) * .025, 0); rig.torso.rotation.set(.035 * pose.embrace, 0, 0);
    rig.head.rotation.set(-.03 * pose.embrace, .22 * pose.embrace, -.06 * pose.embrace);
  }
  rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1, stride = pose.stride * (i ? -1 : 1);
    const hip = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], knee = hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    if (!hero) hip.position.set(sign * .225, rig.torso.position.y, 0);
    const foot = rig.root.localToWorld(new THREE.Vector3(sign * .29, (hero ? hero.footHeight + .025 : .155) + Math.max(0, stride) * .12,
      (i ? -.1 : .1) + stride * .16));
    reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    shoulder.rotation.set(-stride * .2, 0, sign * -.06); elbow.rotation.set(-.18, 0, 0);
  }
  rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
}

/** Cache the delivered shirt surface in chest space; changing from a fallback invalidates it. */
function backContact(rig: CharacterRig, left: boolean): THREE.Vector3 {
  const anchor = rig.hero?.bones.get('chest') ?? rig.torso;
  const source = rig.hero?.root ?? rig.detail.children.find(child => child.name.endsWith('-detailed-body')) ?? rig.torso;
  const key = left ? 'ceasefireBackLeft' : 'ceasefireBackRight';
  let cached = anchor.userData[key] as { source: THREE.Object3D; point: THREE.Vector3 } | undefined;
  if (!cached || cached.source !== source) {
    rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
    const origin = rig.root.localToWorld(new THREE.Vector3(left ? -.34 : .34, left ? 2.95 : 2.65, -1.5));
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())), meshes: THREE.Mesh[] = [];
    rig.detail.traverseVisible(object => {
      if (object instanceof THREE.Mesh && /cloth|work-top|crew.neck|coat|shirt|tunic|leather/i.test(object.name + (object.material as THREE.Material).name)) {
        if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); meshes.push(object);
      }
    });
    const hit = new THREE.Raycaster(origin, direction, 0, 2.7).intersectObjects(meshes, false)[0];
    const point = hit?.point.clone().addScaledVector(direction, -.02) ?? rig.root.localToWorld(new THREE.Vector3(left ? -.34 : .34, left ? 2.95 : 2.65, -.34));
    cached = { source, point: anchor.worldToLocal(point) }; anchor.userData[key] = cached;
  }
  return anchor.localToWorld(cached.point.clone());
}

function hands(rig: CharacterRig, partner: CharacterRig, encounter: TrilogyEpilogueEncounter, role: CeasefireReunionRole): void {
  const pose = ceasefireReunionPose(encounter, role), hero = rig.hero;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`), palm = new THREE.Vector3(i ? -.13 : .13, -.18, .02);
    const end = wrist?.position ?? new THREE.Vector3(0, -.79, .055);
    const rest = elbow.localToWorld(end.clone());
    if (wrist) rest.add(palm.clone().applyQuaternion(rotation));
    const contact = backContact(partner, i === 1), lift = Math.sin(pose.embrace * Math.PI) * .3;
    const desired = rest.lerp(contact, pose.embrace); desired.y += lift;
    if (wrist) desired.sub(palm.applyQuaternion(rotation));
    reach(shoulder, elbow, end, desired, new THREE.Vector3(sign * 1.2, .05, -.08).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
        hero!.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(finger === 1 ? .1 : 0, 0, -sign * .14 * pose.embrace);
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.14 * pose.embrace; });
  }
  rig.root.updateWorldMatrix(true, true); rig.root.updateMatrixWorld(true);
}

/** Base poses for both partners precede the cloth queries, including the first cold frame. */
export function poseCeasefireReunionPair(a: CharacterRig, b: CharacterRig, encounter: TrilogyEpilogueEncounter,
  roles: readonly [CeasefireReunionRole, CeasefireReunionRole]): void {
  prepare(a, encounter, roles[0]); prepare(b, encounter, roles[1]);
  hands(a, b, encounter, roles[0]); hands(b, a, encounter, roles[1]);
}
