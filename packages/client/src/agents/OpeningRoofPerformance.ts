import * as THREE from 'three';
import { FILM_SETS, OPENING_HOTEL, OPENING_ROOF_EXIT, openingRoofStairHeight, openingRoofStairPose, type OpeningRoofExit } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';
import { heroSolePoints } from './HotelFootPlacement.js';

const { lerp, smoothstep } = THREE.MathUtils;
const { land, rollEnd, rise, walk } = OPENING_ROOF_EXIT;
const takeoff = land - OPENING_HOTEL.diveSeconds;
const contactPoints = [['head', .32], ['spine', .28], ['chest', .32], ['elbow_L', .16], ['elbow_R', .16],
  ['wrist_L', .13], ['wrist_R', .13], ['knee_L', .17], ['knee_R', .17], ['ankle_L', .22], ['ankle_R', .22]] as const;

export function poseOpeningRoofExit(rig: HeroRig, exit?: OpeningRoofExit): void {
  if (!exit?.stairwell || exit.elapsed < takeoff) return;
  const { elapsed } = exit, { bones } = rig;
  const pelvis = bones.get('pelvis')!, spine = bones.get('spine')!, chest = bones.get('chest')!, head = bones.get('head')!;
  if (elapsed >= walk) {
    const { z, vz } = openingRoofStairPose(elapsed), moving = smoothstep(-vz, 0, 2.8);
    chest.rotation.z += .14 * Math.sin((OPENING_ROOF_EXIT.restZ - z) * 2.8) * moving;
    chest.rotation.x += .24;
    bones.get('shoulder_R')!.rotation.x = -.35;
    bones.get('elbow_R')!.rotation.x = -1.05;
    return;
  }

  const flying = elapsed < land, roll = smoothstep(elapsed, land, rollEnd);
  const riseWeight = smoothstep(elapsed, rise, walk), tuck = Math.sin(roll * Math.PI);
  const weight = flying ? smoothstep(elapsed, takeoff, takeoff + .42) : 1 - riseWeight;
  const pitch = flying ? 1.15 : elapsed < rollEnd ? lerp(1.15, Math.PI * 2 + .65, roll) : .65;
  pelvis.position.y = lerp(pelvis.position.y, flying ? lerp(2.06, 1.26, smoothstep(elapsed, 2.28, land)) : 1.26 - .31 * tuck, weight);
  pelvis.rotation.x = lerp(pelvis.rotation.x, pitch, weight);
  pelvis.rotation.z = lerp(pelvis.rotation.z, -.32 * tuck, weight);
  spine.rotation.x = lerp(spine.rotation.x, .19 + .17 * tuck, weight);
  chest.rotation.x = lerp(chest.rotation.x, .13 + .12 * tuck, weight);
  head.rotation.x = lerp(head.rotation.x, elapsed >= rollEnd ? -.57 : .19 + .34 * tuck, weight);
  for (const side of ['L', 'R'] as const) {
    const left = side === 'L', guarding = elapsed < rollEnd;
    const shoulder = bones.get(`shoulder_${side}`)!, elbow = bones.get(`elbow_${side}`)!;
    shoulder.rotation.x = lerp(shoulder.rotation.x, guarding ? -1.88 : left ? -.92 : -.45, weight);
    shoulder.rotation.z = lerp(shoulder.rotation.z, (left ? -1 : 1) * (guarding ? .22 : .33), weight);
    elbow.rotation.x = lerp(elbow.rotation.x, guarding ? -1.47 : left ? -.43 : -1.1, weight);
    const hip = bones.get(`hip_${side}`)!, knee = bones.get(`knee_${side}`)!, ankle = bones.get(`ankle_${side}`)!;
    hip.rotation.x = lerp(hip.rotation.x, (left ? -.84 : -.56) - .64 * tuck, weight);
    knee.rotation.x = lerp(knee.rotation.x, (left ? 1.73 : 1.42) + .51 * tuck, weight);
    ankle.rotation.x = lerp(ankle.rotation.x, -.49, weight);
  }
  if (flying) return;

  // Keep the tucked joints clear of the sloped run of the treads as the body turns.
  rig.root.updateWorldMatrix(true, true);
  const { center } = FILM_SETS.film_hotel_roofs, point = new THREE.Vector3();
  let lift = -Infinity;
  for (const [name, radius] of contactPoints) {
    point.setFromMatrixPosition(bones.get(name)!.matrixWorld);
    const floor = openingRoofStairHeight(point.x - center.x, point.z - center.z, true);
    if (floor !== undefined) lift = Math.max(lift, center.y - 1 + floor + radius - point.y);
  }
  const soles = heroSolePoints(rig);
  for (const [index, side] of ['R', 'L'].entries()) {
    const ankle = bones.get(`ankle_${side}`)!;
    for (const vertex of soles[index]) {
      point.copy(vertex).applyMatrix4(ankle.matrixWorld);
      const floor = openingRoofStairHeight(point.x - center.x, point.z - center.z, true);
      if (floor !== undefined) lift = Math.max(lift, center.y - 1 + floor + .01 - point.y);
    }
  }
  if (Number.isFinite(lift)) pelvis.position.y += Math.max(-.3 * weight, lift);
}
