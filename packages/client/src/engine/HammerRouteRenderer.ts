import * as THREE from 'three';
import { HAMMER_ROUTE, hammerCenter, hammerHalfWidth, hammerHeight, type HammerFlight } from '@auto_matrix/shared';

/** The tunnel, ship and pursuers share the coordinates used by flight collision. */
export class HammerRouteRenderer {
  private group = new THREE.Group();
  private ship = new THREE.Group();
  private cockpit = new THREE.Group();
  private sentinels: THREE.Group[] = [];
  private engines: THREE.MeshStandardMaterial[] = [];
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
    const fill = new THREE.HemisphereLight(0xa9d3cf, 0x24383a, 1.2);
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
    const glass = this.material(0x28494c, .47, .18, 0x102a2b, .25);
    const glow = this.material(0x80e8d9, .2, .2, 0x52e9df, 2.5);
    this.engines.push(glow);
    const keel = this.mesh(new THREE.BoxGeometry(6.4, 2.1, 18), hull, this.ship); keel.position.set(0, -2.7, 1.2);
    const nose = this.mesh(new THREE.ConeGeometry(3.1, 8, 6), armor, this.ship);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, -2.2, -10.3);
    const canopy = this.mesh(new THREE.SphereGeometry(3.15, 16, 10), glass, this.ship);
    canopy.scale.set(1, .36, 1.75); canopy.position.set(0, -1.15, -3.1);
    for (const side of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(.45, .55, 11.5), armor, this.ship); rail.position.set(side * 3.25, -.65, -1.2);
      const pod = this.mesh(new THREE.CylinderGeometry(1.35, 1.65, 12, 12), hull, this.ship);
      pod.rotation.x = Math.PI / 2; pod.position.set(side * 4.1, -2.7, 2.4);
      for (const z of [-1.4, 1.4, 4.2]) {
        const coil = this.mesh(new THREE.TorusGeometry(1.56, .19, 8, 24), glow, this.ship);
        coil.position.set(side * 4.1, -2.7, z);
      }
      const exhaust = this.mesh(new THREE.ConeGeometry(1.2, 4.5, 10), glow, this.ship);
      exhaust.rotation.x = -Math.PI / 2; exhaust.position.set(side * 4.1, -2.7, 9.2);
      const vane = this.mesh(new THREE.BoxGeometry(1.15, .16, 12), armor, this.ship);
      vane.position.set(side * 5.6, -2.55, 2.5);
    }
    const tail = this.mesh(new THREE.BoxGeometry(5.2, 1.4, 5), black, this.ship); tail.position.set(0, -1.55, 8.1);
    const dash = this.mesh(new THREE.BoxGeometry(3.4, .4, .65), glow, this.ship); dash.position.set(0, -.25, -3.7);
    const cockpitDash = this.mesh(new THREE.BoxGeometry(4.2, .4, .85), black, this.cockpit); cockpitDash.position.set(0, .35, -3.3);
    const display = this.material(0x5a9990, .25, .2, 0x3caaa0, .85);
    for (let i = -1; i <= 1; i++) {
      const screen = this.mesh(new THREE.BoxGeometry(.8, .05, .3), display, this.cockpit);
      screen.position.set(i * 1.1, .59, -3.25);
    }
    for (const side of [-1, 1]) {
      const strut = this.mesh(new THREE.BoxGeometry(.17, 2.4, .22), armor, this.cockpit);
      strut.position.set(side * 2.3, 2.15, -3.4); strut.rotation.z = side * -.25;
      const sill = this.mesh(new THREE.BoxGeometry(.3, .25, 4.2), armor, this.cockpit);
      sill.position.set(side * 2.4, 1.15, -1.4);
    }
    const beacon = new THREE.PointLight(0x71e6d8, 35, 17, 2); beacon.position.set(0, -1.4, 1);
    this.ship.add(beacon); this.lights.push(beacon);
  }
  update(flight: HammerFlight | undefined, elapsed: number, firstPerson = false): void {
    const pose = flight ?? { x: 0, z: HAMMER_ROUTE.start, speed: 0, lateral: 0, pursuit: 0, hull: 100 };
    this.ship.position.set(pose.x, 1 + hammerHeight(pose.z), pose.z);
    this.ship.rotation.y = -Math.atan2(pose.lateral, Math.max(1, pose.speed)) * .7;
    this.ship.rotation.z = Math.max(-.18, Math.min(.18, -pose.lateral * .012));
    this.ship.visible = !firstPerson;
    this.cockpit.position.copy(this.ship.position); this.cockpit.rotation.copy(this.ship.rotation); this.cockpit.visible = firstPerson && Boolean(flight);
    for (const engine of this.engines) engine.emissiveIntensity = 1.5 + Math.sin(elapsed * 12) * .3 + pose.speed / 35;
    this.sentinels.forEach((sentinel, i) => {
      const z = Math.min(187, pose.z + 23 + i * 7 - pose.pursuit * .11);
      sentinel.position.set(hammerCenter(z) + Math.sin(elapsed * 2.5 + i * 3) * (2.7 + i), 1 + hammerHeight(z) + Math.cos(elapsed * 4 + i) * 2, z);
      sentinel.rotation.z = Math.sin(elapsed * 3 + i) * .18;
      sentinel.visible = Boolean(flight && flight.phase === 'riding');
    });
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
