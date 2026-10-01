import * as THREE from 'three';
import { FILM_SETS, TV_EXIT, basementHatchPoint, type BasementGesture, type TvExitGesture } from '@auto_matrix/shared';
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

export function poseHardline(rig: CharacterRig, gesture?: TvExitGesture): void {
  if (rig.handset) rig.handset.root.visible = false;
  if (!rig.hero || !rig.handset || !gesture || gesture.role !== 'neo' || gesture.phase === 'ready' || gesture.phase === 'done') return;
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
