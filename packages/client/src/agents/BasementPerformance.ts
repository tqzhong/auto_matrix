import * as THREE from 'three';
import { FILM_SETS, TV_EXIT, basementGasLaunch, basementHatchPoint, type BasementGesture, type BasementLauncherGesture, type TvExitGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { reach } from './SpoonPerformance.js';
import { groundCharacter } from './GroundContact.js';

function hand(rig: CharacterRig, side: 'R' | 'L', target: THREE.Vector3, grip: number): void {
  const bones = rig.hero!.bones, sign = side === 'R' ? 1 : -1;
  const wrist = bones.get(`wrist_${side}`)!, elbow = bones.get(`elbow_${side}`)!, shoulder = bones.get(`shoulder_${side}`)!;
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
  reach(shoulder, elbow, wrist.position, target.clone().sub(palm), new THREE.Vector3(sign, -.35, .25).applyQuaternion(rotation));
  wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  for (let f = 1; f <= 5; f++) for (let segment = 1; segment <= 3; segment++)
    bones.get(`finger${f}-${segment}_${side}`)!.rotation.z = sign * (f === 1 ? .2 : segment === 1 ? .6 : .75) * grip;
  wrist.updateWorldMatrix(false, true);
}

/** Low clearance poses operate on the same skeleton as the visible skin and clothes. */
export function poseBasement(rig: CharacterRig, gesture?: BasementGesture): void {
  if (!gesture) return;
  const lifting = gesture.role === 'trinity' && ['lifting', 'hatch_ready'].includes(gesture.phase);
  const landing = gesture.landing === undefined ? 0 : 1 - THREE.MathUtils.smoothstep(gesture.landing, .4, 2.1);
  const weight = gesture.crawling || lifting ? 1 : Math.max(gesture.crouching ? .65 : 0, landing);
  if (!weight) return;
  if (!rig.hero) {
    rig.torso.position.y = 1.3; rig.torso.rotation.x = .65;
    for (let i = 0; i < 2; i++) { rig.hips[i].position.y = 1.3; rig.hips[i].rotation.x = -.9; rig.knees[i].rotation.x = 1.65; rig.ankles[i].rotation.x = -.75; }
    return;
  }
  const hero = rig.hero, bone = (name: string) => hero.bones.get(name)!, pelvis = bone('pelvis');
  pelvis.position.copy(hero.rest.get('pelvis')!); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, lifting ? .55 : 1.05, weight);
  pelvis.rotation.set(0, 0, 0); bone('spine').rotation.set(1.05 * weight, 0, 0); bone('chest').rotation.set(.28 * weight, 0, 0); bone('head').rotation.set(-.7 * weight, 0, 0);
  const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()), cycle = rig.motion.phase * Math.PI * 2;
  for (const [i, side] of ['R', 'L'].entries()) {
    const sign = i ? -1 : 1, hip = bone(`hip_${side}`), knee = bone(`knee_${side}`), ankle = bone(`ankle_${side}`);
    hip.rotation.set(0, 0, 0); knee.rotation.set(0, 0, 0); ankle.rotation.set(0, 0, 0); rig.root.updateWorldMatrix(true, true);
    const stride = gesture.crawling ? Math.cos(cycle + i * Math.PI) * .22 : 0;
    const target = ankle.getWorldPosition(new THREE.Vector3()).lerp(hero.root.localToWorld(new THREE.Vector3(sign * .52, hero.footHeight + .08, -.7 + stride)), weight);
    reach(hip, knee, ankle.position, target, new THREE.Vector3(sign * .4, -.2, 1).applyQuaternion(rotation));
    ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
  }
  groundCharacter(rig);
  rig.root.updateWorldMatrix(true, true);
  for (const [i, side] of ['R', 'L'].entries()) {
    if (lifting) {
      const center = FILM_SETS.film_ambush_house.center, target = basementHatchPoint(gesture.hatch, i);
      hand(rig, side as 'R' | 'L', new THREE.Vector3(center.x + target.x, center.y - 1 + target.y, center.z + target.z), .75);
    } else {
      const sign = i ? -1 : 1, crawl = Boolean(gesture.crawling);
      const target = hero.root.localToWorld(new THREE.Vector3(sign * .52, crawl ? .32 : 1.1, crawl ? 1.35 + Math.cos(cycle + i * Math.PI) * .18 : .8));
      hand(rig, side as 'R' | 'L', bone(`wrist_${side}`).localToWorld(new THREE.Vector3(0, -.19, .035)).lerp(target, weight), crawl ? .15 : .6);
    }
  }
}

export function poseBasementLauncher(rig: CharacterRig, gesture?: BasementLauncherGesture): void {
  if (!gesture || !rig.weapons?.[0]) return;
  const launch=basementGasLaunch(gesture.index),center=FILM_SETS.film_ambush_house.center,age=gesture.time-launch.at;
  const recoil=age>=0&&age<.25?Math.sin(age/.25*Math.PI)*.07:0;
  rig.root.updateWorldMatrix(true,true);
  const rotation=rig.root.getWorldQuaternion(new THREE.Quaternion()),direction=new THREE.Vector3(launch.velocity.x,launch.velocity.y,launch.velocity.z).normalize();
  const orientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(direction.x,direction.z))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2-Math.atan2(direction.y,Math.hypot(direction.x,direction.z))));
  const gun=rig.weapons[0],muzzle=new THREE.Vector3(center.x+launch.muzzle.x,center.y-1+launch.muzzle.y,center.z+launch.muzzle.z);
  if(gun.parent!==rig.root)rig.root.add(gun);
  gun.position.copy(rig.root.worldToLocal(muzzle.addScaledVector(direction,-1.455-recoil)));
  gun.quaternion.copy(rotation.clone().invert().multiply(orientation));gun.scale.setScalar(1/rig.root.getWorldScale(new THREE.Vector3()).x);gun.updateWorldMatrix(false,true);
  for(const [index,side] of ['R','L'].entries()) {
    const target=gun.localToWorld(new THREE.Vector3(0,index?-.78:-.08,-.12));
    if(rig.hero)hand(rig,side as 'R'|'L',target,.85);
    else {
      reach(rig.shoulders[index],rig.elbows[index],new THREE.Vector3(0,-.79,.055),target,new THREE.Vector3(index?.7:-.7,-.5,.1).applyQuaternion(rotation));
      for(const finger of rig.fingers[index])finger.rotation.x=-.65;
    }
  }
}

export function poseHardline(rig: CharacterRig, gesture?: TvExitGesture): void {
  if (rig.handset) rig.handset.root.visible = false;
  if (!rig.hero || !gesture) return;
  if (gesture.phase === 'emerging') {
    const progress = gesture.emerge?.[gesture.role] ?? 0;
    const hero = rig.hero, bones = hero.bones, center = FILM_SETS.film_tv_repair.center;
    if (progress >= TV_EXIT.emerge.climbEnd) {
      if (progress >= TV_EXIT.emerge.mantleEnd) return;
      const planted = THREE.MathUtils.smoothstep(progress, TV_EXIT.emerge.climbEnd + .015, TV_EXIT.emerge.climbEnd + .04)
        * (1 - THREE.MathUtils.smoothstep(progress, TV_EXIT.emerge.mantleEnd - .06, TV_EXIT.emerge.mantleEnd));
      bones.get('spine')!.rotation.x = -.32 * planted; bones.get('chest')!.rotation.x = .18 * planted; bones.get('head')!.rotation.x = .08 * planted;
      rig.root.updateWorldMatrix(true, true);
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).setY(0).normalize();
      const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(rotation).setY(0).normalize();
      for (const side of ['R', 'L'] as const) {
        const lateral = side === 'R' ? -1 : 1;
        const target = new THREE.Vector3(center.x + TV_EXIT.street.drain.x, center.y - .85, center.z + TV_EXIT.street.drain.z)
          .addScaledVector(forward, 1.02).addScaledVector(right, -lateral * .36);
        const palm = bones.get(`wrist_${side}`)!.localToWorld(new THREE.Vector3(0, -.19, .035));
        hand(rig, side, palm.lerp(target, planted), .9 * planted);
      }
      return;
    }
    const ladderZ = center.z + TV_EXIT.street.ladderZ, top = center.y - 1.45, bottom = top - TV_EXIT.street.shaftDepth + .8;
    const rung = (y: number) => THREE.MathUtils.clamp(top - Math.round((top - y) / .55) * .55, bottom, top);
    bones.get('spine')!.rotation.x = -.1; bones.get('chest')!.rotation.x = .14;
    rig.root.updateWorldMatrix(true, true);
    const cycle = Math.floor(progress * 22) % 2;
    for (const [index, side] of ['R', 'L'].entries()) {
      const typed = side as 'R' | 'L', sign = index ? 1 : -1, wrist = bones.get(`wrist_${side}`)!, elbow = bones.get(`elbow_${side}`)!, shoulder = bones.get(`shoulder_${side}`)!;
      const desiredY = wrist.getWorldPosition(new THREE.Vector3()).y + (index === cycle ? .2 : -.35);
      const scale = shoulder.getWorldScale(new THREE.Vector3()).x, limit = (elbow.position.length() + wrist.position.length()) * scale - .01;
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
      const orientation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      const palm = new THREE.Vector3(0, -.19, .035).multiply(wrist.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation);
      const grip = (y: number) => new THREE.Vector3(center.x + TV_EXIT.street.drain.x + sign * .48, y, ladderZ).sub(palm);
      const candidates: number[] = [];
      for (let y = top; y >= bottom; y -= .55) if (shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(grip(y)) <= limit) candidates.push(y);
      const handY = candidates.sort((a, b) => Math.abs(a - desiredY) - Math.abs(b - desiredY))[0] ?? rung(desiredY);
      hand(rig, typed, new THREE.Vector3(center.x + TV_EXIT.street.drain.x + sign * .48, handY, ladderZ), .9);
    }
    rig.root.updateWorldMatrix(true, true);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [index, side] of ['R', 'L'].entries()) {
      const sign = index ? 1 : -1, hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
      const targetX = center.x + TV_EXIT.street.drain.x + sign * .43, targetZ = ladderZ - .08;
      const desiredY = ankle.getWorldPosition(new THREE.Vector3()).y + (index === cycle ? -.35 : .2);
      const hipPoint = hip.getWorldPosition(new THREE.Vector3()), scale = hip.getWorldScale(new THREE.Vector3()).x;
      const reachLimit = (knee.position.length() + ankle.position.length()) * scale - .01;
      const candidates: number[] = [];
      for (let y = top; y >= bottom; y -= .55) if (hipPoint.distanceTo(new THREE.Vector3(targetX, y, targetZ)) <= reachLimit) candidates.push(y);
      const footY = candidates.sort((a, b) => Math.abs(a - desiredY) - Math.abs(b - desiredY))[0] ?? rung(desiredY);
      const target = new THREE.Vector3(targetX, footY, targetZ);
      const pole = () => new THREE.Vector3(sign * .35, 0, -.25).applyQuaternion(rotation);
      reach(hip, knee, ankle.position, target, pole()); ankle.updateWorldMatrix(false, true);
      const correction = target.clone().sub(ankle.getWorldPosition(new THREE.Vector3()));
      if (correction.lengthSq() > .000025) reach(hip, knee, ankle.position, target.clone().add(correction), pole());
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)); ankle.updateWorldMatrix(false, true);
    }
    return;
  }
  if (!rig.handset || gesture.phase === 'ready' || gesture.phase === 'done') return;
  const returning = gesture.phase === 'calling' ? THREE.MathUtils.smoothstep(gesture.elapsed, 5.3, 6.6) : 0;
  const pickup = gesture.phase === 'pickup' ? THREE.MathUtils.smoothstep(gesture.elapsed, .8, 1.8) : 1;
  const center = FILM_SETS.film_tv_repair.center, phone = TV_EXIT.phone;
  const base = new THREE.Vector3(center.x + phone.x + .26, center.y - 1 + phone.y, center.z + phone.z + .28);
  rig.root.updateWorldMatrix(true, true);
  const ear = rig.hero.bones.get('head')!.localToWorld(new THREE.Vector3(.23, -.08, .13));
  const target = base.lerp(ear, pickup * (1 - returning));
  hand(rig, 'R', target, .8);
  const wrist = rig.hero.bones.get('wrist_R')!, receiver = rig.handset.root;
  receiver.position.copy(wrist.worldToLocal(wrist.localToWorld(new THREE.Vector3(0, -.19, .035))));
  const scale = wrist.getWorldScale(new THREE.Vector3()); receiver.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  const orientation = new THREE.Quaternion(); receiver.quaternion.copy(wrist.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  receiver.visible = gesture.phase === 'pickup' ? gesture.elapsed >= .8 : gesture.phase === 'line_dead' || gesture.phase === 'calling' && gesture.elapsed < 6.6;
}
