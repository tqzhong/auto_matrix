import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';

/** Film-one training programs share a clean simulation language, but each
 * space has its own physical set and lighting rather than the generic atlas. */
export class TrainingSetRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private disposed = false;
  private crowd: THREE.Group[] = [];
  private fountainJets: THREE.Mesh[] = [];
  private skylineLights: THREE.Mesh[] = [];
  private programLight?: THREE.PointLight;
  private revealLight?: THREE.PointLight;
  private wind?: THREE.Group;
  private wood = this.material(new THREE.MeshStandardMaterial({ color: 0x4c3425, roughness: .72 }));
  private darkWood = this.material(new THREE.MeshStandardMaterial({ color: 0x211b17, roughness: .8 }));
  private paper = this.material(new THREE.MeshPhysicalMaterial({ color: 0xe5dfc9, roughness: .68, transmission: .04 }));
  private stone = this.material(new THREE.MeshStandardMaterial({ color: 0x8a908a, roughness: .88 }));
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x252c2d, roughness: .75, metalness: .16 }));
  private metal = this.material(new THREE.MeshStandardMaterial({ color: 0x596463, roughness: .35, metalness: .78 }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x839b9b, roughness: .16, metalness: .28, transparent: true, opacity: .5, depthWrite: false }));
  private water = this.material(new THREE.MeshPhysicalMaterial({ color: 0x609394, roughness: .08, metalness: .28, clearcoat: 1, transparent: true, opacity: .82 }));
  private glow = this.material(new THREE.MeshBasicMaterial({ color: 0xc9e7d5, toneMapped: false }));

  constructor(private root: THREE.Group, readonly sceneId: string) {
    if (sceneId === 'm1_dojo') this.dojo();
    else if (sceneId === 'm1_jump') this.rooftops();
    else this.plaza();
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private surface(material: THREE.MeshStandardMaterial, name: string, repeat: number, folder = 'film-materials'): void {
    if (typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    for (const [suffix, field] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = loader.load(`/assets/${folder}/${name}-${suffix}.jpg`, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (field === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[field] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.32, .32); material.needsUpdate = true;
  }
  private gardenMatte(parent: THREE.Object3D, x: number, y: number, z: number, reverse: boolean, name: string): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0xc8d2cf, fog: false }));
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/dojo/training-garden-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    const matte = this.mesh(parent, new THREE.PlaneGeometry(160, 90), material, name); matte.position.set(x, y, z); matte.rotation.y = reverse ? Math.PI : 0;
  }
  private cityMatte(parent: THREE.Object3D): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0xb6c5cc, fog: false, side: THREE.DoubleSide }));
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/rooftops/training-city-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    for (const [x, z, rotation, name] of [[0, -160, 0, 'jump-city-matte'], [0, 160, Math.PI, 'jump-city-reverse-matte'],
      [-160, 0, Math.PI / 2, 'jump-city-west-matte'], [160, 0, -Math.PI / 2, 'jump-city-east-matte']] as const) {
      const matte = this.mesh(parent, new THREE.PlaneGeometry(330, 186), material, name); matte.position.set(x, 26, z); matte.rotation.y = rotation;
    }
  }
  private plazaMatte(parent: THREE.Object3D): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0xd8ddd7, fog: false, side: THREE.DoubleSide }));
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/plaza/red-dress-plaza-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    for (const [x, z, rotation, name] of [[0, -160, 0, 'red-dress-city-matte'], [0, 160, Math.PI, 'red-dress-city-reverse-matte'],
      [-160, 0, Math.PI / 2, 'red-dress-city-west-matte'], [160, 0, -Math.PI / 2, 'red-dress-city-east-matte']] as const) {
      const matte = this.mesh(parent, new THREE.PlaneGeometry(330, 186), material, name); matte.position.set(x, 28, z); matte.rotation.y = rotation; matte.castShadow = false; matte.receiveShadow = false;
    }
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, radial = 20, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, radial), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private light(light: THREE.Light, name: string): void { light.name = name; this.root.add(light); this.lights.add(light); }

  private dojo(): void {
    const set = new THREE.Group(); set.name = 'training-dojo-set'; this.root.add(set);
    const tatami = this.material(new THREE.MeshStandardMaterial({ color: 0x98936c, roughness: .94 }));
    const border = this.material(new THREE.MeshStandardMaterial({ color: 0x283127, roughness: .84 }));
    const cedar = this.material(new THREE.MeshStandardMaterial({ color: 0x3d281d, roughness: .72 }));
    const shoji = this.material(new THREE.MeshPhysicalMaterial({ color: 0xd7ceb8, roughness: .76, transmission: .025 }));
    const roof = this.material(new THREE.MeshStandardMaterial({ color: 0x222729, roughness: .92, metalness: .08 }));
    const gravel = this.material(new THREE.MeshStandardMaterial({ color: 0x8b9187, roughness: .98 }));
    const moss = this.material(new THREE.MeshStandardMaterial({ color: 0x4c6246, roughness: .95 }));
    const leaf = this.material(new THREE.MeshStandardMaterial({ color: 0x38553f, roughness: .9 }));
    const pond = this.material(new THREE.MeshPhysicalMaterial({ color: 0x527e7a, roughness: .12, metalness: .22, clearcoat: .85 }));
    this.surface(cedar, 'old_wood_floor', 3);
    this.surface(gravel, 'damaged_plaster', 6);

    for (let x = -20; x <= 20; x += 8) for (let z = -25; z <= 25; z += 10) {
      this.box(set, tatami, x, .02, z, 7.72, .09, 9.72, `dojo-tatami-${x}-${z}`);
      this.box(set, border, x - 3.82, .075, z, .12, .04, 9.75);
      this.box(set, border, x, .075, z - 4.82, 7.82, .04, .12);
    }

    for (const side of [-1, 1]) {
      for (let z = -25; z <= 25; z += 10) {
        this.box(set, shoji, side * 23.5, 6.1, z, .16, 9.9, 8.9, `dojo-shoji-${side}-${z}`);
        for (let y = 1.35; y < 11; y += 2.15) this.box(set, cedar, side * 23.35, y, z, .28, .1, 9.15);
        for (let offset = -4.3; offset <= 4.3; offset += 2.15) this.box(set, cedar, side * 23.35, 6.1, z + offset, .28, 10, .1);
      }
      for (let z = -30; z <= 30; z += 10) this.cylinder(set, this.darkWood, side * 24.7, 7.3, z, .56, 14.6, 16, `dojo-post-${side}-${z}`);
      this.box(set, cedar, side * 25.2, 11.2, 0, .52, .72, 65, `dojo-side-eave-${side}`);
    }

    const entry = new THREE.Group(); entry.name = 'dojo-entry-porch'; entry.position.z = -31; set.add(entry);
    this.box(entry, cedar, 0, .1, 0, 18, .2, 4.5);
    for (const x of [-9.5, 9.5]) this.cylinder(entry, this.darkWood, x, 5.8, 0, .38, 11.6, 14);
    this.box(entry, shoji, -16.5, 5.7, 0, 14, 10.8, .15);
    this.box(entry, shoji, 16.5, 5.7, 0, 14, 10.8, .15);
    this.box(entry, cedar, 0, 11.2, 0, 49, .55, .62);
    for (const x of [-16.5, 16.5]) for (let y = 1.5; y < 10.5; y += 2.2) this.box(entry, cedar, x, y, 0, 13.8, .1, .25);

    const entryGarden = new THREE.Group(); entryGarden.name = 'dojo-entry-garden'; entryGarden.position.z = -57; set.add(entryGarden);
    this.box(entryGarden, gravel, 0, -.16, 0, 64, .28, 48, 'dojo-entry-gravel');
    this.box(entryGarden, moss, -21, -.02, -2, 18, .1, 42, 'dojo-entry-moss-west');
    this.box(entryGarden, moss, 22, -.02, 8, 16, .1, 29, 'dojo-entry-moss-east');
    for (let z = 18; z >= -14; z -= 5.4) {
      const step = this.cylinder(entryGarden, this.stone, Math.sin(z) * .8, .17, z, 1.2, .2, 14, 'dojo-entry-step');
      step.scale.z = .72;
    }
    for (const [x, z] of [[-25, 14], [-26, -7], [25, 11], [22, -12]] as const) {
      this.cylinder(entryGarden, cedar, x, 3.5, z, .27, 7, 10, 'dojo-entry-bamboo-trunk');
      for (let level = 0; level < 3; level++) {
        const branch = this.box(entryGarden, leaf, x + (level % 2 ? .9 : -.9), 5 + level * 1.2, z, 3, .09, .22, 'dojo-entry-bamboo-leaf');
        branch.rotation.z = level % 2 ? -.35 : .35;
      }
    }
    for (const [x, z] of [[-12, 6], [13, -4]] as const) {
      const lantern = new THREE.Group(); lantern.position.set(x, 0, z); entryGarden.add(lantern);
      this.cylinder(lantern, this.stone, 0, .32, 0, .9, .64, 10);
      this.cylinder(lantern, this.stone, 0, 1.28, 0, .32, 1.3, 10);
      this.box(lantern, this.stone, 0, 2.02, 0, 1.45, .32, 1.45);
    }
    const entryGate = new THREE.Group(); entryGate.name = 'dojo-entry-gate'; entryGate.position.set(0, 0, -89); set.add(entryGate);
    for (const x of [-8.6, 8.6]) this.cylinder(entryGate, this.darkWood, x, 5, 0, .48, 10, 14);
    this.box(entryGate, cedar, 0, 9.4, 0, 21, .56, .7);
    this.box(entryGate, roof, 0, 10.5, 0, 25, .58, 5.2, 'dojo-entry-gate-roof');
    this.box(entryGate, cedar, 0, 11, 0, .55, .36, 5.6);
    this.gardenMatte(set, 0, 15, -118, false, 'dojo-entry-matte');

    const eaves = new THREE.Group(); eaves.name = 'dojo-main-eaves'; eaves.position.y = 13.1; set.add(eaves);
    const leftRoof = this.box(eaves, roof, -12.4, 1.75, 0, 25.5, .48, 65.8, 'dojo-roof-west'); leftRoof.rotation.z = -.245;
    const rightRoof = this.box(eaves, roof, 12.4, 1.75, 0, 25.5, .48, 65.8, 'dojo-roof-east'); rightRoof.rotation.z = .245;
    this.box(eaves, this.darkWood, 0, 4.66, 0, .72, .62, 66.4, 'dojo-roof-ridge');
    for (let z = -29; z <= 29; z += 7.25) {
      const leftRafter = this.box(eaves, cedar, -11.5, 1.85, z, 25.2, .34, .3); leftRafter.rotation.z = -.245;
      const rightRafter = this.box(eaves, cedar, 11.5, 1.85, z, 25.2, .34, .3); rightRafter.rotation.z = .245;
    }
    for (const z of [-31.6, 31.6]) this.box(eaves, cedar, 0, 1.1, z, 51.5, .65, .68, `dojo-end-eave-${z}`);

    const veranda = new THREE.Group(); veranda.name = 'dojo-garden-veranda'; veranda.position.z = 31.2; set.add(veranda);
    this.box(veranda, cedar, 0, .13, 0, 50.5, .26, 5.5, 'dojo-veranda-floor');
    this.box(veranda, border, 0, .3, 2.45, 50.5, .12, .18);
    for (let x = -22; x <= 22; x += 5.5) this.box(veranda, cedar, x, -.35, .2, .28, .86, 5.15);
    for (const x of [-22.5, 22.5]) this.cylinder(veranda, this.darkWood, x, 4.8, -.4, .42, 9.6, 16);
    for (const x of [-10, 0, 10]) this.box(veranda, cedar, x, -.17, 3.35, 7.4, .28, 2.1, 'dojo-veranda-step');

    const garden = new THREE.Group(); garden.name = 'dojo-garden'; garden.position.z = 55; set.add(garden);
    const courtyard = this.box(garden, gravel, 0, -.16, 0, 66, .28, 42, 'dojo-courtyard'); courtyard.receiveShadow = true;
    this.box(garden, moss, -22, -.03, 2, 17, .1, 38, 'dojo-garden-moss-west');
    this.box(garden, moss, 22, -.03, -6, 17, .1, 25, 'dojo-garden-moss-east');
    const water = this.box(garden, pond, 16, .025, 10, 12.4, .08, 18, 'dojo-garden-pond'); water.receiveShadow = true;
    for (let x = -11; x <= 5; x += 4) {
      const stone = this.cylinder(garden, this.stone, x, .18, -2 + Math.sin(x) * 2, 1.15, .22, 14, 'dojo-garden-step');
      stone.scale.z = .72;
    }
    for (const [x, z] of [[-26, -13], [-25, 8], [-18, 16], [25, -13], [26, 7]] as const) {
      this.cylinder(garden, cedar, x, 3.7, z, .24, 7.4, 10, 'dojo-bamboo-trunk');
      for (let level = 0; level < 3; level++) {
        const branch = this.box(garden, leaf, x + (level % 2 ? .85 : -.85), 5.1 + level * 1.25, z, 2.8, .09, .22, 'dojo-bamboo-leaf');
        branch.rotation.z = level % 2 ? -.38 : .38;
      }
    }
    const lantern = new THREE.Group(); lantern.name = 'dojo-garden-lantern'; lantern.position.set(-13, 0, 12); garden.add(lantern);
    this.cylinder(lantern, this.stone, 0, .35, 0, 1, .7, 10);
    this.cylinder(lantern, this.stone, 0, 1.35, 0, .38, 1.4, 10);
    this.box(lantern, this.stone, 0, 2.15, 0, 1.65, .35, 1.65);
    const lanternGlow = new THREE.PointLight(0xffd9a1, 6, 8, 2); lanternGlow.position.set(-13, 2.1, 67); this.light(lanternGlow, 'dojo-garden-lantern-light');

    const pavilion = new THREE.Group(); pavilion.name = 'dojo-garden-pavilion'; pavilion.position.set(-17, 0, 83); set.add(pavilion);
    this.box(pavilion, cedar, 0, .12, 0, 15, .24, 10);
    for (const x of [-6, 6]) for (const z of [-3.5, 3.5]) this.cylinder(pavilion, this.darkWood, x, 4.1, z, .33, 8.2, 12);
    const pavilionRoof = this.box(pavilion, roof, 0, 8.2, 0, 18, .55, 13, 'dojo-pavilion-roof'); pavilionRoof.rotation.z = .01;
    this.box(pavilion, cedar, 0, 8.62, 0, .55, .44, 13.4);

    const ridge = new THREE.Group(); ridge.name = 'dojo-mountain-ridge'; ridge.position.z = 111; set.add(ridge);
    for (let index = -4; index <= 4; index++) {
      const peak = this.mesh(ridge, new THREE.ConeGeometry(12 + Math.abs(index % 3) * 5, 20 + (index + 4) % 3 * 8, 4), this.stone, 'dojo-distant-peak');
      peak.position.set(index * 17, 8 + Math.abs(index % 2) * 3, (index % 3) * 5); peak.rotation.y = Math.PI / 4;
      const slope = this.mesh(ridge, new THREE.ConeGeometry(10 + Math.abs(index % 2) * 4, 14, 4), moss, 'dojo-distant-slope');
      slope.position.set(index * 17 + 3, 5, (index % 3) * 5 - 2); slope.rotation.y = Math.PI / 4;
    }
    this.gardenMatte(set, 0, 15, 150, true, 'dojo-garden-matte');

    this.programLight = new THREE.PointLight(0xf2c987, 132, 34, 2); this.programLight.position.set(0, 10.8, 5); this.light(this.programLight, 'dojo-training-light');
    const sun = new THREE.DirectionalLight(0xffe4b8, 1.35); sun.position.set(-21, 30, 51); sun.castShadow = true; this.light(sun, 'dojo-garden-sun');
    const fill = new THREE.HemisphereLight(0xd8e2d4, 0x29342d, .8); this.light(fill, 'dojo-daylight');
  }

  private rooftopUnit(parent: THREE.Object3D, x: number, z: number, index: number): void {
    const unit = new THREE.Group(); unit.position.set(x, 0, z); parent.add(unit);
    this.box(unit, this.dark, 0, 1.2, 0, 5.5, 2.4, 4.2, `jump-hvac-${index}`);
    for (let i = -2; i <= 2; i++) this.box(unit, this.metal, i * .9, 1.25, 2.13, .55, 1.35, .08);
    const fan = this.mesh(unit, new THREE.TorusGeometry(1.05, .12, 8, 30), this.metal); fan.position.y = 2.48; fan.rotation.x = Math.PI / 2;
  }

  private rooftops(): void {
    const set = new THREE.Group(); set.name = 'training-jump-set'; this.root.add(set);
    const tar = this.material(new THREE.MeshStandardMaterial({ color: 0x5a5e5a, roughness: .92 }));
    const concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x777a73, roughness: .9 }));
    const roofMetal = this.material(new THREE.MeshStandardMaterial({ color: 0x4c5856, roughness: .48, metalness: .68 }));
    const warning = this.material(new THREE.MeshStandardMaterial({ color: 0xc19649, roughness: .64, metalness: .1 }));
    this.surface(tar, 'asphalt_02', 7, 'surfaces'); this.surface(concrete, 'damaged_plaster', 5); this.surface(roofMetal, 'metal_plate', 3);
    this.box(set, tar, 0, -.12, 17, 50, .24, 60, 'jump-near-roof');
    this.box(set, tar, 0, -.12, -38.5, 50, .24, 17, 'jump-far-roof');
    this.box(set, warning, 0, .02, -10.8, 18, .025, .32, 'jump-takeoff-line');
    for (const z of [-13, -30]) {
      this.box(set, concrete, -20, .75, z, 10, 1.5, .7, `jump-parapet-left-${z}`);
      this.box(set, concrete, 20, .75, z, 10, 1.5, .7, `jump-parapet-right-${z}`);
    }
    for (const side of [-1, 1]) this.box(set, concrete, side * 24.65, .65, 7, .7, 1.3, 80);
    this.rooftopUnit(set, -15, 16, 0); this.rooftopUnit(set, 15, 31, 1); this.rooftopUnit(set, 13, -39, 2);
    const service = new THREE.Group(); service.name = 'jump-service-bank'; service.position.set(-10, 0, 34); set.add(service);
    this.box(service, concrete, 0, 2.45, 0, 10, 4.9, 7.5, 'jump-service-hut');
    this.box(service, roofMetal, 0, 5.1, 0, 11.3, .34, 8.6, 'jump-service-hut-roof');
    this.box(service, this.dark, 0, 1.75, 3.82, 2.6, 3.5, .12, 'jump-service-door');
    for (const x of [-4.25, 4.25]) this.cylinder(service, roofMetal, x, 2.2, -2.6, .26, 4.4, 10, 'jump-service-vent');
    for (let y = .8; y < 4.8; y += .72) this.box(service, roofMetal, -5.2, y, -2.7, .12, .11, 2.4, 'jump-service-ladder-rung');
    for (const [x, z, height] of [[-17, 4, 8], [18, 8, 6], [-14, 33, 5]] as const) {
      const tank = this.cylinder(set, this.metal, x, height / 2 + 1, z, 2.4, height, 20, 'jump-water-tank');
      tank.scale.x = 1.18; for (const dx of [-1.7, 1.7]) this.box(set, this.dark, x + dx, 1, z, .22, 2, .22);
    }
    this.wind = new THREE.Group(); this.wind.name = 'jump-wind-lines'; set.add(this.wind);
    for (let i = 0; i < 14; i++) {
      const line = this.box(this.wind, this.glow, -20 + i * 3.1, 3 + i % 4 * 1.4, -21.5, 1.8, .025, .025);
      line.material = this.glow; line.userData.phase = i * .73;
    }
    const city = new THREE.Group(); city.name = 'jump-city-canyon'; set.add(city);
    const facade = this.material(new THREE.MeshStandardMaterial({ color: 0x56605d, roughness: .82, metalness: .08 }));
    const windows = this.material(new THREE.MeshStandardMaterial({ color: 0x182c30, roughness: .32, metalness: .48, emissive: 0x071111, emissiveIntensity: .32 }));
    this.surface(facade, 'damaged_plaster', 4);
    for (let index = 0; index < 16; index++) {
      const side = index % 2 ? 1 : -1; const width = 14 + index % 3 * 3; const depth = 12 + index % 2 * 3;
      const x = side * (47 + index % 3 * 12); const z = -48 - Math.floor(index / 2) * 16; const height = 15 + index % 5 * 4;
      this.box(city, facade, x, height / 2, z, width, height, depth, 'jump-city-building');
      for (let y = 3; y < height - 2; y += 3.2) {
        const pane = this.box(city, windows, x - side * (width / 2 + .045), y, z, .09, 1.35, depth - 1.2, 'jump-city-window-band');
        this.skylineLights.push(pane);
      }
    }
    const distant = new THREE.Group(); distant.name = 'jump-distant-roofline'; distant.position.z = -88; set.add(distant);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.name = `jump-distant-${side < 0 ? 'west' : 'east'}-wing`; wing.position.set(side * 48, 0, side * 5); distant.add(wing);
      this.box(wing, facade, 0, 9, 0, 20, 18, 14, 'jump-distant-building');
      for (let y = 3; y < 16; y += 3.2) this.box(wing, windows, -side * 10.05, y, 0, .09, 1.35, 12.5, 'jump-distant-window-band');
      this.cylinder(wing, roofMetal, -side * 3.4, 21, 0, 1.3, 5.5, 16, 'jump-distant-tank');
      this.box(wing, concrete, side * 5.2, 20.1, 0, 7.2, .35, 9.4, 'jump-distant-roof');
    }
    const canyon = new THREE.Group(); canyon.name = 'jump-canyon-floor'; canyon.position.set(0, -42, -21); set.add(canyon);
    this.box(canyon, tar, 0, 0, 0, 156, .18, 176, 'jump-canyon-street-grid');
    this.box(canyon, this.dark, 0, .12, 0, 18, .08, 176, 'jump-canyon-avenue');
    for (let z = -78; z <= 78; z += 12) this.box(canyon, warning, 0, .18, z, .32, .03, 5.5, 'jump-canyon-lane-mark');
    for (const [x, z, width, height, depth] of [[-47, -32, 26, 14, 29], [-43, 29, 33, 20, 25], [45, -22, 31, 17, 35], [49, 35, 22, 12, 26]] as const) {
      this.box(canyon, facade, x, height / 2, z, width, height, depth, 'jump-canyon-block');
      this.box(canyon, windows, x, height * .6, z - depth / 2 - .05, width - 2, 2.2, .1, 'jump-canyon-window-band');
    }
    this.cityMatte(set);
    this.programLight = new THREE.PointLight(0xdbe9de, 190, 48, 2); this.programLight.position.set(0, 12, -21); this.light(this.programLight, 'jump-gap-light');
    const sun = new THREE.DirectionalLight(0xffedcc, 2.3); sun.position.set(-22, 44, 30); sun.castShadow = true; this.light(sun, 'jump-program-sun');
  }

  private mannequin(parent: THREE.Object3D, x: number, z: number, color: number, index: number): void {
    const figure = new THREE.Group(); figure.name = `red-dress-crowd-${index}`; figure.position.set(x, 0, z); figure.rotation.y = index % 2 ? 0 : Math.PI; parent.add(figure); this.crowd.push(figure);
    figure.scale.setScalar(.86 + index % 3 * .06);
    const cloth = this.material(new THREE.MeshStandardMaterial({ color, roughness: .8 }));
    const skin = this.material(new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xb98265 : index % 3 === 1 ? 0xd5aa8a : 0x8a5f4a, roughness: .76 }));
    const hair = this.material(new THREE.MeshStandardMaterial({ color: index % 4 === 0 ? 0x211d1a : index % 4 === 1 ? 0x47382f : 0x181c1c, roughness: .9 }));
    this.mesh(figure, new THREE.CylinderGeometry(.38, .58, 2.45, 14), cloth).position.y = 2.25;
    this.cylinder(figure, skin, 0, 3.63, 0, .14, .32, 10);
    this.mesh(figure, new THREE.SphereGeometry(.32, 14, 10), skin).position.y = 4.05;
    const cap = this.mesh(figure, new THREE.SphereGeometry(.33, 14, 8), hair); cap.position.set(0, 4.22, -.025); cap.scale.y = .5;
    for (const side of [-1, 1]) {
      const leg = this.box(figure, this.dark, side * .2, .72, 0, .24, 1.44, .31); leg.rotation.x = (index + side) % 3 * .06; leg.userData.crowdLimb = true;
      const arm = this.box(figure, cloth, side * .54, 2.28, 0, .22, 2.05, .28); arm.rotation.z = side * .12; arm.userData.crowdLimb = true;
    }
    figure.userData.baseZ = z; figure.userData.phase = index * .77;
  }

  private plaza(): void {
    const set = new THREE.Group(); set.name = 'training-red-dress-set'; this.root.add(set);
    const paving = this.material(new THREE.MeshStandardMaterial({ color: 0xc2c2b8, roughness: .9 }));
    const joint = this.material(new THREE.MeshStandardMaterial({ color: 0xa7aaa2, roughness: .95 }));
    const limestone = this.material(new THREE.MeshStandardMaterial({ color: 0xc5b79d, roughness: .76, metalness: .04 }));
    const facade = this.material(new THREE.MeshStandardMaterial({ color: 0xb2a894, roughness: .86, metalness: .03 }));
    const window = this.material(new THREE.MeshStandardMaterial({ color: 0x627274, roughness: .4, metalness: .18 }));
    const foliage = this.material(new THREE.MeshStandardMaterial({ color: 0x45634a, roughness: .92 }));
    const benchWood = this.material(new THREE.MeshStandardMaterial({ color: 0x604633, roughness: .72 }));
    const attentionInlay = this.material(new THREE.MeshStandardMaterial({ color: 0xaeb4a9, roughness: .9 }));
    this.surface(limestone, 'marble_01', 5); this.surface(benchWood, 'old_wood_floor', 3);
    this.box(set, paving, 0, -.08, 0, 62, .16, 82, 'red-dress-paving');
    for (let x = -30; x <= 30; x += 4.1) this.box(set, joint, x, .012, 0, .024, .02, 81, 'red-dress-paving-joint');
    for (let z = -40; z <= 40; z += 4.1) this.box(set, joint, 0, .014, z, 61, .02, .024, 'red-dress-paving-joint');
    this.box(set, attentionInlay, 7, .021, -12, 2.7, .026, 17.5, 'red-dress-attention-axis');

    const fountain = new THREE.Group(); fountain.name = 'red-dress-fountain'; fountain.position.set(-15.5, 0, 3); set.add(fountain);
    this.cylinder(fountain, limestone, 0, .26, 0, 8.05, .52, 48, 'red-dress-fountain-apron');
    this.cylinder(fountain, facade, 0, .58, 0, 7.35, .26, 48, 'red-dress-fountain-rim'); this.cylinder(fountain, this.water, 0, .75, 0, 6.72, .08, 48);
    this.cylinder(fountain, limestone, 0, 1.65, 0, 1.5, 2.35, 24, 'red-dress-fountain-pedestal');
    this.cylinder(fountain, limestone, 0, 3.04, 0, 2.45, .3, 28, 'red-dress-fountain-upper-bowl'); this.cylinder(fountain, this.water, 0, 3.24, 0, 2.1, .05, 28);
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2; const jet = this.cylinder(fountain, this.water, Math.cos(angle) * .72, 4.15, Math.sin(angle) * .72, .075, 2.05, 8, `red-dress-fountain-jet-${index}`);
      jet.userData.phase = index * .77; this.fountainJets.push(jet);
    }

    const planters = new THREE.Group(); planters.name = 'red-dress-planters'; set.add(planters);
    for (const [x, z, size] of [[-26, -28, .82], [-26, 28, .76], [26, -25, .8], [26, 29, .88]] as const) {
      const planter = new THREE.Group(); planter.name = 'red-dress-planter'; planter.position.set(x, 0, z); planters.add(planter);
      this.box(planter, limestone, 0, .54, 0, 3.9, 1.08, 3.9, 'red-dress-planter-base');
      for (const [offsetX, offsetZ, scale] of [[-.7, -.25, .82], [.65, -.35, .76], [0, .72, 1]] as const) {
        const shrub = this.mesh(planter, new THREE.DodecahedronGeometry(.92 * size * scale, 1), foliage, 'red-dress-planter-shrub'); shrub.position.set(offsetX, 1.7 + scale * .35, offsetZ); shrub.scale.y = 1.35;
      }
    }

    const furniture = new THREE.Group(); furniture.name = 'red-dress-street-furniture'; set.add(furniture);
    for (const [x, z, rotation] of [[-10, -28, 0], [12, -30, Math.PI], [-10, 29, 0], [12, 27, Math.PI]] as const) {
      const bench = new THREE.Group(); bench.name = 'red-dress-bench'; bench.position.set(x, 0, z); bench.rotation.y = rotation; furniture.add(bench);
      this.box(bench, benchWood, 0, .98, 0, 4.2, .16, .75, 'red-dress-bench-seat'); this.box(bench, benchWood, 0, 1.7, .27, 4.2, 1.35, .16, 'red-dress-bench-back');
      for (const side of [-1, 1]) this.box(bench, this.metal, side * 1.55, .48, 0, .12, .96, .55, 'red-dress-bench-leg');
    }

    for (const side of [-1, 1]) {
      const arcade = new THREE.Group(); arcade.name = `red-dress-${side < 0 ? 'west' : 'east'}-arcade`; arcade.position.x = side * 29.6; set.add(arcade);
      for (let z = -36; z <= 36; z += 9) {
        this.cylinder(arcade, limestone, 0, 5.2, z, .62, 10.4, 20, 'red-dress-arcade-column');
        this.box(arcade, limestone, 0, 10.6, z, 4.6, .65, 8.4, 'red-dress-arcade-beam');
      }
      this.box(arcade, facade, side * 4.25, 8.4, 0, .8, 16.8, 82, 'red-dress-arcade-facade');
      for (let z = -34; z < 36; z += 12) {
        const lamp = this.mesh(arcade, new THREE.SphereGeometry(.22, 12, 8), this.glow); lamp.position.set(-side * .85, 7.4, z);
      }
      const arcadeLight = new THREE.PointLight(0xffddb2, 11, 16, 2); arcadeLight.position.set(side * 28.6, 7.3, 0); this.light(arcadeLight, `red-dress-${side < 0 ? 'west' : 'east'}-arcade-light`);
    }

    const cityEdges = new THREE.Group(); cityEdges.name = 'red-dress-city-edges'; cityEdges.position.z = -78; set.add(cityEdges);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.name = `red-dress-city-${side < 0 ? 'west' : 'east'}-wing`; wing.position.set(side * 42, 0, 0); cityEdges.add(wing);
      this.box(wing, facade, 0, 7.5, 0, 18, 15, 3.6, 'red-dress-city-facade');
      for (let y = 3; y < 13.5; y += 3.4) this.box(wing, window, 0, y, 1.85, 14.2, 1.08, .06, 'red-dress-city-window-band');
      this.box(wing, limestone, 0, 15.25, 0, 20.5, .48, 4.5, 'red-dress-city-cornice');
    }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? 1 : -1; const lane = i % 4 < 2 ? 22 : 25.5; const x = side * lane + (i % 3 - 1) * .75; const z = -35 + Math.floor(i / 2) * 7.2;
      this.mannequin(set, x, z, [0x364947, 0x585a52, 0x31363b, 0x706757][i % 4], i);
    }
    this.plazaMatte(set);
    this.programLight = new THREE.PointLight(0xf2e3c8, 160, 40, 2); this.programLight.position.set(7, 9, -10); this.light(this.programLight, 'red-dress-program-light');
    this.revealLight = new THREE.PointLight(0xff5c43, 0, 20, 2); this.revealLight.position.set(7, 4, 7); this.light(this.revealLight, 'red-dress-agent-reveal');
    const sun = new THREE.DirectionalLight(0xffe6bc, 2.3); sun.position.set(-20, 38, 26); sun.castShadow = true; this.light(sun, 'red-dress-sun');
    this.light(new THREE.HemisphereLight(0xd4e0e2, 0x4a5147, .84), 'red-dress-daylight');
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    if (this.sceneId === 'm1_dojo') {
      const lesson = journey?.scene === 'm1_dojo' && !journey.visiting ? journey.dojo : undefined;
      if (this.programLight) this.programLight.intensity = lesson?.complete ? 95 : 170 + (lesson?.dodged ? 95 : 0) + Math.sin(elapsed * 2.4) * 8;
      return;
    }
    if (this.sceneId === 'm1_jump') {
      const training = journey?.scene === 'm1_jump' && !journey.visiting ? journey.training : undefined;
      if (this.wind) for (const object of this.wind.children) {
        const phase = Number(object.userData.phase ?? 0); object.position.x = -20 + ((elapsed * 8 + phase * 4) % 40); object.visible = Boolean(training?.started);
      }
      if (this.programLight) this.programLight.intensity = training?.started ? 260 : 120;
      return;
    }
    const training = journey?.scene === 'm1_red_dress' && !journey.visiting ? journey.training : undefined;
    const t = training?.elapsed ?? 0; const frozen = Boolean(training?.started && t >= 4.8 && t < 9.2);
    this.fountainJets.forEach(jet => {
      const phase = Number(jet.userData.phase ?? 0); jet.scale.y = .82 + Math.sin(elapsed * 3.4 + phase) * .16;
      jet.position.y = 4.15 + Math.sin(elapsed * 3.4 + phase) * .12;
    });
    this.crowd.forEach((figure, index) => {
      const phase = Number(figure.userData.phase); const base = Number(figure.userData.baseZ);
      figure.position.z = base + (training?.started && !frozen ? Math.sin(elapsed * .55 + phase) * 1.4 : 0);
      figure.rotation.z = frozen ? 0 : Math.sin(elapsed * 1.6 + phase) * .018;
      figure.children.forEach((child, childIndex) => { if (child.userData.crowdLimb) child.rotation.x = frozen ? 0 : Math.sin(elapsed * 3.2 + phase + childIndex) * .08; });
    });
    if (this.revealLight) this.revealLight.intensity = t >= 6.2 && t < 9.2 ? 420 + Math.sin(elapsed * 12) * 35 : 0;
    if (this.programLight) this.programLight.intensity = frozen ? 70 : 145;
  }

  dispose(): void {
    this.disposed = true; this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear(); this.crowd = []; this.fountainJets = []; this.skylineLights = [];
  }
}
