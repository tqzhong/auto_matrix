import * as THREE from 'three';
import { INTERLUDE_TIMING, type FilmJourney } from '@auto_matrix/shared';

/** Cypher's private top-floor table. The compact layout keeps the steak,
 * glassware and both seated characters readable from either player camera. */
export class CypherRestaurantRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private cutPiece = new THREE.Group();
  private knife = new THREE.Group();
  private wine: THREE.MeshPhysicalMaterial;

  constructor(private root: THREE.Group) {
    const marble = this.material(new THREE.MeshStandardMaterial({ color: 0x373431, roughness: .34, metalness: .08 }));
    const walnut = this.material(new THREE.MeshStandardMaterial({ color: 0x33241c, roughness: .5 }));
    const brass = this.material(new THREE.MeshStandardMaterial({ color: 0xa8874b, roughness: .26, metalness: .82 }));
    const cloth = this.material(new THREE.MeshStandardMaterial({ color: 0xa99f8f, roughness: .92 }));
    const leather = this.material(new THREE.MeshStandardMaterial({ color: 0x321d1b, roughness: .55 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0xb8b7ae, roughness: .16, metalness: .9 }));
    const steak = this.material(new THREE.MeshStandardMaterial({ color: 0x5d1e16, roughness: .62 }));
    const sear = this.material(new THREE.MeshStandardMaterial({ color: 0x27120e, roughness: .8 }));
    const night = this.material(new THREE.MeshBasicMaterial({ color: 0x090d12, toneMapped: false }));
    const window = this.material(new THREE.MeshPhysicalMaterial({ color: 0x8da4a8, transparent: true, opacity: .15, roughness: .12, metalness: .15, depthWrite: false, side: THREE.DoubleSide }));
    this.wine = this.material(new THREE.MeshPhysicalMaterial({ color: 0x551018, transparent: true, opacity: .8, roughness: .12, transmission: .15 }));

    this.box(this.root, marble, 0, -.28, 0, 40, .56, 50, 'cypher-restaurant-floor');
    this.box(this.root, walnut, -19.65, 6.5, 0, .7, 13, 50);
    this.box(this.root, walnut, 19.65, 6.5, 0, .7, 13, 50);
    this.box(this.root, walnut, 0, 6.5, 24.65, 40, 13, .7);
    this.box(this.root, night, 0, 6.5, -25, 40, 13, .25, 'cypher-restaurant-night');
    this.box(this.root, window, 0, 6.4, -24.7, 37.5, 10.8, .08, 'cypher-restaurant-window');
    for (const x of [-18.5, -9.25, 0, 9.25, 18.5]) this.box(this.root, brass, x, 6.4, -24.52, .18, 11.2, .22);
    for (const y of [1, 6.4, 11.8]) this.box(this.root, brass, 0, y, -24.52, 37.7, .16, .22);
    const cityLight = this.material(new THREE.MeshBasicMaterial({ color: 0xd4a56b, toneMapped: false }));
    const cityCool = this.material(new THREE.MeshBasicMaterial({ color: 0x86a4a7, toneMapped: false }));
    for (let i = 0; i < 42; i++) {
      const x = -18 + i % 14 * 2.75; const y = 1.4 + Math.floor(i / 14) * 2.2 + (i % 3) * .25;
      this.box(this.root, i % 5 ? cityLight : cityCool, x, y, -25.18, .13 + i % 3 * .05, .08, .03, `cypher-skyline-light-${i}`);
    }
    for (const x of [-13, 13]) for (const z of [-2, 12]) {
      this.box(this.root, walnut, x, 2.3, z, 7.5, .25, 4.2);
      this.box(this.root, cloth, x, 2.51, z, 7.8, .18, 4.5);
    }

    const table = new THREE.Group(); table.name = 'cypher-window-table'; table.position.set(0, 0, -13); this.root.add(table);
    this.box(table, walnut, 0, 2.33, 0, 11.5, .36, 5.2);
    this.box(table, cloth, 0, 2.58, 0, 11.9, .2, 5.6);
    for (const x of [-5.2, 5.2]) for (const z of [-2.2, 2.2]) this.box(table, walnut, x, 1.15, z, .3, 2.3, .3);
    this.chair(0, -8.7, Math.PI, leather, walnut, 'cypher-chair-smith');
    this.chair(0, -17.3, 0, leather, walnut, 'cypher-chair-cypher');

    this.plate(-14.65, steel, cloth);
    const steakRoot = new THREE.Group(); steakRoot.name = 'cypher-steak'; steakRoot.position.set(0, 2.83, -14.65); this.root.add(steakRoot);
    const body = this.mesh(steakRoot, new THREE.CylinderGeometry(1.18, 1.05, .36, 18), steak); body.scale.z = .68;
    const crust = this.mesh(steakRoot, new THREE.TorusGeometry(.78, .25, 8, 22), sear); crust.rotation.x = Math.PI / 2; crust.scale.x = 1.25; crust.scale.y = .72;
    this.cutPiece.name = 'cypher-steak-cut-piece'; this.cutPiece.position.set(.78, 3.05, -14.4); this.root.add(this.cutPiece);
    const bite = this.mesh(this.cutPiece, new THREE.BoxGeometry(.72, .34, .68), steak); bite.rotation.y = .24;
    this.knife.name = 'cypher-steak-knife'; this.knife.position.set(1.7, 3.03, -14.65); this.root.add(this.knife);
    this.box(this.knife, steel, 0, 0, 0, .12, .08, 2.5); this.box(this.knife, walnut, 0, 0, 1.55, .2, .13, .85);
    const fork = new THREE.Group(); fork.name = 'cypher-steak-fork'; fork.position.set(-1.7, 3.03, -14.65); this.root.add(fork);
    this.box(fork, steel, 0, 0, 0, .11, .08, 2.2);
    for (const x of [-.16, -.055, .055, .16]) this.box(fork, steel, x, 0, -1.18, .045, .06, .48);
    this.glass(-2.5, 3.15, -14.45, steel, 'cypher-wine-glass');
    this.glass(2.5, 3.15, -11.55, steel, 'smith-water-glass');

    for (const x of [-11, 0, 11]) {
      this.cylinder(this.root, brass, x, 10.5, -8, .06, 4.5);
      const shade = this.mesh(this.root, new THREE.CylinderGeometry(.85, 1.5, .7, 24, 1, true), cloth); shade.position.set(x, 8.25, -8);
      const light = new THREE.PointLight(0xffd2a0, 58, 20, 2); light.position.set(x, 7.9, -8); this.root.add(light); this.lights.add(light);
    }
    const key = new THREE.SpotLight(0xffc58d, 320, 32, Math.PI / 4, .65, 2); key.name = 'cypher-restaurant-key-light'; key.position.set(7, 10.5, -8); key.target.position.set(0, 2.4, -13); this.root.add(key, key.target); this.lights.add(key);
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 20), material); mesh.position.set(x, y, z); return mesh;
  }
  private chair(x: number, z: number, yaw: number, leather: THREE.Material, wood: THREE.Material, name: string): void {
    const chair = new THREE.Group(); chair.name = name; chair.position.set(x, 0, z); chair.rotation.y = yaw; this.root.add(chair);
    this.box(chair, leather, 0, 1.35, 0, 2.5, .48, 2.45);
    this.box(chair, leather, 0, 2.7, -1, 2.5, 2.6, .42);
    for (const dx of [-1, 1]) for (const z of [-.9, .9]) this.cylinder(chair, wood, dx, .62, z, .11, 1.24);
  }
  private plate(z: number, steel: THREE.Material, cloth: THREE.Material): void {
    const plate = this.mesh(this.root, new THREE.CylinderGeometry(1.65, 1.65, .09, 32), cloth, 'cypher-steak-plate'); plate.position.set(0, 2.81, z);
    const rim = this.mesh(this.root, new THREE.TorusGeometry(1.38, .09, 8, 32), steel); rim.position.set(0, 2.88, z); rim.rotation.x = Math.PI / 2;
  }
  private glass(x: number, y: number, z: number, trim: THREE.Material, name: string): void {
    const group = new THREE.Group(); group.name = name; group.position.set(x, y, z); this.root.add(group);
    const bowl = this.mesh(group, new THREE.CylinderGeometry(.34, .23, .75, 20, 1, true), this.wine); bowl.position.y = .34;
    this.cylinder(group, trim, 0, -.25, 0, .035, .55); this.cylinder(group, trim, 0, -.55, 0, .28, .04);
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const encounter = journey?.scene === 'm1_steak' && !journey.visiting && journey.interlude?.kind === 'steak' ? journey.interlude : undefined;
    const t = encounter?.phase === 'performing' ? encounter.elapsed : encounter?.phase === 'done' ? INTERLUDE_TIMING.steak : 0;
    const cut = THREE.MathUtils.smoothstep(t, .5, 2.35);
    this.knife.rotation.x = -.08 - Math.sin(Math.min(1, t / 2.2) * Math.PI * 5) * .11 * (1 - cut);
    this.knife.position.x = 1.7 - cut * .7;
    const lift = THREE.MathUtils.smoothstep(t, 2.4, 3.3) * (1 - THREE.MathUtils.smoothstep(t, 4.4, 5.15));
    this.cutPiece.position.set(.78 - lift * .55, 3.05 + lift * 1.65, -14.4 + lift * .52);
    this.cutPiece.rotation.x = lift * .25; this.cutPiece.rotation.z = -lift * .32;
    this.wine.opacity = .8 - THREE.MathUtils.smoothstep(t, 3.3, 5.2) * .22;
    const window = this.root.getObjectByName('cypher-restaurant-window'); if (window) window.rotation.y = Math.sin(elapsed * .08) * .0006;
  }

  dispose(): void {
    this.root.clear(); this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose()); this.lights.forEach(item => item.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear();
  }
}
