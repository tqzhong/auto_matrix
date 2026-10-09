import * as THREE from 'three';
import { DOCK_BRIEFING, dockBriefingGate, dockBriefingLift, type DockBriefing } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Personnel gate: exposed service pipes, portable work lamps and the three captains' freight lift. */
export class DockBriefingRenderer {
  readonly group = new THREE.Group();
  readonly lift = new THREE.Group();
  readonly gate = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(root: THREE.Group) {
    this.group.name = 'dock-briefing-set'; root.add(this.group); this.group.add(this.static, this.lift);
    const steel = this.surface('metal_plate', 0x59635b, 3), plaster = this.surface('damaged_plaster', 0x64675b, 4);
    const iron = this.material(0x282f2b, .7, .7), rubber = this.material(0x141b18, .95, .05);
    const bolt = this.material(0x929282, .45, .75);
    this.box(plaster, 0, -.2, 0, 22, .4, 38, this.static, 'personnel-floor');
    this.box(plaster, 0, 9.15, -4.4, 22, .3, 28.4);
    for (const [i, wall] of DOCK_BRIEFING.walls.entries()) {
      if (i >= 8) continue; // These are the pipe-bank footprints, drawn as pipes below.
      this.box(wall.height > 10 ? steel : plaster, wall.x, wall.height / 2, wall.z, wall.width, wall.height, wall.depth, this.static, `personnel-wall-${i}`);
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 7; row++) {
        const radius = .16 + row % 3 * .09;
        this.pipe(steel, [side * (9.15 + row % 2 * .36), .7 + row * 1.12, -15], [side * (9.15 + row % 2 * .36), .7 + row * 1.12, 13], radius);
        for (const z of [-12, -4, 4, 12]) {
          const flange = this.mesh(new THREE.TorusGeometry(radius + .06, .045, 6, 14), bolt);
          flange.position.set(side * (9.15 + row % 2 * .36), .7 + row * 1.12, z);
        }
      }
      for (const z of [-14, -5, 4]) {
        this.box(iron, side * 8.5, 8.1, z, .18, 1.6, .35);
        this.pipe(steel, [side * 8.5, 8.4, z], [side * 6.9, 8.4, z], .18);
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = -7.8 + i * 1.7;
      this.pipe(steel, [x, 7.7 + i % 2 * .48, -17], [x, 7.7 + i % 2 * .48, 9.1], .13 + i % 3 * .06);
    }
    const face = new THREE.MeshStandardMaterial({ color: 0xe6d9ba, emissive: 0xffc895, emissiveIntensity: 1.6, roughness: .45 }); this.materials.add(face);
    for (const z of [-10, -2, 6]) {
      const lamp = new THREE.Group(); lamp.name = 'personnel-portable-lamp'; this.static.add(lamp);
      lamp.position.set(8.1, 4.7, z); lamp.rotation.z = -.18;
      this.box(iron, 0, -1.8, 0, .15, 3.6, .15, lamp);
      this.box(rubber, 0, -4.48, 0, 1.2, .3, 1.1, lamp);
      const rim = this.mesh(new THREE.TorusGeometry(.49, .055, 8, 20), bolt, lamp); rim.rotation.y = -Math.PI / 2;
      const bulb = this.mesh(new THREE.SphereGeometry(.4, 12, 10), face, lamp); bulb.scale.set(.25, 1, 1);
      const light = new THREE.PointLight(0xffdbab, 88, 16, 2); light.position.set(-.25, 0, 0); lamp.add(light);
      for (const y of [-.26, 0, .26]) this.box(iron, -.12, y, 0, .035, .035, .95, lamp);
    }
    const fill = new THREE.PointLight(0xbcccb8, 100, 25, 2); fill.position.set(-5, 6.4, 6); this.group.add(fill);
    const cage = DOCK_BRIEFING.lift; this.lift.name = 'personnel-moving-cage'; this.lift.position.set(cage.x, 0, cage.z);
    this.box(steel, 0, -.16, 0, cage.width, .32, cage.depth, this.lift, 'personnel-lift-deck');
    for (const side of [-1, 1]) {
      for (let z = -cage.depth / 2; z <= cage.depth / 2 + .01; z += .4)
        this.box(iron, side * cage.width / 2, cage.height / 2, z, .07, cage.height, .07, this.lift);
      for (const y of [.2, 2, 4.5, cage.height]) this.box(steel, side * cage.width / 2, y, 0, .15, .12, cage.depth, this.lift);
    }
    for (let x = -cage.width / 2; x <= cage.width / 2 + .01; x += .4) this.box(iron, x, cage.height / 2, cage.depth / 2, .07, cage.height, .07, this.lift);
    this.box(steel, 0, cage.height, 0, cage.width, .2, cage.depth, this.lift);
    for (const x of [-2.2, 2.2]) {
      this.box(iron, x, cage.height - .22, .7, .85, .2, .5, this.lift);
      this.box(face, x, cage.height - .34, .7, .65, .06, .32, this.lift);
      const light = new THREE.PointLight(0xffdcac, 72, 12, 2); light.position.set(x, cage.height - .5, .7); this.lift.add(light);
    }
    for (const side of [-1, 1]) this.pipe(iron, [side * 3.8, cage.height, 0], [side * 3.8, 30, 0], .1, this.lift);
    this.gate.name = 'personnel-lift-gate'; this.gate.position.z = -cage.depth / 2; this.lift.add(this.gate);
    for (let x = -cage.width / 2; x <= cage.width / 2 + .01; x += .38) this.box(steel, x, cage.height / 2, 0, .065, cage.height, .15, this.gate);
    for (const y of [.1, 2.1, 4.6, cage.height]) this.box(steel, 0, y, 0, cage.width, .13, .18, this.gate);
    this.box(rubber, 0, 2.7, -.13, 1.5, .7, .08, this.gate, 'personnel-gate-pull');
    for (let z = -17; z < 17; z += 1.1) this.box(steel, 0, .008, z, 5.8, .016, .08);
    for (const y of [1, 2.2, 3.5]) this.pipe(iron, [-7.6, y, -18.32], [-4.4, y, -18.32], .07);
    batchStaticGeometry(this.static, new Set()).forEach(g => this.geometries.add(g));
    this.update({ phase: 'ready', elapsed: 0, escort: 0 });
  }
  private material(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private surface(name: string, color: number, repeat: number): THREE.MeshStandardMaterial {
    const material = this.material(color, name === 'metal_plate' ? .6 : .95, name === 'metal_plate' ? .55 : .03);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    material.normalScale.set(.4, .4); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.static): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.static, name?: string): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); if (name) mesh.name = name; return mesh;
  }
  private pipe(material: THREE.Material, a: [number, number, number], b: [number, number, number], radius: number, parent: THREE.Object3D = this.static): void {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material, parent);
    mesh.position.copy(start).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  update(state?: DockBriefing): void {
    if (!state) return;
    this.lift.position.y = dockBriefingLift(state); this.gate.position.y = dockBriefingGate(state) * (DOCK_BRIEFING.lift.height + .2);
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
