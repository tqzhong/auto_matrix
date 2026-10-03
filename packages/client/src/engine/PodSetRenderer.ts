import * as THREE from 'three';
import { POD_WATER_DROP, POD_RESCUE, awakeningPose, podRescuePose, type FilmJourney } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** A single awakening set: the foreground tank, drain and rescue share story coordinates. */
export class PodSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private robot = new THREE.Group();
  private neckFrame = new THREE.Group();
  private rotor = new THREE.Group();
  private neckPlug = new THREE.Group();
  private clamps: { side: number; pad: THREE.Mesh; links: THREE.Mesh[]; hinges: THREE.Mesh[] }[] = [];
  private needle: THREE.Mesh;
  private claw = new THREE.Group();
  private clawHousing: THREE.Mesh;
  private clawCollar: THREE.Mesh;
  private grippers: { pad: THREE.Mesh; links: THREE.Mesh[]; hinges: THREE.Mesh[]; offset: THREE.Vector3; angle: number }[] = [];
  private hatches: THREE.Group[] = [];
  private connections = new THREE.Group();
  private feeds: { mesh: THREE.Mesh<THREE.TubeGeometry>; plug: THREE.Mesh; start: THREE.Vector3 }[] = [];
  private neckTube: THREE.Mesh<THREE.TubeGeometry>;
  private water: THREE.Mesh;
  private ripple: THREE.Mesh;
  private liquid: THREE.Mesh;
  private arm: THREE.Mesh[] = [];
  private cable: THREE.Mesh;
  private scan: THREE.SpotLight;
  private mist: THREE.Points;
  private steel: THREE.MeshStandardMaterial;
  private dark: THREE.MeshStandardMaterial;

  constructor(parent: THREE.Group) {
    parent.add(this.root);
    this.steel = this.mat(0x46565b, .4, .45); this.dark = this.mat(0x131b1d, .57, .35);
    const rubber = this.mat(0x1c181c, .72); const pink = this.mat(0x59212b, .24, .25); pink.emissive.setHex(0x541723); pink.emissiveIntensity = .25;
    const wet = new THREE.MeshPhysicalMaterial({ color: 0x331923, roughness: .28, metalness: .18, clearcoat: .8, side: THREE.DoubleSide }); this.materials.add(wet);
    this.mesh(this.podShell(48), wet, 0, 2.1, -12.8).scale.set(1.8, 1.25, 3.4);
    this.mesh(this.podRim(64), this.steel, 0, 2.1, -12.8).scale.set(1.8, 1.25, 3.4);
    const fluid = new THREE.MeshPhysicalMaterial({ color: 0x551b28, roughness: .2, metalness: .08, clearcoat: 1,
      transparent: true, opacity: .48, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(fluid);
    const fluidGeometry = this.podFluid(64); fluidGeometry.translate(0, .12, 0);
    this.liquid = this.mesh(fluidGeometry, fluid, 0, 1.9, -12.8); this.liquid.scale.set(1.75, 1, 3.3);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const x = Math.sin(a) * 1.85 * (.84 - .16 * Math.cos(a)), z = -12.8 + Math.cos(a) * 3.45;
      const brace = this.mesh(new THREE.BoxGeometry(.13, 1.1, .18), this.steel, x, 1.55, z); brace.rotation.z = -Math.sin(a) * .3;
      this.mesh(new THREE.SphereGeometry(.065, 8, 6), this.steel, x, 2.15, z);
    }
    this.root.add(this.connections);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1; const z = -14.2 + Math.floor(i / 2) * 1.25;
      const start = new THREE.Vector3(side * 1.5, 1.9, z);
      const mesh = this.tube([start.toArray(), [side * 1.05, 2.45, z - .4], [side * .5, 2.4, z], [side * .36, 2.06, z]], .048, rubber, this.connections);
      mesh.name = `pod-body-feed-${i}`;
      const plug = this.mesh(new THREE.CylinderGeometry(.048, .06, .12, 12), this.steel, 0, 0, 0, this.connections); plug.name = `pod-body-plug-${i}`;
      this.feeds.push({ mesh, plug, start });
    }
    this.neckTube = this.tube([[0, 1.7, -16.3], [0, 1.25, -15.9], [0, 1.5, -15.2], [0, 1.94, -14.78]], .12, rubber, this.connections);
    this.neckTube.name = 'pod-neck-feed';
    this.towers(pink);
    this.nearBank();
    // A concave runoff channel descends to the water rather than an invisible flat floor.
    const positions: number[] = []; const indices: number[] = [];
    for (let row = 0; row <= 32; row++) for (let col = 0; col <= 16; col++) {
      const t = row / 32; const x = (col / 16 - .5) * 6.4;
      positions.push(x, -1 - POD_WATER_DROP * t * t + x * x * .17, -6 + t * 18);
      if (row < 32 && col < 16) { const a = row * 17 + col; indices.push(a, a + 17, a + 1, a + 1, a + 17, a + 18); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const drain = this.mat(0x131b1d, .57, .55); drain.side = THREE.DoubleSide; this.mesh(geometry, drain, 0, 0, 0);
    for (const side of [-1, 1]) this.tube([[side * 3.5, 1, -7], [side * 3.5, -4, 1], [side * 3.5, -18, 13]], .3, this.steel);
    this.tube([[-7, 0, -12], [-9, -8, -2], [-9, -17, 12], [-25, -18, 30]], 1.1, this.dark);
    const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x101e24, roughness: .18, metalness: .55, clearcoat: 1, transparent: true, opacity: .91 }); this.materials.add(waterMat);
    this.water = this.mesh(new THREE.PlaneGeometry(200, 170, 1, 1), waterMat, 0, -POD_WATER_DROP + 1.7, 30); this.water.rotation.x = -Math.PI / 2;
    const rippleMat = new THREE.MeshBasicMaterial({ color: 0x66818a, transparent: true, opacity: .25, depthWrite: false }); this.materials.add(rippleMat);
    this.ripple = this.mesh(new THREE.RingGeometry(.96, 1, 64), rippleMat, 0, -POD_WATER_DROP + 1.73, 12); this.ripple.rotation.x = -Math.PI / 2;
    for (const x of [-30, 30]) {
      this.mesh(new THREE.BoxGeometry(4, 35, 100), this.dark, x, -22, 14);
      for (let z = -20; z < 60; z += 12) this.tube([[x, -7, z], [x * .85, -7, z], [x * .85, -15, z]], .7, this.steel);
    }
    this.root.add(this.robot); this.robot.position.set(0, 10, -14);
    this.mesh(new THREE.CylinderGeometry(1.12, 1.25, .58, 24), this.dark, 0, 0, 0, this.robot);
    const collar = this.mesh(new THREE.TorusGeometry(.92, .08, 8, 32), this.steel, 0, -.34, 0, this.robot); collar.rotation.x = Math.PI / 2;
    this.root.add(this.neckFrame); this.neckFrame.name = 'pod-neck-connection';
    this.neckFrame.add(this.rotor, this.neckPlug); this.neckPlug.name = 'pod-neck-plug';
    this.mesh(new THREE.TorusGeometry(.15, .034, 8, 28), this.steel, 0, 0, .027, this.rotor);
    for (let i = 0; i < 3; i++) {
      const angle = i / 3 * Math.PI * 2;
      const tab = this.mesh(new THREE.BoxGeometry(.055, .065, .09), this.dark, Math.sin(angle) * .15, Math.cos(angle) * .15, .055, this.rotor); tab.rotation.z = -angle;
    }
    const plug = this.mesh(new THREE.CylinderGeometry(.085, .11, .18, 16), rubber, 0, 0, .09, this.neckPlug); plug.rotation.x = Math.PI / 2;
    const clear = new THREE.MeshPhysicalMaterial({ color: 0xc1d6d9, metalness: .1, roughness: .12, transparent: true, opacity: .72, clearcoat: 1 }); this.materials.add(clear);
    this.needle = this.mesh(new THREE.CylinderGeometry(.024, .024, 1, 12), clear, 0, 0, 0, this.neckPlug);
    this.needle.name = 'pod-neck-needle'; this.needle.rotation.x = Math.PI / 2;
    const red = this.mat(0xeb6a51, .2, .3); red.emissive.setHex(0xff4422); red.emissiveIntensity = 2.5;
    for (let i = 0; i < 3; i++) {
      const angle = i / 3 * Math.PI * 2;
      this.mesh(new THREE.SphereGeometry(.095, 10, 6), red, Math.sin(angle) * .98, -.38, Math.cos(angle) * .98, this.robot);
    }
    for (const side of [-1, 1]) {
      const pad = this.mesh(new THREE.BoxGeometry(.08, .22, .16), rubber, 0, 0, 0); pad.name = `pod-maintenance-pad-${side}`;
      const links = Array.from({ length: 3 }, (_, i) => {
        const link = this.mesh(new THREE.CylinderGeometry(.065, .065, 1, 10), this.steel, 0, 0, 0); link.name = `pod-maintenance-link-${side}-${i}`; return link;
      });
      const hinges = Array.from({ length: 2 }, (_, i) => {
        const hinge = this.mesh(new THREE.SphereGeometry(.11, 10, 6), this.dark, 0, 0, 0); hinge.name = `pod-maintenance-hinge-${side}-${i}`; return hinge;
      });
      this.clamps.push({ side, pad, links, hinges });
    }
    for (let i = 0; i < 3; i++) this.arm.push(this.mesh(new THREE.CylinderGeometry(.16, .16, 1, 12), this.steel, 0, 0, 0));
    this.root.add(this.claw); this.claw.name = 'pod-rescue-claw';
    this.clawHousing = this.mesh(new THREE.CylinderGeometry(.43, .56, .58, 16), this.steel, 0, .4, 0, this.claw);
    this.clawCollar = this.mesh(new THREE.TorusGeometry(.42, .04, 8, 24), this.steel, 0, .08, 0, this.claw);
    this.clawCollar.rotation.x = Math.PI / 2;
    // Pad inner faces rest on the shipped Neo chest surface, below the armpits.
    for (const [side, x, z, angle] of [['L', .367, 0, -Math.PI / 2], ['R', -.367, 0, Math.PI / 2], ['back', 0, -.107, 0]] as const) {
      const pad = this.mesh(new THREE.BoxGeometry(.28, .34, .12), rubber, 0, 0, 0, this.claw); pad.name = `pod-rescue-pad-${side}`;
      const links = Array.from({ length: 3 }, () => this.mesh(new THREE.CylinderGeometry(.075, .075, 1, 8), this.steel, 0, 0, 0, this.claw));
      links.forEach((link, i) => { link.name = `pod-rescue-link-${side}-${i}`; });
      const hinges = Array.from({ length: 2 }, () => this.mesh(new THREE.SphereGeometry(.115, 10, 6), this.dark, 0, 0, 0, this.claw));
      this.grippers.push({ pad, links, hinges, offset: new THREE.Vector3(x, -.15, z), angle });
    }
    this.cable = this.mesh(new THREE.CylinderGeometry(.07, .07, 1, 8), this.steel, 0, 0, 12);
    this.scan = new THREE.SpotLight(0xc3e6ef, 2300, 70, .52, .7, 2); this.scan.position.set(0, 10, 12); this.scan.target.position.set(0, -18, 12); this.root.add(this.scan, this.scan.target);
    this.rescueBay();
    const tankLight = new THREE.PointLight(0xb14a54, 150, 22, 2); tankLight.position.set(-3, 5, -12); this.root.add(tankLight);
    const fluidLight = new THREE.PointLight(0xb13c4c, 100, 9, 2); fluidLight.position.set(0, 1.7, -12); this.root.add(fluidLight);
    const awakeningLight = new THREE.PointLight(0xb3ccda, 250, 16, 2); awakeningLight.position.set(1, 6, -8); this.root.add(awakeningLight);
    const rimLight = new THREE.PointLight(0x8bb8ce, 180, 30, 2); rimLight.position.set(4, 10, -21); this.root.add(rimLight);
    const bankLight = new THREE.PointLight(0xadc9d2, 250, 28, 2); bankLight.position.set(-18, 17, -27); this.root.add(bankLight);
    const waterBankLight = new THREE.PointLight(0x8eb4c5, 400, 42, 2); waterBankLight.position.set(25, 18, 12); this.root.add(waterBankLight);
    const mistGeometry = new THREE.BufferGeometry(); const particles: number[] = [];
    for (let i = 0; i < 180; i++) particles.push(Math.sin(i * 7.23) * 30, -16 + Math.sin(i * 3.12) * 3, 12 + Math.cos(i * 9.14) * 40);
    mistGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3)); this.geometries.add(mistGeometry);
    const mistMaterial = new THREE.PointsMaterial({ color: 0x91a1a2, size: .09, transparent: true, opacity: .25, depthWrite: false }); this.materials.add(mistMaterial);
    this.mist = new THREE.Points(mistGeometry, mistMaterial); this.root.add(this.mist);
    const movable = new Set([this.liquid, this.neckTube, this.needle, this.clawHousing, this.clawCollar, this.cable, this.ripple, ...this.arm,
      ...this.grippers.flatMap(gripper => [gripper.pad, ...gripper.links, ...gripper.hinges])]);
    batchStaticGeometry(this.root, movable).forEach(geometry => this.geometries.add(geometry));
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private tube(points: number[][], radius: number, material: THREE.Material, parent = this.root): THREE.Mesh<THREE.TubeGeometry> {
    return this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 24, radius, 8, false), material, 0, 0, 0, parent) as THREE.Mesh<THREE.TubeGeometry>;
  }
  private bend(mesh: THREE.Mesh<THREE.TubeGeometry>, points: THREE.Vector3[]): void {
    const geometry = mesh.geometry, { tubularSegments, radialSegments, radius } = geometry.parameters;
    const path = geometry.parameters.path as THREE.CatmullRomCurve3;
    if (points.every((point, i) => path.points[i].distanceToSquared(point) < 1e-12)) return;
    points.forEach((point, i) => path.points[i].copy(point)); path.updateArcLengths();
    const frames = path.computeFrenetFrames(tubularSegments, false);
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), center = new THREE.Vector3(), direction = new THREE.Vector3();
    for (let i = 0; i <= tubularSegments; i++) {
      path.getPointAt(i / tubularSegments, center);
      for (let j = 0; j <= radialSegments; j++) {
        const angle = j / radialSegments * Math.PI * 2, index = i * (radialSegments + 1) + j;
        direction.copy(frames.normals[i]).multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle)).normalize();
        normal.setXYZ(index, direction.x, direction.y, direction.z);
        position.setXYZ(index, center.x + direction.x * radius, center.y + direction.y * radius, center.z + direction.z * radius);
      }
    }
    position.needsUpdate = normal.needsUpdate = true; geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  }
  private rescueBay(): void {
    const bay = new THREE.Group(); bay.name = 'pod-rescue-bay'; this.root.add(bay);
    const deck = this.mat(0x525b58, .78, .45), hull = this.mat(0x283333, .66, .62), trim = this.mat(0x777a69, .57, .55);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xd2dfbc, toneMapped: false }); this.materials.add(lamp);
    const warning = this.mat(0x92784a, .78, .25);
    const half = POD_RESCUE.hatch.half, z = POD_RESCUE.hatch.z;
    // Four separate slabs leave an actual passage, not a hole painted on a floor.
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(10 - half, .55, 20), deck, side * (10 + half) / 2, -.275, z, bay);
      this.mesh(new THREE.BoxGeometry(half * 2, .55, 10 - half), deck, 0, -.275, z + side * (10 + half) / 2, bay);
      const edge = this.mesh(new THREE.BoxGeometry(1.8, 1.25, 22), hull, side * 10.1, -.45, z, bay); edge.rotation.z = side * -.28;
      this.mesh(new THREE.BoxGeometry(.35, 9.1, 20), hull, side * 10.6, 4.35, z, bay);
      this.mesh(new THREE.BoxGeometry(21.5, 9.1, .35), hull, 0, 4.35, z + side * 10, bay);
      if (side < 0) for (const rail of [-1, 1]) this.mesh(new THREE.BoxGeometry(12.6, .15, .2), trim, 0, -.55, z + rail * (half + .17), bay);
      const hatch = new THREE.Group(); hatch.name = `pod-hatch-${side}`; hatch.position.set(side * (half / 2 + 3), 0, z); bay.add(hatch); this.hatches.push(hatch);
      this.mesh(new THREE.BoxGeometry(half, .3, half * 2), hull, 0, -.15, 0, hatch);
      for (let rib = -2; rib <= 2; rib++) this.mesh(new THREE.BoxGeometry(half - .08, .055, .13), trim, 0, -.335, rib, hatch);
      for (let i = -3; i <= 3; i++) {
        this.mesh(new THREE.BoxGeometry(.1, .04, 1.6), trim, side * (half + .6), .03, z + i * 2.5, bay);
        const mark = this.mesh(new THREE.BoxGeometry(.3, .025, .55), warning, side * (half + .3), .02, z + i * .65, bay); mark.rotation.y = side * -.45;
      }
      this.tube([[side * 9.8, .4, z - 9.5], [side * 9.8, 6.2, z - 9.5], [side * 6, 7.6, z - 9.5], [0, 7.6, z - 9.5]], .13, trim, bay);
      for (const dz of [-6, 0, 6]) {
        this.tube([[side * 10.1, .3, z + dz], [side * 10.1, 6.5, z + dz], [side * 7.2, 8.6, z + dz], [0, 8.6, z + dz]], .18, this.steel, bay);
        this.mesh(new THREE.BoxGeometry(2.3, .12, .45), lamp, side * 5.2, 8.2, z + dz, bay);
      }
      this.tube([[side * 8.8, 1.4, z - 9], [side * 8.8, 1.4, z + 9]], .13, this.dark, bay);
      this.tube([[side * 8.8, 1.75, z - 9], [side * 8.8, 1.75, z + 9]], .07, trim, bay);
      const hover = this.mesh(new THREE.TorusGeometry(1.3, .28, 10, 24), hull, side * 10.8, -.9, z + side * 5, bay); hover.rotation.x = Math.PI / 2;
      const coil = this.mesh(new THREE.TorusGeometry(1.15, .07, 6, 24), lamp, side * 10.8, -1.06, z + side * 5, bay); coil.rotation.x = Math.PI / 2;
    }
    this.mesh(new THREE.BoxGeometry(21, .4, 20), hull, 0, 9, z, bay);
    this.mesh(new THREE.BoxGeometry(.4, .55, 18), this.steel, 0, 8.55, z, bay);
    const drum = this.mesh(new THREE.CylinderGeometry(.48, .48, 1.1, 20), this.dark, 0, 8.1, z, bay); drum.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(.16, 1.15, 1.4), trim, side * .68, 8.1, z, bay);
      const light = new THREE.PointLight(0xc7d5b4, 100, 22, 2); light.position.set(side * 5, 6.8, z - 1); bay.add(light);
    }
  }
  private podShell(segments: number): THREE.SphereGeometry {
    const geometry = new THREE.SphereGeometry(1, segments, segments / 2, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    this.taperPod(geometry); return geometry;
  }
  private taperPod(geometry: THREE.BufferGeometry): void {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * (.84 - .16 * position.getZ(i)));
    geometry.computeVertexNormals();
  }
  private podRim(segments: number): THREE.TorusGeometry {
    const geometry = new THREE.TorusGeometry(1, .055, 6, segments); geometry.rotateX(Math.PI / 2);
    this.taperPod(geometry); return geometry;
  }
  private podFluid(segments: number): THREE.CircleGeometry {
    const geometry = new THREE.CircleGeometry(.97, segments); geometry.rotateX(-Math.PI / 2); geometry.translate(0, -.12, 0);
    this.taperPod(geometry); return geometry;
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], parent = this.root): void {
    this.geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.computeBoundingSphere(); parent.add(mesh);
  }
  private nearBank(): void {
    const bank = new THREE.Group(); this.root.add(bank);
    const wall = this.mat(0x1b282d, .75, .18); wall.emissive.setHex(0x24353d); wall.emissiveIntensity = .25;
    const support = this.mat(0x44545a, .56, .34); support.emissive.setHex(0x223139); support.emissiveIntensity = .3;
    this.mesh(new THREE.BoxGeometry(25, 52, .7), wall, -16, 13, -35, bank);
    for (const x of [-26, -18, -10, -2]) {
      this.mesh(new THREE.BoxGeometry(.8, 54, 1.4), support, x, 13, -33.7, bank);
      for (const y of [1, 7, 13, 19, 25]) this.mesh(new THREE.BoxGeometry(7.5, .25, 1), support, x + 4, y, -33.2, bank);
    }
    // Feed lines run behind the cantilevered basins, rather than empty wall panels.
    for (const x of [-26, -24.8, -20.4, -19.6, -13.6, -12.4, -6.6, -5.8]) {
      this.tube([[x, -12, -33.2], [x + .35, 3, -33.3], [x, 20, -33.2], [x - .3, 38, -33.5]], .18, this.dark, bank);
      for (let y = -10; y < 36; y += 2.4) {
        const joint = this.mesh(new THREE.TorusGeometry(.19, .045, 5, 10), support, x, y, -33.2, bank); joint.rotation.x = Math.PI / 2;
      }
    }
    const shell = this.mat(0x362a2b, .36, .23); shell.side = THREE.DoubleSide;
    shell.emissive.setHex(0x7b2635); shell.emissiveIntensity = .2;
    const gel = new THREE.MeshPhysicalMaterial({ color: 0x53212c, roughness: .27, metalness: .08, clearcoat: 1,
      emissive: 0x922639, emissiveIntensity: .3, transparent: true, opacity: .66, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(gel);
    const rim = this.mat(0x322d30, .43, .35); rim.emissive.setHex(0x25333b); rim.emissiveIntensity = .18;
    const matrices: THREE.Matrix4[] = []; const dummy = new THREE.Object3D();
    for (const x of [-23, -16, -9]) for (const y of [4, 9, 14, 19]) {
      dummy.position.set(x, y, -29.6); dummy.scale.set(1.85, 1.13, 3.7); dummy.updateMatrix(); matrices.push(dummy.matrix.clone());
      this.mesh(new THREE.BoxGeometry(1, .3, 6.2), support, x, y - 1.35, -30.8, bank);
      this.mesh(new THREE.BoxGeometry(3.8, 1.9, .35), support, x, y - .5, -33.5, bank);
      for (const side of [-1, 1]) {
        this.tube([[x + side * 1.4, y - .25, -30.7], [x + side * 2.2, y - .9, -31.5],
          [x + side * 2.3, y + .9, -32.9], [x + side * 2.6, y + 1.2, -33.5]], .13, this.dark, bank);
        this.tube([[x + side * .8, y - 1.15, -28], [x + side * 1, y - 2.2, -30.8], [x + side * 1.4, y - 2.3, -33.5]], .1, support, bank);
      }
    }
    this.instances(this.podShell(24), shell, matrices, bank);
    this.instances(this.podRim(40), rim, matrices, bank);
    this.instances(this.podFluid(40), gel, matrices, bank);
    // A submerged low-detail body gives the neighboring basins a human scale.
    const occupant = new THREE.Group(); const skin = this.mat(0x6b5353, .55);
    const body = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
      this.mesh(new THREE.SphereGeometry(1, 12, 8), skin, x, y, z, occupant).scale.set(sx, sy, sz);
    body(0, -.13, -.58, .12, .18, .125); body(0, -.2, -.42, .07, .08, .05);
    body(0, -.21, -.18, .23, .16, .24); body(0, -.23, .1, .19, .13, .13);
    for (const side of [-1, 1]) {
      body(side * .26, -.22, -.11, .055, .065, .23);
      body(side * .095, -.23, .43, .075, .075, .245);
      body(side * .095, -.2, .7, .065, .105, .09);
    }
    const bodies = batchStaticGeometry(occupant, new Set())[0]; this.instances(bodies, skin, matrices, bank);
    const ribs = new THREE.Group();
    for (const z of [-.65, 0, .6]) {
      const crossSection = Math.sqrt(1 - z * z); const points: number[][] = [];
      for (let i = 0; i <= 12; i++) {
        const a = i / 12 * Math.PI;
        points.push([Math.cos(a) * crossSection * (.84 - .16 * z), -Math.sin(a) * crossSection, z]);
      }
      this.tube(points, .04, support, ribs);
    }
    const ribGeometry = batchStaticGeometry(ribs, new Set())[0]; this.instances(ribGeometry, support, matrices, bank);
    batchStaticGeometry(bank, new Set()).forEach(geometry => this.geometries.add(geometry));
    const waterBank = bank.clone(true); waterBank.rotation.y = -Math.PI / 2;
    waterBank.position.set(0, 12, 25); this.root.add(waterBank);
  }
  private towers(pink: THREE.MeshStandardMaterial): void {
    const towers: THREE.Matrix4[] = []; const pods: THREE.Matrix4[] = []; const lights: THREE.Matrix4[] = [];
    const conduits: THREE.Matrix4[] = []; const bands: THREE.Matrix4[] = []; const dummy = new THREE.Object3D();
    pink.side = THREE.DoubleSide;
    for (let ring = 0; ring < 3; ring++) for (let tower = 0; tower < 8 + ring * 4; tower++) {
      const angle = tower / (8 + ring * 4) * Math.PI * 2 + ring * .31; const radius = 42 + ring * 49;
      const x = Math.sin(angle) * radius; const z = -14 + Math.cos(angle) * radius;
      dummy.position.set(x, 29, z); dummy.scale.set(4, 150 + ring * 20, 4); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); towers.push(dummy.matrix.clone());
      for (let side = 0; side < 8; side++) {
        const a = side * Math.PI / 4;
        dummy.position.set(x + Math.sin(a) * 4.1, 29, z + Math.cos(a) * 4.1); dummy.scale.set(.16, 150 + ring * 20, .16); dummy.updateMatrix(); conduits.push(dummy.matrix.clone());
      }
      for (let level = 0; level < 20; level++) for (let side = 0; side < 4; side++) {
        const a = side * Math.PI / 2 + level % 2 * .22; const y = -35 + level * 8;
        if (side === 0) {
          dummy.position.set(x, y - 1.3, z); dummy.scale.set(4.2, .3, 4.2); dummy.rotation.y = 0; dummy.updateMatrix(); bands.push(dummy.matrix.clone());
        }
        dummy.position.set(x + Math.sin(a) * 6.2, y, z + Math.cos(a) * 6.2); dummy.scale.set(1.9, 1, 3.4); dummy.rotation.y = a; dummy.updateMatrix(); pods.push(dummy.matrix.clone());
        dummy.position.set(x + Math.sin(a) * 3.8, y + 1.5, z + Math.cos(a) * 3.8); dummy.scale.set(.16, .15, .16); dummy.updateMatrix(); lights.push(dummy.matrix.clone());
      }
    }
    const glow = new THREE.MeshBasicMaterial({ color: 0xbb4137 }); this.materials.add(glow);
    this.instances(new THREE.CylinderGeometry(1, 1.12, 1, 12), this.dark, towers);
    this.instances(new THREE.CylinderGeometry(1, 1, 1, 6), this.steel, conduits);
    this.instances(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), this.steel, bands);
    this.instances(this.podShell(12), pink, pods);
    this.instances(this.podRim(16), this.dark, pods);
    this.instances(this.podFluid(16), pink, pods);
    this.instances(new THREE.SphereGeometry(1, 6, 4), glow, lights);
  }
  private link(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.scale.y = from.distanceTo(to); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  update(journey: FilmJourney | undefined, elapsed: number, firstPerson = false, subject?: THREE.Object3D): void {
    const beat = journey?.visiting ? undefined : journey?.awakening;
    const disconnect = beat?.kind === 'disconnect' ? beat.elapsed : beat?.kind === 'rescue' ? 9 : 0;
    const clock = beat ? (beat.kind === 'rescue' ? 9 : 0) + beat.elapsed : journey?.scene === 'm1_pod' ? 0 : elapsed;
    this.root.updateWorldMatrix(true, false); subject?.updateWorldMatrix(true, true);
    this.robot.position.y = 10 - Math.min(1, disconnect / 2) * 1.2 + Math.max(0, disconnect - 4) * 1.5;
    const socket = subject?.getObjectByName('cervical-interface');
    this.neckFrame.position.copy(socket ? this.root.worldToLocal(socket.localToWorld(new THREE.Vector3(0, 0, .025))) : new THREE.Vector3(0, 1.94, -14.78));
    this.neckFrame.quaternion.copy(socket ? this.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(socket.getWorldQuaternion(new THREE.Quaternion()))
      : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.neckFrame.quaternion);
    const withdraw = .95 * THREE.MathUtils.smoothstep(disconnect, 2.75, 3.55), retract = THREE.MathUtils.smoothstep(disconnect, 3.55, 3.92);
    const start = new THREE.Vector3(0, 1.7, -16.3);
    const end = this.neckFrame.position.clone().addScaledVector(axis, withdraw).lerp(start.clone().add(new THREE.Vector3(0, -.35, .1)), retract);
    this.neckPlug.position.copy(end).sub(this.neckFrame.position).applyQuaternion(this.neckFrame.quaternion.clone().invert());
    this.neckFrame.visible = disconnect < 4;
    this.rotor.position.copy(this.neckPlug.position); this.rotor.rotation.z = THREE.MathUtils.smoothstep(disconnect, 2.05, 2.75) * Math.PI * 1.25;
    const exposed = Math.min(.7, withdraw);
    this.needle.visible = exposed > .001 && retract < .5; this.needle.scale.y = exposed; this.needle.position.z = -exposed / 2;
    if (disconnect < 4) this.bend(this.neckTube, [start, new THREE.Vector3(0, 1.25, -15.9), end.clone().addScaledVector(axis, .45 * (1 - retract)), end]);
    const grip = THREE.MathUtils.smoothstep(disconnect, .8, 1.8) * (1 - retract);
    const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(this.neckFrame.quaternion);
    this.clamps.forEach(clamp => {
      const tip = new THREE.Vector3(clamp.side * (.224 + .7 * (1 - grip)), 0, .055).applyQuaternion(this.neckFrame.quaternion).add(end);
      const nodes = [this.robot.position.clone().addScaledVector(lateral, clamp.side * .9).add(new THREE.Vector3(0, -.1, 0)),
        this.robot.position.clone().addScaledVector(lateral, clamp.side * 1.55).add(new THREE.Vector3(0, -2.8, -2.2)),
        tip.clone().add(new THREE.Vector3(clamp.side * .4, 0, .8).applyQuaternion(this.neckFrame.quaternion)), tip];
      clamp.pad.visible = disconnect < 4;
      clamp.pad.position.copy(tip); clamp.pad.quaternion.copy(this.neckFrame.quaternion);
      clamp.links.forEach((link, i) => { link.visible = disconnect < 4; this.link(link, nodes[i], nodes[i + 1]); });
      clamp.hinges.forEach((hinge, i) => { hinge.visible = disconnect < 4; hinge.position.copy(nodes[i + 1]); });
    });
    const thoracic = subject?.getObjectByName('thoracic-interfaces');
    this.feeds.forEach((feed, i) => {
      const port = thoracic?.children[i * 2 + 1];
      const outward = port ? new THREE.Vector3(0, 1, 0).applyQuaternion(port.getWorldQuaternion(new THREE.Quaternion()))
        .applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()).invert()) : new THREE.Vector3(0, 1, 0);
      const contact = port ? this.root.worldToLocal(port.localToWorld(new THREE.Vector3(0, .0225, 0))) : new THREE.Vector3(i % 2 ? .36 : -.36, 2.06, feed.start.z);
      const side = Math.sign(contact.x) || (i % 2 ? 1 : -1), start = feed.start.clone().setX(side * 1.5);
      const release = THREE.MathUtils.smoothstep(disconnect, 3.05 + i * .16, 3.3 + i * .16);
      const end = contact.addScaledVector(outward, .12 + release * .3).lerp(start.clone().add(new THREE.Vector3(-side * .05, -.45, 0)), release);
      feed.plug.position.copy(end).addScaledVector(outward, -.06); feed.plug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
      if (disconnect < 4) this.bend(feed.mesh, [start, start.clone().add(new THREE.Vector3(-side * .05, -.4, 1.7)), end.clone().addScaledVector(outward, .6 * (1 - release)), end]);
    });
    this.connections.visible = disconnect < 4;
    this.neckTube.visible = !firstPerson;
    this.liquid.visible = disconnect < 5; this.liquid.position.y = 1.9 - Math.max(0, disconnect - 4) * 2 + Math.sin(clock * 1.6) * .018;
    const nodes = [new THREE.Vector3(0, 17, -23), new THREE.Vector3(3, 14, -20), new THREE.Vector3(0, 13, -16), this.robot.position];
    this.arm.forEach((link, i) => this.link(link, nodes[i], nodes[i + 1]));
    const rescuing = beat?.kind === 'rescue'; const pose = awakeningPose(rescuing ? beat : { kind: 'disconnect', elapsed: 9 });
    const rescue = podRescuePose(rescuing ? beat.elapsed : 0);
    this.claw.visible = disconnect >= 7 || rescuing;
    this.clawHousing.visible = this.clawCollar.visible = !firstPerson || !rescuing;
    this.root.updateWorldMatrix(true, false); subject?.updateWorldMatrix(true, true);
    const chest = this.claw.visible ? subject?.getObjectByName('chest') : undefined;
    const center = chest ? this.root.worldToLocal(chest.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(0, pose.y + 3.26, 12.126);
    this.claw.position.copy(center).add(new THREE.Vector3(0, 2.6 + 5 * (1 - rescue.descend) + rescue.release * 2.2 + rescue.settle * 1.1, 0));
    this.hatches.forEach((hatch, i) => { hatch.position.x = (i ? 1 : -1) * (POD_RESCUE.hatch.half / 2 + 3 * (1 - rescue.hatch)); });
    this.grippers.forEach(gripper => {
      const radial = new THREE.Vector3(Math.sin(gripper.angle), 0, Math.cos(gripper.angle));
      const contact = chest ? this.root.worldToLocal(chest.localToWorld(gripper.offset.clone())).sub(this.claw.position)
        : gripper.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).add(center).sub(this.claw.position);
      const tip = radial.clone().multiplyScalar(1.4).setY(-2.6).lerp(contact, rescue.grip * (1 - rescue.release));
      const nodes = [radial.clone().multiplyScalar(.5), radial.clone().multiplyScalar(1.3).setY(-.95),
        radial.clone().multiplyScalar(1.3).setY(-2.45), tip];
      gripper.links.forEach((link, i) => this.link(link, nodes[i], nodes[i + 1]));
      gripper.hinges.forEach((hinge, i) => hinge.position.copy(nodes[i + 1]));
      gripper.pad.position.copy(tip); gripper.pad.rotation.y = gripper.angle;
    });
    this.cable.visible = this.claw.visible; this.link(this.cable, new THREE.Vector3(0, 8.1, 12), this.claw.position);
    this.scan.target.position.copy(center);
    this.scan.intensity = this.claw.visible ? 2300 * (1 - rescue.board) : 0;
    const rippleSize = 1 + clock % 2.8 * 1.6; this.ripple.visible = disconnect >= 7 || rescuing;
    this.ripple.scale.setScalar(rippleSize); (this.ripple.material as THREE.MeshBasicMaterial).opacity = .3 * (1 - clock % 2.8 / 2.8);
    this.mist.position.x = Math.sin(clock * .13) * 2;
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.InstancedMesh || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
  }
}
