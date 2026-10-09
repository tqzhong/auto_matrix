import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TRILOGY_EPILOGUE, type FilmJourney } from '@auto_matrix/shared';

/** Two shared anatomical bodies, with baked arm arcs and individual saved-clock reactions. */
export class ZionCrowdRenderer {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private disposed = false;
  private journey?: Pick<FilmJourney, 'scene' | 'step' | 'visiting' | 'epilogue'>;
  private elapsed = 0;
  private residents: { x: number; z: number; height: number; sex: string; delay: number }[] = [];
  private batches: { mesh: THREE.InstancedMesh; source: THREE.Mesh; indices: number[]; height: number }[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private cloth: THREE.DataTexture;
  private dummy = new THREE.Object3D();

  constructor(root: THREE.Group) {
    this.group.name = 'zion-temple-crowd'; root.add(this.group);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 16; col++) {
      const x = -39 + col * 5.1 + Math.sin(row * 11 + col) * .9, z = 13 + row * 6 + Math.cos(col * 4) * .8;
      // Keep the central passage and the two reunion pairs clear, including raised hands.
      if (Math.abs(x) < 5 || [[-6, 17], [-2.2, 17], [3, 19], [6.5, 19]].some(([a, b]) => Math.hypot(x - a, z - b) < 3.2)) continue;
      this.residents.push({ x, z, height: 3.9 + (row * 17 + col * 13) % 6 * .09,
        sex: (row * 5 + col * 7) % 3 === 0 ? 'female' : 'male', delay: .48 + row * .12 + (col * 7 % 11) * .035 });
    }
    const size = 64, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const shade = 235 + ((x + y) % 2 ? 5 : -5) + Math.sin(x * 7.13 + y * 5.37) * 3;
      pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
    }
    this.cloth = new THREE.DataTexture(pixels, size, size); this.cloth.name = 'zion-crowd-cotton-weave';
    this.cloth.colorSpace = THREE.SRGBColorSpace; this.cloth.wrapS = this.cloth.wrapT = THREE.RepeatWrapping;
    this.cloth.repeat.set(18, 18); this.cloth.generateMipmaps = true;
    this.cloth.minFilter = THREE.LinearMipmapLinearFilter; this.cloth.magFilter = THREE.LinearFilter; this.cloth.needsUpdate = true;
    this.textures.add(this.cloth);
    this.ready = Promise.all(['male', 'female'].map(sex => this.load(sex))).then(() => {});
    void this.ready.catch(error => { if (!this.disposed && typeof document !== 'undefined') console.warn('Unable to load the Zion audience', error); });
  }

  private async load(sex: string): Promise<void> {
    const asset = await new GLTFLoader().loadAsync(`/assets/characters/zion-crowd-${sex}.glb`);
    const sources: THREE.Mesh[] = [];
    asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      sources.push(object); this.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        this.materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) this.textures.add(value);
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = .5;
          if (/Zion (shirt|trousers)/.test(material.name)) { material.map = material.bumpMap = this.cloth; material.bumpScale = .007; }
          if (material.name === 'Zion hair') material.alphaToCoverage = true;
        }
      }
    });
    if (this.disposed) { this.release(); return; }
    const indices = this.residents.map((_, index) => index).filter(index => this.residents[index].sex === sex);
    for (const source of sources) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, indices.length);
      mesh.name = `zion-crowd-${sex}-${source.name}`; mesh.userData.dynamic = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.receiveShadow = true;
      const material = source.material as THREE.Material;
      for (let i = 0; i < indices.length; i++) {
        const palette = material.name === 'Zion skin' ? [0xf4dcca, 0xceac91, 0xa3795c, 0x7f5941]
          : material.name === 'Zion shirt' ? [0x9c8975, 0x80765e, 0x6b6354, 0xb3a38f, 0x786756]
            : material.name === 'Zion trousers' ? [0x665f50, 0x595c50, 0x8a7a63, 0x716758] : [0xffffff];
        mesh.setColorAt(i, new THREE.Color(palette[(indices[i] * 7 + Math.floor(indices[i] / 16)) % palette.length]));
      }
      this.group.add(mesh); this.batches.push({ mesh, source, indices, height: asset.parser.json.extras.height });
    }
    this.applyPose();
  }

  update(journey?: FilmJourney, elapsed = 0): void {
    this.journey = journey ? { scene: journey.scene, step: journey.step, visiting: journey.visiting,
      epilogue: journey.epilogue ? { ...journey.epilogue } : undefined } : undefined;
    this.elapsed = elapsed; this.applyPose();
  }

  private applyPose(): void {
    const journey = this.journey, encounter = journey?.scene === 'm3_ceasefire' && !journey.visiting ? journey.epilogue : undefined;
    const clock = encounter?.phase === 'announcement' ? encounter.elapsed
      : encounter?.phase === 'embrace' ? TRILOGY_EPILOGUE.seconds.announcement + encounter.elapsed
        : encounter?.phase === 'done' ? TRILOGY_EPILOGUE.seconds.announcement + TRILOGY_EPILOGUE.seconds.embrace : 0;
    const dancing = journey?.scene === 'm2_temple' && journey.step >= 2 && !journey.visiting;
    const smooth = (value: number, start: number, end: number) => THREE.MathUtils.smoothstep(value, start, end);
    for (const batch of this.batches) {
      for (let instance = 0; instance < batch.indices.length; instance++) {
        const index = batch.indices[instance], resident = this.residents[index];
        const reaction = smooth(clock, resident.delay, resident.delay + .9);
        const entrance = Math.atan2(-resident.x, -30 - resident.z), report = Math.atan2(-resident.x, 14 - resident.z);
        const turn = smooth(clock, resident.delay - .35, resident.delay + .4);
        const angle = Math.atan2(Math.sin(report - entrance), Math.cos(report - entrance));
        this.dummy.position.set(resident.x, 0, resident.z);
        this.dummy.rotation.set(0, entrance + turn * angle + (dancing ? Math.sin(this.elapsed * 1.7 + index) * .16 : Math.sin(index) * .06), 0);
        this.dummy.scale.setScalar(resident.height / batch.height); this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(instance, this.dummy.matrix);
        const weights = batch.source.morphTargetInfluences!; weights.fill(0);
        for (let side = 0; side < 2; side++) {
          const raised = dancing ? .58 + Math.sin(this.elapsed * 2.2 + index * .53 + side) * .3
            : reaction * (index % 4 === 0 && side === 1 ? .12 : .76 + Math.sin(clock * 2.2 + index * .53 + side) * .19);
          // Two baked samples follow the arm's arc while keeping the actual soles planted.
          weights[side * 2] = raised <= .5 ? raised * 2 : (1 - raised) * 2;
          weights[side * 2 + 1] = Math.max(0, raised * 2 - 1);
        }
        batch.mesh.setMorphAt(instance, batch.source);
      }
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.morphTexture!.needsUpdate = true;
      batch.mesh.computeBoundingBox(); batch.mesh.computeBoundingSphere();
    }
  }

  private release(): void {
    this.geometries.forEach(resource => resource.dispose()); this.geometries.clear();
    this.materials.forEach(resource => resource.dispose()); this.materials.clear();
    this.textures.forEach(resource => resource.dispose()); this.textures.clear();
  }

  dispose(): void {
    this.disposed = true; this.group.removeFromParent();
    for (const batch of this.batches) batch.mesh.dispose();
    this.group.clear(); this.batches = []; this.release();
  }
}
