import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput, MotionState } from './CharacterMotion.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';

/** Fit Morpheus's ordinary coat around the actual posed lower garments. */
export class RegularCoatTails {
  private panels: { source: HeroRig['panels'][number]; work: Float64Array }[];
  private inner: { mesh: THREE.SkinnedMesh; vertices: Uint32Array; edges: Uint32Array; points: Float64Array; matrices: THREE.Matrix4[]; bands: Map<number, number[]>; visits: Uint32Array }[];
  private columns: number;
  private rows: number;
  private normals: number[] = [];
  private supports: Float64Array;
  private heights: Float64Array;
  private lastPose: Float64Array;
  private inverse = new THREE.Matrix4();
  private transform = new THREE.Matrix4();
  private point = new THREE.Vector3();
  private base = new THREE.Vector3();
  private weighted = new THREE.Vector3();
  private cloud: number[] = [];
  private order: number[] = [];
  private hull: number[] = [];
  private cloudCount = 0;
  private hullCount = 0;

  constructor(private rig: HeroRig) {
    const uv = rig.panels[0].mesh.geometry.attributes.uv;
    let columns = 0; while (columns < uv.count && uv.getY(columns) === 0) columns++;
    this.columns = columns; this.rows = uv.count / columns;
    this.panels = rig.panels.map(source => ({ source, work: new Float64Array(source.rest.length) }));
    const ring = this.panels.flatMap(({ source }, side) => Array.from({ length: columns }, (_, i) => {
      const column = side ? columns - 1 - i : i;
      return [source.rest[column * 3] + source.mesh.position.x, source.rest[column * 3 + 2] + source.mesh.position.z];
    }));
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], x = b[1] - a[1], z = a[0] - b[0], length = Math.hypot(x, z);
      this.normals.push(x / length, z / length);
    }
    this.supports = new Float64Array(ring.length); this.heights = new Float64Array(this.rows);
    this.inner = ['Tailored_trousers', 'Tailored_coat_upper', 'Black_crew_neck', 'shoes01'].map(name => {
      const mesh = rig.root.getObjectByName(name) as THREE.SkinnedMesh, a = mesh.geometry.attributes, index = mesh.geometry.index!;
      const selected: number[] = [], limit = rig.rest.get('pelvis')!.y + rig.panels[0].mesh.position.y + .2;
      const torso = (id: number) => [0, 1, 2, 3].reduce((sum, k) => sum + (/^(pelvis|spine|chest|hip_[LR])$/.test(mesh.skeleton.bones[a.skinIndex.getComponent(id, k)].name) ? a.skinWeight.getComponent(id, k) : 0), 0) > .8;
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        if (ids.some(id => a.position.getY(id) <= limit) && (name === 'Tailored_trousers' || name === 'shoes01' || ids.every(torso))) selected.push(...ids);
      }
      const vertices = [...new Set(selected)], remap = new Map(vertices.map((id, i) => [id, i])), edges: number[] = [], seen = new Set<number>();
      for (let i = 0; i < selected.length; i += 3) for (let k = 0; k < 3; k++) {
        const a = remap.get(selected[i + k])!, b = remap.get(selected[i + (k + 1) % 3])!, key = Math.min(a, b) * vertices.length + Math.max(a, b);
        if (!seen.has(key)) { seen.add(key); edges.push(a, b); }
      }
      return { mesh, vertices: Uint32Array.from(vertices), edges: Uint32Array.from(edges), points: new Float64Array(vertices.length * 3), matrices: mesh.skeleton.bones.map(() => new THREE.Matrix4()), bands: new Map<number, number[]>(), visits: new Uint32Array(edges.length / 2) };
    });
    this.lastPose = new Float64Array(3 + rig.bones.size * 16 + this.inner.length * 2 + this.panels.length * 2); this.lastPose.fill(NaN);
  }

  private collect(x: number, z: number): void {
    this.cloud[this.cloudCount * 2] = x; this.cloud[this.cloudCount * 2 + 1] = z; this.cloudCount++;
  }

  private cross(a: number, b: number, c: number): number {
    return (this.cloud[b * 2] - this.cloud[a * 2]) * (this.cloud[c * 2 + 1] - this.cloud[a * 2 + 1])
      - (this.cloud[b * 2 + 1] - this.cloud[a * 2 + 1]) * (this.cloud[c * 2] - this.cloud[a * 2]);
  }

  private extendHull(a: number, b: number, start: number, end: number): void {
    let farthest = -1, maximum = 0;
    for (let i = start; i < end; i++) {
      const distance = this.cross(a, b, this.order[i]);
      if (distance > maximum) { maximum = distance; farthest = this.order[i]; }
    }
    if (farthest < 0) return;
    let middle = start;
    for (let i = start; i < end; i++) if (this.cross(a, farthest, this.order[i]) > 0) {
      const value = this.order[middle]; this.order[middle++] = this.order[i]; this.order[i] = value;
    }
    let right = middle;
    for (let i = middle; i < end; i++) if (this.cross(farthest, b, this.order[i]) > 0) {
      const value = this.order[right]; this.order[right++] = this.order[i]; this.order[i] = value;
    }
    this.extendHull(a, farthest, start, middle); this.hull[this.hullCount++] = farthest;
    this.extendHull(farthest, b, middle, right);
  }

  private containHull(clearance: number): void {
    // Interior and repeated triangle-cut points cannot change a support
    // maximum. Partition their convex hull without sorting every cut point.
    if (!this.cloudCount) return;
    let left = 0, right = 0;
    for (let i = 0; i < this.cloudCount; i++) {
      this.order[i] = i;
      if (this.cloud[i * 2] < this.cloud[left * 2] || this.cloud[i * 2] === this.cloud[left * 2] && this.cloud[i * 2 + 1] < this.cloud[left * 2 + 1]) left = i;
      if (this.cloud[i * 2] > this.cloud[right * 2] || this.cloud[i * 2] === this.cloud[right * 2] && this.cloud[i * 2 + 1] > this.cloud[right * 2 + 1]) right = i;
    }
    this.hullCount = 1; this.hull[0] = left;
    this.extendHull(left, right, 0, this.cloudCount); this.hull[this.hullCount++] = right;
    this.extendHull(right, left, 0, this.cloudCount);
    const size = this.hullCount;
    for (let i = 0; i < size; i++) {
      const x = this.cloud[this.hull[i] * 2], z = this.cloud[this.hull[i] * 2 + 1];
      // Leave room for the triangles joining radial samples, not just their
      // vertices: a straight cloth edge cuts slightly inside a curved calf.
      for (let k = 0; k < this.supports.length; k++) this.supports[k] = Math.max(this.supports[k], x * this.normals[k * 2] + z * this.normals[k * 2 + 1] + clearance);
    }
  }


  relaxedArmOffset(input: MotionInput, motion: MotionState): number {
    if (input.realWorld || input.ambushWardrobe || input.armed || input.performance || input.training || input.climbing !== undefined
      || input.phone || input.pills || input.meeting || input.interlude || input.welcome || input.wakeCall || input.knock !== undefined
      || input.seated || input.floorSeated || !this.panels.some(({ source }) => source.mesh.visible)) return 0;
    const relaxed = THREE.MathUtils.smoothstep(motion.attackAge, 1, 1.3) * THREE.MathUtils.smoothstep(motion.skillAge, 1, 1.3)
      * THREE.MathUtils.smoothstep(motion.hitAge, .3, .5) * (1 - motion.airborne) * (1 - motion.seated);
    // Keep the relaxed swing outside the moving coat. The contact gestures
    // above keep their authored arm poses.
    return (.15 * THREE.MathUtils.smoothstep(motion.speed, 0, PLAYER_WALK_SPEED)
      + .055 * THREE.MathUtils.smoothstep(motion.speed, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED)) * relaxed;
  }

  update(motion: MotionState, coat: number): boolean {
    if (!this.panels.some(({ source }) => source.mesh.visible)) { this.lastPose.fill(NaN); return false; }
    this.rig.root.updateMatrixWorld(true);
    let changed = false, offset = 0;
    const check = (value: number) => { changed ||= this.lastPose[offset] !== value; this.lastPose[offset++] = value; };
    check(motion.time); check(motion.phase); check(coat);
    for (const part of this.inner) { check(part.mesh.geometry.id); check(Number(part.mesh.visible)); }
    for (const bone of this.rig.bones.values()) for (const value of bone.matrixWorld.elements) check(value);
    for (const { source } of this.panels) { check(source.mesh.geometry.id); check((source.mesh.geometry.attributes.position as THREE.BufferAttribute).version); }
    if (!changed) return true;
    const pelvis = this.rig.bones.get('pelvis')!;
    this.inverse.copy(pelvis.matrixWorld).invert();
    for (const part of this.inner) {
      if (!part.mesh.visible || !part.vertices.length) continue;
      const { mesh, matrices } = part, { skinIndex, skinWeight } = mesh.geometry.attributes;
      this.transform.copy(this.inverse).multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
      matrices.forEach((matrix, i) => matrix.multiplyMatrices(mesh.skeleton.bones[i].matrixWorld, mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix));
      for (let i = 0; i < part.vertices.length; i++) {
        const id = part.vertices[i]; THREE.Mesh.prototype.getVertexPosition.call(mesh, id, this.base); this.point.set(0, 0, 0);
        for (let joint = 0; joint < 4; joint++) {
          const weight = skinWeight.getComponent(id, joint);
          if (weight) this.point.addScaledVector(this.weighted.copy(this.base).applyMatrix4(matrices[skinIndex.getComponent(id, joint)]), weight);
        }
        this.point.applyMatrix4(this.transform).toArray(part.points, i * 3);
      }
      for (const band of part.bands.values()) band.length = 0;
      part.visits.fill(0);
      for (let edge = 0; edge < part.edges.length; edge += 2) {
        const a = part.points[part.edges[edge] * 3 + 1], b = part.points[part.edges[edge + 1] * 3 + 1];
        for (let key = Math.floor(Math.min(a, b) * 10); key <= Math.floor(Math.max(a, b) * 10); key++) {
          let band = part.bands.get(key); if (!band) part.bands.set(key, band = []);
          band.push(edge);
        }
      }
    }
    // Motion time and the current skeleton define the whole drape. A cold
    // restore needs no unsaved spring velocity or warm-up frames.
    for (const { source, work } of this.panels) for (let i = 0; i < source.rest.length / 3; i++) {
      const x = source.rest[i * 3], y = source.rest[i * 3 + 1], z = source.rest[i * 3 + 2], t = Math.max(0, -y / 1.97), flare = coat * t * t;
      work[i * 3] = x * (1 + flare * .24) + Math.sin(motion.time * 5 + y * 3) * flare * .035 + source.mesh.position.x;
      work[i * 3 + 1] = y + flare * .18 + source.mesh.position.y;
      work[i * 3 + 2] = z - flare * .65 + Math.sin(motion.phase * Math.PI * 2 + y * 3 + x * 3) * flare * .09 + source.mesh.position.z;
    }
    for (let row = 0; row < this.rows; row++) this.heights[row] = this.panels[0].work[row * this.columns * 3 + 1];
    const contain = (x: number, z: number, clearance: number) => {
      for (let k = 0; k < this.supports.length; k++) this.supports[k] = Math.max(this.supports[k], x * this.normals[k * 2] + z * this.normals[k * 2 + 1] + clearance);
    };
    for (let row = 0; row < this.rows; row++) {
      const low = this.heights[Math.min(this.rows - 1, row + 1)], high = this.heights[Math.max(0, row - 1)];
      const clearance = .01 + .02 * THREE.MathUtils.smoothstep(row, 0, 8) + .04 * THREE.MathUtils.smoothstep(row, 8, 24);
      this.supports.fill(-Infinity);
      for (const { work } of this.panels) for (let column = 0; column < this.columns; column++) {
        const i = (row * this.columns + column) * 3; contain(work[i], work[i + 2], .001);
      }
      this.cloudCount = 0;
      for (const part of this.inner) {
        if (!part.mesh.visible) continue;
        for (let i = 0; i < part.points.length; i += 3) {
          const y = part.points[i + 1], proximity = 1 - THREE.MathUtils.smoothstep(Math.max(low - y, y - high, 0), 0, .35);
          if (proximity > 0) this.collect(part.points[i] * proximity, part.points[i + 2] * proximity);
        }
        // Exact edge cuts retain triangles whose vertices lie outside this
        // slab. Adjacent rows share the slab so their joining faces also clear it.
        for (let key = Math.floor(low * 10); key <= Math.floor(high * 10); key++) for (const edge of part.bands.get(key) ?? []) {
          if (part.visits[edge / 2] === row + 1) continue;
          part.visits[edge / 2] = row + 1;
          const a = part.edges[edge] * 3, b = part.edges[edge + 1] * 3, y = part.points[a + 1], ny = part.points[b + 1];
          for (let bound = 0; bound < 2; bound++) {
            const height = bound ? high : low;
            if ((y - height) * (ny - height) < 0) {
              const t = (height - y) / (ny - y);
              this.collect(part.points[a] + (part.points[b] - part.points[a]) * t, part.points[a + 2] + (part.points[b + 2] - part.points[a + 2]) * t);
            }
          }
        }
      }
      this.containHull(clearance);
      // Stable angular columns preserve a smooth leading edge as the knee
      // moves. Clearance also covers the faces between neighboring columns.
      for (const { source, work } of this.panels) for (let column = 0; column < this.columns; column++) {
        const i = (row * this.columns + column) * 3, x = source.rest[i] + source.mesh.position.x, z = source.rest[i + 2] + source.mesh.position.z, length = Math.hypot(x, z);
        let radius = Infinity;
        for (let k = 0; k < this.supports.length; k++) {
          const dot = x / length * this.normals[k * 2] + z / length * this.normals[k * 2 + 1];
          if (dot > 1e-8) radius = Math.min(radius, this.supports[k] / dot);
        }
        work[i] = x / length * radius - source.mesh.position.x; work[i + 1] -= source.mesh.position.y; work[i + 2] = z / length * radius - source.mesh.position.z;
      }
    }
    for (const { source, work } of this.panels) {
      const position = source.mesh.geometry.attributes.position; let changed = false;
      for (let i = 0; i < work.length; i++) { const value = Math.fround(work[i]); changed ||= position.array[i] !== value; position.array[i] = value; source.velocity[i] = 0; }
      if (changed) { position.needsUpdate = true; source.mesh.geometry.computeVertexNormals(); source.mesh.geometry.computeBoundingBox(); source.mesh.geometry.computeBoundingSphere(); source.mesh.geometry.boundingSphere!.radius += 1e-6; }
    }
    offset = this.lastPose.length - this.panels.length * 2;
    for (const { source } of this.panels) { this.lastPose[offset++] = source.mesh.geometry.id; this.lastPose[offset++] = (source.mesh.geometry.attributes.position as THREE.BufferAttribute).version; }
    return true;
  }
}
