import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

type Surface = { points: Float64Array; triangles: Uint32Array };
type Panel = HeroRig['panels'][number];
type PosedPanel = { work: Float64Array };
type Constraint = { i: number; j: number; k: number; a: number; b: number; c: number; target: number; tolerance: number; correction: number; face?: number; body?: number };

/** A sewn boundary needs room to bend over a raised thigh. Refine only the
 * original first strip; every face below it and every other costume is kept. */
export class AmbushCoatSeam {
  private knots = [0, .02, .06, .14, .28, .47, .68, .85, 1];
  private panels: { source: Panel; original: THREE.BufferGeometry; originalVelocity: Float32Array; geometry: THREE.BufferGeometry;
    velocity: Float32Array; profile: Float64Array }[];
  private owners: Uint16Array;
  private offsets: Uint32Array;
  private boxes: Float64Array;
  private grid = new Map<number, number[]>();
  private visits: Uint32Array;
  private visit = 0;
  private polygon = [new Float64Array(27), new Float64Array(27)];

  constructor(panels: HeroRig['panels'], private columns: number, private surfaces: Surface[]) {
    this.panels = panels.map(source => {
      const original = source.mesh.geometry, uv = original.attributes.uv, rows = uv.count / columns;
      const forward = original.index!.getX(1) === columns;
      const values: number[] = [], coords: number[] = [], indices: number[] = [];
      for (let row = 0; row < rows + 7; row++) for (let column = 0; column < columns; column++) {
        const a = (row <= 8 ? 0 : row - 7) * columns + column, b = row <= 8 ? columns + column : a;
        const amount = row <= 8 ? this.knots[row] : 0;
        for (let axis = 0; axis < 3; axis++) values.push(THREE.MathUtils.lerp(source.rest[a * 3 + axis], source.rest[b * 3 + axis], amount));
        coords.push(THREE.MathUtils.lerp(uv.getX(a), uv.getX(b), amount), THREE.MathUtils.lerp(uv.getY(a), uv.getY(b), amount));
        if (row < rows + 6 && column < columns - 1) {
          const id = row * columns + column, next = id + columns;
          if (forward) indices.push(id, next, id + 1, next, next + 1, id + 1);
          else indices.push(id, id + 1, next, next, id + 1, next + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      return { source, original, originalVelocity: source.velocity, geometry, velocity: new Float32Array(values.length),
        profile: new Float64Array(9 * columns * 4) };
    });
    const count = surfaces.reduce((sum, surface) => sum + surface.triangles.length / 3, 0);
    this.owners = new Uint16Array(count); this.offsets = new Uint32Array(count); this.boxes = new Float64Array(count * 6); this.visits = new Uint32Array(count);
    let id = 0;
    surfaces.forEach((surface, owner) => {
      for (let offset = 0; offset < surface.triangles.length; offset += 3) { this.owners[id] = owner; this.offsets[id++] = offset; }
    });
  }

  setEnabled(enabled: boolean): void {
    for (const panel of this.panels) {
      panel.source.mesh.geometry = enabled ? panel.geometry : panel.original;
      panel.source.velocity = enabled ? panel.velocity : panel.originalVelocity;
    }
  }

  private bounds(): void {
    for (let id = 0; id < this.owners.length; id++) {
      const { points, triangles } = this.surfaces[this.owners[id]], offset = this.offsets[id];
      const a = triangles[offset] * 3, b = triangles[offset + 1] * 3, c = triangles[offset + 2] * 3;
      for (let axis = 0; axis < 3; axis++) {
        this.boxes[id * 6 + axis] = Math.min(points[a + axis], points[b + axis], points[c + axis]);
        this.boxes[id * 6 + 3 + axis] = Math.max(points[a + axis], points[b + axis], points[c + axis]);
      }
    }
  }

  private index(low: number, high: number): void {
    for (const bucket of this.grid.values()) bucket.length = 0;
    for (let id = 0; id < this.owners.length; id++) {
      const offset = id * 6;
      if (this.boxes[offset + 1] > high + .002 || this.boxes[offset + 4] < low - .002) continue;
      for (let x = Math.floor(this.boxes[offset] * 10); x <= Math.floor(this.boxes[offset + 3] * 10); x++) {
        for (let z = Math.floor(this.boxes[offset + 2] * 10); z <= Math.floor(this.boxes[offset + 5] * 10); z++) {
          const key = x * 1024 + z; let bucket = this.grid.get(key);
          if (!bucket) this.grid.set(key, bucket = []); bucket.push(id);
        }
      }
    }
  }

  private clip(id: number, points: Float64Array, a: number, b: number, c: number, sign: number): { values: Float64Array; count: number } {
    const surface = this.surfaces[this.owners[id]], offset = this.offsets[id];
    let source = this.polygon[0], target = this.polygon[1], count = 3;
    for (let i = 0; i < 3; i++) for (let axis = 0; axis < 3; axis++) source[i * 3 + axis] = surface.points[surface.triangles[offset + i] * 3 + axis];
    for (let edge = 0; edge < 3 && count; edge++) {
      const p = edge === 0 ? a : edge === 1 ? b : c, q = edge === 0 ? b : edge === 1 ? c : a;
      const dx = points[q] - points[p], dz = points[q + 2] - points[p + 2];
      let size = 0, previous = (count - 1) * 3;
      let dp = sign * (dx * (source[previous + 2] - points[p + 2]) - dz * (source[previous] - points[p]));
      for (let i = 0; i < count; i++) {
        const current = i * 3, dc = sign * (dx * (source[current + 2] - points[p + 2]) - dz * (source[current] - points[p]));
        if ((dp >= 0) !== (dc >= 0)) {
          const amount = dp / (dp - dc);
          for (let axis = 0; axis < 3; axis++) target[size * 3 + axis] = source[previous + axis] + (source[current + axis] - source[previous + axis]) * amount;
          size++;
        }
        if (dc >= 0) { for (let axis = 0; axis < 3; axis++) target[size * 3 + axis] = source[current + axis]; size++; }
        previous = current; dp = dc;
      }
      const swap = source; source = target; target = swap; count = size;
    }
    return { values: source, count };
  }

  private resolve(constraints: Constraint[]): Float64Array {
    const lift = new Float64Array(9 * this.columns), positive = new Float64Array(9 * this.columns);
    for (const constraint of constraints) constraint.correction = 0;
    let violation = Infinity;
    for (let pass = 0; pass < 4096; pass++) {
      let change = 0;
      for (const c of constraints) {
        const norm = c.a * c.a + c.b * c.b + c.c * c.c;
        const first = lift[c.i] + c.correction * c.a, second = lift[c.j] + c.correction * c.b, third = lift[c.k] + c.correction * c.c;
        const amount = Math.max(0, (c.target - c.a * first - c.b * second - c.c * third) / norm);
        const update = c.correction + amount;
        lift[c.i] += update * c.a; lift[c.j] += update * c.b; lift[c.k] += update * c.c; c.correction = -amount;
        change = Math.max(change, Math.abs(update * c.a), Math.abs(update * c.b), Math.abs(update * c.c));
      }
      for (let i = 0; i < lift.length; i++) {
        const value = lift[i] + positive[i], next = Math.max(0, value);
        change = Math.max(change, Math.abs(next - lift[i])); lift[i] = next; positive[i] = value - next;
      }
      violation = constraints.reduce((worst, c) => Math.max(worst, (c.target - c.a * lift[c.i] - c.b * lift[c.j] - c.c * lift[c.k]) / c.tolerance), 0);
      // Leave at least 99% of the contact padding. The following triangle
      // pass still rejects penetration; nanometre-level QP residuals are not
      // the geometric acceptance condition.
      if (violation < 1 && change < .00002) return lift;
    }
    const error = new Error(`Sewn coat constraints did not converge: ${violation}`);
    (error as unknown as { fixture: unknown }).fixture = { constraints, lift: Array.from(lift), columns: this.columns, violation };
    throw error;
  }

  private pinnedOrder(id: number, profile: Float64Array): boolean | undefined {
    const surface = this.surfaces[this.owners[id]], offset = this.offsets[id], p = surface.points;
    const a = surface.triangles[offset] * 3, b = surface.triangles[offset + 1] * 3, c = surface.triangles[offset + 2] * 3;
    const area = (p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[b + 2] - p[a + 2]) * (p[c] - p[a]);
    if (Math.abs(area) < 1e-14) return undefined;
    let above = false, below = false;
    for (const row of [0, 8]) for (let column = 0; column < this.columns; column++) {
      const point = (row * this.columns + column) * 4, x = profile[point] - p[a], z = profile[point + 2] - p[a + 2];
      const u = (x * (p[c + 2] - p[a + 2]) - z * (p[c] - p[a])) / area;
      const v = ((p[b] - p[a]) * z - (p[b + 2] - p[a + 2]) * x) / area;
      if (u < -1e-10 || v < -1e-10 || u + v > 1 + 1e-10) continue;
      const difference = p[a + 1] + (p[b + 1] - p[a + 1]) * u + (p[c + 1] - p[a + 1]) * v - profile[point + 1];
      if (difference > 1e-8) below = true; if (difference < -1e-8) above = true;
    }
    if (above && below) throw new Error(`A sewn strip must move laterally around obstacle ${id}`);
    return above ? true : below ? false : undefined;
  }

  private lift(panel: typeof this.panels[number]): Float64Array {
    const points = panel.profile, index = panel.geometry.index!.array, constraints: Constraint[] = [], seen = new Set<number>(), directions = new Map<number, boolean>();
    let lift: Float64Array = new Float64Array(9 * this.columns);
    // The lift is local to each cloth column. Keep the original above/below
    // ordering of clear surfaces; an intersecting thigh requires the lower
    // strip to pass above it. Exact triangle overlaps give linear constraints.
    while (true) {
      let low = Infinity, high = -Infinity;
      for (let i = 0; i < points.length; i += 4) {
        const y = points[i + 1] + points[i + 3] * lift[i / 4]; low = Math.min(low, y); high = Math.max(high, y);
      }
      this.index(low, high); const before = constraints.length;
      for (let face = 0; face < 8 * (this.columns - 1) * 2; face++) {
        const a = index[face * 3] * 4, b = index[face * 3 + 1] * 4, c = index[face * 3 + 2] * 4;
        const ai = a / 4, bi = b / 4, ci = c / 4;
        const area = (points[b] - points[a]) * (points[c + 2] - points[a + 2]) - (points[b + 2] - points[a + 2]) * (points[c] - points[a]);
        if (Math.abs(area) < 1e-14) throw new Error('Degenerate sewn coat footprint');
        const x0 = Math.min(points[a], points[b], points[c]), x1 = Math.max(points[a], points[b], points[c]);
        const z0 = Math.min(points[a + 2], points[b + 2], points[c + 2]), z1 = Math.max(points[a + 2], points[b + 2], points[c + 2]);
        const ay = points[a + 1] + points[a + 3] * lift[ai], by = points[b + 1] + points[b + 3] * lift[bi], cy = points[c + 1] + points[c + 3] * lift[ci];
        const y0 = Math.min(ay, by, cy) - .002, y1 = Math.max(ay, by, cy) + .002; this.visit++;
        for (let x = Math.floor(x0 * 10); x <= Math.floor(x1 * 10); x++) for (let z = Math.floor(z0 * 10); z <= Math.floor(z1 * 10); z++) {
          for (const id of this.grid.get(x * 1024 + z) ?? []) {
            if (this.visits[id] === this.visit) continue; this.visits[id] = this.visit;
            const box = id * 6;
            if (this.boxes[box] > x1 || this.boxes[box + 3] < x0 || this.boxes[box + 1] > y1 || this.boxes[box + 4] < y0
              || this.boxes[box + 2] > z1 || this.boxes[box + 5] < z0) continue;
            const polygon = this.clip(id, points, a, b, c, Math.sign(area)); if (polygon.count < 2) continue;
            const values: { a: number; b: number; c: number; difference: number; clearance: number }[] = [];
            let minimum = Infinity, maximum = -Infinity, originalMinimum = Infinity;
            for (let i = 0; i < polygon.count; i++) {
              const px = polygon.values[i * 3] - points[a], pz = polygon.values[i * 3 + 2] - points[a + 2];
              const u = (px * (points[c + 2] - points[a + 2]) - pz * (points[c] - points[a])) / area;
              const v = ((points[b] - points[a]) * pz - (points[b + 2] - points[a + 2]) * px) / area;
              const weights = [Math.max(0, 1 - u - v), Math.max(0, u), Math.max(0, v)];
              const y = points[a + 1] + (points[b + 1] - points[a + 1]) * u + (points[c + 1] - points[a + 1]) * v;
              const left = weights[0] * points[a + 3], middle = weights[1] * points[b + 3], right = weights[2] * points[c + 3];
              const difference = polygon.values[i * 3 + 1] - y, current = difference - left * lift[ai] - middle * lift[bi] - right * lift[ci];
              minimum = Math.min(minimum, current); maximum = Math.max(maximum, current); originalMinimum = Math.min(originalMinimum, difference);
              values.push({ a: left, b: middle, c: right, difference, clearance: .002 * THREE.MathUtils.smoothstep(left + middle + right, 0, .1) });
            }
            // A sewn edge can touch its own upper piece. Opposite signs are
            // required for penetration; a tangency does not need separating.
            if (minimum >= -1e-10 || maximum <= 1e-10) continue;
            const key = face * this.owners.length + id;
            if (seen.has(key)) throw new Error(`A resolved sewn coat pair still crosses: ${face}/${id}`);
            seen.add(key);
            let above = directions.get(id);
            if (above === undefined) {
              above = this.pinnedOrder(id, points) ?? (this.owners[id] === 0 || originalMinimum < -1e-9);
              directions.set(id, above);
            }
            for (const value of values) {
              const direction = above ? 1 : -1, target = direction * value.difference + value.clearance;
              if (value.a * value.a + value.b * value.b + value.c * value.c < 1e-24) {
                if (target > 1e-8) throw new Error(`The sewn coat boundary is inside an obstacle: ${face}/${id}`);
                continue;
              }
              constraints.push({ i: ai, j: bi, k: ci, a: direction * value.a, b: direction * value.b, c: direction * value.c, target, tolerance: Math.max(1e-9, value.clearance * .01), correction: 0, face, body: id });
            }
          }
        }
      }
      if (constraints.length === before) return lift;
      lift = this.resolve(constraints);
    }
  }

  update(posed: PosedPanel[]): void {
    this.bounds();
    for (let side = 0; side < this.panels.length; side++) {
      const panel = this.panels[side], work = posed[side].work, points = panel.profile;
      for (let row = 0; row <= 8; row++) for (let column = 0; column < this.columns; column++) {
        const a = column * 3, b = (this.columns + column) * 3, id = (row * this.columns + column) * 4, t = this.knots[row];
        for (let axis = 0; axis < 3; axis++) points[id + axis] = work[a + axis] + (work[b + axis] - work[a + axis]) * t;
        points[id + 3] = row > 0 && row < 8 ? 1 : 0;
      }
      const lift = this.lift(panel), position = panel.geometry.attributes.position; let changed = false;
      for (let row = 0; row < position.count / this.columns; row++) for (let column = 0; column < this.columns; column++) for (let axis = 0; axis < 3; axis++) {
        const id = (row * this.columns + column) * 3 + axis;
        const point = (row * this.columns + column) * 4;
        const value = Math.fround((row <= 8 ? points[point + axis] + (axis === 1 ? points[point + 3] * lift[row * this.columns + column] : 0)
          : work[((row - 7) * this.columns + column) * 3 + axis]) - panel.source.mesh.position.getComponent(axis));
        changed ||= position.array[id] !== value; position.array[id] = value;
      }
      panel.velocity.fill(0); panel.originalVelocity.fill(0);
      if (changed) {
        position.needsUpdate = true; panel.geometry.computeVertexNormals(); panel.geometry.computeBoundingBox(); panel.geometry.computeBoundingSphere(); panel.geometry.boundingSphere!.radius += 1e-6;
      }
    }
  }

  dispose(): void {
    this.setEnabled(false); for (const panel of this.panels) panel.geometry.dispose();
  }
}
