import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';

interface Vertex { point: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2; joints: number[]; weights: number[] }
function weights(entries: [number, number][]): Pick<Vertex, 'joints' | 'weights'> {
  const merged = new Map<number, number>();
  for (const [joint, value] of entries) merged.set(joint, (merged.get(joint) ?? 0) + value);
  const result = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
  while (result.length < 4) result.push([0, 0]);
  const sum = result.reduce((total, pair) => total + pair[1], 0);
  return { joints: result.map(pair => pair[0]), weights: result.map(pair => pair[1] / sum) };
}
function between(a: Vertex, b: Vertex, t: number): Vertex {
  return { point: a.point.clone().lerp(b.point, t), normal: a.normal.clone().lerp(b.normal, t).normalize(), uv: a.uv.clone().lerp(b.uv, t),
    ...weights([...a.joints.map((joint, i) => [joint, a.weights[i] * (1 - t)] as [number, number]), ...b.joints.map((joint, i) => [joint, b.weights[i] * t] as [number, number])]) };
}
function clip(vertices: Vertex[], distance: (point: THREE.Vector3) => number): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[(i + vertices.length - 1) % vertices.length], b = vertices[i], da = distance(a.point), db = distance(b.point);
    if ((da >= 0) !== (db >= 0)) result.push(between(a, b, da / (da - db)));
    if (db >= 0) result.push(b);
  }
  return result;
}

/** The old building's full shirt and open leather coat; independent of the lesson waistcoat and ship knit. */
export class AmbushWardrobeAppearance {
  private meshes: THREE.SkinnedMesh[] = [];
  private materials = new Set<THREE.MeshStandardMaterial>();
  private leather: THREE.DataTexture;
  private source: THREE.SkinnedMesh;
  private vertices = new Map<THREE.SkinnedMesh, Vertex[]>();
  private bands = new Map<THREE.SkinnedMesh, Map<number, number[]>>();
  private coat: THREE.SkinnedMesh;
  private lapels: THREE.SkinnedMesh;
  private trousers: THREE.SkinnedMesh;
  private originalTrousers: THREE.BufferGeometry;
  private fittedTrousers: THREE.BufferGeometry;

  constructor(private rig: HeroRig, fabric: THREE.Texture) {
    this.source = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
    const jacket = this.source.clone(false);
    const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const trousers = this.trousers = rig.root.getObjectByName('Tailored_trousers') as THREE.SkinnedMesh;
    this.originalTrousers = trousers.geometry; this.fittedTrousers = trousers.geometry.clone();
    // The donor ties the crotch and waistband to the chest, pulling folded
    // trousers through themselves. Rebind only this belt with continuous hip,
    // pelvis and lower-spine influence, fading to the original top/bottom edges.
    const positions = trousers.geometry.attributes.position, indices = trousers.geometry.attributes.skinIndex, amounts = trousers.geometry.attributes.skinWeight;
    const joint = (name: string) => trousers.skeleton.bones.findIndex(bone => bone.name === name);
    const bind = (name: string) => new THREE.Vector3().setFromMatrixPosition(trousers.skeleton.boneInverses[joint(name)].clone().invert());
    const pelvis = bind('pelvis'), spine = bind('spine'), chest = bind('chest'), hip = bind('hip_L'), knee = bind('knee_L');
    const leg = hip.y - knee.y, torso = spine.y - pelvis.y;
    const fitWaist = (point: THREE.Vector3, original: Pick<Vertex, 'joints' | 'weights'>): Pick<Vertex, 'joints' | 'weights'> => {
      const lower = THREE.MathUtils.smoothstep(point.y, pelvis.y - leg * .5, pelvis.y - leg * .25);
      const upper = 1 - THREE.MathUtils.smoothstep(point.y, spine.y, chest.y), blend = lower * upper;
      if (blend <= 0) return original;
      const hips = 1 - THREE.MathUtils.smoothstep(point.y, pelvis.y - leg * .5, pelvis.y + torso * .5);
      // A smoothstep between these close joints over-compresses the front
      // cloth under the existing deep crouch; linear weights keep it monotone.
      const left = THREE.MathUtils.smoothstep(point.x, -hip.x, hip.x), back = THREE.MathUtils.clamp((point.y - pelvis.y) / torso, 0, 1);
      const entries = original.joints.map((joint, n) => [joint, original.weights[n] * (1 - blend)] as [number, number]);
      entries.push([joint('pelvis'), (1 - hips) * (1 - back) * blend], [joint('spine'), (1 - hips) * back * blend],
        [joint('hip_L'), hips * left * blend], [joint('hip_R'), hips * (1 - left) * blend]);
      return weights(entries);
    };
    const welded = new Map<string, Pick<Vertex, 'joints' | 'weights'>>();
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i);
      if (point.y <= pelvis.y - leg * .5 || point.y >= chest.y) continue;
      const key = point.toArray().map(value => value.toFixed(5)).join(',');
      let fitted = welded.get(key);
      if (!fitted) {
        fitted = fitWaist(point, { joints: [0, 1, 2, 3].map(n => indices.getComponent(i, n)), weights: [0, 1, 2, 3].map(n => amounts.getComponent(i, n)) });
        welded.set(key, fitted);
      }
      for (let n = 0; n < 4; n++) {
        this.fittedTrousers.attributes.skinIndex.setComponent(i, n, fitted.joints[n]); this.fittedTrousers.attributes.skinWeight.setComponent(i, n, fitted.weights[n]);
      }
    }
    for (const mesh of [this.source, skin, trousers]) {
      const a = (mesh === trousers ? this.fittedTrousers : mesh.geometry).attributes;
      this.vertices.set(mesh, Array.from({ length: a.position.count }, (_, i) => ({
        point: new THREE.Vector3().fromBufferAttribute(a.position, i), normal: new THREE.Vector3().fromBufferAttribute(a.normal, i),
        uv: new THREE.Vector2(a.uv.getX(i), a.uv.getY(i)), joints: [0, 1, 2, 3].map(j => a.skinIndex.getComponent(i, j)), weights: [0, 1, 2, 3].map(j => a.skinWeight.getComponent(i, j)),
      })));
    }
    // A woven shirt sits closer than the ship's loose knit. Retain the cuff
    // rings and arm skinning, and take in only torso-dominated cloth vertices.
    const cloth = this.vertices.get(this.source)!;
    // The donor's mirrored back panels curl across their existing centre
    // seam. Unfold only that narrow hem strip along its original UV rows;
    // both panels still meet the same welded centre positions and keep their
    // indices, vertical profile and UV seam.
    const seams = [-1, 1].map(side => cloth.filter(vertex => Math.abs(vertex.point.x) < 1e-6 && vertex.point.z < -.1
      && vertex.point.y > 2.37 && vertex.point.y < 2.75 && (vertex.uv.x < .38 ? -1 : 1) === side)
      .sort((a, b) => a.uv.y - b.uv.y).map(vertex => {
        const x = side * .1, y = vertex.point.y, index = this.source.geometry.index!;
        let back = Infinity, edge = vertex.uv.x;
        for (const i of this.band(this.source, y)) {
          const a = cloth[index.getX(i)], b = cloth[index.getX(i + 1)], c = cloth[index.getX(i + 2)];
          const denominator = (b.point.y - c.point.y) * (a.point.x - c.point.x) + (c.point.x - b.point.x) * (a.point.y - c.point.y);
          if (Math.abs(denominator) < 1e-9) continue;
          const u = ((b.point.y - c.point.y) * (x - c.point.x) + (c.point.x - b.point.x) * (y - c.point.y)) / denominator;
          const v = ((c.point.y - a.point.y) * (x - c.point.x) + (a.point.x - c.point.x) * (y - c.point.y)) / denominator, w = 1 - u - v;
          if (Math.min(u, v, w) < -1e-6) continue;
          const z = u * a.point.z + v * b.point.z + w * c.point.z;
          if (z < back) { back = z; edge = u * a.uv.x + v * b.uv.x + w * c.uv.x; }
        }
        return { u: vertex.uv.x, v: vertex.uv.y, scale: .1 / Math.abs(edge - vertex.uv.x) };
      }));
    const row = (vertices: typeof seams[number], v: number) => {
      const end = vertices.findIndex(vertex => vertex.v >= v);
      if (end <= 0) return vertices[end < 0 ? vertices.length - 1 : 0];
      const a = vertices[end - 1], b = vertices[end], t = (v - a.v) / (b.v - a.v);
      return { u: THREE.MathUtils.lerp(a.u, b.u, t), v, scale: THREE.MathUtils.lerp(a.scale, b.scale, t) };
    };
    const clothIndex = this.source.geometry.index!, hemReturns = new Map<number, { outer: number; thickness: number }>();
    // The donor extrudes each open hem edge inward, sharing its UV and
    // weights. Preserve that return after unfolding instead of fitting its
    // inner ring independently onto the outer trouser radius.
    for (let i = 0; i < clothIndex.count; i += 3) for (let edge = 0; edge < 3; edge++) {
      const a = clothIndex.getX(i + edge), b = clothIndex.getX(i + (edge + 1) % 3);
      const outer = cloth[a].point.y < cloth[b].point.y ? a : b, inner = outer === a ? b : a, p = cloth[outer].point;
      if (Math.abs(p.y - 2.38) > 1e-6 || Math.abs(p.x) >= .1 || p.z >= -.1 || cloth[outer].uv.distanceTo(cloth[inner].uv) > 1e-7) continue;
      hemReturns.set(inner, { outer, thickness: p.distanceTo(cloth[inner].point) });
    }
    const unfolded = cloth.map(vertex => vertex.point.clone()), unfoldedNormals = new Set<number>();
    for (let i = 0; i < cloth.length; i++) {
      const vertex = cloth[i], p = vertex.point;
      if (Math.abs(p.x) >= .1 || p.z >= -.1 || p.y >= 2.7) continue;
      const side = vertex.uv.x < .38 ? -1 : 1, centre = row(seams[side < 0 ? 0 : 1], vertex.uv.y);
      const amount = (1 - THREE.MathUtils.smoothstep(Math.abs(p.x), .04, .1)) * (1 - THREE.MathUtils.smoothstep(p.y, 2.566, 2.7));
      const distance = Math.max(0, -side * (vertex.uv.x - centre.u));
      unfolded[i].x = THREE.MathUtils.lerp(p.x, side * distance * centre.scale, amount);
      if (amount > 0) unfoldedNormals.add(i);
    }
    cloth.forEach((vertex, i) => vertex.point.copy(unfolded[i]));
    for (const vertex of cloth) {
      const torso = vertex.joints.reduce((sum, joint, i) => sum + (/^(pelvis|spine|chest)$/.test(this.source.skeleton.bones[joint].name) ? vertex.weights[i] : 0), 0);
      const fitted = torso * THREE.MathUtils.smoothstep(vertex.point.y, 2.75, 3.05);
      vertex.point.x *= 1 - .04 * fitted; vertex.point.z *= 1 - .07 * fitted;
    }
    const clothPoints = cloth.map(vertex => vertex.point.clone());
    const waistRay = new THREE.Ray(), waistHit = new THREE.Vector3(), pants = this.vertices.get(trousers)!, pantsIndex = trousers.geometry.index!;
    for (const vertex of cloth) {
      const waist = vertex.joints.reduce((sum, joint, i) => sum + (/^(pelvis|spine|chest|hip_[LR])$/.test(this.source.skeleton.bones[joint].name) ? vertex.weights[i] : 0), 0);
      // Keep the untucked hem outside the actual high trouser waist. Fitting
      // only the front left small side/back triangles poking through the shirt.
      if (waist > .8 && vertex.point.y < 2.85) {
        waistRay.origin.set(0, vertex.point.y, 0); waistRay.direction.set(vertex.point.x, 0, vertex.point.z).normalize();
        let radius = Math.hypot(vertex.point.x, vertex.point.z), required = 0, inner = radius;
        for (const i of this.band(trousers, vertex.point.y)) {
          const triangle = [0, 1, 2].map(n => pants[pantsIndex.getX(i + n)]);
          if (!waistRay.intersectTriangle(triangle[0].point, triangle[1].point, triangle[2].point, false, waistHit)) continue;
          const distance = waistHit.distanceTo(waistRay.origin); required = Math.max(required, distance + .02);
        }
        // Move the existing folded layers together. Clamping each point to
        // one trouser radius collapses the rear seam's overlapping relief.
        for (const i of this.band(this.source, vertex.point.y)) {
          if (!waistRay.intersectTriangle(clothPoints[clothIndex.getX(i)], clothPoints[clothIndex.getX(i + 1)], clothPoints[clothIndex.getX(i + 2)], false, waistHit)) continue;
          inner = Math.min(inner, waistHit.distanceTo(waistRay.origin));
        }
        radius += Math.max(0, required - inner);
        vertex.point.x = waistRay.direction.x * radius; vertex.point.z = waistRay.direction.z * radius;
      }
      // Use the same field above the trousers' local rim and through the
      // entire spine-to-chest blend; a failed horizontal ray is not a seam.
      if (waist > .8 && vertex.point.y < chest.y) Object.assign(vertex, fitWaist(vertex.point, vertex));
    }
    const hemNormals = new Map<number, THREE.Vector3>();
    for (const { outer } of hemReturns.values()) hemNormals.set(outer, new THREE.Vector3());
    for (let i = 0; i < clothIndex.count; i += 3) {
      const ids = [0, 1, 2].map(n => clothIndex.getX(i + n));
      if (ids.some(id => hemReturns.has(id)) || !ids.some(id => hemNormals.has(id))) continue;
      const n = new THREE.Vector3().subVectors(cloth[ids[1]].point, cloth[ids[0]].point)
        .cross(new THREE.Vector3().subVectors(cloth[ids[2]].point, cloth[ids[0]].point));
      for (const id of ids) hemNormals.get(id)?.add(n);
    }
    for (const [inner, { outer, thickness }] of hemReturns) {
      cloth[inner].point.copy(cloth[outer].point).addScaledVector(hemNormals.get(outer)!.normalize(), -thickness);
      cloth[inner].joints = cloth[outer].joints.slice(); cloth[inner].weights = cloth[outer].weights.slice();
      unfoldedNormals.add(inner);
    }
    // Recalculate only the changed strip's shading, including its existing
    // duplicated UV seam. Averaging coincident positions keeps the closed
    // centre seam smooth without changing normals on the sleeves or chest.
    const normals = new Map<number, THREE.Vector3>(), seamNormals = new Map<string, THREE.Vector3>();
    for (const i of unfoldedNormals) normals.set(i, new THREE.Vector3());
    for (let i = 0; i < clothIndex.count; i += 3) {
      const ids = [0, 1, 2].map(n => clothIndex.getX(i + n));
      if (!ids.some(id => unfoldedNormals.has(id))) continue;
      const n = new THREE.Vector3().subVectors(cloth[ids[1]].point, cloth[ids[0]].point)
        .cross(new THREE.Vector3().subVectors(cloth[ids[2]].point, cloth[ids[0]].point));
      for (const id of ids) normals.get(id)?.add(n);
    }
    const seamKey = (i: number) => cloth[i].point.toArray().map(value => value.toFixed(6)).join(',');
    for (const [i, normal] of normals) {
      const key = seamKey(i); let sum = seamNormals.get(key); if (!sum) seamNormals.set(key, sum = new THREE.Vector3()); sum.add(normal);
    }
    for (const i of unfoldedNormals) cloth[i].normal.copy(seamNormals.get(seamKey(i))!).normalize();
    // The stock upper coat is narrower than the full shirt. Share the shirt's
    // skin weights and fit a separate outer shell, including both entire sleeves.
    this.vertices.set(jacket, this.vertices.get(this.source)!.map(vertex => ({ ...vertex, point: vertex.point.clone().addScaledVector(vertex.normal, .04) })));
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 16), u = (x + row % 2 * 8 + Math.sin(y * .2)) % 16, v = y % 16;
      const edge = Math.min(u, 16 - u, v, 16 - v), shade = 70 + Math.min(1, edge / 1.5) * 105 + Math.sin(x * 1.7 + y * 2.1) * 10;
      const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = shade; data[i + 3] = 255;
    }
    this.leather = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); this.leather.name = 'morpheus-ambush-leather-grain';
    this.leather.wrapS = this.leather.wrapT = THREE.RepeatWrapping; this.leather.repeat.set(4, 5); this.leather.needsUpdate = true;
    const shirt = new THREE.MeshStandardMaterial({ color: 0x172021, roughness: .83, bumpMap: fabric, bumpScale: .0008, side: THREE.DoubleSide });
    const leather = new THREE.MeshPhysicalMaterial({ color: 0x181613, roughness: .3, clearcoat: .65, clearcoatRoughness: .28, bumpMap: this.leather, bumpScale: .006, side: THREE.DoubleSide });
    const silk = new THREE.MeshPhysicalMaterial({ color: 0x626e3c, roughness: .5, sheen: .5, sheenColor: new THREE.Color(0xa2ac70), bumpMap: fabric, bumpScale: .0008, side: THREE.DoubleSide });
    for (const material of [shirt, leather, silk]) this.materials.add(material);
    // Close the knit donor's low round neckline with a shirt stand sampled
    // from the actual neck, then fit the folded collar and tie to that cloth.
    const shirtVertices = this.vertices.get(this.source)!.slice(), shirtIndices = Array.from(this.source.geometry.index!.array), neckline = shirtVertices.length;
    for (let row = 0; row <= 8; row++) for (let column = 0; column <= 12; column++) {
      const t = row / 8, x = (column / 6 - 1) * (.21 - .05 * t), y = 3.74 + .15 * t;
      shirtVertices.push(this.sample(skin, x, y, .035));
      if (row < 8 && column < 12) { const a = neckline + row * 13 + column, b = a + 13; shirtIndices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    this.source = this.make('morpheus-ambush-shirt', this.geometry(shirtVertices, shirtIndices, true), shirt);
    this.vertices.set(this.source, shirtVertices);

    const collar: Vertex[] = [], collarIndices: number[] = [];
    for (const side of [-1, 1]) {
      const start = collar.length, steps = 8;
      for (let row = 0; row <= steps; row++) for (let column = 0; column <= steps; column++) {
        const u = column / steps, v = row / steps;
        const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.045, .2, u), THREE.MathUtils.lerp(.12, .29, u), v);
        const y = THREE.MathUtils.lerp(3.82, THREE.MathUtils.lerp(3.59, 3.72, u), v);
        collar.push(this.sample(this.source, x * side, y, .018 + Math.sin(v * Math.PI) * .018));
        if (row < steps && column < steps) { const a = start + row * (steps + 1) + column, b = a + steps + 1; collarIndices.push(a, b, a + 1, b, b + 1, a + 1); }
      }
    }
    this.make('morpheus-ambush-collar', this.geometry(collar, collarIndices), shirt);
    const tie: Vertex[] = [], tieIndices: number[] = [], rows = 20, columns = 6;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, y = 3.73 - t * 1.21, half = t > .9 ? .105 * (1 - t) / .1 + .004 : .048 + .057 * t / .9;
      for (let column = 0; column <= columns; column++) {
        const x = (column / columns * 2 - 1) * half, vertex = this.sample(this.source, x, y, .025 + Math.sin(t * Math.PI) * .008);
        vertex.point.z += .007 * (1 - Math.abs(column / columns * 2 - 1)); vertex.uv.set(column / columns, t * 3); tie.push(vertex);
        if (row < rows && column < columns) { const a = row * (columns + 1) + column, b = a + columns + 1; tieIndices.push(a, b, a + 1, b, b + 1, a + 1); }
      }
    }
    const knot = tie.length;
    for (const [x, y, depth] of [[-.045, 3.82, .055], [.045, 3.82, .055], [.032, 3.72, .04], [-.032, 3.72, .04], [0, 3.77, .075]]) tie.push(this.sample(this.source, x, y, depth));
    tieIndices.push(knot, knot + 1, knot + 4, knot + 1, knot + 2, knot + 4, knot + 2, knot + 3, knot + 4, knot + 3, knot, knot + 4);
    this.make('morpheus-ambush-tie', this.geometry(tie, tieIndices), silk);

    const opened: Vertex[] = [], openedIndices: number[] = [], jacketIndex = jacket.geometry.index!, cached = this.vertices.get(jacket)!;
    for (let i = 0; i < jacketIndex.count; i += 3) {
      const triangle = [0, 1, 2].map(n => cached[jacketIndex.getX(i + n)]), middle = triangle.reduce((p, v) => p.add(v.point), new THREE.Vector3()).multiplyScalar(1 / 3);
      const polygons = middle.z > .08 ? [-1, 1].map(side => clip(triangle, p => side * p.x - (.15 + .09 * THREE.MathUtils.smoothstep(p.y, 2.5, 3.6)))) : [triangle];
      for (const polygon of polygons) { const start = opened.length; opened.push(...polygon); for (let n = 1; n < polygon.length - 1; n++) openedIndices.push(start, start + n, start + n + 1); }
    }
    this.coat = this.make('morpheus-ambush-coat', this.geometry(opened, openedIndices, true), leather);
    const lapels: Vertex[] = [], lapelIndices: number[] = [], steps = 12;
    for (const side of [-1, 1]) {
      const start = lapels.length;
      for (let row = 0; row <= steps; row++) for (let column = 0; column <= 6; column++) {
        const t = row / steps, u = column / 6, y = 3.8 - t * .78;
        const inner = THREE.MathUtils.lerp(.18, .23, t), outer = t < .48 ? THREE.MathUtils.lerp(.44, .57, t / .48) : THREE.MathUtils.lerp(.57, .25, (t - .48) / .52);
        const vertex = this.sample(jacket, THREE.MathUtils.lerp(inner, outer, u) * side, y, .025 + Math.sin(u * Math.PI) * .035);
        vertex.uv.set(u * .5, t); lapels.push(vertex);
        if (row < steps && column < 6) { const a = start + row * 7 + column, b = a + 7; lapelIndices.push(a, b, a + 1, b, b + 1, a + 1); }
      }
    }
    this.lapels = this.make('morpheus-ambush-lapels', this.geometry(lapels, lapelIndices), leather);
    this.vertices.clear(); this.bands.clear();
  }

  private band(mesh: THREE.SkinnedMesh, y: number): number[] {
    const cached = this.vertices.get(mesh)!, index = mesh.geometry.index!;
    let bands = this.bands.get(mesh);
    if (!bands) {
      bands = new Map();
      for (let i = 0; i < index.count; i += 3) {
        const a = cached[index.getX(i)].point, b = cached[index.getX(i + 1)].point, c = cached[index.getX(i + 2)].point;
        const low = Math.floor(Math.min(a.y, b.y, c.y) * 20), high = Math.floor(Math.max(a.y, b.y, c.y) * 20);
        for (let band = low; band <= high; band++) { let list = bands.get(band); if (!list) bands.set(band, list = []); list.push(i); }
      }
      this.bands.set(mesh, bands);
    }
    return bands.get(Math.floor(y * 20)) ?? [];
  }

  private sample(mesh: THREE.SkinnedMesh, x: number, y: number, offset: number): Vertex {
    const cached = this.vertices.get(mesh)!, index = mesh.geometry.index!;
    let front = -Infinity, selected: Vertex[] = [], amounts: number[] = [];
    for (const i of this.band(mesh, y)) {
      const va = cached[index.getX(i)], vb = cached[index.getX(i + 1)], vc = cached[index.getX(i + 2)], a = va.point, b = vb.point, c = vc.point;
      if (x < Math.min(a.x, b.x, c.x) || x > Math.max(a.x, b.x, c.x) || y < Math.min(a.y, b.y, c.y) || y > Math.max(a.y, b.y, c.y)) continue;
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y); if (Math.abs(denominator) < 1e-9) continue;
      const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
      const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator, w = 1 - u - v;
      if (Math.min(u, v, w) < -1e-6) continue;
      const z = u * a.z + v * b.z + w * c.z; if (z > front) { front = z; selected = [va, vb, vc]; amounts = [u, v, w]; }
    }
    if (!selected.length) throw new Error(`Morpheus old-building cloth cannot find ${mesh.name} at ${x},${y}`);
    const normal = new THREE.Vector3(); selected.forEach((v, i) => normal.addScaledVector(v.normal, amounts[i]));
    return { point: new THREE.Vector3(x, y, front + offset), normal: normal.normalize(), uv: new THREE.Vector2(x * 4, y * 4),
      ...weights(selected.flatMap((v, n) => v.joints.map((joint, i) => [joint, v.weights[i] * amounts[n]] as [number, number]))) };
  }
  private geometry(vertices: Vertex[], indices: number[], keepNormals = false): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    // A sleeve ends at the wrist. The knit donor also weights cuff vertices
    // to the thumb, which otherwise pulls both cloth layers when fingers curl.
    const bones = this.source.skeleton.bones, remap = bones.map((bone, index) => {
      const finger = /^finger[1-5]-[1-3]_([RL])$/.exec(bone.name);
      return finger ? bones.findIndex(target => target.name === `wrist_${finger[1]}`) : index;
    });
    const bindings = vertices.map(vertex => vertex.joints.some((joint, i) => vertex.weights[i] > 0 && remap[joint] !== joint)
      ? weights(vertex.joints.map((joint, i) => [vertex.weights[i] > 0 ? remap[joint] : joint, vertex.weights[i]])) : vertex);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.point.toArray()), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.uv.toArray()), 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bindings.flatMap(v => v.joints), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bindings.flatMap(v => v.weights), 4)); geometry.setIndex(indices);
    if (keepNormals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.normal.toArray()), 3)); else geometry.computeVertexNormals();
    return geometry;
  }
  private make(name: string, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial): THREE.SkinnedMesh {
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name; mesh.bind(this.source.skeleton, this.source.bindMatrix);
    mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false; this.rig.root.add(mesh); this.meshes.push(mesh); return mesh;
  }
  garment(mesh: THREE.Mesh, input: MotionInput): boolean {
    return input.realWorld !== true && input.ambushWardrobe === 'coat' && this.rig.panels.some(panel => panel.mesh === mesh);
  }
  update(input: MotionInput): void {
    const mode = input.realWorld !== true ? input.ambushWardrobe : undefined;
    this.trousers.geometry = mode ? this.fittedTrousers : this.originalTrousers;
    for (const mesh of this.meshes) mesh.visible = Boolean(mode);
    this.coat.visible = this.lapels.visible = mode === 'coat';
    if (!mode) return;
    for (const part of this.rig.wardrobe) {
      if (/Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name) || part.mesh.userData.hammerBriefingCostume) part.mesh.visible = false;
      if (part.outer) {
        part.mesh.visible = mode === 'coat';
        if (mode !== 'coat') continue;
        const material = part.mesh.material as THREE.MeshStandardMaterial;
        if (material.map !== null || material.bumpMap !== this.leather) { material.map = null; material.bumpMap = this.leather; material.needsUpdate = true; }
        material.color.setHex(0x181613); material.roughness = .3; material.metalness = 0; material.bumpScale = .006;
      }
    }
  }
  dispose(): void {
    this.trousers.geometry = this.originalTrousers; this.fittedTrousers.dispose();
    for (const mesh of this.meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const material of this.materials) material.dispose(); this.leather.dispose();
  }
}
