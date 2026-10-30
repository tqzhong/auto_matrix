import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function model() {
  const raw = await readFile(new URL('../packages/client/public/assets/characters/morpheus.glb', import.meta.url)), length = raw.readUInt32LE(12);
  const document = JSON.parse(raw.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const bin = raw.subarray(20 + length), result = Buffer.alloc(20 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); bin.copy(result, 20 + padded.length);
  const source = await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength), '');
  const models = new HeroModels(new THREE.Texture(), new THREE.Texture());
  (models as unknown as { load: () => Promise<typeof source> }).load = async () => source;
  const rig = (await models.create('morpheus'))!, motion = newMotion();
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  return { models, rig };
}

// The interval method retains real intersections at mirrored seam endpoints;
// neither an open garment's parity nor one-way edge rays establish a crossing.
function intersection(first: THREE.Vector3[], second: THREE.Vector3[]): number {
  const normal = (points: THREE.Vector3[]) => new THREE.Triangle(points[0], points[1], points[2]).getNormal(new THREE.Vector3());
  const cut = (points: THREE.Vector3[], plane: THREE.Vector3[]) => {
    const n = normal(plane), distances = points.map(point => point.clone().sub(plane[0]).dot(n)), hits: THREE.Vector3[] = [];
    if (Math.min(...distances) >= -1e-8 || Math.max(...distances) <= 1e-8) return hits;
    const add = (point: THREE.Vector3) => { if (!hits.some(hit => hit.distanceTo(point) < 1e-9)) hits.push(point); };
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      if (Math.abs(distances[i]) <= 1e-8) add(points[i].clone());
      if (distances[i] * distances[next] < 0) add(points[i].clone().lerp(points[next], distances[i] / (distances[i] - distances[next])));
    }
    return hits;
  };
  const a = cut(first, second), b = cut(second, first); if (a.length < 2 || b.length < 2) return 0;
  const axis = normal(first).cross(normal(second)).normalize();
  const interval = (points: THREE.Vector3[]) => points.map(point => point.clone().sub(first[0]).dot(axis)).sort((a, b) => a - b);
  const x = interval(a), y = interval(b);
  return Math.max(0, Math.min(x.at(-1)!, y.at(-1)!) - Math.max(x[0], y[0]));
}

interface Face { face: number; points: THREE.Vector3[]; box: THREE.Box3 }
function faces(mesh: THREE.SkinnedMesh): Face[] {
  mesh.skeleton.update(); const index = mesh.geometry.index!;
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const triangle = [0, 1, 2].map(k => points[index.getX(face * 3 + k)]);
    return { face, points: triangle, box: new THREE.Box3().setFromPoints(triangle) };
  });
}
function cells(box: THREE.Box3): string[] {
  const result: string[] = [];
  for (let x = Math.floor(box.min.x / .15); x <= Math.floor(box.max.x / .15); x++)
    for (let y = Math.floor(box.min.y / .15); y <= Math.floor(box.max.y / .15); y++)
      for (let z = Math.floor(box.min.z / .15); z <= Math.floor(box.max.z / .15); z++) result.push(`${x},${y},${z}`);
  return result;
}
function crossings(first: Face[], second: Face[], self: boolean) {
  const grid = new Map<string, number[]>();
  for (const [id, face] of second.entries()) for (const cell of cells(face.box)) {
    let list = grid.get(cell); if (!list) grid.set(cell, list = []); list.push(id);
  }
  let count = 0, longest: { a: number; b: number; line: number } | undefined;
  for (const [id, face] of first.entries()) for (const other of new Set(cells(face.box).flatMap(cell => grid.get(cell) ?? []))) {
    const target = second[other]; if (self && other <= id || !face.box.intersectsBox(target.box)) continue;
    if (self && face.points.some(p => target.points.some(q => p.distanceToSquared(q) < 1e-10))) continue;
    const line = intersection(face.points, target.points); if (line <= 1e-5) continue;
    count++; if (!longest || line > longest.line) longest = { a: face.face, b: target.face, line };
  }
  return { count, longest };
}

test('the complete worn old-building coat has no non-adjacent self crossings before removal starts', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh, triangles = faces(coat);
  assert.ok(triangles.length > 0, 'the actual worn coat must have rendered faces');
  const result = crossings(triangles, triangles, true);
  assert.equal(result.count, 0, `the worn coat already crosses itself: ${JSON.stringify(result)}`);
});

test('the actual worn coat does not cross the complete real shirt before removal starts', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const result = crossings(faces(shirt), faces(coat), false);
  assert.equal(result.count, 0, `the sleeve or coat body crosses the actual underclothes: ${JSON.stringify(result)}`);
});
