import * as THREE from 'three';
import { DEUS_PACT, deusPactPose, newDeusPact, type DeusPactEncounter } from '@auto_matrix/shared';

/** The Machine City audience chamber: energy tunnel, collective face and physical Matrix uplink. */
export class MachineCoreRenderer {
  private group = new THREE.Group();
  private tunnel = new THREE.Group();
  private ripples = new THREE.Group();
  private swarm = new THREE.Group();
  private face = new THREE.Group();
  private faceParticles = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private swarmMachines: THREE.Group[] = [];
  private seat = new THREE.Group();
  private bodyJacks = new THREE.Group();
  private neckProbe = new THREE.Group();
  private connection = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];

  constructor(root: THREE.Group) {
    root.add(this.group); this.group.add(this.tunnel, this.ripples, this.swarm, this.face, this.seat, this.connection);
    this.tunnel.name = 'machine-core-light-tunnel';
    this.ripples.name = 'machine-core-footstep-ripples';
    this.swarm.name = 'machine-core-swarm';
    this.face.name = 'machine-core-face';
    this.seat.name = 'machine-core-seat';
    this.bodyJacks.name = 'machine-core-body-jacks';
    this.neckProbe.name = 'machine-core-neck-probe';
    this.connection.name = 'machine-core-connection-pulse';
    this.buildChamber(); this.buildCollective(); this.buildUplink();
    this.update(undefined, 0, false, { x: 0, z: 35 });
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0,
    transparent = false, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity,
      transparent, opacity, depthWrite: !transparent, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
    x = 0, y = 0, z = 0, name?: string): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); if (name) mesh.name = name;
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private buildChamber(): void {
    const dark = this.material(0x171b19, .96, .42);
    const iron = this.material(0x33352f, .9, .34);
    const gold = this.material(0x8d5e25, .64, .3, 0xd67b1c, .82);
    const dim = this.material(0x4f3b20, .76, .42, 0xb86a17, .55);
    const mirror = this.material(0x111411, .88, .2, 0x7b4718, .16, true, .9);

    const floor = this.mesh(new THREE.PlaneGeometry(16, 76), mirror, this.tunnel, 0, .025, 9);
    floor.rotation.x = -Math.PI / 2;
    const under = this.mesh(new THREE.BoxGeometry(20, 1.2, 82), dark, this.tunnel, 0, -.65, 7);
    under.rotation.z = .006;
    for (const side of [-1, 1]) this.mesh(new THREE.BoxGeometry(.09, .035, 75), gold, this.tunnel, side * 3.7, .075, 9);
    for (let i = 0; i < 18; i++) this.mesh(new THREE.BoxGeometry(7.5, .025, .055), dim, this.tunnel, 0, .072, 42 - i * 4.25);
    for (let i = 0; i < 14; i++) {
      const z = 43 - i * 4.6;
      const rib = this.mesh(new THREE.TorusGeometry(13.5 + i % 3 * .7, .22 + i % 2 * .08, 7, 34, Math.PI), i % 4 ? iron : dim,
        this.tunnel, 0, 1.1, z);
      rib.rotation.set(0, 0, Math.PI); rib.scale.y = 1.16 + i % 4 * .025;
      for (const side of [-1, 1]) {
        const root = this.mesh(new THREE.CylinderGeometry(.28 + i % 3 * .06, .48, 8 + i % 4 * 2, 7), i % 5 ? iron : dim,
          this.tunnel, side * (15.5 + i % 3 * 1.6), 2.8 + i % 4, z + Math.sin(i * 1.7) * 1.2);
        root.rotation.set(.42 + i % 3 * .16, 0, side * (.72 + i % 2 * .12));
      }
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1; const z = 38 - Math.floor(i / 2) * 9.5;
      const tower = this.mesh(new THREE.CylinderGeometry(1.2 + i % 3 * .5, 2.5 + i % 4 * .6, 18 + i % 5 * 5, 8), dark,
        this.tunnel, side * (21 + i % 4 * 4.7), 8 + i % 5 * 2, z);
      tower.rotation.z = side * (.08 + i % 3 * .04);
      const crown = this.mesh(new THREE.ConeGeometry(2.2 + i % 3 * .7, 6 + i % 4 * 2, 7), i % 3 ? iron : dim,
        this.tunnel, tower.position.x, tower.position.y + 11 + i % 5 * 2, z);
      crown.rotation.z = side * .18;
    }
    for (let i = 0; i < 9; i++) {
      const ripple = this.material(0xc78a28, .42, .24, 0xff9b22, 3.2, true, .5);
      const ring = this.mesh(new THREE.RingGeometry(.45 + i * .18, .51 + i * .18, 36), ripple, this.ripples);
      ring.rotation.x = -Math.PI / 2; ring.position.y = .08;
    }
    const archLight = new THREE.PointLight(0xffa43a, 125, 76, 2); archLight.position.set(0, 9, -18); this.group.add(archLight);
    const cold = new THREE.HemisphereLight(0xc89958, 0x030504, .72); this.group.add(cold);
    this.lights.push(archLight, cold);
  }

  private buildCollective(): void {
    const shell = this.material(0x2d3029, .94, .27, 0x4d2d0c, .36);
    const bright = this.material(0x805622, .66, .26, 0xff9b24, .95);
    const red = this.material(0x650d08, .42, .2, 0xff2b14, 5.2);
    const black = this.material(0x070907, .9, .34);
    const unitGeometry = new THREE.CapsuleGeometry(.18, .65, 2, 5); this.geometries.add(unitGeometry);
    this.face.add(this.faceParticles); this.face.position.set(0, 0, -47);
    for (let row = -9; row <= 9; row++) {
      const yn = row / 9; const width = Math.sqrt(Math.max(0, 1 - yn * yn)) * (yn < -.35 ? 9.5 : 12.5);
      const count = Math.max(3, Math.floor(width * 1.35));
      for (let column = -count; column <= count; column++) {
        const x = column / count * width; const y = 23 + row * 1.15;
        const eye = Math.abs(y - 26) < 2.2 && Math.abs(Math.abs(x) - 4.4) < 2.6;
        const mouth = Math.abs(y - 17.5) < .9 && Math.abs(x) < 5.2;
        if (eye || mouth) continue;
        const z = 1.6 - (x * x / 145 + (y - 23) * (y - 23) / 95) * 2.4 + Math.sin(column * 1.7 + row) * .18;
        const particle = this.mesh(unitGeometry, (column + row) % 7 ? shell : bright, this.faceParticles, x, y, z);
        particle.rotation.set(Math.PI / 2 + row * .025, column * .12, (column + row) * .17);
        particle.scale.set(.75 + (column & 1) * .3, .7 + (row & 1) * .35, .75);
      }
    }
    for (const side of [-1, 1]) {
      const socket = this.mesh(new THREE.SphereGeometry(3.25, 18, 10), black, this.face, side * 4.5, 26, 2.25);
      socket.scale.set(1.25, .62, .4);
      const eye = this.mesh(new THREE.SphereGeometry(1.45, 16, 10), red, this.face, side * 4.5, 26, 3.1);
      eye.scale.set(1.65, .38, .22); this.eyes.push(eye);
    }
    for (let i = 0; i < 12; i++) {
      const lip = this.mesh(unitGeometry, i % 3 ? shell : bright, this.face, -4.4 + i * .8, 17.4 + Math.sin(i / 11 * Math.PI) * .55, 2.65);
      lip.rotation.z = Math.PI / 2; lip.scale.set(1.35, 1.1, 1.1);
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? -.28 : .28;
      const nose = this.mesh(unitGeometry, i % 3 ? shell : bright, this.face, side, 24.7 - i * .68, 3.05 + i * .08);
      nose.rotation.z = side * .38; nose.scale.set(1.15, .72 + i * .03, 1.05);
    }
    for (const side of [-1, 1]) {
      const nostril = this.mesh(new THREE.SphereGeometry(.42, 9, 6), black, this.face, side * .58, 19.7, 3.45);
      nostril.scale.set(1.2, .48, .28);
    }

    const droneBody = new THREE.CapsuleGeometry(.14, .62, 2, 5);
    const droneLimb = new THREE.CylinderGeometry(.025, .055, .82, 5);
    const droneEye = new THREE.SphereGeometry(.075, 7, 5);
    this.geometries.add(droneBody); this.geometries.add(droneLimb); this.geometries.add(droneEye);
    for (let i = 0; i < 96; i++) {
      const machine = new THREE.Group(); machine.userData.seed = i; this.swarm.add(machine); this.swarmMachines.push(machine);
      const body = this.mesh(droneBody, i % 9 ? shell : bright, machine, 0, 0, 0);
      body.rotation.x = Math.PI / 2;
      const eye = this.mesh(droneEye, red, machine, 0, .02, .47); eye.scale.set(1.4, .65, .42);
      for (const side of [-1, 1]) {
        const limb = this.mesh(droneLimb, i % 7 ? shell : bright, machine, side * .22, -.1, -.12);
        limb.rotation.z = side * (.62 + i % 3 * .12); limb.rotation.x = -.36;
      }
    }
    const faceLight = new THREE.PointLight(0xff8f24, 420, 70, 2); faceLight.position.set(0, 22, -39); this.group.add(faceLight);
    this.lights.push(faceLight);
  }

  private buildUplink(): void {
    const iron = this.material(0x242823, .96, .3);
    const cable = this.material(0x292d28, .9, .38, 0x5a3514, .18);
    const gold = this.material(0x875923, .62, .25, 0xe38722, 1.05);
    const red = this.material(0x641510, .45, .24, 0xff321d, 2.8);
    this.seat.position.set(0, 0, DEUS_PACT.platform.z + 1.1);
    const base = this.mesh(new THREE.CylinderGeometry(3.8, 4.6, 1.15, 12), iron, this.seat, 0, .52, .5);
    base.scale.z = .72;
    const back = this.mesh(new THREE.BoxGeometry(4.2, 6.4, .7), iron, this.seat, 0, 3.35, 2.05);
    back.rotation.x = -.18;
    const cushion = this.mesh(new THREE.BoxGeometry(3.8, .65, 4.7), cable, this.seat, 0, 1.28, .1);
    cushion.rotation.x = -.13;
    for (const side of [-1, 1]) for (let level = 0; level < 3; level++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (1.85 + level * .12), 1.75 + level * .9, 2.15),
        new THREE.Vector3(side * (2.35 + level * .16), 2.05 + level * .88, 1.35),
        new THREE.Vector3(side * (2.15 + level * .12), 2.25 + level * .82, .35),
      ]);
      this.mesh(new THREE.TubeGeometry(curve, 12, .07 + level * .012, 6, false), cable, this.seat);
      this.mesh(new THREE.SphereGeometry(.14, 8, 6), iron, this.seat,
        side * (2.15 + level * .12), 2.25 + level * .82, .35);
    }
    this.seat.add(this.bodyJacks, this.neckProbe);
    for (const side of [-1, 1]) for (let level = 0; level < 3; level++) {
      const y = 2.05 + level * .72; const x = side * (.72 + level * .08);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.92, y + .2, 1.82),
        new THREE.Vector3(side * 1.48, y + .08, .65),
        new THREE.Vector3(x, y, -1.02 + level * .08),
      ]);
      this.mesh(new THREE.TubeGeometry(curve, 14, .048, 6, false), cable, this.bodyJacks);
      const contact = this.mesh(new THREE.CylinderGeometry(.075, .1, .42, 8), level === 1 ? gold : iron,
        this.bodyJacks, x, y, -1.11 + level * .08);
      contact.rotation.x = Math.PI / 2;
    }
    const probeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 5.35, 3.72),
      new THREE.Vector3(.52, 4.95, 2.55),
      new THREE.Vector3(-.28, 4.45, 1.15),
      new THREE.Vector3(0, 3.92, -.68),
    ]);
    this.mesh(new THREE.TubeGeometry(probeCurve, 24, .12, 8, false), cable, this.neckProbe);
    for (const point of [probeCurve.getPoint(.28), probeCurve.getPoint(.62)])
      this.mesh(new THREE.SphereGeometry(.2, 9, 6), iron, this.neckProbe, point.x, point.y, point.z);
    const head = this.mesh(new THREE.ConeGeometry(.34, 1.05, 8), iron, this.neckProbe, 0, 3.82, -.68);
    head.rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) this.mesh(new THREE.SphereGeometry(.075, 7, 5), red, this.neckProbe, side * .14, 3.98, -.98);
    const pulseMaterial = this.material(0x9c6220, .56, .2, 0xffa52f, 1.8, true, .2);
    this.mesh(new THREE.SphereGeometry(2.2, 18, 12), pulseMaterial, this.connection, 0, 3, DEUS_PACT.platform.z);
  }

  update(encounter: DeusPactEncounter | undefined, elapsed: number, firstPerson: boolean,
    player: { x: number; z: number }): void {
    const state = encounter ?? newDeusPact(); const pose = deusPactPose(state);
    this.ripples.children.forEach((child, index) => {
      const cycle = (elapsed * .58 + index / this.ripples.children.length) % 1;
      child.position.x = player.x; child.position.z = player.z;
      child.scale.setScalar(.35 + cycle * 4.2); child.visible = state.phase === 'approach' || state.phase === 'ready';
      const material = (child as THREE.Mesh).material as THREE.Material; material.opacity = (1 - cycle) * .58;
    });
    this.swarm.visible = pose.swarm > .01;
    this.swarmMachines.forEach((machine, index) => {
      const seed = machine.userData.seed as number; const angle = seed * 2.399 + elapsed * (.35 + seed % 5 * .035);
      const band = seed % 11 / 10; const radius = 4.5 + band * 9.5 - pose.swarm * 1.8;
      machine.position.set(player.x + Math.cos(angle) * radius, 2.1 + seed % 13 * .72 + Math.sin(elapsed * 2 + seed) * .45,
        player.z + Math.sin(angle) * radius * .68 - 1.5);
      machine.lookAt(player.x, 2.2, player.z); machine.rotateZ(Math.sin(elapsed * 3.2 + seed) * .16);
      machine.scale.setScalar(.62 + pose.swarm * .58);
      const flap = Math.sin(elapsed * 5.5 + seed * .73) * .24;
      machine.children.slice(2).forEach((limb, limbIndex) => { limb.rotation.z = (limbIndex ? 1 : -1) * (.72 + flap); });
    });
    this.face.visible = pose.face > .001;
    this.face.scale.setScalar(Math.max(.001, pose.face));
    this.faceParticles.children.forEach((particle, index) => {
      particle.rotation.y += .0015 * (index % 3 - 1);
      particle.position.z += Math.sin(elapsed * 2.4 + index * .8) * .0018;
    });
    this.eyes.forEach((eye, index) => { eye.scale.z = .18 + Math.sin(elapsed * 4 + index) * .04; });
    this.seat.visible = pose.seated > .001;
    this.seat.scale.set(1, Math.max(.01, pose.seated), 1); this.seat.position.y = (1 - pose.seated) * -1.4;
    this.bodyJacks.visible = pose.cables > .001; this.bodyJacks.scale.setScalar(Math.max(.01, pose.cables));
    this.neckProbe.visible = pose.probe > .001;
    this.neckProbe.position.z = (1 - pose.probe) * 5.2; this.neckProbe.scale.setScalar(.78 + pose.probe * .22);
    this.connection.visible = pose.pulse > .001;
    this.connection.scale.setScalar(.35 + pose.pulse * (firstPerson ? 1.7 : 2.6));
    const pulseMaterial = (this.connection.children[0] as THREE.Mesh).material as THREE.Material;
    pulseMaterial.opacity = .08 + pose.pulse * (.28 + Math.sin(elapsed * 12) * .06);
  }

  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
