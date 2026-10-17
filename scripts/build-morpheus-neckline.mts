// Bake the old-building shirt's sewn neck stand from the actual fitted garment
// and anatomical neck. Authoring only; original GLB binary and ship knit stay intact.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';

const [sourcePath, outputPath] = process.argv.slice(2);
assert.ok(sourcePath && outputPath, 'Usage: node --import tsx scripts/build-morpheus-neckline.mts PRE_NECK.glb OUTPUT.glb');
assert.notEqual(resolve(sourcePath), resolve(outputPath), 'Keep the pre-neck source intact and inspect staging before installing.');
const source = await readFile(sourcePath), jsonLength = source.readUInt32LE(12);
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const node = document.nodes.find((node: { name?: string }) => node.name === 'morpheus-hammer-sweater');
assert.ok(node?.extras.ambushHemFit && !node.extras.ambushNeckStand, 'Use the preserved fitted, pre-neck Morpheus.');
const binary = source.subarray(20 + jsonLength);
function glb(doc: object): Buffer {
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const result = Buffer.alloc(20 + padded.length + binary.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); binary.copy(result, 20 + padded.length); return result;
}
const geometryDocument = structuredClone(document);
for (const material of geometryDocument.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
geometryDocument.images = []; geometryDocument.textures = [];
const input = glb(geometryDocument), asset = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
(models as unknown as { load: () => Promise<typeof asset> }).load = async () => asset;
const rig = (await models.create('morpheus'))!;
const shirt = rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
const donor = rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
const skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
interface Vertex { point: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2; joints: number[]; weights: number[] }
function read(mesh: THREE.SkinnedMesh): Vertex[] {
  const a = mesh.geometry.attributes;
  return Array.from({ length: a.position.count }, (_, i) => ({
    point: new THREE.Vector3().fromBufferAttribute(a.position, i), normal: new THREE.Vector3().fromBufferAttribute(a.normal, i),
    uv: new THREE.Vector2().fromBufferAttribute(a.uv, i), joints: [0, 1, 2, 3].map(k => a.skinIndex.getComponent(i, k)), weights: [0, 1, 2, 3].map(k => a.skinWeight.getComponent(i, k)),
  }));
}
function weights(entries: [number, number][]): Pick<Vertex, 'joints' | 'weights'> {
  const merged = new Map<number, number>();
  for (const [joint, value] of entries) merged.set(joint, (merged.get(joint) ?? 0) + value);
  const result = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
  while (result.length < 4) result.push([0, 0]);
  const sum = result.reduce((total, pair) => total + pair[1], 0);
  return { joints: result.map(pair => pair[0]), weights: result.map(pair => pair[1] / sum) };
}
const vertices = read(shirt).slice(0, donor.geometry.attributes.position.count), indices = Array.from(donor.geometry.index!.array);
const originalCount = vertices.length, originalFaces = indices.length;
const original = vertices.map(vertex => [...vertex.point.toArray(), ...vertex.normal.toArray()]);
const keys = vertices.map(vertex => vertex.point.toArray().map(value => Math.round(value * 1e6)).join(','));
const edges = new Map<string, { from: number; to: number; count: number }>();
for (let face = 0; face < indices.length; face += 3) for (let edge = 0; edge < 3; edge++) {
  const from = indices[face + edge], to = indices[face + (edge + 1) % 3], key = [keys[from], keys[to]].sort().join('/');
  const found = edges.get(key); if (found) found.count++; else edges.set(key, { from, to, count: 1 });
}
const rim = [...edges.values()].filter(edge => edge.count === 1 && vertices[edge.from].point.y > 3.65 && vertices[edge.to].point.y > 3.65);
assert.equal(rim.length, 92, 'Match the complete original neck ring.');
const turn = (from: number, to: number) => {
  const a = vertices[from].point, b = vertices[to].point, angle = Math.atan2(b.x, b.z - .08) - Math.atan2(a.x, a.z - .08);
  return Math.atan2(Math.sin(angle), Math.cos(angle));
};
const direction = Math.sign(rim.reduce((sum, edge) => sum + turn(edge.from, edge.to), 0));
const following = new Map(rim.map(edge => [keys[edge.from], edge])), corrections = new Map<string, THREE.Vector3>();
for (const edge of rim) {
  if (turn(edge.from, edge.to) * direction >= 0) continue;
  const next = following.get(keys[edge.to])!, a = vertices[edge.from].point, b = vertices[edge.to].point, c = vertices[next.to].point;
  const amount = a.distanceTo(b) / (a.distanceTo(b) + b.distanceTo(c)); corrections.set(keys[edge.to], a.clone().lerp(c, amount));
}
for (const [i, key] of keys.entries()) { const point = corrections.get(key); if (point) vertices[i].point.copy(point); }
const body = read(skin), bodyIndex = skin.geometry.index!, bands = new Map<number, number[]>();
for (let i = 0; i < bodyIndex.count; i += 3) {
  const heights = [0, 1, 2].map(k => body[bodyIndex.getX(i + k)].point.y);
  for (let y = Math.floor(Math.min(...heights) * 20); y <= Math.floor(Math.max(...heights) * 20); y++) {
    let list = bands.get(y); if (!list) bands.set(y, list = []); list.push(i);
  }
}
const ray = new THREE.Ray(), hit = new THREE.Vector3(), triangle = new THREE.Triangle();
function sample(direction: THREE.Vector3, y: number): Vertex {
  ray.set(new THREE.Vector3(0, y, .08), direction);
  let distance = Infinity, selected: Vertex[] = [], amounts: number[] = [];
  for (const face of bands.get(Math.floor(y * 20)) ?? []) {
    const vs = [0, 1, 2].map(k => body[bodyIndex.getX(face + k)]);
    if (!ray.intersectTriangle(vs[0].point, vs[1].point, vs[2].point, false, hit)) continue;
    const next = hit.distanceTo(ray.origin); if (next >= distance) continue;
    distance = next; selected = vs; triangle.set(vs[0].point, vs[1].point, vs[2].point);
    amounts = triangle.getBarycoord(hit, new THREE.Vector3())!.toArray();
  }
  assert.ok(selected.length, `Cannot sample the actual neck at ${direction.toArray()},${y}.`);
  return { point: ray.at(distance + .035, new THREE.Vector3()), normal: new THREE.Vector3(), uv: new THREE.Vector2(),
    ...weights(selected.flatMap((vertex, n) => vertex.joints.map((joint, i) => [joint, vertex.weights[i] * amounts[n]] as [number, number]))) };
}
const layers = new Map<string, number>();
function at(id: number, row: number): number {
  if (row === 0) return id;
  const key = `${id}/${row}`, found = layers.get(key); if (found !== undefined) return found;
  const root = vertices[id], blend = THREE.MathUtils.smoothstep(row / 4, 0, 1), path = (row - 1) / 3;
  const y = THREE.MathUtils.lerp(root.point.y + .016, Math.max(3.89, root.point.y + .045), path);
  const direction = new THREE.Vector3(root.point.x, 0, root.point.z - .08).normalize(), surface = sample(direction, y);
  const radius = THREE.MathUtils.lerp(Math.hypot(root.point.x, root.point.z - .08), Math.hypot(surface.point.x, surface.point.z - .08), THREE.MathUtils.smoothstep(path, 0, 1));
  const vertex: Vertex = { point: new THREE.Vector3(direction.x * radius, y, .08 + direction.z * radius), normal: new THREE.Vector3(),
    uv: root.uv.clone().add(new THREE.Vector2(0, (y - root.point.y) * .4)),
    ...weights([...root.joints.map((joint, i) => [joint, root.weights[i] * (1 - blend)] as [number, number]),
      ...surface.joints.map((joint, i) => [joint, surface.weights[i] * blend] as [number, number])]) };
  const index = vertices.length; vertices.push(vertex); layers.set(key, index); return index;
}
for (const edge of rim) for (let row = 0; row < 4; row++) {
  const a = at(edge.from, row), b = at(edge.to, row), c = at(edge.from, row + 1), d = at(edge.to, row + 1); indices.push(b, a, c, b, c, d);
}
// Weld lighting across the sewn join and both UV seam sides, retaining all
// unrelated donor normals and the original inward folded neck return.
const joinedKeys = vertices.map(vertex => vertex.point.toArray().map(value => Math.round(value * 1e6)).join(','));
const affected = new Set(rim.flatMap(edge => [joinedKeys[edge.from], joinedKeys[edge.to]]));
for (let i = originalCount; i < vertices.length; i++) affected.add(joinedKeys[i]);
for (let face = 0; face < originalFaces; face += 3) {
  const ids = indices.slice(face, face + 3); if (ids.some(id => corrections.has(keys[id]))) for (const id of ids) affected.add(joinedKeys[id]);
}
const sums = new Map([...affected].map(key => [key, new THREE.Vector3()]));
for (let face = 0; face < indices.length; face += 3) {
  const ids = indices.slice(face, face + 3), [a, b, c] = ids.map(id => vertices[id].point);
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  for (const id of ids) sums.get(joinedKeys[id])?.add(normal);
}
for (const [i, key] of joinedKeys.entries()) { const normal = sums.get(key); if (normal) vertices[i].normal.copy(normal).normalize(); }
const row = (vertex: Vertex) => [...vertex.point.toArray(), ...vertex.normal.toArray()].map(Math.fround);
const updates = vertices.slice(0, originalCount).flatMap((vertex, i) => {
  const values = row(vertex); return values.some((value, k) => value !== original[i][k]) ? [[i, ...values]] : [];
});
const data = { version: 1, sourceSHA256: createHash('sha256').update(source).digest('hex'),
  generator: 'scripts/build-morpheus-neckline.mts', vertexCount: originalCount, bones: shirt.skeleton.bones.map(bone => bone.name), updates,
  vertices: vertices.slice(originalCount).map(vertex => [...row(vertex), ...vertex.uv.toArray().map(Math.fround), ...vertex.joints, ...vertex.weights.map(Math.fround)]),
  indices: indices.slice(originalFaces) };
node.extras.ambushNeckStand = data;
const result = glb(document); await writeFile(outputPath, result);
await writeFile(`${outputPath}.json`, JSON.stringify({ source: resolve(sourcePath), output: resolve(outputPath), sourceSHA256: data.sourceSHA256,
  outputSHA256: createHash('sha256').update(result).digest('hex'), bytes: result.length, addedBytes: result.length - source.length,
  originalVerticesUpdated: updates.length, addedVertices: data.vertices.length, addedFaces: data.indices.length / 3,
  entireOriginalBinaryUnchanged: true }, null, 2));
models.dispose(); console.log(`Baked ${data.vertices.length} neck vertices and ${data.indices.length / 3} connected faces into ${outputPath}.`);
