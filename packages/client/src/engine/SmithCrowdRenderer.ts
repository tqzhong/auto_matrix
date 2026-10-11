import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SMITH_FINALE, newSmithFinale, smithEndingPose, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { smithCodeSurface, smithCodeUniforms } from './SmithCodeSurface.js';

/** Static, posed Smith replicas. Shared surfaces avoid hundreds of skeleton updates. */
export class SmithCrowdRenderer {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private state = newSmithFinale();
  private player = { x: 0, z: 30 };
  private disposed = false;
  private code = smithCodeUniforms();
  private batches: { mesh: THREE.InstancedMesh; level: number }[] = [];
  private spectators: { matrix: THREE.Matrix4; z: number }[] = [];
  private instances = [0, 1].map(() => new THREE.InstancedBufferAttribute(new Float32Array(323 * 16), 16).setUsage(THREE.DynamicDrawUsage));
  private shown: number[][] = [[], []];
  private bodyBounds = new THREE.Box3();
  private bodySphere = new THREE.Sphere();
  private range = new THREE.Sphere();
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private camera?: THREE.Camera;
  private waterHeight?: number;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();

  constructor(root: THREE.Group) {
    this.group.name = 'smith-finale-crowd'; root.add(this.group);
    this.ready = this.load();
    void this.ready.catch(error => { if (!this.disposed) console.warn('Unable to load the Smith audience', error); });
  }

  private async load(): Promise<void> {
    const asset = await new GLTFLoader().loadAsync('/assets/characters/smith-crowd.glb');
    const surfaces: THREE.Mesh[] = [];
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      surfaces.push(object); this.geometries.add(object.geometry);
      object.geometry.computeBoundingBox(); this.bodyBounds.union(object.geometry.boundingBox!);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.textures.add(value);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.15;
          if (material.name === 'Hair cards') material.alphaToCoverage = true;
          smithCodeSurface(material, this.code);
        }
      }
    });
    if (this.disposed) { this.release(); return; }
    const dummy = new THREE.Object3D();
    for (let section = 0; section < 6; section++) {
      for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let column = 0; column < 9; column++) {
        if (side === 1 && row === 0 && section * 9 + column === SMITH_FINALE.entrance.column) continue;
        const x = side * [19.7, 22, 24.25][row];
        const z = -70 + (section * 9 + column) * 2.6 + row * .84;
        dummy.position.set(x, row === 0 ? .035 : .29, z);
        dummy.rotation.set(0, -side * Math.PI / 2, 0); dummy.updateMatrix();
        this.spectators.push({ matrix: dummy.matrix.clone(), z: -70 + (section * 9 + 4) * 2.6 + .84 });
      }
    }
    // Eight surfaces share one matrix buffer per detail level. Cull full bodies
    // before upload, retaining any spectator seen directly or in the water.
    for (let level = 0; level < 2; level++) for (const source of surfaces) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, this.spectators.length);
      mesh.name = `smith-finale-crowd-${level === 0 ? 'near' : 'far'}-${source.name}`;
      mesh.instanceMatrix = this.instances[level]; mesh.receiveShadow = true;
      this.group.add(mesh); this.batches.push({ mesh, level });
    }
    this.refreshBounds(); this.update(this.state, this.player, this.camera, this.waterHeight);
    // Show the near crowd immediately; the optional low-detail model only replaces
    // distant section geometry and reuses the decoded textures and materials.
    const materials = new Map([...this.materials].map(material => [material.name, material]));
    const distant = await new GLTFLoader().register(parser => ({ name: 'SmithCrowdSharedMaterials',
      loadMaterial: index => Promise.resolve(materials.get(parser.json.materials[index].name)!),
    })).loadAsync('/assets/characters/smith-crowd-far.glb');
    const farSurfaces = new Map<string, THREE.BufferGeometry>();
    const temporaryMaterials = new Set<THREE.Material>();
    distant.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      farSurfaces.set(object.name, object.geometry); this.geometries.add(object.geometry);
      object.geometry.computeBoundingBox(); this.bodyBounds.union(object.geometry.boundingBox!);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        if (material !== materials.get(material.name)) temporaryMaterials.add(material);
    });
    temporaryMaterials.forEach(material => material.dispose());
    if (this.disposed) { this.release(); return; }
    for (const batch of this.batches) if (batch.level === 1) batch.mesh.geometry = farSurfaces.get(batch.mesh.name.replace('smith-finale-crowd-far-', ''))!;
    this.refreshBounds(); this.update(this.state, this.player, this.camera, this.waterHeight);
  }

  private refreshBounds(): void {
    this.bodyBounds.getBoundingSphere(this.bodySphere);
    const bounds = new THREE.Box3();
    for (const spectator of this.spectators) bounds.union(this.bodyBounds.clone().applyMatrix4(spectator.matrix));
    for (const { mesh } of this.batches) {
      mesh.boundingBox = bounds.clone(); mesh.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    }
  }

  update(encounter: SmithFinaleEncounter = newSmithFinale(), player = this.player, camera?: THREE.Camera, waterHeight?: number): void {
    this.state = { ...encounter };
    this.player = { ...player };
    this.camera = camera; this.waterHeight = waterHeight;
    this.group.visible = encounter.phase !== 'done';
    this.code.smithCrowd.value = smithEndingPose(encounter).crowd;
    this.group.getWorldPosition(this.code.smithOrigin.value);
    if (camera) {
      camera.updateWorldMatrix(true, false);
      this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    }
    const shown: number[][] = [[], []];
    for (const [index, spectator] of this.spectators.entries()) {
      if (camera) {
        this.range.copy(this.bodySphere).applyMatrix4(spectator.matrix).applyMatrix4(this.group.matrixWorld);
        if (!this.frustum.intersectsSphere(this.range)) {
          if (waterHeight === undefined) continue;
          // A horizontal mirror is equivalent to viewing the reflected body
          // with the main camera. The water clipping plane only removes more.
          this.range.center.y = 2 * waterHeight - this.range.center.y;
          if (!this.frustum.intersectsSphere(this.range)) continue;
        }
      }
      const level = player.x ** 2 + (player.z - spectator.z) ** 2 > 50 ** 2 ? 1 : 0;
      shown[level].push(index);
    }
    for (let level = 0; level < 2; level++) {
      const indices = shown[level];
      if (indices.length !== this.shown[level].length || indices.some((index, i) => index !== this.shown[level][i])) {
        for (let i = 0; i < indices.length; i++) this.instances[level].array.set(this.spectators[indices[i]].matrix.elements, i * 16);
        this.instances[level].needsUpdate = true; this.shown[level] = indices;
      }
      for (const batch of this.batches) if (batch.level === level) batch.mesh.count = indices.length;
    }
  }

  private release(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.textures.forEach(texture => texture.dispose()); this.textures.clear();
  }

  dispose(): void {
    this.disposed = true; this.group.removeFromParent();
    this.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.group.clear(); this.batches = []; this.release();
  }
}
