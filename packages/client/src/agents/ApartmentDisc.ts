import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** The same small data cartridge is used in the hollow book and both actors' hands. */
export function apartmentDisc(): THREE.Group {
  const root = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x242c2b, roughness: .65 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa8b4af, metalness: .8, roughness: .25 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xbdbcb0, roughness: .95 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z); part.castShadow = part.receiveShadow = true; root.add(part);
  };
  mesh(new RoundedBoxGeometry(.25, .025, .25, 2, .012), plastic, 0, 0, 0);
  mesh(new THREE.CylinderGeometry(.082, .082, .004, 32), metal, 0, .014, .025);
  mesh(new THREE.CylinderGeometry(.014, .014, .006, 12), plastic, 0, .016, .025);
  mesh(new THREE.BoxGeometry(.19, .008, .065), paper, 0, .017, -.078);
  for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(.006 + i % 2 * .004, .001, .042), plastic, -.066 + i * .014, .022, -.078);
  mesh(new THREE.BoxGeometry(.07, .01, .055), metal, .092, .015, .08);
  return root;
}
