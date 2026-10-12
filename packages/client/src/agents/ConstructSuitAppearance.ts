import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';

interface Vertex { point: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2; joints: number[]; weights: number[] }

function influence(entries: [number, number][]): Pick<Vertex, 'joints' | 'weights'> {
  const merged = new Map<number, number>();
  for (const [joint, weight] of entries) merged.set(joint, (merged.get(joint) ?? 0) + weight);
  const strongest = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
  while (strongest.length < 4) strongest.push([0, 0]);
  const total = strongest.reduce((sum, pair) => sum + pair[1], 0);
  return { joints: strongest.map(pair => pair[0]), weights: strongest.map(pair => pair[1] / total) };
}

function interpolate(a: Vertex, b: Vertex, t: number): Vertex {
  return { point: a.point.clone().lerp(b.point, t), normal: a.normal.clone().lerp(b.normal, t).normalize(), uv: a.uv.clone().lerp(b.uv, t),
    ...influence([...a.joints.map((joint, i) => [joint, a.weights[i] * (1 - t)] as [number, number]),
      ...b.joints.map((joint, i) => [joint, b.weights[i] * t] as [number, number])]) };
}

function clip(vertices: Vertex[], distance: (point: THREE.Vector3) => number): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[(i + vertices.length - 1) % vertices.length], b = vertices[i];
    const da = distance(a.point), db = distance(b.point);
    if ((da >= 0) !== (db >= 0)) result.push(interpolate(a, b, da / (da - db)));
    if (db >= 0) result.push(b);
  }
  return result;
}

/** Morpheus's first-film lesson suit, fitted to the delivered skinned torso. */
export class ConstructSuitAppearance {
  private meshes: THREE.SkinnedMesh[] = [];
  private materials = new Set<THREE.MeshStandardMaterial>();
  private source: THREE.SkinnedMesh;
  private vertices: Vertex[] = [];
  private shirt: THREE.SkinnedMesh;
  private shirtVertices: Vertex[] = [];
  private jacket: THREE.SkinnedMesh;
  private originalJacket: THREE.BufferGeometry;
  private openJacket: THREE.BufferGeometry;

  constructor(private rig: HeroRig, private fabric: THREE.Texture) {
    this.source = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
    this.shirt = rig.root.getObjectByName('Black_crew_neck') as THREE.SkinnedMesh;
    this.jacket = rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
    this.originalJacket = this.jacket.geometry;
    rig.root.updateMatrixWorld(true); this.source.skeleton.update();
    this.vertices = Array.from({ length: this.source.geometry.attributes.position.count }, (_, i) => this.vertex(i));
    this.shirtVertices = Array.from({ length: this.shirt.geometry.attributes.position.count }, (_, i) => this.vertex(i, this.shirt));
    const wool = new THREE.MeshStandardMaterial({ color: 0x222528, roughness: .9, bumpMap: fabric, bumpScale: .001 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x11191a, roughness: .8, side: THREE.DoubleSide });
    const silk = new THREE.MeshPhysicalMaterial({ color: 0x737b45, roughness: .48, sheen: .55, sheenColor: new THREE.Color(0xb4b182),
      bumpMap: fabric, bumpScale: .0005, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: 0x858a75, roughness: .35, metalness: .7 });
    for (const material of [wool, shirt, silk, metal]) this.materials.add(material);

    const jacketVertices: Vertex[] = [], jacketIndices: number[] = [], jacketIndex = this.originalJacket.index!;
    for (let i = 0; i < jacketIndex.count; i += 3) {
      const triangle = [0, 1, 2].map(n => this.vertex(jacketIndex.getX(i + n), this.jacket));
      const center = triangle.reduce((point, v) => point.add(v.point), new THREE.Vector3()).multiplyScalar(1 / 3);
      const polygons = center.z > .1 && center.y < 3.35
        ? [-1, 1].map(side => clip(triangle, point => side * point.x - .13)) : [triangle];
      for (const polygon of polygons) {
        const start = jacketVertices.length; jacketVertices.push(...polygon);
        for (let n = 1; n < polygon.length - 1; n++) jacketIndices.push(start, start + n, start + n + 1);
      }
    }
    this.openJacket = this.geometry(jacketVertices, jacketIndices, true);

    const source = this.source.geometry, index = source.index!, vertices: Vertex[] = [], indices: number[] = [];
    for (let i = 0; i < index.count; i += 3) for (const side of [-1, 1]) {
      let polygon = [0, 1, 2].map(n => this.vertices[index.getX(i + n)]);
      if (polygon.every(v => v.point.y < 2.49) || polygon.every(v => v.point.y > 3.82) || polygon.every(v => v.point.z < .05)
        || polygon.every(v => v.point.x > .46) || polygon.every(v => v.point.x < -.46)) continue;
      for (const plane of [(p: THREE.Vector3) => side * p.x, (p: THREE.Vector3) => .46 - Math.abs(p.x),
        (p: THREE.Vector3) => p.z - .05, (p: THREE.Vector3) => p.y - 2.49, (p: THREE.Vector3) => 3.82 - p.y,
        (p: THREE.Vector3) => side * p.x - .43 * (p.y - 3.08)]) polygon = clip(polygon, plane);
      if (polygon.length < 3) continue;
      const start = vertices.length;
      vertices.push(...polygon.map(v => ({ ...v, point: v.point.clone().add(new THREE.Vector3(0, 0, .006)) })));
      for (let n = 1; n < polygon.length - 1; n++) indices.push(start, start + n, start + n + 1);
    }
    this.make('morpheus-construct-waistcoat', vertices, indices, wool, true);

    const collar: Vertex[] = [], collarIndices: number[] = [];
    for (const side of [-1, 1]) {
      const start = collar.length, steps = 6;
      for (let row = 0; row <= steps; row++) for (let column = 0; column <= steps; column++) {
        const u = column / steps, v = row / steps;
        const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.045, .19, u), THREE.MathUtils.lerp(.12, .265, u), v);
        const y = THREE.MathUtils.lerp(3.82, THREE.MathUtils.lerp(3.61, 3.735, u), v);
        collar.push(this.sample(x * side, y, .025));
        if (row < steps && column < steps) {
          const a = start + row * (steps + 1) + column, b = a + steps + 1;
          collarIndices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.make('morpheus-construct-collar', collar, collarIndices, shirt);

    const tie: Vertex[] = [], tieIndices: number[] = [], rows = 16, columns = 6;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, y = 3.73 - t * 1.12;
      const half = t > .9 ? .105 * (1 - t) / .1 + .004 : .049 + .056 * t / .9;
      for (let column = 0; column <= columns; column++) {
        const x = (column / columns * 2 - 1) * half;
        const vertex = this.sample(x, y, .035 + Math.sin(t * Math.PI) * .005);
        vertex.point.z += .005 * (1 - Math.abs(column / columns * 2 - 1));
        vertex.uv.set(column / columns, t * 3); tie.push(vertex);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          tieIndices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const knot = tie.length;
    for (const [x, y, depth] of [[-.045, 3.82, .055], [.045, 3.82, .055], [.032, 3.72, .045], [-.032, 3.72, .045], [0, 3.77, .075]])
      tie.push(this.sample(x, y, depth));
    tieIndices.push(knot, knot + 1, knot + 4, knot + 1, knot + 2, knot + 4, knot + 2, knot + 3, knot + 4, knot + 3, knot, knot + 4);
    this.make('morpheus-construct-tie', tie, tieIndices, silk);
    const pin = [[-.036, 3.23], [.036, 3.23], [.036, 3.219], [-.036, 3.219]].map(([x, y]) => this.sample(x, y, .049));
    this.make('morpheus-construct-tie-pin', pin, [0, 2, 1, 0, 3, 2], metal);
    this.vertices = []; this.shirtVertices = [];
  }

  private vertex(index: number, mesh = this.source): Vertex {
    const attributes = mesh.geometry.attributes;
    return { point: new THREE.Vector3().fromBufferAttribute(attributes.position, index),
      normal: new THREE.Vector3().fromBufferAttribute(attributes.normal, index),
      uv: new THREE.Vector2(attributes.uv.getX(index), attributes.uv.getY(index)),
      joints: [0, 1, 2, 3].map(i => attributes.skinIndex.getComponent(index, i)),
      weights: [0, 1, 2, 3].map(i => attributes.skinWeight.getComponent(index, i)) };
  }

  private sample(x: number, y: number, offset: number): Vertex {
    // All new cloth is authored in the delivered bind pose. Intersect cached
    // torso triangles once, rather than reskinning the full mesh for every ray.
    const exposedShirt = y >= 3.08 && y < 3.87 && Math.abs(x) < .43 * (y - 3.08);
    const index = (exposedShirt ? this.shirt : this.source).geometry.index!, cached = exposedShirt ? this.shirtVertices : this.vertices;
    let front = -Infinity, selected: Vertex[] = [], amounts: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [0, 1, 2].map(n => cached[index.getX(i + n)]), [a, b, c] = vertices.map(v => v.point);
      if (x < Math.min(a.x, b.x, c.x) || x > Math.max(a.x, b.x, c.x) || y < Math.min(a.y, b.y, c.y) || y > Math.max(a.y, b.y, c.y)) continue;
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denominator) < 1e-9) continue;
      const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
      const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator, w = 1 - u - v;
      if (Math.min(u, v, w) < -1e-6) continue;
      const z = u * a.z + v * b.z + w * c.z;
      if (z > front) { front = z; selected = vertices; amounts = [u, v, w]; }
    }
    if (!selected.length) throw new Error(`Morpheus suit could not find its delivered torso at ${x},${y}`);
    const normal = new THREE.Vector3(); selected.forEach((v, i) => normal.addScaledVector(v.normal, amounts[i]));
    return { point: new THREE.Vector3(x, y, front + offset), normal: normal.normalize(), uv: new THREE.Vector2(x * 4, y * 4),
      ...influence(selected.flatMap((v, n) => v.joints.map((joint, i) => [joint, v.weights[i] * amounts[n]] as [number, number]))) };
  }

  private geometry(vertices: Vertex[], indices: number[], keepNormals: boolean): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.point.toArray()), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.uv.toArray()), 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(vertices.flatMap(v => v.joints), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.weights), 4));
    geometry.setIndex(indices);
    if (keepNormals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.normal.toArray()), 3));
    else geometry.computeVertexNormals();
    return geometry;
  }

  private make(name: string, vertices: Vertex[], indices: number[], material: THREE.MeshStandardMaterial, keepNormals = false): void {
    const geometry = this.geometry(vertices, indices, keepNormals);
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = name; mesh.bind(this.source.skeleton, this.source.bindMatrix);
    mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false; this.rig.root.add(mesh); this.meshes.push(mesh);
  }

  update(input: MotionInput): void {
    const active = input.constructSuit === true || input.construct?.role === 'morpheus'
      || input.reveal?.role === 'morpheus' && ['construct', 'desert'].includes(input.reveal.kind);
    for (const mesh of this.meshes) mesh.visible = active;
    this.jacket.geometry = active ? this.openJacket : this.originalJacket;
    if (!active) return;
    for (const part of this.rig.wardrobe) {
      if (part.outer) part.mesh.visible = false;
      if (/Tailored.coat.upper|Tailored.trousers/i.test(part.mesh.name)) {
        const material = part.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(0x202326); material.roughness = .88; material.metalness = 0;
        material.bumpMap = this.fabric; material.bumpScale = .001;
      }
    }
  }

  dispose(): void {
    this.jacket.geometry = this.originalJacket; this.openJacket.dispose();
    for (const mesh of this.meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    this.materials.forEach(material => material.dispose());
  }
}
