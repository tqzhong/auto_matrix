import * as THREE from 'three';
import { APARTMENT, FILM_SETS, wakeCallHandsetHeld, type WakeCall } from '@auto_matrix/shared';
import type { HeroRig } from './HeroModel.js';

/** The apartment landline handset stays in Neo's actual hand while the set keeps the base and cord. */
export class WakeCallPerformance {
  private root = new THREE.Group();
  private grip = new THREE.Vector3(.08, -.2, .02);
  private wrist: THREE.Bone;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  constructor(rig: HeroRig) {
    this.root.name = 'neo-landline-handset';
    this.root.position.copy(this.grip); this.root.rotation.set(0, Math.PI / 2, Math.PI);
    this.wrist = rig.bones.get('wrist_R')!; this.wrist.add(this.root);
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x101515, roughness: .58, metalness: .18 }));
    this.mesh(new THREE.BoxGeometry(.17, .53, .13), dark, 0, 0, 0);
    this.mesh(new THREE.BoxGeometry(.28, .22, .22), dark, 0, .3, 0);
    this.mesh(new THREE.BoxGeometry(.28, .22, .22), dark, 0, -.3, 0);
    for (const y of [-.3, .3]) for (let x = -.07; x <= .07; x += .07) this.mesh(new THREE.CylinderGeometry(.012, .012, .012, 8), dark, x, y, -.12).rotation.x = Math.PI / 2;
    this.root.visible = false;
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; this.root.add(mesh); return mesh;
  }
  update(call?: WakeCall): void {
    this.root.visible = wakeCallHandsetHeld(call); this.root.position.copy(this.grip);
    if (call?.phase !== 'pickup') return;
    const center = FILM_SETS.film_anderson_flat.center;
    const cradle = this.wrist.worldToLocal(new THREE.Vector3(center.x + APARTMENT.phone.x, center.y - 1 + APARTMENT.phone.y + .48, center.z + APARTMENT.phone.z + .22));
    const t = THREE.MathUtils.smoothstep(call.elapsed, .65, 1.2);
    this.root.position.copy(cradle).lerp(this.grip, t);
  }
  dispose(): void { this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
