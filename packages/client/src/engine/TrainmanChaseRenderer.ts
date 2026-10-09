import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TRAINMAN_CHASE, TRAINMAN_OBSTACLES, trainmanCarPose, trainmanPassingTrain, type TrainmanChase } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** One connected carriage, elevated ticket hall and opposite-platform escape. */
export class TrainmanChaseRenderer {
  readonly group = new THREE.Group();
  readonly car = new THREE.Group();
  readonly passing = new THREE.Group();
  readonly doors: THREE.Group[] = [];
  readonly handle = new THREE.Group();
  private fixed = new THREE.Group();
  private scenery = new THREE.Group();
  private shot: THREE.Mesh;
  private marks: THREE.Mesh[] = [];
  private headlight: THREE.PointLight;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(root: THREE.Group) {
    this.group.name = 'trainman-stellma-station'; this.car.name = 'trainman-carriage';
    this.passing.name = 'trainman-passing-train'; this.scenery.userData.dynamic = this.passing.userData.dynamic = true;
    this.group.add(this.fixed, this.car, this.scenery, this.passing); root.add(this.group);
    const cream = this.surface(0xd4d6c1, .24), green = this.surface(0x394b3b, .56), steel = this.surface(0x8e9890, .25, .78);
    const dark = this.surface(0x26302b, .76), floor = this.surface(0x707e70, .32), seat = this.surface(0x5d6851, .62);
    const enamel = this.surface(0xc2ccc2, .26, .18), black = this.surface(0x101916, .88), red = this.surface(0x643c30, .57);
    const glow = this.material(new THREE.MeshBasicMaterial({ color: 0xf0f5d8, toneMapped: false }));
    const glazed = this.surface(0xffffff, .26); glazed.map = this.tileTexture();
    this.platform(this.fixed, floor, -19.1, 21.75, 13, 55.5, 'trainman-platform-1');
    this.platform(this.fixed, floor, 17.4, -28.5, 13.2, 53, 'trainman-platform-2');
    this.platform(this.fixed, floor, 37, -28.5, 10, 53, 'trainman-opposite-platform');
    const tunnel = new THREE.Group(); tunnel.name = 'trainman-escape-tunnel'; this.fixed.add(tunnel);
    this.platform(tunnel, floor, 37, -62, 10, 18, 'trainman-escape-floor');
    for (const obstacle of TRAINMAN_OBSTACLES.filter(item => item.kind === 'wall' && item.x > 0)) {
      const { x, y, z, width, height, depth } = obstacle;
      this.box(tunnel, glazed, x, y + height / 2, z, width, height, depth);
    }
    this.box(tunnel, cream, 37.25, 9, -63, 10.5, .35, 16);
    this.platform(this.fixed, floor, 0, -21.5, 44, 11, 'trainman-ticket-hall', TRAINMAN_CHASE.upper);
    this.stairs(-17, floor, cream, steel, 'trainman-stairs-1'); this.stairs(17, floor, cream, steel, 'trainman-stairs-2');
    this.box(this.fixed, glazed, -12.35, 4.4, 21.75, .45, 8.8, 55.5);
    this.box(this.fixed, glazed, 10.55, 4.4, -28.5, .45, 8.8, 53);
    this.box(this.fixed, glazed, 42.25, 4.4, -28.5, .45, 8.8, 53);
    for (const [x, z, depth] of [[-12.61, 21.75, 55.5], [10.81, -28.5, 53], [42, -28.5, 53]]) {
      for (const y of [1.05, 4.45]) this.box(this.fixed, green, x, y, z, .035, .18, depth);
      this.box(this.fixed, green, x, .35, z, .07, .65, depth);
    }
    for (const [x, z, width, depth, y] of [[-19.1, 21.75, 13, 55.5, 9], [26.4, -28.5, 32, 53, 9], [0, -21.5, 44, 11, 11.7]])
      this.box(this.fixed, cream, x, y, z, width, .35, depth);
    for (const z of [-27.15, -15.85]) {
      this.box(this.fixed, glazed, 0, 8.6, z, 44.5, 6.8, .3);
      this.box(this.fixed, green, 0, 6.1, z + (z < -20 ? .2 : -.2), 44, .15, .025);
    }
    for (const obstacle of TRAINMAN_OBSTACLES.filter(item => item.kind === 'column')) {
      const { x, z, width, height, depth } = obstacle;
      const column = new THREE.Group(); column.name = 'trainman-fluted-column'; this.fixed.add(column);
      this.box(column, cream, x, height / 2, z, width, height, depth, .045);
      for (const side of [-1, 1]) for (let groove = -.5; groove <= .5; groove += .2) {
        this.box(column, green, x + side * .76, 4, z + groove, .018, 6.6, .032);
        this.box(column, green, x + groove, 4, z + side * .76, .032, 6.6, .018);
      }
      for (const y of [.3, 7.7]) this.box(column, green, x, y, z, 1.65, .6, 1.65, .035);
    }
    const gates = new THREE.Group(); gates.name = 'trainman-ticket-gates'; this.fixed.add(gates);
    for (const obstacle of TRAINMAN_OBSTACLES.filter(item => item.kind === 'gate')) {
      const { x, y, z, width, height, depth } = obstacle;
      this.box(gates, steel, x, y + height / 2, z, width, height, depth, .11);
      this.box(gates, dark, x, y + height + .018, z, width - .2, .035, depth - .24, .015);
      for (const side of [-1, 1]) this.box(gates, red, x + side * .55, y + 1.04, z, .25, .67, 1.65, .07);
      this.box(gates, green, -.67, y + 1.55, z + .9, .035, .16, .21, .025);
    }
    for (const x of [-22, 22]) for (const z of [-25.3, -23.5, -21.7, -19.9, -18.1]) {
      this.box(this.fixed, green, x, 8, z, .14, 5.5, .065);
      for (const y of [5.5, 10.2]) this.box(this.fixed, green, x, y, z, .14, .12, 1.8);
    }
    this.sign(this.fixed, 'PLATFORM 1  /  WAY OUT', -17, 8.5, -16.45, 7.2, .8, 0);
    this.sign(this.fixed, 'PLATFORM 2  →', 9, 10.35, -26.91, 7.5, .8, 0);
    this.sign(this.fixed, 'STELLMA', 10.85, 4.8, -37, 6.2, .85, Math.PI / 2);
    this.sign(this.fixed, 'STELLMA', -12.65, 4.8, 29, 6.2, .85, -Math.PI / 2);
    this.sign(this.fixed, 'A FRESH START', 10.83, 3.1, -15, 2.8, 3.8, Math.PI / 2, '#abada0');
    for (const [x, z, y] of [[-18, 27, 8.5], [-18, 2, 8.5], [0, -21.5, 11.2], [17, -18, 8.5], [17, -43, 8.5]]) {
      this.box(this.fixed, steel, x, y, z, 4.8, .25, .85, .04); this.box(this.fixed, glow, x, y - .15, z, 4.4, .055, .55);
      const lamp = new THREE.PointLight(0xe1e6c8, 65, 23, 2); lamp.position.set(x, y - .4, z); this.group.add(lamp);
    }
    this.platform(this.car, dark, -30, 28, 8.4, 36, 'trainman-car-floor');
    this.box(this.car, enamel, -30, 6.75, 28, 8.4, .25, 36, .1);
    const glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0xadb9ae, roughness: .13, metalness: .1, transparent: true, opacity: .27, depthWrite: false }));
    for (const obstacle of TRAINMAN_OBSTACLES.filter(item => item.kind === 'wall' && item.x < 0)) {
      const { x, z, width, depth } = obstacle;
      if (width > 1) {
        this.box(this.car, enamel, x, 3.35, z, width, 6.7, depth);
        this.box(this.car, dark, x, 3.2, z - .17, 2.3, 5.1, .04, .12);
        this.box(this.car, glass, x, 4.2, z - .2, 1.8, 1.8, .05, .075);
        for (const side of [-1, 1]) this.rail(this.car, steel, [x + side * 1.2, 1.3, z - .21], [x + side * 1.2, 5.4, z - .21]);
        continue;
      }
      this.box(this.car, enamel, x, 1.25, z, width, 2.5, depth);
      this.box(this.car, enamel, x, 6.05, z, width, 1.3, depth);
      for (let windowZ = z - depth / 2 + 1.8; windowZ < z + depth / 2 - .8; windowZ += 4.8) {
        this.box(this.car, glass, x, 4, windowZ, .06, 2.6, 3.7, .09);
        for (const dz of [-1.97, 1.97]) this.box(this.car, steel, x, 4, windowZ + dz, .19, 2.9, .12, .025);
        for (const y of [2.57, 5.43]) this.box(this.car, steel, x, y, windowZ, .19, .12, 4.05, .025);
      }
    }
    for (const obstacle of TRAINMAN_OBSTACLES.filter(item => item.kind === 'seat')) {
      const { x, z } = obstacle;
      this.box(this.car, steel, x, .58, z, 2, 1.16, 1.4, .05);
      this.box(this.car, seat, x, 1.25, z, 2.1, .3, 2.3, .11).name = 'trainman-car-seat';
      this.box(this.car, seat, x, 2.07, z - 1.14, 2.1, 1.4, .24, .1);
      this.rail(this.car, steel, [x - 1.04, 1.3, z - 1.15], [x - 1.04, 3.15, z - 1.15]);
      this.rail(this.car, steel, [x + 1.04, 1.3, z - 1.15], [x + 1.04, 3.15, z - 1.15]);
    }
    for (const x of [-31.3, -28.7]) {
      this.rail(this.car, steel, [x, 5.5, 11], [x, 5.5, 45]);
      for (const z of [18, 23, 29, 35, 41, 45]) this.rail(this.car, steel, [x, .08, z], [x, 6.6, z]);
    }
    for (const z of [15, 27, 39]) this.box(this.car, glow, -30, 6.54, z, 1.5, .05, 5.4);
    for (const side of [-1, 1]) {
      const door = new THREE.Group(); door.name = `trainman-car-door-${this.doors.length}`; this.car.add(door); this.doors.push(door);
      door.position.set(-25.8, 0, 20 + side * 1.1);
      this.box(door, enamel, 0, 3.15, 0, .2, 6.3, 2.2, .045);
      this.box(door, glass, -.12, 4.05, 0, .03, 2.35, 1.5, .08);
      this.box(door, steel, -.16, 2.1, -side * .74, .1, .62, .09, .025);
    }
    this.box(this.car, red, -25.96, 3.9, 20, .1, 1.05, .45, .045);
    this.handle.name = 'trainman-emergency-handle'; this.handle.position.set(TRAINMAN_CHASE.lever.x, TRAINMAN_CHASE.lever.y, TRAINMAN_CHASE.lever.z); this.car.add(this.handle);
    this.box(this.handle, steel, -.04, .23, 0, .17, .7, .11, .04);
    this.box(this.handle, red, -.14, 0, 0, .24, .1, .48, .04);
    this.sign(this.car, 'EMERGENCY  /  PULL', -25.98, 4.85, 20, 1.6, .36, -Math.PI / 2, '#ae3a30');
    const carLamp = new THREE.PointLight(0xe6eedc, 100, 28, 2); carLamp.position.set(-30, 5.9, 27); this.group.add(carLamp);
    for (let z = -30; z < 75; z += 12) {
      this.box(this.scenery, black, -35, 3.4, z, .2, 6.8, 11.5);
      this.box(this.scenery, glow, -34.85, 4.1, z, .05, .7, 1.2);
    }
    this.box(this.fixed, black, 28, -1.45, -18, 8, .25, 136);
    for (let z = -84; z < 50; z += 1.6) {
      this.box(this.fixed, dark, 28, -1.2, z, 6.5, .22, .3);
      for (const x of [26.3, 29.7]) this.box(this.fixed, steel, x, -1.01, z, .15, .21, 1.64);
    }
    for (const x of [24, 32]) this.box(this.fixed, cream, x, -.65, -28.5, .32, 1.3, 53);
    for (const z of [-59, 4]) {
      this.box(this.fixed, dark, 28, 7.4, z, 13, 3.5, .7);
      for (const x of [22.6, 33.4]) this.box(this.fixed, dark, x, 3.3, z, 2.2, 6.6, .7);
    }
    this.box(this.passing, enamel, 0, 2.6, 0, 7.1, 7.8, 60, .22);
    for (const x of [-3.6, 3.6]) for (let z = -25; z < 28; z += 5.4) {
      this.box(this.passing, black, x, 3.9, z, .06, 2.3, 3.6, .1);
      this.box(this.passing, steel, x, 1.05, z, .05, .18, 5.35);
    }
    this.box(this.passing, black, 0, 4.1, 30.2, 5.8, 2.3, .1, .15);
    for (const x of [-2.2, 2.2]) this.box(this.passing, glow, x, 1.2, 30.24, .62, .62, .08, .2);
    this.sign(this.passing, 'NOT IN SERVICE', 0, 6.1, 30.25, 3.8, .45);
    this.headlight = new THREE.PointLight(0xfff0c9, 0, 24, 2); this.headlight.position.set(0, 2.3, 32); this.passing.add(this.headlight);
    this.shot = this.mesh(this.group, this.own(new THREE.CylinderGeometry(.024, .024, 1, 6)),
      this.material(new THREE.MeshBasicMaterial({ color: 0xffd4a0, toneMapped: false })), 0, 0, 0); this.shot.name = 'trainman-shot'; this.shot.visible = false; this.shot.castShadow = false;
    for (let i = 0; i < 12; i++) {
      const mark = this.mesh(this.group, this.own(new THREE.SphereGeometry(.12, 8, 6)), dark, 0, 0, 0);
      mark.name = 'trainman-bullet-chip'; mark.visible = false; mark.castShadow = false; this.marks.push(mark);
    }
    for (const fixed of [this.fixed, this.car, this.scenery, this.passing]) batchStaticGeometry(fixed, new Set()).forEach(geometry => this.geometries.add(geometry));
    for (const name of ['trainman-stairs-1', 'trainman-stairs-2']) this.fixed.getObjectByName(name)!.traverse(object => {
      if (object instanceof THREE.Mesh && object.material === floor) object.userData.trainmanSupport = true;
    });
    this.update();
  }
  update(state?: TrainmanChase): void {
    const car = trainmanCarPose(state), passing = trainmanPassingTrain(state);
    this.doors.forEach((door, i) => { door.position.z = 20 + (i ? 1 : -1) * (1.1 + car.doors * 2.1); });
    this.handle.rotation.x = !state || state.phase === 'ready' ? 0 : state.phase === 'confronting' ? -Math.max(0, state.elapsed - 5.5) * 1.9 : -.95;
    this.scenery.position.z = car.speed ? -((state?.age ?? 0) * 12 % 12) : 0;
    this.passing.visible = passing.visible; this.passing.position.set(28, 0, passing.z); this.headlight.intensity = passing.headlight * 230;
    this.shot.visible = Boolean(state?.shot && state.shot.age < .085);
    if (state?.shot) {
      const center = this.group.getWorldPosition(new THREE.Vector3()), from = new THREE.Vector3(state.shot.from.x, state.shot.from.y, state.shot.from.z).sub(center);
      const to = new THREE.Vector3(state.shot.to.x, state.shot.to.y, state.shot.to.z).sub(center), direction = to.clone().sub(from);
      this.shot.position.copy(from.clone().lerp(to, .5)); this.shot.scale.y = direction.length();
      this.shot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
    this.marks.forEach((mark, i) => { const impact = state?.impacts[i]; mark.visible = Boolean(impact); if (impact) mark.position.set(impact.x, impact.y + 1, impact.z); });
  }
  private stairs(x: number, floor: THREE.Material, cream: THREE.Material, steel: THREE.Material, name: string): void {
    const stairs = new THREE.Group(); stairs.name = name; this.fixed.add(stairs);
    const depth = TRAINMAN_CHASE.stairLength / TRAINMAN_CHASE.stairCount;
    for (let i = 0; i < TRAINMAN_CHASE.stairCount; i++) {
      const y = (i + 1) * TRAINMAN_CHASE.upper / TRAINMAN_CHASE.stairCount, z = -4 - (i + .5) * depth;
      const step = this.box(stairs, floor, x, y / 2, z, 7.2, y, depth); step.userData.trainmanSupport = true;
      this.box(stairs, cream, x, y - .04, z + depth / 2 - .035, 7.2, .07, .065);
    }
    for (const side of [-1, 1]) {
      this.rail(stairs, steel, [x + side * 3.45, 2.05, -4], [x + side * 3.45, 7.25, -16]);
      for (let z = -5; z >= -15; z -= 2) this.rail(stairs, steel, [x + side * 3.45, (-z - 4) / 12 * 5.2, z], [x + side * 3.45, (-z - 4) / 12 * 5.2 + 2.05, z]);
    }
  }
  private platform(parent: THREE.Group, material: THREE.Material, x: number, z: number, width: number, depth: number, name: string, height = 0): void {
    const floor = this.box(parent, material, x, height - .16, z, width, .32, depth); floor.name = name; floor.userData.trainmanSupport = true;
  }
  private tileTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const context = canvas.getContext('2d')!;
    context.fillStyle = '#d4d6c1'; context.fillRect(0, 0, 512, 512); context.strokeStyle = '#879380'; context.lineWidth = 3;
    for (let x = 0; x < 512; x += 128) for (let y = 0; y < 512; y += 64) context.strokeRect(x, y, 128, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(.8, 1.1); map.anisotropy = 8; this.textures.add(map); return map;
  }
  private sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, yaw = 0, background = '#273e30'): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256; const context = canvas.getContext('2d')!;
    context.fillStyle = background; context.fillRect(0, 0, 1024, 256); context.fillStyle = '#e0e3cb'; context.font = '54px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 128);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const sign = this.mesh(parent, this.own(new THREE.PlaneGeometry(width, height)), this.material(new THREE.MeshBasicMaterial({ map })), x, y, z); sign.rotation.y = yaw; sign.castShadow = false;
  }
  private rail(parent: THREE.Object3D, material: THREE.Material, a: number[], b: number[]): void {
    const from = new THREE.Vector3(...a as [number, number, number]), to = new THREE.Vector3(...b as [number, number, number]), direction = to.clone().sub(from);
    const rail = this.mesh(parent, this.own(new THREE.CylinderGeometry(.055, .055, direction.length(), 10)), material, 0, 0, 0);
    rail.position.copy(from.clone().lerp(to, .5)); rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private surface(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial { return this.material(new THREE.MeshStandardMaterial({ color, roughness, metalness })); }
  private own<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0): THREE.Mesh {
    return this.mesh(parent, this.own(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d)), material, x, y, z);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.group.traverse(object => { if (object instanceof THREE.Light) object.dispose(); }); this.group.removeFromParent();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
