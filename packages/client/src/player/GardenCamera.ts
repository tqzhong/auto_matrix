import * as THREE from 'three';
import { gardenPose, gardenSunrise, gardenGroundHeight, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';

/** Frame the current speakers and their approach, leaving room above the subtitles. */
export function gardenCamera(encounter: TrilogyEpilogueEncounter, aspect: number, look: { yaw: number; pitch: number }) {
  const arrival = ['promise', 'sati', 'sunrise', 'belief', 'done'].includes(encounter.phase);
  const roles = arrival ? ['oracle', 'sati', 'seraph'] as const
    : ['architect', 'choice', 'leaving'].includes(encounter.phase) ? ['oracle', 'architect'] as const : ['oracle'] as const;
  const bounds = new THREE.Box3();
  for (const role of roles) {
    const pose = gardenPose(encounter, role), width = role === 'oracle' ? 3.9 : 1.2;
    const height = role === 'sati' ? 3.3 : role === 'oracle' ? 4.7 - pose.seated * 1.1 : 4.9;
    const floor = gardenGroundHeight(pose.x, pose.z);
    bounds.expandByPoint(new THREE.Vector3(pose.x - width, floor, pose.z - 1.2));
    bounds.expandByPoint(new THREE.Vector3(pose.x + width, floor + height, pose.z + 1.2));
  }
  const focus = bounds.getCenter(new THREE.Vector3());
  const yaw = THREE.MathUtils.lerp(2.85, .55, gardenSunrise(encounter)) + look.yaw;
  const pitch = .16 + look.pitch;
  const away = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), away).normalize();
  const up = new THREE.Vector3().crossVectors(away, right);
  const tangent = Math.tan(THREE.MathUtils.degToRad(64 / 2));
  let distance = 11;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const offset = new THREE.Vector3(x, y, z).sub(focus), depth = offset.dot(away);
    distance = Math.max(distance, depth + Math.abs(offset.dot(right)) / (tangent * aspect * .82), depth + Math.abs(offset.dot(up)) / (tangent * .56));
  }
  return { focus, ideal: focus.clone().addScaledVector(away, distance + .6) };
}
