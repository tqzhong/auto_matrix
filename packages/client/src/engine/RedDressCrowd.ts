import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RED_DRESS_PLAZA } from '@auto_matrix/shared';

/** CC0 business pedestrians share baked walks, driven only by the saved clock. */
export class RedDressCrowd {
  readonly ready: Promise<void>;
  readonly group = new THREE.Group();
  private batches: { mesh: THREE.InstancedMesh; source: THREE.Mesh; indices: number[]; frames: number; distance: number }[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  private clock = 0;
  private started = false;
  private posedClock = NaN;
  private posedStarted = false;

  constructor(private groups: THREE.Group[]) {
    this.group.name = 'red-dress-crowd-batches'; this.groups[0]?.parent?.add(this.group);
    this.ready = typeof document === 'undefined' ? Promise.resolve()
      : Promise.all(['male', 'female'].map(sex => this.load(sex))).then(() => {});
    void this.ready.catch(error => { if (!this.disposed) console.warn('红衣女子程序行人模型加载失败', error); });
  }

  private async load(sex: string): Promise<void> {
    const asset = await new GLTFLoader().loadAsync(`/assets/characters/plaza-crowd-${sex}.glb`);
    const sources: THREE.Mesh[] = [];
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      sources.push(object); this.geometries.add(object.geometry);
      const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) {
        value.anisotropy = 4; this.textures.add(value);
      }
      material.envMapIntensity = .5;
      if (material.name === 'Plaza hair') material.alphaToCoverage = true;
    });
    if (this.disposed) { this.release(); return; }
    const indices = this.groups.map((_, i) => i).filter(i => (i % 3 === 1 ? 'female' : 'male') === sex);
    if (!indices.length) return;
    for (const source of sources) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, indices.length);
      mesh.name = `red-dress-crowd-${sex}-${source.name}`; mesh.userData.dynamic = true;
      mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const name = (source.material as THREE.Material).name;
      const palette = name === 'Plaza skin' ? [0xffffff, 0xe7c9b2, 0xc79b7c, 0xad8061]
        : name === 'Plaza suit' || name === 'Plaza trousers' ? [0xb9c1c5, 0xc6b7a2, 0x929a9e, 0xd0c8b7]
          : name === 'Plaza hair' ? [0xc4b7a2, 0x79726b, 0xffffff, 0xa99476] : [0xffffff];
      for (let i = 0; i < indices.length; i++) mesh.setColorAt(i, new THREE.Color(palette[indices[i] % palette.length]));
      // Every possible lane position and walk pose, including the wrap seam.
      // A fixed conservative bound avoids rebuilding twelve bounds every frame.
      mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-8, -.1, RED_DRESS_PLAZA.crowd.near - 2),
        new THREE.Vector3(24, 5, RED_DRESS_PLAZA.crowd.far + 2));
      mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
      this.group.add(mesh); this.batches.push({ mesh, source, indices,
        frames: asset.parser.json.extras.phases.length, distance: asset.parser.json.extras.cycleDistance });
    }
    for (const index of indices) { this.groups[index].clear(); this.groups[index].userData.detailed = true; }
    this.posedClock = NaN; this.update(this.clock, this.started);
  }

  update(clock: number, started: boolean): void {
    this.clock = clock; this.started = started;
    if (clock === this.posedClock && started === this.posedStarted) return;
    const travel = started ? clock * 2 : 0;
    const { near, far } = RED_DRESS_PLAZA.crowd, length = far - near;
    for (const [index, group] of this.groups.entries()) {
      if (!group.userData.detailed) continue;
      const direction = index % 2 ? 1 : -1;
      group.position.z = ((Number(group.userData.baseZ) + direction * travel - near) % length + length) % length + near;
      group.rotation.set(0, direction > 0 ? 0 : Math.PI, 0); group.updateMatrix();
    }
    for (const batch of this.batches) {
      for (const [instance, index] of batch.indices.entries()) {
        const group = this.groups[index], weights = batch.source.morphTargetInfluences!; weights.fill(0);
        if (started) {
          // Shorter people take proportionately more steps, keeping planted feet
          // still in world space instead of sliding with the unscaled stride.
          const phase = ((travel / (batch.distance * group.scale.y) + index * .77) % 1 + 1) % 1 * batch.frames;
          const frame = Math.floor(phase), blend = phase - frame;
          weights[frame] = 1 - blend; weights[(frame + 1) % batch.frames] = blend;
        }
        batch.mesh.setMatrixAt(instance, group.matrix); batch.mesh.setMorphAt(instance, batch.source);
      }
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.morphTexture!.needsUpdate = true;
    }
    this.posedClock = clock; this.posedStarted = started;
  }

  private release(): void {
    this.geometries.forEach(resource => resource.dispose()); this.geometries.clear();
    this.materials.forEach(resource => resource.dispose()); this.materials.clear();
    this.textures.forEach(resource => resource.dispose()); this.textures.clear();
  }

  dispose(): void {
    this.disposed = true;
    for (const batch of this.batches) batch.mesh.dispose();
    this.batches = []; this.group.removeFromParent(); this.group.clear(); this.release();
  }
}
