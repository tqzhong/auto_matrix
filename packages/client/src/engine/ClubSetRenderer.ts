import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLUB_CAGE, CLUB_DANCERS, CLUB_OBSTACLES } from '@auto_matrix/shared';
import { reach } from '../agents/SpoonPerformance.js';

interface DanceFoot { thigh: THREE.Bone; shin: THREE.Bone; ankle: THREE.Bone; mark: THREE.Vector3 }

const danceWardrobe = [
  [0x28272d, 0x25232a, .84], [0xaaa086, 0x2c3133, .35],
  [0x3e483b, 0x2c312e, .81], [0x5c353c, 0x34282e, .46],
  [0x3e3832, 0x2e3033, .67], [0x696351, 0x322d35, .8],
  [0x342e36, 0x312b2c, .45], [0x373e41, 0x282b30, .38],
] as const;

/** A navigable, vaulted underground room. The principal encounter stays clear of the dance floor. */
export class ClubSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private roomBitmaps = new Set<ImageBitmap>();
  private skeletons = new Set<THREE.Skeleton>();
  private dancers: { root: THREE.Group; bones: Map<string, THREE.Bone>; pelvis: THREE.Vector3; feet: DanceFoot[] }[] = [];
  private footTarget = new THREE.Vector3();
  private kneeDirection = new THREE.Vector3();
  private dancerFacing = new THREE.Quaternion();
  private shoeFacing = new THREE.Quaternion();
  private preparedDancers = 0;
  private spots: THREE.SpotLight[] = [];
  private disposed = false;
  readonly ready: Promise<void>;

  // The two source rigs cover all geometry, maps and shader variants.
  get crowdSources(): THREE.Group[] { return this.dancers.slice(0, 2).map(({ root }) => root); }

  prepareCrowdBounds(): void {
    const dancer = this.dancers[this.preparedDancers];
    if (!dancer) return;
    this.preparedDancers++;
    // Use the padded pose for frustum tests while retaining its original sort center.
    dancer.root.updateMatrixWorld(true);
    dancer.root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      if (object.boundingSphere === null) object.computeBoundingSphere();
      // The two club rigs keep their full dance motion within this local-space margin.
      object.boundingSphere!.radius += .75;
      object.frustumCulled = true;
    });
  }

  constructor(parent: THREE.Group) {
    this.root.name = 'white-rabbit-club'; parent.add(this.root);
    const wall = this.mat(0x737766, .91, 0, 'damaged_plaster', 3);
    const stone = this.mat(0x4f554c, .72, .03, 'marble_01', 6);
    const metal = this.mat(0x333b34, .5, .6, 'metal_plate', 1);
    const dark = this.mat(0x141a18, .84); const bronze = this.mat(0x797458, .4, .7);
    const wood = this.mat(0x37372d, .72, 0, 'old_wood_floor', 2);
    const recess = this.mat(0x383f37, .92); const paper = this.mat(0x706f5f, .97);
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
    // Keep the service counter and foot rail aligned with the shared obstacle.
    const bar = CLUB_OBSTACLES[0];
    this.box(wood, bar.x, 1.25, bar.z, bar.width, 2.5, bar.depth);
    this.box(metal, bar.x, 2.6, bar.z, 3.5, .16, 21.3);
    const rail = this.cylinder(bronze, 15.8, .62, -8, .045, 20.5); rail.rotation.x = Math.PI / 2;
    for (let z = -17; z <= 1; z += 3) this.box(bronze, 17.8, 1.3, z, 3.23, 2.2, .045);
    for (const [z, width] of [[-15.25, 6.6], [-8.6, 6.3], [-2.15, 5.9]]) {
      this.box(recess, 20.68, 5.2, z, .12, 5, width);
      for (const y of [3.2, 4.95]) this.box(wood, 20.1, y, z, 1.25, .14, width);
      this.box(metal, 20.47, 7.6, z, .28, .18, width);
    }
    for (const z of [-18.7, -11.85, -5.27, .95]) this.box(wall, 20.26, 5.17, z, .78, 5.35, .32);
    const bottleMaterial = this.mat(0x394c3a, .34, .18); const amber = this.mat(0x5b4d35, .36, .2);
    for (const [y, start, count, spacing] of [[3.27, -17.9, 5, .51], [5.02, -14.6, 3, .58], [3.27, -10.9, 4, .75],
      [5.02, -8.4, 4, .45], [3.27, -4.7, 4, .65], [5.02, -1.5, 3, .52]]) {
      for (let i = 0; i < count; i++) {
        const z = start + i * spacing, height = .53 + i % 3 * .13, radius = .13 + i % 2 * .035;
        const mat = i % 3 ? bottleMaterial : amber;
        this.cylinder(mat, 19.94, y + height / 2, z, radius, height);
        this.cylinder(mat, 19.94, y + height + .09, z, .06, .18);
        if (i % 3 !== 2) this.box(paper, 19.94 - radius - .008, y + height * .44, z, .012, .24, .18);
      }
    }
    for (const table of CLUB_OBSTACLES) {
      if (table.circleRadius === undefined) continue;
      this.cylinder(wood, table.x, 2.22, table.z, table.circleRadius, .16); this.cylinder(metal, table.x, 1.13, table.z, .09, 2.1);
      this.cylinder(metal, table.x, .1, table.z, .62, .2);
      for (const offset of [-.45, .45]) this.cylinder(bronze, table.x + offset, 2.5, table.z, .14, .42);
    }
    // PA stacks: inset cones and guards, not luminous blocks.
    for (const speaker of CLUB_OBSTACLES.filter(o => o.height === 5.6 && o !== CLUB_CAGE)) {
      this.box(dark, speaker.x, 2.8, speaker.z, speaker.width, speaker.height, speaker.depth);
      for (const y of [1.2, 3.3]) {
        const cone = this.mesh(new THREE.ConeGeometry(.9, .28, 24, 1, true), metal, speaker.x, y, -23.57); cone.rotation.x = -Math.PI / 2;
        this.mesh(new THREE.TorusGeometry(.93, .06, 8, 32), dark, speaker.x, y, -23.55);
        this.mesh(new THREE.SphereGeometry(.3, 16, 12), dark, speaker.x, y, -23.45).scale.z = .35;
        for (const dx of [-.56, 0, .56]) this.box(metal, speaker.x + dx, y, -23.39, .025, 1.55, .025);
      }
      this.box(metal, speaker.x, 4.88, -23.59, 1.7, .5, .1);
    }
    const { x: cageX, z: cageZ, width, depth, height, deck } = CLUB_CAGE;
    this.box(dark, cageX, deck / 2, cageZ, width, deck, depth);
    for (const y of [deck + .035, height - .045]) {
      const rail = this.mesh(new THREE.TorusGeometry(width / 2 - .07, .045, 8, 32), metal, cageX, y, cageZ);
      rail.rotation.x = Math.PI / 2; rail.scale.y = depth / width;
    }
    for (let i = 0; i < 12; i++) {
      const angle = (i + .5) * Math.PI / 6;
      this.cylinder(metal, cageX + Math.cos(angle) * (width / 2 - .07), (height + deck) / 2,
        cageZ + Math.sin(angle) * (depth / 2 - .07), .045, height - deck);
    }
    for (const x of [-7, 7]) {
      const cage = x < 0, fixtureX = cage ? cageX : x, fixtureY = cage ? 6.2 : 9.4, fixtureZ = cage ? -27.25 : -16;
      this.box(metal, fixtureX, fixtureY, fixtureZ, 4.3, .18, .5); this.box(glow, fixtureX, fixtureY - .12, fixtureZ, 3.9, .055, .12);
      const lamp = new THREE.PointLight(cage ? 0x91c6a0 : 0xc3cba9, cage ? 50 : 65, 27, 2);
      lamp.position.set(fixtureX, fixtureY - .6, fixtureZ); this.root.add(lamp);
    }
    const key = new THREE.SpotLight(0xa4cdb8, 125, 26, .58, .75, 2);
    key.name = 'club-conversation-light'; key.position.set(3.2, 6.6, -7.8); key.target.position.set(6.65, 3.65, -4.35);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .035; this.root.add(key, key.target);
    const fill = new THREE.PointLight(0x90b2a1, 34, 18, 2); fill.position.set(4.1, 6, -1.8); this.root.add(fill);
    const barLight = new THREE.PointLight(0xb5a879, 38, 13, 2); barLight.position.set(18.5, 5.85, -13.65); this.root.add(barLight);
    for (const [i, x] of [-9, 9].entries()) {
      const y = 8.05, z = -20.2;
      this.box(metal, x, y + .68, z - .15, 4.2, .25, .55);
      for (const offset of [-.95, .95]) {
        const housing = this.cylinder(metal, x + offset, y, z, .52, .64);
        const lens = this.cylinder(glow, x + offset, y, z + .34, .38, .06);
        housing.rotation.x = lens.rotation.x = Math.PI / 2;
      }
      const light = new THREE.SpotLight(i ? 0x7ac393 : 0xa6c867, 225, 34, .48, .62, 2);
      light.position.set(x, y, z + .42); light.target.position.set(-x * .4, 2.7, -3);
      this.root.add(light, light.target); this.spots.push(light);
    }
    this.box(glow, 0, 7.45, 27.65, 2.7, .35, .08);
    this.batch();
    this.ready = this.loadCrowd();
  }
  private mat(color: number, roughness: number, metalness = 0, source?: string, repeat = 1): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(mat);
    if (source) for (const [key, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
      const url = `/assets/film-materials/${source}-${suffix}.jpg`;
      const texture = this.roomMap(url); texture.name = url; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
      if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace; mat[key] = texture; this.textures.add(texture);
    }
    return mat;
  }
  private roomMap(url: string): THREE.Texture {
    if (typeof createImageBitmap !== 'function') return new THREE.TextureLoader().load(url);
    const texture = new THREE.Texture();
    const install = (image: HTMLImageElement | ImageBitmap) => {
      if (this.disposed) { if ('close' in image) image.close(); return; }
      // Bitmap uploads use the decode orientation in place of WebGL's flipY setting.
      if ('close' in image) { this.roomBitmaps.add(image); texture.flipY = false; }
      texture.image = image; texture.needsUpdate = true;
    };
    // Decode the response without an image element load callback on the render thread.
    void fetch(url).then(response => response.blob())
      .then(blob => this.disposed ? undefined : createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }))
      .then(bitmap => { if (bitmap) install(bitmap); }, () => {
        if (!this.disposed) new THREE.ImageLoader().load(url, install);
      });
    return texture;
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
      const skins: THREE.Skeleton[] = [];
      asset.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        this.geometries.add(object.geometry); const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
        for (const texture of [material.map, material.normalMap]) if (texture) this.textures.add(texture);
        if (object instanceof THREE.SkinnedMesh) { skins.push(object.skeleton); this.skeletons.add(object.skeleton); }
      });
      if (this.disposed) this.release();
      return { scene: asset.scene, skins };
    }));
    if (this.disposed) { this.release(); return; }
    for (const [i, position] of CLUB_DANCERS.entries()) {
      const asset = assets[i % 2], root = clone(asset.scene) as THREE.Group; root.name = `club-dancer-${i}`;
      const bones = new Map<string, THREE.Bone>();
      const [topColor, trouserColor, trouserRoughness] = danceWardrobe[i % danceWardrobe.length];
      const clonedSkins = new Map<THREE.Skeleton, THREE.Skeleton>();
      let skinIndex = 0;
      root.traverse(object => {
        if (object instanceof THREE.Bone) bones.set(object.name, object);
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false; object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) {
          // SkeletonUtils preserves mesh order but clones a skeleton per mesh.
          const sourceSkin = asset.skins[skinIndex++], sharedSkin = clonedSkins.get(sourceSkin);
          if (sharedSkin) object.skeleton = sharedSkin;
          else { clonedSkins.set(sourceSkin, object.skeleton); this.skeletons.add(object.skeleton); }
          object.frustumCulled = false;
        }
        const trousers = object.name === 'Tailored_trousers';
        if (trousers || object.name === 'Tailored_coat_upper' || object.name === 'Black_crew_neck') {
          const mat = (object.material as THREE.MeshStandardMaterial).clone();
          mat.color.setHex(trousers ? trouserColor : position.y ? 0xb2bba5 : topColor);
          if (trousers) mat.roughness = trouserRoughness;
          object.material = mat; this.materials.add(mat);
        }
      });
      root.position.set(position.x, position.y, position.z); root.rotation.y = position.yaw; root.scale.setScalar(position.scale); this.root.add(root);
      const feet = ['R', 'L'].map(side => {
        const thigh = bones.get('hip_' + side)!, shin = bones.get('knee_' + side)!, ankle = bones.get('ankle_' + side)!;
        return { thigh, shin, ankle, mark: root.worldToLocal(ankle.getWorldPosition(new THREE.Vector3())) };
      });
      this.dancers.push({ root, bones, pelvis: bones.get('pelvis')!.position.clone(), feet });
    }
    this.update(0);
  }
  update(time: number): void {
    this.dancers.forEach(({ root, bones, pelvis, feet }, i) => {
      const beat = time * 2.7 + i * 1.39; const weight = Math.sin(beat) * .07;
      const hip = bones.get('pelvis')!; hip.position.copy(pelvis); hip.position.y -= .04 + Math.abs(weight) * .6; hip.rotation.z = weight * .5;
      bones.get('spine')!.rotation.set(.025, Math.sin(beat * .5) * .07, -weight * .7);
      bones.get('chest')!.rotation.set(.04, Math.sin(beat * .5) * .12, -weight);
      bones.get('head')!.rotation.set(Math.sin(beat) * .04, Math.sin(beat * .24) * .17, weight * .3);
      for (const side of ['R', 'L']) {
        const sign = side === 'R' ? 1 : -1; const sway = Math.sin(beat + sign) * .12;
        bones.get('shoulder_' + side)!.rotation.set(-.3 + sway, 0, -sign * (.1 + (i % 3 === 0 && root.position.y === 0 ? .7 : .08)));
        bones.get('elbow_' + side)!.rotation.set(-.6 + sway, 0, 0);
      }
      root.getWorldQuaternion(this.dancerFacing);
      // One shoe stays on its mark while the other lifts into the next weight shift.
      for (const [foot, { thigh, shin, ankle, mark }] of feet.entries()) {
        const swing = THREE.MathUtils.smoothstep(Math.sin(beat) * (foot ? -1 : 1), .35, 1);
        this.footTarget.copy(mark);
        this.footTarget.y += .008 + .085 * swing;
        this.footTarget.z += .13 * swing;
        root.localToWorld(this.footTarget);
        this.kneeDirection.set(foot ? .08 : -.08, 0, 1).applyQuaternion(this.dancerFacing);
        reach(thigh, shin, ankle.position, this.footTarget, this.kneeDirection);
        ankle.quaternion.copy(shin.getWorldQuaternion(this.shoeFacing).invert().multiply(this.dancerFacing));
      }
    });
    this.spots.forEach((light, i) => { light.target.position.x = Math.sin(time * .19 + i * 2) * 7; light.target.position.z = -3 + Math.cos(time * .23 + i) * 3.5; });
  }
  private release(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.skeletons.forEach(s => s.dispose());
    this.roomBitmaps.forEach(bitmap => bitmap.close()); this.roomBitmaps.clear();
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.release(); this.root.removeFromParent();
  }
}
