import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

interface Join { point: THREE.Vector3; vertices: number[]; normal: THREE.Vector3 }
interface Patch { vertex: number; joins: number[]; weights: number[]; amount: number }

/** Extend the delivered hand/neck normal field into a separate skin surface.
 * The source geometry, atlas, joint weights and authored contact stay intact. */
export class SkinContinuity {
  private hand: THREE.SkinnedMesh;
  private normal: THREE.BufferAttribute;
  private rest: Float32Array;
  private joins: Join[] = [];
  private patches: Patch[] = [];
  private ranges: { start: number; count: number }[] = [];
  private handFrames: THREE.Matrix3[];
  private bodyFrames: THREE.Matrix3[];
  private previous: number[] = [];
  private handNormal?: THREE.BufferAttribute;
  private handVersion = -1;
  private active = false;
  private matrix = new THREE.Matrix4();
  private linear = new THREE.Matrix3();
  private original = new THREE.Vector3();
  private target = new THREE.Vector3();
  private point = new THREE.Vector3();

  constructor(private rig: HeroRig, private body: THREE.SkinnedMesh) {
    this.hand = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    this.body.geometry = this.body.geometry.clone();
    this.normal = this.body.geometry.getAttribute('normal') as THREE.BufferAttribute;
    this.rest = new Float32Array(this.normal.array);
    const source = this.body.material as THREE.MeshStandardMaterial;
    const material = (this.hand.material as THREE.MeshPhysicalMaterial).clone();
    material.name = source.name; material.map = source.map; material.normalMap = source.normalMap; material.normalScale.copy(source.normalScale);
    material.bumpMap = source.bumpMap; material.bumpScale = source.bumpScale;
    material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
    material.color.copy(source.color); material.emissive.copy(source.emissive); material.emissiveIntensity = source.emissiveIntensity;
    material.roughness = source.roughness; material.metalness = source.metalness; material.side = source.side;
    this.body.material = material;
    const hp = this.hand.geometry.attributes.position, bp = this.body.geometry.attributes.position, groups = new Map<string, number[]>();
    const key = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => [a.getX(i), a.getY(i), a.getZ(i)].map(v => v.toFixed(5)).join(',');
    for (let i = 0; i < hp.count; i++) { const k = key(hp, i), group = groups.get(k) ?? []; group.push(i); groups.set(k, group); }
    const matched = new Set(Array.from({ length: bp.count }, (_, i) => key(bp, i)));
    for (const [k, vertices] of groups) if (matched.has(k)) this.joins.push({ point: new THREE.Vector3().fromBufferAttribute(hp, vertices[0]), vertices, normal: new THREE.Vector3() });
    for (let vertex = 0; vertex < bp.count; vertex++) {
      this.point.fromBufferAttribute(bp, vertex);
      const nearest: { join: number; distance: number }[] = [];
      this.joins.forEach((entry, join) => {
        const distance = entry.point.distanceToSquared(this.point), at = nearest.findIndex(item => item.distance > distance);
        if (at >= 0) nearest.splice(at, 0, { join, distance }); else if (nearest.length < 3) nearest.push({ join, distance });
        if (nearest.length > 3) nearest.pop();
      });
      if (nearest[0]?.distance < .1 ** 2) {
        const selected = nearest[0].distance < 1e-12 ? nearest.slice(0, 1) : nearest;
        const weights = selected.map(item => 1 / Math.max(item.distance, 1e-12)), total = weights.reduce((a, b) => a + b, 0);
        this.patches.push({ vertex, joins: selected.map(item => item.join), weights: weights.map(value => value / total), amount: 1 - THREE.MathUtils.smoothstep(Math.sqrt(nearest[0].distance), 0, .1) });
      }
    }
    for (const { vertex } of this.patches) {
      const last = this.ranges.at(-1);
      if (last && last.start + last.count === vertex * 3) last.count += 3;
      else this.ranges.push({ start: vertex * 3, count: 3 });
    }
    this.handFrames = this.hand.skeleton.bones.map(() => new THREE.Matrix3());
    this.bodyFrames = this.body.skeleton.bones.map(() => new THREE.Matrix3());
  }

  private frames(mesh: THREE.SkinnedMesh, frames: THREE.Matrix3[]): void {
    mesh.skeleton.update();
    const world = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    frames.forEach((frame, i) => {
      this.matrix.fromArray(mesh.skeleton.boneMatrices, i * 16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
      frame.setFromMatrix4(this.matrix).premultiply(world);
    });
  }

  private blend(mesh: THREE.SkinnedMesh, frames: THREE.Matrix3[], vertex: number): THREE.Matrix3 {
    const a = mesh.geometry.attributes, values = this.linear.elements; values.fill(0);
    for (let k = 0; k < 4; k++) {
      const frame = frames[a.skinIndex.getComponent(vertex, k)].elements, weight = a.skinWeight.getComponent(vertex, k);
      for (let i = 0; i < 9; i++) values[i] += frame[i] * weight;
    }
    return this.linear;
  }

  private upload(): void {
    const normal = this.normal;
    normal.clearUpdateRanges(); this.ranges.forEach(range => normal.addUpdateRange(range.start, range.count)); normal.needsUpdate = true;
  }

  update(): void {
    const normal = this.normal;
    if (!this.body.visible) {
      if (this.active) {
        for (const { vertex } of this.patches) normal.setXYZ(vertex, this.rest[vertex * 3], this.rest[vertex * 3 + 1], this.rest[vertex * 3 + 2]);
        this.upload(); this.active = false; this.previous = [];
      }
      return;
    }
    this.rig.root.updateWorldMatrix(true, true);
    const pose: number[] = [];
    this.rig.bones.forEach(bone => { pose.push(...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()); });
    pose.push(...this.rig.root.getWorldScale(this.point).toArray());
    const handNormal = this.hand.geometry.getAttribute('normal') as THREE.BufferAttribute;
    if (this.active && this.handNormal === handNormal && this.handVersion === handNormal.version && pose.length === this.previous.length && pose.every((v, i) => v === this.previous[i])) return;
    this.frames(this.hand, this.handFrames); this.frames(this.body, this.bodyFrames);
    for (const join of this.joins) {
      join.normal.set(0, 0, 0);
      for (const vertex of join.vertices) join.normal.add(this.target.fromBufferAttribute(handNormal, vertex).applyMatrix3(this.blend(this.hand, this.handFrames, vertex)).normalize());
      join.normal.normalize();
    }
    for (const patch of this.patches) {
      const vertex = patch.vertex, transform = this.blend(this.body, this.bodyFrames, vertex);
      this.original.fromArray(this.rest, vertex * 3).applyMatrix3(transform).normalize();
      this.target.set(0, 0, 0);
      patch.joins.forEach((join, i) => this.target.addScaledVector(this.joins[join].normal, patch.weights[i]));
      this.target.normalize().multiplyScalar(patch.amount).addScaledVector(this.original, 1 - patch.amount).normalize().applyMatrix3(transform.invert()).normalize();
      normal.setXYZ(vertex, this.target.x, this.target.y, this.target.z);
    }
    this.upload(); this.active = true; this.previous = pose; this.handNormal = handNormal; this.handVersion = handNormal.version;
  }

  dispose(): void { this.body.geometry.dispose(); (this.body.material as THREE.Material).dispose(); }
}
