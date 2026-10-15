import * as THREE from 'three';
import { STEAK_DINING } from '@auto_matrix/shared';

export const STEAK_FORK_TIP = new THREE.Vector3(0, .60, .055);
export const STEAK_WINE_GRIP = new THREE.Vector3(0, .19, 0);

/** Matching portions share the real cutting plane; no whole steak stays below the bite. */
export function createSteakPortion(part: 'main' | 'slice', name: string): THREE.Mesh {
  const spec = STEAK_DINING.steak, angle = Math.acos((spec.cutX - spec.x) / spec.radiusX);
  const start = part === 'main' ? -angle : angle, end = part === 'main' ? angle : 2 * Math.PI - angle;
  const shape = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const t = THREE.MathUtils.lerp(start, end, i / 32), x = spec.x + spec.radiusX * Math.cos(t), z = spec.radiusZ * Math.sin(t);
    if (i) shape.lineTo(x, z); else shape.moveTo(x, z);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: spec.height, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, -spec.height / 2, 0);
  const { position, normal } = geometry.attributes, colors: number[] = [];
  const crust = new THREE.Color(0x673b25), edge = new THREE.Color(0x4b281d), cut = new THREE.Color(0xb77363);
  for (let i = 0; i < position.count; i++) {
    const exposed = Math.abs(position.getX(i) - spec.cutX) < .00001 && Math.abs(normal.getX(i)) > .99;
    const color = (exposed ? cut : Math.abs(normal.getY(i)) > .9 ? crust : edge).clone();
    color.multiplyScalar(.93 + .07 * Math.cos(position.getX(i) * 65) * Math.cos(position.getZ(i) * 44)); colors.push(...color.toArray());
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (part === 'slice') geometry.translate(-STEAK_DINING.bite.x, 0, STEAK_DINING.plate.z - STEAK_DINING.bite.z);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .83 }));
  mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; return mesh;
}

export function createSteakCutlery(kind: 'fork' | 'knife', name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name;
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bfbc, metalness: .92, roughness: .17 });
  const mesh = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, label?: string) => {
    const part = new THREE.Mesh(geometry, steel); part.position.set(x, y, z); part.castShadow = part.receiveShadow = true; if (label) part.name = label; root.add(part); return part;
  };
  mesh(new THREE.CylinderGeometry(.024, .028, .34, 10), 0, 0, 0, 'steak-cutlery-handle');
  if (kind === 'fork') {
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .15, 0), new THREE.Vector3(0, .3, .01), new THREE.Vector3(0, .43, .055)]);
    mesh(new THREE.TubeGeometry(neck, 8, .014, 6, false), 0, 0, 0);
    mesh(new THREE.BoxGeometry(.075, .09, .018), 0, .43, .055);
    for (const x of [-.03, -.01, .01, .03]) mesh(new THREE.CylinderGeometry(.003, .005, .14, 6), x, .535, .055);
    const bite = createSteakPortion('slice', 'cypher-held-bite'); bite.position.copy(STEAK_FORK_TIP);
    bite.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), STEAK_DINING.gripTilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)).invert(); root.add(bite);
  } else {
    const shape = new THREE.Shape(); shape.moveTo(-.024, .17); shape.lineTo(.035, .17); shape.lineTo(.065, .57); shape.quadraticCurveTo(.06, .68, -.024, .69); shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 1, steps: 1 }), 0, 0, -.006, 'steak-knife-blade');
  }
  return root;
}

export function createSteakWine(name: string): THREE.Group {
  const root = new THREE.Group(); root.name = name;
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xe7f0eb, roughness: .06, transmission: .7, transparent: true, opacity: .4, thickness: .012, side: THREE.DoubleSide, depthWrite: false });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, label: string) => {
    const part = new THREE.Mesh(geometry, material); part.name = label; part.position.y = y; part.castShadow = false; part.receiveShadow = true; root.add(part); return part;
  };
  mesh(new THREE.CylinderGeometry(.15, .16, .018, 24), crystal, .009, 'steak-wine-base');
  mesh(new THREE.CylinderGeometry(.014, .014, .31, 12), crystal, .172, 'steak-wine-stem');
  const points = [[.014, .32], [.10, .35], [.17, .43], [.19, .52], [.18, .65]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(points, 28), crystal, 0, 'steak-wine-bowl');
  const wine = new THREE.MeshPhysicalMaterial({ color: 0x561019, roughness: .15, transparent: true, opacity: .93, transmission: .08 });
  mesh(new THREE.CylinderGeometry(.15, .065, .12, 24), wine, .41, 'steak-wine-liquid');
  const contact = new THREE.Object3D(); contact.name = 'steak-wine-rim-contact'; contact.position.set(0, .65, -.18); root.add(contact);
  return root;
}
