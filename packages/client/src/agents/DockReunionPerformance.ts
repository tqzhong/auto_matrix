import * as THREE from 'three';
import { FILM_SETS, dockArrivalPoint, dockDepartureFoot, dockReunionFoot, dockReunionPose, dockReunionRail, type DockDepartureGesture, type DockReunionGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';

/** The partner's delivered clothing supplies the back contact, rather than a guessed wrist location. */
export function reunionBackContact(rig: CharacterRig, left: boolean): THREE.Vector3 {
  const anchor = rig.hero?.bones.get('chest') ?? rig.torso;
  const source = rig.hero?.root ?? rig.detail.getObjectByName('zee-detailed-body');
  const key = left ? 'reunionBackLeft' : 'reunionBackRight';
  let cached = anchor.userData[key] as { source?: THREE.Object3D; point: THREE.Vector3 } | undefined;
  if (!cached || cached.source !== source) {
    rig.root.updateMatrixWorld(true);
    const origin = rig.root.localToWorld(new THREE.Vector3(left ? -.42 : .42, 2.82, -1.5));
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
    const meshes: THREE.Mesh[] = [];
    rig.detail.traverseVisible(object => { if (object instanceof THREE.Mesh) { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); meshes.push(object); } });
    const hit = new THREE.Raycaster(origin, direction, 0, 2.7).intersectObjects(meshes, false)[0];
    const point = hit?.point.clone().addScaledVector(direction, -.025) ?? rig.root.localToWorld(new THREE.Vector3(left ? -.42 : .42, 2.82, -.34));
    cached = { source, point: anchor.worldToLocal(point) }; anchor.userData[key] = cached;
  }
  return anchor.localToWorld(cached.point.clone());
}

/** Feet, hands and necklace remain tied to the saved reunion frame, including a paused cold load. */
export function poseDockReunion(rig: CharacterRig, gesture?: DockReunionGesture, partner?: CharacterRig): void {
  if (!gesture) return;
  const pose = dockReunionPose(gesture), hero = rig.hero;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const descending = gesture.role === 'link' && ['ready', 'disembarking', 'exiting'].includes(gesture.phase);
  const holding = descending && (gesture.departure === undefined ? 1 : gesture.phase === 'exiting'
    ? THREE.MathUtils.smoothstep(dockArrivalPoint(dockReunionFoot(gesture, true), gesture.forward).z, 53, 55.35) : 0);
  if (rig.empCharm && gesture.role === 'link') {
    rig.empCharm.visible = true;
    const chest = hero?.bones.get('chest') ?? rig.torso;
    if (rig.empCharm.parent !== chest) chest.add(rig.empCharm);
    rig.empCharm.position.set(0, hero ? .08 : .69, .47 + pose.charm * .16);
    rig.empCharm.rotation.set(0, 0, 0);
  }
  if (gesture.phase === 'walking' || gesture.phase === 'done') return;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.position.y -= descending ? .48 : .08 + pose.kiss * .09;
    pelvis.position.x += pose.kiss * .16;
    pelvis.rotation.set(0, 0, 0);
    hero.bones.get('spine')!.rotation.set(pose.kiss * .13, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0);
    hero.bones.get('head')!.rotation.set(descending ? .32 : .06 + pose.charm * .16, pose.kiss * -.18, pose.kiss * -.08);
  } else {
    rig.torso.position.set(0, 1.91, 0); rig.torso.rotation.set(pose.kiss * .14, 0, 0);
    rig.head.rotation.set(-.05 - pose.charm * .13, pose.kiss * -.18, pose.kiss * -.08);
  }
  rig.root.updateMatrixWorld(true);
  const center = FILM_SETS.film_zion_hangar.center;
  for (let i = 0; i < 2; i++) {
    const side = i ? 'L' : 'R', sign = i ? 1 : -1;
    const foot = descending || gesture.role === 'link' && gesture.phase === 'approaching' ? dockReunionFoot(gesture, i === 1) : undefined;
    const target = foot ? new THREE.Vector3(center.x + foot.x, center.y - 1 + foot.y, center.z + foot.z)
      : rig.root.localToWorld(new THREE.Vector3(sign * .29, 0, i ? -.1 : .1));
    target.y += hero ? hero.footHeight + .025 : .155;
    const upperLeg = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], lowerLeg = hero?.bones.get(`knee_${side}`) ?? rig.knees[i];
    const ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    if (!hero) upperLeg.position.set(sign * .225, 1.91, 0);
    reach(upperLeg, lowerLeg, ankle.position, target, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(lowerLeg.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    let hand: THREE.Vector3 | undefined;
    if (holding) {
      const rail = dockReunionRail(gesture, i === 1);
      hand = new THREE.Vector3(center.x + rail.x, center.y - 1 + rail.y, center.z + rail.z);
    } else if (partner && pose.embrace) hand = reunionBackContact(partner, i === 1);
    if (hero) {
      const wrist = hero.bones.get(`wrist_${side}`)!, elbow = hero.bones.get(`elbow_${side}`)!, shoulder = hero.bones.get(`shoulder_${side}`)!;
      const palm = new THREE.Vector3(i ? -.13 : .13, -.18, .02), rest = rig.root.localToWorld(new THREE.Vector3(sign * .93, 2.35, .04));
      const desired = hand ? rest.lerp(hand, descending ? Number(holding) : pose.embrace) : rest;
      if (i === 1 && pose.charm && rig.empCharm) desired.lerp(rig.empCharm.localToWorld(new THREE.Vector3(0, -.18, .015)), pose.charm);
      reach(shoulder, elbow, wrist.position, desired.sub(palm.applyQuaternion(rotation)), new THREE.Vector3(sign * .9, -.45, -.15).applyQuaternion(rotation));
      wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
      for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
        hero.bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(finger === 1 ? .16 : 0, 0, (i ? -1 : 1) * (descending ? .6 : .22));
    } else {
      const elbow = rig.elbows[i];
      const rest = rig.root.localToWorld(new THREE.Vector3(sign * .8, 2.1, .2));
      const desired = hand ? rest.lerp(hand, pose.embrace) : rest;
      reach(rig.shoulders[i], elbow, new THREE.Vector3(0, -.79, .055), desired, new THREE.Vector3(sign * .9, -.45, -.15).applyQuaternion(rotation));
      rig.fingers[i].forEach(finger => { finger.rotation.x = -.2; });
    }
  }
  rig.root.updateMatrixWorld(true);
}

/** Both actors are posed before a helper hand reads the injured captain's clothing. */
export function departureSupportContact(rig: CharacterRig, shoulder: boolean): THREE.Vector3 {
  rig.root.updateMatrixWorld(true);
  const origin = rig.torso.localToWorld(new THREE.Vector3(shoulder ? 1.4 : -1.4, shoulder ? 1.39 : .45, .04));
  const direction = new THREE.Vector3(shoulder ? -1 : 1, 0, 0).applyQuaternion(rig.torso.getWorldQuaternion(new THREE.Quaternion()));
  const meshes: THREE.Mesh[] = [];
  const source = rig.detail.getObjectByName('roland-detailed-body') ?? rig.torso;
  source.traverseVisible(object => { if (object instanceof THREE.Mesh) { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); meshes.push(object); } });
  const hit = new THREE.Raycaster(origin, direction, 0, 1.8).intersectObjects(meshes, false)[0];
  return hit?.point.addScaledVector(direction, -.025) ?? rig.torso.localToWorld(new THREE.Vector3(shoulder ? .52 : -.4, shoulder ? 1.39 : .45, .04));
}
export function poseDockDeparture(rig: CharacterRig, gesture?: DockDepartureGesture, partner?: CharacterRig): void {
  if (!gesture) return;
  const hero = rig.hero, injured = gesture.role === 'roland', pair = injured || gesture.role === 'colt';
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), center = FILM_SETS.film_zion_hangar.center;
  rig.detail.position.set(0, 0, 0); rig.detail.rotation.set(0, 0, 0);
  if (hero) {
    const pelvis = hero.bones.get('pelvis')!; pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.position.y -= .4; pelvis.rotation.set(0, 0, 0);
    hero.bones.get('spine')!.rotation.set(.1, 0, 0); hero.bones.get('chest')!.rotation.set(0, 0, 0); hero.bones.get('head')!.rotation.set(.22, 0, 0);
  } else {
    rig.torso.position.set(0, 1.55, 0); rig.torso.rotation.set(injured ? .1 : .06, 0, injured && gesture.assisted ? .13 : 0);
    rig.head.rotation.set(.12, 0, 0);
  }
  rig.root.updateMatrixWorld(true);
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? 1 : -1, foot = dockDepartureFoot(gesture, i === 1);
    const target = new THREE.Vector3(center.x + foot.x, center.y - 1 + foot.y + (hero ? hero.footHeight + .025 : .155), center.z + foot.z);
    const hip = hero?.bones.get(`hip_${side}`) ?? rig.hips[i], knee = hero?.bones.get(`knee_${side}`) ?? rig.knees[i], ankle = hero?.bones.get(`ankle_${side}`) ?? rig.ankles[i];
    if (!hero) hip.position.set(sign * .225, 1.55, 0);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    const hand = pair && gesture.assisted && partner && i === (injured ? 0 : 1) ? departureSupportContact(partner, injured)
      : rig.root.localToWorld(new THREE.Vector3(sign * .86, 2.15, .1));
    const shoulder = hero?.bones.get(`shoulder_${side}`) ?? rig.shoulders[i], elbow = hero?.bones.get(`elbow_${side}`) ?? rig.elbows[i];
    const wrist = hero?.bones.get(`wrist_${side}`);
    const palm = new THREE.Vector3(i ? -.13 : .13, -.18, .02);
    reach(shoulder, elbow, wrist?.position ?? new THREE.Vector3(0, -.79, .055), wrist ? hand.sub(palm.applyQuaternion(rotation)) : hand,
      new THREE.Vector3(sign * .9, -.45, -.15).applyQuaternion(rotation));
    if (wrist) wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    else rig.fingers[i].forEach(finger => { finger.rotation.x = -.2; });
  }
  rig.root.updateMatrixWorld(true);
}
