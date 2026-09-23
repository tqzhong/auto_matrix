import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BANE_LOFT_OBSTACLES, type FilmJourney, type Vector3 } from '@auto_matrix/shared';

/** The industrial exit loft is separate from Seraph's white back-door corridor. */
export class BaneCopyRenderer {
  readonly group = new THREE.Group();
  private static = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private copy = new THREE.Group();
  private letter: THREE.Group;
  private phoneLight: THREE.PointLight;
  private disposed = false;
  constructor(root: THREE.Group) {
    this.group.name = 'bane-industrial-loft'; root.add(this.group); this.group.add(this.static);
    const concrete = this.surface('damaged_plaster', 0x777975, 5);
    const floor = this.surface('old_wood_floor', 0x555852, 8);
    const iron = this.surface('metal_plate', 0x56605c, 4);
    const dark = this.material(0x1c2729, .64, .46), wood = this.surface('old_wood_floor', 0x6e5845, 2);
    const glass = this.material(0x9cbdc0, .16, .12, .48);
    const signal = this.material(0xa9d9b9, .24, .13, .95);
    const night = this.material(0x142633, .68, .18, .58);
    concrete.emissive.setHex(0x4c504a); concrete.emissiveIntensity = .72;
    floor.emissive.setHex(0x30362e); floor.emissiveIntensity = .65;
    iron.emissive.setHex(0x293734); iron.emissiveIntensity = .65;
    wood.emissive.setHex(0x3c3026); wood.emissiveIntensity = .5;
    signal.emissive.setHex(0x5d9d78); signal.emissiveIntensity = .7;
    night.emissive.setHex(0x1d3038); night.emissiveIntensity = .45;
    this.box(floor, 0, -.48, 0, 52, .96, 78);
    this.box(concrete, 0, 11, -39, 52, 22, 1.2);
    this.box(concrete, 0, 11, 39, 52, 22, 1.2);
    for (const x of [-22, -11, 0, 11, 22]) this.box(iron, x, 11, -38.25, .55, 22, .55);
    for (const y of [3.2, 10.8, 20]) this.box(iron, 0, y, -38.2, 50, .45, .52);
    const window = this.material(0x73979a, .25, .12);
    window.emissive.setHex(0x395a5a); window.emissiveIntensity = .85;
    for (const x of [-16.5, -5.5, 5.5, 16.5]) {
      this.box(window, x, 15.2, -38.08, 6.5, 5.8, .16);
      this.box(iron, x, 15.2, -37.95, .14, 5.9, .18);
      this.box(iron, x, 15.2, -37.95, 6.6, .14, .18);
    }
    for (const x of [-19, -13, -7, -1, 5, 11, 17, 23]) this.box(iron, x, .025, 0, .065, .05, 77);
    for (const side of [-1, 1]) {
      this.box(concrete, side * 26, 12, 0, 1, 24, 78);
      for (const z of [-28, -7, 14, 35]) {
        this.box(dark, side * 25.35, 15, z, .3, 10, 6.4);
        this.box(night, side * 25.17, 15, z, .1, 8.8, 5.5);
        this.box(iron, side * 25.1, 15, z, .15, .2, 6);
        this.pipe(iron, [side * 25.05, 10, z], [side * 25.05, 20, z], .1);
      }
    }
    for (const beam of BANE_LOFT_OBSTACLES.slice(1)) {
      this.box(iron, beam.x, beam.height / 2, beam.z, beam.width, beam.height, beam.depth);
      this.box(dark, beam.x, beam.height / 2, beam.z, beam.width + .55, .32, beam.depth + .55);
      this.box(dark, beam.x, beam.height - .16, beam.z, beam.width + .55, .32, beam.depth + .55);
    }
    for (let z = -33; z <= 34; z += 11) {
      this.pipe(iron, [-24, 21, z], [24, 21, z], .35);
      this.pipe(dark, [-24, 21, z], [-17, 10, z], .16);
      this.pipe(dark, [24, 21, z], [17, 10, z], .16);
    }
    // Smith appears under a smashed rooflight; fallen shards point back to the intrusion.
    this.box(iron, 0, 22.5, -22, 17, .55, .55);
    this.box(iron, 0, 22.5, -34, 17, .55, .55);
    for (const x of [-8.4, 8.4]) this.box(iron, x, 22.5, -28, .55, .55, 12);
    this.box(night, 0, 22.8, -28, 16, .12, 11);
    for (let i = 0; i < 23; i++) {
      const x = Math.sin(i * 7.3) * 7.5, z = -28 + Math.cos(i * 3.7) * 5;
      const shard = this.mesh(new THREE.ConeGeometry(.25 + i % 4 * .15, 1.1 + i % 5 * .35, 3), glass);
      shard.position.set(x, i % 3 ? .35 : 21.9 - i % 4 * .5, z); shard.rotation.set(i * .65, i * 1.7, i * .34);
    }
    for (const z of [-34, 2, 30]) {
      this.box(dark, 0, 22, z, 50, .38, .4);
      for (const x of [-14, 14]) this.box(signal, x, 21.65, z, 5, .09, .4);
    }
    // The table and telephone footprint match the shared collision data.
    this.box(wood, 4, 2.38, -29, 4.2, .24, 3);
    for (const x of [2.3, 5.7]) for (const z of [-30.1, -27.9]) this.box(dark, x, 1.14, z, .22, 2.28, .22);
    this.box(dark, 4, 2.67, -29, 1.65, .38, 1.05, 'bane-exit-phone');
    this.mesh(new THREE.CylinderGeometry(.45, .45, .07, 18), iron).position.set(4, 2.9, -28.85);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * .2; this.mesh(new THREE.CylinderGeometry(.055, .055, .025, 7), glass)
        .position.set(4 + Math.cos(a) * .3, 2.95, -28.85 + Math.sin(a) * .3);
    }
    const handset = this.box(dark, 4, 3.05, -29.48, 1.45, .18, .24, 'bane-phone-handset');
    handset.rotation.z = -.08;
    const cord = new THREE.CatmullRomCurve3([[3.55, 2.82, -29.45], [2.65, 2.56, -29.7], [3.17, 2.31, -29.98], [3.76, 2.62, -29.5]].map(p => new THREE.Vector3(...p)));
    this.mesh(new THREE.TubeGeometry(cord, 38, .035, 6, false), dark);
    this.letter = new THREE.Group(); this.letter.name = 'oracle-disk-carrier'; this.group.add(this.letter);
    this.box(wood, -4, 1.35, -28, 1.2, .12, 1, undefined, this.letter);
    this.box(signal, -4, 1.46, -28, .55, .025, .55, undefined, this.letter);
    this.copy.name = 'smith-copy-wave'; this.copy.position.set(0, 0, -23); this.group.add(this.copy);
    const liquid = this.material(0x060e10, .11, .86, .78);
    const torso = this.mesh(new THREE.SphereGeometry(.72, 24, 18), liquid, this.copy);
    torso.position.y = 2.15; torso.scale.set(1, 1.45, .75);
    const head = this.mesh(new THREE.SphereGeometry(.47, 20, 16), liquid, this.copy); head.position.y = 3.55;
    for (let i = 0; i < 11; i++) {
      const angle = i / 11 * Math.PI * 2;
      const strand = this.mesh(new THREE.TorusGeometry(.68 + i % 3 * .06, .045, 5, 32), liquid, this.copy);
      strand.position.y = 1.08 + i * .25; strand.rotation.set(Math.PI / 2 + Math.sin(angle) * .18, angle * .08, Math.cos(angle) * .16);
    }
    this.phoneLight = new THREE.PointLight(0xa4deb4, 28, 8); this.phoneLight.position.set(4, 3.8, -29); this.group.add(this.phoneLight); this.lights.add(this.phoneLight);
    this.light(0xc2d9d7, 500, 62, -8, 22, -29);
    this.light(0x779f9a, 320, 64, 15, 15, 18);
    this.light(0xdfb689, 110, 25, 1, 8, -35);
    const ambient = new THREE.HemisphereLight(0xbacdc4, 0x58655c, 2.4);
    this.group.add(ambient); this.lights.add(ambient);
    this.batch();
    this.update(undefined, 0);
  }
  private material(color: number, roughness: number, metalness: number, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }
  private surface(name: string, color: number, repeat: number): THREE.MeshStandardMaterial {
    const material = this.material(color, name === 'metal_plate' ? .56 : .9, name === 'metal_plate' ? .65 : .04);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${name}-${suffix}.jpg`, loaded => { if (this.disposed) loaded.dispose(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat);
      if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      material[slot] = texture; this.textures.add(texture);
    }
    return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.static): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); this.geometries.add(geometry); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string, parent?: THREE.Object3D): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z);
    if (name) mesh.name = name; return mesh;
  }
  private pipe(material: THREE.Material, from: [number, number, number], to: [number, number, number], radius: number): void {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 9), material);
    mesh.position.copy(a).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  private light(color: number, power: number, distance: number, x: number, y: number, z: number): void {
    const light = new THREE.PointLight(color, power, distance, 2); light.position.set(x, y, z); this.group.add(light); this.lights.add(light);
  }
  private batch(): void {
    this.group.updateMatrixWorld(true); const inverse = this.static.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(), remove: THREE.Mesh[] = [];
    this.static.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object.name) return;
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const flattened = geometry.index ? geometry.toNonIndexed() : geometry; if (flattened !== geometry) geometry.dispose();
      for (const key of Object.keys(flattened.attributes)) if (!['position', 'normal', 'uv'].includes(key)) flattened.deleteAttribute(key);
      (batches.get(object.material) ?? (batches.set(object.material, []), batches.get(object.material)!)).push(flattened); remove.push(object);
    });
    for (const object of remove) object.removeFromParent();
    for (const [material, shapes] of batches) {
      const merged = mergeGeometries(shapes); shapes.forEach(shape => shape.dispose());
      if (merged) this.mesh(merged, material, this.static);
    }
    const live = new Set<THREE.BufferGeometry>(); this.group.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }
  update(journey: FilmJourney | undefined, elapsed: number, actor?: Vector3, origin?: Vector3): void {
    const step = journey?.scene === 'm2_bane_copy' ? journey.step : 0;
    this.letter.visible = step < 2;
    const progress = journey?.baneCopy?.progress ?? 0;
    this.copy.visible = step === 2 && progress > .01;
    this.copy.scale.set(1 + progress * .3, Math.max(.01, progress), 1 + progress * .3);
    if (actor && origin) this.copy.position.set(actor.x - origin.x, 1 + (1 - progress) * 1.25, actor.z - origin.z);
    else this.copy.position.y = 1 + (1 - progress) * 1.25;
    this.copy.rotation.y = elapsed * .8;
    this.phoneLight.intensity = step >= 3 ? 5 : 18 + Math.sin(elapsed * 7) * 10;
  }
  dispose(): void {
    this.disposed = true; this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(item => item.dispose()); this.materials.forEach(item => item.dispose());
    this.textures.forEach(item => item.dispose()); this.lights.forEach(item => item.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
