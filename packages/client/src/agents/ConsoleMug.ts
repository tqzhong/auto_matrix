import * as THREE from 'three';
import { CONSOLE_DRINK } from '@auto_matrix/shared';

/** The table and held copies use the same hollow steel shell and rolled rim. */
export function createConsoleMug(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name; root.userData.dynamic = true;
  const metal = new THREE.MeshStandardMaterial({ color: 0xa5b3ae, metalness: .86, roughness: .36 });
  const r = CONSOLE_DRINK.radius, h = CONSOLE_DRINK.height / 2;
  const profile = [[0, -h], [r - .015, -h], [r - .005, -h + .012], [r, -h + .035], [r, h - .017],
    [r + .002, h - .004], [r - .006, h + .002], [r - .014, h - .008], [r - .014, -h + .036], [r - .02, -h + .015], [0, -h + .015]];
  const shell = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 48), metal);
  shell.name = 'console-mug-shell'; shell.castShadow = shell.receiveShadow = true; root.add(shell);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(r - .006, .145, 0),
    new THREE.Vector3(r + .24, .21, 0), new THREE.Vector3(r + .24, -.21, 0), new THREE.Vector3(r - .006, -.145, 0)), 32, .022, 8), metal);
  handle.name = 'console-mug-handle'; handle.castShadow = handle.receiveShadow = true; root.add(handle);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(r - .019, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x5b381b, roughness: .18, metalness: .04, side: THREE.DoubleSide }));
  liquid.name = 'console-mug-liquid'; liquid.position.y = -.035; root.add(liquid);
  return root;
}
