import * as THREE from 'three';
import { batchStaticGeometry } from './StaticGeometry.js';
import { LogosAtmosphere } from './LogosAtmosphere.js';
import { LogosImpactRenderer } from './LogosImpactRenderer.js';
import { LOGOS_DEFENSE, LOGOS_COCKPIT, logosShipPose, logosControlGrip, logosIgniterGrip, logosPowered, logosCloudTop, newLogosFlight, type LogosFlight, type LogosFlightMode } from '@auto_matrix/shared';

/** A shared physical stage for the Logos defense run and the ascent above the cloud deck. */
export class LogosFlightRenderer {
  private group = new THREE.Group();
  private ship = new THREE.Group();
  private cockpit = new THREE.Group();
  private pulse = new THREE.Group();
  private grips: { mesh: THREE.Mesh; side: number }[] = [];
  private displays?: THREE.MeshStandardMaterial;
  private glyphs?: THREE.MeshStandardMaterial;
  private engineLight?: THREE.PointLight;
  private igniter?: THREE.Mesh;
  private igniterShaft?: THREE.Mesh;
  private igniterLamp?: THREE.MeshStandardMaterial;
  private discharge = new THREE.Group();
  private threats: THREE.Group[] = [];
  private swarms: THREE.Group[] = [];
  private atmosphere: LogosAtmosphere;
  private impact: LogosImpactRenderer;
  private engines: THREE.MeshStandardMaterial[] = [];
  private sunlight = new THREE.DirectionalLight(0xffdfb1, 0);
  private skyFill = new THREE.HemisphereLight(0xa4b8c7, 0x252c36, .7);
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];

  constructor(root: THREE.Group, private mode: LogosFlightMode) {
    root.add(this.group);
    this.buildShip();
    this.group.add(this.ship, this.pulse); this.ship.add(this.cockpit);
    batchStaticGeometry(this.ship, new Set(this.grips.map(grip => grip.mesh))).forEach(geometry => this.geometries.add(geometry));
    this.impact = new LogosImpactRenderer(this.group, this.ship);
    if (mode === 'defense') this.buildDefense();
    this.atmosphere = new LogosAtmosphere(this.group);
    this.sunlight.position.set(-44, 18, -87); this.group.add(this.sunlight, this.sunlight.target, this.skyFill);
    this.lights.push(this.sunlight, this.skyFill);
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
    const engine = this.material(0xb6eff1, .25, .15, 0x72e7ec, 3.2); this.engines.push(engine);
    const core = this.mesh(new THREE.CylinderGeometry(3.25, 3.6, 10, 20), hull, this.ship);
    core.rotation.x = Math.PI / 2; core.position.set(0, -.25, 5.9); core.name = 'logos-aft-hull';
    const nose = this.mesh(new THREE.ConeGeometry(2.55, 7.4, 10), edge, this.ship);
    nose.rotation.x = Math.PI / 2; nose.scale.y = .48; nose.position.set(0, -2.75, -9.1); nose.name = 'logos-lower-nose';
    const belly = this.mesh(new THREE.BoxGeometry(5.4, 1.1, 14), dark, this.ship); belly.position.set(0, -2.45, 1.7);
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
    for (let z = 1; z <= 9; z += 2) {
      const rib = this.mesh(new THREE.TorusGeometry(3.2, .16, 7, 18, Math.PI), edge, this.ship);
      rib.position.set(0, -.15, z); rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI / 2;
    }
    this.buildCockpit(hull, edge, dark);
    const beacon = this.engineLight = new THREE.PointLight(0x8cebf0, 32, 24, 2); beacon.position.set(0, -1, 3);
    this.ship.add(beacon); this.lights.push(beacon);
    const arc = this.material(0xb3d9f8, 0, .4, 0x4a92ec, 2, true, .75);
    for (const side of [-1, 1]) {
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 6.5, -.1, 3), new THREE.Vector3(side * 5.5, 1.3, 1),
        new THREE.Vector3(side * 4.3, .6, -2), new THREE.Vector3(side * 3.4, 3, -4)]);
      this.mesh(new THREE.TubeGeometry(path, 14, .035, 5, false), arc, this.discharge);
    }
    this.discharge.name = 'logos-cloud-discharge'; this.ship.add(this.discharge);

    this.pulse.name = 'logos-neo-pulse';
    const gold = this.material(0xffcf62, .15, .18, 0xffb321, 4, true, .75);
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(new THREE.TorusGeometry(4.8 + i * 1.3, .13, 8, 48), gold, this.pulse);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = i * .65;
    }
  }

  private buildCockpit(hull: THREE.Material, edge: THREE.Material, dark: THREE.Material): void {
    const floor = LOGOS_COCKPIT.floor;
    const fabric = this.material(0x242a2c, .08, .96), trim = this.material(0x828b90, .62, .45);
    const screen = this.displays = this.material(0x233b4d, .05, .38, 0x365a79, .85);
    const glyph = this.glyphs = this.material(0x89a9bd, .02, .65, 0x5285a3, .6);
    const box = (name: string, size: number[], point: number[], material: THREE.Material, parent = this.cockpit) => {
      const part = this.mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, parent, name);
      if (!['logos-cabin-floor', 'logos-cabin-roof', 'logos-seat-cushion', 'logos-seat-back'].includes(name)) part.name = '';
      part.position.set(point[0], point[1], point[2]); return part;
    };
    box('logos-cabin-floor', [6.8, .18, 10.8], [0, floor - .09, -4.55], dark);
    box('logos-cabin-roof', [6.8, .14, 9.7], [0, 3.25, -3.95], hull);
    box('logos-cabin-rear-wall', [6.8, 4.35, .16], [0, 1.075, .83], hull);
    box('logos-aft-hatch', [1.65, 3.25, .12], [0, .56, .69], dark);
    for (const side of [-1, 1]) {
      box('logos-window-sill', [.18, 1.1, 10.6], [side * 3.3, floor + .55, -4.6], hull);
      for (const z of [-9.7, -5.8, -2.4, .7]) {
        const pillar = box('logos-window-frame', [.13, 3.22, .15], [side * 3.28, 1.58, z], trim);
        pillar.rotation.z = -side * .045;
      }
      for (const y of [.04, 3.15]) box('logos-window-frame', [.18, .13, 10.55], [side * 3.28, y, -4.55], trim);
      // Cables and mechanical joints flank the windows, leaving the pilots' sightline open.
      for (let i = 0; i < 3; i++) {
        const path = new THREE.CatmullRomCurve3([new THREE.Vector3(side * (3.04 - i * .12), 3.04, -9.4),
          new THREE.Vector3(side * (3.07 - i * .12), 2.9, -4), new THREE.Vector3(side * 3.12, 1.9 - i * .2, .55)]);
        this.mesh(new THREE.TubeGeometry(path, 20, .035, 6, false), dark, this.cockpit);
      }
      for (const z of [-3.4, -1.65]) {
        box('logos-side-crt-case', [.74, .74, .5], [side * 2.57, 1.73, z], dark);
        box('logos-side-crt', [.61, .52, .025], [side * 2.57, 1.73, z - .263], screen);
        for (let i = 0; i < 4; i++) box('logos-crt-scan', [.42 - i * .035, .012, .012], [side * 2.57, 1.57 + i * .1, z - .28], glyph);
      }
    }
    box('logos-front-sill', [6.6, .35, .25], [0, .16, -9.77], edge);
    box('logos-windscreen-top', [6.6, .13, .18], [0, 3.19, -9.77], trim);
    for (const role of ['trinity', 'neo'] as const) {
      const root = LOGOS_COCKPIT.roots[role], seat = new THREE.Group(); seat.name = `${role}-logos-seat`;
      seat.position.set(root.x, floor, root.z); this.cockpit.add(seat);
      const mount = this.mesh(new THREE.CylinderGeometry(.25, .39, .86, 12), trim, seat); mount.position.y = .52;
      box('logos-seat-cushion', [1.35, .22, 1.04], [0, LOGOS_COCKPIT.seat - .11, .08], fabric, seat);
      box('logos-seat-back', [1.23, 1.43, .16], [0, 1.98, .64], fabric, seat);
      if (role === 'trinity') {
        const grip = logosIgniterGrip(newLogosFlight('sun'));
        box('logos-igniter-mount', [.28, .16, .38], [-grip.x, 4.23, -grip.z], dark, seat);
        this.igniter = this.mesh(new THREE.CylinderGeometry(.07, .07, .34, 12), fabric, seat, 'logos-igniter-grip');
        this.igniterShaft = this.mesh(new THREE.CylinderGeometry(.035, .035, 1, 10), trim, seat, 'logos-igniter-shaft');
        const lamp = this.igniterLamp = this.material(0x9f471b, .1, .45, 0xe66e20, .3);
        const indicator = this.mesh(new THREE.SphereGeometry(.055, 8, 8), lamp, seat);
        indicator.position.set(-grip.x, 4.12, -grip.z - .19);
      }
      const rest = this.mesh(new THREE.TorusGeometry(.45, .045, 8, 32), trim, seat, 'logos-mesh-headrest'); rest.position.set(0, 2.96, .65);
      for (let i = -4; i <= 4; i++) {
        const offset = i * .09, length = Math.sqrt(.44 ** 2 - offset ** 2) * 2;
        box('logos-headrest-net', [.014, length, .014], [offset, 2.96, .65], fabric, seat);
        box('logos-headrest-net', [length, .014, .014], [0, 2.96 + offset, .65], fabric, seat);
      }
      for (const side of [-1, 1]) {
        box('logos-seat-rail', [.055, 2.45, .07], [side * .54, 1.9, .76], trim, seat);
        box('logos-seat-arm', [.12, .12, 1.12], [side * .74, 1.57, -.04], fabric, seat);
        const grip = logosControlGrip(newLogosFlight(this.mode), role, side);
        const handle = this.mesh(new THREE.CylinderGeometry(.065, .065, .36, 12), fabric, seat, `${role}-logos-grip-${side}`);
        handle.position.set(-grip.x, grip.y, -grip.z);
        if (role === 'trinity') {
          this.grips.push({ mesh: handle, side });
          box('logos-control-pedestal', [.19, .66, .32], [-grip.x, 1.47, -grip.z], dark, seat);
        } else box('logos-hand-brace', [.12, .55, .12], [-grip.x, 1.47, -grip.z], trim, seat);
      }
      box('logos-console', [1.38, .68, .65], [root.x, .7, root.z - 2.15], dark);
      const face = box('logos-flight-crt', [.92, .48, .035], [root.x, .79, root.z - 1.8], screen); face.rotation.x = -.16;
      for (let i = 0; i < 5; i++) box('logos-crt-scan', [.54 - i * .04, .012, .015], [root.x, .62 + i * .072, root.z - 1.767], glyph);
      for (const side of [-1, 1]) {
        const button = this.mesh(new THREE.CylinderGeometry(.037, .037, .027, 8), trim, this.cockpit);
        button.rotation.x = Math.PI / 2; button.position.set(root.x + side * .58, .64, root.z - 1.81);
      }
    }
    const glow = new THREE.PointLight(0x93b8d4, 9, 9, 2); glow.position.set(0, 2.65, -6.8); this.cockpit.add(glow); this.lights.push(glow);
  }

  private buildDefense(): void {
    const tower = this.material(0x222b2c, .86, .56);
    const edge = this.material(0x545f5c, .75, .48);
    const amber = this.material(0xd88937, .25, .2, 0xf08a25, 2.5);
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
  }

  update(flight: LogosFlight | undefined, elapsed: number, firstPerson = false): void {
    const pose = flight ?? newLogosFlight(this.mode);
    const ship = logosShipPose(pose);
    this.ship.position.set(ship.x, ship.y, ship.z); this.ship.rotation.set(ship.pitch, ship.yaw, ship.roll, 'YXZ');
    this.ship.visible = true; this.cockpit.visible = true;
    this.impact.update(pose);
    for (const { mesh, side } of this.grips) {
      const grip = logosControlGrip(pose, 'trinity', side); mesh.position.set(-grip.x, grip.y, -grip.z);
    }
    const powered = logosPowered(pose);
    const igniter = logosIgniterGrip(pose);
    if (this.igniter) this.igniter.position.set(-igniter.x, igniter.y, -igniter.z);
    if (this.igniterShaft) {
      const top = 4.15, bottom = igniter.y + .16;
      this.igniterShaft.position.set(-igniter.x, (top + bottom) / 2, -igniter.z); this.igniterShaft.scale.y = top - bottom;
    }
    if (this.igniterLamp) {
      const ready = pose.ignition?.phase === 'ready' || pose.ignition?.phase === 'running';
      this.igniterLamp.color.setHex(ready ? 0x5e9564 : 0x9f471b); this.igniterLamp.emissive.setHex(ready ? 0x63b97b : 0xe66e20);
      this.igniterLamp.emissiveIntensity = pose.ignition?.phase === 'ready' ? 1 : .3;
    }
    this.discharge.visible = pose.ignition?.phase === 'offline' && pose.stage === 'clouds' && pose.ignition.elapsed < .32;
    if (this.displays) { this.displays.emissiveIntensity = powered ? .85 : 0; this.displays.color.setHex(powered ? 0x233b4d : 0x080d12); }
    if (this.glyphs) { this.glyphs.emissiveIntensity = powered ? .6 : 0; this.glyphs.color.setHex(powered ? 0x89a9bd : 0x080d12); }
    if (this.engineLight) this.engineLight.intensity = powered ? 32 : 0;
    this.atmosphere.update(pose);
    const light = THREE.MathUtils.smoothstep(pose.altitude, logosCloudTop(pose) - 2, logosCloudTop(pose) + 3);
    this.sunlight.intensity = light * 2.6; this.skyFill.intensity = .45 + light * .8;
    for (const engine of this.engines) { engine.emissiveIntensity = powered ? 1.8 + pose.speed * .1 + Math.sin(pose.elapsed * 15) * .35 : 0; engine.color.setHex(powered ? 0xb6eff1 : 0x162329); }
    this.pulse.position.copy(this.ship.position); this.pulse.visible = Boolean(flight && flight.pulse > 0);
    if (this.pulse.visible) {
      const progress = 1 - pose.pulse / .5; this.pulse.scale.setScalar(.35 + progress * 3.8);
      this.pulse.rotation.y = pose.elapsed * 2.2;
    }
    this.threats.forEach((threat, index) => {
      threat.visible = !(pose.resolved & 1 << index);
      threat.rotation.y = pose.elapsed * (.55 + index * .04); threat.rotation.z = Math.sin(pose.elapsed * 2 + index) * .12;
      threat.position.y = 1 + LOGOS_DEFENSE.threats[index].altitude + Math.sin(pose.elapsed * 1.7 + index) * .7;
    });
    this.swarms.forEach((swarm, index) => {
      const z = pose.z - 18 - index * 19;
      swarm.position.set(Math.sin(pose.elapsed * .8 + index) * (22 + index), 16 + index * 6 + Math.cos(pose.elapsed + index) * 4, z);
      swarm.rotation.y = pose.elapsed * .45 + index; swarm.visible = pose.mode === 'defense' && pose.phase === 'riding';
    });
  }

  dispose(): void {
    this.impact.dispose();
    this.atmosphere.dispose();
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
