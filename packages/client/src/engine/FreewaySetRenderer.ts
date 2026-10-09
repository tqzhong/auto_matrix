import { TRUCK_ROAD, truckRoadPoint, type TruckRoad } from '@auto_matrix/shared';
import { TRUCK_HOOD, truckHoodHeight, type TruckHood } from '@auto_matrix/shared';
import * as THREE from 'three';
import { FREEWAY_PICKUP, freewayCarrierZ, freewayPickupBike, freewayPickupTraffic, freewayRideBike, type FreewayPickup, type FreewayRide, type FreewayHandoff } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FREEWAY_START, FREEWAY_FINISH, TRUCKS, truckApproachPose, freewayTraffic, filmObstacles, type FilmSet, type FilmJourney, type Vector3, type TruckEncounter } from '@auto_matrix/shared';
import { UrbanMaterials } from './UrbanMaterials.js';

/** The ride, traffic and roadside barriers share the server's road coordinates. */
export class FreewaySetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private urban = new UrbanMaterials();
  private bike = new THREE.Group();
  private carrier?: THREE.Group;
  private tether?: THREE.Group;
  private chainSparks?: THREE.Group;
  private pursuitTruck?: THREE.Group;
  private shieldCar?: THREE.Group;
  private heroTruck?: THREE.Group;
  private handoffTruck?: THREE.Group;
  private johnsonBridge?: THREE.Group;
  private oncomingTruck?: THREE.Group;
  private niobeCar?: THREE.Group;
  private windshieldCracks?: THREE.Mesh;
  private neoTrail?: THREE.Group;
  private impact?: THREE.Group;
  private fire?: THREE.Group;
  private smoke?: THREE.Group;
  private fragments?: THREE.Group;
  private crumple: THREE.Mesh[] = [];
  private trailers: THREE.Mesh[] = [];
  private trailerAxles: { root: THREE.Group; z: number; lift: number; bend: number; compressed: number }[] = [];
  private wheels: THREE.Mesh[] = [];
  private traffic: { mesh: THREE.InstancedMesh; part: THREE.Matrix4; truck: boolean; paint: boolean }[] = [];
  private matrix = new THREE.Matrix4();
  private color = new THREE.Color();
  private paint: THREE.MeshStandardMaterial;
  private rubber: THREE.MeshStandardMaterial;
  private steel: THREE.MeshStandardMaterial;
  private windows: THREE.MeshStandardMaterial;
  private white: THREE.MeshStandardMaterial;

  constructor(parent: THREE.Group, private set: FilmSet) {
    parent.add(this.root);
    this.paint = this.mat(0xffffff, .26, .65); this.rubber = this.mat(0x121713, .9); this.steel = this.mat(0x858c82, .34, .8);
    this.windows = this.mat(0x1e393b, .13, .7); this.white = this.mat(0xd3cfb9, .85);
    this.buildRoad(); this.batch(); this.buildBike(); this.buildTraffic(false); this.buildTraffic(true);
    if (set.id === 'film_freeway_trucks' || set.id === 'film_freeway_101') this.buildTruckScene();
    if (set.id === 'film_freeway_101') this.buildCarrier();
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(mat); return mat;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root, bevel = 0): THREE.Mesh {
    return this.mesh(bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  }
  private cylinder(mat: THREE.Material, x: number, y: number, z: number, r: number, h: number, parent = this.root): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(r, r, h, 16), mat, x, y, z, parent);
  }
  private buildRoad(): void {
    const length = Math.max(1600, this.set.depth), half = length / 2;
    const road = this.urban.surface('asphalt_02', 60, length, 6); road.name = 'freeway-asphalt';
    road.color.setHex(0xc5c6be); road.normalScale.set(.38, .38); this.urban.setWet(false); this.materials.add(road);
    this.box(road, 0, -.3, 0, 60, .6, length);
    const concrete = this.mat(0xb3b4a7, .94); const yellow = this.mat(0xd0b24c, .86);
    for (const o of filmObstacles(this.set)) {
      this.box(concrete, o.x, o.height / 2, 0, o.width, o.height, o.depth);
      this.box(this.steel, o.x, o.height + .1, 0, .24, .2, o.depth);
      for (let z = -half + 10; z < half; z += 16) this.box(this.steel, o.x, o.height + .55, z, .16, 1, .16);
    }
    for (const x of [-26, -2.8, 2.8, 26]) this.box(yellow, x, .015, 0, .18, .025, length);
    for (const x of [-18, -10, 10, 18]) for (let z = -half + 4; z < half; z += 20) this.box(this.white, x, .025, z, .22, .025, 8);
    for (const side of [-1, 1]) for (let z = -half + 20; z < half; z += 80) {
      this.cylinder(this.steel, side * 29, 11, z, .16, 22);
      this.box(this.steel, side * 26, 22, z, 6, .2, .2);
      this.box(this.white, side * 23.2, 21.85, z, 2, .32, .7);
    }
    for (const z of [-480, -40, 400]) {
      this.box(concrete, 0, 17, z, 120, 2, 18);
      for (const dz of [-6, 0, 6]) this.box(this.steel, 0, 15.6, z + dz, 120, .75, .42);
      for (const x of [-35, 35]) { this.box(concrete, x, 8, z, 4, 16, 12); this.box(this.steel, x, 20, z, .25, 4, 19); }
      this.box(concrete, 0, 19, z - 9, 120, 2, .5); this.box(concrete, 0, 19, z + 9, 120, 2, .5);
      for (let x = -55; x < 60; x += 3) this.box(this.steel, x, 21, z - 9, .06, 3, .06);
    }
    for (const z of [560, 180, -230, -590]) {
      for (const x of [-30, 30]) this.box(this.steel, x, 13, z, .65, 26, .65);
      this.box(this.steel, 0, 25, z, 61, .8, .8);
      this.sign(z > 0 ? '101  NORTH     DOWNTOWN' : 'EXIT  23     CITY CENTER', 14, 22, z, 23);
    }
    // Industrial edges, shallow embankments and repeating sound barriers give the road depth.
    const wall = this.mat(0x969b8b, .97); const earth = this.mat(0x7b806a, 1);
    const facades = [0, 1, 3].map(variant => {
      const material = this.urban.facade(variant); material.emissiveIntensity = .025; this.materials.add(material); return material;
    });
    for (const side of [-1, 1]) {
      this.box(earth, side * 83, -1, 0, 100, 2, length + 60);
      for (let z = -half + 10; z < half; z += 24) {
        this.box(wall, side * 42, 4.2, z, 1, 8.4, 23.7);
        this.box(concrete, side * 42, 4.5, z - 12, 1.35, 9, .4);
        for (const dz of [-10.2, -6.8, -3.4, 0, 3.4, 6.8, 10.2]) this.box(concrete, side * 41.43, 4.25, z + dz, .18, 8.15, .16);
        this.box(concrete, side * 42, 8.48, z, 1.15, .16, 23.8);
      }
      for (let z = -half + 60, index = 0; z < half; z += 132, index++) {
        const h = 12 + (Math.abs(z) % 7) * 4, x = side * (82 + index % 3 * 6);
        this.box(facades[index % facades.length], x, h / 2, z, 37, h, 65);
        this.box(this.rubber, x, h + .12, z, 37.3, .24, 65.3);
        for (const dx of [-18.6, 18.6]) this.box(concrete, x + dx, h + .55, z, .3, .85, 65.6);
        for (const dz of [-32.6, 32.6]) this.box(concrete, x, h + .55, z + dz, 37.5, .85, .3);
        for (let y = 6.8; y < h; y += 6.8) this.box(concrete, x - side * 18.55, y, z, .22, .12, 65);
        for (const dz of [-17, 13]) {
          this.box(this.steel, x + side * 4, h + 1.2, z + dz, 4.2, 2.1, 5.3, this.root, .08);
          this.box(this.rubber, x + side * 4, h + 2.28, z + dz, 3.8, .1, 4.9);
          for (const vent of [-1.4, -.7, 0, .7, 1.4]) this.box(this.rubber, x + side * 4 + vent, h + 2.34, z + dz, .1, .08, 4.3);
        }
      }
    }
    this.sign('EXIT  23', 18, 6, FREEWAY_FINISH - 10, 10);
  }
  private sign(text: string, x: number, y: number, z: number, w: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#355443'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = '#dedfcf'; ctx.lineWidth = 7; ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = '#e8e9d9'; ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 116, 950); ctx.font = '44px sans-serif'; ctx.fillText('↓                 ↓', 512, 200);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const mat = this.mat(0xffffff, .8); mat.map = texture;
    this.mesh(new THREE.PlaneGeometry(w, w / 4), mat, x, y, z);
  }
  private buildBike(): void {
    this.root.add(this.bike); this.bike.name = 'matrix-freeway-motorcycle'; this.bike.position.set(14, 0, FREEWAY_START);
    const green = this.mat(0x344732, .23, .6); const light = this.mat(0xdce8ba, .18); const red = this.mat(0x921814, .35);
    const tank = this.mesh(new THREE.SphereGeometry(1, 32, 20), green, 0, 2.05, -.85, this.bike);
    tank.name = 'motorcycle-fuel-tank'; tank.scale.set(.78, .52, 1.15);
    const fairing = this.mesh(new THREE.SphereGeometry(1, 32, 20), green, 0, 1.9, -2.3, this.bike);
    fairing.name = 'motorcycle-front-fairing'; fairing.scale.set(.9, .58, .7);
    const glass = new THREE.MeshStandardMaterial({ color: 0x94b6ac, roughness: .14, metalness: .05, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(glass);
    const windshield = this.box(glass, 0, 2.5, -2.15, 1.35, .65, .12, this.bike, .04);
    windshield.name = 'motorcycle-windshield'; windshield.rotation.x = -.4;
    this.box(light, 0, 2.05, -2.91, 1.4, .35, .07, this.bike, .08);
    this.box(this.rubber, 0, 2.05, 1.2, 1.4, .4, 2.3, this.bike, .15);
    this.box(green, 0, 1.6, 2.6, 1.6, .9, 1.25, this.bike, .18);
    this.box(red, 0, 1.95, 3.25, .9, .2, .08, this.bike);
    this.box(this.steel, 0, 2.5, -1.55, 2.35, .14, .16, this.bike);
    for (const [index, x] of [-.9, .9].entries()) {
      this.box(this.rubber, x, 2.5, -1.55, .5, .2, .2, this.bike).name = `motorcycle-grip-${index}`;
      this.box(this.steel, x, .9, .3, .6, .12, .22, this.bike).name = `motorcycle-rider-peg-${index}`;
      this.box(this.steel, x, .9, 1.65, .6, .12, .22, this.bike).name = `motorcycle-passenger-peg-${index}`;
    }
    for (const z of [-2.1, 2.2]) {
      const tire = this.cylinder(this.rubber, 0, .98, z, .98, .62, this.bike); tire.rotation.z = Math.PI / 2; this.wheels.push(tire);
      for (const x of [-.33, .33]) { const disc = this.cylinder(this.steel, x, .98, z, .61, .025, this.bike); disc.rotation.z = Math.PI / 2; }
    }
    for (const x of [-.6, .6]) { this.box(this.steel, x, 1.6, -1.85, .14, 1.55, .18, this.bike).rotation.x = -.25; this.box(this.steel, x, .8, 1.1, .18, .25, 2, this.bike); }
    this.cylinder(this.rubber, .95, 1.1, 2, .24, 2.2, this.bike).rotation.x = Math.PI / 2;
  }
  private buildTraffic(truck: boolean): void {
    const prototype = new THREE.Group(); const count = freewayTraffic(0).filter(c => c.truck === truck).length;
    this.box(this.paint, 0, 1.8, 0, truck ? 5 : 4.1, 1.4, truck ? 17 : 8.7, prototype, .3);
    this.box(this.windows, 0, truck ? 3.7 : 3, truck ? -6.1 : .15, truck ? 4.5 : 3.6, truck ? 2.5 : 1.4, truck ? 3.5 : 4.3, prototype, .22);
    this.box(this.paint, 0, truck ? 5 : 3.8, truck ? -6 : .2, truck ? 4.7 : 3.75, .2, truck ? 3.7 : 4.6, prototype, .07);
    if (truck) {
      this.box(this.white, 0, 4.35, 2.3, 5.4, 6.5, 12.9, prototype, .12);
      for (let z = -3.8; z < 8.8; z += .7) for (const x of [-2.72, 2.72]) this.box(this.steel, x, 4.45, z, .025, 6.1, .045, prototype);
    }
    for (const side of [-1, 1]) for (const z of truck ? [-6.5, 3.8, 6.8] : [-2.8, 2.7]) {
      this.cylinder(this.rubber, side * (truck ? 2.4 : 1.96), 1, z, truck ? 1.1 : .95, .6, prototype).rotation.z = Math.PI / 2;
      this.cylinder(this.steel, side * (truck ? 2.74 : 2.28), 1, z, .56, .06, prototype).rotation.z = Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      this.box(this.white, side * 1.4, 1.9, truck ? -8.6 : -4.4, .9, .38, .1, prototype);
      this.box(this.rubber, side * 1.88, 2.35, .2, .1, .12, truck ? 2 : 3.8, prototype);
      this.box(this.steel, side * 2.12, 2.8, -1.1, .55, .35, .55, prototype, .06);
    }
    this.box(this.steel, 0, 1.25, truck ? -8.65 : -4.45, truck ? 4.8 : 3.9, .26, .16, prototype);
    this.batch(prototype); prototype.updateMatrixWorld(true);
    // Each body part is one instanced draw for the whole traffic stream.
    for (const object of prototype.children as THREE.Mesh[]) {
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, count); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.root.add(mesh);
      this.traffic.push({ mesh, part: object.matrix.clone(), truck, paint: object.material === this.paint });
    }
    if (this.set.id === 'film_freeway_101') {
      const staged = prototype.clone(true); staged.name = truck ? 'matrix-freeway-jackson-truck' : 'matrix-freeway-shield-car';
      staged.rotation.y = Math.PI; staged.visible = false; this.root.add(staged);
      staged.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.material === this.paint) { const paint = this.paint.clone(); paint.color.setHex(truck ? 0x384747 : 0x949b8c); object.material = paint; this.materials.add(paint); }
        if (truck && object.material === this.windows) { const glass = this.windows.clone(); glass.transparent = true; glass.opacity = .25; glass.depthWrite = false; object.material = glass; this.materials.add(glass); }
      });
      if (truck) {
        this.pursuitTruck = staged;
        const wheel = FREEWAY_PICKUP.wheel, pedals = FREEWAY_PICKUP.pedals;
        this.mesh(new THREE.TorusGeometry(.35, .045, 8, 24), this.rubber, -wheel.x, wheel.y, -wheel.z, staged).rotation.x = .9;
        staged.children.at(-1)!.name = 'freeway-jackson-wheel';
        for (const [i, sign] of [-1, 1].entries()) this.box(this.rubber, -pedals.x - sign * .35, pedals.y, -pedals.z, .5, .08, .7, staged).name = `freeway-jackson-pedal-${i}`;
      } else this.shieldCar = staged;
    }
  }
  private buildCarrier(): void {
    const carrier = this.carrier = new THREE.Group(); carrier.name = 'matrix-motorcycle-carrier'; this.root.add(carrier);
    const c = FREEWAY_PICKUP.carrier, dark = this.mat(0x293937, .48, .55), deck = this.mat(0x677674, .65, .6);
    this.box(deck, 0, c.deck - .16, 0, c.width, .32, c.length, carrier);
    for (const x of [-2.8, 2.8]) this.box(this.steel, x, 2.1, 1, .3, .65, 32, carrier);
    for (const x of [-c.width / 2, c.width / 2]) this.box(this.steel, x, c.deck + .15, 0, .15, .3, c.length, carrier);
    for (const z of [-10, -8, 11, 15.8]) for (const x of [-3.25, 3.25]) {
      const wheel = this.cylinder(this.rubber, x, 1.1, z, 1.08, .65, carrier); wheel.rotation.z = Math.PI / 2;
      const hub = this.cylinder(this.steel, x * 1.09, 1.1, z, .63, .05, carrier); hub.rotation.z = Math.PI / 2;
    }
    this.box(dark, 0, 2.8, 16.4, 6.6, 3.4, 6.4, carrier, .3);
    this.box(this.windows, 0, 4.45, 16.6, 5.8, 1.65, 4.7, carrier, .16);
    this.box(dark, 0, 5.5, 16.6, 6.3, .25, 5.3, carrier, .1);
    this.box(this.steel, 0, 1.5, 19.7, 6.8, .45, .3, carrier);
    for (const x of [-2.3, 2.3]) this.box(this.white, x, 2.4, 19.63, 1.1, .4, .1, carrier);
    const ramp = this.box(deck, FREEWAY_PICKUP.bike.x, c.deck + .65, 11, 2.8, .16, Math.hypot(5, 1.3), carrier);
    ramp.rotation.x = -Math.atan2(1.3, 5);
    // Parked cargo leaves a real central aisle and a clear rear landing area.
    for (const [x, z] of [[-1.75, -1.5], [1.75, -1.5], [1.75, 6]]) {
      const cargo = this.bike.clone(true); cargo.name = 'matrix-carrier-cargo-bike'; cargo.position.set(x, c.deck, z); cargo.rotation.y = Math.PI;
      this.batch(cargo); carrier.add(cargo);
      for (const side of [-1, 1]) {
        const strap = this.box(this.rubber, x + side * .65, c.deck + .7, z, .08, 1.5, .08, carrier); strap.rotation.z = side * .35;
      }
    }
    this.batch(carrier);
    const tether = this.tether = new THREE.Group(); tether.name = 'matrix-carrier-bike-chain'; carrier.add(tether);
    for (let i = 0; i < 15; i++) {
      const link = this.mesh(new THREE.TorusGeometry(.12, .045, 5, 8), this.steel, FREEWAY_PICKUP.bike.x - .65 + i * .09, c.deck + .35 + Math.sin(i / 14 * Math.PI) * .6, 7.9, tether);
      link.rotation.y = i % 2 * Math.PI / 2;
    }
    const sparks = this.chainSparks = new THREE.Group(); sparks.name = 'matrix-carrier-chain-sparks'; carrier.add(sparks);
    sparks.position.set(FREEWAY_PICKUP.bike.x - .78, c.deck + .35, 7.9);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd99c, toneMapped: false }); this.materials.add(glow);
    const geometry = new THREE.BoxGeometry(.025, .025, .16);
    for (let i = 0; i < 12; i++) {
      const spark = this.mesh(geometry, glow, 0, 0, 0, sparks); spark.castShadow = spark.receiveShadow = false;
      spark.rotation.set(i * .67, i * 2.39996, i * .53);
    }
    sparks.visible = false;
    carrier.visible = false;
  }
  private buildTruckScene(): void {
    const trailer = this.mat(0xd2d3c9, .64, .28); const roof = this.mat(0x9ca79e, .81, .2); const cab = this.mat(0x394b43, .32, .38);
    const freightGreen = this.mat(0x35483d, .78, .18); const lamp = this.mat(0xffdca4, .19);
    const glazing = new THREE.MeshPhysicalMaterial({ color: 0x76918a, roughness: .11, metalness: .08,
      transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide, clearcoat: .75 }); this.materials.add(glazing);
    const reflector = this.mat(0xa43928, .38, .1), seat = this.mat(0x27312d, .93);
    const buckle = (point: THREE.Vector3): THREE.Vector3 => {
      const span = THREE.MathUtils.clamp((point.z + 6.5) / 20, 0, 1), folds = Math.exp(-span * 3);
      return new THREE.Vector3(point.x + Math.sign(point.x) * .55 * Math.sin((point.z + 6.5) * 4.2) * folds,
        point.y + .25 + 1.5 * span ** 3 + .12 * Math.sin((point.z + 6.5) * 4.2) * folds,
        -6.5 + (point.z + 6.5) * (1 - .16 * Math.exp(-span * 1.3)));
    };
    const buildRig = (body: THREE.Material, shell: THREE.Material, name: string, label: string): THREE.Group => {
      const rig = new THREE.Group(); rig.name = name; this.root.add(rig);
      const cargo = new THREE.Group(); cargo.name = `${name}-trailer`; rig.add(cargo);
      // Segmented hollow panels can accordion at the tractor end; a solid box cannot.
      for (const x of [-2.74, 2.74]) this.mesh(new THREE.BoxGeometry(.12, 6, 20, 1, 4, 40), shell, x, 3.6, 3.5, cargo);
      this.mesh(new THREE.BoxGeometry(5.6, .08, 20, 4, 1, 40), roof, 0, TRUCKS.roof.height + .01, 3.5, cargo);
      this.mesh(new THREE.BoxGeometry(5.6, .14, 20, 4, 1, 40), this.steel, 0, .67, 3.5, cargo);
      for (const z of [-6.5, 13.5]) this.box(shell, 0, 3.6, z, 5.6, 6, .1, cargo);
      for (const x of [-2.812, 2.812]) {
        this.mesh(new THREE.BoxGeometry(.018, .42, 19.9, 1, 1, 40), freightGreen, x, 1.55, 3.5, cargo);
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#35483d'; ctx.fillRect(0, 0, 1024, 128);
        ctx.fillStyle = '#e4e5d9'; ctx.font = 'bold 98px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 512, 68, 960);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
        const marking = this.mat(0xffffff, .82); marking.map = texture;
        const plate = this.mesh(new THREE.PlaneGeometry(label === 'LONGPATH' ? 3.4 : 1.2, .4, 8, 1), marking, x * 1.004, 1.55, 10, cargo);
        plate.rotation.y = Math.sign(x) * Math.PI / 2;
      }
      for (let z = -6; z <= 12; z += 1.8) this.box(this.steel, 0, TRUCKS.roof.height + .08, z, 5.45, .035, .06, cargo);
      for (const x of [-2.84, 2.84]) for (let z = -6; z < 13; z += 2.4) this.box(this.steel, x, 3.7, z, .055, 5.65, .1, cargo);
      for (const side of [-1, 1]) {
        this.box(shell, side * 1.34, 3.6, 13.575, 2.62, 5.72, .035, cargo);
        for (const y of [1.15, 3.6, 6.05]) this.box(this.steel, side * 2.59, y, 13.63, .29, .16, .06, cargo);
        this.cylinder(this.steel, side * 1.08, 3.6, 13.67, .037, 5.13, cargo);
        this.box(this.steel, side * 1.3, 1.82, 13.72, .49, .07, .1, cargo);
        this.box(reflector, side * 2.32, .92, 13.64, .57, .23, .1, cargo, .025);
        this.box(this.rubber, side * 2.1, .73, 12.42, 1.17, 1.03, .07, cargo);
      }
      this.box(this.rubber, 0, 3.6, 13.612, .045, 5.87, .027, cargo);
      this.box(this.steel, 0, .52, 13.74, 5.45, .18, .24, cargo);
      for (let index = 0; index < 18; index++) this.box(index % 2 ? reflector : this.white, -2.55 + index * .3, .73, 13.67, .28, .08, .024, cargo);
      for (const x of [-1.45, 1.45]) this.mesh(new THREE.BoxGeometry(.25, .55, 20, 1, 1, 40), this.steel, x, 1.15, 3.5, cargo);
      for (let z = -5.5; z < 14; z += 2) this.box(this.steel, 0, 1.15, z, 3.15, .22, .18, cargo);
      this.batch(cargo);
      for (const object of cargo.children as THREE.Mesh[]) {
        const position = object.geometry.getAttribute('position'), folded = position.clone();
        for (let i = 0; i < position.count; i++) {
          const point = buckle(new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)));
          folded.setXYZ(i, point.x, point.y, point.z);
        }
        const normals = object.geometry.clone(); normals.setAttribute('position', folded); normals.computeVertexNormals();
        object.geometry.morphAttributes.position = [folded];
        object.geometry.morphAttributes.normal = [normals.getAttribute('normal').clone()]; normals.dispose();
        object.updateMorphTargets(); this.trailers.push(object);
      }
      // The film tractors are flat-front cabs, with open glazing above the grille.
      const cabin = new THREE.Group(); cabin.name = `${name}-cab`; rig.add(cabin);
      this.box(body, 0, 3.82, -8.4, 5.16, 4.37, .25, cabin, .12);
      this.box(body, 0, 6.02, -10.99, 5.16, .35, 5.3, cabin, .14);
      this.box(body, 0, 3.02, -13.43, 5.12, 2.05, .28, cabin, .12);
      this.box(body, 0, 4.2, -13.43, 4.53, .35, .2, cabin);
      this.box(this.rubber, 0, 2.12, -10.99, 4.2, .2, 5.08, cabin);
      this.box(this.rubber, 0, 4.3, -12.96, 4.43, .24, .62, cabin, .06);
      for (const side of [-1, 1]) {
        this.box(body, side * 2.5, 3.03, -10.98, .16, 1.67, 5.06, cabin);
        this.box(body, side * 2.5, 4.97, -9.28, .16, 2.21, 1.69, cabin);
        this.box(body, side * 2.5, 4.96, -13.225, .16, 1.9, .25, cabin);
        this.box(body, side * 2.5, 4.96, -10.23, .16, 1.9, .18, cabin);
        this.box(body, side * 2.5, 1.88, -13.1, .18, .61, .74, cabin);
        this.box(body, side * 2.5, 1.88, -9.15, .18, .61, 1.4, cabin);
        this.box(body, side * 2.31, 4.97, -13.39, .25, 1.94, .25, cabin, .06);
        this.box(body, side * 2.5, 5.85, -11.81, .18, .25, 3.3, cabin);
        this.box(this.rubber, side * 2.59, 4.13, -11.7, .05, .12, 2.83, cabin);
        this.box(this.rubber, side * 2.59, 5.7, -11.7, .05, .1, 2.83, cabin);
        for (const z of [-13.08, -10.32]) this.box(this.rubber, side * 2.6, 4.92, z, .065, 1.6, .07, cabin);
        const window = this.mesh(new THREE.PlaneGeometry(2.73, 1.48), glazing, side * 2.602, 4.92, -11.7, cabin);
        window.rotation.y = side * Math.PI / 2; window.castShadow = false;
        this.box(this.steel, side * 2.61, 3.76, -10.64, .07, .07, .52, cabin, .025);
        this.box(this.rubber, side * 2.59, 3.15, -9.98, .045, 1.23, .035, cabin);
        this.box(this.steel, side * 2.6, 1.61, -9.3, .58, .15, 1.47, cabin, .03);
        this.box(this.steel, side * 2.65, 1.29, -9.3, .68, .12, 1.47, cabin, .03);
        const fender = this.mesh(new THREE.TorusGeometry(1.25, .14, 6, 28, Math.PI), body, side * 2.54, 1.1, -11, cabin);
        fender.rotation.y = Math.PI / 2;
        const tank = this.cylinder(this.steel, side * 2.15, 1.21, -7.65, .53, 1.75, cabin); tank.rotation.x = Math.PI / 2;
        for (const z of [-8.23, -7.12]) this.mesh(new THREE.TorusGeometry(.542, .043, 5, 20), this.rubber, side * 2.15, 1.21, z, cabin);
        this.cylinder(this.steel, side * 2.16, 4.29, -8.69, .12, 2.83, cabin);
        this.box(this.steel, side * 1.35, 1.3, -9.7, .23, .35, 7, cabin);
        this.box(this.steel, side * 2.68, 5.29, -13, .58, .065, .08, cabin);
        this.box(this.steel, side * 2.98, 4.64, -13, .07, 1.37, .07, cabin);
        this.box(this.rubber, side * 3.07, 4.58, -13, .29, 1.05, .18, cabin, .055);
        this.box(this.steel, side * 3.07, 4.58, -13.102, .23, .92, .015, cabin);
        this.box(seat, side * 1.16, 2.77, -10.8, .94, .3, 1.19, cabin, .11);
        this.box(seat, side * 1.16, 3.51, -10.17, .94, 1.47, .28, cabin, .09);
        this.box(seat, side * 1.16, 4.42, -10.17, .61, .44, .28, cabin, .08);
        const glass = this.mesh(new THREE.PlaneGeometry(1.97, 1.43), glazing, side * 1.09, 5.13, -13.595, cabin);
        glass.castShadow = false;
        for (const y of [4.34, 5.92]) this.box(this.rubber, side * 1.09, y, -13.615, 2.15, .065, .07, cabin, .02);
        for (const x of [side * .038, side * 2.165]) this.box(this.rubber, x, 5.13, -13.615, .07, 1.58, .07, cabin, .02);
        const wiper = this.box(this.rubber, side * 1.11, 4.62, -13.66, .95, .045, .045, cabin); wiper.rotation.z = side * -.15;
        this.box(this.steel, side * 2.02, 2.7, -13.645, 1.02, .55, .07, cabin, .05);
        for (const x of [side * 1.78, side * 2.2]) this.box(lamp, x, 2.7, -13.695, .35, .37, .035, cabin, .03);
        this.box(reflector, side * 2.43, 2.7, -13.69, .11, .42, .04, cabin);
        this.box(lamp, side * 2.21, 1.56, -13.988, .55, .24, .03, cabin, .025);
      }
      const steering = this.mesh(new THREE.TorusGeometry(.38, .047, 6, 20), this.rubber, -1.16, 3.89, -12.5, cabin); steering.rotation.x = -.45;
      this.box(this.rubber, 0, 3.15, -13.6, 3.19, 1.48, .035, cabin);
      for (let y = 2.55; y <= 3.78; y += .135) this.box(this.steel, 0, y, -13.65, 3.1, .05, .06, cabin);
      for (const x of [-1.6, 1.6]) this.box(this.steel, x, 3.18, -13.665, .055, 1.52, .06, cabin);
      this.box(body, 0, 1.75, -13.73, 5.42, .87, .52, cabin, .14);
      for (const x of [-.62, 0, .62]) this.box(this.rubber, x, 1.84, -14.003, .42, .2, .025, cabin, .025);
      this.box(this.white, 0, 1.5, -14.003, .64, .24, .025, cabin, .02);
      this.batch(cabin);
      for (const object of cabin.children as THREE.Mesh[]) if (object.material === glazing) object.castShadow = false;
      for (const z of [-11, -4.6, -2.2, 9, 11]) {
        const axle = new THREE.Group(); axle.name = `${name}-axle-${z}`; axle.position.set(0, 1.1, z); rig.add(axle);
        for (const side of [-1, 1]) {
          for (const x of z === -11 ? [2.52] : [2.08, 2.57]) {
            const wheel = this.cylinder(this.rubber, side * x, 0, 0, 1.08, z === -11 ? .65 : .43, axle); wheel.rotation.z = Math.PI / 2;
          }
          const hub = this.cylinder(this.steel, side * 2.88, 0, 0, .57, .04, axle); hub.rotation.z = Math.PI / 2;
          const recess = this.cylinder(this.rubber, side * 2.906, 0, 0, .37, .022, axle); recess.rotation.z = Math.PI / 2;
          const cap = this.cylinder(this.steel, side * 2.927, 0, 0, .17, .045, axle); cap.rotation.z = Math.PI / 2;
          for (let bolt = 0; bolt < 8; bolt++) {
            const angle = bolt * Math.PI / 4;
            const nut = this.cylinder(this.steel, side * 2.936, Math.sin(angle) * .46, Math.cos(angle) * .46, .043, .048, axle); nut.rotation.z = Math.PI / 2;
          }
        }
        this.cylinder(this.steel, 0, 0, 0, .13, 5.5, axle).rotation.z = Math.PI / 2;
        this.batch(axle);
        if (z > -8) {
          const anchor = buckle(new THREE.Vector3(0, 1.1, z));
          const before = buckle(new THREE.Vector3(0, 1.1, z - .5)), after = buckle(new THREE.Vector3(0, 1.1, z + .5));
          this.trailerAxles.push({ root: axle, z, lift: anchor.y - 1.1, compressed: anchor.z - z,
            bend: -Math.atan2(after.y - before.y, after.z - before.z) });
        }
      }
      // The cab reacts first. Trailer deformation waits for the passengers' jump.
      for (const object of cabin.children as THREE.Mesh[]) {
        const position = object.geometry.getAttribute('position'), folded = position.clone();
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i) + object.position.x, y = position.getY(i) + object.position.y, z = position.getZ(i) + object.position.z;
          const front = THREE.MathUtils.clamp((-z - 7) / 7, 0, 1), height = THREE.MathUtils.clamp((y - 1.4) / 4.2, 0, 1);
          folded.setXYZ(i, position.getX(i) + Math.sign(x) * front * (.36 + .28 * Math.sin(y * 4 + Math.abs(z))),
            position.getY(i) + front * (.45 - height * 1.4 + .15 * Math.sin(x * 3.8)),
            position.getZ(i) + front * (1.35 + height * 1.8 + .25 * Math.sin(y * 3.7)));
        }
        const normals = object.geometry.clone(); normals.setAttribute('position', folded); normals.computeVertexNormals();
        object.geometry.morphAttributes.position = [folded];
        object.geometry.morphAttributes.normal = [normals.getAttribute('normal').clone()]; normals.dispose();
        object.updateMorphTargets(); this.crumple.push(object);
      }
      return rig;
    };
    this.heroTruck = buildRig(cab, trailer, 'matrix-freeway-hero-truck', 'LONGPATH'); this.heroTruck.position.set(TRUCKS.roof.x, 0, TRUCKS.morpheus.z);
    if (this.set.id === 'film_freeway_101') {
      this.handoffTruck = this.heroTruck; this.handoffTruck.name = 'matrix-freeway-handoff-truck';
      this.handoffTruck.rotation.y = Math.PI; this.handoffTruck.visible = false;
      const bridge = this.johnsonBridge = new THREE.Group(); bridge.name = 'matrix-freeway-johnson-overpass'; this.root.add(bridge); bridge.visible = false;
      this.box(this.steel, 0, TRUCK_ROAD.bridgeHeight - .5, 0, 110, 1, 14, bridge, .1);
      for (const side of [-1, 1]) {
        this.box(this.steel, side * 46, TRUCK_ROAD.bridgeHeight / 2, 0, 2.5, TRUCK_ROAD.bridgeHeight, 7, bridge, .15);
        this.box(this.steel, 0, TRUCK_ROAD.bridgeHeight + .6, side * 6.8, 110, 1.2, .3, bridge, .05);
      }
      this.batch(bridge);
    } else { this.heroTruck.rotation.y = 0; }
    this.oncomingTruck = buildRig(cab, freightGreen, 'matrix-freeway-oncoming-truck', 'GIL'); this.oncomingTruck.position.set(TRUCKS.roof.x, 0, TRUCKS.oncomingStart);
    this.oncomingTruck.rotation.y = Math.PI;
    const car = this.niobeCar = new THREE.Group(); car.name = 'matrix-freeway-niobe-car'; this.root.add(car); car.position.set(TRUCKS.niobe.x, 0, TRUCKS.niobe.z);
    this.buildNiobeCar(car);
    this.neoTrail = new THREE.Group(); this.neoTrail.name = 'matrix-freeway-neo-trail'; this.root.add(this.neoTrail);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xdcead8, transparent: true, opacity: .4, depthWrite: false }); this.materials.add(trailMat);
    for (let i = 0; i < 5; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(.55 + i * .27, .045, 5, 24), trailMat, 0, 0, -i * 2.5, this.neoTrail);
      ring.rotation.y = Math.PI / 2;
    }
    this.impact = new THREE.Group(); this.impact.name = 'matrix-freeway-collision'; this.root.add(this.impact); this.impact.position.set(TRUCKS.roof.x, 3.2, 11.5);
    this.fire = new THREE.Group(); this.impact.add(this.fire);
    this.smoke = new THREE.Group(); this.impact.add(this.smoke);
    const fireCanvas = document.createElement('canvas'); fireCanvas.width = fireCanvas.height = 128;
    const fireContext = fireCanvas.getContext('2d')!, firePixels = fireContext.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = (x - 64) / 62, ny = (y - 64) / 62;
      const noise = Math.sin(x * .19 + Math.sin(y * .14) * 2) * Math.sin(y * .21 + Math.sin(x * .12));
      const heat = Math.max(0, 1 - Math.hypot(nx, ny) * (1 + noise * .15));
      const edge = THREE.MathUtils.clamp((1 - Math.hypot(nx, ny)) * 5, 0, 1);
      const offset = (y * 128 + x) * 4;
      firePixels.data.set([255, 82 + heat * 173, 8 + Math.pow(heat, 3) * 188,
        Math.pow(heat, 1.15) * (180 + noise * 45) * edge], offset);
    }
    fireContext.putImageData(firePixels, 0, 0);
    const fireTexture = new THREE.CanvasTexture(fireCanvas); fireTexture.colorSpace = THREE.SRGBColorSpace; this.textures.add(fireTexture);
    const flare = new THREE.SpriteMaterial({ map: fireTexture, transparent: true, opacity: .85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false }); this.materials.add(flare);
    for (let i = 0; i < 14; i++) {
      const flame = new THREE.Sprite(flare), angle = i * 2.399963;
      flame.position.set(Math.sin(angle) * (i < 7 ? 1.45 : .85), i < 7 ? -.25 : .9, Math.cos(angle) * 1.1);
      flame.scale.set(i < 7 ? 2.8 : 1.7, i < 7 ? 2.2 : 3.2, 1); this.fire.add(flame);
    }
    const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = smokeCanvas.height = 64;
    const smokeContext = smokeCanvas.getContext('2d')!;
    const gradient = smokeContext.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255,255,255,.68)'); gradient.addColorStop(.5, 'rgba(255,255,255,.36)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    smokeContext.fillStyle = gradient; smokeContext.fillRect(0, 0, 64, 64);
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas); this.textures.add(smokeTexture);
    const soot = new THREE.SpriteMaterial({ map: smokeTexture, color: 0x424942, transparent: true, opacity: .62, depthWrite: false }); this.materials.add(soot);
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Sprite(soot); this.smoke.add(puff);
      puff.position.set(Math.sin(i * 2.4) * (1 + i * .34), 1 + i * 1.15, Math.cos(i * 2.4) * (1 + i * .28));
      puff.scale.set(5 + i * .55, 5 + i * .65, 1);
    }
    this.fragments = new THREE.Group(); this.fragments.name = 'matrix-freeway-crash-fragments'; this.impact.add(this.fragments);
    const glass = this.mat(0xa5c1b6, .16, .6); glass.side = THREE.DoubleSide;
    const sheet = this.mat(0x7c867e, .42, .7); sheet.side = THREE.DoubleSide;
    for (let i = 0; i < 32; i++) {
      const shard = this.mesh(new THREE.PlaneGeometry(i % 3 === 0 ? .65 : .28, i % 3 === 0 ? 1.1 : .45),
        i % 3 === 0 ? sheet : glass, 0, 0, 0, this.fragments);
      shard.name = `matrix-freeway-crash-shard-${i}`;
    }
    this.impact.visible = false; this.neoTrail.visible = false;
  }
  private buildNiobeCar(car: THREE.Group): void {
    const silver = this.mat(0x8da7a7, .28, .75), trim = this.mat(0x202b2b, .62), seat = this.mat(0x27332f, .9);
    const glass = this.mat(0x789c9d, .12, .15); glass.transparent = true; glass.opacity = .17; glass.side = THREE.DoubleSide; glass.depthWrite = false;
    this.box(trim, 0, .45, 0, TRUCK_HOOD.car.width, .4, TRUCK_HOOD.car.depth, car, .15);
    this.box(silver, 0, 1.05, 3.0, TRUCK_HOOD.car.width, .75, 3.3, car, .3);
    this.box(silver, 0, 1.05, -3.8, TRUCK_HOOD.car.width, .75, 1.7, car, .25);
    this.box(trim, 0, .86, 4.53, 3.8, .24, .22, car, .06);
    this.box(trim, 0, 1.25, 4.58, 1.7, .22, .12, car, .03);
    for (const x of [-1.35, 1.35]) this.box(this.white, x, 1.45, 4.54, .85, .2, .17, car, .08);
    const surface = (front: number, back: number, material: THREE.Material, name: string) => {
      const geometry = new THREE.BufferGeometry(), w = front > 1.2 ? 1.93 : 1.73;
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([-w, truckHoodHeight(front), front, w, truckHoodHeight(front), front,
        w, truckHoodHeight(back), back, -w, truckHoodHeight(back), back], 3));
      geometry.setIndex([0, 3, 1, 1, 3, 2]); geometry.computeVertexNormals();
      this.mesh(geometry, material, 0, 0, 0, car).name = name;
    };
    surface(4.5, 1.2, silver, 'niobe-hood-contact'); surface(1.2, -.65, glass, 'niobe-windshield-contact');
    this.buildWindshieldCracks(car);
    this.box(silver, 0, 3.02, -1.7, 3.5, .17, 2.1, car, .1);
    this.box(silver, 0, 1.7, -3.9, 3.8, .35, 1.25, car, .15);
    for (const x of [-1.8, 1.8]) {
      this.box(silver, x, 1.74, -.65, .22, .8, 4.35, car, .07);
      this.box(silver, x, 2.35, -.1, .15, 1.4, .17, car, .03).rotation.x = .58;
      this.box(silver, x, 2.33, -2.8, .15, 1.3, .2, car, .04).rotation.x = -.5;
      this.box(silver, x, 2.13, -1.45, .12, 1.14, .13, car, .03);
      this.box(glass, x, 2.3, -1.47, .015, 1.1, 2.6, car, .005);
      this.box(trim, x * 1.12, 1.83, .4, .42, .18, .42, car, .07);
      this.box(trim, x * 1.02, 1.7, -1.2, .08, .09, .5, car, .02);
    }
    this.box(trim, 0, 1.53, .75, 3.42, .42, .76, car, .08);
    for (const x of [-.78, .78]) {
      this.box(seat, x, .91, -1, 1.15, .28, 1.15, car, .12);
      this.box(seat, x, 1.63, -1.67, 1.15, 1.45, .3, car, .14).rotation.x = -.12;
    }
    const wheel = this.mesh(new THREE.TorusGeometry(.35, .04, 8, 24), trim, TRUCK_HOOD.driver.x, TRUCK_HOOD.wheel.y, TRUCK_HOOD.wheel.z, car); wheel.rotation.x = -.38; wheel.name = 'niobe-steering-wheel';
    this.cylinder(trim, TRUCK_HOOD.driver.x, 1.65, .3, .045, .95, car).rotation.x = -.62;
    for (const side of [-1, 1]) for (const z of [-2.95, 2.85]) {
      const wheel = this.cylinder(this.rubber, side * 1.98, .9, z, .83, .4, car); wheel.rotation.z = Math.PI / 2;
      const hub = this.cylinder(this.steel, side * 2.21, .9, z, .47, .1, car); hub.rotation.z = Math.PI / 2;
    }
  }
  private buildWindshieldCracks(car: THREE.Group): void {
    const strokes: { a: [number, number]; b: [number, number]; width: number; age: number }[] = [];
    let seed = 31;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const point = (angle: number, radius: number): [number, number] => [THREE.MathUtils.clamp(Math.cos(angle) * radius * 1.8, -1.72, 1.72),
      THREE.MathUtils.clamp(.28 + Math.sin(angle) * radius * 1.2, -.64, 1.19)];
    const stroke = (a: [number, number], b: [number, number], width: number) => strokes.push({ a, b, width, age: Math.hypot((a[0]+b[0])/2, (a[1]+b[1])/2-.28) });
    for (let ray = 0; ray < 28; ray++) {
      const angle = ray / 28 * Math.PI * 2, nodes: [number, number][] = [[0, .28]];
      for (let step = 1; step <= 16; step++) {
        const radius = step / 16, next = point(angle + (random()-.5)*.12, radius);
        stroke(nodes[nodes.length-1],next,ray % 3 === 0 ? .009 : .004); nodes.push(next);
        if (step > 2 && step % 3 === 0) stroke(next,point(angle+(random()-.5)*.5,radius+.12),.003);
      }
    }
    for (let ring = 1; ring <= 9; ring++) {
      let previous = point(0,ring/10);
      for (let segment = 1; segment <= 48; segment++) {
        const next = point(segment / 48 * Math.PI * 2,ring/10+(random()-.5)*.035);
        if (random() > .12) stroke(previous,next,.0028); previous = next;
      }
    }
    const positions: number[] = [];
    const vertex = (x: number, z: number) => positions.push(THREE.MathUtils.clamp(x,-1.73,1.73),truckHoodHeight(z)+.012,z);
    for (const s of strokes.sort((a,b)=>a.age-b.age)) {
      const dx=s.b[0]-s.a[0], dz=s.b[1]-s.a[1], length=Math.hypot(dx,dz); if (length<.0001) continue;
      const x=-dz/length*s.width/2, z=dx/length*s.width/2;
      const corner=(end: [number,number],side: number) => vertex(end[0]+x*side,THREE.MathUtils.clamp(end[1]+z*side,-.65,1.2));
      corner(s.a,1);corner(s.a,-1);corner(s.b,1);corner(s.b,1);corner(s.a,-1);corner(s.b,-1);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({color:0xd1dfd8,transparent:true,opacity:.76,side:THREE.DoubleSide,depthWrite:false}); this.materials.add(material);
    this.windshieldCracks = this.mesh(geometry,material,0,0,0,car); this.windshieldCracks.name = 'niobe-windshield-cracks'; this.windshieldCracks.visible = false;
  }
  update(journey: FilmJourney | undefined, elapsed: number, playerPosition?: Vector3, rescuePose?: TruckEncounter, pickupPose?: FreewayPickup, ridePose?: FreewayRide, handoffPose?: FreewayHandoff, roadPose?: TruckRoad, hoodPose?: TruckHood): void {
    const savedHandoff = journey?.scene === 'm2_freeway' && journey.step === 2 && !journey.visiting ? journey.freewayHandoff : undefined;
    const handoff = savedHandoff && handoffPose?.attempt === savedHandoff.attempt && handoffPose.total >= savedHandoff.total ? handoffPose : savedHandoff;
    if (this.handoffTruck) {
      this.handoffTruck.visible = Boolean(handoff || journey?.scene === 'm2_trucks' && journey.trucks?.road && !journey.visiting);
      if (handoff) this.handoffTruck.position.set(handoff.truck.x, 0, handoff.truck.z);
    }
    const savedRide = journey?.scene === 'm2_freeway' && !journey.visiting ? journey.ride : undefined;
    const ride = handoff?.bike ?? (savedRide && savedRide.startedAt !== undefined && ridePose?.startedAt === savedRide.startedAt
      && ridePose.elapsed >= savedRide.elapsed ? ridePose : savedRide);
    const savedPickup = journey?.scene === 'm2_freeway' && (journey.step === 0 || journey.freewayPickup?.chase) && !journey.visiting ? journey.freewayPickup : undefined;
    const pickup = savedPickup && pickupPose?.attempts === savedPickup.attempts && pickupPose.total >= savedPickup.total ? pickupPose : savedPickup;
    const savedTrucks = journey?.scene === 'm2_trucks' && !journey.visiting ? journey.trucks : undefined;
    const trucks = savedTrucks?.phase === 'rescue' && rescuePose?.phase === 'rescue' && rescuePose.attempt === savedTrucks.attempt
      && (rescuePose.rescueElapsed ?? 0) >= (savedTrucks.rescueElapsed ?? 0) ? rescuePose : savedTrucks;
    const savedRoad = trucks?.road;
    const road = savedRoad && roadPose?.bridgeZ === savedRoad.bridgeZ && roadPose.elapsed >= savedRoad.elapsed ? roadPose : savedRoad;
    const savedHood = trucks?.hood, hood = savedHood && hoodPose?.attempt === savedHood.attempt && hoodPose.total >= savedHood.total ? hoodPose : savedHood;
    if (this.windshieldCracks) {
      this.windshieldCracks.visible = hood?.glassAge !== undefined;
      const count = this.windshieldCracks.geometry.attributes.position.count;
      this.windshieldCracks.geometry.setDrawRange(0, Math.floor(count * Math.min(1,(hood?.glassAge ?? 0)/TRUCK_HOOD.glassSeconds) / 3) * 3);
    }
    if (road && this.heroTruck) { this.heroTruck.position.set(road.truck.x, 0, road.truck.z); this.heroTruck.rotation.y = Math.PI; }
    if (this.johnsonBridge) { this.johnsonBridge.visible = Boolean(road); if (road) this.johnsonBridge.position.z = road.bridgeZ; }
    if (this.oncomingTruck) this.oncomingTruck.visible = this.niobeCar!.visible = Boolean(trucks);
    const crashed = trucks?.phase === 'rescue' || trucks?.phase === 'rescued' || trucks?.phase === 'failed' && hood?.phase !== 'failed';
    const crashTime = !crashed ? 0 : trucks.phase === 'rescue' ? trucks.rescueElapsed ?? 0 : TRUCKS.rescueSeconds;
    // The encounter owns its time after the duel. Render time must not restart a saved explosion.
    const truckClock = road && trucks?.phase === 'duel' ? road.elapsed : trucks && trucks.phase !== 'duel' ? trucks.elapsed + crashTime : this.set.id === 'film_freeway_101' ? 0 : elapsed;
    const traffic = pickup && pickup.phase !== 'done' ? freewayPickupTraffic(pickup) : freewayTraffic(trucks ? truckClock : ride?.elapsed ?? elapsed, ride?.obstacles);
    const pose = new THREE.Object3D();
    for (const batch of this.traffic) {
      let i = 0;
      for (const car of traffic) if (car.truck === batch.truck) {
        const staged = (this.set.id === 'film_freeway_trucks' && Math.abs(car.z) < 110 || road && Math.abs(car.z - road.truck.z) < 65) && car.x > 0;
        pose.position.set(car.x, 0, staged ? car.z + 500 : car.z); pose.rotation.set(0, car.speed > 0 ? Math.PI : 0, 0); pose.updateMatrix();
        this.matrix.multiplyMatrices(pose.matrix, batch.part); batch.mesh.setMatrixAt(i, this.matrix);
        if (batch.paint) batch.mesh.setColorAt(i, this.color.setHex(car.color)); i++;
      }
      batch.mesh.instanceMatrix.needsUpdate = true; if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
    this.bike.visible = !journey || journey.scene === 'm2_freeway' || journey.visiting === 'm2_freeway';
    const bike = ride && freewayRideBike(ride);
    this.bike.position.set(bike?.x ?? 14, bike?.y ?? 0, bike?.z ?? FREEWAY_START);
    this.bike.rotation.order = 'YXZ'; this.bike.rotation.set(bike?.pitch ?? 0, bike ? Math.PI + bike.yaw : 0, bike ? -bike.roll : 0);
    if (this.pursuitTruck && this.shieldCar) {
      this.pursuitTruck.visible = this.shieldCar.visible = Boolean(pickup?.chase);
      if (pickup?.chase) {
        const { truck, shield } = pickup.chase;
        this.pursuitTruck.position.set(truck.x, 0, truck.z); this.pursuitTruck.rotation.y = Math.PI + truck.yaw;
        this.shieldCar.position.set(shield.x, 0, shield.z);
      }
    }
    if (this.carrier) {
      this.carrier.visible = Boolean(pickup && pickup.phase !== 'done');
      if (pickup) {
        this.carrier.position.set(FREEWAY_PICKUP.carrier.x, 0, freewayCarrierZ(pickup));
        const age = pickup.shotAt === undefined ? 0 : Math.max(0, pickup.total - pickup.shotAt), fallen = THREE.MathUtils.smoothstep(age, 0, .7);
        this.tether!.visible = pickup.chain || pickup.shotAt !== undefined;
        this.tether!.children.forEach((link, i) => {
          const side = i < 7 ? -1 : 1;
          link.position.set(FREEWAY_PICKUP.bike.x - .65 + i * .09 + side * fallen * .6,
            FREEWAY_PICKUP.carrier.deck + .18 + (.17 + Math.sin(i / 14 * Math.PI) * .6) * (1 - fallen), 7.9 + side * fallen * .35);
          link.rotation.set(fallen * Math.PI / 2, i % 2 * Math.PI / 2, side * fallen * .2);
        });
        this.chainSparks!.visible = pickup.shotAt !== undefined && age < .22;
        this.chainSparks!.children.forEach((spark, i) => {
          const angle = i * 2.39996, radius = age * (2.5 + i % 3);
          spark.position.set(Math.cos(angle) * radius, Math.max(-.6, Math.sin(i * 1.73) * radius - 4.9 * age * age), Math.sin(angle) * radius);
        });
        if (pickup.phase !== 'done') {
          const bike = freewayPickupBike(pickup);
          this.bike.position.set(bike.x, bike.y, bike.z); this.bike.rotation.order = 'YXZ'; this.bike.rotation.set(bike.pitch, Math.PI + bike.yaw, 0);
        }
      }
    }
    for (const wheel of this.wheels) wheel.rotation.x = pickup?.phase === 'launching' ? -pickup.elapsed * 18 : -(FREEWAY_START - (ride?.z ?? FREEWAY_START));
    if (this.oncomingTruck) {
      const progress = trucks?.phase === 'duel' || !trucks ? 0 : Math.min(1, trucks.elapsed / TRUCKS.collisionSeconds);
      const oncoming = truckRoadPoint(road, { x: TRUCKS.roof.x, z: TRUCKS.oncomingStart + (TRUCKS.oncomingEnd - TRUCKS.oncomingStart) * progress });
      this.oncomingTruck.position.set(oncoming.x, 0, oncoming.z); this.oncomingTruck.rotation.y = road ? 0 : Math.PI;
      const niobe = truckRoadPoint(road, { ...TRUCKS.niobe, z: TRUCKS.niobe.z + Math.sin(truckClock * 1.7) * .45 });
      this.niobeCar!.position.set(hood && road ? road.truck.x + hood.car.x : niobe.x, 0, hood && road ? road.truck.z + hood.car.z : niobe.z);
      this.niobeCar!.rotation.y = hood ? hood.car.yaw : road ? 0 : Math.PI;
      const impact = truckRoadPoint(road, { x: TRUCKS.roof.x, z: 11.5 }); this.impact!.position.set(impact.x, 3.2, impact.z); this.impact!.rotation.y = road ? Math.PI : 0;
      const fold = THREE.MathUtils.smoothstep(crashTime, 0, 1.15);
      for (const mesh of this.crumple) mesh.morphTargetInfluences![0] = fold;
      const buckle = THREE.MathUtils.smoothstep(crashTime, .25, 1.6);
      for (const mesh of this.trailers) mesh.morphTargetInfluences![0] = buckle;
      for (const axle of this.trailerAxles) {
        axle.root.position.set(0, 1.1 + axle.lift * buckle, axle.z + axle.compressed * buckle);
        axle.root.rotation.x = axle.bend * buckle;
      }
      this.impact!.visible = crashed;
      const fireTime = Math.max(0, crashTime - .55);
      this.fire!.visible = crashed && fireTime > 0;
      this.fire!.scale.set(1 + fireTime * .85, 1 + fireTime * 1.1, 1 + fireTime * .7);
      this.fire!.rotation.y = fireTime * .4;
      this.smoke!.position.y = crashTime * 2.3;
      this.smoke!.scale.setScalar(.55 + crashTime * .48);
      this.smoke!.visible = crashTime > .25;
      this.fragments!.visible = crashed;
      for (let i = 0; i < this.fragments!.children.length; i++) {
        const shard = this.fragments!.children[i], angle = i * 2.399963;
        // Paired outward trajectories keep debris out of the occupied trailer behind the cab.
        const side = i % 2 ? 1 : -1, speed = 3 + i % 7 * .42;
        const travel = crashTime * speed;
        shard.rotation.set(angle + crashTime * side * 1.6, angle * .6 + crashTime * 2, angle * .3);
        this.matrix.makeRotationFromEuler(shard.rotation);
        const width = i % 3 === 0 ? .65 : .28, height = i % 3 === 0 ? 1.1 : .45;
        const extent = (Math.abs(this.matrix.elements[1]) * width + Math.abs(this.matrix.elements[5]) * height) / 2;
        shard.position.set(side * (1.2 + travel), Math.max(-this.impact!.position.y + extent + .025,
          .4 + (3 + i % 5 * .7) * crashTime - 2.8 * crashTime * crashTime), Math.sin(angle) * (1 + travel * .5));
      }
      this.neoTrail!.visible = Boolean(trucks && trucks.phase === 'collision' && trucks.elapsed > 5.5);
      if (this.neoTrail!.visible) {
        const pose = truckApproachPose(trucks!.elapsed, road);
        this.neoTrail!.position.set(pose.x, pose.y, pose.z);
      }
    }
  }
  private batch(parent = this.root): void {
    parent.updateMatrixWorld(true); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...parent.children]) if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const source = child.geometry.clone().applyMatrix4(child.matrix); const geometry = source.index ? source.toNonIndexed() : source;
      if (source !== geometry) source.dispose();
      const list = batches.get(child.material) ?? []; list.push(geometry); batches.set(child.material, list); parent.remove(child);
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (geometry) this.mesh(geometry, material, 0, 0, 0, parent);
    }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.urban.dispose();
  }
}
