import * as THREE from 'three';
import { sentinelMachinePose, sentinelPowerPose, SENTINEL_POWER, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The Nebuchadnezzar cockpit and the service pipe outside it share one space.
 * The player approaches through the central deck while the Sentinel remains
 * visible through a physical forward viewport. */
export class SentinelSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private disposed = false;
  private machine = new THREE.Group();
  private tentacles: THREE.Group[] = [];
  private scanBeam!: THREE.Mesh;
  private scanLight!: THREE.PointLight;
  private powerLights: THREE.PointLight[] = [];
  private powerPanels: THREE.MeshBasicMaterial[] = [];
  private powerLens!: THREE.MeshBasicMaterial;
  private cabinFill!: THREE.HemisphereLight;
  private frost!: THREE.MeshPhysicalMaterial;
  private noiseBars: THREE.Mesh[] = [];
  private switches: THREE.Group[] = [];
  private armedLight!: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Group) {
    this.root.name = 'sentinel-cockpit';
    parent.add(this.root);
    const hull = this.material(new THREE.MeshStandardMaterial({ color: 0x586873, metalness: .42, roughness: .68 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0x687781, metalness: .7, roughness: .4 }));
    const worn = this.material(new THREE.MeshStandardMaterial({ color: 0x45545d, metalness: .25, roughness: .82 }));
    const rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x0e1414, roughness: .92 }));
    const wet = this.material(new THREE.MeshStandardMaterial({ color: 0x17201f, roughness: .25, metalness: .48 }));
    const red = this.material(new THREE.MeshStandardMaterial({ color: 0x702323, emissive: 0x3b0707, emissiveIntensity: 1.2, metalness: .45, roughness: .28 }));
    this.surface(hull, 'metal_plate', 5); this.surface(steel, 'metal_plate', 4);

    this.box(this.root, wet, 0, -.32, 0, 55, .56, 145, 'sentinel-tunnel-floor');
    for (let z = -66; z <= 66; z += 4.8) this.box(this.root, steel, 0, .035, z, 18.5, .04, .09, 'sentinel-floor-grate');
    for (let z = -68; z <= 68; z += 8) {
      const rib = this.tube(this.root, [new THREE.Vector3(-27, .2, z), new THREE.Vector3(-23, 14, z), new THREE.Vector3(-13, 28, z), new THREE.Vector3(0, 32, z), new THREE.Vector3(13, 28, z), new THREE.Vector3(23, 14, z), new THREE.Vector3(27, .2, z)], .34, worn);
      rib.name = `sentinel-pipe-rib-${z}`;
      for (const x of [-22, 22]) this.cylinder(this.root, steel, x, 4.7, z, 2.65, 9.4);
    }
    for (const x of [-25, 25]) for (const y of [3.5, 6.2, 9]) this.tube(this.root,
      [new THREE.Vector3(x, y, -70), new THREE.Vector3(x, y + .4, 70)], .17 + y * .008, y === 6.2 ? steel : worn);
    for (let z = -65; z < 68; z += 12) {
      const pool = this.mesh(this.root, new THREE.CircleGeometry(3.5 + z % 3, 32), this.material(new THREE.MeshPhysicalMaterial({ color: 0x36524d, transparent: true, opacity: .3, roughness: .08, metalness: .35, depthWrite: false })));
      pool.rotation.x = -Math.PI / 2; pool.position.set(z % 4 ? -16 : 15, .03, z);
    }

    this.box(this.root, hull, 0, -.45, -18, 29, .9, 56, 'sentinel-cockpit-deck');
    const ceiling = new THREE.Group(); ceiling.name = 'sentinel-cabin-roof'; this.root.add(ceiling);
    for (const z of [-12, -20, -28, -36, -44]) {
      this.tube(this.root, [new THREE.Vector3(-14.5, .2, z), new THREE.Vector3(-13, 8, z), new THREE.Vector3(-8, 9.5, z), new THREE.Vector3(8, 9.5, z), new THREE.Vector3(13, 8, z), new THREE.Vector3(14.5, .2, z)], .28, steel);
      this.box(ceiling, hull, 0, 9.8, z, 16.8, .26, 8.3);
      for (const side of [-1, 1]) {
        const slope = this.box(ceiling, hull, side * 11.1, 9, z, 5.9, .26, 8.3); slope.rotation.z = -side * .28;
        this.box(this.root, worn, side * 13.8, 4.1, z - 3.8, .5, 8.2, 7.2);
      }
    }
    for (const x of [-11, 11]) for (const z of [-15, -25, -35]) {
      this.box(this.root, rubber, x, 1.18, z, 3.4, 1.65, 4.8);
      const console = this.box(this.root, hull, x, 2.3, z - 1.55, 4.2, 1.1, 1.9); console.rotation.x = -.3;
      const panel = this.material(new THREE.MeshBasicMaterial({ color: 0x7eb39c, toneMapped: false })); this.powerPanels.push(panel);
      const screen = this.box(this.root, panel, x, 2.73, z - 1.88, 2.8, .06, .8); screen.rotation.x = -.3;
      for (let i = 0; i < 4; i++) this.cylinder(this.root, i === 3 ? red : steel, x - 1.1 + i * .72, 2.75, z - 1.45, .075, .12).rotation.x = Math.PI / 2;
    }
    this.powerLens = this.material(new THREE.MeshBasicMaterial({ color: 0xc7d8e6, toneMapped: false }));
    for (const [x, z] of [[-8, -34.5], [8, -35.2], [0, -22]] as const) {
      this.box(this.root, hull, x, 8.25, z, 3.7, .24, 1.2);
      for (const side of [-1, 1]) {
        this.cylinder(this.root, steel, x + side * 1.3, 8.9, z, .035, 1.2);
        this.cylinder(this.root, this.powerLens, x, 8.05, z + side * .28, .075, 3).rotation.z = Math.PI / 2;
      }
      const light = new THREE.PointLight(0xb1c8dd, 28, 24, 2); light.position.set(x, 7.8, z); light.name = 'sentinel-power-light'; this.root.add(light); this.lights.add(light); this.powerLights.push(light);
    }
    this.cabinFill = new THREE.HemisphereLight(0xb1c6d5, 0x182633, 1.1); this.cabinFill.name = 'sentinel-cockpit-fill'; this.root.add(this.cabinFill); this.lights.add(this.cabinFill);

    const window = new THREE.Group(); window.name = 'sentinel-cockpit-window'; window.position.set(0, 0, -49.4); this.root.add(window);
    this.box(window, hull, 0, 8.4, 0, 28, 1.2, 1.5);
    this.box(window, hull, 0, 1.8, 0, 28, 2.8, 1.5);
    for (const x of [-13.2, -8.8, -4.4, 0, 4.4, 8.8, 13.2]) {
      const support = this.box(window, steel, x, 5.3, .05, .5, 6.4, .65); support.rotation.z = x * -.008;
    }
    this.frost = this.material(new THREE.MeshPhysicalMaterial({ color: 0xb7d1cb, transparent: true, opacity: .035, roughness: .44, metalness: .08, transmission: .58, depthWrite: false, side: THREE.DoubleSide }));
    const glass = this.box(window, this.frost, 0, 5.25, .31, 26.2, 5.6, .12, 'sentinel-frosted-glass'); glass.receiveShadow = false;
    const rim = new THREE.Group(); rim.name = 'sentinel-viewport-rim'; window.add(rim);
    const viewportGlow = this.material(new THREE.MeshBasicMaterial({ color: 0x9fd9ca, toneMapped: false }));
    this.box(rim, viewportGlow, 0, 7.72, .47, 24.4, .1, .08, 'sentinel-viewport-top-light');
    this.box(rim, viewportGlow, 0, 2.78, .47, 24.4, .08, .08, 'sentinel-viewport-bottom-light');
    for (const x of [-10.5, 10.5]) {
      const light = new THREE.PointLight(0x8fc8be, 38, 18, 2); light.position.set(x, 5.25, .7); rim.add(light); this.lights.add(light);
    }
    this.exteriorMatte(this.root);

    const station = SENTINEL_POWER.emp;
    const emp = new THREE.Group(); emp.name = 'sentinel-emp-key'; emp.position.set(station.x, station.y, station.z); this.root.add(emp);
    this.box(emp, rubber, 0, 0, 0, station.width, station.height, station.depth);
    this.box(emp, hull, 0, -1.43, 0, .9, 2.52, .58, 'sentinel-emp-pedestal');
    this.box(emp, steel, 0, .22, 0, 1.38, .06, .78);
    this.cylinder(emp, red, 0, .25, 0, .16, .12);
    const cover = this.material(new THREE.MeshPhysicalMaterial({ color: 0x8a352f, transparent: true, opacity: .48, roughness: .15, metalness: .25, depthWrite: false }));
    this.box(emp, cover, 0, .28, 0, .72, .04, .6, 'sentinel-emp-guard');
    this.armedLight = this.material(new THREE.MeshBasicMaterial({ color: 0x2b1916, toneMapped: false }));
    this.box(emp, this.armedLight, .52, .25, .29, .19, .035, .12, 'sentinel-emp-ready-light');
    const panel = SENTINEL_POWER.panel;
    this.box(this.root, hull, panel.x, panel.y, panel.z, panel.width, panel.height, panel.depth, 'sentinel-power-panel');
    this.box(this.root, hull, panel.x, 1.1, panel.z, panel.width, 2.2, panel.depth, 'sentinel-power-panel-base');
    for (const [i, key] of ['main', 'arm'].entries()) {
      const at = SENTINEL_POWER[key as 'main' | 'arm'];
      this.box(this.root, rubber, at.x - .05, at.y, at.z, .22, .28, .34);
      const lever = new THREE.Group(); lever.name = `sentinel-${key}-power-lever`; lever.position.set(at.x, at.y, at.z); this.root.add(lever); this.switches.push(lever);
      this.cylinder(lever, steel, 0, .12, 0, .025, .24);
      const tip = this.mesh(lever, new THREE.SphereGeometry(.055, 12, 8), i ? red : rubber, `sentinel-${key}-power-contact`); tip.position.y = .24;
    }
    for (let i = 0; i < 10; i++) {
      const bar = this.box(emp, this.material(new THREE.MeshBasicMaterial({ color: i > 6 ? 0xff4e3d : 0xb7dba8, toneMapped: false })), -.62 + i * .138, .05, -.46, .08, .13, .025, `sentinel-noise-bar-${i}`);
      this.noiseBars.push(bar);
    }

    this.buildMachine(hull, steel, rubber, red);
    this.batch();
  }

  private batch(): void {
    // Merge fixed siblings inside each animated parent. Named controls and
    // transparent surfaces stay independent for contact, sorting and updates.
    const movable = new Set(this.noiseBars);
    this.root.traverse(parent => batchStaticGeometry(parent, movable, false).forEach(geometry => this.geometries.add(geometry)));
    if (!import.meta.env?.DEV) {
      const used = new Set<THREE.BufferGeometry>();
      this.root.traverse(object => { if (object instanceof THREE.Mesh) used.add(object.geometry); });
      for (const geometry of this.geometries) if (!used.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
    }
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private surface(material: THREE.MeshStandardMaterial, name: string, repeat: number): void {
    if (typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    for (const [suffix, field] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = loader.load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (field === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[field] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.28, .28); material.needsUpdate = true;
  }
  private exteriorMatte(parent: THREE.Object3D): void {
    const material = this.material(new THREE.MeshBasicMaterial({ color: 0x31534f, fog: false, side: THREE.DoubleSide }));
    if (typeof document !== 'undefined') {
      const texture = new THREE.TextureLoader().load('/assets/sentinel/service-tunnel-matte-v1.png', loaded => { if (this.disposed || !this.materials.has(material)) loaded.dispose(); });
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; material.map = texture; material.needsUpdate = true; this.textures.add(texture);
    }
    const matte = this.mesh(parent, new THREE.PlaneGeometry(82, 46), material, 'sentinel-exterior-matte');
    matte.position.set(0, 10, -88); matte.castShadow = false; matte.receiveShadow = false;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 14), material); mesh.position.set(x, y, z); return mesh;
  }
  private tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
    return this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(18, points.length * 8), radius, 8), material);
  }

  private buildMachine(hull: THREE.Material, steel: THREE.Material, rubber: THREE.Material, red: THREE.Material): void {
    this.machine.name = 'sentinel-machine'; this.root.add(this.machine);
    const shell = this.mesh(this.machine, new THREE.IcosahedronGeometry(2.45, 2), hull); shell.scale.set(1, .72, 1.18);
    const ring = this.mesh(this.machine, new THREE.TorusGeometry(2.22, .18, 10, 40), steel); ring.rotation.x = Math.PI / 2;
    const optics = new THREE.Group(); optics.name = 'sentinel-optics-cage'; optics.position.z = 2.18; this.machine.add(optics);
    const housing = this.mesh(optics, new THREE.CylinderGeometry(1.58, 1.86, .72, 20), hull, 'sentinel-optics-housing'); housing.rotation.x = Math.PI / 2;
    const visor = this.mesh(optics, new THREE.TorusGeometry(1.72, .12, 10, 32), steel, 'sentinel-optics-visor'); visor.rotation.x = Math.PI / 2; visor.position.z = .38;
    for (const x of [-1.35, 1.35]) {
      const cheek = this.mesh(optics, new THREE.ConeGeometry(.46, .94, 6), steel, 'sentinel-optics-cheek'); cheek.position.set(x, -.45, .32); cheek.rotation.z = x < 0 ? .8 : -.8; cheek.rotation.x = Math.PI / 2;
    }
    for (const x of [-1.45, 0, 1.45]) {
      const eye = this.mesh(optics, new THREE.SphereGeometry(x ? .23 : .38, 20, 12), red, 'sentinel-optic'); eye.position.set(x, -.15, .78);
    }
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2; const tentacle = new THREE.Group(); tentacle.rotation.y = angle; this.machine.add(tentacle); this.tentacles.push(tentacle);
      const length = 8 + i % 3 * 1.4;
      const points = [new THREE.Vector3(Math.sin(angle) * 1.5, -.4, Math.cos(angle) * 1.5), new THREE.Vector3(Math.sin(angle) * 2.5, -2.2, Math.cos(angle) * 2.5),
        new THREE.Vector3(Math.sin(angle + .45) * 3.3, -5.2, Math.cos(angle + .45) * 3.3), new THREE.Vector3(Math.sin(angle + .9) * 2.8, -length, Math.cos(angle + .9) * 2.8)];
      this.tube(tentacle, points, .18 - i * .008, i % 2 ? rubber : steel);
      for (let j = 0; j < 5; j++) { const joint = this.mesh(tentacle, new THREE.SphereGeometry(.28 - j * .025, 10, 8), steel); joint.position.copy(points[Math.min(3, Math.ceil(j * 3 / 4))]); }
    }
    const beam = this.material(new THREE.MeshBasicMaterial({ color: 0xff3b32, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.scanBeam = this.mesh(this.machine, new THREE.ConeGeometry(1.75, 10, 20, 1, true), beam, 'sentinel-scan-beam');
    this.scanBeam.position.set(0, -.2, 7); this.scanBeam.rotation.x = Math.PI / 2;
    this.scanLight = new THREE.PointLight(0xff271c, 0, 30, 2); this.scanLight.name = 'sentinel-scan-light'; this.scanLight.position.set(0, 0, 3); this.machine.add(this.scanLight); this.lights.add(this.scanLight);
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const encounter = journey?.scene === 'm1_sentinels' && !journey.visiting ? journey.sentinel : undefined;
    const pose = sentinelMachinePose(encounter);
    this.machine.position.set(pose.x, pose.y, pose.z); this.machine.rotation.y = pose.yaw;
    this.machine.visible = Boolean(encounter && encounter.phase !== 'done');
    const beamMaterial = this.scanBeam.material as THREE.MeshBasicMaterial;
    this.scanBeam.visible = this.machine.visible && pose.scan > .04;
    beamMaterial.opacity = .012 + pose.scan * .055; this.scanLight.intensity = pose.scan * 560;
    this.scanBeam.scale.set(1 + pose.scan * .22, 1, 1 + pose.scan * .22);
    this.tentacles.forEach((tentacle, index) => {
      tentacle.rotation.x = Math.sin(elapsed * 1.7 + index * 1.8) * .16;
      tentacle.rotation.z = Math.cos(elapsed * 1.23 + index) * .13;
    });
    const posePower = sentinelPowerPose(encounter), power = posePower.power;
    this.switches[0].rotation.z = -posePower.main * Math.PI / 2;
    this.switches[1].rotation.z = -posePower.arm * Math.PI / 2;
    this.armedLight.color.setHex(posePower.arm > .99 ? 0xff714d : 0x2b1916);
    this.powerLights.forEach((light, index) => { light.intensity = 2 + power * (24 + index * 4); light.color.setHex(power > .4 ? 0xb1c8dd : 0x7b1815); });
    this.powerLens.color.setHex(power > .4 ? 0xc7d8e6 : 0x2b1110);
    this.cabinFill.intensity = .3 + power * .8;
    this.powerPanels.forEach((panel, index) => panel.color.setHex(power > .5 ? index % 2 ? 0x86b7a1 : 0x719d8c : index % 3 ? 0x101817 : 0x5d1715));
    const close = encounter && ['sweep', 'detected', 'failed', 'clear'].includes(encounter.phase);
    this.frost.opacity = close ? .055 + pose.scan * .09 : .035;
    const noise = encounter?.noise ?? 0; this.noiseBars.forEach((bar, index) => { bar.visible = index < Math.ceil(noise * this.noiseBars.length); });
  }

  dispose(): void {
    this.disposed = true;
    this.root.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear(); this.tentacles = []; this.noiseBars = [];
  }
}
