import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { FilmJourney } from '@auto_matrix/shared';

type Performer = { root: THREE.Group; bones: Map<string, THREE.Bone>; pelvis: THREE.Vector3 };

/** Rigged background performers for the Hel coat check and dance floor. */
export class HelClubPerformers {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private skeletons = new Set<THREE.Skeleton>();
  private crowd: Performer[] = [];
  private guard?: Performer;
  private attendant?: Performer;
  private disposed = false;
  loaded = false;
  readonly ready: Promise<void>;

  constructor(parent: THREE.Group) {
    this.root.name = 'hel-performers'; parent.add(this.root);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const assets = await Promise.all(['male', 'female'].map(sex => new GLTFLoader().loadAsync(`/assets/characters/club-${sex}.glb`)));
    for (const asset of assets) asset.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      const material = object.material as THREE.MeshStandardMaterial;
      this.materials.add(material);
      for (const texture of [material.map, material.normalMap, material.roughnessMap]) if (texture) this.textures.add(texture);
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    if (this.disposed) { this.release(); return; }
    for (let i = 0; i < 12; i++) this.crowd.push(this.make(assets[i % 2].scene, `hel-dancer-${i}`, i));
    this.guard = this.make(assets[0].scene, 'hel-rigged-guard', 12);
    this.attendant = this.make(assets[1].scene, 'hel-coatcheck-attendant', 13);
    this.loaded = true;
  }

  private make(source: THREE.Group, name: string, index: number): Performer {
    const root = clone(source) as THREE.Group; root.name = name; root.scale.setScalar(.88);
    const bones = new Map<string, THREE.Bone>();
    const colors = [0x25252b, 0x33252a, 0x49483a, 0x473036, 0x383e3a, 0x302732];
    root.traverse(object => {
      if (object instanceof THREE.Bone) bones.set(object.name, object);
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false; object.receiveShadow = true;
      if (object instanceof THREE.SkinnedMesh) { object.frustumCulled = false; this.skeletons.add(object.skeleton); }
      const material = object.material as THREE.MeshStandardMaterial;
      if (/Coat|Trousers/.test(material.name)) {
        const copy = material.clone(); copy.color.setHex(index === 13 ? 0x6d4b4c : colors[index % colors.length]);
        object.material = copy; this.materials.add(copy);
      }
    });
    this.root.add(root);
    return { root, bones, pelvis: bones.get('pelvis')?.position.clone() ?? new THREE.Vector3() };
  }

  private pose(person: Performer, beat: number, crouch = 0, dancer = -1): void {
    const { bones, pelvis } = person;
    const weight = Math.sin(beat) * .07;
    const hip = bones.get('pelvis');
    if (hip) { hip.position.copy(pelvis); hip.position.y -= .04 + Math.abs(weight) * .6 + crouch * .55; hip.rotation.z = weight * .5; }
    bones.get('spine')?.rotation.set(crouch * .3, 0, -weight * .7);
    bones.get('chest')?.rotation.set(crouch * .46, Math.sin(beat * .5) * .08, -weight);
    bones.get('head')?.rotation.set(-crouch * .2, Math.sin(beat * .24) * .12, weight * .3);
    for (const side of ['R', 'L']) {
      const sign = side === 'R' ? 1 : -1;
      const sway = Math.sin(beat + sign) * .12;
      const raised = dancer >= 0 && (dancer + (side === 'R' ? 0 : 1)) % 3 === 0;
      bones.get('shoulder_' + side)?.rotation.set(-.3 + sway - crouch * .45 - (raised ? .24 : 0), 0,
        sign * (.12 + crouch * .24 + (raised ? .6 : 0)));
      bones.get('elbow_' + side)?.rotation.set(-.6 + sway - crouch * .4 - (raised ? .2 : 0), 0, 0);
      bones.get('hip_' + side)?.rotation.set(-.06 + sway * .3 + crouch * .65, 0, sign * .07);
      const knee = bones.get('knee_' + side); if (knee) knee.rotation.x = .12 + Math.abs(sway) * .3 + crouch * 1.1;
    }
  }

  update(journey: FilmJourney | undefined, time: number): void {
    if (!this.loaded) return;
    const scene = journey?.visiting ?? journey?.scene;
    const phase = scene === 'm3_hel_bargain' && !journey?.visiting ? journey?.helBargain?.phase : undefined;
    const entering = scene === 'm3_hel_entry' && !journey?.visiting && ((journey?.step ?? 0) > 3
      || journey?.helDanceDoor?.phase === 'open' || journey?.helDanceDoor?.phase === 'opening' && journey.helDanceDoor.elapsed > .7);
    this.crowd.forEach((person, i) => {
      person.root.visible = entering || Boolean(phase) && phase !== 'released';
      const side = i % 2 ? 1 : -1;
      const beat = time * 2.7 + i * 1.39;
      person.root.position.set(side * (i < 6 ? 2.8 + Math.floor(i / 2) * .35 : 5.5 + Math.floor(i / 4) * 1.1)
        + (['windup', 'evade', 'counter', 'airborne', 'gunpoint'].includes(phase ?? '') ? side * 1.6 : 0),
        phase ? 0 : Math.abs(Math.sin(beat)) * .035, -6 - Math.floor(i / 2) * 4.3);
      person.root.rotation.y = side * .4 + Math.sin(time * .7 + i) * .12;
      this.pose(person, beat, phase ? .18 : 0, phase ? -1 : i);
    });
    if (this.guard) {
      this.guard.root.visible = Boolean(phase) && !['armed', 'released'].includes(phase ?? '');
      this.guard.root.position.set(2.1, 0, phase === 'windup' || phase === 'evade' ? -30.5 - Math.min(1, journey?.helBargain?.elapsed ?? 0) : -31.5);
      this.guard.root.rotation.set(['airborne', 'gunpoint', 'failed'].includes(phase ?? '') ? -1.2 : 0, Math.PI, 0);
      this.pose(this.guard, time * 1.4, phase === 'gunpoint' ? .3 : 0);
    }
    if (this.attendant) {
      const coatcheck = scene === 'm3_hel_entry' && !journey?.visiting ? journey?.helCoatcheck : undefined;
      this.attendant.root.visible = scene === 'm3_hel_entry' && (journey?.step ?? 0) <= 2;
      const progress = Math.min(1, (coatcheck?.rescueElapsed ?? (coatcheck?.phase === 'ready' || !coatcheck ? 0 : 2)) / 2);
      const around = Math.min(1, progress * 2);
      this.attendant.root.position.set(progress < .5 ? 8.5 + around * .5 : 9 + (progress - .5) * 10,
        0, progress < .5 ? 15 - around * 7 : 8);
      this.attendant.root.rotation.y = Math.PI + progress * .7;
      this.pose(this.attendant, time * 1.6, progress);
    }
  }

  private release(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.textures.forEach(t => t.dispose()); this.skeletons.forEach(s => s.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  }
  dispose(): void { this.disposed = true; this.release(); this.root.removeFromParent(); }
}
