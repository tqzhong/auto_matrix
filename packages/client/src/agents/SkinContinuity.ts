import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

interface Join { point: THREE.Vector3; vertices: number[]; normal: THREE.Vector3 }
interface Patch { vertex: number; joins: number[]; weights: number[]; amount: number }
type SkinAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
type SkinBinding = {
  index: SkinAttribute; weight: SkinAttribute; indexVersion: number; weightVersion: number;
  indices?: ArrayLike<number>; weights?: ArrayLike<number>;
};
const attributeVersion = (attribute: SkinAttribute): number => attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.version : attribute.version;

/** Extend the delivered hand/neck normal field into a separate skin surface.
 * The source geometry, atlas, joint weights and authored contact stay intact. */
export class SkinContinuity {
  private hand: THREE.SkinnedMesh;
  private normal: THREE.BufferAttribute;
  private rest: Float32Array;
  private uploaded: Float32Array;
  private joins: Join[] = [];
  private patches: Patch[] = [];
  private ranges: { start: number; count: number }[] = [];
  private handFrames: THREE.Matrix3[];
  private bodyFrames: THREE.Matrix3[];
  private previous: number[] = [];
  private handNormal?: SkinAttribute;
  private handVersion = -1;
  private handBinding?: SkinBinding;
  private bodyBinding?: SkinBinding;
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
    // The extension has its own UV atlas and may have no vertex colors.
    // Copy its authored material rather than the differently attributed hand.
    const material = source.clone();
    material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
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
    this.uploaded = new Float32Array(this.patches.length * 3);
    this.handFrames = this.hand.skeleton.bones.map(() => new THREE.Matrix3());
    this.bodyFrames = this.body.skeleton.bones.map(() => new THREE.Matrix3());
  }

  private frames(mesh: THREE.SkinnedMesh, frames: THREE.Matrix3[]): void {
    const world = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    frames.forEach((frame, i) => {
      this.matrix.fromArray(mesh.skeleton.boneMatrices, i * 16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
      frame.setFromMatrix4(this.matrix).premultiply(world);
    });
  }

  private binding(mesh: THREE.SkinnedMesh, previous?: SkinBinding): SkinBinding {
    const { skinIndex: index, skinWeight: weight } = mesh.geometry.attributes;
    const indexVersion = attributeVersion(index), weightVersion = attributeVersion(weight);
    if (previous?.index === index && previous.weight === weight && previous.indexVersion === indexVersion && previous.weightVersion === weightVersion) return previous;
    const contiguous = index instanceof THREE.BufferAttribute && weight instanceof THREE.BufferAttribute && !index.normalized && !weight.normalized;
    return {
      index, weight, indexVersion, weightVersion,
      indices: contiguous ? index.array : undefined,
      weights: contiguous ? weight.array : undefined,
    };
  }

  private blend(binding: SkinBinding, frames: THREE.Matrix3[], vertex: number): THREE.Matrix3 {
    const { index, weight: attribute, indices, weights } = binding;
    const indexStart = vertex * index.itemSize, weightStart = vertex * attribute.itemSize;
    const values = this.linear.elements; values.fill(0);
    for (let k = 0; k < 4; k++) {
      const weight = weights ? weights[weightStart + k] : attribute.getComponent(vertex, k);
      if (weight === 0) continue;
      const frame = frames[indices ? indices[indexStart + k] : index.getComponent(vertex, k)].elements;
      for (let i = 0; i < 9; i++) values[i] += frame[i] * weight;
    }
    return this.linear;
  }

  private upload(): void {
    const normal = this.normal;
    normal.clearUpdateRanges();
    let offset = 0;
    for (const { start, count } of this.ranges) {
      normal.addUpdateRange(start, count);
      if (normal.normalized) {
        for (let i = 0; i < count; i++) {
          const component = start + i;
          this.uploaded[offset + i] = normal.getComponent(Math.floor(component / 3), component % 3);
        }
      } else this.uploaded.set(normal.array.subarray(start, start + count), offset);
      offset += count;
    }
    normal.needsUpdate = true;
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
    const handNormal = this.hand.geometry.getAttribute('normal'), handVersion = attributeVersion(handNormal);
    const handBinding = this.binding(this.hand, this.handBinding), bodyBinding = this.binding(this.body, this.bodyBinding);
    if (this.active && this.handNormal === handNormal && this.handVersion === handVersion && handBinding === this.handBinding
      && bodyBinding === this.bodyBinding && pose.length === this.previous.length && pose.every((v, i) => v === this.previous[i])) return;
    this.hand.skeleton.update();
    if (this.hand.skeleton !== this.body.skeleton) this.body.skeleton.update();
    this.frames(this.hand, this.handFrames); this.frames(this.body, this.bodyFrames);
    for (const join of this.joins) {
      join.normal.set(0, 0, 0);
      for (const vertex of join.vertices) join.normal.add(this.target.fromBufferAttribute(handNormal, vertex).applyMatrix3(this.blend(handBinding, this.handFrames, vertex)).normalize());
      join.normal.normalize();
    }
    let changed = !this.active && this.patches.length > 0, offset = 0;
    for (const patch of this.patches) {
      const vertex = patch.vertex, transform = this.blend(bodyBinding, this.bodyFrames, vertex);
      this.original.fromArray(this.rest, vertex * 3).applyMatrix3(transform).normalize();
      this.target.set(0, 0, 0);
      patch.joins.forEach((join, i) => this.target.addScaledVector(this.joins[join].normal, patch.weights[i]));
      this.target.normalize().multiplyScalar(patch.amount).addScaledVector(this.original, 1 - patch.amount).normalize().applyMatrix3(transform.invert()).normalize();
      const { x, y, z } = this.target;
      // Keep the CPU field exact for cold joins. Compare GPU updates to the last upload to bound accumulated error.
      changed ||= Math.abs(this.uploaded[offset] - x) > 1e-6 || Math.abs(this.uploaded[offset + 1] - y) > 1e-6
        || Math.abs(this.uploaded[offset + 2] - z) > 1e-6;
      normal.setXYZ(vertex, x, y, z); offset += 3;
    }
    if (changed) this.upload();
    this.active = true; this.previous = pose; this.handNormal = handNormal; this.handVersion = handVersion;
    this.handBinding = handBinding; this.bodyBinding = bodyBinding;
  }

  dispose(): void { this.body.geometry.dispose(); (this.body.material as THREE.Material).dispose(); }
}
