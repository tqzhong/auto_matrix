import * as THREE from 'three';
import { LOGOS_DEFENSE, newLogosFlight, type LogosFlight, type LogosFlightMode } from '@auto_matrix/shared';

/** A shared physical stage for the Logos defense run and the ascent above the cloud deck. */
export class LogosFlightRenderer {
  private group = new THREE.Group();
  private ship = new THREE.Group();
  private cockpit = new THREE.Group();
  private pulse = new THREE.Group();
  private threats: THREE.Group[] = [];
  private swarms: THREE.Group[] = [];
  private clouds: THREE.Mesh[] = [];
  private cloudBank?: THREE.Group;
  private engines: THREE.MeshStandardMaterial[] = [];
  private sunMaterial?: THREE.MeshStandardMaterial;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];

  constructor(root: THREE.Group, private mode: LogosFlightMode) {
    root.add(this.group);
    this.buildShip();
    this.group.add(this.ship, this.cockpit, this.pulse);
    if (mode === 'defense') this.buildDefense();
    else this.buildSunrise();
    this.update(undefined, 0, false);
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0,
    transparent = false, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity,
      transparent, opacity, depthWrite: !transparent, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group, name?: string): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); if (name) mesh.name = name;
    mesh.castShadow = parent === this.ship; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private buildShip(): void {
    this.ship.name = 'logos-flight-ship'; this.cockpit.name = 'logos-flight-cockpit';
    const hull = this.material(0x293438, .88, .34);
    const edge = this.material(0x6c7778, .78, .3);
    const dark = this.material(0x10191d, .65, .42);
    const glass = this.material(0x355b63, .58, .14, 0x17373c, .55, true, .82);
    const engine = this.material(0xb6eff1, .25, .15, 0x72e7ec, 3.2); this.engines.push(engine);
    const core = this.mesh(new THREE.CylinderGeometry(2.5, 3.6, 17, 12), hull, this.ship);
    core.rotation.x = Math.PI / 2; core.position.z = .8;
    const nose = this.mesh(new THREE.ConeGeometry(2.55, 7.4, 10), edge, this.ship);
    nose.rotation.x = Math.PI / 2; nose.position.z = -11.1;
    const belly = this.mesh(new THREE.BoxGeometry(5.4, 1.1, 14), dark, this.ship); belly.position.set(0, -2.45, 1.7);
    const canopy = this.mesh(new THREE.SphereGeometry(2.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, this.ship);
    canopy.scale.set(1, .65, 1.45); canopy.rotation.x = Math.PI; canopy.position.set(0, 1.65, -4.8);
    for (const side of [-1, 1]) {
      const wing = this.mesh(new THREE.BoxGeometry(7.8, .28, 7.2), edge, this.ship);
      wing.position.set(side * 5, -.55, 1.1); wing.rotation.y = side * -.18; wing.rotation.z = side * -.08;
      const spar = this.mesh(new THREE.CylinderGeometry(.25, .38, 8, 8), hull, this.ship);
      spar.position.set(side * 4.4, -.15, -1); spar.rotation.z = Math.PI / 2 + side * .12;
      const pod = this.mesh(new THREE.CylinderGeometry(1.18, 1.5, 9.5, 12), dark, this.ship);
      pod.rotation.x = Math.PI / 2; pod.position.set(side * 6.5, -1.1, 2.8);
      for (const z of [.3, 3, 5.7]) {
        const ring = this.mesh(new THREE.TorusGeometry(1.37, .15, 8, 20), engine, this.ship);
        ring.position.set(side * 6.5, -1.1, z); ring.rotation.x = Math.PI / 2;
      }
      const exhaust = this.mesh(new THREE.ConeGeometry(1.2, 4.2, 12), engine, this.ship);
      exhaust.rotation.x = -Math.PI / 2; exhaust.position.set(side * 6.5, -1.1, 8.5);
      for (let i = 0; i < 3; i++) {
        const cable = this.mesh(new THREE.TorusGeometry(3.1 + i * .45, .07, 5, 18, Math.PI * .62), dark, this.ship);
        cable.position.set(side * 3.5, -1.2 - i * .24, 2.2 + i); cable.rotation.set(Math.PI / 2, side * .18, side > 0 ? -.9 : 2.25);
      }
    }
    for (let z = -5; z <= 5; z += 2.5) {
      const rib = this.mesh(new THREE.TorusGeometry(3.2, .16, 7, 18, Math.PI), edge, this.ship);
      rib.position.set(0, -.15, z); rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI / 2;
    }
    const dash = this.mesh(new THREE.BoxGeometry(4.7, .38, 1.2), dark, this.cockpit); dash.position.set(0, -.45, -3.1);
    const screen = this.material(0x67b8ae, .2, .18, 0x3bd4bd, 1.8);
    for (let i = -2; i <= 2; i++) {
      const display = this.mesh(new THREE.BoxGeometry(.62, .05, .42), screen, this.cockpit);
      display.position.set(i * .78, -.2 + Math.abs(i) * .05, -3.42); display.rotation.x = -.5;
    }
    for (const side of [-1, 1]) {
      const frame = this.mesh(new THREE.BoxGeometry(.17, 3.8, .28), edge, this.cockpit);
      frame.position.set(side * 2.7, 1.25, -3.45); frame.rotation.z = side * -.32;
    }
    const beacon = new THREE.PointLight(0x8cebf0, 32, 24, 2); beacon.position.set(0, -1, 3);
    this.ship.add(beacon); this.lights.push(beacon);

    this.pulse.name = 'logos-neo-pulse';
    const gold = this.material(0xffcf62, .15, .18, 0xffb321, 4, true, .75);
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(4.8 + i * 1.3, .13, 8, 48), gold, this.pulse);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = i * .65;
    }
  }

  private buildDefense(): void {
    const tower = this.material(0x222b2c, .86, .56);
    const edge = this.material(0x545f5c, .75, .48);
    const amber = this.material(0xd88937, .25, .2, 0xf08a25, 2.5);
    const storm = this.material(0x273436, .05, .95, 0x10191a, .12, true, .7);
    for (let row = 0; row < 7; row++) for (const side of [-1, 1]) {
      const z = 58 - row * 19;
      const h = 14 + (row * 11 % 24), x = side * (42 + row % 3 * 7);
      const spire = this.mesh(new THREE.CylinderGeometry(1.4, 5.5, h, 8), tower);
      spire.position.set(x, h / 2 - 4, z); spire.rotation.z = side * (.08 + row % 2 * .07);
      for (let y = 2; y < h; y += 5) {
        const eye = this.mesh(new THREE.TorusGeometry(1.7, .12, 6, 18), amber);
        eye.position.set(x - side * 2.2, y - 4, z); eye.rotation.y = Math.PI / 2;
      }
      const antenna = this.mesh(new THREE.ConeGeometry(1, 8, 6), edge); antenna.position.set(x, h + 4, z);
    }
    for (let i = 0; i < 24; i++) {
      const cloud = this.mesh(new THREE.IcosahedronGeometry(5 + i % 5 * 1.8, 1), storm);
      cloud.position.set(-48 + i % 8 * 14, 45 + i % 4 * 4, 55 - Math.floor(i / 8) * 50 - i % 3 * 5);
      cloud.scale.set(1.8, .45, 1.15); this.clouds.push(cloud);
    }
    for (const threat of LOGOS_DEFENSE.threats) {
      const bomb = new THREE.Group(); bomb.name = `logos-defense-threat-${threat.id}`;
      bomb.position.set(threat.x, 1 + threat.altitude, threat.z); this.group.add(bomb); this.threats.push(bomb);
      const core = this.mesh(new THREE.IcosahedronGeometry(threat.radius * .52, 1), tower, bomb);
      core.scale.set(1.2, .75, 1.4);
      const eye = this.mesh(new THREE.SphereGeometry(threat.radius * .16, 10, 8), amber, bomb); eye.position.z = -threat.radius * .62;
      for (let arm = 0; arm < 6; arm++) {
        const angle = arm / 6 * Math.PI * 2;
        const claw = this.mesh(new THREE.CylinderGeometry(.13, .32, threat.radius * 1.5, 6), edge, bomb);
        claw.position.set(Math.cos(angle) * threat.radius * .6, Math.sin(angle) * threat.radius * .45, threat.radius * .25);
        claw.rotation.x = Math.PI / 2 + Math.sin(angle) * .35; claw.rotation.z = angle * .22;
      }
    }
    for (let i = 0; i < 5; i++) {
      const swarm = new THREE.Group(); this.group.add(swarm); this.swarms.push(swarm);
      for (let j = 0; j < 6; j++) {
        const drone = this.mesh(new THREE.OctahedronGeometry(.48, 0), tower, swarm);
        drone.position.set(Math.sin(j * 2.2) * 3.4, Math.cos(j * 1.7) * 2.1, j * 1.3);
        const eye = this.mesh(new THREE.SphereGeometry(.11, 6, 5), amber, drone); eye.position.z = -.42;
      }
    }
    const fill = new THREE.HemisphereLight(0x8da1a1, 0x101719, 1.05); this.group.add(fill); this.lights.push(fill);
  }

  private buildSunrise(): void {
    const cloud = this.material(0xe6ded2, .02, .96, 0xb8a890, .08, true, .72);
    const shadow = this.material(0x77848d, .02, 1, 0x5d6570, .06, true, .68);
    const gold = this.material(0xffe2a1, .03, .45, 0xffc65f, 5.5);
    this.sunMaterial = gold;
    const bank = this.cloudBank = new THREE.Group(); bank.name = 'logos-cloud-bank'; this.group.add(bank);
    for (let i = 0; i < 68; i++) {
      const radius = 4.5 + (i * 17 % 7) * 1.05;
      const puff = this.mesh(new THREE.IcosahedronGeometry(radius, 1), i % 4 ? cloud : shadow, bank);
      const row = Math.floor(i / 17), column = i % 17;
      puff.position.set(-48 + column * 6 + Math.sin(i * 2.7) * 3, 4 + row * 3 + Math.cos(i) * 1.5, -45 + row * 26 + Math.sin(i * .7) * 8);
      puff.scale.set(1.65, .52 + i % 3 * .08, 1.22);
    }
    const sun = this.mesh(new THREE.SphereGeometry(5.4, 32, 20), gold, this.group, 'logos-sun');
    sun.position.set(-30, 43, -54);
    const haloMaterial = this.material(0xffdb8a, .02, .7, 0xffc15b, 2.4, true, .24);
    const halo = this.mesh(new THREE.SphereGeometry(9.5, 24, 16), haloMaterial); halo.position.copy(sun.position);
    const light = new THREE.DirectionalLight(0xffd69a, 4.2); light.position.set(-25, 46, -38); light.target.position.set(0, 20, 0);
    this.group.add(light, light.target); this.lights.push(light);
    const fill = new THREE.HemisphereLight(0xa9c8dd, 0x6f6867, 2.1); this.group.add(fill); this.lights.push(fill);
    for (let i = 0; i < 16; i++) {
      const mote = this.mesh(new THREE.SphereGeometry(.08 + i % 3 * .05, 6, 5), gold);
      mote.position.set(-24 + i * 3.1, 20 + i % 5 * 3.6, -36 + i % 4 * 12);
    }
  }

  update(flight: LogosFlight | undefined, elapsed: number, firstPerson = false): void {
    const pose = flight ?? newLogosFlight(this.mode);
    this.ship.position.set(pose.x, 1 + pose.altitude, pose.z);
    this.ship.rotation.y = -Math.atan2(pose.lateral, Math.max(1, pose.speed)) * .72;
    this.ship.rotation.z = Math.max(-.34, Math.min(.34, -pose.lateral * .022));
    this.ship.rotation.x = pose.stage === 'stall' ? Math.max(-.72, -.18 + pose.vertical * .025)
      : Math.max(-.32, Math.min(.32, -pose.vertical * .024));
    const completedFirstPerson = firstPerson && pose.phase !== 'riding';
    this.ship.visible = !firstPerson;
    this.cockpit.position.copy(this.ship.position); this.cockpit.rotation.copy(this.ship.rotation);
    this.cockpit.visible = firstPerson && Boolean(flight) && !completedFirstPerson;
    if (this.cloudBank) this.cloudBank.visible = !completedFirstPerson;
    for (const engine of this.engines) engine.emissiveIntensity = 1.8 + pose.speed * .1 + Math.sin(elapsed * 15) * .35;
    this.pulse.position.copy(this.ship.position); this.pulse.visible = Boolean(flight && flight.pulse > 0);
    if (this.pulse.visible) {
      const progress = 1 - pose.pulse / .5; this.pulse.scale.setScalar(.35 + progress * 3.8);
      this.pulse.rotation.y = elapsed * 2.2;
    }
    this.threats.forEach((threat, index) => {
      threat.visible = !(pose.resolved & 1 << index);
      threat.rotation.y = elapsed * (.55 + index * .04); threat.rotation.z = Math.sin(elapsed * 2 + index) * .12;
      threat.position.y = 1 + LOGOS_DEFENSE.threats[index].altitude + Math.sin(elapsed * 1.7 + index) * .7;
    });
    this.swarms.forEach((swarm, index) => {
      const z = pose.z - 18 - index * 19;
      swarm.position.set(Math.sin(elapsed * .8 + index) * (22 + index), 16 + index * 6 + Math.cos(elapsed + index) * 4, z);
      swarm.rotation.y = elapsed * .45 + index; swarm.visible = pose.mode === 'defense' && pose.phase === 'riding';
    });
    this.clouds.forEach((cloud, index) => { cloud.position.x += Math.sin(elapsed * .12 + index) * .002; });
    if (this.sunMaterial) this.sunMaterial.emissiveIntensity = pose.stage === 'sun' ? 7.2 : pose.stage === 'stall' ? 4.4 : 2.8;
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
