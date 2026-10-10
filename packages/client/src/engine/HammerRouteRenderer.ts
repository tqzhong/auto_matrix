import * as THREE from 'three';
import { HAMMER_ROUTE, HAMMER_COCKPIT, hammerShipPose, hammerCenter, hammerHalfWidth, hammerHeight, type HammerFlight } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The tunnel, ship and pursuers share the coordinates used by flight collision. */
export class HammerRouteRenderer {
  private group = new THREE.Group();
  private ship = new THREE.Group();
  private cockpit = new THREE.Group();
  private sentinels: THREE.Group[] = [];
  private engines: THREE.MeshStandardMaterial[] = [];
  private controls: THREE.Group[] = [];
  private needles: THREE.Mesh[] = [];
  private radio = new THREE.Group();
  private warning?: THREE.MeshStandardMaterial;
  private lights: THREE.Light[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();

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
    this.buildShip();
    this.buildCockpit();
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
    this.update(undefined, 0);
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = parent === this.ship; mesh.receiveShadow = true; parent.add(mesh); return mesh;
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
  private buildShip(): void {
    const hull = this.material(0x313a3a, .82, .43);
    const armor = this.material(0x59625e, .72, .52);
    const black = this.material(0x0c171b, .62, .3);
    const glow = this.material(0x7399b8, .2, .2, 0x43769c, 1.8);
    this.engines.push(glow);
    const keel = this.mesh(new THREE.BoxGeometry(6.4, 2.1, 18), hull, this.ship); keel.position.set(0, -3.7, 1.2);
    const nose = this.mesh(new THREE.ConeGeometry(3.1, 8, 12).scale(1, 1, .4), armor, this.ship);
    nose.rotation.x = -Math.PI / 2; nose.position.set(0, -3.75, -10.3);
    for (const side of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(.45, .55, 11.5), armor, this.ship); rail.position.set(side * 3.25, -2.7, -1.2);
      const pod = this.mesh(new THREE.CylinderGeometry(1.35, 1.65, 12, 12), hull, this.ship);
      pod.rotation.x = Math.PI / 2; pod.position.set(side * 4.1, -4.2, 2.4);
      for (const z of [-1.4, 1.4, 4.2]) {
        const coil = this.mesh(new THREE.TorusGeometry(1.56, .19, 8, 24), glow, this.ship);
        coil.position.set(side * 4.1, -4.2, z);
      }
      const exhaust = this.mesh(new THREE.ConeGeometry(1.2, 4.5, 10), glow, this.ship);
      exhaust.rotation.x = -Math.PI / 2; exhaust.position.set(side * 4.1, -4.2, 9.2);
      const vane = this.mesh(new THREE.BoxGeometry(1.15, .16, 12), armor, this.ship);
      vane.position.set(side * 5.6, -4.2, 2.5);
    }
    const tail = this.mesh(new THREE.BoxGeometry(5.2, 1.4, 5), black, this.ship); tail.position.set(0, -3.2, 8.1);
    this.radio.name = 'hammer-radio'; this.radio.position.set(0, 2.65, 5.6); this.ship.add(this.radio);
    const mast = this.mesh(new THREE.CylinderGeometry(.045, .09, 2.4, 8), armor, this.radio); mast.position.y = 1.2;
    const antenna = this.mesh(new THREE.BoxGeometry(2.3, .08, .09), armor, this.radio); antenna.position.y = 2.35;
    const beacon = new THREE.PointLight(0x91b4d4, 27, 17, 2); beacon.position.set(0, -3.1, 1);
    this.ship.add(beacon); this.lights.push(beacon);
  }

  private buildCockpit(): void {
    this.cockpit.name = 'hammer-cockpit'; this.ship.name = 'hammer-airframe';
    const frame = this.material(0x58656c, .72, .61), panel = this.material(0x1b232a, .54, .76);
    const leather = this.material(0x171a1c, .04, .92), metal = this.material(0x77868d, .8, .32);
    const display = this.material(0x799d9a, .05, .5, 0x486e72, .7);
    const button = this.material(0x9fada4, .25, .7), dark = this.material(0x0c1116, .25, .9);
    this.warning = this.material(0xa8702d, .1, .7, 0xbd6020, .2);
    const floor = HAMMER_COCKPIT.floor;
    const walk = HAMMER_COCKPIT.walk;
    const deck = this.mesh(new THREE.BoxGeometry(walk.right - walk.left, .16, walk.back - walk.front), panel, this.cockpit);
    deck.name = 'hammer-cabin-floor'; deck.position.set(0, floor - .08, (walk.front + walk.back) / 2 - HAMMER_ROUTE.start);
    for (let z = -8.5; z <= 9; z += .55) {
      const tread = this.mesh(new THREE.BoxGeometry(7.9, .012, .05), frame, this.cockpit); tread.position.set(0, floor + .01, z);
    }
    for (const side of [-1, 1]) {
      const lower = this.mesh(new THREE.BoxGeometry(.22, 1.9, 17.5), panel, this.cockpit); lower.position.set(side * 4.1, floor + .95, .2);
      const rail = this.mesh(new THREE.CylinderGeometry(.075, .075, 17.5, 8), metal, this.cockpit); rail.rotation.x = Math.PI / 2; rail.position.set(side * 3.93, -.35, .2);
      for (const z of [-8.35, -1, 4.7, 9]) {
        const rib = this.mesh(new THREE.BoxGeometry(.2, 4.85, .2), frame, this.cockpit); rib.position.set(side * 4.05, .075, z); rib.rotation.z = side * .09;
        const lintel = this.mesh(new THREE.BoxGeometry(8.15, .18, .2), frame, this.cockpit); lintel.position.set(0, 2.5, z);
      }
      for (let z = -.5; z <= 8; z += 1.7) {
        const equipment = this.mesh(new THREE.BoxGeometry(.4, 1.1, 1.15), dark, this.cockpit); equipment.position.set(side * 3.85, .55, z);
        for (let i = 0; i < 3; i++) { const slot = this.mesh(new THREE.BoxGeometry(.035, .045, .82), metal, this.cockpit); slot.position.set(side * 3.62, .3 + i * .2, z); }
      }
    }
    const glass = this.material(0x445d6e, .1, .2); glass.transparent = true; glass.opacity = .14; glass.depthWrite = false;
    const window = this.mesh(new THREE.PlaneGeometry(7.65, 3.2), glass, this.cockpit); window.name = 'hammer-front-glass'; window.position.set(0, .28, -8.45); window.rotation.x = -.12;
    for (const side of [-1, 1]) {
      const strut = this.mesh(new THREE.BoxGeometry(.14, 3.6, .18), metal, this.cockpit); strut.position.set(side * 2.55, .18, -8.36); strut.rotation.z = side * -.2;
      const pane = this.mesh(new THREE.PlaneGeometry(7.1, 3.6), glass, this.cockpit); pane.position.set(side * 4.02, .26, -4.7); pane.rotation.y = Math.PI / 2;
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
        const arm = this.mesh(new THREE.BoxGeometry(.16, .12, .92), leather, seat); arm.position.set(side * .77, 1.72, -.05);
        const pedal = this.mesh(new THREE.BoxGeometry(.42, .055, .5), metal, seat); pedal.position.set(side * .25, .04, -1.14); pedal.rotation.x = -.1;
      }
      const console = this.mesh(new THREE.BoxGeometry(1.47, 1.34, .48), panel, this.cockpit); console.position.set(position.x, floor + 1.48, position.z - 1.65);
      const crt = this.mesh(new THREE.BoxGeometry(.9, .58, .11), display, this.cockpit); crt.name = `${role}-hammer-crt`; crt.position.set(position.x, floor + 1.99, position.z - 1.38); crt.rotation.x = -.3;
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
  }
  update(flight: HammerFlight | undefined, elapsed: number, firstPerson = false): void {
    const pose = flight ?? { x: 0, z: HAMMER_ROUTE.start, speed: 0, lateral: 0, pursuit: 0, hull: 100 };
    const transform = hammerShipPose(pose), time = flight?.elapsed ?? 0;
    this.ship.position.set(transform.x, 1 + transform.y, transform.z);
    this.ship.rotation.set(0, transform.yaw, transform.roll);
    this.ship.visible = !firstPerson;
    this.cockpit.position.copy(this.ship.position); this.cockpit.rotation.copy(this.ship.rotation);
    this.controls.forEach(control => { control.rotation.z = -Math.max(-1, Math.min(1, pose.lateral / 13)) * .22; });
    this.needles.forEach((needle, i) => { needle.rotation.z = -1.2 + (i % 3 === 0 ? pose.speed / 38 : i % 3 === 1 ? pose.hull / 100 : pose.pursuit / 100) * 2.4; });
    this.warning!.emissiveIntensity = flight?.antennaLost || pose.hull < 50 ? .9 : .2;
    this.radio.visible = !flight?.antennaLost;
    for (const engine of this.engines) engine.emissiveIntensity = 1.5 + Math.sin(time * 12) * .3 + pose.speed / 35;
    this.sentinels.forEach((sentinel, i) => {
      const z = Math.min(187, pose.z + 23 + i * 7 - pose.pursuit * .11);
      sentinel.position.set(hammerCenter(z) + Math.sin(time * 2.5 + i * 3) * (2.7 + i), 1 + hammerHeight(z) + Math.cos(time * 4 + i) * 2, z);
      sentinel.rotation.z = Math.sin(time * 3 + i) * .18;
      sentinel.visible = Boolean(flight && flight.phase === 'riding');
    });
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
