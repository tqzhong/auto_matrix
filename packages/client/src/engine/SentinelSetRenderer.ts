import * as THREE from 'three';
import { sentinelMachinePose, SENTINEL_TIMING, type FilmJourney } from '@auto_matrix/shared';

/** The Nebuchadnezzar cockpit and the service pipe outside it share one space.
 * The player approaches through the central deck while the Sentinel remains
 * visible through a physical forward viewport. */
export class SentinelSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private machine = new THREE.Group();
  private tentacles: THREE.Group[] = [];
  private scanBeam!: THREE.Mesh;
  private scanLight!: THREE.PointLight;
  private powerLights: THREE.PointLight[] = [];
  private powerPanels: THREE.MeshBasicMaterial[] = [];
  private frost!: THREE.MeshPhysicalMaterial;
  private noiseBars: THREE.Mesh[] = [];

  constructor(parent: THREE.Group) {
    parent.add(this.root);
    const hull = this.material(new THREE.MeshStandardMaterial({ color: 0x26302f, metalness: .75, roughness: .5 }));
    const steel = this.material(new THREE.MeshStandardMaterial({ color: 0x596460, metalness: .86, roughness: .3 }));
    const worn = this.material(new THREE.MeshStandardMaterial({ color: 0x394541, metalness: .55, roughness: .72 }));
    const rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x0e1414, roughness: .92 }));
    const wet = this.material(new THREE.MeshStandardMaterial({ color: 0x17201f, roughness: .25, metalness: .48 }));
    const red = this.material(new THREE.MeshStandardMaterial({ color: 0x702323, emissive: 0x3b0707, emissiveIntensity: 1.2, metalness: .45, roughness: .28 }));

    this.box(this.root, wet, 0, -.28, 0, 55, .56, 145, 'sentinel-tunnel-floor');
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

    this.box(this.root, hull, 0, .45, -18, 29, .9, 56, 'sentinel-cockpit-deck');
    for (const z of [-12, -20, -28, -36, -44]) {
      this.tube(this.root, [new THREE.Vector3(-14.5, .2, z), new THREE.Vector3(-13, 9, z), new THREE.Vector3(-8, 13.5, z), new THREE.Vector3(8, 13.5, z), new THREE.Vector3(13, 9, z), new THREE.Vector3(14.5, .2, z)], .28, steel);
      this.box(this.root, worn, -13.8, 5.3, z - 3.8, .5, 10.2, 7.2);
      this.box(this.root, worn, 13.8, 5.3, z - 3.8, .5, 10.2, 7.2);
    }
    for (const x of [-11, 11]) for (const z of [-15, -25, -35]) {
      this.box(this.root, rubber, x, 1.18, z, 3.4, 1.65, 4.8);
      const console = this.box(this.root, hull, x, 2.3, z - 1.55, 4.2, 1.1, 1.9); console.rotation.x = -.3;
      const panel = this.material(new THREE.MeshBasicMaterial({ color: 0x7eb39c, toneMapped: false })); this.powerPanels.push(panel);
      const screen = this.box(this.root, panel, x, 2.73, z - 1.88, 2.8, .06, .8); screen.rotation.x = -.3;
      for (let i = 0; i < 4; i++) this.cylinder(this.root, i === 3 ? red : steel, x - 1.1 + i * .72, 2.75, z - 1.45, .075, .12).rotation.x = Math.PI / 2;
    }
    for (const [x, z] of [[-8, -34.5], [8, -35.2], [0, -42]] as const) {
      const light = new THREE.PointLight(0xa5d5bd, 185, 15, 2); light.position.set(x, 4.7, z); light.name = 'sentinel-power-light'; this.root.add(light); this.lights.add(light); this.powerLights.push(light);
    }

    const window = new THREE.Group(); window.name = 'sentinel-cockpit-window'; window.position.set(0, 0, -49.4); this.root.add(window);
    this.box(window, hull, 0, 8.4, 0, 28, 1.2, 1.5);
    this.box(window, hull, 0, 1.8, 0, 28, 2.8, 1.5);
    for (const x of [-13.2, -8.8, -4.4, 0, 4.4, 8.8, 13.2]) {
      const support = this.box(window, steel, x, 5.3, .05, .5, 6.4, .65); support.rotation.z = x * -.008;
    }
    this.frost = this.material(new THREE.MeshPhysicalMaterial({ color: 0xb7d1cb, transparent: true, opacity: .08, roughness: .44, metalness: .08, transmission: .58, depthWrite: false, side: THREE.DoubleSide }));
    const glass = this.box(window, this.frost, 0, 5.25, .31, 26.2, 5.6, .12, 'sentinel-frosted-glass'); glass.receiveShadow = false;

    const emp = new THREE.Group(); emp.name = 'sentinel-emp-key'; emp.position.set(-8.3, 2.9, -40.5); emp.rotation.y = .2; this.root.add(emp);
    this.box(emp, rubber, 0, 0, 0, 2.7, 1.25, 1.7); this.cylinder(emp, red, 0, .72, 0, .32, .65);
    const cover = this.material(new THREE.MeshPhysicalMaterial({ color: 0x8a352f, transparent: true, opacity: .48, roughness: .15, metalness: .25, depthWrite: false }));
    const lid = this.box(emp, cover, 0, .78, .05, 1.35, .12, 1.18); lid.rotation.x = -.42;
    this.box(emp, this.material(new THREE.MeshBasicMaterial({ color: 0xff614c, toneMapped: false })), 0, .46, .05, .72, .12, .72);
    for (let i = 0; i < 10; i++) {
      const bar = this.box(emp, this.material(new THREE.MeshBasicMaterial({ color: i > 6 ? 0xff4e3d : 0xb7dba8, toneMapped: false })), -1.06 + i * .235, -.3, -.87, .15, .22, .04, `sentinel-noise-bar-${i}`);
      this.noiseBars.push(bar);
    }

    this.buildMachine(hull, steel, rubber, red);
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
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 14), material); mesh.position.set(x, y, z); return mesh;
  }
  private tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
    return this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(18, points.length * 8), radius, 8), material);
  }

  private buildMachine(hull: THREE.Material, steel: THREE.Material, rubber: THREE.Material, red: THREE.Material): void {
    this.machine.name = 'sentinel-machine'; this.root.add(this.machine);
    const shell = this.mesh(this.machine, new THREE.IcosahedronGeometry(2.45, 2), hull); shell.scale.set(1, .72, 1.18);
    const ring = this.mesh(this.machine, new THREE.TorusGeometry(2.22, .18, 10, 40), steel); ring.rotation.x = Math.PI / 2;
    for (const x of [-1.45, 0, 1.45]) {
      const eye = this.mesh(this.machine, new THREE.SphereGeometry(x ? .23 : .38, 20, 12), red); eye.position.set(x, -.15, 2.35);
    }
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2; const tentacle = new THREE.Group(); tentacle.rotation.y = angle; this.machine.add(tentacle); this.tentacles.push(tentacle);
      const length = 8 + i % 3 * 1.4;
      const points = [new THREE.Vector3(Math.sin(angle) * 1.5, -.4, Math.cos(angle) * 1.5), new THREE.Vector3(Math.sin(angle) * 2.5, -2.2, Math.cos(angle) * 2.5),
        new THREE.Vector3(Math.sin(angle + .45) * 3.3, -5.2, Math.cos(angle + .45) * 3.3), new THREE.Vector3(Math.sin(angle + .9) * 2.8, -length, Math.cos(angle + .9) * 2.8)];
      this.tube(tentacle, points, .18 - i * .008, i % 2 ? rubber : steel);
      for (let j = 0; j < 5; j++) { const joint = this.mesh(tentacle, new THREE.SphereGeometry(.28 - j * .025, 10, 8), steel); joint.position.copy(points[Math.min(3, Math.ceil(j * 3 / 4))]); }
    }
    const beam = this.material(new THREE.MeshBasicMaterial({ color: 0xff3b32, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.scanBeam = this.mesh(this.machine, new THREE.ConeGeometry(4.8, 18, 32, 1, true), beam, 'sentinel-scan-beam');
    this.scanBeam.position.set(0, -.2, 11); this.scanBeam.rotation.x = Math.PI / 2;
    this.scanLight = new THREE.PointLight(0xff271c, 0, 30, 2); this.scanLight.name = 'sentinel-scan-light'; this.scanLight.position.set(0, 0, 3); this.machine.add(this.scanLight); this.lights.add(this.scanLight);
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const encounter = journey?.scene === 'm1_sentinels' && !journey.visiting ? journey.sentinel : undefined;
    const pose = sentinelMachinePose(encounter);
    this.machine.position.set(pose.x, pose.y, pose.z); this.machine.rotation.y = pose.yaw;
    this.machine.visible = Boolean(encounter && encounter.phase !== 'done');
    const beamMaterial = this.scanBeam.material as THREE.MeshBasicMaterial;
    this.scanBeam.visible = this.machine.visible && pose.scan > .04;
    beamMaterial.opacity = .06 + pose.scan * .21; this.scanLight.intensity = pose.scan * 560;
    this.scanBeam.scale.set(1 + pose.scan * .45, 1, 1 + pose.scan * .45);
    this.tentacles.forEach((tentacle, index) => {
      tentacle.rotation.x = Math.sin(elapsed * 1.7 + index * 1.8) * .16;
      tentacle.rotation.z = Math.cos(elapsed * 1.23 + index) * .13;
    });
    const shutdown = encounter?.phase === 'shutdown' ? encounter.elapsed / SENTINEL_TIMING.shutdown : encounter && encounter.phase !== 'ready' ? 1 : 0;
    const restored = encounter?.phase === 'done' ? 1 : 0;
    const power = Math.max(restored * .72, 1 - shutdown);
    this.powerLights.forEach((light, index) => { light.intensity = 12 + power * (150 + index * 24); light.color.setHex(power > .4 ? 0xa5d5bd : 0x7b1815); });
    this.powerPanels.forEach((panel, index) => panel.color.setHex(power > .5 ? index % 2 ? 0x86b7a1 : 0x719d8c : index % 3 ? 0x101817 : 0x5d1715));
    const close = encounter && ['sweep', 'detected', 'failed', 'clear'].includes(encounter.phase);
    this.frost.opacity = close ? .15 + pose.scan * .22 : .07;
    const noise = encounter?.noise ?? 0; this.noiseBars.forEach((bar, index) => { bar.visible = index < Math.ceil(noise * this.noiseBars.length); });
  }

  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.tentacles = []; this.noiseBars = [];
  }
}
