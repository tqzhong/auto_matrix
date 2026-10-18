import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionState } from './CharacterMotion.js';

type TailPanel = HeroRig['panels'][number] & { work: Float64Array };

/** Wrap the old-building tails around the actual posed lower clothes.
 * Shared horizontal support planes keep adjacent rows outside the same body
 * slab; vertex-only capsule pushes can leave their intervening faces inside. */
export class AmbushCoatTails {
  private panels: TailPanel[];
  private ring: { panel: TailPanel; column: number }[];
  private columns: number;
  private rows: number;
  private normals: number[] = [];
  private supports: Float64Array;
  private low: Float64Array;
  private high: Float64Array;
  private outline: Float64Array;
  private boundary = Array.from({ length: 44 }, () => new THREE.Vector2());
  private lengths = new Float64Array(44);
  private inner: { mesh: THREE.SkinnedMesh; points: Float64Array; vertices: Uint32Array; index: Uint32Array; ranges: Float64Array }[];
  private cloud: number[] = [];
  private order: number[] = [];
  private hull: number[] = [];
  private cloudCount = 0;
  private hullCount = 0;
  private inverse = new THREE.Matrix4();
  private transform = new THREE.Matrix4();
  private point = new THREE.Vector3();

  constructor(private rig: HeroRig, meshes: THREE.SkinnedMesh[]) {
    this.panels = rig.panels.map(panel => ({ ...panel, work: new Float64Array(panel.rest.length) }));
    const uv = this.panels[0].mesh.geometry.attributes.uv;
    let columns = 0; while (columns < uv.count && uv.getY(columns) === 0) columns++;
    this.columns = columns; this.rows = uv.count / columns;
    this.ring = this.panels.flatMap((panel, side) => Array.from({ length: columns }, (_, i) => ({ panel, column: side ? columns - 1 - i : i })));
    const points = this.ring.map(({ panel, column }) => [panel.rest[column * 3] + panel.mesh.position.x, panel.rest[column * 3 + 2] + panel.mesh.position.z]);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], x = b[1] - a[1], z = a[0] - b[0], length = Math.hypot(x, z);
      this.normals.push(x / length, z / length);
    }
    this.supports = new Float64Array(points.length); this.low = new Float64Array(this.rows); this.high = new Float64Array(this.rows);
    this.outline = new Float64Array(points.length * 2);
    this.inner = meshes.map(mesh => {
      const a = mesh.geometry.attributes, source = mesh.geometry.index!, selected: number[] = [];
      const coat = mesh.name === 'morpheus-ambush-coat';
      const seam = rig.rest.get('pelvis')!.y + this.panels[0].mesh.position.y
        + Math.abs(this.panels[0].rest[this.columns * 3 + 1] - this.panels[0].rest[1]);
      // Sleeves are outside this skirt. Including their horizontal projection
      // would spread the waist all the way to the wrists.
      const torso = (i: number) => [0, 1, 2, 3].reduce((sum, k) => sum + (/^(pelvis|spine|chest|hip_[LR])$/.test(mesh.skeleton.bones[a.skinIndex.getComponent(i, k)].name) ? a.skinWeight.getComponent(i, k) : 0), 0) > .8;
      for (let i = 0; i < source.count; i += 3) {
        const ids = [0, 1, 2].map(k => source.getX(i + k));
        if ((!coat && mesh.name !== 'morpheus-ambush-shirt' || ids.every(torso))
          && (!coat || ids.some(id => a.position.getY(id) <= seam))) selected.push(...ids);
      }
      // The generated upper coat repeats vertices per face. Identical bind
      // positions and weights need one CPU skin evaluation. Every selected
      // waist triangle stays in the cache; the rendered faces stay intact.
      const vertices: number[] = [], remap = new Map<number, number>(), welded = new Map<string, number>();
      const index = selected.map(id => {
        const existing = remap.get(id); if (existing !== undefined) return existing;
        const key = coat ? [a.position.getX(id), a.position.getY(id), a.position.getZ(id),
          ...[0, 1, 2, 3].map(k => a.skinIndex.getComponent(id, k)), ...[0, 1, 2, 3].map(k => a.skinWeight.getComponent(id, k))].join(',') : '';
        let local = coat ? welded.get(key) : undefined;
        if (local === undefined) { local = vertices.length; vertices.push(id); if (coat) welded.set(key, local); }
        remap.set(id, local); return local;
      });
      return { mesh, points: new Float64Array(vertices.length * 3), vertices: Uint32Array.from(vertices),
        index: Uint32Array.from(index), ranges: new Float64Array(selected.length / 3 * 2) };
    });
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

  private containHull(): void {
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
      for (let k = 0; k < this.supports.length; k++) this.supports[k] = Math.max(this.supports[k], x * this.normals[k * 2] + z * this.normals[k * 2 + 1] + .018);
    }
  }


  update(motion: MotionState, coat: number): void {
    // The saved motion clock is the entire wind state. A fresh model and a
    // paused frame therefore reconstruct the same surface without settling.
    for (const panel of this.panels) for (let i = 0; i < panel.rest.length / 3; i++) {
      const x = panel.rest[i * 3], y = panel.rest[i * 3 + 1], z = panel.rest[i * 3 + 2], t = Math.max(0, -y / 1.97), flare = coat * t * t;
      panel.work[i * 3] = x * (1 + flare * .24) + Math.sin(motion.time * 5 + y * 3) * flare * .035 + panel.mesh.position.x;
      panel.work[i * 3 + 1] = y + flare * .18 + panel.mesh.position.y;
      panel.work[i * 3 + 2] = z - flare * .65 + Math.sin(motion.phase * Math.PI * 2 + y * 3 + x * 3) * flare * .09 + panel.mesh.position.z;
    }
    this.inverse.copy(this.rig.bones.get('pelvis')!.matrixWorld).invert();
    for (const part of this.inner) {
      part.mesh.skeleton.update(); this.transform.multiplyMatrices(this.inverse, part.mesh.matrixWorld);
      for (let i = 0; i < part.vertices.length; i++) {
        part.mesh.getVertexPosition(part.vertices[i], this.point).applyMatrix4(this.transform); this.point.toArray(part.points, i * 3);
      }
      for (let i = 0; i < part.index.length; i += 3) {
        const a = part.points[part.index[i] * 3 + 1], b = part.points[part.index[i + 1] * 3 + 1], c = part.points[part.index[i + 2] * 3 + 1];
        part.ranges[i / 3 * 2] = Math.min(a, b, c); part.ranges[i / 3 * 2 + 1] = Math.max(a, b, c);
      }
    }
    for (let row = 0; row < this.rows; row++) {
      this.low[row] = Infinity; this.high[row] = -Infinity;
      for (const { panel, column } of this.ring) {
        const y = panel.work[(row * this.columns + column) * 3 + 1];
        this.low[row] = Math.min(this.low[row], y); this.high[row] = Math.max(this.high[row], y);
      }
    }
    for (let row = 0; row < this.rows; row++) {
      const previous = Math.max(0, row - 1), next = Math.min(this.rows - 1, row + 1);
      const low = Math.min(this.low[row], this.low[previous], this.low[next]), high = Math.max(this.high[row], this.high[previous], this.high[next]);
      this.supports.fill(-Infinity);
      // A small rounded source outline keeps successive columns distinct
      // when a concave corrugation would share a single support vertex.
      for (const { panel, column } of this.ring) {
        const id = (row * this.columns + column) * 3, x = panel.work[id], z = panel.work[id + 2];
        for (let k = 0; k < this.supports.length; k++) this.supports[k] = Math.max(this.supports[k], x * this.normals[k * 2] + z * this.normals[k * 2 + 1] + .001);
      }
      const front = this.supports[this.supports.length - 1];
      this.cloudCount = 0;
      for (const part of this.inner) for (let f = 0; f < part.index.length / 3; f++) {
        if (part.ranges[f * 2] > high || part.ranges[f * 2 + 1] < low) continue;
        const ia = part.index[f * 3] * 3, ib = part.index[f * 3 + 1] * 3, ic = part.index[f * 3 + 2] * 3;
        const ax = part.points[ia], ay = part.points[ia + 1], az = part.points[ia + 2];
        const bx = part.points[ib], by = part.points[ib + 1], bz = part.points[ib + 2];
        const cx = part.points[ic], cy = part.points[ic + 1], cz = part.points[ic + 2];
        if (Math.min(az, bz, cz) > front) continue;
        // A clipped triangle's extrema are retained vertices, edge cuts,
        // and intersections with both a height plane and the front plane.
        for (let j = 0; j < 3; j++) {
          const id = part.index[f * 3 + j] * 3, next = part.index[f * 3 + (j + 1) % 3] * 3;
          const x = part.points[id], y = part.points[id + 1], z = part.points[id + 2];
          const nx = part.points[next], ny = part.points[next + 1], nz = part.points[next + 2];
          if (y >= low && y <= high && z <= front) this.collect(x, z);
          for (let bound = 0; bound < 2; bound++) {
            const height = bound ? high : low;
            if ((y - height) * (ny - height) < 0) {
              const t = (height - y) / (ny - y), cut = z + (nz - z) * t;
              if (cut <= front) this.collect(x + (nx - x) * t, cut);
            }
          }
          if ((z - front) * (nz - front) < 0) {
            const t = (front - z) / (nz - z), cut = y + (ny - y) * t;
            if (cut >= low && cut <= high) this.collect(x + (nx - x) * t, front);
          }
        }
        const determinant = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        if (determinant !== 0) for (let bound = 0; bound < 2; bound++) {
          const height = bound ? high : low;
          const u = ((height - ay) * (cz - az) - (front - az) * (cy - ay)) / determinant;
          const v = ((by - ay) * (front - az) - (bz - az) * (height - ay)) / determinant;
          if (u >= 0 && v >= 0 && u + v <= 1) this.collect(ax + u * (bx - ax) + v * (cx - ax), front);
        }
      }
      this.containHull();
      for (let i = 0; i < this.ring.length; i++) {
        const previous = (i + this.ring.length - 1) % this.ring.length;
        const a = this.normals[previous * 2], b = this.normals[previous * 2 + 1], c = this.normals[i * 2], d = this.normals[i * 2 + 1], determinant = a * d - b * c;
        this.outline[i * 2] = (this.supports[previous] * d - b * this.supports[i]) / determinant;
        this.outline[i * 2 + 1] = (a * this.supports[i] - this.supports[previous] * c) / determinant;
      }
      // Keep each side/back column on its shared support plane across rows.
      // Only the cut's leading columns need redistribution; redistributing
      // the whole ring twists otherwise clear waist faces into the trousers.
      for (const [side, panel] of this.panels.entries()) {
        const at = (column: number) => (side ? this.ring.length - 1 - column : column) * 2;
        let first = 0;
        while (first < this.columns - 1 && this.outline[at(first) + 1] > front) first++;
        const anchor = first ? Math.min(this.columns - 1, first + 2) : 0;
        let count = 0;
        const append = (x: number, z: number) => {
          if (count && Math.hypot(x - this.boundary[count - 1].x, z - this.boundary[count - 1].y) < 1e-9) return;
          this.boundary[count++].set(x, z);
        };
        if (first) {
          const before = at(first - 1), after = at(first), t = (front - this.outline[before + 1]) / (this.outline[after + 1] - this.outline[before + 1]);
          append(THREE.MathUtils.lerp(this.outline[before], this.outline[after], t), front);
          for (let column = first; column <= anchor; column++) append(this.outline[at(column)], this.outline[at(column) + 1]);
          this.lengths[0] = 0;
          for (let i = 1; i < count; i++) this.lengths[i] = this.lengths[i - 1] + this.boundary[i].distanceTo(this.boundary[i - 1]);
        }
        let segment = 1;
        for (let column = 0; column < this.columns; column++) {
          const id = (row * this.columns + column) * 3;
          if (!first || column > anchor) {
            panel.work[id] = this.outline[at(column)]; panel.work[id + 2] = this.outline[at(column) + 1]; continue;
          }
          const distance = this.lengths[count - 1] * column / anchor;
          while (segment < count - 1 && this.lengths[segment] < distance) segment++;
          const a = this.boundary[segment - 1], b = this.boundary[segment], t = (distance - this.lengths[segment - 1]) / (this.lengths[segment] - this.lengths[segment - 1]);
          panel.work[id] = THREE.MathUtils.lerp(a.x, b.x, t); panel.work[id + 2] = THREE.MathUtils.lerp(a.y, b.y, t);
        }
      }
    }

    for (const panel of this.panels) {
      const position = panel.mesh.geometry.attributes.position; let changed = false;
      for (let i = 0; i < position.count; i++) for (let axis = 0; axis < 3; axis++) {
        const id = i * 3 + axis, value = Math.fround(panel.work[id] - panel.mesh.position.getComponent(axis));
        changed ||= position.array[id] !== value; position.array[id] = value; panel.velocity[id] = 0;
      }
      if (changed) {
        position.needsUpdate = true; panel.mesh.geometry.computeVertexNormals();
        panel.mesh.geometry.computeBoundingBox(); panel.mesh.geometry.computeBoundingSphere();
        panel.mesh.geometry.boundingSphere!.radius += 1e-6;
      }
    }
  }
}
