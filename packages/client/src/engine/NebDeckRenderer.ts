import { crosscutActive } from '@auto_matrix/shared';
import { truthUnplug, truthRest, TRUTH_BEDSIDE, DOWNLOAD_OPERATOR, downloadDiskPose } from '@auto_matrix/shared';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RECOVERY_BED, RECOVERY_CABINET, RECOVERY_FRAME, RESCUE, type FilmJourney } from '@auto_matrix/shared';
import { CABIN, CABIN_WALLS, MEDICAL_OPERATOR, medicalControlBlend, cabinPlugProgress } from '@auto_matrix/shared';
import { relayPlugContact } from '../agents/TrinityRelayPerformance.js';
import { NEB_ESCAPE, nebHatchHeight } from '@auto_matrix/shared';
import { NebEscapeRenderer } from './NebEscapeRenderer.js';

/** The Nebuchadnezzar is one continuous deck: medical bay, operator core and mess.
 * The central aisle remains open so recovery hands control back to the player. */
export class NebDeckRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private roomKeys: THREE.SpotLight[] = [];
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
  private cabinDoor!: THREE.Mesh;
  private medicalLever!: THREE.Mesh;
  private truthSeat = new THREE.Group();
  private corePlug = new THREE.Group();
  private coreCable!: THREE.Mesh;
  private recoverySkin?: THREE.SkinnedMesh;
  private skinContacts = new Map<number, THREE.Vector3>();
  private needles: { shaft: THREE.Mesh; tip: THREE.Mesh; hub: THREE.Mesh; support: THREE.Mesh; anchorY: number; bone: string; offset: THREE.Vector3 }[] = [];
  private downloadRig = new THREE.Group();
  private downloadDisk = new THREE.Group();
  private downloadScreen?: THREE.CanvasTexture;
  private downloadScreenFrame = -1;
  private consoleScreen?: THREE.CanvasTexture;
  private consoleScreenFrame = -1;
  private downloadBars: THREE.Mesh[] = [];
  private downloadPulse = this.material(new THREE.MeshBasicMaterial({ color: 0x8cf4b8, toneMapped: false }));
  private consoleRig = new THREE.Group();
  private operatorCables: THREE.Mesh[] = [];
  private mealRig = new THREE.Group();
  private neoBowl = new THREE.Group();
  private mealSteam: THREE.Mesh[] = [];
  private mealLamp!: THREE.PointLight;
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
  private shipRadar!: THREE.ShaderMaterial;
  private sternPlate!: THREE.Mesh;
  private deckRig = new THREE.Group();
  private escapeExterior: NebEscapeRenderer;

  constructor(private root: THREE.Group) {
    this.hull();
    this.medicalBay();
    this.cabin();
    this.operatorCore();
    this.mess();
    this.shipLossScene();
    for (const child of [...root.children]) this.deckRig.add(child);
    this.deckRig.name = 'neb-interior-deck'; root.add(this.deckRig);
    this.escapeExterior = new NebEscapeRenderer(root);
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
  private roomKey(name: string, color: number, intensity: number, distance: number, position: THREE.Vector3, target: THREE.Vector3, angle = Math.PI / 3): void {
    const light = new THREE.SpotLight(color, intensity, distance, angle, .6, 2);
    light.name = name; light.position.copy(position); light.target.position.copy(target); light.visible = false;
    light.shadow.mapSize.set(1024, 1024); light.shadow.camera.near = .35;
    light.shadow.bias = -.0004; light.shadow.normalBias = .025;
    this.root.add(light, light.target); this.lights.add(light); this.roomKeys.push(light);
  }
  private chair(x: number, z: number, yaw: number, name: string): void {
    const chair = new THREE.Group(); chair.name = name; chair.position.set(x, 0, z); chair.rotation.y = yaw; this.root.add(chair);
    this.box(chair, this.dark, 0, .65, -.35, 2.7, 1.1, 1.7);
    const cushion = this.box(chair, this.leather, 0, 1.25, -.25, 2.35, .3, 1.75); cushion.rotation.x = .15;
    const back = this.box(chair, this.leather, 0, 2.15, -1.22, 2.35, 2.2, .32, `${name}-backrest`); back.rotation.x = .28;
    if (name === 'neb-core-chair-trinity') {
      const headrest = new THREE.Group(); headrest.name = `${name}-relay-headrest`; chair.add(headrest);
      headrest.position.set(0, 2.89, -1.006); headrest.rotation.x = .28; headrest.visible = false;
      for (const side of [-1, 1]) this.box(headrest, this.leather, side * .9, 0, 0, .45, .88, .32);
    }
    for (const side of [-1, 1]) {
      this.box(chair, this.dark, side * 1.3, 1.35, -.25, .22, 1.7, 1.85);
      const cable = this.pipe([new THREE.Vector3(side * 1.6, 1.1, -2.05), new THREE.Vector3(side * 2, 5, -2.9), new THREE.Vector3(side * 2.4, 7, -4)]
        .map(point => point.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(x, 0, z))), .07, this.rubber);
      cable.name = `${name}-cable-${side}`;
      this.operatorCables.push(cable);
    }
    this.box(chair, this.steel, 0, .16, 1.45, 1.75, .1, 1, `${name}-footrest`);
  }
  private crt(x: number, y: number, z: number, yaw = 0, amber = false): void {
    const group = new THREE.Group(); group.name = 'neb-core-monitor'; group.position.set(x, y, z); group.rotation.y = yaw; this.root.add(group);
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
    this.sternPlate = this.box(this.root, this.dark, 0, 8, NEB_ESCAPE.sternZ, 44, 16, .8, 'neb-stern-plate');
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
    this.box(bed, this.dark, 0, .32, 0, 2.65, .54, 6.7);
    this.box(bed, this.steel, 0, .66, 0, 3.15, .14, 6.95);
    this.box(bed, this.linen, 0, RECOVERY_BED.surface - .19, 0, 2.85, .38, 6.35);
    // Compressed cloth supports the actual occiput; the old tilted block cut through it.
    const pillow = this.mesh(bed, new RoundedBoxGeometry(1.55, .15, 1.12, 4, .07), this.linen, 'neb-medical-pillow');
    pillow.position.set(0, RECOVERY_BED.surface + .075, 2.05);
    for (const x of [-1.35, 1.35]) for (const z of [-2.6, 2.6]) {
      this.cylinder(bed, this.steel, x, .5, z, .12, 1);
      const wheel = this.mesh(bed, new THREE.TorusGeometry(.24, .055, 8, 20), this.rubber); wheel.position.set(x, .12, z); wheel.rotation.y = Math.PI / 2;
    }
    const cabinet = RECOVERY_CABINET;
    this.box(this.root, this.dark, cabinet.x, cabinet.y, cabinet.z, cabinet.width, cabinet.height, cabinet.depth, 'neb-medical-cabinet');
    for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) this.crt(-14.2 + column * 2.8, 2.4 + row * 2.05, -17.2, Math.PI, row === 2);
    this.gantry.name = 'neb-recovery-gantry'; this.gantry.position.set(RECOVERY_BED.x, 6.2, RECOVERY_BED.z); this.root.add(this.gantry);
    for (const side of [-1, 1]) {
      this.box(this.gantry, this.steel, side * 2.45, 0, 0, .14, .18, 7.2, `neb-medical-side-rail-${side}`);
      this.box(this.gantry, this.steel, 0, 0, side * 3.45, 5.1, .18, .14, `neb-medical-end-rail-${side}`);
      for (const end of [-1, 1]) this.box(this.root, this.dark, RECOVERY_BED.x + side * RECOVERY_FRAME.halfWidth, RECOVERY_FRAME.height / 2,
        RECOVERY_BED.z + end * RECOVERY_FRAME.halfLength, RECOVERY_FRAME.post, RECOVERY_FRAME.height, RECOVERY_FRAME.post, `neb-medical-post-${side}-${end}`);
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
      const support = this.box(this.gantry, this.steel, 0, -.08, z, 1, .07, .09, `neb-medical-carriage-arm-${i}`);
      this.needles.push({ shaft, tip, hub, support, anchorY: -.55, bone, offset: new THREE.Vector3(ox, oy, oz) });
    }
    const curtain = this.box(this.root, this.glass, -1.1, 4.3, -22, .06, 7.4, 11); curtain.name = 'neb-medical-curtain';
    this.pointLight('neb-medical-task-light', 0xd9e6dc, 260, 22, -5.5, 9.2, -20.5);
    this.roomKey('neb-medical-key-light', 0xd9e6dc, 140, 18, new THREE.Vector3(-5.5, 9.2, -20.5), new THREE.Vector3(-7, 1.1, -22));
    const control = MEDICAL_OPERATOR.control;
    this.box(this.root, this.dark, control.x, 1.12, control.z - .3, 1.4, 2.2, .8, 'neb-medical-controls');
    this.box(this.root, this.worn, control.x, 2.25, control.z - .3, 1.5, .15, .9);
    this.medicalLever = this.cylinder(this.root, this.rubber, control.x, control.y, control.z, .12, .23, 'neb-medical-control-knob');
    for (let i = 0; i < 4; i++) this.box(this.root, this.amber, control.x - .5 + i * .17, 2.34, control.z - .5, .08, .05, .13);
  }

  private cabin(): void {
    const wall = this.material(new THREE.MeshStandardMaterial({ color: 0x51524a, metalness: .42, roughness: .81 }));
    const bedding = this.material(new THREE.MeshStandardMaterial({ color: 0x5e6258, roughness: .98 }));
    CABIN_WALLS.forEach((part, i) => this.box(this.root, wall, part.x, part.height / 2, part.z, part.width, part.height, part.depth, `neb-cabin-wall-${i}`));
    this.box(this.root, this.dark, 12, 6.9, -33, 12, .2, 14, 'neb-cabin-ceiling');
    for (const x of [6.25, 17.75]) for (const z of [-38, -34, -27]) {
      this.box(this.root, this.steel, x, 3.4, z, .18, 6.6, .12);
      for (const y of [.4, 3.6, 6.3]) {
        const bolt = this.cylinder(this.root, this.dark, x + (x < 12 ? .11 : -.11), y, z, .07, .08);
        bolt.rotation.z = Math.PI / 2;
      }
    }
    const { x, z, surface } = CABIN.bed;
    this.box(this.root, this.dark, x, .32, z, 2.65, .54, 6.7, 'neb-cabin-bed-base');
    this.box(this.root, this.steel, x, .66, z, 3.15, .14, 6.95, 'neb-cabin-bed-frame');
    this.box(this.root, bedding, x, surface - .19, z, 2.85, .38, 6.35, 'neb-cabin-mattress');
    const pillow = this.mesh(this.root, new RoundedBoxGeometry(1.55, .2, 1.12, 4, .07), this.linen, 'neb-cabin-pillow');
    pillow.position.set(x, surface + .1, z + 2.05);
    const blanket = this.box(this.root, this.linen, x, 1.21, z - 2.5, 2.72, .17, .9, 'neb-cabin-folded-blanket'); blanket.rotation.y = .025;
    for (let row = 0; row < 6; row++) this.box(this.root, this.rubber, 12, 5.2 + row * .1, -39.78, 2.4, .035, .07);
    const locker = CABIN.locker;
    this.box(this.root, this.worn, locker.x, 2.2, locker.z, locker.width, 3.8, locker.depth, 'neb-cabin-locker');
    this.box(this.root, this.steel, 16.97, 2.5, -38.3, .05, .4, .13);
    this.cabinDoor = this.box(this.root, this.worn, CABIN.door.x, 2.9, CABIN.door.z, .22, 5.8, CABIN.door.width, 'neb-cabin-door');
    this.box(this.root, this.dark, CABIN.door.x, 6.2, CABIN.door.z, .45, .9, 4.7, 'neb-cabin-door-lintel');
    this.box(this.root, this.screen, 13.2, 6.5, -32, 3.6, .1, .22, 'neb-cabin-light-strip');
    this.pointLight('neb-cabin-light', 0xe0dfcb, 105, 12, 13.2, 5.6, -32);
    this.pointLight('neb-cabin-bounce', 0xb1c4ce, 30, 10, 8.4, 4.8, -29.5);
    this.roomKey('neb-cabin-key-light', 0xe0dfcb, 80, 12, new THREE.Vector3(13.2, 6.35, -32), new THREE.Vector3(12, 1.1, -32), Math.PI * .4);
    this.truthSeat.name = 'neb-truth-bedside-stool'; this.truthSeat.position.set(TRUTH_BEDSIDE.x, 0, TRUTH_BEDSIDE.z); this.root.add(this.truthSeat);
    this.cylinder(this.truthSeat, this.dark, 0, 1.12, 0, .68, .22, 'neb-truth-stool-cushion');
    for (const dx of [-.45, .45]) for (const dz of [-.45, .45]) this.cylinder(this.truthSeat, this.steel, dx, .5, dz, .06, 1);
    this.truthSeat.visible = false;
    this.corePlug.name = 'neb-first-core-connector'; this.root.add(this.corePlug);
    const plug = this.cylinder(this.corePlug, this.steel, 0, 0, 0, .09, .5); plug.rotation.z = Math.PI / 2;
    const grip = this.cylinder(this.corePlug, this.rubber, .24, 0, 0, .135, .23); grip.rotation.z = Math.PI / 2;
    this.coreCable = this.cylinder(this.root, this.rubber, 0, 0, 0, .035, 1, 'neb-first-core-cable');
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
    this.roomKey('neb-core-key-light', 0xb9d8cb, 140, 18, new THREE.Vector3(0, 10, -.8), new THREE.Vector3(0, 1.1, -4));
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
    const terminal = new THREE.Group(); terminal.name = 'neb-cypher-console-terminal'; terminal.position.set(10, 0, 6); terminal.rotation.y = -Math.PI / 2; this.consoleRig.add(terminal);
    this.box(terminal, this.dark, 0, 3.95, 0, 4.35, 4.15, .52, 'neb-cypher-console-casing');
    this.box(terminal, this.worn, 0, 1.74, .82, 4.15, .24, 1.85, 'neb-cypher-console-desk').rotation.x = -.11;
    this.box(terminal, this.rubber, 0, 1.92, 1.35, 2.5, .11, .72, 'neb-cypher-console-keyboard').rotation.x = -.11;
    for (let column = -8; column <= 8; column++) for (let row = 0; row < 3; row++) {
      const key = this.box(terminal, this.linen, column * .135, 1.99, 1.38 + row * .14, .09, .028, .075); key.rotation.x = -.11;
    }
    const display = this.material(new THREE.MeshBasicMaterial({ color: 0xc8f6cf, toneMapped: false }));
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 720;
      this.consoleScreen = new THREE.CanvasTexture(canvas); this.consoleScreen.colorSpace = THREE.SRGBColorSpace;
      display.map = this.consoleScreen;
    }
    this.box(terminal, display, 0, 4.05, .278, 3.8, 2.92, .025, 'neb-cypher-console-display');
    this.box(terminal, this.steel, 0, 2.48, .34, 4.02, .1, .16, 'neb-cypher-console-lower-rail');
    for (const x of [-1.72, 1.72]) this.box(terminal, this.steel, x, 4.04, .18, .1, 3.4, .14, 'neb-cypher-console-side-rail');
    const glass = this.material(new THREE.MeshPhysicalMaterial({ color: 0xa8b9af, transparent: true, opacity: .32, roughness: .12, depthWrite: false }));
    const liquor = this.material(new THREE.MeshPhysicalMaterial({ color: 0x9a6b33, transparent: true, opacity: .72, roughness: .2 }));
    const bottle = new THREE.Group(); bottle.name = 'neb-cypher-liquor-bottle'; bottle.position.set(4.9, 1.75, 7.15); this.consoleRig.add(bottle);
    this.cylinder(bottle, glass, 0, .55, 0, .28, 1.1); this.cylinder(bottle, glass, 0, 1.3, 0, .12, .55); this.cylinder(bottle, this.rubber, 0, 1.62, 0, .13, .12);
    this.cylinder(bottle, liquor, 0, .38, 0, .23, .55);
    const cup = new THREE.Group(); cup.name = 'neb-cypher-shot-glass'; cup.position.set(4.15, 1.63, 6.55); this.consoleRig.add(cup);
    this.mesh(cup, new THREE.CylinderGeometry(.2, .15, .42, 16, 1, true), glass); this.cylinder(cup, liquor, 0, -.12, 0, .13, .14);
    const lamp = new THREE.PointLight(0x88cda4, 0, 10, 2); lamp.name = 'neb-cypher-console-task-light'; lamp.position.set(8.8, 4.3, 6); this.consoleRig.add(lamp); this.lights.add(lamp);
  }

  private trainingUpload(): void {
    this.downloadRig.name = 'neb-training-upload-rig'; this.downloadRig.visible = false; this.root.add(this.downloadRig);
    const desk = DOWNLOAD_OPERATOR.desk, key = DOWNLOAD_OPERATOR.keyboard, drive = DOWNLOAD_OPERATOR.drive;
    this.box(this.downloadRig, this.worn, desk.x, desk.height - .12, desk.z, desk.width, .24, desk.depth, 'neb-training-desk');
    for (const side of [-1, 1]) this.box(this.downloadRig, this.dark, desk.x + side * 1.4, 1.1, desk.z, .18, 2.2, 1.3);
    this.box(this.downloadRig, this.rubber, key.x, key.y + .02, key.z, 1.7, .09, .48, 'neb-training-keyboard');
    const keys = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(.095, .035, .08)), this.linen, 48);
    keys.name = 'neb-training-keys'; keys.castShadow = true;
    for (let i = 0; i < 48; i++) keys.setMatrixAt(i, new THREE.Matrix4().makeTranslation(key.x - .7 + (i % 12) * .126, key.y + .075, key.z - .15 + Math.floor(i / 12) * .1));
    this.downloadRig.add(keys);
    this.box(this.downloadRig, this.dark, drive.x, drive.y, drive.z - .18, .9, .44, .8, 'neb-training-drive');
    this.box(this.downloadRig, this.rubber, drive.x, drive.y, drive.z + .235, .61, .075, .025, 'neb-training-drive-slot');
    this.downloadDisk.name = 'neb-training-disk'; this.downloadRig.add(this.downloadDisk);
    this.box(this.downloadDisk, this.rubber, 0, 0, 0, .44, .045, .45);
    this.box(this.downloadDisk, this.steel, 0, .025, -.125, .32, .008, .18);
    this.box(this.downloadDisk, this.linen, 0, .025, .07, .35, .008, .18);
    for (let row = 0; row < 3; row++) this.box(this.downloadDisk, this.dark, -.02, .031, .02 + row * .045, .23, .003, .014);
    const panel = new THREE.Group(); panel.name = 'neb-training-progress'; panel.position.set(11.5, 3.72, -10.2); this.downloadRig.add(panel);
    this.box(panel, this.dark, 0, 0, 0, 2.4, 1.95, 1.25);
    this.box(panel, this.worn, 0, -.9, .12, 2.55, .14, 1.45);
    const display = this.material(new THREE.MeshBasicMaterial({ color: 0xc1e3bf, toneMapped: false }));
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640;
      this.downloadScreen = new THREE.CanvasTexture(canvas); this.downloadScreen.colorSpace = THREE.SRGBColorSpace;
      display.map = this.downloadScreen;
    }
    this.box(panel, display, 0, .08, .638, 2.07, 1.5, .025, 'neb-training-screen');
    for (let i = 0; i < 10; i++) {
      const bar = this.box(panel, this.downloadPulse, -.87 + i * .19, -.5, .663, .145, .06, .01, `neb-training-bar-${i}`);
      this.downloadBars.push(bar);
    }
    for (let i = 0; i < 3; i++) this.cylinder(panel, i === 2 ? this.amber : this.steel, .55 + i * .17, -.8, .65, .045, .025).rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0xb3d7c8, 0, 10, 2); light.name = 'neb-training-jack-light'; light.position.set(10.8, 4.8, -8.8); this.downloadRig.add(light); this.lights.add(light);
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
    this.shipRadar = this.material(new THREE.ShaderMaterial({ uniforms: { age: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform float age;
        void main(){vec2 p=(vUv-.5)*vec2(2.,1.);float r=length(p);
          float ring=1.-smoothstep(.004,.012,abs(r-.31));
          float grid=(1.-smoothstep(.002,.007,abs(p.x)))+(1.-smoothstep(.002,.007,abs(p.y)));
          float contact=1.-smoothstep(.012,.025,length(p-vec2(.68,.18)));
          contact+=1.-smoothstep(.012,.025,length(p-vec2(.65,-.17)));
          float bomb=1.-smoothstep(.012,.028,length(p-vec2(max(.08,.58-age*.018),.04)));
          vec3 c=vec3(.009,.035,.026)+vec3(.18,.43,.29)*(ring+grid*.18)+vec3(.85,.58,.23)*contact+vec3(1.,.2,.04)*bomb;
          c*=.88+.12*sin(vUv.y*640.);gl_FragColor=vec4(c,1.);}` }));
    this.box(this.shipLossRig, this.shipRadar, 1.4, 3.72, 1.51, 4.45, 2.25, .04, 'neb-bomb-range-screen');
    for (const z of [7, 16, 25, 34]) for (const side of [-1, 1]) {
      this.box(this.shipLossRig, warning, side * 17.5, .16, z, .25, .07, 3.6, `neb-evacuation-path-${z}`);
      this.box(this.shipLossRig, warning, side * 17, 11.2, z, 1.6, .2, .65, 'neb-evacuation-lamp');
    }
    const frame = new THREE.Group(); frame.name = 'neb-cargo-frame'; this.shipLossRig.add(frame);
    for (const side of [-1, 1]) {
      this.box(frame, this.steel, side * 6.2, 4.5, 39.6, .6, 9, .55, `neb-cargo-jamb-${side}`);
      this.box(this.shipLossRig, this.dark, side * 14.45, 8, NEB_ESCAPE.sternZ, 17.1, 16, .8, `neb-stern-side-${side}`);
    }
    this.box(frame, this.steel, 0, 8.9, 39.6, 13, .4, .55, 'neb-cargo-lintel');
    this.box(this.shipLossRig, this.dark, 0, 12.5, NEB_ESCAPE.sternZ, NEB_ESCAPE.hatch.width, 7, .8, 'neb-stern-lintel');
    const door = NEB_ESCAPE.hatch;
    this.shipHatch = this.box(this.shipLossRig, this.dark, 0, door.closedY, door.z, door.width, door.height, door.depth, 'neb-cargo-hatch');
    this.box(this.shipLossRig, this.amber, 0, 9, 39.1, 4.4, .17, .1);
    this.shipAlarm = new THREE.PointLight(0xf04430, 0, 36, 2); this.shipAlarm.name = 'neb-evacuation-alarm'; this.shipAlarm.position.set(0, 10, 24);
    this.shipLossRig.add(this.shipAlarm); this.lights.add(this.shipAlarm);
  }

  private mealScene(): void {
    this.mealRig.name = 'neb-crew-meal-scene'; this.mealRig.visible = false; this.root.add(this.mealRig);
    const bowl = this.material(new THREE.MeshStandardMaterial({ color: 0x767a70, metalness: .28, roughness: .68 }));
    const food = this.material(new THREE.MeshStandardMaterial({ color: 0xb1a992, roughness: .92 }));
    const spoon = this.material(new THREE.MeshStandardMaterial({ color: 0x8e9995, metalness: .82, roughness: .25 }));
    const runner = this.material(new THREE.MeshStandardMaterial({ color: 0x55584e, roughness: .92 }));
    const steam = this.material(new THREE.MeshBasicMaterial({ color: 0xdce3d5, transparent: true, opacity: .2, depthWrite: false, toneMapped: false }));
    this.box(this.mealRig, runner, -8, 1.43, 22, 8.85, .04, .92, 'neb-meal-table-runner');
    for (const [index, x, z] of [[0, -4.7, 20.35], [1, -8, 20.35], [2, -11.2, 20.35], [3, -4.7, 23.65], [4, -8, 23.65], [5, -11.2, 23.65]] as const) {
      const place = new THREE.Group(); place.name = `neb-meal-place-setting-${index}`; place.position.set(x, 0, z); this.mealRig.add(place);
      this.cylinder(place, this.linen, 0, 1.47, 0, .54, .05);
      this.cylinder(place, bowl, 0, 1.59, 0, .29, .25);
      this.cylinder(place, food, 0, 1.74, 0, .21, .04);
      const placeSpoon = this.box(place, spoon, .48, 1.61, 0, .065, .035, .82); placeSpoon.rotation.y = index < 3 ? -.18 : .18;
    }
    const pot = new THREE.Group(); pot.name = 'neb-meal-communal-pot'; pot.position.set(-8, 1.45, 22); this.mealRig.add(pot);
    this.cylinder(pot, this.dark, 0, .08, 0, .92, .16);
    this.cylinder(pot, bowl, 0, .28, 0, .8, .34);
    this.cylinder(pot, food, 0, .47, 0, .68, .05);
    const rim = this.mesh(pot, new THREE.TorusGeometry(.79, .045, 8, 24), this.steel); rim.position.y = .47; rim.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) this.box(pot, this.steel, side * .94, .32, 0, .3, .1, .42);
    const pendant = new THREE.Group(); pendant.name = 'neb-meal-pendant-fixture'; this.mealRig.add(pendant);
    this.cylinder(pendant, this.steel, -8, 8.2, 22, .07, 3.1, 'neb-meal-pendant-chain');
    const shade = this.mesh(pendant, new THREE.ConeGeometry(.78, .62, 20, 1, true), this.dark, 'neb-meal-pendant-shade'); shade.position.set(-8, 6.83, 22); shade.rotation.x = Math.PI;
    this.cylinder(pendant, this.amber, -8, 6.55, 22, .46, .055, 'neb-meal-pendant-bulb');
    this.mealLamp = new THREE.PointLight(0xf0c78f, 0, 12, 2); this.mealLamp.name = 'neb-meal-pendant-light'; this.mealLamp.position.set(-8, 6.48, 22);
    this.mealRig.add(this.mealLamp); this.lights.add(this.mealLamp);
    this.neoBowl.name = 'neb-neo-protein-bowl'; this.neoBowl.position.set(-5.7, 1.62, 22); this.mealRig.add(this.neoBowl);
    const shell = this.mesh(this.neoBowl, new THREE.CylinderGeometry(.42, .28, .32, 20, 1, true), bowl); shell.position.y = .02;
    const contents = this.cylinder(this.neoBowl, food, 0, .16, 0, .31, .05); contents.scale.z = .92;
    const utensil = this.box(this.neoBowl, spoon, .42, .32, 0, .08, .05, 1.15, 'neb-neo-spoon'); utensil.rotation.y = -.25;
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(this.mealRig, new THREE.TorusGeometry(.14 + i * .04, .012, 6, 18), steam, `neb-meal-steam-${i}`);
      ring.rotation.x = Math.PI / 2; ring.userData.offset = i * .7; this.mealSteam.push(ring);
    }
    const tray = new THREE.Group(); tray.name = 'neb-protein-serving-tray'; tray.position.set(-10.65, 1.5, 22); this.mealRig.add(tray);
    this.box(tray, this.steel, 0, 0, 0, 1.8, .12, 1.55);
    for (let i = 0; i < 3; i++) {
      this.cylinder(tray, bowl, -.48 + i * .48, .17, 0, .18, .17);
      this.cylinder(tray, food, -.48 + i * .48, .28, 0, .12, .035);
    }
  }

  private relayDisplay(journey: FilmJourney): void {
    const light = this.consoleRig.getObjectByName('neb-cypher-console-task-light') as THREE.PointLight;
    light.intensity = 105;
    if (!this.consoleScreen) return;
    const relay = journey.trinityRelay, key = `${journey.scene}:${journey.grid?.vigilant}:${journey.grid?.primary}:${relay?.phase}:${Math.floor((relay?.elapsed ?? 0) * 5)}`;
    if (this.consoleScreen.userData.relayKey === key) return;
    this.consoleScreen.userData.relayKey = key;
    const ctx = (this.consoleScreen.image as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = '#07100e'; ctx.fillRect(0, 0, 960, 720); ctx.font = '26px monospace'; ctx.fillStyle = '#b7ddbd';
    ctx.fillText('NEBUCHADNEZZAR / LINK', 42, 60);
    const rows = [['LOGOS / PRIMARY', journey.grid?.primary === 'off' ? 'OFFLINE' : 'ARMED'],
      ['VIGILANT / CREW', journey.grid?.vigilant === 'lost' ? 'SIGNAL LOST' : 'ONLINE'], ['EMERGENCY GRID', 'POWER REROUTING'],
      ['TRINITY', relay?.phase === 'connected' ? 'CONNECTED' : 'REAL WORLD']];
    rows.forEach(([name, value], row) => {
      ctx.fillStyle = '#68927b'; ctx.font = '24px monospace'; ctx.fillText(name, 42, 145 + row * 114);
      ctx.fillStyle = value === 'SIGNAL LOST' ? '#e08a76' : '#a7dbaf'; ctx.font = '32px monospace'; ctx.fillText(value, 42, 185 + row * 114);
    });
    ctx.fillStyle = '#4f725d'; ctx.font = '22px monospace'; ctx.fillText('SOURCE WINDOW : NOT YET SAFE', 42, 644);
    for (let y = 0; y < 720; y += 5) ctx.fillRect(0, y, 960, 1);
    this.consoleScreen.needsUpdate = true;
  }

  update(journey: FilmJourney | undefined, elapsed: number, recoverySubject?: THREE.Object3D, bodies?: (id: string) => THREE.Object3D | undefined): void {
    const localShadows = Boolean(journey && !journey.visiting && ['m1_recovery', 'm1_cabin', 'm2_vigilant', 'm2_relay'].includes(journey.scene));
    const subject = recoverySubject ? this.root.worldToLocal(recoverySubject.getWorldPosition(new THREE.Vector3())) : undefined;
    const room = journey?.scene === 'm1_recovery' ? 0 : subject ? subject.x > 5.5 && subject.z < -25.5 ? 1 : subject.z < -14 ? 0 : 2 : journey?.step === 0 ? 1 : 2;
    // Treatment lights the bed and helpers; the later escort needs the doorway and central aisle.
    this.roomKeys[0].target.position.x = journey?.scene === 'm1_recovery' ? -7 : -1;
    this.roomKeys.forEach((light, index) => { light.visible = localShadows; light.castShadow = localShadows && index === room; });
    const loss = journey?.scene === 'm2_ship_lost' && !journey.visiting ? journey.shipLoss : undefined;
    this.shipLossRig.visible = Boolean(loss);
    this.sternPlate.visible = !loss;
    this.deckRig.visible = !loss || !['mourning', 'escaped', 'failed'].includes(loss.phase) && !(loss.phase === 'destroying' && (loss.elapsed ?? 0) >= .85);
    this.escapeExterior.update(loss);
    if (loss) {
      this.shipHatch.position.y = nebHatchHeight(loss);
      this.shipRadar.uniforms.age.value = loss.age ?? 32 - loss.remaining;
      this.shipAlarm.intensity = loss.phase === 'briefing' ? 70 : loss.phase === 'failed' ? 30 : 170 + Math.sin((loss.age ?? 32 - loss.remaining) * 14) * 65;
    }
    const recovery = journey?.scene === 'm1_recovery' && !journey.visiting && journey.awakening?.kind === 'recovery' ? journey.awakening : undefined;
    const t = recovery?.elapsed ?? 0; const active = recovery?.started === true;
    this.medicalLever.rotation.y = medicalControlBlend(t) * .8;
    const cabin = journey?.scene === 'm1_cabin' && !journey.visiting ? journey : undefined;
    const waking = cabin?.awakening?.kind === 'cabin' && cabin.step === 0;
    const opened = waking ? THREE.MathUtils.smoothstep(cabin.awakening!.elapsed, 10, 11.6) : 1;
    this.cabinDoor.position.z = CABIN.door.z - opened * 4.7;
    const setup = journey?.scene === 'm1_download' && !journey.visiting ? journey.downloadSetup : undefined;
    const connecting = cabin?.awakening?.kind === 'core' ? cabin.awakening : setup?.phase === 'connecting' ? setup : undefined;
    const downloadedConnection = journey?.scene === 'm1_download' && !journey.visiting && (!setup || setup.phase === 'ready');
    const truth = journey?.scene === 'm1_truth_return' && !journey.visiting ? journey.truthRecovery : undefined;
    const unplugging = truth?.phase === 'unplug' && truth.elapsed < 4 ? truth : undefined;
    this.truthSeat.visible = Boolean(truth && truthRest(truth));
    const relay = journey?.scene === 'm2_relay' && !journey.visiting && ['connecting', 'connected'].includes(journey.trinityRelay?.phase ?? '') ? journey.trinityRelay : undefined;
    const socket = recoverySubject?.getObjectByName('cervical-interface');
    this.corePlug.visible = this.coreCable.visible = Boolean(socket && (relay && relay.elapsed >= 13.4 || connecting && connecting.elapsed >= 2.2 || unplugging || downloadedConnection));
    if (this.corePlug.visible && socket) {
      recoverySubject!.updateWorldMatrix(true, true); this.root.updateWorldMatrix(true, false);
      const point = this.root.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
      point.x += relay ? -(.25 + .7 * (1 - THREE.MathUtils.smoothstep(relay.elapsed, 14.4, 15.8))) : .25 + .7 * (unplugging ? truthUnplug(unplugging.elapsed) : connecting ? 1 - cabinPlugProgress(connecting.elapsed) : 0);
      this.corePlug.position.copy(point);
      const anchor = relay ? new THREE.Vector3(-10, .35, 6.4) : new THREE.Vector3(9.5, .35, -6.4); const direction = point.clone().sub(anchor);
      this.coreCable.position.copy(anchor).add(point).multiplyScalar(.5); this.coreCable.scale.y = direction.length();
      this.coreCable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      const link = relay && bodies?.('link');
      if (link) relayPlugContact(link, this.corePlug.getWorldPosition(new THREE.Vector3()),
        THREE.MathUtils.smoothstep(relay.elapsed, 13.4, 14.4) * (1 - THREE.MathUtils.smoothstep(relay.elapsed, 15.8, 16.5)));
    }
    let skin: THREE.SkinnedMesh | undefined;
    if (recovery) recoverySubject?.traverse(object => { if (object instanceof THREE.SkinnedMesh && object.userData.patientBody) skin = object; });
    if (skin !== this.recoverySkin) { this.recoverySkin = skin; this.skinContacts.clear(); }
    const relayActive = journey && !journey.visiting && ['m2_vigilant', 'm2_relay'].includes(journey.scene);
    const consoleActive = journey?.scene === 'm1_cypher_console' && !journey.visiting || relayActive;
    this.operatorCables.forEach(cable => { cable.visible = !consoleActive; });
    const descend = active ? THREE.MathUtils.smoothstep(t, 1.8, 3.8) * (1 - THREE.MathUtils.smoothstep(t, 7, 8.2)) : 0;
    const retract = active ? THREE.MathUtils.smoothstep(t, 7.5, 9.2) : 0;
    this.gantry.position.y = 6.2 - descend * 1.15 + retract * 6;
    this.gantry.rotation.z = Math.sin(t * 2.1) * .004 * descend;
    this.root.updateWorldMatrix(true, true); recoverySubject?.updateWorldMatrix(true, true); this.gantry.updateWorldMatrix(true, true);
    if (skin && this.skinContacts.size === 0 && t >= 2.1 && t < 7) {
      skin.updateMatrixWorld(true); skin.skeleton.update(); skin.computeBoundingBox(); skin.computeBoundingSphere();
      // Sample the shipped skin once, then retain contacts in bone space as the body moves.
      // Twelve skinned-mesh raycasts every render frame would make this sequence needlessly expensive.
      this.needles.forEach((needle, index) => {
        const bone = recoverySubject!.getObjectByName(needle.bone); if (!bone) return;
        const point = bone.localToWorld(needle.offset.clone());
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, -1, 0), 0, 3);
        const hit = ray.intersectObject(skin!)[0];
        if (hit) this.skinContacts.set(index, bone.worldToLocal(hit.point.add(new THREE.Vector3(0, -.012, 0))));
      });
    }
    this.needles.forEach((needle, i) => {
      const bone = recoverySubject?.getObjectByName(needle.bone);
      const fallback = new THREE.Vector3(RECOVERY_BED.x - this.gantry.position.x + (i % 2 ? .32 : -.32), 1.32 - this.gantry.position.y,
        RECOVERY_BED.z - this.gantry.position.z - 2.1 + Math.floor(i / 4) * 2.1);
      const target = bone ? this.gantry.worldToLocal(bone.localToWorld((this.skinContacts.get(i) ?? needle.offset).clone())) : fallback;
      const insert = active ? THREE.MathUtils.smoothstep(t, 2.1 + i % 4 * .12, 3.25 + i % 4 * .12)
        * (1 - THREE.MathUtils.smoothstep(t, 6.1 + Math.floor(i / 4) * .08, 6.8 + Math.floor(i / 4) * .08)) : 0;
      const anchor = new THREE.Vector3(target.x, needle.anchorY, target.z);
      const tip = anchor.clone().add(new THREE.Vector3(0, -.72, 0)).lerp(target, insert);
      const direction = tip.clone().sub(anchor); const length = direction.length();
      needle.hub.position.set(anchor.x, -.35, anchor.z);
      const railX = anchor.x < 0 ? -2.45 : 2.45;
      needle.support.position.set((railX + anchor.x) / 2, -.08, anchor.z);
      needle.support.scale.x = Math.abs(railX - anchor.x);
      needle.shaft.position.copy(anchor).add(tip).multiplyScalar(.5);
      needle.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); needle.shaft.scale.y = length;
      needle.tip.position.copy(tip); needle.shaft.visible = needle.tip.visible = Boolean(recovery);
    });
    const training = journey?.scene === 'm1_download' && !journey.visiting && journey.training?.kind === 'download' ? journey.training : undefined;
    this.downloadRig.visible = Boolean(training);
    if (training) {
      const disk = downloadDiskPose(training.elapsed); this.downloadDisk.position.set(disk.x, disk.y, disk.z);
      const filled = Math.floor(training.elapsed / 10 * this.downloadBars.length);
      this.downloadBars.forEach((bar, index) => { bar.visible = index < filled || training.started && index === filled && Math.sin(training.elapsed * 10) > 0; });
      const jackLight = this.downloadRig.getObjectByName('neb-training-jack-light') as THREE.PointLight;
      jackLight.intensity = training.started ? 48 + Math.sin(training.elapsed * 17) * 4 : 28;
      this.downloadPulse.color.setHex(training.elapsed > 8.8 ? 0xd8ffd9 : 0x8cf4b8);
      const frame = Math.floor(training.elapsed * 5);
      if (this.downloadScreen && frame !== this.downloadScreenFrame) {
        this.downloadScreenFrame = frame; const ctx = (this.downloadScreen.image as HTMLCanvasElement).getContext('2d')!;
        ctx.fillStyle = '#08110e'; ctx.fillRect(0, 0, 1024, 640); ctx.fillStyle = '#bdddc8'; ctx.font = '28px monospace';
        ctx.fillText('NEBUCHADNEZZAR / OPERATOR', 45, 64); ctx.fillStyle = '#517262'; ctx.fillRect(45, 88, 934, 2);
        ctx.fillStyle = '#d1e8ce'; ctx.font = '44px monospace'; ctx.fillText('COMBAT / JIU JITSU', 45, 172);
        ctx.font = '25px monospace'; ctx.fillStyle = '#8bb89e';
        ctx.fillText(training.elapsed < 2.2 ? 'MEDIA DRIVE : WAITING' : 'NEURAL CHANNEL : ONLINE', 45, 242);
        ctx.fillText(`UPLOAD : ${Math.round(training.elapsed * 10).toString().padStart(3, '0')} %`, 45, 294);
        ctx.strokeStyle = '#648f78'; ctx.lineWidth = 3; ctx.beginPath();
        for (let x = 45; x <= 979; x += 6) { const y = 370 + Math.sin(x * .02 + training.elapsed * 3) * 14 + Math.sin(x * .081) * 5; if (x === 45) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
        ctx.fillStyle = '#243b30'; for (let y = 0; y < 640; y += 5) ctx.fillRect(0, y, 1024, 1);
        this.downloadScreen.needsUpdate = true;
      }
    }
    const consoleBeat = journey?.scene === 'm1_cypher_console' && !journey.visiting && journey.interlude?.kind === 'console' ? journey.interlude : undefined;
    this.consoleRig.visible = Boolean(consoleBeat || relayActive);
    this.consoleRig.getObjectByName('neb-cypher-liquor-bottle')!.visible = !relayActive;
    this.consoleRig.getObjectByName('neb-cypher-shot-glass')!.visible = !relayActive;
    const linkChair = this.root.getObjectByName('neb-core-chair-four')!; linkChair.rotation.y = relayActive ? Math.PI / 2 : -Math.PI / 2;
    const trinityBack = this.root.getObjectByName('neb-core-chair-trinity-backrest')!;
    // A cervical opening lets the operator and wire reach the actual neck, above the lower back support.
    trinityBack.scale.y = relayActive ? .3 : 1; trinityBack.position.y = relayActive ? 1.4 : 2.15;
    trinityBack.position.z = relayActive ? -1.427 : -1.22;
    this.root.getObjectByName('neb-core-chair-trinity-relay-headrest')!.visible = Boolean(relayActive);
    if (relayActive) this.relayDisplay(journey!);
    if (consoleBeat) {
      const t = consoleBeat.elapsed;
      const light = this.consoleRig.getObjectByName('neb-cypher-console-task-light') as THREE.PointLight; light.intensity = 68 + Math.sin(elapsed * 7) * 12;
      const frame = Math.floor(elapsed * 6);
      if (this.consoleScreen && frame !== this.consoleScreenFrame) {
        this.consoleScreenFrame = frame; const ctx = (this.consoleScreen.image as HTMLCanvasElement).getContext('2d')!;
        const redacted = consoleBeat.phase === 'performing' && t < 1.2; const offset = (frame * 7) % 92;
        ctx.fillStyle = '#07110d'; ctx.fillRect(0, 0, 960, 720); ctx.fillStyle = '#84d99b'; ctx.font = '22px monospace';
        ctx.fillText('OPERATOR / PRIVATE BUFFER', 46, 54); ctx.fillStyle = '#315d43'; ctx.fillRect(46, 76, 868, 2);
        ctx.fillStyle = redacted ? '#d9b56d' : '#9de9af'; ctx.font = '28px monospace';
        ctx.fillText(redacted ? 'INPUT MASKED // LOCAL SESSION' : 'CITY FEED // ROUTE RESOLUTION', 46, 126);
        ctx.font = '19px monospace';
        for (let row = 0; row < 18; row++) {
          const value = ((row * 7919 + offset * 37) >>> 0).toString(16).padStart(7, '0');
          const prefix = redacted && row % 4 === 0 ? '████████████' : `NODE-${(row + 4).toString().padStart(2, '0')}  ${value}`;
          ctx.fillStyle = row % 5 === 0 ? '#d8ffc7' : '#6fb782'; ctx.fillText(prefix, 56, 172 + row * 25);
        }
        ctx.fillStyle = '#385e44'; for (let y = 0; y < 720; y += 5) ctx.fillRect(0, y, 960, 1);
        this.consoleScreen.needsUpdate = true;
      }
      const cup = this.consoleRig.getObjectByName('neb-cypher-shot-glass')!;
      const lift = consoleBeat.phase === 'responding' ? Math.sin(Math.min(1, t / 3.8) * Math.PI) : consoleBeat.phase === 'performing' ? Math.sin(THREE.MathUtils.clamp((t - 4.6) / 3, 0, 1) * Math.PI) : 0;
      cup.position.y = 1.63 + lift * 1.15; cup.rotation.z = -lift * .22;
    }
    const meal = journey?.scene === 'm1_meal' && !journey.visiting && journey.interlude?.kind === 'meal' ? journey.interlude : undefined;
    this.mealRig.visible = Boolean(meal);
    if (meal) {
      const t = meal.phase === 'performing' ? meal.elapsed : meal.phase === 'done' ? 13.2 : 0;
      this.mealLamp.intensity = 168 + Math.sin(elapsed * 2.2) * 8;
      const slide = THREE.MathUtils.smoothstep(t, .35, 2.1); this.neoBowl.position.x = THREE.MathUtils.lerp(-5.7, -3.25, slide);
      this.mealSteam.forEach((ring, index) => {
        const cycle = (elapsed * .35 + Number(ring.userData.offset)) % 1;
        ring.position.set(this.neoBowl.position.x, 2.1 + cycle * 1.1, 22); ring.scale.setScalar(.65 + cycle * .8); ring.visible = meal.phase === 'performing' && t < 9;
      });
    } else this.mealLamp.intensity = 0;
    const cut = crosscutActive(journey) ? journey!.tvExit!.crosscut : undefined;
    if (cut) {
      this.betrayalRig.visible = true;
      for (const role of ['neo', 'trinity', 'apoc', 'switch'] as const) {
        const disconnected = role === 'apoc' ? cut.apocDead : role === 'switch' ? cut.switchDead : role === 'trinity' ? cut.trinityOut : cut.neoOut;
        const jack = this.betrayalJacks.get(role)!; jack.visible = !disconnected;
        const body = bodies?.(role), socket = body?.getObjectByName('cervical-interface') ?? body?.getObjectByName('head');
        if (socket && !disconnected) {
          socket.updateWorldMatrix(true, false); this.root.updateWorldMatrix(true, false);
          jack.position.copy(this.root.worldToLocal(socket.getWorldPosition(new THREE.Vector3())));
          jack.quaternion.copy(this.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(socket.getWorldQuaternion(new THREE.Quaternion())));
        }
        if (role === 'apoc' || role === 'switch') this.betrayalLoose.get(role)!.visible = disconnected;
        const signal = this.betrayalSignals.get(role)!;
        (signal.material as THREE.MeshBasicMaterial).color.setHex(disconnected ? 0x4c1815 : 0x75e7a1);
        signal.scale.y = disconnected ? .55 : 1;
      }
      this.betrayalFlash.visible = false;
      this.betrayalAlarm.intensity = ['assault', 'aiming', 'window', 'countering'].includes(cut.phase) ? 68 : 18;
    }
    const betrayal = journey?.scene === 'm1_unplugged' && !journey.visiting && journey.betrayal?.kind === 'unplugged' ? journey.betrayal : undefined;
    if (!cut) this.betrayalRig.visible = Boolean(betrayal);
    if (betrayal && !cut) {
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
    this.escapeExterior.dispose();
    this.downloadScreen?.dispose();
    this.consoleScreen?.dispose();
    this.root.clear();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.roomKeys = []; this.needles = []; this.downloadBars = []; this.operatorCables = [];
    this.betrayalJacks.clear(); this.betrayalLoose.clear(); this.betrayalSignals.clear();
  }
}
