import * as THREE from 'three';
import { WETWALL, WETWALL_SHAFT, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** A hollow pipe chase: the entry wall, open floor and standing pipes have actual depth. */
export class WetwallRenderer {
  private root = new THREE.Group();
  private panel = new THREE.Group();
  private fragments = new THREE.Group();
  private dust = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private dustMaterial = new THREE.MeshStandardMaterial({ color: 0xb8aa8d, transparent: true, opacity: .16, depthWrite: false, roughness: 1 });
  constructor(parent: THREE.Group, material: { plaster: THREE.Material; wood: THREE.Material; iron: THREE.Material; trim: THREE.Material }) {
    this.root.name = 'ambush-wetwall-shaft'; parent.add(this.root);
    const shaft = WETWALL_SHAFT, bottom = shaft.low - 1, top = shaft.top + 7.4, height = top - bottom;
    this.box(material.plaster, -17.5, bottom - .18, -32.4, 9, .36, 3.2);
    this.box(material.plaster, -17.5, (bottom + shaft.top) / 2, shaft.back, 9, shaft.top - bottom, .5);
    for (const x of [shaft.left, shaft.right]) this.box(material.plaster, x, (bottom + shaft.top) / 2, -32.4, .4, shaft.top - bottom, 3.2);
    this.box(material.plaster, -17.5, (bottom + shaft.top) / 2, shaft.front, 9, shaft.top - bottom, .24);
    for (const [x, width] of [[-20.85, 2.3], [-14.65, 3.3]]) this.box(material.plaster, x, shaft.top + 3.7, shaft.front, width, 7.4, .24);
    this.box(material.plaster, -18, shaft.top + 6.75, shaft.front, shaft.holeWidth, 1.3, .24);
    for (const x of [-19.88, -16.12]) this.box(material.wood, x, shaft.top + 3.05, shaft.front - .12, .18, 6.1, .17);
    for (let row = 0; row < 13; row++) for (const side of [-1, 1]) {
      const width = .13 + row % 3 * .045;
      this.box(material.wood, -18 + side * (1.7 + width / 2), shaft.top + .3 + row * .43, shaft.front - .16, width, .12, .16);
    }
    for (const x of [-20.5, -18, -15.5]) {
      const pipe = this.cylinder(material.iron, x, (top + bottom) / 2, shaft.pipeZ, .2, height);
      pipe.name = `wetwall-stack-${x}`;
      for (let y = bottom + .8; y < top; y += 1.8) {
        this.cylinder(material.iron, x, y, shaft.pipeZ, .255, .12);
        this.box(material.iron, x, y, shaft.back + .35, .5, .14, .22);
      }
    }
    for (const y of [shaft.top + .55, shaft.top + 3.35]) {
      const cross = this.cylinder(material.iron, -18, y, shaft.pipeZ, .09, 6.2);
      cross.rotation.z = Math.PI / 2; cross.name = 'wetwall-entry-manifold';
    }
    // Narrow supply risers beside Cypher's shoulders explain the snag without crossing his torso.
    const snagY = shaft.top - WETWALL.jam;
    for (const side of [-1, 1]) {
      const pipe = this.cylinder(material.iron, -18 + side * 1.18, snagY + 2.2, shaft.bodyZ + .12, .11, 3.4);
      pipe.name = `wetwall-supply-${side}`;
    }
    for (let level = 0; level < 5; level++) {
      const y = shaft.top - level * 7.4;
      for (const x of [-21.45, -13.55]) this.box(material.wood, x, y + 3.5, shaft.front - .25, .17, 7.4, .2);
      for (let row = 0; row < 15; row++) {
        this.box(material.wood, -21.3, y + .3 + row * .47, shaft.front - .24, .9, .11, .14);
        this.box(material.wood, -13.7, y + .3 + row * .47, shaft.front - .24, .9, .11, .14);
      }
      const light = new THREE.PointLight(level < 2 ? 0xcbb389 : 0xb0c5bc, level === 0 ? 75 : 45, 15, 2);
      light.position.set(-17.5, y + 4.8, -33.25); this.root.add(light);
    }
    const sources = [...this.geometries];
    batchStaticGeometry(this.root, new Set()).forEach(geometry => this.geometries.add(geometry));
    const used = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh) used.add(object.geometry); });
    for (const geometry of sources) if (!used.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
    this.panel.name = 'wetwall-entry-plaster'; this.root.add(this.panel, this.fragments, this.dust);
    this.box(material.plaster, -18, shaft.top + shaft.holeHeight / 2, shaft.front, shaft.holeWidth, shaft.holeHeight, .24, this.panel);
    for (let row = 0; row < 14; row++) this.box(material.wood, -18, shaft.top + .2 + row * .42, shaft.front - .16, shaft.holeWidth, .12, .12, this.panel);
    for (let i = 0; i < 24; i++) {
      const piece = this.box(i % 4 ? material.trim : material.wood, -19.4 + i % 7 * .45, shaft.top + .5 + Math.floor(i / 7) * 1.35,
        shaft.front, .22 + i % 3 * .15, .12, .2 + i % 4 * .08, this.fragments);
      piece.userData.start = piece.position.clone();
    }
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(.35 + i % 3 * .12, 10, 6)), this.dustMaterial);
      cloud.position.set(-19.1 + i % 3 * 1.05, shaft.top + 1 + Math.floor(i / 3) * 1.7, shaft.front + .35);
      cloud.userData.start = cloud.position.clone(); this.dust.add(cloud);
    }
    this.fragments.visible = this.dust.visible = false;
  }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private box(material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(width, height, depth)), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(radius, radius, height, 18)), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  update(journey?: FilmJourney): void {
    const wall = journey?.wetwall, active = Boolean(wall && ['m1_wetwall', 'm1_bathroom'].includes(journey!.scene));
    const closed = !active || wall!.phase === 'sealed' || wall!.phase === 'breaking' && wall!.elapsed < WETWALL.impact;
    this.panel.visible = closed; this.fragments.visible = active && !closed;
    const age = wall?.phase === 'breaking' ? Math.max(0, wall.elapsed - WETWALL.impact) : 2;
    for (const [i, piece] of this.fragments.children.entries()) {
      const start = piece.userData.start as THREE.Vector3;
      piece.position.set(start.x + Math.sin(i * 2.1) * Math.min(age, .8), Math.max(WETWALL_SHAFT.top + .07, start.y - 5 * age - 12 * age * age), start.z + Math.min(age, 1) * (1.1 + i % 4 * .36));
      piece.rotation.set(i * .17 + age * .8, i * .6 + age, age * 1.3);
    }
    this.dust.visible = active && !closed && age < 1.15; this.dustMaterial.opacity = Math.max(0, .16 * (1 - age / 1.15));
    for (const cloud of this.dust.children) {
      cloud.position.copy(cloud.userData.start as THREE.Vector3); cloud.position.y -= age * .5; cloud.position.z += age * .3;
      cloud.scale.setScalar(1 + age * 1.1);
    }
  }
  dispose(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.dustMaterial.dispose();
    this.root.traverse(object => { if (object instanceof THREE.PointLight) object.dispose(); }); this.root.removeFromParent();
  }
}
