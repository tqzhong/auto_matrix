import * as THREE from 'three';
import { HAMMER_ROUTE, HAMMER_COCKPIT, HAMMER_BEAMS, HAMMER_RADIO, newHammerFlight, hammerRadioPose, hammerShipPoint, hammerControlTurn, hammerRouteFrame, hammerRoutePoint, hammerTunnelSection, hammerShipPose, hammerCenter, hammerHalfWidth, hammerHeight, type HammerFlight } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';
import { HammerGunneryRenderer } from './HammerGunneryRenderer.js';
import type { HammerHandover } from '@auto_matrix/shared';

/** The tunnel, ship and pursuers share the coordinates used by flight collision. */
export class HammerRouteRenderer {
  private gunner: HammerGunneryRenderer;
  private group = new THREE.Group();
  private ship = new THREE.Group();
  private cockpit = new THREE.Group();
  private planar = new THREE.Group();
  private spatial = new THREE.Group();
  private sentinels: THREE.Group[] = [];
  private engines: THREE.MeshStandardMaterial[] = [];
  private controls: THREE.Group[] = [];
  private needles: THREE.Mesh[] = [];
  private horizons: THREE.Group[] = [];
  private radio = new THREE.Group();
  private attacker = new THREE.Group();
  private cutter = new THREE.Group();
  private defense = new THREE.Group();
  private rounds: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  private attackerEyes?: THREE.MeshStandardMaterial;
  private sparks?: THREE.Points;
  private doors: THREE.Mesh[] = [];
  private warning?: THREE.MeshStandardMaterial;
  private lights: THREE.Light[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;

  constructor(root: THREE.Group) {
    root.add(this.group);
    const iron = this.material(0x3e4b4d, .78, .72);
    const rib = this.material(0x667776, .68, .8);
    const conduit = this.material(0x71817a, .4, .6);
    const lamp = this.material(0x9ef6e0, .1, .1, 0x6be8ca, 2);
    this.tunnel(iron);
    const fill = new THREE.HemisphereLight(0xb1c6dd, 0x222937, 1.2);
    this.group.add(fill); this.lights.push(fill);
    for (let z = -176; z <= 184; z += 14) {
      const x = hammerCenter(z), y = 1 + hammerHeight(z), radius = hammerHalfWidth(z);
      const ring = this.mesh(new THREE.TorusGeometry(radius * .99, .22, 8, 28), rib);
      ring.position.set(x, y, z);
      for (const side of [-1, 1]) {
        const pipe = this.mesh(new THREE.CylinderGeometry(.18, .18, 12.4, 8), conduit);
        pipe.rotation.x = Math.PI / 2; pipe.position.set(x + side * radius * .67, y - 4.2, z - 5.8);
      }
      const beacon = this.mesh(new THREE.BoxGeometry(1.25, .2, .65), lamp);
      beacon.position.set(x, y + radius * .78, z);
      if (Math.round(z / 14) % 2 === 0) {
        const light = new THREE.PointLight(0x85d1c3, 18, 25, 2);
        light.position.copy(beacon.position); this.group.add(light); this.lights.push(light);
      }
    }
    for (const [index, pipe] of HAMMER_ROUTE.debris.entries()) {
      const y = 1 + hammerHeight(pipe.z);
      const beam = this.mesh(new THREE.BoxGeometry(2.5 + index * .3, 7 + index, 3.8), rib);
      beam.position.set(pipe.x, y - 4, pipe.z); beam.rotation.z = index % 2 ? -.28 : .22;
      const warning = this.mesh(new THREE.BoxGeometry(2.6, .25, .32), this.material(0xf37c4d, .5, .5, 0xda4a22, .8));
      warning.position.set(pipe.x, y - .7, pipe.z + 2.1);
    }
    for (const object of [...this.group.children]) if (object !== fill) this.planar.add(object);
    this.group.add(this.planar, this.spatial);
    this.spatialTunnel(iron, rib, lamp);
    this.buildShip();
    this.buildCockpit();
    this.buildRadioAttack();
    this.group.add(this.ship);
    this.group.add(this.cockpit);
    for (let i = 0; i < 3; i++) {
      const sentinel = new THREE.Group();
      const shell = this.material(0x343c3d, .5, .8);
      const eye = this.material(0xff513d, .15, .2, 0xf43725, 2);
      const head = this.mesh(new THREE.IcosahedronGeometry(1.1, 1), shell, sentinel); head.scale.set(1.25, .65, 1.65);
      const lens = this.mesh(new THREE.SphereGeometry(.25, 10, 8), eye, sentinel); lens.position.z = -1.45;
      for (let t = 0; t < 5; t++) {
        const angle = t * Math.PI * 2 / 5;
        const tentacle = this.mesh(new THREE.CylinderGeometry(.08, .16, 5.8, 6), shell, sentinel);
        tentacle.rotation.x = Math.PI / 2 + Math.sin(angle) * .23;
        tentacle.position.set(Math.cos(angle) * .85, Math.sin(angle) * .6, 3.2);
      }
      this.group.add(sentinel); this.sentinels.push(sentinel);
    }
    batchStaticGeometry(this.cockpit, new Set()).forEach(geometry => this.geometries.add(geometry));
    batchStaticGeometry(this.ship, new Set()).forEach(geometry => this.geometries.add(geometry));
    batchStaticGeometry(this.attacker, new Set()).forEach(geometry => this.geometries.add(geometry));
    this.gunner = new HammerGunneryRenderer(this.group, this.cockpit);
    this.update(undefined, 0);
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = parent === this.ship; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private steel(color: number): THREE.MeshStandardMaterial {
    const material = this.material(color, .35, .7);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(.5, .5); texture.anisotropy = 4;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.14, .14); return material;
  }
  private tunnel(material: THREE.Material): void {
    const positions: number[] = [], indices: number[] = [];
    const sides = 24, segments = 72;
    for (let row = 0; row <= segments; row++) {
      const z = 190 - row * 380 / segments;
      const radius = hammerHalfWidth(z), cx = hammerCenter(z), cy = 1 + hammerHeight(z);
      for (let side = 0; side < sides; side++) {
        const angle = side * Math.PI * 2 / sides;
        positions.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * .9, z);
      }
    }
    for (let row = 0; row < segments; row++) for (let side = 0; side < sides; side++) {
      const a = row * sides + side, b = row * sides + (side + 1) % sides, c = a + sides, d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, material);
  }
  private spatialTunnel(iron: THREE.Material, rib: THREE.Material, lamp: THREE.Material): void {
    const positions: number[] = [], indices: number[] = [], sides = 24, segments = 200;
    for (let row = 0; row <= segments; row++) {
      const distance = -24 + row * 398 / segments, section = hammerTunnelSection(distance);
      for (let side = 0; side < sides; side++) {
        const angle = side * Math.PI * 2 / sides;
        const point = hammerRoutePoint(distance, { x: Math.cos(angle) * section.width, y: Math.sin(angle) * section.height, z: 0 });
        positions.push(point.x, point.y + 1, point.z);
      }
    }
    for (let row = 0; row < segments; row++) for (let side = 0; side < sides; side++) {
      const a = row * sides + side, b = row * sides + (side + 1) % sides, c = a + sides, d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, iron, this.spatial).name = 'hammer-spatial-tunnel';
    for (let distance = -20; distance <= 370; distance += 12) {
      const frame = hammerRouteFrame(distance), section = hammerTunnelSection(distance);
      const ring = this.mesh(new THREE.TorusGeometry(section.width + .1, .12, 6, 24), rib, this.spatial);
      ring.scale.y = section.height / section.width; ring.position.set(frame.x, frame.y + 1, frame.z); ring.rotation.set(frame.pitch, frame.yaw, 0, 'YXZ');
      const point = hammerRoutePoint(distance, { x: 0, y: section.height - .3, z: 0 });
      const beacon = this.mesh(new THREE.BoxGeometry(1.25, .2, .65), lamp, this.spatial);
      beacon.position.set(point.x, point.y + 1, point.z); beacon.rotation.copy(ring.rotation);
      if (distance % 24 === 4) {
        const light = new THREE.PointLight(0x85d1c3, 18, 25, 2); light.position.copy(beacon.position); this.spatial.add(light); this.lights.push(light);
      }
    }
    const warning = this.material(0xed9f55, .4, .6, 0xb86229, .7);
    for (const beam of HAMMER_BEAMS) {
      const frame = hammerRouteFrame(beam.distance), point = hammerRoutePoint(beam.distance, { x: 0, y: beam.y, z: 0 });
      const mesh = this.mesh(new THREE.BoxGeometry(beam.width, beam.height, beam.depth), rib, this.spatial);
      mesh.name = 'hammer-spatial-beam'; mesh.position.set(point.x, point.y + 1, point.z); mesh.rotation.set(frame.pitch, frame.yaw, 0, 'YXZ');
      for (const side of [-1, 1]) {
        const edge = this.mesh(new THREE.BoxGeometry(20, .16, .18), warning, mesh);
        edge.position.set(0, -Math.sign(beam.y) * beam.height / 2, side * (beam.depth / 2 + .1));
      }
    }
    batchStaticGeometry(this.spatial, new Set()).forEach(geometry => this.geometries.add(geometry));
  }
  private buildShip(): void {
    const hull = this.steel(0x59656b);
    const armor = this.steel(0x87908b);
    const black = this.material(0x0c171b, .62, .3);
    const glow = this.material(0x488d9f, .3, .35, 0x1c87a8, .85);
    this.engines.push(glow);
    const profile = [[0, -14.1], [1, -12.5], [2.45, -10], [3.2, -6.5], [3.2, 5.5], [2.6, 10.5], [0, 11]].map(([r, z]) => new THREE.Vector2(r, z));
    const keel = this.mesh(new THREE.LatheGeometry(profile, 32).rotateX(Math.PI / 2).scale(1, .32, 1), hull, this.ship);
    keel.position.y = -3.7;
    for (const z of [-10, -7, -4, -1, 2, 5, 8]) {
      const band = this.mesh(new THREE.TorusGeometry(z === -10 ? 2.45 : z === 8 ? 2.9 : 3.21, .055, 6, 32).scale(1, .32, 1), armor, this.ship);
      band.position.set(0, -3.7, z);
    }
    for (const side of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(.34, .4, 15.2), armor, this.ship); rail.position.set(side * 3.3, -2.85, .9);
      for (const z of [-2.3, 2.25, 6.8]) {
        const pod = new THREE.Group(); pod.name = 'hammer-hover-pad'; pod.position.set(side * 4.15, -4.15, z); this.ship.add(pod);
        this.mesh(new THREE.CylinderGeometry(1.38, 1.58, .65, 32), hull, pod);
        const face = this.mesh(new THREE.CylinderGeometry(1.34, 1.34, .08, 32), black, pod); face.position.y = -.37;
        for (const radius of [.48, .83, 1.18, 1.46]) {
          const coil = this.mesh(new THREE.TorusGeometry(radius, .043, 6, 32), glow, pod); coil.rotation.x = Math.PI / 2; coil.position.y = -.43;
        }
        for (let i = 0; i < 12; i++) {
          const angle = i * Math.PI / 6, clamp = this.mesh(new THREE.BoxGeometry(.14, .78, .2), armor, pod);
          clamp.position.set(Math.cos(angle) * 1.44, -.04, Math.sin(angle) * 1.44); clamp.rotation.y = -angle;
        }
        const strut = this.mesh(new THREE.CylinderGeometry(.12, .16, 1.5, 10), armor, this.ship); strut.rotation.z = side * -.78; strut.position.set(side * 3.6, -3.48, z);
        this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(side * 3.1, -3.1, z + .4), new THREE.Vector3(side * 3.7, -3.1, z + .6), new THREE.Vector3(side * 4.15, -3.8, z + .4)]), 8, .085, 6, false), black, this.ship);
      }
      for (let z = -5; z <= 8; z += 1.3) {
        const plate = this.mesh(new THREE.BoxGeometry(.09, .65, .95), armor, this.ship); plate.position.set(side * 3.21, -3.65, z);
      }
    }
    const tail = this.mesh(new THREE.BoxGeometry(4.8, .72, 1.7), black, this.ship); tail.position.set(0, -3.3, 9.6);
    for (let x = -2; x <= 2; x += .4) {
      const vent = this.mesh(new THREE.BoxGeometry(.12, .52, .12), armor, this.ship); vent.position.set(x, -3.3, 10.49);
    }
    this.radio.name = 'hammer-radio'; this.group.add(this.radio);
    const mast = this.mesh(new THREE.CylinderGeometry(.045, .09, 2.4, 8), armor, this.radio); mast.position.y = 1.2;
    const antenna = this.mesh(new THREE.BoxGeometry(2.3, .08, .09), armor, this.radio); antenna.position.y = 2.35;
    const beacon = new THREE.PointLight(0x91b4d4, 27, 17, 2); beacon.position.set(0, -3.1, 1);
    this.ship.add(beacon); this.lights.push(beacon);
  }

  private buildCanopy(panel: THREE.Material, frame: THREE.Material): void {
    const points = Array.from({ length: 25 }, (_, i) => new THREE.Vector2(4.08 * Math.cos(i * Math.PI / 24), 1.1 + 1.4 * Math.sin(i * Math.PI / 24)));
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (const z of [-8.85, 9.9]) for (const p of points) { positions.push(p.x, p.y, z); uv.push(p.x * .3, z * .3); }
    for (let i = 0; i < 24; i++) indices.push(i, i + 1, i + 25, i + 1, i + 26, i + 25);
    const roof = new THREE.BufferGeometry(); roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); roof.setIndex(indices); roof.computeVertexNormals();
    this.mesh(roof, panel, this.cockpit).name = 'hammer-cabin-roof';
    for (const z of [-8.8, -5.1, -.7, 4.7, 9.83]) {
      const rib = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x * .992, p.y - .07, z)));
      this.mesh(new THREE.TubeGeometry(rib, 24, .065, 6, false), frame, this.cockpit);
    }
    for (const side of [-1, 1]) {
      const wall = this.mesh(new THREE.BoxGeometry(.12, 1.7, 10.55), panel, this.cockpit); wall.name = 'hammer-cabin-shell'; wall.position.set(side * 4.06, .3, 4.55);
    }
    for (const rear of [false, true]) {
      const shape = new THREE.Shape(); shape.moveTo(-4.08, HAMMER_COCKPIT.floor); shape.lineTo(4.08, HAMMER_COCKPIT.floor);
      for (const p of points) shape.lineTo(p.x, p.y); shape.closePath();
      const opening = new THREE.Path();
      if (rear) { opening.moveTo(-2.1, -2.34); opening.lineTo(-2.1, 1.85); opening.lineTo(2.1, 1.85); opening.lineTo(2.1, -2.34); }
      else { opening.moveTo(-3.7, -1.32); opening.lineTo(-3.7, 1.4); opening.lineTo(-3.4, 1.86); opening.lineTo(3.4, 1.86); opening.lineTo(3.7, 1.4); opening.lineTo(3.7, -1.32); }
      opening.closePath(); shape.holes.push(opening);
      const bulkhead = this.mesh(new THREE.ShapeGeometry(shape), panel, this.cockpit); bulkhead.name = 'hammer-cabin-shell'; bulkhead.position.z = rear ? 9.9 : -8.85;
    }
    for (const side of [-1, 1]) {
      const door = this.mesh(new THREE.BoxGeometry(2.1, 4.18, .08).translate(-side * 1.05, 0, 0), panel, this.cockpit);
      door.name = 'hammer-aft-door'; door.position.set(side * 2.1, -.25, 9.84); this.doors.push(door);
      const handle = this.mesh(new THREE.CylinderGeometry(.055, .055, .65, 8), frame, door); handle.position.set(-side * 1.8, 0, -.1);
    }
    // A short enclosed vestibule lets the gunner pass out of sight behind the bridge doors.
    for (const y of [HAMMER_COCKPIT.floor - .08, 1.95]) {
      const deck = this.mesh(new THREE.BoxGeometry(4.2, .16, 4.4), panel, this.cockpit); deck.position.set(0, y, 12.1);
    }
    for (const side of [-1, 1]) {
      const wall = this.mesh(new THREE.BoxGeometry(.12, 4.3, 4.4), panel, this.cockpit); wall.position.set(side * 2.1, -.2, 12.1);
    }
    const rear = this.mesh(new THREE.BoxGeometry(4.2, 4.3, .12), panel, this.cockpit); rear.position.set(0, -.2, 14.3);
  }

  private buildRadioAttack(): void {
    this.attacker.name = 'hammer-radio-attacker'; this.group.add(this.attacker);
    const armor = this.material(0x626d74, .72, .4), joint = this.material(0x131c21, .5, .64);
    const eye = this.material(0xdf2112, .2, .3, 0xe52713, 1.2), laser = this.material(0xffa15e, .1, .4, 0xff6b27, 2);
    this.attackerEyes = eye;
    const head = this.mesh(new THREE.SphereGeometry(1, 20, 12), armor, this.attacker); head.scale.set(.95, .48, 1.12);
    for (const x of [-.5, 0, .5]) for (const y of [-.12, .15]) {
      const lens = this.mesh(new THREE.SphereGeometry(.11, 10, 8), eye, this.attacker); lens.position.set(x, y, -.97 + Math.abs(x) * .16);
    }
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, spread = .55 + i * .09;
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .7, .05, .4), new THREE.Vector3(side * spread * 1.4, .6, 1.1), new THREE.Vector3(-1.7 + side * spread * .8, -.5, -.5), new THREE.Vector3(-1.65 + side * .12, -1.42, -1.7 + i * .04)]);
      this.mesh(new THREE.TubeGeometry(path, 22, .045, 6, false), joint, this.attacker);
      for (let j = 0; j <= 12; j++) {
        const point = path.getPoint(j / 12), segment = this.mesh(new THREE.SphereGeometry(.071, 6, 4), armor, this.attacker); segment.position.copy(point);
      }
    }
    this.attacker.add(this.cutter);
    for (const side of [-1, 1]) {
      const from = new THREE.Vector3(side * .32, -.12, -.92), to = new THREE.Vector3(-1.65 + side * .09, -1.45, -1.7);
      const beam = this.mesh(new THREE.CylinderGeometry(.025, .025, from.distanceTo(to), 6), laser, this.cutter);
      beam.position.copy(from).add(to).multiplyScalar(.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    }
    const sparkGeometry = new THREE.BufferGeometry(); sparkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(32 * 3), 3)); this.geometries.add(sparkGeometry);
    const sparkMaterial = new THREE.PointsMaterial({ color: 0xffc385, size: .07, transparent: true, opacity: .95, depthWrite: false }); this.materials.add(sparkMaterial);
    this.sparks = new THREE.Points(sparkGeometry, sparkMaterial); this.sparks.name = 'hammer-radio-sparks'; this.group.add(this.sparks);
    this.group.add(this.defense); this.defense.name = 'hammer-radio-defense';
    for (const side of [-1, 1]) {
      const from = new THREE.Vector3(side * 3.8, 1.75, 3), to = new THREE.Vector3(1.65, 4.1, 7.3), direction = to.clone().sub(from).normalize();
      const mount = this.mesh(new THREE.SphereGeometry(.26, 12, 8), armor, this.cockpit); mount.position.copy(from);
      const barrel = this.mesh(new THREE.CylinderGeometry(.045, .07, .75, 8), joint, this.cockpit); barrel.position.copy(from).addScaledVector(direction, .25); barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      const tracer = this.mesh(new THREE.CylinderGeometry(.018, .018, 1.15, 5), laser, this.defense);
      tracer.quaternion.copy(barrel.quaternion); this.rounds.push({ mesh: tracer, from, to });
    }
  }

  private buildCockpit(): void {
    this.cockpit.name = 'hammer-cockpit'; this.ship.name = 'hammer-airframe';
    const frame = this.steel(0x88949d), panel = this.steel(0x47525b);
    const leather = this.material(0x171a1c, .04, .92), metal = this.material(0x77868d, .8, .32);
    const display = this.material(0x799d9a, .05, .5, 0x486e72, .7);
    const button = this.material(0x9fada4, .25, .7), dark = this.material(0x0c1116, .25, .9);
    this.warning = this.material(0xa8702d, .1, .7, 0xbd6020, .2);
    const floor = HAMMER_COCKPIT.floor;
    const walk = HAMMER_COCKPIT.walk;
    this.buildCanopy(panel, frame);
    const deck = this.mesh(new THREE.BoxGeometry(walk.right - walk.left, .16, walk.back - walk.front), panel, this.cockpit);
    deck.name = 'hammer-cabin-floor'; deck.position.set(0, floor - .08, (walk.front + walk.back) / 2 - HAMMER_ROUTE.start);
    for (let z = -8.5; z <= 9; z += .55) {
      const tread = this.mesh(new THREE.BoxGeometry(7.9, .012, .05), frame, this.cockpit); tread.position.set(0, floor + .01, z);
    }
    for (const side of [-1, 1]) {
      const lower = this.mesh(new THREE.BoxGeometry(.22, 1.9, 17.5), panel, this.cockpit); lower.position.set(side * 4.1, floor + .95, .2);
      const rail = this.mesh(new THREE.CylinderGeometry(.075, .075, 17.5, 8), metal, this.cockpit); rail.rotation.x = Math.PI / 2; rail.position.set(side * 3.93, -.35, .2);
      for (const z of [-8.35, -1, 4.7, 9]) {
        const rib = this.mesh(new THREE.BoxGeometry(.18, 3.46, .18), frame, this.cockpit); rib.position.set(side * 4.05, -.61, z);
      }
      for (let z = -.5; z <= 8; z += 1.7) {
        const equipment = this.mesh(new THREE.BoxGeometry(.4, 1.1, 1.15), dark, this.cockpit); equipment.position.set(side * 3.85, .55, z);
        for (let i = 0; i < 3; i++) { const slot = this.mesh(new THREE.BoxGeometry(.035, .045, .82), metal, this.cockpit); slot.position.set(side * 3.62, .3 + i * .2, z); }
      }
    }
    const glass = this.material(0x445d6e, .1, .2); glass.transparent = true; glass.opacity = .14; glass.depthWrite = false;
    const window = this.mesh(new THREE.PlaneGeometry(7.45, 3.2), glass, this.cockpit); window.name = 'hammer-front-glass'; window.position.set(0, .28, -8.79);
    for (const side of [-1, 1]) {
      const strut = this.mesh(new THREE.BoxGeometry(.14, 3.6, .18), metal, this.cockpit); strut.position.set(side * 2.55, .18, -8.36); strut.rotation.z = side * -.2;
      const pane = this.mesh(new THREE.PlaneGeometry(7.1, 2.4), glass, this.cockpit); pane.position.set(side * 4.02, -.05, -4.7); pane.rotation.y = Math.PI / 2;
    }
    for (const role of ['niobe', 'morpheus'] as const) {
      const position = HAMMER_COCKPIT.roots[role];
      const seat = new THREE.Group(); seat.name = `${role}-hammer-seat`; seat.position.set(position.x, floor, position.z); this.cockpit.add(seat);
      const mount = this.mesh(new THREE.CylinderGeometry(.3, .4, .7, 10), frame, seat); mount.position.y = .45;
      const cushion = this.mesh(new THREE.BoxGeometry(1.38, .22, 1.32), leather, seat); cushion.name = 'hammer-seat-cushion'; cushion.position.set(0, HAMMER_COCKPIT.seat - .11, 0);
      const back = this.mesh(new THREE.BoxGeometry(1.28, 1.9, .18), leather, seat); back.name = 'hammer-seat-back'; back.position.set(0, 2.02, .65); back.rotation.x = -.06;
      const headrest = this.mesh(new THREE.BoxGeometry(.83, .43, .21), leather, seat); headrest.position.set(0, 2.96, .72);
      for (const side of [-1, 1]) {
        const bracket = this.mesh(new THREE.CylinderGeometry(.035, .035, 2.3, 8), metal, seat); bracket.position.set(side * .58, 1.99, .75);
        const arm = this.mesh(new THREE.BoxGeometry(.16, .12, .92), leather, seat); arm.name = 'hammer-seat-armrest'; arm.position.set(side * .77, 1.72, -.05);
        const pedal = this.mesh(new THREE.BoxGeometry(.42, .055, .5), metal, seat); pedal.position.set(side * .25, .04, -1.14); pedal.rotation.x = -.1;
      }
      const console = this.mesh(new THREE.BoxGeometry(1.47, 1.34, .48), panel, this.cockpit); console.position.set(position.x, floor + 1.48, position.z - 1.65);
      const crt = this.mesh(new THREE.BoxGeometry(.9, .58, .11), display, this.cockpit); crt.name = `${role}-hammer-crt`; crt.position.set(position.x, floor + 1.99, position.z - 1.38); crt.rotation.x = -.3;
      const horizon = new THREE.Group(); horizon.name = `${role}-hammer-horizon`; crt.add(horizon); horizon.position.z = .062; this.horizons.push(horizon);
      const line = this.mesh(new THREE.BoxGeometry(.55, .014, .005), button, horizon);
      line.position.y = 0;
      const centerMark = this.mesh(new THREE.BoxGeometry(.014, .12, .005), button, horizon); centerMark.position.y = -.06;
      for (let i = 0; i < 9; i++) {
        const key = this.mesh(new THREE.BoxGeometry(.09, .035, .065), i === 8 ? this.warning : button, this.cockpit);
        key.position.set(position.x + (i % 3 - 1) * .24, floor + 1.72, position.z - 1.4 + Math.floor(i / 3) * .09);
      }
      for (let i = 0; i < 3; i++) {
        const bezel = this.mesh(new THREE.CylinderGeometry(.12, .12, .045, 16), metal, this.cockpit); bezel.rotation.x = Math.PI / 2; bezel.position.set(position.x + (i - 1) * .33, floor + 1.36, position.z - 1.39);
        const gauge = this.mesh(new THREE.CircleGeometry(.095, 16), dark, this.cockpit); gauge.position.copy(bezel.position); gauge.position.z += .025;
        const needle = this.mesh(new THREE.BoxGeometry(.015, .13, .008), button, this.cockpit); needle.position.copy(gauge.position); needle.position.z += .009; this.needles.push(needle);
      }
      const control = new THREE.Group(); control.name = `${role}-hammer-yoke`; control.position.set(position.x, floor + 1.86, position.z - HAMMER_COCKPIT.grip.z); this.cockpit.add(control); this.controls.push(control);
      const arm = this.mesh(new THREE.BoxGeometry(.97, .07, .09), metal, control);
      for (const side of [-1, 1]) {
        const grip = this.mesh(new THREE.CylinderGeometry(.068, .068, .38, 12), leather, control); grip.name = 'hammer-control-grip'; grip.position.set(side * HAMMER_COCKPIT.grip.x, HAMMER_COCKPIT.grip.y - 1.86, 0);
        const trigger = this.mesh(new THREE.SphereGeometry(.047, 8, 6), this.warning, control); trigger.position.set(side * HAMMER_COCKPIT.grip.x, .42, 0);
      }
      const column = this.mesh(new THREE.CylinderGeometry(.055, .09, 1.25, 8), metal, this.cockpit); column.rotation.x = .28; column.position.set(position.x, floor + 1.2, position.z - .76);
      arm.position.y = .03;
    }
    const brace = this.mesh(new THREE.CylinderGeometry(.055, .055, 3.4, 8), metal, this.cockpit); brace.name = 'roland-hammer-brace'; brace.rotation.z = Math.PI / 2; brace.position.set(0, floor + 2.2, HAMMER_COCKPIT.roots.roland.z - .45);
    for (const z of [-6, 1, 7]) {
      const light = new THREE.PointLight(0x9cafce, 11, 7, 2); light.position.set(0, 1.7, z); this.cockpit.add(light); this.lights.push(light);
    }
    for (const side of [-1, 1]) {
      const light = new THREE.SpotLight(0xb7d5e3, 480, 85, .52, .65, 1.4);
      light.position.set(side * 3.3, -.9, -8.6); light.target.position.set(side * 3.3, -.9, -65);
      this.cockpit.add(light, light.target); this.lights.push(light);
    }
  }
  update(flight: HammerFlight | undefined, elapsed: number, firstPerson = false, handover?: HammerHandover): void {
    const pose = flight ?? newHammerFlight();
    this.planar.visible = !pose.maneuver; this.spatial.visible = Boolean(pose.maneuver);
    const transform = hammerShipPose(pose), time = flight?.elapsed ?? 0;
    this.ship.position.set(transform.x, 1 + transform.y, transform.z);
    this.ship.rotation.set(transform.pitch, transform.yaw, transform.roll, 'YXZ');
    this.ship.visible = !firstPerson;
    this.cockpit.position.copy(this.ship.position); this.cockpit.rotation.copy(this.ship.rotation);
    this.gunner.update(flight);
    this.controls.forEach(control => { control.rotation.z = -hammerControlTurn(pose); });
    this.needles.forEach((needle, i) => { needle.rotation.z = -1.2 + (i % 3 === 0 ? pose.speed / 38 : i % 3 === 1 ? pose.hull / 100 : pose.pursuit / 100) * 2.4; });
    this.horizons.forEach(horizon => { horizon.rotation.z = -transform.roll; horizon.position.y = Math.sin(transform.pitch) * .12; });
    this.warning!.emissiveIntensity = flight?.antennaLost || pose.hull < 50 ? .9 : .2;
    const closing = handover ? Math.max(0, Math.min(1, (handover.elapsed - 11.4) / 1.1)) : Math.min(1, time / 1.1);
    this.doors.forEach(door => { door.rotation.y = -Math.sign(door.position.x) * Math.PI / 2 * (1 - closing); });
    const radioPose = hammerRadioPose(pose), attack = pose.maneuver ? pose.radio : undefined;
    this.radio.position.set(radioPose.x, radioPose.y + 1, radioPose.z); this.radio.rotation.set(radioPose.pitch, radioPose.yaw, radioPose.roll, 'YXZ');
    this.radio.visible = attack ? attack.phase !== 'lost' : !pose.antennaLost;
    this.attacker.visible = Boolean(attack && attack.phase !== 'intact' && attack.phase !== 'lost');
    if (attack && this.attacker.visible) {
      const t = attack.elapsed, fall = attack.phase === 'falling' ? t : 0;
      const target = hammerShipPoint(pose, { x: 1.65 + fall * 3, y: 4.1 + fall * 2 - fall * fall * 4.9, z: 7.3 + fall * 12 });
      const approach = hammerRoutePoint(175 - pose.z - 24, { x: 0, y: 3.5, z: 0 });
      const progress = attack.phase === 'approach' ? THREE.MathUtils.smoothstep(t / HAMMER_RADIO.approach, 0, 1) : 1;
      this.attacker.position.set(THREE.MathUtils.lerp(approach.x, target.x, progress), 1 + THREE.MathUtils.lerp(approach.y, target.y, progress), THREE.MathUtils.lerp(approach.z, target.z, progress));
      this.attacker.rotation.set(transform.pitch, transform.yaw, transform.roll + Math.max(0, fall - .45) * 2.5, 'YXZ');
      this.attackerEyes!.emissiveIntensity = fall ? 0 : 1.2;
    }
    this.cutter.visible = attack?.phase === 'cutting'; this.sparks!.visible = attack?.phase === 'cutting';
    this.defense.position.copy(this.ship.position); this.defense.rotation.copy(this.ship.rotation);
    this.defense.visible = attack?.phase === 'cutting' && attack.elapsed > .95 && attack.elapsed % .14 < .085;
    this.rounds.forEach(({ mesh, from, to }, i) => mesh.position.lerpVectors(from, to, ((attack?.elapsed ?? 0) * 7 + i * .3) % 1));
    if (this.sparks!.visible) {
      const point = hammerShipPoint(pose, { x: 0, y: 2.65, z: 5.6 }); this.sparks!.position.set(point.x, point.y + 1, point.z);
      const positions = this.sparks!.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const age = (attack!.elapsed * 2 + i / positions.count) % 1;
        positions.setXYZ(i, Math.sin(i * 2.4) * age * .9, age * .8 - 1.5 * age * age, Math.cos(i * 3.1) * age * .8);
      }
      positions.needsUpdate = true;
    }
    for (const engine of this.engines) engine.emissiveIntensity = .75 + Math.sin(time * 12) * .12 + pose.speed / 80;
    this.sentinels.forEach((sentinel, i) => {
      if (flight?.gunnery) { sentinel.visible = false; return; }
      if (i === 0 && attack && attack.phase !== 'intact') { sentinel.visible = false; return; }
      if (pose.maneuver) {
        const distance = Math.max(-20, 175 - pose.z - 23 - i * 7 + pose.pursuit * .11), frame = hammerRouteFrame(distance);
        const point = hammerRoutePoint(distance, { x: Math.sin(time * 2.5 + i * 3) * 3, y: Math.cos(time * 4 + i) * 2, z: 0 });
        sentinel.position.set(point.x, point.y + 1, point.z); sentinel.rotation.set(frame.pitch, frame.yaw, Math.sin(time * 3 + i) * .18, 'YXZ');
        sentinel.visible = Boolean(flight && flight.phase === 'riding'); return;
      }
      const z = Math.min(187, pose.z + 23 + i * 7 - pose.pursuit * .11);
      sentinel.position.set(hammerCenter(z) + Math.sin(time * 2.5 + i * 3) * (2.7 + i), 1 + hammerHeight(z) + Math.cos(time * 4 + i) * 2, z);
      sentinel.rotation.z = Math.sin(time * 3 + i) * .18;
      sentinel.visible = Boolean(flight && flight.phase === 'riding');
    });
  }
  dispose(): void {
    this.gunner.dispose();
    this.disposed = true;
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
    this.textures.forEach(texture => texture.dispose());
  }
}
