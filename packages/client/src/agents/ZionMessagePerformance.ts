import * as THREE from 'three';
import { FILM_SETS, zionMessagePalm, type ZionMessageGesture } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';

export function poseZionMessage(rig: CharacterRig, gesture?: ZionMessageGesture): void {
  if (!rig.hero || !gesture) return;
  const point = zionMessagePalm(gesture); if (point.weight <= 0) return;
  const bones = rig.hero.bones, center = FILM_SETS.film_zion_bedroom.center;
  bones.get('spine')!.rotation.x += .1 * point.weight; bones.get('head')!.rotation.x += .08 * point.weight;
  rig.root.updateWorldMatrix(true, true);
  const wrist = bones.get('wrist_R')!, from = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
  const target = new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z);
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  crosscutPalm(rig, 'R', from.lerp(target, point.weight), orientation);
  const curl = gesture.role === 'trinity' ? 1 : gesture.role === 'ballard' ? .3 : .55;
  for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) bones.get(`finger${finger}-${segment}_R`)!.rotation.z *= curl;
  rig.root.updateWorldMatrix(true, true);
}
