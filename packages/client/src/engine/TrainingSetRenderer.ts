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
  private surface(material: THREE.MeshStandardMaterial, name: string, repeat: number): void {
    if (typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    for (const [suffix, field] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = loader.load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
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
    const tar = this.material(new THREE.MeshStandardMaterial({ color: 0x424846, roughness: .98 }));
    this.box(set, tar, 0, -.12, 17, 50, .24, 60, 'jump-near-roof');
    this.box(set, tar, 0, -.12, -38.5, 50, .24, 17, 'jump-far-roof');
    for (const z of [-13, -30]) {
      this.box(set, this.stone, -20, .75, z, 10, 1.5, .7, `jump-parapet-left-${z}`);
      this.box(set, this.stone, 20, .75, z, 10, 1.5, .7, `jump-parapet-right-${z}`);
    }
    for (const side of [-1, 1]) this.box(set, this.stone, side * 24.65, .65, 7, .7, 1.3, 80);
    this.rooftopUnit(set, -15, 16, 0); this.rooftopUnit(set, 15, 31, 1); this.rooftopUnit(set, 13, -39, 2);
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
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1; const x = side * (34 + i % 4 * 12); const z = 48 - Math.floor(i / 2) * 9;
      const height = 35 + (i * 19) % 62; this.box(city, i % 3 ? this.dark : this.stone, x, height / 2 - 20, z, 17 + i % 4 * 3, height, 15);
      for (let y = 3; y < height - 4; y += 6) {
        const pane = this.box(city, this.glass, x - side * (8.6 + i % 4 * 1.5), y - 20, z, .06, 3.2, 8);
        this.skylineLights.push(pane);
      }
    }
    this.programLight = new THREE.PointLight(0xdbe9de, 190, 48, 2); this.programLight.position.set(0, 12, -21); this.light(this.programLight, 'jump-gap-light');
    const sun = new THREE.DirectionalLight(0xffedcc, 2.3); sun.position.set(-22, 44, 30); sun.castShadow = true; this.light(sun, 'jump-program-sun');
  }

  private mannequin(parent: THREE.Object3D, x: number, z: number, color: number, index: number): void {
    const figure = new THREE.Group(); figure.name = `red-dress-crowd-${index}`; figure.position.set(x, 0, z); figure.rotation.y = index % 2 ? 0 : Math.PI; parent.add(figure); this.crowd.push(figure);
    const cloth = this.material(new THREE.MeshStandardMaterial({ color, roughness: .8 }));
    this.cylinder(figure, cloth, 0, 2.3, 0, .42, 2.7, 12); this.mesh(figure, new THREE.SphereGeometry(.4, 14, 10), this.paper).position.y = 4.05;
    for (const side of [-1, 1]) {
      const leg = this.box(figure, this.dark, side * .22, .75, 0, .28, 1.5, .35); leg.rotation.x = (index + side) % 3 * .06;
      const arm = this.box(figure, cloth, side * .58, 2.35, 0, .25, 2.25, .3); arm.rotation.z = side * .12;
    }
    figure.userData.baseZ = z; figure.userData.phase = index * .77;
  }

  private plaza(): void {
    const set = new THREE.Group(); set.name = 'training-red-dress-set'; this.root.add(set);
    const paving = this.material(new THREE.MeshStandardMaterial({ color: 0xa5aaa2, roughness: .9 }));
    this.box(set, paving, 0, -.08, 0, 62, .16, 82, 'red-dress-paving');
    for (let x = -30; x <= 30; x += 3.1) this.box(set, this.stone, x, .015, 0, .035, .03, 81);
    for (let z = -40; z <= 40; z += 3.1) this.box(set, this.stone, 0, .018, z, 61, .035, .035);
    const fountain = new THREE.Group(); fountain.name = 'red-dress-fountain'; fountain.position.set(-15.5, 0, 3); set.add(fountain);
    this.cylinder(fountain, this.stone, 0, .4, 0, 7, .8, 40); this.cylinder(fountain, this.water, 0, .84, 0, 6.45, .08, 40);
    this.cylinder(fountain, this.stone, 0, 1.7, 0, 1.4, 2.6, 24);
    const spray = this.mesh(fountain, new THREE.SphereGeometry(2.25, 24, 14), this.water); spray.position.y = 3.4; spray.scale.y = .14;
    for (const side of [-1, 1]) {
      const arcade = new THREE.Group(); arcade.position.x = side * 28.5; set.add(arcade);
      for (let z = -36; z <= 36; z += 9) {
        this.cylinder(arcade, this.stone, 0, 5.2, z, .62, 10.4, 20);
        this.box(arcade, this.stone, 0, 10.6, z, 4.6, .65, 8.4);
      }
      this.box(arcade, this.dark, side * .35, 14.3, 0, 2, 7, 82);
      for (let z = -34; z < 36; z += 12) {
        const lamp = this.mesh(arcade, new THREE.SphereGeometry(.22, 12, 8), this.glow); lamp.position.set(-side * .85, 7.4, z);
      }
    }
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1; const lane = i % 4 < 2 ? 3 : 12; const x = side * lane + (i % 3 - 1) * 1.2; const z = -35 + Math.floor(i / 2) * 6.1;
      if (Math.abs(x - 7) < 2.2) continue;
      this.mannequin(set, x, z, [0x364947, 0x585a52, 0x31363b, 0x706757][i % 4], i);
    }
    this.programLight = new THREE.PointLight(0xe4eadb, 135, 34, 2); this.programLight.position.set(7, 9, -10); this.light(this.programLight, 'red-dress-program-light');
    this.revealLight = new THREE.PointLight(0xff5c43, 0, 20, 2); this.revealLight.position.set(7, 4, 7); this.light(this.revealLight, 'red-dress-agent-reveal');
    const sun = new THREE.DirectionalLight(0xffeccb, 2.1); sun.position.set(-20, 38, 26); sun.castShadow = true; this.light(sun, 'red-dress-sun');
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
    this.crowd.forEach((figure, index) => {
      const phase = Number(figure.userData.phase); const base = Number(figure.userData.baseZ);
      figure.position.z = base + (training?.started && !frozen ? Math.sin(elapsed * .55 + phase) * 1.4 : 0);
      figure.rotation.z = frozen ? 0 : Math.sin(elapsed * 1.6 + phase) * .018;
      figure.children.forEach((child, childIndex) => { if (childIndex > 1) child.rotation.x = frozen ? 0 : Math.sin(elapsed * 3.2 + phase + childIndex) * .08; });
    });
    if (this.revealLight) this.revealLight.intensity = t >= 6.2 && t < 9.2 ? 420 + Math.sin(elapsed * 12) * 35 : 0;
    if (this.programLight) this.programLight.intensity = frozen ? 70 : 145;
  }

  dispose(): void {
    this.disposed = true; this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose()); this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear(); this.crowd = []; this.skylineLights = [];
  }
}
