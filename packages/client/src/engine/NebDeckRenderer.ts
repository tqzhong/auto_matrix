import * as THREE from 'three';
import { RECOVERY_BED, RESCUE, type FilmJourney } from '@auto_matrix/shared';

/** The Nebuchadnezzar is one continuous deck: medical bay, operator core and mess.
 * The central aisle remains open so recovery hands control back to the player. */
export class NebDeckRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private dark = this.material(new THREE.MeshStandardMaterial({ color: 0x27312f, metalness: .72, roughness: .48 }));
  private steel = this.material(new THREE.MeshStandardMaterial({ color: 0x596764, metalness: .82, roughness: .3 }));
  private worn = this.material(new THREE.MeshStandardMaterial({ color: 0x4b5753, metalness: .48, roughness: .72 }));
  private rubber = this.material(new THREE.MeshStandardMaterial({ color: 0x121817, roughness: .92 }));
  private leather = this.material(new THREE.MeshStandardMaterial({ color: 0x53251f, roughness: .56, metalness: .05 }));
  private linen = this.material(new THREE.MeshStandardMaterial({ color: 0x7f8278, roughness: .93 }));
  private screen = this.material(new THREE.MeshBasicMaterial({ color: 0x83be9b, toneMapped: false }));
  private amber = this.material(new THREE.MeshBasicMaterial({ color: 0xd49d5d, toneMapped: false }));
  private glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0x879b94, transparent: true, opacity: .23, roughness: .18, metalness: .22, side: THREE.DoubleSide, depthWrite: false }));
  private gantry = new THREE.Group();
  private needles: { shaft: THREE.Mesh; tip: THREE.Mesh; hub: THREE.Mesh; anchorY: number; bone: string; offset: THREE.Vector3 }[] = [];
  private downloadRig = new THREE.Group();
  private downloadConnector = new THREE.Group();
  private downloadBars: THREE.Mesh[] = [];
  private downloadPulse = this.material(new THREE.MeshBasicMaterial({ color: 0x8cf4b8, toneMapped: false }));
  private consoleRig = new THREE.Group();
  private codeBars: THREE.Mesh[] = [];
  private mealRig = new THREE.Group();
  private neoBowl = new THREE.Group();
  private mealSteam: THREE.Mesh[] = [];
  private betrayalRig = new THREE.Group();
  private betrayalJacks = new Map<'neo' | 'trinity' | 'apoc' | 'switch', THREE.Group>();
  private betrayalLoose = new Map<'apoc' | 'switch', THREE.Group>();
  private betrayalSignals = new Map<'neo' | 'trinity' | 'apoc' | 'switch', THREE.Mesh>();
  private betrayalFlash = new THREE.Group();
  private betrayalAlarm!: THREE.PointLight;
  private rescueRig = new THREE.Group();
  private rescueRoute: THREE.Mesh[] = [];
  private rescueSignal!: THREE.Mesh;
  private rescueBuilding!: THREE.Group;
  private rescueLight!: THREE.PointLight;
  private shipLossRig = new THREE.Group();
  private shipAlarm!: THREE.PointLight;
  private shipHatch!: THREE.Mesh;

  constructor(private root: THREE.Group) {
    this.hull();
    this.medicalBay();
    this.operatorCore();
    this.mess();
    this.shipLossScene();
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, name?: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 12), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(points: THREE.Vector3[], radius: number, material = this.steel): THREE.Mesh {
    return this.mesh(this.root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * 8), radius, 8), material);
  }
  private pointLight(name: string, color: number, intensity: number, distance: number, x: number, y: number, z: number): THREE.PointLight {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.name = name; light.position.set(x, y, z);
    this.root.add(light); this.lights.add(light); return light;
  }
  private chair(x: number, z: number, yaw: number, name: string): void {
    const chair = new THREE.Group(); chair.name = name; chair.position.set(x, 0, z); chair.rotation.y = yaw; this.root.add(chair);
    this.box(chair, this.dark, 0, .65, 0, 2.7, 1.1, 3.2);
    const cushion = this.box(chair, this.leather, 0, 1.25, .1, 2.35, .3, 2.55); cushion.rotation.x = -.1;
    const back = this.box(chair, this.leather, 0, 2.15, -1.22, 2.35, 2.2, .32); back.rotation.x = .28;
    for (const side of [-1, 1]) {
      this.box(chair, this.dark, side * 1.3, 1.35, .1, .22, 1.7, 2.7);
      const cable = this.pipe([new THREE.Vector3(x + side * 1.05, 2.9, z + .8), new THREE.Vector3(x + side * 1.2, 5, z + 1.8), new THREE.Vector3(x + side * 2, 7, z + 2.4)], .07, this.rubber);
      cable.name = `${name}-cable-${side}`;
    }
  }
  private crt(x: number, y: number, z: number, yaw = 0, amber = false): void {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = yaw; this.root.add(group);
    this.box(group, this.dark, 0, 0, 0, 2.7, 2.1, 1.8);
    const face = this.box(group, amber ? this.amber : this.screen, 0, .08, 1, 2.15, 1.45, .04); face.rotation.x = -.04;
    for (let row = -2; row <= 2; row++) this.box(group, this.dark, 0, row * .25, 1.035, 1.8 - Math.abs(row) * .12, .025, .02);
  }

  private hull(): void {
    this.box(this.root, this.dark, 0, -.35, 0, 44, .7, 90, 'neb-deck-floor');
    for (let z = -42; z <= 42; z += 6) {
      this.box(this.root, z % 12 ? this.worn : this.steel, 0, .02, z, 43, .05, 5.72);
      this.box(this.root, this.dark, -21.6, 7.5, z, .8, 15, 5.8);
      this.box(this.root, this.dark, 21.6, 7.5, z, .8, 15, 5.8);
      const rib = this.pipe([new THREE.Vector3(-21, .2, z), new THREE.Vector3(-18, 12.2, z), new THREE.Vector3(-10, 15.5, z), new THREE.Vector3(10, 15.5, z), new THREE.Vector3(18, 12.2, z), new THREE.Vector3(21, .2, z)], .22, this.steel);
      rib.name = `neb-hull-rib-${z}`;
    }
    this.box(this.root, this.dark, 0, 8, -44.6, 44, 16, .8);
    this.box(this.root, this.dark, 0, 8, 44.6, 44, 16, .8);
    for (const x of [-18.8, 18.8]) for (const offset of [0, .65, 1.3]) {
      this.pipe([new THREE.Vector3(x, 3 + offset, -43), new THREE.Vector3(x, 3 + offset, 43)], .12 + offset * .025, offset === .65 ? this.worn : this.steel);
    }
    for (let z = -39; z < 43; z += 9) {
      const lamp = this.box(this.root, this.screen, 0, 14.6, z, 4.6, .08, .6); lamp.rotation.z = z % 18 ? .02 : -.02;
      this.pointLight(`neb-deck-light-${z}`, 0xb8d4c7, 110, 20, 0, 13.7, z);
    }
  }

  private medicalBay(): void {
    const bed = new THREE.Group(); bed.name = 'neb-medical-bed'; bed.position.set(RECOVERY_BED.x, 0, RECOVERY_BED.z); this.root.add(bed);
    this.box(bed, this.dark, 0, .72, 0, 2.65, 1.35, 6.7);
    this.box(bed, this.steel, 0, 1.38, 0, 3.15, .18, 6.95);
    this.box(bed, this.linen, 0, 1.78, 0, 2.85, .62, 6.35);
    const pillow = this.box(bed, this.linen, 0, 2.08, -2.25, 2.35, .35, 1.35); pillow.rotation.x = -.11;
    for (const x of [-1.35, 1.35]) for (const z of [-2.6, 2.6]) {
      this.cylinder(bed, this.steel, x, .5, z, .12, 1);
      const wheel = this.mesh(bed, new THREE.TorusGeometry(.24, .055, 8, 20), this.rubber); wheel.position.set(x, .12, z); wheel.rotation.y = Math.PI / 2;
    }
    this.box(this.root, this.dark, -15.6, 3.4, -22, 6.2, 6.5, 10.5);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) this.crt(-14.2 + column * 2.8, 2.4 + row * 2.05, -17.2, Math.PI, row === 2);
    this.gantry.name = 'neb-recovery-gantry'; this.gantry.position.set(RECOVERY_BED.x, 6.2, RECOVERY_BED.z); this.root.add(this.gantry);
    this.box(this.gantry, this.steel, 0, 0, 0, 5.4, .38, 7.2);
    for (const side of [-1, 1]) {
      this.box(this.gantry, this.dark, side * 2.45, -2.7, 0, .34, 5.5, 7);
      this.pipe([new THREE.Vector3(RECOVERY_BED.x + side * 2.45, 6.2, RECOVERY_BED.z - 3.2), new THREE.Vector3(RECOVERY_BED.x + side * 4, 9.8, RECOVERY_BED.z - 4), new THREE.Vector3(side * 16, 14, -29)], .15, this.rubber);
    }
    const contacts = [
      ['chest', -.24, .08, .06], ['chest', .24, .08, .06], ['spine', -.18, .07, .08], ['spine', .18, .07, .08],
      ['pelvis', -.2, .08, .05], ['pelvis', .2, .08, .05], ['hip_L', 0, .08, .04], ['hip_R', 0, .08, .04],
      ['knee_L', 0, .07, .04], ['knee_R', 0, .07, .04], ['ankle_L', 0, .06, .04], ['ankle_R', 0, .06, .04],
    ] as const;
    for (let i = 0; i < contacts.length; i++) {
      const x = -1.5 + i % 4; const z = -2.1 + Math.floor(i / 4) * 2.1; const [bone, ox, oy, oz] = contacts[i];
      const shaft = this.cylinder(this.gantry, this.steel, x, -1, z, .014, 1, `neb-medical-needle-${i}`);
      const tip = this.mesh(this.gantry, new THREE.SphereGeometry(.035, 10, 7), i % 3 ? this.steel : this.amber, `neb-medical-needle-tip-${i}`);
      const hub = this.cylinder(this.gantry, this.rubber, x, -.35, z, .1, .4, `neb-medical-needle-carriage-${i}`);
      this.needles.push({ shaft, tip, hub, anchorY: -.55, bone, offset: new THREE.Vector3(ox, oy, oz) });
    }
    const curtain = this.box(this.root, this.glass, -1.1, 4.3, -22, .06, 7.4, 11); curtain.name = 'neb-medical-curtain';
    this.pointLight('neb-medical-task-light', 0xd9e6dc, 260, 22, -5.5, 9.2, -20.5);
  }

  private operatorCore(): void {
    this.chair(-6.5, -5, Math.PI / 2, 'neb-core-chair-morpheus');
    this.chair(6.5, -5, -Math.PI / 2, 'neb-core-chair-neo');
    this.chair(-6.5, 6, Math.PI / 2, 'neb-core-chair-trinity');
    this.chair(6.5, 6, -Math.PI / 2, 'neb-core-chair-four');
    for (const [x, z, yaw] of [[-11, -5, Math.PI / 2], [11, -5, -Math.PI / 2], [-11, 6, Math.PI / 2], [11, 6, -Math.PI / 2]] as const) {
      this.crt(x, 3.7, z, yaw); this.crt(x, 6.2, z, yaw, z > 0);
    }
    const ring = this.mesh(this.root, new THREE.TorusGeometry(10.8, .16, 10, 64), this.steel, 'neb-core-cable-ring'); ring.position.y = .08; ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      this.cylinder(this.root, i % 4 === 0 ? this.amber : this.screen, Math.sin(angle) * 9.5, .18, Math.cos(angle) * 9.5, .05, .22);
    }
    this.pointLight('neb-core-task-light', 0xb9d8cb, 210, 28, 0, 10, 0);
    this.trainingUpload();
    this.cypherConsole();
    this.betrayalScene();
    this.rescueBriefing();
  }

  private rescueBriefing(): void {
    this.rescueRig.name = 'neb-rescue-briefing'; this.rescueRig.visible = false; this.root.add(this.rescueRig);
    const green = this.material(new THREE.MeshBasicMaterial({ color: 0x8fffb7, transparent: true, opacity: .55, depthWrite: false, toneMapped: false }));
    const dim = this.material(new THREE.MeshBasicMaterial({ color: 0x4b9b72, transparent: true, opacity: .23, depthWrite: false, toneMapped: false }));
    const danger = this.material(new THREE.MeshBasicMaterial({ color: 0xff6659, transparent: true, opacity: .8, depthWrite: false, toneMapped: false }));
    for (const radius of [1.9, 3.1, 4.25]) {
      const ring = this.mesh(this.rescueRig, new THREE.RingGeometry(radius, radius + .045, 64), green, `neb-rescue-ring-${radius}`);
      ring.rotation.x = -Math.PI / 2; ring.position.y = .095;
    }
    this.rescueBuilding = new THREE.Group(); this.rescueBuilding.name = 'neb-rescue-building'; this.rescueBuilding.position.set(0, .18, -1.35); this.rescueRig.add(this.rescueBuilding);
    for (let floor = 0; floor < 6; floor++) {
      const slab = this.box(this.rescueBuilding, dim, 0, .24 + floor * .38, 0, 3.4 - floor * .12, .035, 2.35 - floor * .07, `neb-rescue-floor-${floor}`);
      slab.castShadow = slab.receiveShadow = false;
      for (const side of [-1, 1]) this.box(this.rescueBuilding, green, side * (1.55 - floor * .045), .42 + floor * .38, 0, .025, .34, 2.15 - floor * .07);
    }
    const lift = this.box(this.rescueBuilding, green, .72, 1.35, -.2, .16, 2.65, .16, 'neb-rescue-elevator'); lift.castShadow = false;
    const points = [new THREE.Vector3(0, .13, 3.05), new THREE.Vector3(-1.8, .13, 1.55), new THREE.Vector3(-1.25, .13, -.2),
      new THREE.Vector3(.72, .13, -1.45), new THREE.Vector3(.72, 2.75, -1.45)];
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]; const to = points[i + 1]; const middle = from.clone().add(to).multiplyScalar(.5); const length = from.distanceTo(to);
      const segment = this.box(this.rescueRig, green, middle.x, middle.y, middle.z, .095, .095, length, `neb-rescue-route-${i}`);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize()); segment.castShadow = false;
      this.rescueRoute.push(segment);
    }
    this.rescueSignal = this.mesh(this.rescueRig, new THREE.IcosahedronGeometry(.22, 1), danger, 'neb-rescue-morpheus-signal');
    this.rescueSignal.position.set(.72, 2.72, -1.45);
    for (let i = 0; i < 2; i++) {
      const ring = this.mesh(this.rescueSignal, new THREE.TorusGeometry(.38 + i * .2, .025, 8, 24), danger); ring.rotation.x = Math.PI / 2;
    }
    this.rescueLight = new THREE.PointLight(0x79e7a1, 0, 13, 2); this.rescueLight.name = 'neb-rescue-projection-light'; this.rescueLight.position.set(0, 4.4, 0);
    this.rescueRig.add(this.rescueLight); this.lights.add(this.rescueLight);
  }

  private cypherConsole(): void {
    this.consoleRig.name = 'neb-cypher-console-scene'; this.consoleRig.visible = false; this.root.add(this.consoleRig);
    const code = this.material(new THREE.MeshBasicMaterial({ color: 0x8dffac, toneMapped: false }));
    for (let row = 0; row < 17; row++) {
      const bar = this.box(this.consoleRig, code, 9.965, 2.55 + row * .16, 4.95 + (row * 7 % 18) * .12, .025, .035, .35 + (row * 11 % 9) * .13, `neb-cypher-code-${row}`);
      bar.userData.baseY = bar.position.y; this.codeBars.push(bar);
    }
    const glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0xa8b9af, transparent: true, opacity: .32, roughness: .12, depthWrite: false }));
    const liquor = this.material(new THREE.MeshPhysicalMaterial({ color: 0x9a6b33, transparent: true, opacity: .72, roughness: .2 }));
    const bottle = new THREE.Group(); bottle.name = 'neb-cypher-liquor-bottle'; bottle.position.set(4.9, 1.75, 7.15); this.consoleRig.add(bottle);
    this.cylinder(bottle, glass, 0, .55, 0, .28, 1.1); this.cylinder(bottle, glass, 0, 1.3, 0, .12, .55); this.cylinder(bottle, this.rubber, 0, 1.62, 0, .13, .12);
    this.cylinder(bottle, liquor, 0, .38, 0, .23, .55);
    const cup = new THREE.Group(); cup.name = 'neb-cypher-shot-glass'; cup.position.set(4.15, 1.63, 6.55); this.consoleRig.add(cup);
    this.mesh(cup, new THREE.CylinderGeometry(.2, .15, .42, 16, 1, true), glass); this.cylinder(cup, liquor, 0, -.12, 0, .13, .14);
    const lamp = new THREE.PointLight(0x88cda4, 0, 9, 2); lamp.name = 'neb-cypher-code-light'; lamp.position.set(8.9, 4, 6); this.consoleRig.add(lamp); this.lights.add(lamp);
  }

  private trainingUpload(): void {
    this.downloadRig.name = 'neb-training-upload-rig'; this.downloadRig.visible = false; this.root.add(this.downloadRig);
    this.box(this.downloadRig, this.steel, 6.5, 8.8, -5, 5.6, .36, .55, 'neb-training-overhead-rail');
    this.box(this.downloadRig, this.dark, 6.5, 7.25, -5, .48, 3.2, .48);
    this.downloadConnector.name = 'neb-training-jack'; this.downloadConnector.position.set(6.5, 5.8, -5); this.downloadRig.add(this.downloadConnector);
    const collar = this.cylinder(this.downloadConnector, this.steel, 0, 0, 0, .18, .65); collar.rotation.z = Math.PI / 2;
    const plug = this.cylinder(this.downloadConnector, this.downloadPulse, 0, -.43, 0, .075, .38); plug.rotation.z = Math.PI / 2;
    const cable = this.mesh(this.downloadRig, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(6.5, 9, -5), new THREE.Vector3(8.6, 10.8, -5), new THREE.Vector3(11.5, 9.2, -5),
    ]), 24, .11, 8), this.rubber, 'neb-training-cable'); cable.castShadow = true;
    const panel = new THREE.Group(); panel.name = 'neb-training-progress'; panel.position.set(10.78, 4.5, -5); panel.rotation.y = -Math.PI / 2; this.downloadRig.add(panel);
    this.box(panel, this.dark, 0, 0, 0, 2.2, 2.6, .22);
    for (let i = 0; i < 10; i++) {
      const bar = this.box(panel, this.downloadPulse, -.72 + i % 2 * .96, .85 - Math.floor(i / 2) * .42, .13, .7, .13, .035, `neb-training-bar-${i}`);
      this.downloadBars.push(bar);
    }
    for (let i = 0; i < 4; i++) this.cylinder(panel, i === 3 ? this.amber : this.steel, -.75 + i * .5, -1.02, .14, .075, .05).rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0x86e9ad, 0, 11, 2); light.name = 'neb-training-jack-light'; light.position.set(6.5, 5, -5); this.downloadRig.add(light); this.lights.add(light);
  }

  private betrayalScene(): void {
    this.betrayalRig.name = 'neb-betrayal-scene'; this.betrayalRig.visible = false; this.root.add(this.betrayalRig);
    const console = new THREE.Group(); console.name = 'neb-betrayal-console'; console.position.set(-10.4, 0, -14.2); console.rotation.y = .08; this.betrayalRig.add(console);
    this.box(console, this.dark, 0, 1.3, 0, 5.2, 2.6, 2.3); this.box(console, this.steel, 0, 2.7, -.3, 5.35, .28, 2.45);
    const display = this.box(console, this.screen, 0, 3.7, .1, 4.6, 1.55, .08, 'neb-betrayal-life-display'); display.rotation.x = -.23;
    for (let i = 0; i < 16; i++) {
      const trace = this.box(console, this.rubber, -2 + i * .27, 3.71 + Math.sin(i * 1.8) * .22, .15, .19, .025, .025);
      trace.rotation.x = -.23;
    }
    const roles = ['neo', 'trinity', 'apoc', 'switch'] as const;
    roles.forEach((role, index) => {
      const material = this.material(new THREE.MeshBasicMaterial({ color: 0x75e7a1, toneMapped: false }));
      const signal = this.box(console, material, -1.72 + index * 1.15, 3.18, .2, .72, .12, .035, `neb-betrayal-signal-${role}`);
      signal.userData.role = role; this.betrayalSignals.set(role, signal);
      const label = this.box(console, this.worn, -1.72 + index * 1.15, 2.94, .18, .72, .11, .03); label.userData.role = role;
    });
    for (const [role, root] of Object.entries({ apoc: [-6.5, -5], neo: [6.5, -5], trinity: [-6.5, 6], switch: [6.5, 6] }) as ['apoc' | 'neo' | 'trinity' | 'switch', [number, number]][]) {
      const jack = new THREE.Group(); jack.name = `neb-betrayal-jack-${role}`; jack.position.set(root[0], 3.25, root[1]); this.betrayalRig.add(jack); this.betrayalJacks.set(role, jack);
      const collar = this.cylinder(jack, this.steel, 0, 0, 0, .16, .52); collar.rotation.z = Math.PI / 2;
      const plug = this.cylinder(jack, this.amber, -.34, 0, 0, .075, .32); plug.rotation.z = Math.PI / 2;
      const cable = this.mesh(jack, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.42, 0, 0), new THREE.Vector3(-1.1, 1.55, .3), new THREE.Vector3(-1.8, 3.1, role === 'trinity' || role === 'switch' ? -.5 : .5),
      ]), 20, .075, 8), this.rubber); cable.name = `neb-betrayal-cable-${role}`;
      if (role === 'apoc' || role === 'switch') {
        const loose = new THREE.Group(); loose.name = `neb-betrayal-loose-${role}`; loose.position.set(root[0], 0, root[1]); this.betrayalRig.add(loose); this.betrayalLoose.set(role, loose);
        const fallenCable = this.mesh(loose, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.8, 6.35, role === 'switch' ? -.5 : .5), new THREE.Vector3(-1.1, 3.8, .3), new THREE.Vector3(-.5, 1.1, .15), new THREE.Vector3(.2, .35, 0),
        ]), 28, .075, 8), this.rubber); fallenCable.name = `neb-betrayal-fallen-cable-${role}`;
        const loosePlug = this.cylinder(loose, this.amber, .34, .35, 0, .075, .32); loosePlug.rotation.z = Math.PI / 2;
      }
    }
    this.betrayalFlash.name = 'neb-betrayal-counter-flash'; this.betrayalFlash.position.set(-4.1, 2.5, -10.4); this.betrayalRig.add(this.betrayalFlash);
    const flashMaterial = this.material(new THREE.MeshBasicMaterial({ color: 0xa8fff0, transparent: true, opacity: .88, toneMapped: false, depthWrite: false }));
    const core = this.mesh(this.betrayalFlash, new THREE.SphereGeometry(.34, 16, 10), flashMaterial); core.scale.z = 2.8;
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(this.betrayalFlash, new THREE.TorusGeometry(.42 + i * .27, .035, 8, 24), flashMaterial); ring.rotation.y = Math.PI / 2; ring.position.z = i * .45;
    }
    const flashLight = new THREE.PointLight(0xa8fff0, 420, 15, 2); flashLight.name = 'neb-betrayal-discharge-light'; this.betrayalFlash.add(flashLight); this.lights.add(flashLight);
    this.betrayalAlarm = new THREE.PointLight(0xbd382a, 0, 22, 2); this.betrayalAlarm.name = 'neb-betrayal-alarm'; this.betrayalAlarm.position.set(-3, 8.5, -5);
    this.betrayalRig.add(this.betrayalAlarm); this.lights.add(this.betrayalAlarm);
  }

  private mess(): void {
    this.box(this.root, this.steel, -8, 1.25, 22, 10, .3, 4.5, 'neb-mess-table');
    for (const x of [-11, -8, -5]) for (const z of [18.7, 25.3]) {
      this.box(this.root, this.dark, x, .65, z, 2.1, .28, 2.2);
      this.box(this.root, this.dark, x, .32, z, .25, .65, .25);
    }
    for (let i = 0; i < 5; i++) {
      this.cylinder(this.root, this.linen, -11.5 + i * 1.7, 1.65, 22, .25, .28);
      this.box(this.root, this.rubber, 10.5, 1.9 + i * 1.9, 25, 9, 1.55, 3.4);
    }
    this.crt(11, 10.8, 23.5, Math.PI, true);
    this.pointLight('neb-mess-task-light', 0xe4c995, 160, 23, -6, 9, 22);
    this.mealScene();
  }

  private shipLossScene(): void {
    this.shipLossRig.name = 'neb-final-evacuation'; this.shipLossRig.visible = false; this.root.add(this.shipLossRig);
    const warning = this.material(new THREE.MeshBasicMaterial({ color: 0xe66a50, toneMapped: false }));
    const radar = this.box(this.shipLossRig, this.rubber, 1.4, 3.7, 1.2, 5.2, 3.1, .55, 'neb-bomb-radar'); radar.rotation.y = -.25;
    this.box(this.shipLossRig, warning, 1.4, 3.72, 1.51, 4.45, 2.25, .04, 'neb-bomb-range-screen');
    for (let index = 0; index < 4; index++) {
      const mark = this.box(this.shipLossRig, this.rubber, -.3 + index * .92, 3.7, 1.55, .09, .09, .06); mark.rotation.z = index * .7;
    }
    for (const z of [7, 16, 25, 34]) for (const side of [-1, 1]) {
      this.box(this.shipLossRig, warning, side * 17.5, .16, z, .25, .07, 3.6, `neb-evacuation-path-${z}`);
      this.box(this.shipLossRig, warning, side * 17, 11.2, z, 1.6, .2, .65, 'neb-evacuation-lamp');
    }
    this.box(this.shipLossRig, this.steel, 0, 4.5, 39.6, 13, 9, .55, 'neb-cargo-frame');
    this.shipHatch = this.box(this.shipLossRig, this.dark, 0, 4.5, 39.2, 11.8, 8.6, .35, 'neb-cargo-hatch');
    this.box(this.shipLossRig, this.amber, 0, 9, 39.1, 4.4, .17, .1);
    this.shipAlarm = new THREE.PointLight(0xf04430, 0, 36, 2); this.shipAlarm.name = 'neb-evacuation-alarm'; this.shipAlarm.position.set(0, 10, 24);
    this.shipLossRig.add(this.shipAlarm); this.lights.add(this.shipAlarm);
  }

  private mealScene(): void {
    this.mealRig.name = 'neb-crew-meal-scene'; this.mealRig.visible = false; this.root.add(this.mealRig);
    const bowl = this.material(new THREE.MeshStandardMaterial({ color: 0x767a70, metalness: .28, roughness: .68 }));
    const food = this.material(new THREE.MeshStandardMaterial({ color: 0xb1a992, roughness: .92 }));
    const spoon = this.material(new THREE.MeshStandardMaterial({ color: 0x8e9995, metalness: .82, roughness: .25 }));
    const steam = this.material(new THREE.MeshBasicMaterial({ color: 0xdce3d5, transparent: true, opacity: .2, depthWrite: false, toneMapped: false }));
    this.neoBowl.name = 'neb-neo-protein-bowl'; this.neoBowl.position.set(-5.7, 1.62, 22); this.mealRig.add(this.neoBowl);
    const shell = this.mesh(this.neoBowl, new THREE.CylinderGeometry(.42, .28, .32, 20, 1, true), bowl); shell.position.y = .02;
    const contents = this.cylinder(this.neoBowl, food, 0, .16, 0, .31, .05); contents.scale.z = .92;
    const utensil = this.box(this.neoBowl, spoon, .42, .32, 0, .08, .05, 1.15, 'neb-neo-spoon'); utensil.rotation.y = -.25;
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(this.mealRig, new THREE.TorusGeometry(.14 + i * .04, .012, 6, 18), steam, `neb-meal-steam-${i}`);
      ring.rotation.x = Math.PI / 2; ring.userData.offset = i * .7; this.mealSteam.push(ring);
    }
    const tray = new THREE.Group(); tray.name = 'neb-protein-serving-tray'; tray.position.set(8.8, 1.7, 22); this.mealRig.add(tray);
    this.box(tray, this.steel, 0, 0, 0, 4.2, .16, 2.5);
    for (let i = 0; i < 4; i++) this.cylinder(tray, bowl, -1.35 + i * .9, .24, 0, .32, .27);
  }

  update(journey: FilmJourney | undefined, elapsed: number, recoverySubject?: THREE.Object3D): void {
    const loss = journey?.scene === 'm2_ship_lost' && !journey.visiting ? journey.shipLoss : undefined;
    this.shipLossRig.visible = Boolean(loss);
    if (loss) {
      this.shipHatch.position.y = loss.phase === 'evacuating' || loss.phase === 'escaped' ? 12.5 : 4.5;
      this.shipAlarm.intensity = loss.phase === 'briefing' ? 70 : loss.phase === 'failed' ? 30 : 170 + Math.sin(elapsed * 14) * 65;
    }
    const recovery = journey?.scene === 'm1_recovery' && !journey.visiting && journey.awakening?.kind === 'recovery' ? journey.awakening : undefined;
    const t = recovery?.elapsed ?? 0; const active = recovery?.started === true;
    const consoleActive = journey?.scene === 'm1_cypher_console' && !journey.visiting;
    for (const side of [-1, 1]) {
      const cable = this.root.getObjectByName(`neb-core-chair-four-cable-${side}`);
      if (cable) cable.visible = !consoleActive;
    }
    const descend = active ? THREE.MathUtils.smoothstep(t, 1.8, 3.8) * (1 - THREE.MathUtils.smoothstep(t, 7, 8.2)) : 0;
    const retract = active ? THREE.MathUtils.smoothstep(t, 7.5, 9.2) : 0;
    this.gantry.position.y = 6.2 - descend * 1.15 + retract * 6;
    this.gantry.rotation.z = Math.sin(elapsed * 2.1) * .004 * descend;
    this.root.updateWorldMatrix(true, true); recoverySubject?.updateWorldMatrix(true, true); this.gantry.updateWorldMatrix(true, true);
    this.needles.forEach((needle, i) => {
      const bone = recoverySubject?.getObjectByName(needle.bone);
      const fallback = new THREE.Vector3(RECOVERY_BED.x - this.gantry.position.x + (i % 2 ? .32 : -.32), 2.32 - this.gantry.position.y,
        RECOVERY_BED.z - this.gantry.position.z - 2.1 + Math.floor(i / 4) * 2.1);
      const target = bone ? this.gantry.worldToLocal(bone.localToWorld(needle.offset.clone())) : fallback;
      const insert = active ? THREE.MathUtils.smoothstep(t, 2.1 + i % 4 * .12, 3.25 + i % 4 * .12)
        * (1 - THREE.MathUtils.smoothstep(t, 6.75 + Math.floor(i / 4) * .08, 8.15 + Math.floor(i / 4) * .08)) : 0;
      const anchor = new THREE.Vector3(target.x, needle.anchorY, target.z);
      const tip = anchor.clone().add(new THREE.Vector3(0, -.72, 0)).lerp(target, insert);
      const direction = tip.clone().sub(anchor); const length = direction.length();
      needle.hub.position.set(anchor.x, -.35, anchor.z);
      needle.shaft.position.copy(anchor).add(tip).multiplyScalar(.5);
      needle.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); needle.shaft.scale.y = length;
      needle.tip.position.copy(tip); needle.shaft.visible = needle.tip.visible = Boolean(recovery);
    });
    const training = journey?.scene === 'm1_download' && !journey.visiting && journey.training?.kind === 'download' ? journey.training : undefined;
    this.downloadRig.visible = Boolean(training);
    if (training) {
      const contact = training.started ? THREE.MathUtils.smoothstep(training.elapsed, .25, 1.7) : 0;
      this.downloadConnector.position.y = 5.8 - contact * 2.05;
      this.downloadConnector.rotation.z = Math.sin(training.elapsed * 13) * .015 * contact;
      const filled = Math.floor(training.elapsed / 10 * this.downloadBars.length);
      this.downloadBars.forEach((bar, index) => { bar.visible = index < filled || training.started && index === filled && Math.sin(elapsed * 10) > 0; });
      const jackLight = this.downloadRig.getObjectByName('neb-training-jack-light') as THREE.PointLight;
      jackLight.intensity = training.started ? 130 + Math.sin(elapsed * 17) * 22 : 24;
      this.downloadPulse.color.setHex(training.elapsed > 8.8 ? 0xd8ffd9 : 0x8cf4b8);
    }
    const consoleBeat = journey?.scene === 'm1_cypher_console' && !journey.visiting && journey.interlude?.kind === 'console' ? journey.interlude : undefined;
    this.consoleRig.visible = Boolean(consoleBeat);
    if (consoleBeat) {
      const t = consoleBeat.elapsed;
      this.codeBars.forEach((bar, index) => { bar.position.y = Number(bar.userData.baseY) + ((elapsed * .38 + index * .11) % 2.7) - 1.35; bar.visible = consoleBeat.phase !== 'performing' || t < 1.15 || index % 4 !== 0; });
      const light = this.consoleRig.getObjectByName('neb-cypher-code-light') as THREE.PointLight; light.intensity = 75 + Math.sin(elapsed * 7) * 15;
      const cup = this.consoleRig.getObjectByName('neb-cypher-shot-glass')!;
      const lift = consoleBeat.phase === 'responding' ? Math.sin(Math.min(1, t / 3.8) * Math.PI) : consoleBeat.phase === 'performing' ? Math.sin(THREE.MathUtils.clamp((t - 4.6) / 3, 0, 1) * Math.PI) : 0;
      cup.position.y = 1.63 + lift * 1.15; cup.rotation.z = -lift * .22;
    }
    const meal = journey?.scene === 'm1_meal' && !journey.visiting && journey.interlude?.kind === 'meal' ? journey.interlude : undefined;
    this.mealRig.visible = Boolean(meal);
    if (meal) {
      const t = meal.phase === 'performing' ? meal.elapsed : meal.phase === 'done' ? 13.2 : 0;
      const slide = THREE.MathUtils.smoothstep(t, .35, 2.1); this.neoBowl.position.x = THREE.MathUtils.lerp(-5.7, -3.25, slide);
      this.mealSteam.forEach((ring, index) => {
        const cycle = (elapsed * .35 + Number(ring.userData.offset)) % 1;
        ring.position.set(this.neoBowl.position.x, 2.1 + cycle * 1.1, 22); ring.scale.setScalar(.65 + cycle * .8); ring.visible = meal.phase === 'performing' && t < 9;
      });
    }
    const betrayal = journey?.scene === 'm1_unplugged' && !journey.visiting && journey.betrayal?.kind === 'unplugged' ? journey.betrayal : undefined;
    this.betrayalRig.visible = Boolean(betrayal);
    if (betrayal) {
      const afterPulls = ['aiming', 'window', 'failed', 'countering', 'reconnect', 'done'].includes(betrayal.phase);
      const disconnected = {
        apoc: afterPulls || betrayal.phase === 'unplugging' && betrayal.elapsed >= 2.25,
        switch: afterPulls || betrayal.phase === 'unplugging' && betrayal.elapsed >= 4.55,
      };
      for (const role of ['apoc', 'switch'] as const) {
        this.betrayalJacks.get(role)!.visible = !disconnected[role]; this.betrayalLoose.get(role)!.visible = disconnected[role];
      }
      for (const role of ['neo', 'trinity'] as const) this.betrayalJacks.get(role)!.visible = true;
      for (const role of ['neo', 'trinity', 'apoc', 'switch'] as const) {
        const signal = this.betrayalSignals.get(role)!; const dead = role === 'apoc' ? disconnected.apoc : role === 'switch' ? disconnected.switch : betrayal.phase === 'failed';
        (signal.material as THREE.MeshBasicMaterial).color.setHex(dead ? 0x4c1815 : 0x75e7a1);
        signal.scale.y = dead ? .55 : .8 + Math.sin(elapsed * 8 + role.length) * .2;
      }
      const discharge = betrayal.phase === 'countering' && betrayal.elapsed >= 2.16 && betrayal.elapsed <= 2.62;
      this.betrayalFlash.visible = discharge;
      if (discharge) {
        const pulse = 1 + Math.sin((betrayal.elapsed - 2.16) * 28) * .24; this.betrayalFlash.scale.setScalar(pulse);
        this.betrayalFlash.rotation.z = elapsed * 2.4;
      }
      this.betrayalAlarm.intensity = ['unplugging', 'aiming', 'window', 'countering'].includes(betrayal.phase) ? 72 + Math.sin(elapsed * 9) * 35 : 18;
      const display = this.betrayalRig.getObjectByName('neb-betrayal-life-display') as THREE.Mesh;
      display.scale.y = .96 + Math.sin(elapsed * 5) * .04;
    } else this.betrayalFlash.visible = false;
    const rescue = journey?.scene === 'm1_rescue_decision' && !journey.visiting ? journey.rescue : undefined;
    this.rescueRig.visible = Boolean(rescue);
    if (rescue) {
      const progress = rescue.phase === 'briefing' ? Math.min(1, rescue.elapsed / RESCUE.briefing) : rescue.phase === 'briefing_done' ? 1 : 0;
      this.rescueBuilding.rotation.y = -.16 + Math.sin(elapsed * .28) * .08;
      this.rescueBuilding.scale.y = .82 + progress * .18;
      this.rescueRoute.forEach((segment, index) => { segment.visible = progress >= index / this.rescueRoute.length || rescue.phase === 'briefing_done'; });
      const pulse = 1 + Math.sin(elapsed * 6.5) * .18; this.rescueSignal.scale.setScalar(pulse);
      this.rescueSignal.visible = rescue.phase !== 'briefing_ready' || Math.sin(elapsed * 4) > -.35;
      this.rescueLight.intensity = rescue.phase === 'briefing' ? 95 + Math.sin(elapsed * 5) * 18 : rescue.phase === 'briefing_done' ? 72 : 35;
    }
  }

  dispose(): void {
    this.root.clear();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.needles = []; this.downloadBars = [];
    this.betrayalJacks.clear(); this.betrayalLoose.clear(); this.betrayalSignals.clear();
  }
}
