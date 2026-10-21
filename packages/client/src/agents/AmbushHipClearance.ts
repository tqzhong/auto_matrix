import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

/** Keep the outer leather's thigh clearance in posed pelvis space. A lift
 * authored in mesh space alone can rotate backwards with the flexing hip. */
export class AmbushHipClearance {
  private original: Float32Array;
  private originalNormals: Float32Array;
  private attachments: { vertex: number; a: number; b: number; c: number; inset: number }[] = [];
  private base: Float64Array;
  private frame = new THREE.Matrix3();
  private shifts: Float64Array;
  private inverses: Float64Array;
  private vertices: number[];
  private normalVertices: number[];
  private posedVertices: number[];
  private faces: number[];
  private groups: Uint32Array;
  private affected: Uint8Array;
  private posed: Float64Array;
  private normals: Float64Array;
  private active = false;
  private inverse = new THREE.Matrix4();
  private skin = new THREE.Matrix4();
  private matrix = new THREE.Matrix4();
  private toPelvis = new THREE.Matrix4();
  private direction = new THREE.Vector3();
  private linear = new THREE.Matrix3();

  constructor(private rig: HeroRig, private mesh: THREE.SkinnedMesh, private targets: number[]) {
    const geometry = mesh.geometry, a = geometry.attributes;
    this.original = (a.position.array as Float32Array).slice(); this.originalNormals = (a.normal.array as Float32Array).slice();
    this.vertices = Array.from({ length: a.position.count }, (_, i) => i).filter(i => targets.slice(0, 2).some(target => {
      const delta = geometry.morphAttributes.position[target]; return delta.getX(i) !== 0 || delta.getY(i) !== 0 || delta.getZ(i) !== 0;
    }));
    const selected = new Set(this.vertices), index = geometry.index!, adjacent = new Map<number, number[][]>();
    for (let face = 0; face < index.count; face += 3) {
      const ids = [0, 1, 2].map(k => index.getX(face + k));
      for (const id of ids) { let faces = adjacent.get(id); if (!faces) adjacent.set(id, faces = []); faces.push(ids); }
    }
    const surface = (faces: number[][]) => {
      let best: number[] | undefined, maximum = 0;
      for (const ids of faces) {
        const a = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, ids[0]);
        const b = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, ids[1]).sub(a);
        const c = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, ids[2]).sub(a), normal = b.cross(c);
        const score = Math.hypot(normal.x, normal.z); if (score > maximum) { maximum = score; best = ids; }
      }
      return best;
    };
    // Transport the thin cap and inward return with the adjacent outer face,
    // including its normal. Independent point lifts can invert this tiny fold.
    const caps = new Set<number>();
    for (let face = 0; face < index.count; face += 3) {
      const ids = [0, 1, 2].map(k => index.getX(face + k));
      for (let k = 0; k < 3; k++) {
        const vertex = ids[k], left = ids[(k + 1) % 3], right = ids[(k + 2) % 3];
        if (a.normal.getY(vertex) > -.8 || Math.abs(a.normal.getY(left)) > .8 || Math.abs(a.normal.getY(right)) > .8) continue;
        if (![vertex, left, right].some(id => selected.has(id))) continue;
        const start = new THREE.Vector3().fromBufferAttribute(a.position, left), end = new THREE.Vector3().fromBufferAttribute(a.position, right);
        const point = new THREE.Vector3().fromBufferAttribute(a.position, vertex), line = new THREE.Line3(start, end);
        const amount = line.closestPointToPointParameter(point, true), distance = line.closestPointToPoint(point, true, new THREE.Vector3()).distanceTo(point);
        if (amount <= .05 || amount >= .95 || distance > start.distanceTo(end) * .08) continue;
        const outer = surface((adjacent.get(left) ?? []).filter(ids => ids.includes(right) && !ids.includes(vertex))); if (!outer) continue;
        this.attachments.push({ vertex, a: outer[0], b: outer[1], c: outer[2], inset: Math.max(.00001, distance * .1) }); caps.add(vertex); selected.add(vertex); for (const id of outer) selected.add(id);
      }
    }
    const hems = new Map<string, number[]>();
    for (let id = 0; id < a.position.count; id++) {
      const key = [a.uv.getX(id), a.uv.getY(id), ...[0, 1, 2, 3].map(k => a.skinIndex.getComponent(id, k)), ...[0, 1, 2, 3].map(k => a.skinWeight.getComponent(id, k))].join(',');
      let ids = hems.get(key); if (!ids) hems.set(key, ids = []); ids.push(id);
    }
    for (const ids of hems.values()) {
      const outer = ids.find(id => Math.abs(a.normal.getY(id)) < .8 && selected.has(id)); if (outer === undefined) continue;
      const face = surface(adjacent.get(outer) ?? []); if (!face) continue;
      for (const vertex of ids) if (a.normal.getY(vertex) < -.8 && !caps.has(vertex)) {
        this.attachments.push({ vertex, a: face[0], b: face[1], c: face[2], inset: .00001 }); selected.add(vertex); for (const id of face) selected.add(id);
      }
    }
    this.vertices = [...selected]; this.shifts = new Float64Array(this.original.length); this.base = new Float64Array(this.original.length); this.inverses = new Float64Array(this.vertices.length * 9);
    // Preserve intentional normal splits while sharing identical UV seam twins.
    const groups = new Map<string, number>(); this.groups = new Uint32Array(a.position.count);
    for (let i = 0; i < a.position.count; i++) {
      const key = [...this.original.subarray(i * 3, i * 3 + 3), ...this.originalNormals.subarray(i * 3, i * 3 + 3),
        ...[0, 1, 2, 3].map(k => a.skinIndex.getComponent(i, k)), ...[0, 1, 2, 3].map(k => a.skinWeight.getComponent(i, k)),
        ...targets.flatMap(target => [0, 1, 2].map(axis => geometry.morphAttributes.position[target].getComponent(i, axis)))].join(',');
      let group = groups.get(key); if (group === undefined) { group = groups.size; groups.set(key, group); } this.groups[i] = group;
    }
    this.affected = new Uint8Array(groups.size); const changed = new Set(this.vertices);
    for (let face = 0; face < index.count; face += 3) {
      const ids = [0, 1, 2].map(k => index.getX(face + k));
      if (ids.some(id => changed.has(id))) for (const id of ids) this.affected[this.groups[id]] = 1;
    }
    this.faces = []; const posed = new Set<number>();
    for (let face = 0; face < index.count; face += 3) {
      const ids = [0, 1, 2].map(k => index.getX(face + k));
      if (!ids.some(id => this.affected[this.groups[id]])) continue;
      this.faces.push(...ids); for (const id of ids) posed.add(id);
    }
    this.normalVertices = Array.from({ length: a.position.count }, (_, i) => i).filter(i => this.affected[this.groups[i]]);
    this.posedVertices = [...posed]; this.posed = new Float64Array(this.original.length); this.normals = new Float64Array(groups.size * 3);
  }

  update(crouch: number): void {
    const geometry = this.mesh.geometry, a = geometry.attributes, influences = this.mesh.morphTargetInfluences!;
    const amount = 1 - crouch;
    const active = amount > 0 && this.targets.slice(0, 2).some(target => influences[target] > 0);
    let changed = false;
    if (!active) {
      if (!this.active) return;
      for (const id of this.vertices) for (let axis = 0; axis < 3; axis++) a.position.setComponent(id, axis, this.original[id * 3 + axis]);
      for (const id of this.normalVertices) for (let axis = 0; axis < 3; axis++) a.normal.setComponent(id, axis, this.originalNormals[id * 3 + axis]);
      a.position.needsUpdate = a.normal.needsUpdate = true; this.active = false; return;
    }
    this.rig.root.updateMatrixWorld(true);
    this.inverse.copy(this.rig.bones.get('pelvis')!.matrixWorld).invert();
    this.toPelvis.copy(this.inverse).multiply(this.mesh.matrixWorld).multiply(this.mesh.bindMatrixInverse);
    // A deep front kick raises the trouser rim beyond the ordinary running
    // cut. Unfold the same cloth field smoothly at that larger hip flexion.
    const extra = ['R', 'L'].map(side => .75 * THREE.MathUtils.smoothstep(-this.rig.bones.get(`hip_${side}`)!.rotation.x, 1.27, 1.33));
    for (const [slot, id] of this.vertices.entries()) {
      this.direction.set(0, 0, 0);
      let liftX = 0, liftY = 0, liftZ = 0;
      for (let side = 0; side < 2; side++) {
        const target = this.targets[side], delta = geometry.morphAttributes.position[target], weight = influences[target];
        this.direction.x += delta.getX(id) * weight; this.direction.y += delta.getY(id) * weight; this.direction.z += delta.getZ(id) * weight;
        liftX += delta.getX(id) * weight * extra[side]; liftY += delta.getY(id) * weight * extra[side]; liftZ += delta.getZ(id) * weight * extra[side];
      }
      const x = this.direction.x, y = this.direction.y, z = this.direction.z;
      this.skin.elements.fill(0);
      for (let k = 0; k < 4; k++) {
        const weight = a.skinWeight.getComponent(id, k); if (!weight) continue;
        const joint = a.skinIndex.getComponent(id, k);
        this.matrix.multiplyMatrices(this.mesh.skeleton.bones[joint].matrixWorld, this.mesh.skeleton.boneInverses[joint]);
        for (let n = 0; n < 16; n++) this.skin.elements[n] += this.matrix.elements[n] * weight;
      }
      this.matrix.copy(this.toPelvis).multiply(this.skin).multiply(this.mesh.bindMatrix);
      const delta = this.direction.clone();
      this.direction.fromArray(this.original, id * 3);
      for (const target of this.targets) this.direction.addScaledVector(new THREE.Vector3().fromBufferAttribute(geometry.morphAttributes.position[target], id), influences[target]);
      this.direction.applyMatrix4(this.matrix).toArray(this.base, id * 3);
      this.linear.setFromMatrix4(this.matrix); this.direction.copy(delta).applyMatrix3(this.linear);
      this.shifts[id * 3] = amount * (x * 1.5 + liftX - this.direction.x);
      this.shifts[id * 3 + 1] = amount * (y * 1.5 + liftY - this.direction.y);
      this.shifts[id * 3 + 2] = amount * (z * 1.5 + liftZ - this.direction.z);
      this.linear.invert().toArray(this.inverses, slot * 9);
    }
    for (const attachment of this.attachments) {
      const a = new THREE.Vector3().fromArray(this.base, attachment.a * 3), b = new THREE.Vector3().fromArray(this.base, attachment.b * 3), c = new THREE.Vector3().fromArray(this.base, attachment.c * 3);
      const u = b.clone().sub(a), v = c.clone().sub(a), normal = u.clone().cross(v).normalize();
      this.frame.set(u.x, v.x, normal.x, u.y, v.y, normal.y, u.z, v.z, normal.z).invert();
      const point = new THREE.Vector3().fromArray(this.base, attachment.vertex * 3), local = point.clone().sub(a).applyMatrix3(this.frame);
      local.z = Math.min(local.z, -attachment.inset);
      a.add(new THREE.Vector3().fromArray(this.shifts, attachment.a * 3)); b.add(new THREE.Vector3().fromArray(this.shifts, attachment.b * 3)); c.add(new THREE.Vector3().fromArray(this.shifts, attachment.c * 3));
      u.copy(b).sub(a); v.copy(c).sub(a); normal.copy(u).cross(v).normalize();
      a.addScaledVector(u, local.x).addScaledVector(v, local.y).addScaledVector(normal, local.z).sub(point).toArray(this.shifts, attachment.vertex * 3);
    }
    for (const [slot, id] of this.vertices.entries()) {
      this.linear.fromArray(this.inverses, slot * 9); this.direction.fromArray(this.shifts, id * 3).applyMatrix3(this.linear);
      for (let axis = 0; axis < 3; axis++) {
        const value = Math.fround(this.original[id * 3 + axis] + this.direction.getComponent(axis));
        changed ||= a.position.getComponent(id, axis) !== value; a.position.setComponent(id, axis, value);
      }
    }
    this.active = true;
    if (!changed) return;
    a.position.needsUpdate = true;
    // Reconstruct the actual combined morph surface and compensate its base
    // normal so the shader's existing normal morphs produce that same surface.
    for (const id of this.posedVertices) for (let axis = 0; axis < 3; axis++) {
      let value = a.position.getComponent(id, axis);
      for (const target of this.targets) value += geometry.morphAttributes.position[target].getComponent(id, axis) * influences[target];
      this.posed[id * 3 + axis] = value;
    }
    this.normals.fill(0);
    for (let face = 0; face < this.faces.length; face += 3) {
      const i = this.faces[face] * 3, j = this.faces[face + 1] * 3, k = this.faces[face + 2] * 3;
      const ux = this.posed[j] - this.posed[i], uy = this.posed[j + 1] - this.posed[i + 1], uz = this.posed[j + 2] - this.posed[i + 2];
      const vx = this.posed[k] - this.posed[i], vy = this.posed[k + 1] - this.posed[i + 1], vz = this.posed[k + 2] - this.posed[i + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      for (let n = 0; n < 3; n++) {
        const group = this.groups[this.faces[face + n]]; if (!this.affected[group]) continue;
        this.normals[group * 3] += x; this.normals[group * 3 + 1] += y; this.normals[group * 3 + 2] += z;
      }
    }
    for (const id of this.normalVertices) {
      const group = this.groups[id] * 3, length = Math.hypot(this.normals[group], this.normals[group + 1], this.normals[group + 2]);
      if (length === 0) continue;
      for (let axis = 0; axis < 3; axis++) {
        let value = this.normals[group + axis] / length;
        for (const target of this.targets) value -= geometry.morphAttributes.normal[target].getComponent(id, axis) * influences[target];
        a.normal.setComponent(id, axis, value);
      }
    }
    a.normal.needsUpdate = true;
  }
}
