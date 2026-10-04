import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { newSmithFinale, smithFinalePose, type SmithFinaleEncounter } from '@auto_matrix/shared';

/** Static, posed Smith replicas. Shared surfaces avoid hundreds of skeleton updates. */
export class SmithCrowdRenderer {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private state = newSmithFinale();
  private player = { x: 0, z: 30 };
  private disposed = false;
  private batches: { mesh: THREE.InstancedMesh; near: THREE.BufferGeometry; far: THREE.BufferGeometry; z: number }[] = [];
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
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.textures.add(value);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.15;
          if (material.name === 'Hair cards') material.alphaToCoverage = true;
        }
      }
    });
    if (this.disposed) { this.release(); return; }
    // Reuse the near materials while parsing the low-detail file: no duplicate
    // image decoding, texture uploads or material changes at the distance threshold.
    const materials = new Map([...this.materials].map(material => [material.name, material]));
    const distant = await new GLTFLoader().register(parser => ({ name: 'SmithCrowdSharedMaterials',
      loadMaterial: index => Promise.resolve(materials.get(parser.json.materials[index].name)!),
    })).loadAsync('/assets/characters/smith-crowd-far.glb');
    const farSurfaces = new Map<string, THREE.BufferGeometry>();
    const temporaryMaterials = new Set<THREE.Material>();
    distant.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      farSurfaces.set(object.name, object.geometry); this.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        if (material !== materials.get(material.name)) temporaryMaterials.add(material);
    });
    // GLTFLoader may clone a material for derivative tangents; only the near
    // material is used by the instances, and all of these clones share its maps.
    temporaryMaterials.forEach(material => material.dispose());
    if (this.disposed) { this.release(); return; }
    const dummy = new THREE.Object3D();
    // Each section has nine columns, three staggered rows and two sides. Keeping
    // six local bounds allows the camera to reject the far/behind avenue sections.
    for (let section = 0; section < 6; section++) for (const source of surfaces) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, 54);
      mesh.name = `smith-finale-crowd-${section}-${source.name}`;
      let instance = 0;
      for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let column = 0; column < 9; column++) {
        const x = side * [19.7, 22, 24.25][row];
        const z = -70 + (section * 9 + column) * 2.6 + row * .84;
        dummy.position.set(x, row === 0 ? .035 : .29, z);
        dummy.rotation.set(0, -side * Math.PI / 2, 0); dummy.updateMatrix();
        mesh.setMatrixAt(instance++, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); this.group.add(mesh);
      this.batches.push({ mesh, near: source.geometry, far: farSurfaces.get(source.name)!, z: -70 + (section * 9 + 4) * 2.6 + .84 });
    }
    this.update(this.state);
  }

  update(encounter: SmithFinaleEncounter = newSmithFinale(), player = this.player): void {
    this.state = { ...encounter };
    this.player = { ...player };
    this.group.visible = encounter.phase !== 'done';
    this.group.scale.y = encounter.phase === 'purging' ? Math.max(.02, 1 - smithFinalePose(encounter).purge) : 1;
    for (const batch of this.batches) {
      const geometry = player.x ** 2 + (player.z - batch.z) ** 2 > 50 ** 2 ? batch.far : batch.near;
      if (batch.mesh.geometry === geometry) continue;
      batch.mesh.geometry = geometry; batch.mesh.computeBoundingBox(); batch.mesh.computeBoundingSphere();
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
