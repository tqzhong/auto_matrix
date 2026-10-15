import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONSOLE_SERVICE } from '@auto_matrix/shared';

export function createConsoleJug(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name; root.userData.dynamic = true;
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0xb7c1b7, roughness: .54, metalness: 0, transparent: true, opacity: .88 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(.63, .82, .48, 4, .085), plastic);
  body.name = 'console-jug-body'; body.position.y = .41; body.castShadow = body.receiveShadow = true; root.add(body);
  const r = CONSOLE_SERVICE.neck.radius;
  const profile = [[r, .79], [r, 1.03], [r - .015, 1.03], [r - .015, .8]].map(([r, y]) => new THREE.Vector2(r, y));
  const neck = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), plastic); neck.position.x = CONSOLE_SERVICE.neck.x;
  neck.name = 'console-jug-neck'; root.add(neck);
  const points = [[.27, .74], [.48, .77], [.57, .68], [.57, .44], [.57, .2], [.48, .13], [.27, .18]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, .035, 10), plastic);
  handle.name = 'console-jug-handle'; handle.castShadow = true; root.add(handle);
  const spout = new THREE.Object3D(); spout.name = 'console-jug-spout'; spout.position.set(CONSOLE_SERVICE.spout.x, CONSOLE_SERVICE.spout.y, 0); root.add(spout);
  return root;
}

export function disposeConsoleProp(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse(object => { if (object instanceof THREE.Mesh) { if (object instanceof THREE.InstancedMesh) object.dispose(); object.geometry.dispose(); materials.add(object.material as THREE.Material); } });
  materials.forEach(material => material.dispose()); root.removeFromParent();
}
