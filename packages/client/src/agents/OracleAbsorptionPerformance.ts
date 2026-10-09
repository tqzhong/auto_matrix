import * as THREE from 'three';
import { FILM_SETS, absorptionSmooth, oracleAbsorptionCookie, oracleAbsorptionPlate, newOracleLast, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { poseOracleLast } from './OracleLastPerformance.js';
import { reach } from './SpoonPerformance.js';

function hand(rig: CharacterRig, index: number, wrist: THREE.Object3D, point: THREE.Vector3, rotation: THREE.Quaternion): void {
  const scale = wrist.getWorldScale(new THREE.Vector3()), offset = new THREE.Vector3(0, -.75 - wrist.position.y, .005);
  reach(rig.shoulders[index], rig.elbows[index], wrist.position, point.clone().sub(offset.multiply(scale).applyQuaternion(rotation)),
    new THREE.Vector3(index ? .7 : -.7, -.4, -.2).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())));
  wrist.quaternion.copy(rig.elbows[index].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  wrist.updateWorldMatrix(false, true);
}

export function poseOracleAbsorption(rig: CharacterRig, gesture?: OracleAbsorptionGesture): void {
  if (!gesture) return;
  const center = FILM_SETS.film_oracle_home.center, origin = new THREE.Vector3(center.x, center.y - 1, center.z);
  if (gesture.role === 'oracle') {
    poseOracleLast(rig, { ...newOracleLast(1, gesture.checkpointHealth), role: 'oracle', step: 2,
      phase: 'ready', arrival: 17.6 + 2.4 * absorptionSmooth(gesture.escape, 27, 31), elapsed: gesture.elapsed });
    if (gesture.farewell < 5) {
      const wrist = rig.root.getObjectByName('oracle-hand-R')!, target = new THREE.Vector3(-3.5, 2.08, -23.15).add(origin);
      const weight = absorptionSmooth(gesture.farewell, 0, 2) * (1 - absorptionSmooth(gesture.farewell, 3, 5));
      const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      hand(rig, 0, wrist, wrist.localToWorld(new THREE.Vector3(0, -.075, .005)).lerp(target, weight), rotation);
    }
    if (gesture.phase === 'coating') { rig.torso.rotation.x -= gesture.coating * .16; rig.head.rotation.x -= gesture.coating * .18; }
  } else if (gesture.role === 'sati' && gesture.farewell >= 2) {
    rig.root.updateWorldMatrix(true, true);
    const wrist = rig.root.getObjectByName('sati-hand--1')!, cookie = oracleAbsorptionCookie(gesture), weight = absorptionSmooth(gesture.farewell, 2, 3);
    const rotation = rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    hand(rig, 0, wrist, wrist.localToWorld(new THREE.Vector3(0, -.07, .005)).lerp(new THREE.Vector3(cookie.x, cookie.y, cookie.z).add(origin), weight), rotation);
    rig.fingers[0].forEach(finger => { finger.rotation.x = -.26; });
  } else if (gesture.role === 'smith' && rig.hero) {
    const hero = rig.hero, bend = gesture.invasion >= 20.7 && gesture.invasion < 22.4
      ? .85 * absorptionSmooth(gesture.invasion, 20.7, 21.1) * (1 - absorptionSmooth(gesture.invasion, 21.4, 22.4))
      : gesture.phase === 'contact' ? .45 * absorptionSmooth(gesture.elapsed, 0, .8)
        : gesture.phase === 'coating' ? .45 * (1 - absorptionSmooth(gesture.coating, .7, 1)) : 0;
    if (bend) {
      hero.root.updateWorldMatrix(true, true);
      const feet = ['R', 'L'].map(side => hero.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()));
      hero.bones.get('pelvis')!.position.y -= bend; hero.bones.get('chest')!.rotation.x += bend * .3;
      hero.root.updateWorldMatrix(true, true); const orientation = hero.root.getWorldQuaternion(new THREE.Quaternion());
      for (const [i, side] of ['R', 'L'].entries()) {
        const hip = hero.bones.get(`hip_${side}`)!, knee = hero.bones.get(`knee_${side}`)!, ankle = hero.bones.get(`ankle_${side}`)!;
        reach(hip, knee, ankle.position, feet[i], new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      }
    }
    if (gesture.invasion < 20.7 || gesture.invasion >= 22.4) { rig.root.updateWorldMatrix(true, true); return; }
    const weight = absorptionSmooth(gesture.invasion, 20.7, 21.2) * (1 - absorptionSmooth(gesture.invasion, 21.4, 22.4));
    const wrist = hero.bones.get('wrist_R')!, elbow = hero.bones.get('elbow_R')!, shoulder = hero.bones.get('shoulder_R')!;
    hero.root.updateWorldMatrix(true, true);
    const rotation = hero.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    const offset = new THREE.Vector3(0, -.28, -.125);
    const plate = oracleAbsorptionPlate(gesture);
    const target = wrist.localToWorld(offset.clone()).lerp(new THREE.Vector3(plate.x, 2.18, -20.15).add(origin), weight);
    reach(shoulder, elbow, wrist.position, target.sub(offset.applyQuaternion(rotation)), new THREE.Vector3(.4, -.4, -.2));
    wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      hero.bones.get(`finger${finger}-${segment}_R`)!.rotation.z = finger === 1 ? .25 : 0;
  }
  rig.root.updateWorldMatrix(true, true);
}

/** Contact is solved after both delivered bodies have been posed. */
export function contactOracleAbsorption(oracle: CharacterRig, smith: CharacterRig, gesture: OracleAbsorptionGesture): void {
  if (!smith.hero || !['contact', 'coating', 'laughing'].includes(gesture.phase)) return;
  oracle.root.updateWorldMatrix(true, true); smith.root.updateWorldMatrix(true, true);
  const blouse = oracle.root.getObjectByName('oracle-daily-blouse') as THREE.Mesh;
  const center = new THREE.Box3().setFromObject(blouse).getCenter(new THREE.Vector3());
  const chestFront = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1)).intersectObject(blouse, true)[0]?.point;
  if (!chestFront) return;
  chestFront.z += .055;
  const hero = smith.hero, upper = hero.bones.get('shoulder_R')!, lower = hero.bones.get('elbow_R')!, wrist = hero.bones.get('wrist_R')!;
  const weight = gesture.phase === 'contact' ? absorptionSmooth(gesture.elapsed, 0, 1.6)
    : gesture.phase === 'coating' ? 1 - absorptionSmooth(gesture.coating, .7, 1) : 0;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), palm = new THREE.Vector3(0, -.25, .085);
  const point = wrist.localToWorld(palm.clone()).lerp(chestFront, weight);
  reach(upper, lower, wrist.position, point.sub(palm.applyQuaternion(rotation)), new THREE.Vector3(0, -.5, -.3));
  wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  wrist.updateWorldMatrix(false, true);
}
