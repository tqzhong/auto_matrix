import * as THREE from 'three';
import { SIXTH_ROOM, SIXTH_WALLS, SIXTH_FIXTURES, WETWALL_SHAFT, sixthPose, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The bathroom and adjoining 608 room are physically beside the existing pipe chase. */
export class SixthFloorRenderer {
  private root = new THREE.Group();
  private rubble = new THREE.Group();
  private rifle = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: { role: 'citizen_4' | 'citizen_14'; light: THREE.SpotLight }[] = [];
  constructor(parent: THREE.Group, material: { plaster: THREE.Material; wood: THREE.Material; iron: THREE.Material; trim: THREE.Material }) {
    this.root.name = 'room-608'; parent.add(this.root);
    const y = WETWALL_SHAFT.sixth;
    const tile = this.mat(new THREE.MeshPhysicalMaterial({ color: 0x91998e, roughness: .31, metalness: .03, clearcoat: .35, clearcoatRoughness: .22 }));
    const grout = this.mat(new THREE.MeshStandardMaterial({ color: 0x454d44, roughness: .95 }));
    const porcelain = this.mat(new THREE.MeshPhysicalMaterial({ color: 0xc2c4b3, roughness: .22, metalness: 0, clearcoat: .6 }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x171e19, roughness: .42, metalness: .5 }));
    for (const wall of SIXTH_WALLS) this.box(material.plaster, wall.x, y + wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
    this.box(material.plaster, -17.5, y + SIXTH_ROOM.height, -22.8, 9, .25, 16);
    this.box(tile, -17.5, y + .018, -27.05, 8.6, .028, 7.3);
    for (let x = -21.75; x < -13.2; x += .55) this.box(grout, x, y + .034, -27.05, .015, .004, 7.3);
    for (let z = -30.5; z < -23.5; z += .55) this.box(grout, -17.5, y + .034, z, 8.6, .004, .015);
    for (const side of [-1, 1]) {
      const x = -17.5 + side * 4.28;
      this.box(tile, x, y + 1.5, -27.05, .065, 2.9, 7.3);
      for (let level = .35; level < 3; level += .5) this.box(grout, x - side * .035, y + level, -27.05, .008, .018, 7.3);
    }
    for (const x of [-19.95, -15.05]) this.box(material.wood, x, y + 3, SIXTH_ROOM.doorZ, .22, 6, .55);
    this.box(material.wood, -17.5, y + 6.1, SIXTH_ROOM.doorZ, 5.1, .24, .55);
    this.box(material.trim, -17.5, y + 6.62, SIXTH_ROOM.doorZ + .2, 1.05, .42, .08);
    // Worn porcelain, exposed plumbing and a recessed mirror stay outside the combat passage.
    const fixtures = SIXTH_FIXTURES;
    const sink = this.mesh(new THREE.SphereGeometry(1, 24, 12), porcelain); sink.position.set(fixtures.sink.x, y + 2.15, fixtures.sink.z); sink.scale.set(.5, .2, .7);
    this.box(porcelain, fixtures.sink.x, y + 2.18, fixtures.sink.z, fixtures.sink.width, .12, fixtures.sink.depth);
    this.box(material.iron, fixtures.sink.x, y + 1.35, fixtures.sink.z, .1, 1.35, .1);
    this.box(material.iron, fixtures.sink.x + .15, y + 2.47, fixtures.sink.z, .12, .48, .12);
    const mirror = this.mat(new THREE.MeshStandardMaterial({ color: 0x627c70, roughness: .18, metalness: .88 }));
    this.box(material.trim, -13.24, y + 4.2, -27.5, .08, 2.3, 1.9); this.box(mirror, -13.29, y + 4.2, -27.5, .03, 2.1, 1.7);
    const bowl = this.mesh(new THREE.SphereGeometry(1, 24, 12), porcelain); bowl.position.set(fixtures.toilet.x, y + .9, fixtures.toilet.z); bowl.scale.set(fixtures.toilet.width / 2, .65, .65);
    this.box(porcelain, fixtures.toilet.x, y + 1.55, fixtures.toilet.z - .75, .85, 1.2, .32);
    this.box(material.iron, fixtures.toilet.x, y + .55, fixtures.toilet.z - 1.45, .12, 1.1, .12);
    const bulbMaterial = this.mat(new THREE.MeshStandardMaterial({ color: 0xcebda0, emissive: 0xccae70, emissiveIntensity: .8 }));
    this.box(material.iron, -17.5, y + 6.6, -24.7, .32, .16, .32);
    const bulb = this.mesh(new THREE.SphereGeometry(.15, 12, 8), bulbMaterial); bulb.position.set(-17.5, y + 6.3, -24.7);
    const lamp = new THREE.PointLight(0xd6c392, 12, 12, 2); lamp.position.copy(bulb.position); this.root.add(lamp);
    const source = [...this.geometries]; batchStaticGeometry(this.root, new Set()).forEach(geometry => this.geometries.add(geometry));
    const used = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh) used.add(object.geometry); });
    for (const geometry of source) if (!used.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
    for (const role of ['citizen_4', 'citizen_14'] as const) {
      const light = new THREE.SpotLight(0xdde5d4, 95, 15, .27, .45, 2); light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.normalBias = .045;
      this.root.add(light, light.target); this.lights.push({ role, light });
    }
    this.root.add(this.rubble, this.rifle);
    for (let i = 0; i < 30; i++) {
      const piece = this.box(i % 5 ? material.trim : material.wood, -20.5 + i % 7 * .95, y + .3 + Math.floor(i / 7) * 1.2, WETWALL_SHAFT.front, .2 + i % 4 * .13, .12, .16 + i % 3 * .1, this.rubble);
      piece.userData.start = piece.position.clone();
    }
    this.box(dark, 0, 0, 0, .15, .18, 1.4, this.rifle); this.box(dark, 0, .03, .75, .065, .07, .65, this.rifle);
    this.box(dark, 0, -.1, -.35, .14, .4, .16, this.rifle); this.box(dark, 0, .12, -.4, .22, .1, .4, this.rifle);
  }
  private mat<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, parent = this.root): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(width, height, depth), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  update(journey?: FilmJourney): void {
    const encounter = journey?.wallExposure, active = Boolean(encounter && ['m1_wall_exposed', 'm1_bathroom'].includes(journey!.scene));
    this.rifle.visible = active && ['replacing', 'rushing', 'grapple', 'breach', 'done'].includes(encounter!.phase);
    this.rifle.position.set(-17.4, WETWALL_SHAFT.sixth + Math.max(.16, 2.1 - (encounter?.phase === 'replacing' ? encounter.elapsed * 3 : 8)), -20.8); this.rifle.rotation.y = .6;
    this.rubble.visible = active && ['breach', 'done'].includes(encounter!.phase);
    const age = encounter?.phase === 'breach' ? encounter.elapsed : 3;
    for (const [i, piece] of this.rubble.children.entries()) {
      const start = piece.userData.start as THREE.Vector3;
      piece.position.set(start.x + Math.sin(i * 2.2) * Math.min(age, .6), Math.max(WETWALL_SHAFT.sixth + .12, start.y - 9 * age * age), start.z + Math.min(age, .8) * (1.2 + i % 4 * .7));
      piece.rotation.set(age * .8, age + i, age * 1.2);
    }
    for (const { role, light } of this.lights) {
      light.visible = active && (role === 'citizen_14' || ['ready', 'searching', 'firing', 'cover'].includes(encounter!.phase));
      light.intensity = encounter && ['rushing', 'grapple', 'breach', 'done'].includes(encounter.phase) ? 18 : 95;
      if (!active || !encounter!.starts[role]) continue;
      const root = sixthPose({ ...encounter!, role, start: encounter!.starts[role] });
      light.position.set(root.x + Math.sin(root.yaw) * 1.85, root.y + 3, root.z + Math.cos(root.yaw) * 1.85);
      light.target.position.set(root.x + Math.sin(root.yaw) * 5, root.y + 2.9, root.z + Math.cos(root.yaw) * 5);
    }
  }
  dispose(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); }); this.root.removeFromParent();
  }
}
