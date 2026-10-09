import * as THREE from 'three';
import { FILM_SETS, templeWheelHands, type TempleDefenseGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { poseDockBriefing } from './DockBriefingPerformance.js';

export function poseTempleDefense(rig: CharacterRig, gesture?: TempleDefenseGesture, partner?: CharacterRig): void {
  if (!gesture) return;
  if (gesture.role === 'lock') {
    poseDockBriefing(rig, { role: 'lock', phase: gesture.phase === 'orders' ? 'warning' : 'ready', elapsed: gesture.elapsed, escort: 0 });
    return;
  }
  if (gesture.phase === 'waiting' && ['link', 'zee'].includes(gesture.role)) {
    const hero = rig.hero, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    rig.detail.position.set(0, 0, -.06); rig.detail.rotation.set(0, 0, 0);
    if (hero) {
      const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.position.y -= .7; pelvis.rotation.set(0, 0, 0);
      hero.bones.get('spine')!.rotation.set(.12, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0); hero.bones.get('head')!.rotation.set(.1, 0, -.08);
    } else { rig.torso.position.set(0, 1.22, 0); rig.torso.rotation.set(.12, 0, 0); rig.head.rotation.set(.08, gesture.role === 'zee' ? -.35 : 0, -.08); }
    rig.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1, side = i ? 'L' : 'R';
      const hip = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], knee = hero?.bones.get(`knee_${side}`) ?? rig.knees[i], ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
      if (!hero) hip.position.set(sign * .225, 1.22, 0);
      const foot = rig.root.localToWorld(new THREE.Vector3(sign * .32, hero ? hero.footHeight + .025 : .155, i ? -.12 : .14));
      reach(hip, knee, ankle.position, foot, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i], wrist = hero?.bones.get(`wrist_${side}`);
      const hand = partner ? templeHuddleContact(partner, i === 1) : rig.root.localToWorld(new THREE.Vector3(sign * .58, 1.6, .5));
      const palm = wrist ? new THREE.Vector3(sign * .1, -.15, 0).applyQuaternion(rotation) : new THREE.Vector3();
      reach(shoulder, elbow, wrist?.position ?? new THREE.Vector3(0, -.79, .055), hand.sub(palm), new THREE.Vector3(sign * .9, -.4, -.15).applyQuaternion(rotation));
      if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      else rig.fingers[i].forEach(finger => { finger.rotation.x = -.2; });
    }
    rig.root.updateMatrixWorld(true); return;
  }
  if (gesture.role !== 'zee' || gesture.phase !== 'mounting' || gesture.mount === undefined) return;
  const hero = rig.hero, center = FILM_SETS.film_zion_temple.center;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.rotation.set(0, 0, 0);
    hero.bones.get('spine')!.rotation.set(0, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0);
    hero.bones.get('head')!.rotation.set(.18, 0, 0);
  } else { rig.torso.position.set(0, 1.99, 0); rig.torso.rotation.set(0, 0, 0); rig.head.rotation.set(.18, 0, 0); }
  rig.root.updateMatrixWorld(true);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), points = templeWheelHands(gesture.mount, gesture.turn);
  for (let i = 0; i < 2; i++) {
    const sign = i ? 1 : -1, side = i ? 'L' : 'R';
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`), end = wrist?.position ?? new THREE.Vector3(0, -.79, .055);
    const point = points[1 - i], hand = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
    const palm = wrist ? new THREE.Vector3(sign * .1, -.15, 0).applyQuaternion(rotation) : new THREE.Vector3();
    const rest = elbow.localToWorld(end.clone());
    reach(shoulder, elbow, end, rest.lerp(hand.sub(palm), THREE.MathUtils.smoothstep(gesture.grip, 0, 1)), new THREE.Vector3(sign * .9, -.5, -.25).applyQuaternion(rotation));
    if (wrist) {
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++) hero!.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.z = sign * -.55;
    } else rig.fingers[i].forEach(finger => { finger.rotation.x = -.55; });
  }
  rig.root.updateMatrixWorld(true);
}

function templeHuddleContact(rig: CharacterRig, left: boolean): THREE.Vector3 {
  const anchor = rig.hero?.bones.get('chest') ?? rig.torso, source = rig.hero?.root ?? rig.detail.getObjectByName('zee-detailed-body');
  const key = left ? 'templeHuddleLeft' : 'templeHuddleRight';
  let cached = anchor.userData[key] as { source?: THREE.Object3D; point: THREE.Vector3 } | undefined;
  if (!cached || cached.source !== source) {
    rig.root.updateMatrixWorld(true);
    const origin = anchor.localToWorld(new THREE.Vector3(left ? -.36 : .36, rig.hero ? 0 : .55, -1.5));
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion())), meshes: THREE.Mesh[] = [];
    rig.detail.traverseVisible(object => { if (object instanceof THREE.Mesh) { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); meshes.push(object); } });
    const hit = new THREE.Raycaster(origin, direction, 0, 2.7).intersectObjects(meshes, false)[0];
    const point = hit?.point.clone().addScaledVector(direction, -.025) ?? anchor.localToWorld(new THREE.Vector3(left ? -.36 : .36, rig.hero ? 0 : .55, -.34));
    cached = { source, point: anchor.worldToLocal(point) }; anchor.userData[key] = cached;
  }
  return anchor.localToWorld(cached.point.clone());
}
