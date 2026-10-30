import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import { HandCurve } from './HandCurve.js';

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

  update(force = false): void {
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
    if (!force && this.active && this.handNormal === handNormal && this.handVersion === handNormal.version && pose.length === this.previous.length && pose.every((v, i) => v === this.previous[i])) return;
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

interface SleeveCurveData { version: number; radius: Record<string, number>; fullSpan: number; fadeSpan: number }
interface SleevePoint {
  id: number; interval: number; u: number; s: number; amount: number;
  n: number; b: number; t: number; inverse: THREE.Matrix3;
}
interface SleeveArm {
  side: string; shoulder: THREE.Bone; elbow: THREE.Bone; wrist: THREE.Bone;
  rest: HandCurve; first: THREE.Vector3; normal: THREE.Vector3; lowerNormal: THREE.Vector3;
}
interface SleevePatch {
  arm: SleeveArm; points: SleevePoint[]; support: number[]; faces: number[][];
  posed: Map<number, THREE.Vector3>; groups: Map<number, number>; normals: THREE.Vector3[];
}
interface SleeveSurface {
  mesh: THREE.SkinnedMesh; position: THREE.BufferAttribute; normal: THREE.BufferAttribute;
  basePosition: Float32Array; baseNormal: Float32Array; patches: SleevePatch[]; owned: boolean;
}

/** One material-space bend for the sleeve and the forearm beneath it. */
export class ElbowSleeve {
  private surfaces: SleeveSurface[] = [];
  private active = false;

  constructor(private rig: HeroRig, private data: SleeveCurveData) {
    const jacket = rig.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
    const names = jacket.skeleton.bones.map(bone => bone.name);
    const arms = ['R', 'L'].map(side => {
      const ids = ['shoulder_', 'elbow_', 'wrist_'].map(name => names.indexOf(name + side));
      const inverse = jacket.skeleton.boneInverses[ids[0]];
      const points = ids.map(id => new THREE.Vector3().setFromMatrixPosition(jacket.skeleton.boneInverses[id].clone().invert()).applyMatrix4(inverse));
      const first = points[1].clone().sub(points[0]).normalize(), lower = points[2].clone().sub(points[1]).normalize();
      const normal = new THREE.Vector3(0, 0, 1).addScaledVector(first, -first.z).normalize();
      return { side, shoulder: rig.bones.get('shoulder_' + side)!, elbow: rig.bones.get('elbow_' + side)!, wrist: rig.bones.get('wrist_' + side)!,
        rest: new HandCurve(points, [data.radius[side]]), first, normal,
        lowerNormal: normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(first, lower)) };
    });
    for (const meshName of ['Fitted_leather_jacket', 'Anatomical_wrist_skin']) {
      const mesh = rig.root.getObjectByName(meshName) as THREE.SkinnedMesh, owned = mesh === jacket;
      // Wrist geometry is already private to SkinContinuity; keep its normal attribute.
      if (owned) mesh.geometry = mesh.geometry.clone();
      const { position, normal, skinIndex, skinWeight } = mesh.geometry.attributes;
      const basePosition = new Float32Array(position.array), baseNormal = new Float32Array(normal.array), index = mesh.geometry.index!;
      const patches = arms.map(arm => {
        const shoulder = mesh.skeleton.bones.indexOf(arm.shoulder), toRest = mesh.skeleton.boneInverses[shoulder].clone().multiply(mesh.bindMatrix);
        const family = new Set(mesh.skeleton.bones.flatMap((bone, i) => ['shoulder_', 'elbow_', 'wrist_'].some(prefix => bone.name === prefix + arm.side)
          || bone.name.startsWith('forearm_twist_' + arm.side + '_') || bone.name.startsWith('shoulder_support_' + arm.side + '_') ? [i] : []));
        const points: SleevePoint[] = [];
        for (let id = 0; id < position.count; id++) {
          const member = [0, 1, 2, 3].reduce((sum, k) => sum + (family.has(skinIndex.getComponent(id, k)) ? skinWeight.getComponent(id, k) : 0), 0);
          if (member < .999) continue;
          const point = new THREE.Vector3().fromBufferAttribute(position, id).applyMatrix4(toRest), s = arm.rest.closest(point);
          const amount = 1 - THREE.MathUtils.smoothstep(Math.abs(s - arm.rest.anchors[1]), data.fullSpan, data.fadeSpan);
          if (amount <= 0) continue;
          const sample = arm.rest.sample(s), n = arm.normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(arm.first, sample.t));
          const b = new THREE.Vector3().crossVectors(sample.t, n), delta = point.sub(sample.p), inner = delta.dot(sample.n);
          if (inner > 0 && sample.k > 1e-8) delta.addScaledVector(sample.n, -Math.log1p(-sample.k * inner) / sample.k - inner);
          const interval = s <= arm.rest.anchors[1] ? 1 : 2, u = (s - arm.rest.anchors[interval - 1]) / (arm.rest.anchors[interval] - arm.rest.anchors[interval - 1]);
          points.push({ id, interval, u, s, amount, n: delta.dot(n), b: delta.dot(b), t: delta.dot(sample.t), inverse: new THREE.Matrix3() });
        }
        const selected = new Set(points.map(p => p.id)), faces: number[][] = [];
        for (let i = 0; i < index.count; i += 3) {
          const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
          if (face.some(id => selected.has(id))) faces.push(face);
        }
        const support = [...new Set(faces.flat())], groups = new Map<number, number>(), keys = new Map<string, number>();
        for (const id of support) {
          const key = [...new THREE.Vector3().fromBufferAttribute(position, id).toArray(), ...new THREE.Vector3().fromBufferAttribute(normal, id).toArray()].map(v => v.toFixed(6)).join(',');
          if (!keys.has(key)) keys.set(key, keys.size); groups.set(id, keys.get(key)!);
        }
        return { arm, points, support, faces, posed: new Map(support.map(id => [id, new THREE.Vector3()])), groups, normals: Array.from({ length: keys.size }, () => new THREE.Vector3()) };
      });
      this.surfaces.push({ mesh, position: position as THREE.BufferAttribute, normal: normal as THREE.BufferAttribute, basePosition, baseNormal, patches, owned });
    }
  }

  update(enabled: boolean): boolean {
    const wasActive = this.active;
    if (!enabled && !wasActive) return false;
    this.rig.root.updateWorldMatrix(true, true);
    let changed = false;
    for (const surface of this.surfaces) {
      const { mesh, position, normal, basePosition, baseNormal } = surface;
      for (const patch of surface.patches) for (const p of patch.points) {
        position.setXYZ(p.id, basePosition[p.id * 3], basePosition[p.id * 3 + 1], basePosition[p.id * 3 + 2]);
        if (wasActive) normal.setXYZ(p.id, baseNormal[p.id * 3], baseNormal[p.id * 3 + 1], baseNormal[p.id * 3 + 2]);
      }
      if (enabled) {
        const frames = mesh.skeleton.bones.map((bone, i) => mesh.bindMatrixInverse.clone().multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix));
        for (const patch of surface.patches) {
          const { arm } = patch, inverse = arm.shoulder.matrixWorld.clone().invert(), toShoulder = inverse.clone().multiply(mesh.matrixWorld);
          const back = mesh.matrixWorld.clone().invert().multiply(arm.shoulder.matrixWorld), backLinear = new THREE.Matrix3().setFromMatrix4(back), backNormal = new THREE.Matrix3().getNormalMatrix(back);
          const points = [arm.shoulder, arm.elbow, arm.wrist].map(bone => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse));
          const lower = points[2].clone().sub(points[1]).normalize(), lowerNormal = arm.normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(arm.first, lower));
          const desired = arm.lowerNormal.clone().applyQuaternion(arm.elbow.quaternion), roll = Math.atan2(new THREE.Vector3().crossVectors(lowerNormal, desired).dot(lower), lowerNormal.dot(desired));
          const axis = arm.wrist.position.clone().normalize(), q = arm.wrist.quaternion;
          let wristRoll = 2 * Math.atan2(q.x * axis.x + q.y * axis.y + q.z * axis.z, q.w);
          if (wristRoll > Math.PI) wristRoll -= Math.PI * 2; if (wristRoll < -Math.PI) wristRoll += Math.PI * 2;
          if (arm.elbow.quaternion.angleTo(new THREE.Quaternion()) < 1e-8 && Math.abs(wristRoll) < 1e-8) continue;
          const curve = new HandCurve(points, [this.data.radius[arm.side]]);
          for (const id of patch.support) mesh.getVertexPosition(id, patch.posed.get(id)!).applyMatrix4(toShoulder);
          const sample = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), k: 0 }, n = new THREE.Vector3(), b = new THREE.Vector3(), offset = new THREE.Vector3(), goal = new THREE.Vector3();
          for (const p of patch.points) {
            curve.sample(THREE.MathUtils.lerp(curve.anchors[p.interval - 1], curve.anchors[p.interval], p.u), sample);
            const twist = roll * THREE.MathUtils.smoothstep(p.s, arm.rest.anchors[1] - .2, arm.rest.anchors[1] + .2)
              + wristRoll * THREE.MathUtils.smoothstep((p.s - arm.rest.anchors[1]) / (arm.rest.length - arm.rest.anchors[1]), .1, .95);
            n.copy(arm.normal).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(arm.first, sample.t)).applyAxisAngle(sample.t, twist); b.crossVectors(sample.t, n);
            offset.copy(n).multiplyScalar(p.n).addScaledVector(b, p.b).addScaledVector(sample.t, p.t);
            const inner = offset.dot(sample.n);
            if (inner > 0 && sample.k > 1e-8) offset.addScaledVector(sample.n, -Math.expm1(-sample.k * inner) / sample.k - inner);
            goal.copy(sample.p).add(offset).sub(patch.posed.get(p.id)!).multiplyScalar(p.amount).applyMatrix3(backLinear);
            const e = p.inverse.elements; e.fill(0);
            for (let k = 0; k < 4; k++) {
              const frame = frames[mesh.geometry.attributes.skinIndex.getComponent(p.id, k)].elements, weight = mesh.geometry.attributes.skinWeight.getComponent(p.id, k);
              for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) e[col * 3 + row] += frame[col * 4 + row] * weight;
            }
            goal.applyMatrix3(p.inverse.invert());
            position.setXYZ(p.id, basePosition[p.id * 3] + goal.x, basePosition[p.id * 3 + 1] + goal.y, basePosition[p.id * 3 + 2] + goal.z);
          }
          for (const id of patch.support) mesh.getVertexPosition(id, patch.posed.get(id)!).applyMatrix4(toShoulder);
          patch.normals.forEach(value => value.set(0, 0, 0));
          const ab = new THREE.Vector3(), ac = new THREE.Vector3(), faceNormal = new THREE.Vector3();
          for (const [a, b, c] of patch.faces) {
            ab.copy(patch.posed.get(b)!).sub(patch.posed.get(a)!); ac.copy(patch.posed.get(c)!).sub(patch.posed.get(a)!); faceNormal.crossVectors(ab, ac);
            for (const id of [a, b, c]) patch.normals[patch.groups.get(id)!].add(faceNormal);
          }
          for (const p of patch.points) {
            n.copy(patch.normals[patch.groups.get(p.id)!]).normalize().applyMatrix3(backNormal).applyMatrix3(p.inverse).normalize();
            // Preserve the authored normal field where the positional correction fades out.
            const original = new THREE.Vector3().fromArray(baseNormal, p.id * 3);
            n.lerp(original, 1 - p.amount).normalize(); normal.setXYZ(p.id, n.x, n.y, n.z);
          }
          changed = true;
        }
      }
      if (changed || wasActive) { position.needsUpdate = true; normal.needsUpdate = true; }
    }
    this.active = changed; return changed || wasActive;
  }

  dispose(): void { this.surfaces.filter(surface => surface.owned).forEach(surface => surface.mesh.geometry.dispose()); }
}
