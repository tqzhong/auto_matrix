import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLUB_DANCERS, CLUB_OBSTACLES } from '@auto_matrix/shared';

/** A navigable, vaulted underground room. The principal encounter stays clear of the dance floor. */
export class ClubSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private dancers: { root: THREE.Group; bones: Map<string, THREE.Bone>; pelvis: THREE.Vector3 }[] = [];
  private spots: THREE.SpotLight[] = [];
  private disposed = false;
  readonly ready: Promise<void>;

  constructor(parent: THREE.Group) {
    this.root.name = 'white-rabbit-club'; parent.add(this.root);
    const wall = this.mat(0x737766, .91, 0, 'damaged_plaster', 3);
    const stone = this.mat(0x4f554c, .72, .03, 'marble_01', 6);
    const metal = this.mat(0x333b34, .5, .6, 'metal_plate', 1);
    const dark = this.mat(0x141a18, .84); const bronze = this.mat(0x797458, .4, .7);
    const wood = this.mat(0x37372d, .72, 0, 'old_wood_floor', 2);
    const recess = this.mat(0x383f37, .92); const paper = this.mat(0xaaa88b, .97);
    const glow = new THREE.MeshBasicMaterial({ color: 0xcdd4b4, toneMapped: false }); this.materials.add(glow);
    this.box(stone, 0, -.18, 0, 42, .35, 56);
    this.box(wall, 0, 5.5, -28, 42, 11, .4);
    for (const x of [-21, 21]) this.box(wall, x, 5.5, 0, .4, 11, 56);
    for (const x of [-12.2, 12.2]) this.box(wall, x, 5.5, 28, 17.6, 11, .4);
    this.box(wall, 0, 9.1, 28, 7, 3.8, .4); this.box(dark, 0, 11.1, 0, 42, .4, 56);
    this.box(dark, 0, 3.5, 29, 6.8, 7, .3);
    // Recessed arches break the plaster wall into the same readable bays seen behind the conversation.
    for (const x of [-14, -7, 0, 7, 14]) {
      this.box(recess, x, 3.1, -27.7, 6.2, 6.2, .08);
      const arch = this.mesh(new THREE.TorusGeometry(3.2, .22, 8, 36, Math.PI), wall, x, 5.3, -27.4);
      arch.name = `club-arch-${x}`;
      for (const side of [-1, 1]) this.box(wall, x + side * 3.2, 2.65, -27.4, .44, 5.3, .5);
      this.box(metal, x, 4, -27.5, 5.7, .12, .14);
      for (const y of [1.1, 2.1, 3.1]) this.box(dark, x, y, -27.35, 5.9, .05, .04);
    }
    // Iron columns, bolted bases and overhead pipework share the collision footprints.
    for (const column of CLUB_OBSTACLES.filter(o => o.height === 11)) {
      this.box(metal, column.x, 5.5, column.z, .58, 11, .58);
      for (const y of [.12, 10.7]) this.box(metal, column.x, y, column.z, 1.3, .24, 1.3);
      for (const dx of [-.45, .45]) for (const dz of [-.45, .45]) this.cylinder(bronze, column.x + dx, .29, column.z + dz, .07, .12);
    }
    for (const z of [-18, 0, 18]) this.box(metal, 0, 10.5, z, 41.5, .6, .38);
    for (const x of [-18.6, -17.9, 19]) {
      const pipe = this.cylinder(metal, x, 9.8, 0, .12, 55); pipe.rotation.x = Math.PI / 2;
      for (let z = -25; z <= 25; z += 5) this.mesh(new THREE.TorusGeometry(.16, .035, 6, 12), bronze, x, 9.8, z);
    }
    // Bar, foot rail, back shelves, bottles and glasses are real geometry rather than a backdrop.
    const bar = CLUB_OBSTACLES[0];
    this.box(wood, bar.x, 1.25, bar.z, bar.width, 2.5, bar.depth);
    this.box(metal, bar.x, 2.6, bar.z, 3.5, .16, 21.3);
    const rail = this.cylinder(bronze, 15.8, .62, -8, .045, 20.5); rail.rotation.x = Math.PI / 2;
    for (let z = -17; z <= 1; z += 3) this.box(bronze, 17.8, 1.3, z, 3.23, 2.2, .045);
    for (const y of [3.2, 5.1, 7]) this.box(wood, 20.1, y, -9, 1.4, .14, 20);
    const bottleMaterial = this.mat(0x53684b, .22, .22); const amber = this.mat(0x87714b, .27, .25);
    for (let i = 0; i < 42; i++) {
      const y = 3.27 + Math.floor(i / 14) * 1.9; const z = -18 + i % 14 * 1.35; const mat = i % 3 ? bottleMaterial : amber;
      this.cylinder(mat, 19.9, y + .38, z, .16, .75); this.cylinder(mat, 19.9, y + .87, z, .065, .25);
      this.box(paper, 19.72, y + .39, z, .012, .3, .23);
    }
    for (const table of CLUB_OBSTACLES.filter(o => o.height === 2.3)) {
      this.cylinder(wood, table.x, 2.22, table.z, 1.8, .16); this.cylinder(metal, table.x, 1.13, table.z, .09, 2.1);
      this.cylinder(metal, table.x, .1, table.z, .62, .2);
      for (const offset of [-.45, .45]) this.cylinder(bronze, table.x + offset, 2.5, table.z, .14, .42);
    }
    // PA stacks: inset cones and guards, not luminous blocks.
    for (const speaker of CLUB_OBSTACLES.filter(o => o.height === 5.6)) {
      this.box(dark, speaker.x, 2.8, speaker.z, speaker.width, speaker.height, speaker.depth);
      for (const y of [1.2, 3.3]) {
        const cone = this.mesh(new THREE.ConeGeometry(.9, .28, 24, 1, true), metal, speaker.x, y, -23.57); cone.rotation.x = -Math.PI / 2;
        this.mesh(new THREE.TorusGeometry(.93, .06, 8, 32), dark, speaker.x, y, -23.55);
        this.mesh(new THREE.SphereGeometry(.3, 16, 12), dark, speaker.x, y, -23.45).scale.z = .35;
        for (const dx of [-.56, 0, .56]) this.box(metal, speaker.x + dx, y, -23.39, .025, 1.55, .025);
      }
      this.box(metal, speaker.x, 4.88, -23.59, 1.7, .5, .1);
    }
    for (const x of [-7, 7]) {
      this.box(metal, x, 9.4, -16, 4.3, .18, .5); this.box(glow, x, 9.28, -16, 3.9, .055, .12);
      const lamp = new THREE.PointLight(0xc3cba9, 65, 27, 2); lamp.position.set(x, 8.8, -16); this.root.add(lamp);
    }
    const key = new THREE.SpotLight(0xc3c7a0, 155, 26, .78, .75, 2);
    key.name = 'club-conversation-light'; key.position.set(10, 8, 1); key.target.position.set(7, 3.5, -5);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .035; this.root.add(key, key.target);
    const fill = new THREE.PointLight(0xadbda8, 35, 18, 2); fill.position.set(4, 5, -10); this.root.add(fill);
    const barLight = new THREE.PointLight(0xc7a570, 85, 25, 2); barLight.position.set(18, 6, -8); this.root.add(barLight);
    for (const [i, x] of [-9, 9].entries()) {
      const light = new THREE.SpotLight(i ? 0xa2aea1 : 0xb1b99c, 145, 30, .42, .9, 2);
      light.position.set(x, 10, 4); light.target.position.set(-x * .4, 0, 7); this.root.add(light, light.target); this.spots.push(light);
    }
    this.box(glow, 0, 7.45, 27.65, 2.7, .35, .08);
    this.batch();
    this.ready = this.loadCrowd();
  }
  private mat(color: number, roughness: number, metalness = 0, source?: string, repeat = 1): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(mat);
    if (source) for (const [key, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${source}-${suffix}.jpg`); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace; mat[key] = texture; this.textures.add(texture);
    }
    return mat;
  }
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geo); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh); return mesh;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) { return this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
  private cylinder(mat: THREE.Material, x: number, y: number, z: number, radius: number, height: number) { return this.mesh(new THREE.CylinderGeometry(radius, radius, height, 16), mat, x, y, z); }
  private batch(): void {
    this.root.updateMatrixWorld(true); const inverse = this.root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const removed: THREE.Mesh[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      let geo = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (geo.index) { const indexed = geo; geo = indexed.toNonIndexed(); indexed.dispose(); }
      const parts = batches.get(object.material) ?? []; parts.push(geo); batches.set(object.material, parts); removed.push(object);
    });
    removed.forEach(object => object.removeFromParent());
    this.geometries.forEach(geo => geo.dispose()); this.geometries.clear();
    for (const [mat, parts] of batches) { this.mesh(mergeGeometries(parts)!, mat, 0, 0, 0); parts.forEach(geo => geo.dispose()); }
  }
  private async loadCrowd(): Promise<void> {
    const assets = await Promise.all(['male', 'female'].map(async sex => {
      const asset = await new GLTFLoader().loadAsync(`/assets/characters/club-${sex}.glb`);
      asset.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        this.geometries.add(object.geometry); const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
        for (const texture of [material.map, material.normalMap]) if (texture) this.textures.add(texture);
        if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
      });
      if (this.disposed) this.release();
      return asset;
    }));
    if (this.disposed) { this.release(); return; }
    for (const [i, position] of CLUB_DANCERS.entries()) {
      const root = clone(assets[i % 2].scene) as THREE.Group; root.name = `club-dancer-${i}`;
      const bones = new Map<string, THREE.Bone>(); const colors = [0x302c30, 0x242c2b, 0x49483a, 0x3b2226];
      root.traverse(object => {
        if (object instanceof THREE.Bone) bones.set(object.name, object);
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false; object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.skeletons.add(object.skeleton); }
        const source = object.material as THREE.MeshStandardMaterial;
        if (/Coat|Trousers/.test(source.name)) { const mat = source.clone(); mat.color.setHex(colors[i % colors.length]); object.material = mat; this.materials.add(mat); }
      });
      root.position.set(position.x, 0, position.z); root.rotation.y = position.yaw; root.scale.setScalar(position.scale); this.root.add(root);
      this.dancers.push({ root, bones, pelvis: bones.get('pelvis')!.position.clone() });
    }
    this.update(0);
  }
  update(time: number): void {
    this.dancers.forEach(({ bones, pelvis }, i) => {
      const beat = time * 2.7 + i * 1.39; const weight = Math.sin(beat) * .07;
      const hip = bones.get('pelvis')!; hip.position.copy(pelvis); hip.position.y -= .04 + Math.abs(weight) * .6; hip.rotation.z = weight * .5;
      bones.get('spine')!.rotation.set(.025, Math.sin(beat * .5) * .07, -weight * .7);
      bones.get('chest')!.rotation.set(.04, Math.sin(beat * .5) * .12, -weight);
      bones.get('head')!.rotation.set(Math.sin(beat) * .04, Math.sin(beat * .24) * .17, weight * .3);
      for (const side of ['R', 'L']) {
        const sign = side === 'R' ? 1 : -1; const sway = Math.sin(beat + sign) * .12;
        bones.get('shoulder_' + side)!.rotation.set(-.3 + sway, 0, sign * (.1 + (i % 3 === 0 ? .7 : .08)));
        bones.get('elbow_' + side)!.rotation.set(-.6 + sway, 0, 0);
        bones.get('hip_' + side)!.rotation.set(-.06 + sway * .3, 0, sign * .07);
        bones.get('knee_' + side)!.rotation.x = .12 + Math.abs(sway) * .3;
      }
    });
    this.spots.forEach((light, i) => { light.target.position.x = Math.sin(time * .19 + i * 2) * 7; light.target.position.z = 6 + Math.cos(time * .23 + i) * 5; });
  }
  private release(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.skeletons.forEach(s => s.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.release(); this.root.removeFromParent();
  }
}
