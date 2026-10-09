import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { DOCK_EVACUATION, dockEvacuationSoldier, type DockEvacuation } from '@auto_matrix/shared';
import { footTrajectory } from '../agents/CharacterMotion.js';
import { reach } from '../agents/SpoonPerformance.js';

type CrewMember = { root: THREE.Group; bones: Map<string, THREE.Bone>; pelvis: THREE.Vector3; footHeight: number };

/** Existing CC0 background rigs, posed directly from the saved withdrawal clock. */
export class DockEvacuationCrew {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  loaded = false;
  private people: CrewMember[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private disposed = false;
  private state?: DockEvacuation;

  constructor(parent: THREE.Group) {
    this.group.name = 'evacuation-rigged-crew'; parent.add(this.group); this.ready = this.load();
  }

  private async load(): Promise<void> {
    const assets = await Promise.all(['male', 'female'].map(sex => new GLTFLoader().loadAsync(`/assets/characters/club-${sex}.glb`)));
    for (const asset of assets) {
      asset.scene.updateMatrixWorld(true);
      asset.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        this.geometries.add(object.geometry);
        const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
        for (const texture of [material.map, material.normalMap, material.roughnessMap]) if (texture) this.textures.add(texture);
        if (object instanceof THREE.SkinnedMesh) {
          this.skeletons.add(object.skeleton);
          if (material.name === 'Boot leather') {
            const geometry = object.geometry.clone(); object.geometry = geometry; this.geometries.add(geometry);
            const positions = geometry.attributes.position, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
            const point = new THREE.Vector3();
            for (let i = 0; i < positions.count; i++) {
              point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
              const ankle = object.skeleton.bones.findIndex(bone => bone.name === (point.x < 0 ? 'ankle_R' : 'ankle_L'));
              indices.setXYZW(i, ankle, 0, 0, 0); weights.setXYZW(i, 1, 0, 0, 0);
            }
          }
        }
      });
    }
    if (this.disposed) { this.release(); return; }
    const colors = [0x85725b, 0x74614f, 0x6e5845, 0x938269, 0x6c6b59, 0x8b705c];
    for (let i = 0; i < DOCK_EVACUATION.crew; i++) {
      const root = clone(assets[i % 2].scene) as THREE.Group; root.name = `evacuation-soldier-${i}`; root.scale.setScalar(.88);
      const bones = new Map<string, THREE.Bone>();
      root.traverse(object => {
        if (object instanceof THREE.Bone) bones.set(object.name, object);
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = object.receiveShadow = true;
        if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.skeletons.add(object.skeleton); }
        const material = object.material as THREE.MeshStandardMaterial;
        if (/Coat|Trousers/.test(material.name)) {
          const copy = material.clone(); copy.color.setHex(material.name === 'Trousers' ? 0x4c4940 : colors[i]);
          object.material = copy; this.materials.add(copy);
        }
      });
      root.updateMatrixWorld(true);
      const footHeight = root.worldToLocal(bones.get('ankle_R')!.getWorldPosition(new THREE.Vector3())).y;
      this.group.add(root); this.people.push({ root, bones, pelvis: bones.get('pelvis')!.position.clone(), footHeight });
    }
    this.loaded = true; this.update(this.state);
  }

  update(state?: DockEvacuation): void {
    this.state = state;
    if (!this.loaded) return;
    const saved = state ?? { phase: 'supplies', elapsed: 0, crewAge: 0, remaining: 26, attempts: 0, delivered: false };
    this.people.forEach(({ root, bones, pelvis, footHeight }, i) => {
      const at = dockEvacuationSoldier(saved, i), row = Math.floor(i / 3);
      const age = Math.max(0, saved.crewAge - i * .4), speed = (43.8 + row * 3.5) / (DOCK_EVACUATION.crewSeconds - i * .4);
      const phase = age * speed / (2 * .68 / .6);
      root.position.set(at.x, at.y, at.z); root.rotation.set(0, at.yaw, 0);
      const hip = bones.get('pelvis')!; hip.position.copy(pelvis); hip.position.y -= at.moving ? .11 : .035; hip.rotation.set(0, 0, 0);
      bones.get('spine')!.rotation.set(at.moving ? .08 : 0, 0, 0); bones.get('chest')!.rotation.set(0, 0, 0); bones.get('head')!.rotation.set(.04, 0, 0);
      root.updateWorldMatrix(true, true);
      const rotation = root.getWorldQuaternion(new THREE.Quaternion());
      for (const [j, side] of ['R', 'L'].entries()) {
        const sign = j ? 1 : -1, foot = footTrajectory(phase + j * .5, .68, .6);
        const ankle = bones.get(`ankle_${side}`)!, knee = bones.get(`knee_${side}`)!, upper = bones.get(`hip_${side}`)!;
        const target = root.localToWorld(new THREE.Vector3(sign * .25 / .88, footHeight + (at.moving ? foot.lift * .38 / .88 : 0), at.moving ? foot.z / .88 : 0));
        reach(upper, knee, ankle.position, target, new THREE.Vector3(sign * .1, .1, 1).applyQuaternion(rotation));
        ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
        const swing = at.moving ? Math.cos((phase + j * .5) * Math.PI * 2) * .5 : .02;
        bones.get(`shoulder_${side}`)!.rotation.set(swing, 0, sign * .075);
        bones.get(`elbow_${side}`)!.rotation.set(-.65, 0, 0); bones.get(`wrist_${side}`)!.rotation.set(0, 0, 0);
        for (let finger = 1; finger <= 5; finger++) for (let joint = 1; joint <= 3; joint++)
          bones.get(`finger${finger}-${joint}_${side}`)!.rotation.set(0, 0, -sign * (finger === 1 ? .08 : .24));
      }
      root.updateMatrixWorld(true);
    });
  }

  private release(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose()); this.skeletons.forEach(s => s.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.group.removeFromParent(); this.release(); }
}
