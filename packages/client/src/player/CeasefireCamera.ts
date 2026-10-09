import * as THREE from 'three';
import { ceasefireSentinelPose, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';

/** The exterior shot follows the saved swarm rather than staring down at the empty rostrum. */
export function ceasefireCamera(encounter: TrilogyEpilogueEncounter, aspect: number) {
  if (encounter.phase === 'announcement' || encounter.phase === 'embrace') {
    return { focus: new THREE.Vector3(0, 2.8, 22), ideal: new THREE.Vector3(6.5, 7.2, 14 - Math.max(20, 21 / aspect)) };
  }
  const focus = new THREE.Vector3(); let back = 0;
  for (let i = 0; i < 18; i++) {
    const pose = ceasefireSentinelPose(encounter, i); focus.add(new THREE.Vector3(pose.x, pose.y, pose.z));
    back = Math.min(back, pose.z);
  }
  focus.divideScalar(18);
  return { focus, ideal: new THREE.Vector3(6, 22, back - Math.max(34, 43 / aspect)) };
}
