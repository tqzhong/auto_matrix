import * as THREE from 'three';
import type { BaneEncounter } from '@auto_matrix/shared';

/** Props and light cues for the playable lower-deck encounter. The ship shell
 * remains the shared Logos set so the cockpit and exit retain their coordinates. */
export class LogosBaneRenderer {
  readonly root = new THREE.Group();
  private lights: { light: THREE.Light; intensity: number }[] = [];
  private gold = new THREE.Group();
  private goldMaterial = new THREE.MeshBasicMaterial({ color: 0xffc15b, transparent: true, opacity: .85, depthWrite: false, toneMapped: false });
  private hatch: THREE.Group;
  private gun: THREE.Group;
  private gunFlash: THREE.PointLight;
  private cableFlash: THREE.PointLight;
  private fill: THREE.HemisphereLight;
  private deckLights: THREE.PointLight[] = [];
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(private parent: THREE.Group) {
    parent.traverse(object => { if (object instanceof THREE.Light) this.lights.push({ light: object, intensity: object.intensity }); });
    parent.add(this.root);
    this.fill = new THREE.HemisphereLight(0xb7c8c4, 0x1d2525, .72);
    this.fill.name = 'logos-deck-fill'; this.fill.position.set(0, 9, 0); this.root.add(this.fill);
    for (const [z, power] of [[-8, 165], [9, 105]] as const) {
      const light = new THREE.PointLight(0xc8ddd9, power, 25, 2); light.position.set(0, 8.5, z);
      this.root.add(light); this.deckLights.push(light);
    }
    const steel = this.material(0x404d50, .66, .54);
    const dark = this.material(0x11191b, .78, .25);
    const brass = this.material(0x866952, .48, .54);
    const porcelain = this.material(0xd7c7a7, .65);
    for (const z of [-20, -11, -2, 8]) {
      this.box(steel, 0, .12, z, 9, .16, 1.7);
      for (let i = -4; i <= 4; i++) this.box(dark, i, .24, z, .08, .08, 1.5);
      for (const side of [-1, 1]) this.box(brass, side * 5.3, 1.5, z, .13, 3, 3.5);
    }
    // Exposed fuse board, cable, dropped weapon and the hatch over engineering.
    this.box(steel, -9.5, 2.6, 7.5, .36, 4.7, 3.8);
    for (let i = 0; i < 5; i++) {
      this.box(porcelain, -9.22, 1.25 + i * .68, 6.3 + i * .58, .16, .42, .32);
      this.box(brass, -9.1, 1.25 + i * .68, 6.3 + i * .58, .1, .13, .18);
    }
    this.tube([[1, 4.8, -4], [1.4, 2.5, -3], [.6, 1.1, -2.7], [1.2, .4, -2]], .11, dark);
    this.tube([[1.2, .4, -2], [1.7, .3, -1.7]], .07, brass);
    this.gun = new THREE.Group(); this.gun.name = 'bane-electric-gun'; this.root.add(this.gun);
    this.box(dark, 0, 0, 0, .24, .5, .18, this.gun);
    this.box(steel, 0, .22, -.28, .2, .16, .7, this.gun);
    for (const x of [-.08, .08]) this.box(brass, x, .22, -.72, .05, .06, .24, this.gun);
    this.tube([[1.8, .26, -.6], [1.1, .2, 0], [.7, .2, .8]], .045, dark);
    this.tube([[3.2, .2, 3.5], [3.2, .2, -.5]], .09, steel);
    const rim = this.box(brass, -6, .1, 8, 5.2, .16, 5.2);
    rim.name = 'logos-engineering-hatch-rim';
    this.box(dark, -6, .21, 8, 4.7, .1, 4.7);
    this.hatch = new THREE.Group(); this.hatch.position.set(-8.25, .26, 8); this.root.add(this.hatch);
    this.box(steel, 2.25, .08, 0, 4.5, .16, 4.4, this.hatch);
    for (const z of [-1.5, 1.5]) this.box(brass, 2.25, .18, z, 3.4, .07, .09, this.hatch);
    this.tube([[0, .15, -1.8], [0, .15, 1.8]], .035, brass, this.hatch);
    this.hatch.name = 'logos-engineering-hatch';
    this.goldMaterial.side = THREE.DoubleSide; this.materials.push(this.goldMaterial);
    this.gold.name = 'bane-gold-perception'; this.root.add(this.gold);
    const head = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(.43, 10, 7)), this.goldMaterial);
    head.position.y = 3.1; head.scale.z = .83; this.gold.add(head);
    for (const points of [
      [[-.43, 2.65, 0], [-.62, 1.38, 0], [.62, 1.38, 0], [.43, 2.65, 0], [-.43, 2.65, 0]],
      [[-.43, 2.5, 0], [-1.05, 2.22, 0], [-1.12, 1.42, .15]],
      [[.43, 2.5, 0], [1.05, 2.22, 0], [1.12, 1.42, .15]],
      [[-.42, 1.42, 0], [-.48, .56, 0], [-.48, .05, .18]],
      [[.42, 1.42, 0], [.48, .56, 0], [.48, .05, .18]],
    ]) this.tube(points, .045, this.goldMaterial, this.gold);
    this.gunFlash = new THREE.PointLight(0xd8e6f0, 0, 10, 2); this.gunFlash.position.set(2.4, 2.1, -.35); this.root.add(this.gunFlash);
    this.cableFlash = new THREE.PointLight(0xf2d8a4, 0, 10, 2); this.cableFlash.position.set(1.2, 1.3, -2); this.root.add(this.cableFlash);
  }

  update(encounter: BaneEncounter | undefined, step: number, time: number): void {
    const phase = encounter?.phase ?? 'ready';
    const cut = !['ready', 'gun_warning'].includes(phase);
    const dark = ['blind', 'pipe_window', 'counter', 'failed'].includes(phase);
    for (const { light, intensity } of this.lights) light.intensity = intensity * (cut ? dark ? .025 : .09 : phase === 'gun_warning' ? .7 + .25 * Math.sin(time * 29) : 1);
    this.fill.intensity = cut ? dark ? .065 : .17 : phase === 'gun_warning' ? .5 + .2 * Math.sin(time * 29) : .72;
    for (const [index, light] of this.deckLights.entries()) light.intensity = (index ? 105 : 165) * (cut ? dark ? .012 : .07 : phase === 'gun_warning' ? .7 + .25 * Math.sin(time * 29) : 1);
    this.gunFlash.intensity = phase === 'gun_window' ? 75 + Math.sin(time * 44) * 34 : 0;
    this.cableFlash.intensity = phase === 'burning' ? 115 + Math.sin(time * 43) * 55 : 0;
    const held = ['ready', 'gun_warning', 'gun_window'].includes(phase);
    this.gun.visible = !held;
    this.gun.position.set(2.4, .35, -.7); this.gun.rotation.set(Math.PI / 2, 0, 0);
    this.hatch.rotation.z = step >= 3 ? -.96 : 0;
    const focus = phase === 'blind' ? (encounter?.focus ?? 0) / 1.8 : ['pipe_window', 'counter'].includes(phase) ? 1 : 0;
    this.gold.visible = focus > .12;
    this.goldMaterial.opacity = .12 + .8 * focus;
    this.gold.position.set(encounter?.pipeX ?? 2.2, 1, encounter?.pipeZ ?? 0);
    this.gold.rotation.y = Math.sin(time * .8) * .08;
  }

  dispose(): void {
    this.root.removeFromParent(); this.root.clear();
    for (const { light, intensity } of this.lights) light.intensity = intensity;
    for (const material of this.materials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.gunFlash.dispose(); this.cableFlash.dispose(); this.fill.dispose(); this.deckLights.forEach(light => light.dispose());
  }

  private material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.push(material); return material;
  }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.push(geometry); return geometry; }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(w, h, d)), material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  private tube(points: number[][], radius: number, material: THREE.Material, parent = this.root): void {
    const path = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    parent.add(new THREE.Mesh(this.geometry(new THREE.TubeGeometry(path, 16, radius, 6, false)), material));
  }
}
