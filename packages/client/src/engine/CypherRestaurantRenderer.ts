import * as THREE from 'three';
import { STEAK_DINING, steakPose, type FilmJourney } from '@auto_matrix/shared';

import { createSteakCutlery, createSteakWine, createSteakPortion } from '../agents/SteakProps.js';

/** Cypher's private top-floor table. The compact layout keeps the steak,
 * glassware and both seated characters readable from either player camera. */
export class CypherRestaurantRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private disposed = false;
  private cutPiece = new THREE.Group();
  private knife: THREE.Group;
  private fork: THREE.Group;
  private glassware: THREE.Group;

  constructor(private root: THREE.Group) {
    const marble = this.material(new THREE.MeshStandardMaterial({ color: 0x373431, roughness: .34, metalness: .08 }));
    const walnut = this.material(new THREE.MeshStandardMaterial({ color: 0x33241c, roughness: .5 }));
    const brass = this.material(new THREE.MeshStandardMaterial({ color: 0xa8874b, roughness: .26, metalness: .82 }));
    const cloth = this.material(new THREE.MeshStandardMaterial({ color: 0xa99f8f, roughness: .92 }));
    const leather = this.material(new THREE.MeshStandardMaterial({ color: 0x321d1b, roughness: .55 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0xb8b7ae, roughness: .16, metalness: .9 }));
    const night = this.material(new THREE.MeshBasicMaterial({ color: 0x090d12, toneMapped: false }));
    const window = this.material(new THREE.MeshPhysicalMaterial({ color: 0x8da4a8, transparent: true, opacity: .15, roughness: .12, metalness: .15, depthWrite: false, side: THREE.DoubleSide }));
    this.surface(marble, 'marble_01', 4); this.surface(walnut, 'old_wood_floor', 2); this.surface(leather, 'leather_red_03', 2);

    this.box(this.root, marble, 0, -.28, 0, 40, .56, 50, 'cypher-restaurant-floor');
    for (let x = -16; x <= 16; x += 8) this.box(this.root, brass, x, .012, 0, .055, .025, 49.2, 'cypher-restaurant-floor-inlay');
    for (let z = -20; z <= 20; z += 10) this.box(this.root, brass, 0, .012, z, 39.2, .025, .055, 'cypher-restaurant-floor-cross-inlay');
    this.box(this.root, walnut, -19.65, 6.5, 0, .7, 13, 50);
    this.box(this.root, walnut, 19.65, 6.5, 0, .7, 13, 50);
    this.box(this.root, walnut, 0, 6.5, 24.65, 40, 13, .7);
    this.box(this.root, night, 0, 6.5, -25, 40, 13, .25, 'cypher-restaurant-night');
    const city = this.material(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide }));
    this.matte(city, '/assets/cypher/restaurant-city-matte-v1.png');
    const cityMatte = this.mesh(this.root, new THREE.PlaneGeometry(20.4, 11.48), city, 'cypher-restaurant-city-matte');
    cityMatte.position.set(0, 6.12, -24.8); cityMatte.castShadow = cityMatte.receiveShadow = false;
    this.box(this.root, window, 0, 6.4, -24.7, 37.5, 10.8, .08, 'cypher-restaurant-window');
    for (const x of [-18.5, -9.25, 0, 9.25, 18.5]) this.box(this.root, brass, x, 6.4, -24.52, .18, 11.2, .22);
    for (const y of [1, 6.4, 11.8]) this.box(this.root, brass, 0, y, -24.52, 37.7, .16, .22);
    this.box(this.root, brass, 0, .38, -24.25, 38.4, .22, .52, 'cypher-restaurant-window-sill');
    this.box(this.root, walnut, 0, 12.2, -24.35, 39.5, .34, .72, 'cypher-restaurant-window-header');
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

    const table = new THREE.Group(); table.name = 'cypher-window-table'; table.position.set(0, 0, STEAK_DINING.table.z); this.root.add(table);
    const { width, depth, height } = STEAK_DINING.table;
    this.box(table, walnut, 0, height - .1, 0, width - .08, .18, depth - .08, 'cypher-dining-table-solid');
    this.box(table, cloth, 0, height - .012, 0, width, .024, depth);
    for (const [name, z] of [['front', -depth / 2], ['back', depth / 2]] as const)
      this.box(table, cloth, 0, height - .22, z, width, .42, .035, `cypher-tablecloth-${name}`);
    for (const x of [-width / 2, width / 2]) this.box(table, cloth, x, height - .22, 0, .035, .42, depth);
    const runner = this.material(new THREE.MeshStandardMaterial({ color: 0x5f2523, roughness: .84 }));
    this.box(table, runner, 0, height + .008, 0, .38, .012, depth - .02, 'cypher-table-runner');
    for (const x of [-width / 2 + .22, width / 2 - .22]) for (const z of [-depth / 2 + .22, depth / 2 - .22]) this.box(table, walnut, x, (height - .2) / 2, z, .12, height - .2, .12);
    this.chair(0, STEAK_DINING.smith.z, Math.PI, leather, walnut, 'cypher-chair-smith');
    this.chair(0, STEAK_DINING.cypher.z, 0, leather, walnut, 'cypher-chair-cypher');

    this.plate(STEAK_DINING.plate.z, steel, cloth);
    const steakRoot = new THREE.Group(); steakRoot.name = 'cypher-steak'; steakRoot.position.set(0, STEAK_DINING.bite.y, STEAK_DINING.plate.z); this.root.add(steakRoot);
    const body = createSteakPortion('main', 'cypher-steak-body'); steakRoot.add(body);
    this.cutPiece.name = 'cypher-steak-cut-piece'; this.cutPiece.position.copy(STEAK_DINING.bite); this.root.add(this.cutPiece);
    const portion = createSteakPortion('slice', 'cypher-plated-slice'); this.cutPiece.add(portion);
    for (const mesh of [body, portion]) { this.geometries.add(mesh.geometry); this.materials.add(mesh.material as THREE.Material); }
    this.knife = createSteakCutlery('knife', 'cypher-steak-knife'); this.fork = createSteakCutlery('fork', 'cypher-steak-fork');
    this.fork.getObjectByName('cypher-held-bite')!.visible = false;
    for (const [prop, at] of [[this.knife, STEAK_DINING.knife], [this.fork, STEAK_DINING.fork]] as const) {
      prop.position.copy(at); prop.rotation.x = Math.PI / 2; this.root.add(prop);
    }
    this.glassware = createSteakWine('cypher-wine-glass'); this.glassware.position.copy(STEAK_DINING.wine); this.root.add(this.glassware);
    const water = createSteakWine('smith-water-glass'); water.position.set(-.92, height, -12.35); this.root.add(water);
    (water.getObjectByName('steak-wine-liquid') as THREE.Mesh).visible = false;
    for (const prop of [this.knife, this.fork, this.glassware, water]) prop.traverse(object => {
      if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); }
    });
    for (const x of [-1.45, 1.45]) {
      this.cylinder(table, brass, x, height + .17, 0, .028, .34);
      const flame = this.material(new THREE.MeshBasicMaterial({ color: 0xffd89a, toneMapped: false }));
      this.mesh(table, new THREE.SphereGeometry(.035, 10, 6), flame, `cypher-table-candle-${x}`).position.set(x, height + .36, 0);
      const light = new THREE.PointLight(0xffb86e, 3, 2.5, 2); light.position.set(x, height + .38, 0); table.add(light); this.lights.add(light);
    }

    for (const x of [-11, 0, 11]) {
      this.cylinder(this.root, brass, x, 10.5, -8, .06, 4.5);
      const shade = this.mesh(this.root, new THREE.CylinderGeometry(.85, 1.5, .7, 24, 1, true), cloth); shade.position.set(x, 8.25, -8);
      const light = new THREE.PointLight(0xffd2a0, 86, 20, 2); light.position.set(x, 7.9, -8); this.root.add(light); this.lights.add(light);
    }
    const key = new THREE.SpotLight(0xffc58d, 320, 32, Math.PI / 4, .65, 2); key.name = 'cypher-restaurant-key-light'; key.position.set(7, 10.5, -8); key.target.position.set(0, 2.4, -13); this.root.add(key, key.target); this.lights.add(key);
    const cityBounce = new THREE.PointLight(0x5d879a, 48, 26, 2); cityBounce.name = 'cypher-restaurant-city-bounce'; cityBounce.position.set(0, 6, -20); this.root.add(cityBounce); this.lights.add(cityBounce);
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private surface(material: THREE.MeshStandardMaterial, id: string, repeat: number): void {
    if (typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = loader.load(`/assets/film-materials/${id}-${suffix}.jpg`, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.35, .35); material.needsUpdate = true;
  }
  private matte(material: THREE.MeshBasicMaterial, path: string): void {
    if (typeof document === 'undefined') return;
    const texture = new THREE.TextureLoader().load(path, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
  }
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
    this.box(chair, leather, 0, 1.14, 0, 1.3, .2, 1.12, `${name}-seat`);
    this.box(chair, leather, 0, 1.92, -.48, 1.3, 1.5, .18);
    for (const dx of [-.5, .5]) for (const dz of [-.4, .4]) this.cylinder(chair, wood, dx, .52, dz, .055, 1.04);
  }
  private plate(z: number, steel: THREE.Material, cloth: THREE.Material): void {
    const { radius, y } = STEAK_DINING.plate;
    const plate = this.mesh(this.root, new THREE.CylinderGeometry(radius, radius, .045, 32), cloth, 'cypher-steak-plate'); plate.position.set(0, y, z);
    const rim = this.mesh(this.root, new THREE.TorusGeometry(radius - .03, .018, 8, 32), steel); rim.position.set(0, y + .025, z); rim.rotation.x = Math.PI / 2;
  }

  update(journey: FilmJourney | undefined, _elapsed: number, bodies?: (id: string) => THREE.Object3D | undefined): void {
    const encounter = journey?.scene === 'm1_steak' && !journey.visiting && journey.interlude?.kind === 'steak' ? journey.interlude : undefined;
    const pose = steakPose(encounter ?? { kind: 'steak', phase: 'ready', elapsed: 0 }), body = bodies?.('cypher');
    this.fork.visible = !body?.getObjectByName('cypher-held-fork')?.visible;
    this.knife.visible = !body?.getObjectByName('cypher-held-knife')?.visible;
    this.glassware.visible = !body?.getObjectByName('cypher-held-wine')?.visible;
    this.cutPiece.visible = pose.t < 3.5;
    this.glassware.getObjectByName('steak-wine-liquid')!.position.y = .41 - pose.drunk * .045;
  }

  dispose(): void {
    this.disposed = true; this.root.clear(); this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose()); this.textures.forEach(item => item.dispose()); this.lights.forEach(item => item.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
