import * as THREE from 'three';
import { POD_WATER_DROP, awakeningPose, type FilmJourney } from '@auto_matrix/shared';

/** A single awakening set: the foreground tank, drain and rescue share story coordinates. */
export class PodSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private robot = new THREE.Group();
  private claw = new THREE.Group();
  private connections = new THREE.Group();
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
    this.steel = this.mat(0x3e494d, .38, .84); this.dark = this.mat(0x131b1d, .57, .55);
    const rubber = this.mat(0x1c181c, .72); const pink = this.mat(0x59212b, .24, .25); pink.emissive.setHex(0x541723); pink.emissiveIntensity = .25;
    const wet = new THREE.MeshPhysicalMaterial({ color: 0x732830, roughness: .14, metalness: .22, clearcoat: 1, side: THREE.DoubleSide }); this.materials.add(wet);
    this.mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), wet, 0, 2.1, -12).scale.set(2.8, 2.7, 5.4);
    const rim = this.mesh(new THREE.TorusGeometry(1, .045, 10, 64), this.steel, 0, 2.1, -12); rim.rotation.x = Math.PI / 2; rim.scale.set(2.85, 5.45, 1);
    this.liquid = this.mesh(new THREE.CircleGeometry(1, 64), wet, 0, 1.9, -12); this.liquid.rotation.x = -Math.PI / 2; this.liquid.scale.set(2.6, 5.15, 1);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const brace = this.mesh(new THREE.BoxGeometry(.2, 2.2, .3), this.steel, Math.sin(a) * 2.9, 1.15, -12 + Math.cos(a) * 5.5); brace.rotation.z = -Math.sin(a) * .3;
      this.mesh(new THREE.SphereGeometry(.1, 8, 6), this.steel, Math.sin(a) * 2.86, 2.15, -12 + Math.cos(a) * 5.46);
    }
    this.root.add(this.connections);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1; const z = -14 + Math.floor(i / 2) * 1.6;
      this.tube([[side * 2.6, 1.7, z], [side * 2.1, 2.9, z - 1], [side * .8, 3.8 - i * .24, -12.1]], .095, rubber, this.connections);
    }
    this.tube([[0, 1.8, -17.5], [0, 4, -17], [0, 5.25, -13.5], [0, 4.9, -12.3]], .2, rubber, this.connections);
    this.towers(pink);
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
    this.mesh(new THREE.SphereGeometry(1, 20, 12), this.dark, 0, 0, 0, this.robot).scale.set(1.4, .8, 1.65);
    const red = this.mat(0xeb6a51, .2, .3); red.emissive.setHex(0xff4422); red.emissiveIntensity = 2.5;
    for (const x of [-.6, 0, .6]) this.mesh(new THREE.SphereGeometry(.18, 12, 8), red, x, -.42, 1.35, this.robot);
    for (const side of [-1, 1]) {
      this.tube([[side * 1.1, 0, 0], [side * 2.6, -1.2, .7], [side * 1.8, -3.5, 1.5], [side * .55, -4.2, 1.8]], .11, this.steel, this.robot);
      for (let i = 0; i < 3; i++) this.tube([[side * .55, -4.2, 1.65 + i * .2], [side * .25, -4.45, 1.65 + i * .2]], .05, this.steel, this.robot);
    }
    for (let i = 0; i < 3; i++) this.arm.push(this.mesh(new THREE.CylinderGeometry(.16, .16, 1, 12), this.steel, 0, 0, 0));
    this.root.add(this.claw);
    this.mesh(new THREE.CylinderGeometry(.6, .9, 1, 16), this.steel, 0, .4, 0, this.claw);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      this.tube([[Math.sin(a) * .6, 0, Math.cos(a) * .6], [Math.sin(a) * 1.7, -1.3, Math.cos(a) * 1.7], [Math.sin(a) * .8, -3, Math.cos(a) * .8]], .14, this.steel, this.claw);
    }
    this.cable = this.mesh(new THREE.CylinderGeometry(.07, .07, 1, 8), this.steel, 0, 0, 12);
    this.scan = new THREE.SpotLight(0xc3e6ef, 2300, 70, .52, .7, 2); this.scan.position.set(0, 10, 12); this.scan.target.position.set(0, -18, 12); this.root.add(this.scan, this.scan.target);
    const tankLight = new THREE.PointLight(0xb76b62, 170, 22, 2); tankLight.position.set(-3, 6, -12); this.root.add(tankLight);
    const rimLight = new THREE.PointLight(0x8bb8ce, 220, 30, 2); rimLight.position.set(4, 10, -21); this.root.add(rimLight);
    const mistGeometry = new THREE.BufferGeometry(); const particles: number[] = [];
    for (let i = 0; i < 180; i++) particles.push(Math.sin(i * 7.23) * 30, -16 + Math.sin(i * 3.12) * 3, 12 + Math.cos(i * 9.14) * 40);
    mistGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3)); this.geometries.add(mistGeometry);
    const mistMaterial = new THREE.PointsMaterial({ color: 0x91a1a2, size: .09, transparent: true, opacity: .25, depthWrite: false }); this.materials.add(mistMaterial);
    this.mist = new THREE.Points(mistGeometry, mistMaterial); this.root.add(this.mist);
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private tube(points: number[][], radius: number, material: THREE.Material, parent = this.root): void {
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), 24, radius, 8, false), material, 0, 0, 0, parent);
  }
  private towers(pink: THREE.Material): void {
    const towers: THREE.Matrix4[] = []; const pods: THREE.Matrix4[] = []; const lights: THREE.Matrix4[] = []; const dummy = new THREE.Object3D();
    for (let ring = 0; ring < 3; ring++) for (let tower = 0; tower < 8 + ring * 4; tower++) {
      const angle = tower / (8 + ring * 4) * Math.PI * 2 + ring * .31; const radius = 42 + ring * 49;
      const x = Math.sin(angle) * radius; const z = -14 + Math.cos(angle) * radius;
      dummy.position.set(x, 29, z); dummy.scale.set(4, 150 + ring * 20, 4); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); towers.push(dummy.matrix.clone());
      for (let level = 0; level < 20; level++) for (let side = 0; side < 4; side++) {
        const a = side * Math.PI / 2 + level % 2 * .22; const y = -35 + level * 8;
        dummy.position.set(x + Math.sin(a) * 5, y, z + Math.cos(a) * 5); dummy.scale.set(1.9, 1, 3.4); dummy.rotation.y = a; dummy.updateMatrix(); pods.push(dummy.matrix.clone());
        dummy.position.set(x + Math.sin(a) * 3.8, y + 1.5, z + Math.cos(a) * 3.8); dummy.scale.set(.16, .15, .16); dummy.updateMatrix(); lights.push(dummy.matrix.clone());
      }
    }
    const glow = new THREE.MeshBasicMaterial({ color: 0xbb4137 }); this.materials.add(glow);
    for (const [geometry, material, matrices] of [[new THREE.CylinderGeometry(1, 1.12, 1, 12), this.dark, towers], [new THREE.SphereGeometry(1, 12, 8), pink, pods], [new THREE.SphereGeometry(1, 6, 4), glow, lights]] as const) {
      this.geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.computeBoundingSphere(); this.root.add(mesh);
    }
  }
  private link(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.scale.y = from.distanceTo(to); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  update(journey: FilmJourney | undefined, elapsed: number): void {
    const beat = journey?.visiting ? undefined : journey?.awakening;
    const disconnect = beat?.kind === 'disconnect' ? beat.elapsed : beat?.kind === 'rescue' ? 9 : 0;
    this.robot.position.y = 10 - Math.min(1, disconnect / 2) * 1.2 + Math.max(0, disconnect - 4) * 1.5;
    this.connections.visible = disconnect < 4; this.connections.scale.y = disconnect < 3 ? 1 : Math.max(.15, 1 - (disconnect - 3) * .85);
    this.liquid.visible = disconnect < 5; this.liquid.position.y = 1.9 - Math.max(0, disconnect - 4) * 2 + Math.sin(elapsed * 1.6) * .018;
    const nodes = [new THREE.Vector3(0, 17, -23), new THREE.Vector3(3, 14, -20), new THREE.Vector3(0, 13, -16), this.robot.position];
    this.arm.forEach((link, i) => this.link(link, nodes[i], nodes[i + 1]));
    const rescuing = beat?.kind === 'rescue'; const pose = awakeningPose(beat);
    this.claw.visible = disconnect >= 7 || rescuing;
    this.claw.position.set(0, rescuing ? pose.y + 5 : -POD_WATER_DROP + 5, 12);
    this.cable.visible = this.claw.visible; this.link(this.cable, new THREE.Vector3(0, 15, 12), this.claw.position);
    this.scan.intensity = this.claw.visible ? 2300 : 0;
    const rippleSize = 1 + elapsed % 2.8 * 1.6; this.ripple.visible = disconnect >= 7 || rescuing;
    this.ripple.scale.setScalar(rippleSize); (this.ripple.material as THREE.MeshBasicMaterial).opacity = .3 * (1 - elapsed % 2.8 / 2.8);
    this.mist.position.x = Math.sin(elapsed * .13) * 2;
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.InstancedMesh || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
  }
}
