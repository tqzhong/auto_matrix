import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

/** Physical interface scars and hardware stay with Neo's real body after recovery. */
export class RecoveryPerformance {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private glow: THREE.MeshStandardMaterial;

  constructor(private rig: HeroRig) {
    this.root.name = 'neo-recovery-interfaces';
    this.rig.bones.get('chest')!.add(this.root);
    const metal = this.material(new THREE.MeshStandardMaterial({ color: 0x303b38, metalness: .88, roughness: .25 }));
    const inset = this.material(new THREE.MeshStandardMaterial({ color: 0x101615, metalness: .52, roughness: .55 }));
    this.glow = this.material(new THREE.MeshStandardMaterial({ color: 0x6e9983, emissive: 0x3d8a65, emissiveIntensity: .2, metalness: .65, roughness: .24 }));
    for (const [x, y, radius] of [[-.31, .28, .1], [.31, .28, .1], [-.25, -.22, .08], [.25, -.22, .08]] as const) {
      const collar = this.mesh(new THREE.CylinderGeometry(radius, radius, .035, 20), metal); collar.position.set(x, y, .39); collar.rotation.x = Math.PI / 2;
      const socket = this.mesh(new THREE.CylinderGeometry(radius * .55, radius * .55, .045, 16), inset); socket.position.set(x, y, .415); socket.rotation.x = Math.PI / 2;
    }
    const neck = new THREE.Group(); neck.name = 'cervical-interface'; neck.position.set(0, .72, -.23); neck.rotation.x = Math.PI / 2; this.root.add(neck);
    this.mesh(new THREE.TorusGeometry(.16, .035, 8, 28), metal, neck);
    this.mesh(new THREE.CylinderGeometry(.105, .105, .05, 20), inset, neck).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const contact = this.mesh(new THREE.SphereGeometry(.022, 8, 6), this.glow, neck);
      const angle = i / 6 * Math.PI * 2; contact.position.set(Math.sin(angle) * .12, Math.cos(angle) * .12, .04);
    }
    const cable = this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .68, -.22), new THREE.Vector3(.34, .55, -.31), new THREE.Vector3(.45, .16, -.36), new THREE.Vector3(.31, -.23, -.22),
    ]), 20, .018, 7), inset); cable.name = 'cervical-interface-cable';
    this.root.visible = false;
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); this.geometries.add(geometry); return mesh;
  }

  update(elapsed: number | undefined, realWorld = false): void {
    this.root.visible = realWorld || elapsed !== undefined;
    this.glow.emissiveIntensity = elapsed === undefined ? .08 : .18 + Math.sin(elapsed * 5) * .1;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.geometries.clear(); this.materials.clear();
  }
}
