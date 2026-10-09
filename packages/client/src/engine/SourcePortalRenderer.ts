import * as THREE from 'three';
import { SOURCE_PORTAL, sourcePortalAngle, sourcePortalSourceAngle, type SourcePortalState } from '@auto_matrix/shared';
import { TruckWeaponProps } from '../agents/TruckWeaponPerformance.js';
import { reach } from '../agents/SpoonPerformance.js';
import { HeroModels } from '../agents/HeroModel.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The finished white hallway and the bare stud room are opposite sides of the first door. */
export class SourcePortalRenderer {
  readonly group = new THREE.Group();
  readonly portal = new THREE.Group();
  readonly source = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lamps: THREE.PointLight[] = [];
  private glow: THREE.Mesh;
  private heroes: HeroModels;
  private weapons: TruckWeaponProps[] = [];
  private crowdGroup = new THREE.Group();
  private flashes = new THREE.Group();
  private disposed = false;
  constructor(root: THREE.Group) {
    const portrait = new THREE.Texture(), fabric = new THREE.Texture(); this.textures.add(portrait); this.textures.add(fabric); this.heroes = new HeroModels(portrait, fabric);
    this.group.name = 'source-white-hall-and-stud-room'; root.add(this.group); this.group.add(this.static, this.crowdGroup, this.flashes);
    const white = this.surface('white_plaster_02', 0xd6d9cd, 8), floor = this.surface('marble_01', 0x7b8b7b, 14);
    floor.roughness = .24; floor.metalness = .12;
    const steel = this.surface('metal_plate', 0x687571, 3), dark = this.material(0x25312b, .48, .5), door = this.material(0x7e8b7c, .52);
    const chrome = this.material(0xa5aca2, .25, .82), concrete = this.surface('damaged_plaster', 0x646f67, 5);
    this.box(floor, 0, -.15, 8.5, 9.8, .3, 95, 'finished-hall-floor');
    this.box(concrete, 0, -.15, -47.5, 28, .3, 17, 'unfinished-room-floor');
    this.box(white, 0, -.15, -59, 7.2, .3, 6, 'source-threshold-floor');
    for (const [i, wall] of SOURCE_PORTAL.walls.entries()) this.box(i < 2 || i >= 6 ? white : concrete, wall.x, 4, wall.z, wall.width, 8, wall.depth, `source-wall-${i}`);
    this.box(white, 0, 8, 8.5, 10.2, .25, 95, 'finished-hall-ceiling');
    for (const side of [-1, 1]) {
      this.box(dark, side * 4.85, .22, 8.5, .08, .44, 95);
      for (const z of [-31, -19, -7, 5, 17, 29, 41, 53]) {
        const x = side * 4.86;
        this.box(dark, x, 3.6, z, .12, 7.2, 3.9, `hall-door-frame-${side}-${z}`);
        this.box(door, x - side * .09, 3.6, z, .12, 6.98, 3.55, `hall-door-${side}-${z}`);
        this.box(chrome, x - side * .18, 3.05, z + .92, .14, .16, .55);
      }
    }
    const strip = new THREE.MeshBasicMaterial({ color: 0xe8eadb, toneMapped: false }); this.materials.add(strip);
    for (const x of [-2.8, 2.8]) { this.box(steel, x, 7.85, 8.5, .72, .22, 94); this.box(strip, x, 7.69, 8.5, .48, .05, 94, `long-hall-light-${x}`); }
    for (const z of [-31, -13, 5, 23, 41]) { const light = new THREE.PointLight(0xe2e8cb, 145, 24, 2); light.position.set(0, 6.8, z); this.group.add(light); this.lamps.push(light); }
    for (const x of [-8.7, 8.7]) this.box(concrete, x, 4, -39, 10.6, 8, .6, 'portal-partition');
    for (const side of [-1, 1]) this.box(dark, side * 3.49, 3.94, -39, .18, 7.9, .55);
    this.box(dark, 0, 7.85, -39, 7.1, .18, .55);
    this.makeDoor(this.portal, SOURCE_PORTAL.door, dark, chrome, 'escape-door');
    // Galvanized channels remain exposed beyond the finished door: no white-hall dressing here.
    for (const x of [-12, -8, -4, 4, 8, 12]) for (const z of [-48.4, -55.3]) {
      this.box(steel, x, 4, z, .13, 8, .2, 'bare-wall-stud');
      this.box(steel, x + .13, 4, z, .14, 8, .06);
    }
    for (const z of [-48.4, -55.3]) for (const y of [.13, 7.85]) this.box(steel, 0, y, z, 27, .18, .2);
    for (const x of [-11, -5, 5, 11]) this.box(steel, x, 7.9, -47.5, .15, .2, 17);
    const roomLight = new THREE.PointLight(0xd7e3d2, 240, 26, 2); roomLight.position.set(0, 6.5, -45); this.group.add(roomLight); this.lamps.push(roomLight);
    this.makeDoor(this.source, SOURCE_PORTAL.source, this.material(0xd4d8c9, .45), chrome, 'source-white-door');
    this.box(dark, -10, 3.9, -54.5, 5.6, 7.8, .4, 'return-door-frame');
    this.box(door, -10, 3.85, -54.25, 5.3, 7.7, .22, 'morpheus-return-door');
    this.box(chrome, -8.4, 3.05, -54.08, .3, .16, .15);
    this.glow = this.box(strip, 0, 3.85, -54.65, 5.35, 7.7, .015, 'source-light'); this.glow.visible = false;
    this.crowdGroup.name = 'smith-volley-line';
    for (const z of [-30, -25, -20]) for (const x of [-2.5, -1, 1, 2.5]) {
      this.heroes.create('smith').then(rig => {
        if (!rig || this.disposed) return;
        rig.root.position.set(x, 0, z); rig.root.rotation.y = Math.PI; this.crowdGroup.add(rig.root);
        const b = rig.bones, rotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
        for (const side of ['R', 'L'] as const) {
          const wrist = b.get(`wrist_${side}`)!, elbow = b.get(`elbow_${side}`)!;
          const target = rig.root.localToWorld(new THREE.Vector3(side === 'R' ? -.55 : -.35, 3.15, side === 'R' ? 1.2 : 1.35));
          const offset = new THREE.Vector3(0, -.19, .035).applyQuaternion(rotation);
          reach(b.get(`shoulder_${side}`)!, elbow, wrist.position, target.sub(offset), new THREE.Vector3(side === 'R' ? -1 : 1, -.5, .2).applyQuaternion(rotation));
          wrist.quaternion.copy(elbow.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
          for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) b.get(`finger${f}-${j}_${side}`)!.rotation.z = (side === 'R' ? 1 : -1) * (f === 1 ? .2 : .6);
        }
        const weapon = new TruckWeaponProps(b.get('wrist_R')!); this.weapons.push(weapon);
        weapon.gun.visible = true; weapon.gun.name = 'smith-volley-pistol'; weapon.gun.position.set(0, -.19, .035); weapon.gun.scale.setScalar(1.12);
        weapon.sword.visible = false; weapon.flash.visible = false; weapon.flash.position.copy(weapon.gun.position).add(new THREE.Vector3(0, .185 * 1.12, .62 * 1.12)); rig.root.updateMatrixWorld(true);
      });
      const flash = this.box(new THREE.MeshBasicMaterial({ color: 0xffd397, toneMapped: false }), x, 3.25, z - 1.4, .14, .14, 2, 'smith-shot-streak');
      flash.removeFromParent(); this.flashes.add(flash);
    }
    batchStaticGeometry(this.static, new Set()).forEach(g => this.geometries.add(g)); this.update();
  }
  private material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(m); return m; }
  private surface(name: string, color: number, repeat: number): THREE.MeshStandardMaterial {
    const m = this.material(color, .75); if (typeof document === 'undefined') return m;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.add(texture); m[slot] = texture;
    }
    m.normalScale.set(.22, .22); return m;
  }
  private box(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name = ''): THREE.Mesh {
    this.materials.add(m); const g = new THREE.BoxGeometry(w, h, d); this.geometries.add(g);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.name = name; mesh.receiveShadow = true; this.static.add(mesh); return mesh;
  }
  private makeDoor(group: THREE.Group, p: { x: number; z: number; width: number; height: number }, m: THREE.Material, chrome: THREE.Material, name: string): void {
    group.name = name; group.position.set(p.x - p.width / 2, 0, p.z); this.group.add(group);
    const leaf = this.box(m, p.width / 2, p.height / 2, 0, p.width, p.height, .28, `${name}-leaf`); leaf.removeFromParent(); group.add(leaf);
    const handle = this.box(chrome, p.width - 1.75, 3.05, .18, .4, .16, .18, `${name}-handle`); handle.removeFromParent(); group.add(handle);
    for (const y of [1.2, 3.8, 6.7]) { const hinge = this.box(chrome, .03, y, .18, .1, .26, .14); hinge.removeFromParent(); group.add(hinge); }
  }
  update(state?: SourcePortalState): void {
    this.portal.rotation.y = sourcePortalAngle(state);
    const p = state?.performance;
    this.source.rotation.y = sourcePortalSourceAngle(state);
    this.glow.visible = p?.phase === 'entering' && p.elapsed < 2.65;
    this.crowdGroup.visible = Boolean(p && ['opening', 'cover', 'escaping', 'sealing', 'failed'].includes(p.phase));
    this.flashes.visible = p?.phase === 'escaping' && p.elapsed >= .65 && p.elapsed < 1.55 && Math.floor(p.elapsed * 18) % 3 !== 0;
    this.weapons.forEach(w => { w.flash.visible = this.flashes.visible; });
  }
  dispose(): void { this.disposed = true; this.weapons.forEach(w => w.dispose()); this.group.removeFromParent(); this.heroes.dispose(); this.lamps.forEach(l => l.dispose()); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); }
}
