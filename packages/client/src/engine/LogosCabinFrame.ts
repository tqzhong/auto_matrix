import * as THREE from 'three';
import { LOGOS_COCKPIT } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The same window bays and bulkhead survive from the flying cabin into its wreck. */
export class LogosCabinFrame {
  readonly group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();

  constructor(root: THREE.Group, damaged = false) {
    root.add(this.group); this.group.name = 'logos-cabin-frame';
    const hull = new THREE.MeshStandardMaterial({ color: 0x293438, metalness: .88, roughness: .34, side: THREE.DoubleSide });
    const edge = new THREE.MeshStandardMaterial({ color: 0x6c7778, metalness: .78, roughness: .3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10191d, metalness: .65, roughness: .42 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x828b90, metalness: .62, roughness: .45 });
    [hull, edge, dark, trim].forEach(material => this.materials.add(material));
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name = '') => {
      this.geometries.add(geometry); const part = new THREE.Mesh(geometry, material); part.name = name;
      part.castShadow = true; part.receiveShadow = true; this.group.add(part); return part;
    };
    const box = (size: number[], point: number[], material: THREE.Material, name = '') => {
      const part = mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, name);
      part.position.set(point[0], point[1], point[2]); return part;
    };
    const { floor, frame } = LOGOS_COCKPIT;
    if (!damaged) {
      box([6.8, .18, 10.8], [0, floor - .09, -4.55], dark, 'logos-cabin-floor');
      box([6.8, .14, 9.7], [0, 3.25, -3.95], hull, 'logos-cabin-roof');
      box([6.8, 4.35, .16], [0, 1.075, frame.rear], hull);
      box([1.65, 3.25, .12], [0, .56, .69], dark);
    } else {
      // The roof is physically peeled away. Keep its folded metal outside the
      // open centre, rather than hiding an intact roof when the camera moves.
      for (const side of [-1, 1]) {
        const roof = box([1.25, .14, 9.7], [side * 3.05, 3.38, -3.95], hull, `logos-torn-roof-${side}`);
        roof.rotation.z = side * .36;
        box([1.85, 4.35, .16], [side * 2.475, 1.075, frame.rear], hull);
      }
      const lintel = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.55, 3.13, frame.rear),
        new THREE.Vector3(0, 4.1, frame.rear - .3), new THREE.Vector3(1.55, 3.13, frame.rear)]);
      mesh(new THREE.TubeGeometry(lintel, 16, .1, 8, false), trim);
      const hatch = box([1.65, 3.25, .12], [2.2, -.85, 1.65], dark); hatch.rotation.set(1.4, 0, .15);
    }
    for (const side of [-1, 1]) {
      box([.18, 1.1, frame.length], [side * frame.halfWidth, floor + .55, -4.6], hull);
      for (const z of [-9.7, -5.8, -2.4, .7]) {
        const pillar = box([.13, 3.22, .15], [side * 3.28, 1.58, z], trim);
        pillar.rotation.z = -side * .045;
      }
      for (const y of [.04, 3.15]) box([.18, .13, 10.55], [side * 3.28, y, -4.55], trim);
      for (let i = 0; i < 3; i++) {
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(side * (3.04 - i * .12), 3.04, -9.4),
          new THREE.Vector3(side * (3.07 - i * .12), 2.9, -4), new THREE.Vector3(side * 3.12, 1.9 - i * .2, .55)]);
        mesh(new THREE.TubeGeometry(path, 20, .035, 6, false), dark);
      }
    }
    const windscreen = new THREE.Group(); windscreen.name = 'logos-cabin-windscreen'; this.group.add(windscreen);
    for (const [y, height] of [[.16, .35], [3.19, .13]]) {
      const beam = box([6.6, height, y > 3 ? .18 : .25], [0, y, frame.front], y > 3 ? trim : edge); windscreen.attach(beam);
    }
    batchStaticGeometry(this.group, new Set()).forEach(geometry => this.geometries.add(geometry));
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
