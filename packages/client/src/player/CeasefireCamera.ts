import * as THREE from 'three';
import { ceasefireSentinelPose, trilogyEpilogueProgress, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';

/** The exterior shot follows the saved swarm rather than staring down at the empty rostrum. */
export function ceasefireCamera(encounter: TrilogyEpilogueEncounter, aspect: number) {
  if (encounter.phase === 'announcement' || encounter.phase === 'embrace') {
    return { focus: new THREE.Vector3(0, 2.8, 22), ideal: new THREE.Vector3(6.5, 7.2, 14 - Math.max(20, 21 / aspect)) };
  }
  const focus = new THREE.Vector3();
  for (let i = 0; i < 18; i++) {
    const pose = ceasefireSentinelPose(encounter, i); focus.add(new THREE.Vector3(pose.x, pose.y, pose.z));
  }
  focus.divideScalar(18);
  if (trilogyEpilogueProgress(encounter) >= .34) {
    // After convergence, look through the actual bore beneath the retracted drill.
    return { focus, ideal: new THREE.Vector3(-.8, focus.y + Math.max(44, 29 / aspect), -105) };
  }
  // Observe across the city at the swarm's height. Looking back through the
  // drilling axis puts the city roof and the stopped drill in front of it.
  return { focus, ideal: new THREE.Vector3(Math.max(38, 35 / aspect), focus.y, focus.z - 28) };
}
