import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

/** A rounded centreline keeps the inside sleeve from folding through itself. */
class ElbowArc {
  angle = 0;
  length = 1;
  private radius = .22;
  private straight = .5;
  private arc = 0;
  private before = new THREE.Vector3();
  private after = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private radial = new THREE.Vector3();
  private relative = new THREE.Vector3();
  private cross = new THREE.Vector3();
  private samplePoint = new THREE.Vector3();
  private sampleTangent = new THREE.Vector3();

  set(shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3): void {
    this.before.subVectors(elbow, shoulder).normalize(); this.after.subVectors(wrist, elbow).normalize();
    this.angle = this.before.angleTo(this.after); this.axis.crossVectors(this.before, this.after).normalize();
    this.radius = Math.min(.22, .49 / Math.max(1e-8, Math.tan(this.angle / 2)));
    const cut = this.radius * Math.tan(this.angle / 2);
    this.straight = .5 - cut; this.arc = this.radius * this.angle; this.length = this.straight * 2 + this.arc;
    this.start.copy(elbow).addScaledVector(this.before, -.5); this.end.copy(elbow).addScaledVector(this.after, cut);
    this.centre.copy(this.after).addScaledVector(this.before, -Math.cos(this.angle)).normalize().multiplyScalar(this.radius)
      .add(elbow).addScaledVector(this.before, -cut);
    this.radial.copy(elbow).addScaledVector(this.before, -cut).sub(this.centre);
  }

  sample(distance: number, centre: THREE.Vector3, tangent: THREE.Vector3): void {
    if (distance <= this.straight) { centre.copy(this.start).addScaledVector(this.before, distance); tangent.copy(this.before); return; }
    if (distance >= this.straight + this.arc) {
      centre.copy(this.end).addScaledVector(this.after, distance - this.straight - this.arc); tangent.copy(this.after); return;
    }
    const turn = (distance - this.straight) / this.radius;
    centre.copy(this.radial).applyAxisAngle(this.axis, turn).add(this.centre); tangent.copy(this.before).applyAxisAngle(this.axis, turn);
  }

  closest(point: THREE.Vector3): number {
    const first = THREE.MathUtils.clamp(this.relative.subVectors(point, this.start).dot(this.before), 0, this.straight);
    const last = THREE.MathUtils.clamp(this.relative.subVectors(point, this.end).dot(this.after), 0, this.straight);
    this.relative.subVectors(point, this.centre); this.relative.addScaledVector(this.axis, -this.relative.dot(this.axis));
    const turn = THREE.MathUtils.clamp(Math.atan2(this.axis.dot(this.cross.crossVectors(this.radial, this.relative)), this.radial.dot(this.relative)), 0, this.angle);
    let best = first, minimum = Infinity;
    for (const distance of [first, this.straight + turn * this.radius, this.straight + this.arc + last]) {
      this.sample(distance, this.samplePoint, this.sampleTangent);
      const squared = this.samplePoint.distanceToSquared(point); if (squared < minimum) { minimum = squared; best = distance; }
    }
    return best;
  }
}

interface Arm {
  shoulder: THREE.Bone; elbow: THREE.Bone; wrist: THREE.Bone; rest: ElbowArc; posed: ElbowArc;
  origin: THREE.Vector3; direction: THREE.Vector3; reference: THREE.Vector3; amount: number;
}
interface SleeveVertex { id: number; side: number; distance: number; normal: number; binormal: number; tangent: number; point: THREE.Vector3 }
interface Part {
  mesh: THREE.SkinnedMesh; original: Float32Array; originalNormals: Float32Array; vertices: SleeveVertex[];
  groups: Uint32Array; owners: Uint8Array; faces: number[]; posedVertices: number[]; normalVertices: number[];
  posed: Float64Array; normals: Float64Array; active: boolean;
}

/** Preserve the complete shirt and leather through elbow bending, using the
 * same rounded material coordinates for both layers and the original hand pose. */
export class AmbushSleeveBend {
  private arms: Arm[];
  private parts: Part[];
  private frames: { matrix: THREE.Matrix4; rotation: THREE.Quaternion }[];
  private inverse = new THREE.Matrix4();
  private skin = new THREE.Matrix4();
  private linear = new THREE.Matrix3();
  private quaternion = new THREE.Quaternion();
  private rotation = new THREE.Vector4();
  private point = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private tangent = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private binormal = new THREE.Vector3();
  private reference = new THREE.Vector3();
  private originalPoint = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private delta = new THREE.Vector3();
  private normalDelta = new THREE.Vector3();
  private shoulder = new THREE.Vector3();
  private elbow = new THREE.Vector3();
  private wrist = new THREE.Vector3();

  constructor(private rig: HeroRig, shirt: THREE.SkinnedMesh, private coat: THREE.SkinnedMesh) {
    const skeleton = coat.skeleton;
    const bind = (name: string) => new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[skeleton.bones.findIndex(bone => bone.name === name)].clone().invert()).applyMatrix4(coat.bindMatrixInverse);
    this.arms = ['R', 'L'].map(side => {
      const shoulder = bind('shoulder_' + side), elbow = bind('elbow_' + side), wrist = bind('wrist_' + side), rest = new ElbowArc(); rest.set(shoulder, elbow, wrist);
      const inverse = skeleton.boneInverses[skeleton.bones.findIndex(bone => bone.name === 'elbow_' + side)].clone().invert();
      return { shoulder: rig.bones.get('shoulder_' + side)!, elbow: rig.bones.get('elbow_' + side)!, wrist: rig.bones.get('wrist_' + side)!,
        rest, posed: new ElbowArc(), origin: elbow, reference: new THREE.Vector3(1, 0, 0).transformDirection(coat.bindMatrixInverse.clone().multiply(inverse)),
        direction: elbow.clone().sub(shoulder).normalize().add(wrist.clone().sub(elbow).normalize()).normalize(), amount: 0 };
    });
    this.frames = skeleton.bones.map(() => ({ matrix: new THREE.Matrix4(), rotation: new THREE.Quaternion() }));
    const names = skeleton.bones.map(bone => bone.name);
    this.parts = [shirt, coat].map(mesh => {
      const a = mesh.geometry.attributes, original = (a.position.array as Float32Array).slice(), originalNormals = (a.normal.array as Float32Array).slice(), vertices: SleeveVertex[] = [];
      const fit = mesh.morphTargetDictionary?.ambushShirtFit, sculpt = fit === undefined ? undefined : mesh.geometry.morphAttributes.position[fit];
      for (let id = 0; id < a.position.count; id++) {
        const weights = ['R', 'L'].map(side => [0, 1, 2, 3].reduce((sum, k) => sum +
          (new RegExp(`^(shoulder|elbow|wrist|forearm_twist)_${side}`).test(names[a.skinIndex.getComponent(id, k)]) ? a.skinWeight.getComponent(id, k) : 0), 0));
        const side = weights[0] > weights[1] ? 0 : 1, arm = this.arms[side]; if (weights[side] < .99) continue;
        const point = new THREE.Vector3().fromBufferAttribute(a.position, id); if (sculpt) point.add(new THREE.Vector3().fromBufferAttribute(sculpt, id));
        if (Math.abs(this.delta.subVectors(point, arm.origin).dot(arm.direction)) >= .5) continue;
        const distance = arm.rest.closest(point); arm.rest.sample(distance, this.centre, this.tangent);
        this.basis(this.tangent, arm.reference); this.delta.subVectors(point, this.centre);
        vertices.push({ id, side, distance, point, normal: this.delta.dot(this.normal), binormal: this.delta.dot(this.binormal), tangent: this.delta.dot(this.tangent) });
      }
      const groups = new Map<string, number>(), mapping = new Uint32Array(a.position.count);
      for (let id = 0; id < a.position.count; id++) {
        const key = [...original.subarray(id * 3, id * 3 + 3), ...originalNormals.subarray(id * 3, id * 3 + 3),
          ...[0, 1, 2, 3].map(k => a.skinIndex.getComponent(id, k)), ...[0, 1, 2, 3].map(k => a.skinWeight.getComponent(id, k)),
          ...(mesh.geometry.morphAttributes.position ?? []).flatMap(target => [0, 1, 2].map(axis => target.getComponent(id, axis)))].join(',');
        let group = groups.get(key); if (group === undefined) { group = groups.size; groups.set(key, group); } mapping[id] = group;
      }
      const owners = new Uint8Array(groups.size), owned = new Map(vertices.map(vertex => [vertex.id, 1 << vertex.side])), index = mesh.geometry.index!;
      for (let face = 0; face < index.count; face += 3) {
        const ids = [0, 1, 2].map(k => index.getX(face + k)), mask = ids.reduce((mask, id) => mask | (owned.get(id) ?? 0), 0);
        if (mask) for (const id of ids) owners[mapping[id]] |= mask;
      }
      const faces: number[] = [], posed = new Set<number>();
      for (let face = 0; face < index.count; face += 3) {
        const ids = [0, 1, 2].map(k => index.getX(face + k)); if (!ids.some(id => owners[mapping[id]])) continue;
        faces.push(...ids); for (const id of ids) posed.add(id);
      }
      const normalVertices = Array.from({ length: a.position.count }, (_, id) => id).filter(id => owners[mapping[id]]);
      return { mesh, original, originalNormals, vertices, groups: mapping, owners, faces, posedVertices: [...posed], normalVertices,
        posed: new Float64Array(original.length), normals: new Float64Array(groups.size * 3), active: false };
    });
  }

  private basis(tangent: THREE.Vector3, reference: THREE.Vector3): void {
    this.normal.copy(reference).addScaledVector(tangent, -reference.dot(tangent)).normalize(); this.binormal.crossVectors(tangent, this.normal).normalize();
  }

  private skinAt(mesh: THREE.SkinnedMesh, id: number, rotation = false): void {
    const a = mesh.geometry.attributes; this.skin.elements.fill(0); this.rotation.set(0, 0, 0, 0); let reference: THREE.Quaternion | undefined;
    for (let k = 0; k < 4; k++) {
      const weight = a.skinWeight.getComponent(id, k); if (!weight) continue;
      const frame = this.frames[a.skinIndex.getComponent(id, k)];
      for (let n = 0; n < 16; n++) this.skin.elements[n] += frame.matrix.elements[n] * weight;
      if (!rotation) continue;
      reference ??= frame.rotation; const amount = weight * (reference.dot(frame.rotation) < 0 ? -1 : 1), q = frame.rotation;
      this.rotation.x += q.x * amount; this.rotation.y += q.y * amount; this.rotation.z += q.z * amount; this.rotation.w += q.w * amount;
    }
    this.skin.elements[15] = 1;
    if (rotation) { this.rotation.normalize(); this.quaternion.set(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w); }
  }

  private restore(part: Part): void {
    if (!part.active) return;
    const a = part.mesh.geometry.attributes;
    for (const { id } of part.vertices) for (let axis = 0; axis < 3; axis++) a.position.setComponent(id, axis, part.original[id * 3 + axis]);
    for (const id of part.normalVertices) for (let axis = 0; axis < 3; axis++) a.normal.setComponent(id, axis, part.originalNormals[id * 3 + axis]);
    a.position.needsUpdate = a.normal.needsUpdate = true; part.active = false;
  }

  update(enabled: boolean): void {
    if (!enabled) { for (const part of this.parts) this.restore(part); return; }
    this.rig.root.updateMatrixWorld(true); this.inverse.copy(this.coat.matrixWorld).invert();
    for (const arm of this.arms) {
      this.shoulder.setFromMatrixPosition(arm.shoulder.matrixWorld).applyMatrix4(this.inverse);
      this.elbow.setFromMatrixPosition(arm.elbow.matrixWorld).applyMatrix4(this.inverse); this.wrist.setFromMatrixPosition(arm.wrist.matrixWorld).applyMatrix4(this.inverse);
      arm.posed.set(this.shoulder, this.elbow, this.wrist); arm.amount = THREE.MathUtils.smootherstep(arm.posed.angle, .35, 1.1);
    }
    if (!this.arms.some(arm => arm.amount > 0)) { for (const part of this.parts) this.restore(part); return; }
    const skeleton = this.coat.skeleton;
    this.frames.forEach((frame, id) => {
      frame.matrix.copy(this.coat.bindMatrixInverse).multiply(skeleton.bones[id].matrixWorld).multiply(skeleton.boneInverses[id]).multiply(this.coat.bindMatrix);
      frame.matrix.decompose(this.point, frame.rotation, this.delta);
    });
    for (const part of this.parts) {
      const a = part.mesh.geometry.attributes; let changed = false;
      for (const vertex of part.vertices) {
        const { id, side } = vertex, arm = this.arms[side]; this.delta.set(0, 0, 0);
        if (arm.amount > 0) {
          this.skinAt(part.mesh, id, true);
          const u = vertex.distance / arm.rest.length;
          arm.posed.sample(vertex.distance - (arm.rest.length - arm.posed.length) * THREE.MathUtils.smoothstep(u, 0, 1), this.centre, this.tangent);
          this.basis(this.tangent, this.reference.copy(arm.reference).applyQuaternion(this.quaternion));
          this.desired.copy(this.centre).addScaledVector(this.normal, vertex.normal).addScaledVector(this.binormal, vertex.binormal).addScaledVector(this.tangent, vertex.tangent);
          this.originalPoint.copy(vertex.point).applyMatrix4(this.skin);
          this.linear.setFromMatrix4(this.skin).invert(); this.delta.subVectors(this.desired, this.originalPoint).multiplyScalar(arm.amount).applyMatrix3(this.linear);
        }
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.fround(part.original[id * 3 + axis] + this.delta.getComponent(axis));
          changed ||= a.position.getComponent(id, axis) !== value; a.position.setComponent(id, axis, value);
        }
      }
      part.active = true; if (!changed) continue;
      a.position.needsUpdate = true; this.normals(part);
    }
  }

  private normals(part: Part): void {
    const geometry = part.mesh.geometry, a = geometry.attributes, influences = part.mesh.morphTargetInfluences!;
    for (const id of part.posedVertices) {
      this.point.fromBufferAttribute(a.position, id);
      for (const [target, attribute] of (geometry.morphAttributes.position ?? []).entries()) this.point.addScaledVector(this.delta.fromBufferAttribute(attribute, id), influences[target]);
      this.skinAt(part.mesh, id); this.point.applyMatrix4(this.skin).toArray(part.posed, id * 3);
    }
    part.normals.fill(0);
    for (let face = 0; face < part.faces.length; face += 3) {
      const i = part.faces[face] * 3, j = part.faces[face + 1] * 3, k = part.faces[face + 2] * 3;
      const ux = part.posed[j] - part.posed[i], uy = part.posed[j + 1] - part.posed[i + 1], uz = part.posed[j + 2] - part.posed[i + 2];
      const vx = part.posed[k] - part.posed[i], vy = part.posed[k + 1] - part.posed[i + 1], vz = part.posed[k + 2] - part.posed[i + 2];
      for (let n = 0; n < 3; n++) {
        const group = part.groups[part.faces[face + n]]; if (!part.owners[group]) continue;
        part.normals[group * 3] += uy * vz - uz * vy; part.normals[group * 3 + 1] += uz * vx - ux * vz; part.normals[group * 3 + 2] += ux * vy - uy * vx;
      }
    }
    for (const id of part.normalVertices) {
      const group = part.groups[id], mask = part.owners[group], amount = Math.max(mask & 1 ? this.arms[0].amount : 0, mask & 2 ? this.arms[1].amount : 0);
      if (amount === 0) { for (let axis = 0; axis < 3; axis++) a.normal.setComponent(id, axis, part.originalNormals[id * 3 + axis]); continue; }
      this.skinAt(part.mesh, id); this.linear.setFromMatrix4(this.skin);
      this.normal.fromArray(part.originalNormals, id * 3); this.normalDelta.set(0, 0, 0);
      for (const [target, attribute] of (geometry.morphAttributes.normal ?? []).entries()) this.normalDelta.addScaledVector(this.delta.fromBufferAttribute(attribute, id), influences[target]);
      this.normal.add(this.normalDelta).applyMatrix3(this.linear).normalize(); this.desired.fromArray(part.normals, group * 3).normalize();
      this.normal.lerp(this.desired, amount).normalize(); this.linear.invert();
      this.normal.applyMatrix3(this.linear).sub(this.normalDelta); a.normal.setXYZ(id, this.normal.x, this.normal.y, this.normal.z);
    }
    a.normal.needsUpdate = true;
  }
}
