import * as THREE from 'three';
import { FILM_SETS, ZION_ENGINEERING, engineeringPalm, type EngineeringEncounter } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import { crosscutPalm } from './CrosscutPerformance.js';

export function poseZionEngineering(rig: CharacterRig, state?: EngineeringEncounter): void {
  if (!rig.hero || !state?.operation) return;
  const amount = THREE.MathUtils.smoothstep(state.elapsed, 0, ZION_ENGINEERING.approachSeconds), b = rig.hero.bones;
  b.get('spine')!.rotation.x += .12 * amount; b.get('head')!.rotation.x += .14 * amount;
  rig.root.updateWorldMatrix(true, true);
  const center = FILM_SETS.film_zion_engineering.center;
  const orientation = rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  if (state.operation === 'valve') orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), state.valve * ZION_ENGINEERING.valve.turn));
  for (const side of ['R', 'L'] as const) {
    const point = engineeringPalm(state, side), wrist = b.get(`wrist_${side}`)!;
    const from = wrist.localToWorld(new THREE.Vector3(0, -.19, .035));
    crosscutPalm(rig, side, from.lerp(new THREE.Vector3(center.x + point.x, center.y - 1 + point.y, center.z + point.z), amount), orientation);
    if (state.operation === 'readings') for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++)
      b.get(`finger${finger}-${segment}_${side}`)!.rotation.z *= .3;
  }
  rig.root.updateWorldMatrix(true, true);
}
