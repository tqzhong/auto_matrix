import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { absorptionSmooth, type OracleAbsorptionGesture } from '@auto_matrix/shared';
import { smithCodeSurface, smithCodeUniforms } from '../engine/SmithCodeSurface.js';
import { reach } from './SpoonPerformance.js';
import type { CharacterRig } from './CharacterModel.js';
import type { HeroRig } from './HeroModel.js';

/** Coating follows the woman's real silhouette; the replacement uses the shipped Smith body. */
export class OracleSmithAppearance {
  readonly replica: THREE.Group;
  private bones = new Map<string, THREE.Bone>();
  private rest = new Map<string, THREE.Vector3>();
  private code = smithCodeUniforms();
  private replacement = smithCodeUniforms();
  private originals: { mesh: THREE.Mesh; material: THREE.Material; depth?: THREE.Material }[] = [];
  private materials = new Set<THREE.Material>();
  private skeletons = new Set<THREE.Skeleton>();
  private view: THREE.Object3D;
  constructor(private oracle: CharacterRig, private smith: HeroRig, parent: THREE.Scene) {
    this.replica = clone(smith.root) as THREE.Group; this.replica.name = 'smith-assimilated-oracle'; parent.add(this.replica);
    this.replica.traverse(object => { if (object instanceof THREE.Bone) { this.bones.set(object.name, object); this.rest.set(object.name, object.position.clone()); } if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton); });
    const head = this.bones.get('head')!; head.userData.cameraEye = new THREE.Vector3().copy(smith.bones.get('head')!.userData.cameraEye);
    this.view = oracle.root.parent ?? oracle.root; this.view.userData.oracleSmithHead = head;
    this.attach(oracle.detail, this.code); this.attach(this.replica, this.replacement, true); this.replica.visible = false;
  }
  private attach(root: THREE.Object3D, uniforms: ReturnType<typeof smithCodeUniforms>, replica = false): void {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const original = object.material, material = original.clone(); material.onBeforeCompile = original.onBeforeCompile; material.customProgramCacheKey = original.customProgramCacheKey;
      this.originals.push({ mesh: object, material: original, depth: object.customDepthMaterial });
      smithCodeSurface(material, uniforms, replica); object.material = material; this.materials.add(material);
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest });
      smithCodeSurface(depth, uniforms, replica); object.customDepthMaterial = depth; this.materials.add(depth);
    });
  }
  update(state: OracleAbsorptionGesture, firstPerson: boolean): void {
    const replacement = absorptionSmooth(state.coating, .66, 1);
    const center = new THREE.Box3().setFromObject(this.oracle.root.getObjectByName('oracle-daily-blouse')!).getCenter(new THREE.Vector3()); center.z += .3;
    this.code.smithOrigin.value.copy(center); this.replacement.smithOrigin.value.copy(center);
    this.code.smithCoating.value = state.coating; this.code.smithReplacement.value = this.replacement.smithReplacement.value = replacement;
    this.replacement.smithCoating.value = state.coating * (1 - replacement);
    this.replica.visible = !firstPerson && replacement > 0;
    this.replica.position.copy(this.oracle.root.getWorldPosition(new THREE.Vector3())); this.replica.quaternion.copy(this.oracle.root.getWorldQuaternion(new THREE.Quaternion()));
    this.replica.scale.copy(this.smith.root.getWorldScale(new THREE.Vector3()));
    for (const [name, bone] of this.bones) { bone.position.copy(this.rest.get(name)!); bone.quaternion.identity(); }
    const stand = state.phase === 'laughing' ? absorptionSmooth(state.elapsed, .2, 2.6) : state.phase === 'done' ? 1 : 0;
    const pelvis = this.bones.get('pelvis')!; pelvis.position.y = THREE.MathUtils.lerp(1.50, this.rest.get('pelvis')!.y, stand);
    this.bones.get('head')!.rotation.x = -(state.phase === 'laughing' ? .27 + Math.sin(state.elapsed * 5) * .025 : 0);
    this.replica.updateWorldMatrix(true, true);
    const orientation = this.replica.getWorldQuaternion(new THREE.Quaternion());
    for (const side of ['R','L']) {
      const sign = side === 'R' ? -1 : 1, upper = this.bones.get(`hip_${side}`)!, lower = this.bones.get(`knee_${side}`)!, ankle = this.bones.get(`ankle_${side}`)!;
      const point = this.replica.localToWorld(new THREE.Vector3(sign * .24, this.smith.footHeight + .025, 1.2 * (1 - stand)));
      reach(upper, lower, ankle.position, point, new THREE.Vector3(sign * .1, 0, 1).applyQuaternion(orientation));
      ankle.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
    }
    this.replica.updateWorldMatrix(true, true); this.skeletons.forEach(skeleton => skeleton.update());
  }
  dispose(): void {
    if (this.view.userData.oracleSmithHead === this.bones.get('head')) delete this.view.userData.oracleSmithHead;
    for (const item of this.originals) { item.mesh.material = item.material; item.mesh.customDepthMaterial = item.depth; }
    this.replica.removeFromParent(); this.materials.forEach(material => material.dispose()); this.skeletons.forEach(skeleton => skeleton.dispose());
  }
}
