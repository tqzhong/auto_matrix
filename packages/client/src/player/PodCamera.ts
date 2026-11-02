import * as THREE from 'three';
import { FILM_SETS, POD_RUNOFF, POD_RESCUE, podRunoffHeight, podRescuePose, type Vector3 } from '@auto_matrix/shared';

/** The saved pod shot can also be sampled without moving its posed actor. */
export function podThirdPersonCamera(group: THREE.Object3D, position: Vector3, performance: 'pod' | 'fall' | 'float' | 'lift', rescueElapsed = 0) {
  const center = FILM_SETS.film_power_plant_pods.center;
  if (performance === 'pod' || performance === 'fall') {
    const falling = performance === 'fall', head = group.getObjectByName('head'), pelvis = group.getObjectByName('pelvis');
    group.updateWorldMatrix(true, true);
    const focus = falling ? head && pelvis ? head.getWorldPosition(new THREE.Vector3()).lerp(pelvis.getWorldPosition(new THREE.Vector3()), .5)
      : new THREE.Vector3(position.x, position.y + 1.7, position.z) : new THREE.Vector3(center.x, center.y + 3.45, center.z - 12.5);
    const z = focus.z - center.z + 4;
    // Both the subject and camera pass through the real solid drain and outlet.
    const ideal = falling ? new THREE.Vector3(center.x + .65, center.y - 1 + podRunoffHeight(0, Math.min(POD_RUNOFF.endZ, z))! + POD_RUNOFF.halfWidth, center.z + z)
      : new THREE.Vector3(center.x + 5.8, center.y + 8.2, center.z - 6.5);
    return { focus, ideal, interior: false };
  }
  const interior = rescueElapsed >= POD_RESCUE.hoisted + .65;
  const approach = THREE.MathUtils.smoothstep(rescueElapsed, 3.5, 4.4);
  const ideal = interior ? new THREE.Vector3(center.x + 5.2, center.y + 4.4, center.z + 18)
    : new THREE.Vector3(position.x + 6.5 - approach * 4.5, Math.min(center.y - 2.1, position.y + 4.8), position.z + 4.5 - approach * 2.5);
  return { ideal, focus: new THREE.Vector3(position.x, position.y + 2.5 - podRescuePose(rescueElapsed).settle, position.z), interior };
}
