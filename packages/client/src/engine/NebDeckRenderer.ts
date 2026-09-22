import * as THREE from 'three';
import { RECOVERY_BED, type FilmJourney } from '@auto_matrix/shared';

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
  private needles: THREE.Mesh[] = [];

  constructor(private root: THREE.Group) {
    this.hull();
    this.medicalBay();
    this.operatorCore();
    this.mess();
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
    const back = this.box(chair, this.leather, 0, 2.15, 1.22, 2.35, 2.2, .32); back.rotation.x = -.28;
    for (const side of [-1, 1]) {
      this.box(chair, this.dark, side * 1.3, 1.35, .1, .22, 1.7, 2.7);
      this.pipe([new THREE.Vector3(x + side * 1.05, 2.9, z + .8), new THREE.Vector3(x + side * 1.2, 5, z + 1.8), new THREE.Vector3(x + side * 2, 7, z + 2.4)], .07, this.rubber);
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
    for (let i = 0; i < 12; i++) {
      const x = -1.5 + i % 4; const z = -2.1 + Math.floor(i / 4) * 2.1;
      const needle = this.cylinder(this.gantry, i % 3 ? this.steel : this.amber, x, -1.65, z, .028, 2.7, `neb-medical-needle-${i}`);
      needle.userData.baseY = needle.position.y; this.needles.push(needle);
      this.cylinder(this.gantry, this.rubber, x, -.35, z, .11, .4);
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
  }

  update(journey: FilmJourney | undefined, elapsed: number): void {
    const recovery = journey?.scene === 'm1_recovery' && !journey.visiting && journey.awakening?.kind === 'recovery' ? journey.awakening : undefined;
    const t = recovery?.elapsed ?? 0; const active = recovery?.started === true;
    const descend = active ? THREE.MathUtils.smoothstep(t, 1.8, 3.8) * (1 - THREE.MathUtils.smoothstep(t, 7, 8.2)) : 0;
    this.gantry.position.y = 6.2 - descend * 1.15;
    this.gantry.rotation.z = Math.sin(elapsed * 2.1) * .004 * descend;
    this.needles.forEach((needle, i) => {
      needle.position.y = Number(needle.userData.baseY) - descend * (.18 + (i % 3) * .07);
      needle.visible = Boolean(recovery);
    });
  }

  dispose(): void {
    this.root.clear();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
    this.geometries.clear(); this.materials.clear(); this.lights.clear(); this.needles = [];
  }
}
