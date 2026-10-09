import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared mechanical hull and six bent limbs for flying and face-forming units. */
export function machineBugGeometry(): { hull: THREE.BufferGeometry; limbs: THREE.BufferGeometry } {
  const shells = [new THREE.IcosahedronGeometry(1, 0).scale(.44, .68, .25).translate(0, -.16, 0),
    new THREE.IcosahedronGeometry(1, 0).scale(.32, .29, .24).translate(0, .55, .03)];
  const parts: THREE.BufferGeometry[] = [];
  const rod = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    const delta = b.clone().sub(a);
    parts.push(new THREE.CylinderGeometry(radius, radius * 1.25, delta.length(), 3, 1, true)
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()))
      .translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2).toNonIndexed());
  };
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg++) {
      const y = .35 - leg * .42;
      const joint = new THREE.Vector3(side * .65, y + .15, -.035);
      rod(new THREE.Vector3(side * .28, y, 0), joint, .045);
      rod(joint, new THREE.Vector3(side * (1 - leg * .08), y - .38, -.07), .025);
    }
    rod(new THREE.Vector3(side * .12, .69, .12), new THREE.Vector3(side * .23, .9, .22), .035);
  }
  for (const y of [-.45, -.15, .15]) rod(new THREE.Vector3(-.27, y, .2), new THREE.Vector3(.27, y, .2), .026);
  const hull = mergeGeometries(shells)!, limbs = mergeGeometries(parts)!;
  [...shells, ...parts].forEach(geometry => geometry.dispose());
  return { hull, limbs };
}
