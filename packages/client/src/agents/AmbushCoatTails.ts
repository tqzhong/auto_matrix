import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionState } from './CharacterMotion.js';

type TailPanel = HeroRig['panels'][number] & { work: Float64Array };

/** Wrap the old-building tails around the actual posed lower clothes.
 * Neighboring rows sample the same body slab; stable radial columns and
 * cloth clearance keep the joining faces off a moving calf. */
export class AmbushCoatTails {
  private panels: TailPanel[];
  private ring: { panel: TailPanel; column: number }[];
  private columns: number;
  private rows: number;
  private normals: number[] = [];
  private supports: Float64Array;
  private low: Float64Array;
  private high: Float64Array;
  private inner: { mesh: THREE.SkinnedMesh; points: Float64Array; vertices: Uint32Array; edges: Uint32Array;
    bands: Map<number, number[]>; visits: Uint32Array }[];
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
      // The clipped upper coat repeats some seam vertices. Identical bind
      // positions, morphs and weights need one CPU skin evaluation. Every selected
      // waist triangle stays in the cache; the rendered faces stay intact.
      const vertices: number[] = [], remap = new Map<number, number>(), welded = new Map<string, number>();
      const index = selected.map(id => {
        const existing = remap.get(id); if (existing !== undefined) return existing;
        const key = coat ? [a.position.getX(id), a.position.getY(id), a.position.getZ(id),
          ...(mesh.geometry.morphAttributes.position ?? []).flatMap(target => [target.getX(id), target.getY(id), target.getZ(id)]),
          ...[0, 1, 2, 3].map(k => a.skinIndex.getComponent(id, k)), ...[0, 1, 2, 3].map(k => a.skinWeight.getComponent(id, k))].join(',') : '';
        let local = coat ? welded.get(key) : undefined;
        if (local === undefined) { local = vertices.length; vertices.push(id); if (coat) welded.set(key, local); }
        remap.set(id, local); return local;
      });
      const edges: number[] = [], visited = new Set<number>();
      for (let i = 0; i < index.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = Math.min(index[i + j], index[i + (j + 1) % 3]), b = Math.max(index[i + j], index[i + (j + 1) % 3]);
        const key = a * vertices.length + b;
        if (!visited.has(key)) { visited.add(key); edges.push(a, b); }
      }
      return { mesh, points: new Float64Array(vertices.length * 3), vertices: Uint32Array.from(vertices), edges: Uint32Array.from(edges),
        bands: new Map<number, number[]>(), visits: new Uint32Array(edges.length / 2) };
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


  update(motion: MotionState, coat: number): void {
    const pelvis = this.rig.bones.get('pelvis')!;
    this.inverse.copy(pelvis.matrixWorld).invert();
    const floor = this.rig.root.getWorldPosition(this.point).y + .025;
    // The saved motion clock is the entire wind state. A fresh model and a
    // paused frame therefore reconstruct the same surface without settling.
    for (const panel of this.panels) for (let i = 0; i < panel.rest.length / 3; i++) {
      const x = panel.rest[i * 3], y = panel.rest[i * 3 + 1], z = panel.rest[i * 3 + 2], t = Math.max(0, -y / 1.97), flare = coat * t * t;
      panel.work[i * 3] = x * (1 + flare * .24) + Math.sin(motion.time * 5 + y * 3) * flare * .035 + panel.mesh.position.x;
      panel.work[i * 3 + 1] = y + flare * .18 + panel.mesh.position.y;
      panel.work[i * 3 + 2] = z - flare * .65 + Math.sin(motion.phase * Math.PI * 2 + y * 3 + x * 3) * flare * .09 + panel.mesh.position.z;
      if (motion.ambushCrouch && motion.wasGrounded) {
        this.point.fromArray(panel.work, i * 3).applyMatrix4(pelvis.matrixWorld);
        const height = this.point.y - floor, contact = Math.max(0, -height);
        if (height < .2) {
          // Lay the excess length outward instead of burying it below the
          // floor or collapsing successive cloth rings onto the same edge.
          const radius = Math.hypot(panel.work[i * 3], panel.work[i * 3 + 2]);
          panel.work[i * 3] *= 1 + contact / radius;
          panel.work[i * 3 + 2] *= 1 + contact / radius;
          this.point.fromArray(panel.work, i * 3).applyMatrix4(pelvis.matrixWorld);
          // A monotone fold retains distinct rows at floor contact. A hard
          // clamp makes consecutive rows share a plane and can erase faces.
          this.point.y = floor + .2 * Math.exp(height / .2 - 1);
          this.point.applyMatrix4(this.inverse).toArray(panel.work, i * 3);
        }
      }
    }
    for (const part of this.inner) {
      part.mesh.skeleton.update(); this.transform.multiplyMatrices(this.inverse, part.mesh.matrixWorld);
      for (let i = 0; i < part.vertices.length; i++) {
        part.mesh.getVertexPosition(part.vertices[i], this.point).applyMatrix4(this.transform); this.point.toArray(part.points, i * 3);
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
      // Standing, the sewn waist follows its nearby surface. Once lowered
      // onto the thighs it shares the free skirt's broader contact, so a
      // passing knee cannot suddenly release an entire row.
      const spread = .7 * THREE.MathUtils.lerp(THREE.MathUtils.smoothstep(row, 0, 8), 1,
        THREE.MathUtils.smootherstep(motion.ambushCrouch ?? 0, 0, 1));
      this.supports.fill(-Infinity);
      // A small rounded source outline keeps successive columns distinct
      // when a concave corrugation would share a single support vertex.
      for (const { panel, column } of this.ring) {
        const id = (row * this.columns + column) * 3, x = panel.work[id], z = panel.work[id + 2];
        for (let k = 0; k < this.supports.length; k++) this.supports[k] = Math.max(this.supports[k], x * this.normals[k * 2] + z * this.normals[k * 2 + 1] + .001);
      }
      this.cloudCount = 0;
      for (const part of this.inner) {
        // The unbuttoned leading edges can move forward around a knee.
        // Cutting the body at a fixed front plane made those edges jump
        // sideways as soon as a knee touched that plane.
        // Each vertex and cut edge contributes once. Repeating them for
        // every incident triangle multiplies the hull work without adding
        // any contact information.
        for (let id = 0; id < part.points.length; id += 3) {
          const x = part.points[id], y = part.points[id + 1], z = part.points[id + 2];
          if (y < low - spread || y > high + spread) continue;
          // Spread a contact vertically before it reaches a cloth row. This
          // keeps a passing calf from instantly releasing a whole hem ring.
          const proximity = 1 - THREE.MathUtils.smoothstep(Math.max(low - y, y - high, 0), 0, spread);
          if (proximity > 0) this.collect(x * proximity, z * proximity);
        }
        // Query only edges crossing this slab, not the entire costume for
        // each of its 33 rows. Bands preserve every edge and exact plane cut.
        for (let key = Math.floor(low * 10); key <= Math.floor(high * 10); key++) for (const edge of part.bands.get(key) ?? []) {
          if (part.visits[edge / 2] === row + 1) continue;
          part.visits[edge / 2] = row + 1;
          const id = part.edges[edge] * 3, next = part.edges[edge + 1] * 3;
          const x = part.points[id], y = part.points[id + 1], z = part.points[id + 2];
          const nx = part.points[next], ny = part.points[next + 1], nz = part.points[next + 2];
          for (let bound = 0; bound < 2; bound++) {
            const height = bound ? high : low;
            if ((y - height) * (ny - height) < 0) {
              const t = (height - y) / (ny - y), cut = z + (nz - z) * t;
              this.collect(x + (nx - x) * t, cut);
            }
          }
        }
      }
      this.containHull(.03 + .04 * THREE.MathUtils.smoothstep(row, 8, 24));
      // Keep each cloth column on a stable radial direction. Following the
      // intersection of nearly parallel supporting planes lets a small knee
      // movement slide that column abruptly along the entire contact edge.
      for (const panel of this.panels) {
        for (let column = 0; column < this.columns; column++) {
          const id = (row * this.columns + column) * 3;
          const restX = panel.rest[id] + panel.mesh.position.x, restZ = panel.rest[id + 2] + panel.mesh.position.z, length = Math.hypot(restX, restZ);
          const x = restX / length, z = restZ / length;
          let radius = Infinity;
          for (let k = 0; k < this.supports.length; k++) {
            const dot = x * this.normals[k * 2] + z * this.normals[k * 2 + 1];
            if (dot > 1e-8) radius = Math.min(radius, this.supports[k] / dot);
          }
          panel.work[id] = x * radius; panel.work[id + 2] = z * radius;
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
