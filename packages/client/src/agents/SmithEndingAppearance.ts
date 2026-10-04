import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { smithEndingPose, type SmithFinaleEncounter } from '@auto_matrix/shared';
import { smithCodeSurface, smithCodeUniforms } from '../engine/SmithCodeSurface.js';
import type { HeroRig } from './HeroModel.js';

/** One shared-geometry Smith body replaces Neo after the skin coating closes. */
export class SmithEndingAppearance {
  readonly replica: THREE.Group;
  private replacementBones = new Map<string, THREE.Bone>();
  private neoCode = smithCodeUniforms();
  private smithCode = smithCodeUniforms();
  private replicaCode = smithCodeUniforms();
  private originals: { mesh: THREE.Mesh; material: THREE.Material; depth?: THREE.Material }[] = [];
  private materials = new Set<THREE.Material>();
  private skeletons = new Set<THREE.Skeleton>();
  private flares: { sprite: THREE.Sprite; role: 'neo' | 'smith'; local: THREE.Vector3 }[] = [];
  private glow: THREE.DataTexture;

  constructor(private neo: HeroRig, private smith: HeroRig) {
    this.replica = clone(smith.root) as THREE.Group; this.replica.name = 'smith-assimilated-neo';
    this.replica.traverse(object => {
      if (object instanceof THREE.Bone) this.replacementBones.set(object.name, object);
      if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
    });
    const glassesIndex = smith.bones.get('head')!.children.indexOf(smith.glasses);
    this.replacementBones.get('head')!.children[glassesIndex].visible = true;
    this.attach(this.replica, this.replicaCode, true);
    this.attach(neo.root, this.neoCode); this.attach(smith.root, this.smithCode);
    neo.root.parent!.add(this.replica);
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const radius = Math.hypot((x - 31.5) / 32, (y - 31.5) / 32), i = (y * 64 + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255; pixels[i + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 3);
    }
    this.glow = new THREE.DataTexture(pixels, 64, 64); this.glow.needsUpdate = true;
    for (const role of ['neo', 'smith'] as const) for (const point of [new THREE.Vector3(-.14, .1, .24), new THREE.Vector3(.14, .1, .24), new THREE.Vector3(0, -.17, .31)]) {
      const material = new THREE.SpriteMaterial({ map: this.glow, color: 0xe4f4ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(material); sprite.name = `smith-ending-${role}-inner-light`;
      (role === 'neo' ? neo : smith).root.parent!.add(sprite);
      this.materials.add(material); this.flares.push({ sprite, role, local: point });
    }
  }

  private attach(root: THREE.Group, code: ReturnType<typeof smithCodeUniforms>, replica = false): void {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const original = object.material, material = original.clone();
      material.onBeforeCompile = original.onBeforeCompile; material.customProgramCacheKey = original.customProgramCacheKey;
      this.originals.push({ mesh: object, material: original, depth: object.customDepthMaterial });
      smithCodeSurface(material, code, replica); object.material = material; this.materials.add(material);
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest });
      smithCodeSurface(depth, code, replica); object.customDepthMaterial = depth; this.materials.add(depth);
    });
  }

  update(encounter: SmithFinaleEncounter, firstPerson: boolean): void {
    const pose = smithEndingPose(encounter);
    const chest = this.neo.bones.get('chest')!.getWorldPosition(new THREE.Vector3());
    this.neoCode.smithOrigin.value.copy(chest); this.replicaCode.smithOrigin.value.copy(chest);
    this.smithCode.smithOrigin.value.copy(this.smith.bones.get('chest')!.getWorldPosition(new THREE.Vector3()));
    this.neoCode.smithCoating.value = pose.coating;
    this.neoCode.smithReplacement.value = this.replicaCode.smithReplacement.value = pose.replacement;
    this.replicaCode.smithCoating.value = pose.coating * (1 - pose.replacement);
    this.replicaCode.smithPulse.value = pose.neoPulse; this.replicaCode.smithErase.value = pose.neoErase;
    this.smithCode.smithPulse.value = pose.smithPulse; this.smithCode.smithErase.value = pose.smithErase;
    this.replica.visible = !firstPerson && pose.replacement > 0 && pose.neoErase < 1;
    this.replica.position.copy(this.neo.root.position); this.replica.quaternion.copy(this.neo.root.quaternion); this.replica.scale.copy(this.neo.root.scale);
    for (const [name, bone] of this.replacementBones) {
      const source = this.neo.bones.get(name); if (!source) continue;
      bone.position.copy(this.smith.rest.get(name)!); bone.quaternion.copy(source.quaternion);
      if (name === 'pelvis') bone.position.y += source.position.y - this.neo.rest.get(name)!.y;
    }
    this.replica.updateWorldMatrix(true, true);
    for (const { sprite, role, local } of this.flares) {
      const pulse = role === 'neo' ? pose.neoPulse : pose.smithPulse;
      const head = role === 'neo' ? this.replacementBones.get('head')! : this.smith.bones.get('head')!;
      sprite.visible = pulse > .001 && !(role === 'neo' && firstPerson);
      sprite.position.copy(sprite.parent!.worldToLocal(head.localToWorld(local.clone())));
      sprite.scale.setScalar(.22 + pulse * 1.7); (sprite.material as THREE.SpriteMaterial).opacity = pulse * .8;
    }
  }

  dispose(): void {
    this.replica.removeFromParent(); this.flares.forEach(({ sprite }) => sprite.removeFromParent());
    for (const item of this.originals) { item.mesh.material = item.material; item.mesh.customDepthMaterial = item.depth; }
    this.materials.forEach(material => material.dispose()); this.skeletons.forEach(skeleton => skeleton.dispose()); this.glow.dispose();
  }
}
