import * as THREE from 'three';
import { RELOADED_FINALE, type FilmJourney } from '@auto_matrix/shared';

/** Scene props for the lost ship's tunnel pursuit and Hammer's adjacent medical beds. */
export class ReloadedFinaleRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights = new Set<THREE.Light>();
  private sentinels: THREE.Group[] = [];
  private cores: THREE.MeshBasicMaterial[] = [];
  private wreck?: THREE.PointLight;
  private rescue?: THREE.SpotLight;
  private rescueRig?: THREE.Group;
  private monitors: THREE.Group[] = [];

  constructor(root: THREE.Group, private scene: 'm2_stop_sentinels' | 'm2_medical') {
    this.group.name = `reloaded-finale-${scene}`; root.add(this.group);
    if (scene === 'm2_stop_sentinels') this.tunnel(); else this.medical();
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, name: string): void {
    this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, radius, 6), material, name);
  }
  private tunnel(): void {
    const iron = this.material(new THREE.MeshStandardMaterial({ color: 0x263c3e, roughness: .45, metalness: .72 }));
    const edge = this.material(new THREE.MeshStandardMaterial({ color: 0x71817d, roughness: .64, metalness: .52 }));
    const amber = this.material(new THREE.MeshBasicMaterial({ color: 0xff9b62, toneMapped: false }));
    const pale = this.material(new THREE.MeshBasicMaterial({ color: 0xd2e6ea, toneMapped: false }));
    for (let z = -47; z <= 55; z += 9) {
      this.box(this.group, iron, -12, .2, z, 4.2, .35, 8.8, 'tunnel-drain-left');
      this.box(this.group, iron, 12, .2, z, 4.2, .35, 8.8, 'tunnel-drain-right');
      for (const side of [-1, 1]) {
        this.tube(this.group, [new THREE.Vector3(side * 24, .4, z), new THREE.Vector3(side * 20, 8, z), new THREE.Vector3(side * 12, 15, z), new THREE.Vector3(0, 18, z)], .22, edge, 'tunnel-arch-rib');
        this.box(this.group, amber, side * 18, 5.8, z, .2, 1.15, .36, 'tunnel-emergency-light');
      }
    }
    // The old ship remains visible behind the runner, so its destruction has a location.
    this.box(this.group, iron, 0, 5, 58, 24, 9, 20, 'neb-burning-hull');
    for (let i = 0; i < 9; i++) {
      const shard = this.box(this.group, edge, -10 + i * 2.5, 6 + i % 3, 44 + i % 4 * 3, .45, 7 + i % 4, 1, 'neb-hull-debris'); shard.rotation.z = -.25 + i * .08;
      this.box(this.group, amber, -11 + i * 2.8, 2.5 + i % 3, 48 + i % 4, 1.3, .35, 1.2, 'neb-hull-embers');
    }
    this.wreck = new THREE.PointLight(0xff7b38, 300, 70, 2); this.wreck.position.set(0, 8, 48); this.group.add(this.wreck); this.lights.add(this.wreck);
    for (let index = 0; index < 3; index++) {
      const unit = new THREE.Group(); unit.name = `real-sentinel-${index + 1}`; unit.position.set((index - 1) * 5, 5.7 + index * .4, 21 + index * 7); this.group.add(unit); this.sentinels.push(unit);
      const shell = this.mesh(unit, new THREE.SphereGeometry(1.55, 16, 12), iron, 'sentinel-head'); shell.scale.z = 1.35;
      const core = this.material(new THREE.MeshBasicMaterial({ color: 0xf06554, toneMapped: false })); this.cores.push(core);
      this.mesh(unit, new THREE.SphereGeometry(.67, 12, 8), core, 'sentinel-eye').position.z = -1.45;
      for (let arm = 0; arm < 8; arm++) {
        const angle = arm * Math.PI * 2 / 8;
        this.tube(unit, [new THREE.Vector3(Math.sin(angle) * .8, 0, .4), new THREE.Vector3(Math.sin(angle) * 2.2, Math.cos(angle) * 1.4, 3.3), new THREE.Vector3(Math.sin(angle) * 2.8, Math.cos(angle) * 2.1, 6.8)], .09, edge, 'sentinel-tentacle');
      }
      const lamp = new THREE.PointLight(0xf16b5d, 42, 10, 2); lamp.position.set(0, 0, -1.6); unit.add(lamp); this.lights.add(lamp);
    }
    this.rescueRig = new THREE.Group(); this.rescueRig.name = 'hammer-rescue-arrival'; this.rescueRig.visible = false; this.group.add(this.rescueRig);
    const hammer = this.box(this.rescueRig, iron, 0, 5.8, -62, 24, 11, 11, 'hammer-rescue-nose'); hammer.rotation.x = -.05;
    for (const x of [-7, 7]) this.box(this.rescueRig, pale, x, 5.5, -56.35, 4.8, 1.8, .12, 'hammer-searchlight-lens');
    this.rescue = new THREE.SpotLight(0xd8eff5, 0, 105, Math.PI / 7, .55, 1.5); this.rescue.name = 'hammer-rescue-beam'; this.rescue.position.set(0, 7, -56); this.rescue.target.position.set(0, 1, -15);
    this.rescueRig.add(this.rescue, this.rescue.target); this.lights.add(this.rescue);
  }
  private medical(): void {
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x2b3b40, metalness: .66, roughness: .4 }));
    const rail = this.material(new THREE.MeshStandardMaterial({ color: 0x87989a, metalness: .8, roughness: .3 }));
    const sheet = this.material(new THREE.MeshStandardMaterial({ color: 0xc3c8bb, roughness: .95 }));
    const screen = this.material(new THREE.MeshBasicMaterial({ color: 0x85c6d5, toneMapped: false }));
    for (const [index, x] of [-10, 10].entries()) {
      const bed = new THREE.Group(); bed.name = index === 0 ? 'hammer-medical-neo' : 'hammer-medical-bane'; bed.position.set(x, 0, -25); this.group.add(bed);
      this.box(bed, dark, 0, 1.4, 0, 5.2, 1.4, 8, 'medical-gurney-frame');
      this.box(bed, sheet, 0, 2.17, 0, 4.4, .18, 7.6, 'medical-mattress');
      this.box(bed, sheet, 0, 2.37, -2.8, 3.6, .22, 1.4, 'medical-pillow');
      for (const side of [-1, 1]) this.box(bed, rail, side * 2.56, 2.35, 0, .15, .55, 7.3, 'medical-bed-rail');
      this.box(bed, dark, 3.3, 4.8, -1, 3.4, 2.5, .32, 'medical-telemetry-case');
      const face = this.box(bed, screen, 3.3, 4.8, -.81, 2.95, 2.03, .04, 'medical-telemetry-screen'); face.material = screen;
      for (let line = 0; line < 7; line++) this.box(bed, dark, 2.1 + line * .38, 4.55 + Math.sin(line * 1.8) * .28, -.76, .25, .06, .025, 'medical-ecg-trace');
      const lamp = new THREE.PointLight(index ? 0xb5cdda : 0xd9e9dc, 165, 18, 2); lamp.position.set(0, 8, -1); bed.add(lamp); this.lights.add(lamp);
      this.monitors.push(bed);
    }
    for (const x of [-17, 17]) {
      const curtain = this.box(this.group, this.material(new THREE.MeshPhysicalMaterial({ color: 0x8babb1, transparent: true, opacity: .18, roughness: .62, depthWrite: false, side: THREE.DoubleSide })), x, 5, -25, .07, 8, 15, 'medical-curtain'); curtain.castShadow = false;
    }
  }
  update(journey: FilmJourney | undefined, elapsed: number): void {
    if (this.scene === 'm2_stop_sentinels') {
      const tunnel = journey?.scene === this.scene && !journey.visiting ? journey.tunnel : undefined;
      if (!tunnel) return;
      const approach = tunnel.phase === 'running' ? 0 : 1 - tunnel.remaining / RELOADED_FINALE.sentinelSeconds;
      this.sentinels.forEach((unit, index) => {
        unit.position.z = 20 + index * 7 - Math.max(0, approach) * 30;
        unit.position.y = 6 + Math.sin(elapsed * 4 + index) * .45;
        const disabled = tunnel.phase === 'collapsed' || tunnel.focus >= RELOADED_FINALE.signalSeconds * (index + 1) / 3;
        unit.rotation.z = disabled ? .9 : Math.sin(elapsed * 2 + index) * .07;
        this.cores[index].color.setHex(disabled ? 0x283b3b : 0xf06554);
      });
      if (this.wreck) this.wreck.intensity = 220 + Math.sin(elapsed * 5) * 65;
      if (this.rescueRig) this.rescueRig.visible = tunnel.phase === 'collapsed';
      if (this.rescue) this.rescue.intensity = tunnel.phase === 'collapsed' ? 450 : 0;
    } else this.monitors.forEach((monitor, index) => { monitor.children.find(child => child instanceof THREE.PointLight)!.intensity = 125 + Math.sin(elapsed * (index ? 2.3 : 3.8)) * 25; });
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.lights.forEach(light => light.dispose());
  }
}
