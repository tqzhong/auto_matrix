import * as THREE from 'three';
import { DOCK_EVACUATION } from '@auto_matrix/shared';

export class DockCargoModel {
  readonly root = new THREE.Group();
  readonly handles: THREE.Mesh[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private steel = new THREE.MeshStandardMaterial({ color: 0x535440, roughness: .85, metalness: .35 });
  private dark = new THREE.MeshStandardMaterial({ color: 0x252820, roughness: .6, metalness: .6 });
  constructor() {
    this.root.name = 'dock-cargo';
    const { width: w, height: h, depth: d } = DOCK_EVACUATION.crate;
    this.box(w, h, d, 0, 0, 0, this.steel);
    for (const x of [-w / 2 + .18, w / 2 - .18]) this.box(.12, h + .03, d + .035, x, 0, 0, this.dark);
    for (const y of [-h / 2 + .13, h / 2 - .13]) this.box(w + .02, .08, d + .03, 0, y, 0, this.dark);
    for (const side of [-1, 1]) {
      const x = side * (w / 2 + .07);
      this.box(.15, .24, .58, x - side * .07, .08, 0, this.dark);
      const handle = this.box(.085, .08, .5, x + side * .09, .08, 0, this.steel);
      handle.name = side < 0 ? 'cargo-grip-R' : 'cargo-grip-L'; this.handles.push(handle);
    }
    for (let i = 0; i < 4; i++) this.box(.25, .03, .025, -.48 + i * .3, .22, d / 2 + .018, this.dark);
  }
  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(w, h, d); this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  dispose(): void { this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.steel.dispose(); this.dark.dispose(); }
}
