import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEUS_PACT, deusPactPose, deusPactSpeech, newDeusPact, neoCarryPose, type DeusPactEncounter, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { MachineUplinkContacts } from './MachineUplinkContacts.js';
import { machineBugGeometry } from './MachineBugGeometry.js';
import { MachineCityRenderer } from './MachineCityRenderer.js';

/** The Machine City audience chamber: energy tunnel, collective face and physical Matrix uplink. */
export class MachineCoreRenderer {
  private group = new THREE.Group();
  private tunnel = new THREE.Group();
  private ripples = new THREE.Group();
  private swarm = new THREE.Group();
  private face = new THREE.Group();
  private faceParticles = new THREE.Group();
  private collectivePlates!: THREE.InstancedMesh;
  private collectiveSpars!: THREE.InstancedMesh;
  private faceUnits: { x: number; y: number; z: number; turn: number; size: number; orientation: THREE.Quaternion }[] = [];
  private instance = new THREE.Object3D();
  private collectiveTime = NaN;
  private collectiveAmount = NaN;
  private collectiveExpression = '';
  private perceptionMaterials: { material: THREE.MeshStandardMaterial; color: number; intensity: number }[] = [];
  private perceptionLights: { light: THREE.Light; color: THREE.Color }[] = [];
  private subjective = false;
  private swarmHull!: THREE.InstancedMesh;
  private swarmLimbs!: THREE.InstancedMesh;
  private swarmEyes!: THREE.InstancedMesh;
  private storm = new THREE.Group();
  private stormLight!: THREE.PointLight;
  private stormMaterial!: THREE.LineBasicMaterial;
  private chassisCurrent!: THREE.LineBasicMaterial;
  private seat = new THREE.Group();
  private bodyJacks = new THREE.Group();
  private neckProbe = new THREE.Group();
  private connection = new THREE.Group();
  private uplinkContacts = new MachineUplinkContacts();
  private supportPads: THREE.Mesh[] = [];
  private supportStruts: THREE.Mesh[] = [];
  private uplinkFeeds: { tube: THREE.Mesh<THREE.TubeGeometry>; plug: THREE.Mesh; port: THREE.Mesh }[] = [];
  private probeTube!: THREE.Mesh<THREE.TubeGeometry>;
  private probeTip!: THREE.Mesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];
  private city: MachineCityRenderer;

  constructor(root: THREE.Group) {
    root.add(this.group); this.group.add(this.tunnel, this.ripples, this.swarm, this.face, this.seat, this.connection, this.storm);
    this.city = new MachineCityRenderer(this.group);
    this.tunnel.name = 'machine-core-light-tunnel';
    this.ripples.name = 'machine-core-footstep-ripples';
    this.swarm.name = 'machine-core-swarm';
    this.face.name = 'machine-core-face';
    this.seat.name = 'machine-core-seat';
    this.bodyJacks.name = 'machine-core-body-jacks';
    this.neckProbe.name = 'machine-core-neck-probe';
    this.connection.name = 'machine-core-connection-pulse';
    this.storm.name = 'machine-core-storm';
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
    const dark = this.material(0x283642, .74, .42);
    const iron = this.material(0x4b5c6b, .82, .34);
    const gold = this.material(0x526575, .9, .3);
    const dim = this.material(0x334451, .86, .42);
    const mirror = this.material(0x18232c, .82, .26);
    this.perceptionMaterials.push(...[gold, dim, mirror].map(material => ({ material, color: 0, intensity: 0 })));

    const floor = this.mesh(new THREE.PlaneGeometry(16, 76), mirror, this.tunnel, 0, .002, 9);
    floor.rotation.x = -Math.PI / 2;
    const under = this.mesh(new THREE.BoxGeometry(20, 1.2, 82), dark, this.tunnel, 0, -.65, 7);
    under.rotation.z = .006;
    for (const side of [-1, 1]) this.mesh(new THREE.BoxGeometry(.09, .035, 75), gold, this.tunnel, side * 3.7, .075, 9);
    for (let i = 0; i < 18; i++) this.mesh(new THREE.BoxGeometry(7.5, .025, .055), dim, this.tunnel, 0, .072, 42 - i * 4.25);
    const deckGeometry = new THREE.BoxGeometry(.095, .024, 1.45);
    const deck = new THREE.InstancedMesh(deckGeometry, iron, 528);
    deck.name = 'machine-core-segmented-deck'; this.geometries.add(deckGeometry); this.tunnel.add(deck);
    const segment = new THREE.Object3D();
    for (let i = 0; i < deck.count; i++) {
      segment.position.set((i % 12 - 5.5) * .61, .012, 43 - Math.floor(i / 12) * 1.7);
      segment.rotation.set(0, Math.sin(i * 1.3) * .06, 0); segment.updateMatrix(); deck.setMatrixAt(i, segment.matrix);
    }
    for (let i = 0; i < 14; i++) {
      // The enclosed passage ends before the open audience platform.
      const z = 43 - i * 2;
      const rib = this.mesh(new THREE.TorusGeometry(13.5 + i % 3 * .7, .22 + i % 2 * .08, 7, 34, Math.PI), i % 4 ? iron : dim,
        this.tunnel, 0, 1.1, z);
      rib.name = 'machine-core-overhead-rib'; rib.scale.y = 1.16 + i % 4 * .025;
      for (const side of [-1, 1]) {
        const root = this.mesh(new THREE.CylinderGeometry(.28 + i % 3 * .06, .48, 8 + i % 4 * 2, 7), i % 5 ? iron : dim,
          this.tunnel, side * (15.5 + i % 3 * 1.6), 2.8 + i % 4, z + Math.sin(i * 1.7) * 1.2);
        root.rotation.set(.42 + i % 3 * .16, 0, side * (.72 + i % 2 * .12));
      }
    }
    for (let i = 0; i < 9; i++) {
      const ripple = this.material(0xc78a28, .42, .24, 0xff9b22, 3.2, true, .5);
      const ring = this.mesh(new THREE.RingGeometry(.45 + i * .18, .51 + i * .18, 36), ripple, this.ripples);
      ring.rotation.x = -Math.PI / 2; ring.position.y = .08;
    }
    const archLight = new THREE.PointLight(0x89b7de, 190, 76, 2); archLight.position.set(0, 9, -18); this.group.add(archLight);
    const cold = new THREE.HemisphereLight(0x9fb4ca, 0x030504, .72); this.group.add(cold);
    this.lights.push(archLight, cold); this.perceptionLights.push(...[archLight, cold].map(light => ({ light, color: light.color.clone() })));
    const rim = new THREE.DirectionalLight(0x91b7d9, 1.65);
    rim.position.set(-18, 26, 15); rim.target.position.set(0, 8, -20);
    this.group.add(rim, rim.target); this.lights.push(rim); this.perceptionLights.push({ light: rim, color: rim.color.clone() });
  }

  private buildCollective(): void {
    const shell = this.material(0x596574, .72, .38);
    const bright = this.material(0x8d9ba7, .94, .24);
    const red = this.material(0x290a05, .6, .35, 0x952611, .7);
    this.perceptionMaterials.push(...[shell, bright].map(material => ({ material, color: 0, intensity: 0 })));
    this.face.add(this.faceParticles); this.face.position.set(0, 0, -47);
    this.buildCollectiveChassis(shell, bright);
    const gaussian = (value: number, center: number, width: number) => Math.exp(-(((value - center) / width) ** 2));
    // Face-forming machines follow both the depth and the surface direction.
    // Forward-facing parts at different depths still lit like a flat cloud.
    const surface = (x: number, y: number): number => {
      const ax = Math.abs(x);
      const dome = Math.sqrt(Math.max(0, 1 - (x / 12) ** 2 - ((y - 24) / 15) ** 2));
      const sockets = gaussian(ax, 4.2, 2.05) * gaussian(y, 26, 1.05);
      const brow = gaussian(ax, 4.2, 2.4) * gaussian(y, 27.4, .72);
      const cheek = gaussian(ax, 5, 2.9) * gaussian(y, 21.7, 2.55);
      const nose = gaussian(x, 0, 1.24) * gaussian(y, 23, 2.4) * 2.9;
      const noseTip = gaussian(x, 0, 1.8) * gaussian(y, 21.2, .75) * 1.3;
      const lipY = 18.6 + .3 * Math.cos(x * .72);
      const mouth = gaussian(x, 0, 3.2) * gaussian(y, lipY, .19);
      const lips = gaussian(x, 0, 3.5) * (gaussian(y, lipY + .46, .31) + gaussian(y, lipY - .49, .34)) * .65;
      const chin = gaussian(x, 0, 3.6) * gaussian(y, 15.1, 1.7);
      return .5 + dome * 5.4 - sockets * 1.8 + brow * .65 + cheek * 1.35 + nose + noseTip - mouth * .85 + lips + chin;
    };
    const forward = new THREE.Vector3(0, 0, 1);
    // Rounded brow/cheeks and small nose/mouth follow the infant-face silhouette.
    for (let row = -31; row <= 33; row++) {
      const y = 23 + row * .37; const normalizedY = (y - 23.4) / 12.7;
      const width = Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY)) * 10.8;
      for (let column = -Math.floor(width / .34); column <= Math.floor(width / .34); column++) {
        const seed = this.faceUnits.length; const noise = Math.sin(seed * 12.9898 + row * 78.233);
        const x = column * .34 + (row % 2) * .17 + Math.sin(row * 4.1) * .1 + noise * .08;
        const py = y + Math.sin(seed * 2.3) * .1;
        const normal = new THREE.Vector3(-(surface(x + .12, py) - surface(x - .12, py)) / .24,
          -(surface(x, py + .12) - surface(x, py - .12)) / .24, 1).normalize();
        const turn = noise * .4 + Math.atan2(py - 23, x) * .22;
        const orientation = new THREE.Quaternion().setFromUnitVectors(forward, normal)
          .multiply(new THREE.Quaternion().setFromAxisAngle(forward, turn));
        this.faceUnits.push({ x, y: py, z: surface(x, py) + noise * .05, turn, size: .94 + (noise + 1) * .06, orientation });
      }
    }
    const { hull: plate, limbs: spar } = machineBugGeometry();
    const facePlate = plate.clone().scale(1.55, 1, 1.35), faceSpar = spar.clone().scale(.9, 1, 1);
    for (const geometry of [plate, spar, facePlate, faceSpar]) this.geometries.add(geometry);
    const faceShell = this.material(0x718397, .62, .56), faceMetal = this.material(0x3c4b5e, .74, .47);
    this.perceptionMaterials.push(...[faceShell, faceMetal].map(material => ({ material, color: 0, intensity: 0 })));
    this.collectivePlates = new THREE.InstancedMesh(facePlate, faceShell, this.faceUnits.length);
    this.collectiveSpars = new THREE.InstancedMesh(faceSpar, faceMetal, this.faceUnits.length);
    this.collectivePlates.name = 'machine-core-face-plates'; this.collectiveSpars.name = 'machine-core-face-spars';
    for (const mesh of [this.collectivePlates, this.collectiveSpars]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      this.faceParticles.add(mesh);
    }
    const tint = new THREE.Color();
    this.faceUnits.forEach((unit, i) => {
      const shade = .78 + Math.sin(i * 8.17) * .09;
      const fold = gaussian(Math.abs(unit.x), 4.2, 1.65) * gaussian(unit.y, 26, .42);
      const nostril = gaussian(Math.abs(unit.x), 1.45, .65) * gaussian(unit.y, 20.6, .35);
      const mouth = gaussian(unit.x, 0, 3.2) * gaussian(unit.y, 18.6 + .3 * Math.cos(unit.x * .72), .2);
      tint.setRGB(shade * .9, shade * .96, shade).multiplyScalar(1 - Math.max(fold, nostril, mouth) * .75);
      this.collectivePlates.setColorAt(i, tint);
    });

    const droneEye = new THREE.SphereGeometry(.075, 7, 5);
    this.geometries.add(droneEye);
    this.swarmHull = new THREE.InstancedMesh(plate, shell, 96);
    this.swarmLimbs = new THREE.InstancedMesh(spar, bright, 96);
    this.swarmEyes = new THREE.InstancedMesh(droneEye, red, 192);
    for (const [mesh, name] of [[this.swarmHull, 'machine-core-swarm-hulls'], [this.swarmLimbs, 'machine-core-swarm-limbs'], [this.swarmEyes, 'machine-core-swarm-optics']] as const) {
      mesh.name = name; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; this.swarm.add(mesh);
    }
    for (let i = 0; i < 96; i++) {
      this.swarmHull.setColorAt(i, tint.setRGB(.72 + i % 7 * .035, .8 + i % 4 * .025, .88));
    }
    this.stormMaterial = new THREE.LineBasicMaterial({ color: 0xc7e3ff, transparent: true, opacity: 0, depthWrite: false });
    this.materials.add(this.stormMaterial);
    const bolts: THREE.Vector3[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 14; i++) {
      const point = (j: number) => new THREE.Vector3(side * (23 + Math.sin(j * 6.73 + side) * 2.3), 48 - j * 2.4, -62 + Math.cos(j * 2.1) * 1.5);
      bolts.push(point(i), point(i + 1));
      if (i % 3 === 0) bolts.push(point(i), point(i).add(new THREE.Vector3(side * 4.3, -2.7, 1.3)));
    }
    const lightningGeometry = new THREE.BufferGeometry().setFromPoints(bolts); this.geometries.add(lightningGeometry);
    this.storm.add(new THREE.LineSegments(lightningGeometry, this.stormMaterial));
    this.stormLight = new THREE.PointLight(0xa9cfff, 0, 100, 2); this.stormLight.position.set(0, 30, -39); this.group.add(this.stormLight);
    this.lights.push(this.stormLight); this.perceptionLights.push({ light: this.stormLight, color: this.stormLight.color.clone() });
    const faceLight = new THREE.PointLight(0xa7cbea, 1600, 85, 2); faceLight.position.set(-10, 34, -24); this.group.add(faceLight);
    this.lights.push(faceLight); this.perceptionLights.push({ light: faceLight, color: faceLight.color.clone() });
  }

  private buildCollectiveChassis(shell: THREE.MeshStandardMaterial, bright: THREE.MeshStandardMaterial): void {
    const chassis = new THREE.Group(); chassis.name = 'machine-core-collective-chassis';
    chassis.position.set(0, 23, -51); this.group.add(chassis);
    const recess = this.material(0x0a121b, .7, .72), cable = this.material(0x26323e, .72, .48);
    this.perceptionMaterials.push(...[recess, cable].map(material => ({ material, color: 0, intensity: 0 })));
    const profile = [new THREE.Vector2(0, -7), new THREE.Vector2(5, -6.7), new THREE.Vector2(11, -5.5),
      new THREE.Vector2(17, -3.8), new THREE.Vector2(21.5, -2)];
    const body = new THREE.LatheGeometry(profile, 128).rotateX(Math.PI / 2);
    const vertices = body.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) < 0) vertices.setY(i, vertices.getY(i) * .8);
    body.computeVertexNormals();
    this.mesh(body, recess, chassis, 0, 0, 0, 'machine-core-recessed-body');
    const batch = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name;
      this.geometries.add(geometry); chassis.add(mesh); return mesh;
    };
    const ribs = batch(new THREE.BoxGeometry(1, 1, 1), shell, 576, 'machine-core-radial-ribs');
    const rails = batch(new THREE.CylinderGeometry(.045, .065, 1, 6), bright, ribs.count, 'machine-core-radial-conduits');
    const transform = new THREE.Object3D(), tint = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < ribs.count; i++) {
      const layer = Math.floor(i / 192), angle = (i % 192 + layer * .37) * Math.PI * 2 / 192;
      const noise = Math.sin(i * 7.83), radius = 7 + layer * 5.4 + (noise + 1) * 1.2;
      const length = 6.2 + (Math.sin(i * 1.91) + 1) * 2.6;
      const start = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, -6 + radius * .18);
      const end = new THREE.Vector3(Math.cos(angle) * (radius + length), Math.sin(angle) * (radius + length), -3.5 + layer * 1.2);
      // Curve the lower fan above the later body-transport route without a flat cut edge.
      if (start.y < 0) { start.y *= .5; end.y *= .5; }
      const direction = end.clone().sub(start);
      transform.position.copy(start).addScaledVector(direction, .5);
      transform.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      transform.scale.set(.13 + (noise + 1) * .15, Math.max(.1, direction.length()), .12 + i % 4 * .13);
      transform.updateMatrix(); ribs.setMatrixAt(i, transform.matrix);
      ribs.setColorAt(i, tint.setScalar(.5 + (Math.sin(i * 3.73) + 1) * .25));
      transform.position.x += Math.cos(angle + Math.PI / 2) * .19;
      transform.position.y += Math.sin(angle + Math.PI / 2) * .19; transform.position.z += .28;
      transform.scale.set(1, Math.max(.1, direction.length()), 1); transform.updateMatrix(); rails.setMatrixAt(i, transform.matrix);
    }
    const couplers = batch(new THREE.BoxGeometry(1, 1, 1), shell, 1152, 'machine-core-chassis-couplers');
    for (let i = 0; i < couplers.count; i++) {
      const angle = i * 2.39996, radius = 4 + Math.sqrt((i + .5) / couplers.count) * 18;
      transform.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * (Math.sin(angle) < 0 ? .5 : 1), -6 + radius * .2);
      transform.rotation.set(.1 * Math.sin(i), .16 * Math.cos(i), angle - Math.PI / 2);
      transform.scale.set(.18 + i % 4 * .08, .35 + i % 5 * .16, .2 + i % 3 * .12);
      transform.updateMatrix(); couplers.setMatrixAt(i, transform.matrix);
      couplers.setColorAt(i, tint.setScalar(.48 + (Math.sin(i * 2.77) + 1) * .23));
    }
    const conduits: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI * 2 / 48, radius = 14.8 + i % 3 * 2.5;
      const points = Array.from({ length: 6 }, (_, j) => {
        const a = angle + j * .095, r = radius + Math.sin(j * .8 + i) * .7;
        return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * (Math.sin(a) < 0 ? .5 : 1), -1.4 + Math.sin(j * .9 + i) * .45);
      });
      conduits.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, .09 + i % 3 * .025, 6, false));
    }
    this.mesh(mergeGeometries(conduits)!, cable, chassis, 0, 0, 0, 'machine-core-chassis-cables');
    conduits.forEach(geometry => geometry.dispose());
    const bolts: THREE.Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16, radius = 13.5 + i % 3 * 2.8;
      const point = (j: number) => new THREE.Vector3(Math.cos(angle + j * .015) * (radius + j * .28) + Math.sin(i + j * 9.3) * .22,
        Math.sin(angle + j * .015) * (radius + j * .28) * (Math.sin(angle + j * .015) < 0 ? .5 : 1), -.6 + Math.cos(j * 2.1) * .16);
      for (let j = 0; j < 9; j++) bolts.push(point(j), point(j + 1));
    }
    this.chassisCurrent = new THREE.LineBasicMaterial({ color: 0x9bcfff, transparent: true, opacity: .35, depthWrite: false });
    this.materials.add(this.chassisCurrent);
    const arcs = new THREE.BufferGeometry().setFromPoints(bolts); this.geometries.add(arcs);
    const currents = new THREE.LineSegments(arcs, this.chassisCurrent); currents.name = 'machine-core-chassis-current'; chassis.add(currents);
  }

  private setPerception(subjective: boolean): void {
    if (this.subjective === subjective) return;
    this.subjective = subjective;
    this.city.setPerception(subjective);
    for (const { material, color, intensity } of this.perceptionMaterials) {
      material.emissive.setHex(subjective ? 0xff9b24 : color);
      material.emissiveIntensity = subjective ? .085 : intensity;
    }
    for (const { light, color } of this.perceptionLights) {
      if (subjective) light.color.setHex(0xffbd66); else light.color.copy(color);
    }
  }

  private updateCollective(time: number, amount: number, speech: ReturnType<typeof deusPactSpeech>): void {
    const expression = `${speech.mouth}:${speech.brow}:${speech.anger}`;
    if (time === this.collectiveTime && amount === this.collectiveAmount && expression === this.collectiveExpression) return;
    this.collectiveTime = time; this.collectiveAmount = amount; this.collectiveExpression = expression;
    const transform = this.instance;
    this.faceUnits.forEach((unit, i) => {
      const stagger = i % 17 / 17 * .16;
      const progress = THREE.MathUtils.clamp((amount - stagger) / (1 - stagger), 0, 1);
      const angle = i * 2.39996; const radius = 15 + i % 9 * .3;
      const lowerJaw = THREE.MathUtils.smoothstep(19.15 - unit.y, 0, 2.3) * Math.exp(-((unit.x / 5.5) ** 4));
      const brow = Math.exp(-(((Math.abs(unit.x) - 4.2) / 2.6) ** 2 + ((unit.y - 27.3) / 1.2) ** 2));
      const burst = speech.anger * (i % 23 === 0 ? Math.pow(Math.sin(i * 1.37 + time * 1.2), 2) : 0);
      transform.position.set(
        THREE.MathUtils.lerp(Math.cos(angle) * radius, unit.x, progress),
        THREE.MathUtils.lerp(23 + Math.sin(angle) * radius, unit.y, progress) - lowerJaw * speech.mouth * 1.1 - brow * speech.brow * .65,
        THREE.MathUtils.lerp(-3 + Math.sin(i * .91) * 4, unit.z, progress) + Math.sin(time * 2.4 + i * .8) * .025 + burst * 3);
      transform.rotation.set(Math.sin(time * .7 + i) * .055, unit.x * .033 + (1 - progress) * angle, unit.turn);
      transform.quaternion.slerp(unit.orientation, progress);
      transform.scale.setScalar(.27 * unit.size);
      transform.updateMatrix(); this.collectivePlates.setMatrixAt(i, transform.matrix);
      transform.updateMatrix(); this.collectiveSpars.setMatrixAt(i, transform.matrix);
    });
    this.collectivePlates.instanceMatrix.needsUpdate = true; this.collectiveSpars.instanceMatrix.needsUpdate = true;
  }

  private buildUplink(): void {
    const iron = this.material(0x242823, .96, .3);
    const cable = this.material(0x292d28, .9, .38);
    const inset = this.material(0x080b0a, .6, .35);
    // Open rods and small padded saddles leave real space for his bent legs.
    for (let i = 0; i < 4; i++) {
      const pad = this.mesh(new THREE.SphereGeometry(1, 16, 10), cable, this.seat, 0, 0, 0, `machine-support-pad-${i}`);
      pad.scale.set(i < 2 ? .22 : .17, .075, i < 2 ? .2 : .18); pad.visible = false; this.supportPads.push(pad);
      const strut = this.mesh(new THREE.CylinderGeometry(.065, .095, 1, 10), iron, this.seat, 0, 0, 0, `machine-support-strut-${i}`);
      strut.visible = false; this.supportStruts.push(strut);
    }
    this.seat.add(this.bodyJacks, this.neckProbe);
    const tube = (radius: number, parent: THREE.Object3D, name: string) => this.mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 2, 1), new THREE.Vector3(0, 3, 1)]), 24, radius, 8, false), cable, parent, 0, 0, 0, name) as THREE.Mesh<THREE.TubeGeometry>;
    for (let i = 0; i < 6; i++) {
      const feed = tube(.04, this.bodyJacks, `machine-body-feed-${i}`);
      const plug = this.mesh(new THREE.CylinderGeometry(.045, .06, .18, 10), iron, this.bodyJacks, 0, 0, 0, `machine-body-plug-${i}`);
      const port = this.mesh(new THREE.TorusGeometry(.07, .016, 8, 18), inset, this.bodyJacks, 0, 0, 0, `machine-body-port-${i}`);
      feed.visible = plug.visible = port.visible = false; this.uplinkFeeds.push({ tube: feed, plug, port });
    }
    this.probeTube = tube(.065, this.neckProbe, 'machine-neck-feed'); this.probeTube.visible = false;
    this.probeTip = this.mesh(new THREE.ConeGeometry(.085, .28, 12), iron, this.neckProbe, 0, 0, 0, 'machine-neck-tip'); this.probeTip.visible = false;
    const pulseMaterial = this.material(0x9c6220, .56, .2, 0xffa52f, 1.8, true, .2);
    this.mesh(new THREE.SphereGeometry(2.2, 18, 12), pulseMaterial, this.connection, 0, 3, DEUS_PACT.platform.z);
  }

  private bendUplink(mesh: THREE.Mesh<THREE.TubeGeometry>, points: THREE.Vector3[]): void {
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

  private updateUplink(state: DeusPactEncounter, subject?: THREE.Object3D, carried?: TrilogyEpilogueEncounter): void {
    const pose = deusPactPose(state);
    if (carried) { pose.seated = 1; pose.cables = pose.probe = neoCarryPose(carried).connection; }
    this.seat.visible = pose.seated > .001;
    this.bodyJacks.visible = pose.cables > .001; this.neckProbe.visible = pose.probe > .001;
    if (!subject || !this.seat.visible) return;
    const contacts = this.uplinkContacts.sample(subject); if (!contacts) return;
    this.group.updateWorldMatrix(true, true);
    const rotation = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = (point: THREE.Vector3) => this.group.worldToLocal(point.clone());
    const normal = (direction: THREE.Vector3) => direction.clone().applyQuaternion(rotation).normalize();
    const rearZ = local(subject.getWorldPosition(new THREE.Vector3())).z + 1.8;
    this.supportPads.forEach(pad => { pad.visible = !carried; }); this.supportStruts.forEach(strut => { strut.visible = !carried; });
    if (!carried) [...contacts.seat, ...contacts.back].forEach((contact, i) => {
      const pad = this.supportPads[i], strut = this.supportStruts[i], side = i % 2 ? 1 : -1;
      const axis = normal(contact.normal), surface = local(contact.point);
      const foot = new THREE.Vector3(side * .85, .085, rearZ + (i < 2 ? 0 : .35));
      const end = surface.addScaledVector(axis, .08).lerp(foot, 1 - pose.seated);
      pad.position.copy(end); pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis); pad.visible = true;
      const direction = end.clone().sub(foot);
      strut.position.copy(foot).addScaledVector(direction, .5); strut.scale.y = direction.length();
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); strut.visible = true;
    });
    contacts.ports.forEach((contact, i) => {
      const feed = this.uplinkFeeds[i], side = i < 3 ? -1 : 1, surface = local(contact.point), axis = normal(contact.normal);
      feed.port.position.copy(surface).addScaledVector(axis, .018); feed.port.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      const tip = surface.clone().addScaledVector(axis, .018 + (1 - pose.cables) * 1.35);
      feed.plug.position.copy(tip).addScaledVector(axis, .09); feed.plug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
      const end = tip.clone().addScaledVector(axis, .18);
      this.bendUplink(feed.tube, carried
        ? [new THREE.Vector3(Math.sign(surface.x) * 3.2, .12, surface.z), new THREE.Vector3(Math.sign(surface.x) * 3.2, end.y - .75, surface.z), end.clone().addScaledVector(axis, .45), end]
        : [new THREE.Vector3(side * 1.1, .12, rearZ + .5), new THREE.Vector3(side * 1.1, end.y + .15, rearZ + .25), end.clone().addScaledVector(axis, .45), end]);
      feed.tube.visible = feed.plug.visible = feed.port.visible = true;
    });
    const socket = subject.getObjectByName('cervical-interface');
    if (socket) {
      socket.updateWorldMatrix(true, false);
      const surface = local(socket.getWorldPosition(new THREE.Vector3()));
      const axis = normal(new THREE.Vector3(0, 0, 1).transformDirection(socket.matrixWorld));
      const insert = state.phase === 'connecting' ? THREE.MathUtils.smoothstep(state.elapsed, 0, .55) : state.phase === 'connected' ? 1 : 0;
      const gap = carried ? -.018 + (1 - pose.probe) * 1.6 : state.phase === 'consent' || state.phase === 'assurance' ? .2 + (1 - pose.probe) * .8 : THREE.MathUtils.lerp(.2, -.018, insert);
      const tip = surface.clone().addScaledVector(axis, gap);
      this.probeTip.position.copy(tip).addScaledVector(axis, .14);
      this.probeTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
      const end = tip.clone().addScaledVector(axis, .28);
      this.bendUplink(this.probeTube, carried
        ? [new THREE.Vector3(0, .12, surface.z + 1), new THREE.Vector3(0, end.y - .7, surface.z + .8), end.clone().addScaledVector(axis, .65), end]
        : [new THREE.Vector3(1.45, .2, rearZ + .8), new THREE.Vector3(.9, end.y + .8, rearZ + .4), end.clone().addScaledVector(axis, .65), end]);
      this.probeTube.visible = this.probeTip.visible = true;
    }
  }

  update(encounter: DeusPactEncounter | undefined, elapsed: number, firstPerson: boolean,
    player: { x: number; z: number }, subject?: THREE.Object3D, carried?: TrilogyEpilogueEncounter): void {
    const state = encounter ?? newDeusPact(); const pose = deusPactPose(state);
    const time = encounter?.total ?? elapsed;
    this.setPerception(firstPerson);
    this.ripples.visible = firstPerson && !carried;
    this.ripples.children.forEach((child, index) => {
      const cycle = (elapsed * .58 + index / this.ripples.children.length) % 1;
      child.position.x = player.x; child.position.z = player.z;
      child.scale.setScalar(.35 + cycle * 4.2); child.visible = state.phase === 'approach' || state.phase === 'ready';
      const material = (child as THREE.Mesh).material as THREE.Material; material.opacity = (1 - cycle) * .58;
    });
    this.swarm.visible = pose.swarm > .01;
    const speech = deusPactSpeech(state), transform = this.instance, bodyMatrix = new THREE.Matrix4();
    for (let seed = 0; seed < this.swarmHull.count; seed++) {
      const angle = seed * 2.399 + time * (.35 + seed % 5 * .035);
      const band = seed % 11 / 10; const radius = 4.5 + band * 9.5 - pose.swarm * 1.8;
      transform.position.set(player.x + Math.cos(angle) * radius, 2.1 + seed % 13 * .72 + Math.sin(time * 2 + seed) * .45,
        player.z + Math.sin(angle) * radius * .68 - 1.5);
      transform.lookAt(player.x, 2.2, player.z); transform.rotateZ(Math.sin(time * 3.2 + seed) * .16);
      const size = .43 + pose.swarm * .38; transform.scale.setScalar(size);
      transform.updateMatrix(); this.swarmHull.setMatrixAt(seed, transform.matrix);
      const flap = Math.sin(time * 5.5 + seed * .73) * .24;
      transform.scale.x *= 1 + flap; transform.updateMatrix(); this.swarmLimbs.setMatrixAt(seed, transform.matrix);
      this.swarmHull.getMatrixAt(seed, bodyMatrix);
      for (const side of [-1, 1]) {
        transform.position.set(side * .12, .58, .24).applyMatrix4(bodyMatrix); transform.scale.set(size * .8, size * .6, size * .42);
        transform.updateMatrix(); this.swarmEyes.setMatrixAt(seed * 2 + (side > 0 ? 1 : 0), transform.matrix);
      }
    }
    for (const mesh of [this.swarmHull, this.swarmLimbs, this.swarmEyes]) mesh.instanceMatrix.needsUpdate = true;
    this.face.visible = pose.face > .001;
    this.face.scale.setScalar(1);
    this.updateCollective(time, pose.face, speech);
    this.chassisCurrent.color.setHex(firstPerson ? 0xffbe66 : 0x9bcfff);
    this.chassisCurrent.opacity = .18 + Math.pow(Math.max(0, Math.sin(time * 3.7)), 10) * .38 + speech.anger * .3;
    const flash = speech.anger * Math.pow(Math.max(0, Math.sin(state.elapsed * 18 + .8)), 12);
    this.storm.visible = flash > .025; this.stormMaterial.opacity = flash * .88; this.stormLight.intensity = flash * 1800;
    this.updateUplink(state, subject, carried);
    this.connection.visible = pose.pulse > .001;
    this.connection.scale.setScalar(.35 + pose.pulse * (firstPerson ? 1.7 : 2.6));
    const pulseMaterial = (this.connection.children[0] as THREE.Mesh).material as THREE.Material;
    pulseMaterial.opacity = .08 + pose.pulse * (.28 + Math.sin(time * 12) * .06);
  }

  dispose(): void {
    this.city.dispose();
    this.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
