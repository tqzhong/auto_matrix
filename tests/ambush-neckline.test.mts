import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { poseAmbushCallPair } from '../packages/client/src/agents/AmbushCallPerformance.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';

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
  const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt' };
  models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); rig.root.updateMatrixWorld(true);
  return { models, rig };
}

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
interface Face { face: number; ids: number[]; points: THREE.Vector3[]; box: THREE.Box3 }
function faces(mesh: THREE.SkinnedMesh): Face[] {
  mesh.skeleton.update(); const { position } = mesh.geometry.attributes, index = mesh.geometry.index!;
  const vertices = Array.from({ length: position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(n => index.getX(face*3+n)), points = ids.map(id => vertices[id]);
    return { face, ids, points, box: new THREE.Box3().setFromPoints(points) };
  });
}
function cells(box: THREE.Box3): string[] {
  const result: string[] = [];
  for (let x = Math.floor(box.min.x / .05); x <= Math.floor(box.max.x / .05); x++)
    for (let y = Math.floor(box.min.y / .05); y <= Math.floor(box.max.y / .05); y++)
      for (let z = Math.floor(box.min.z / .05); z <= Math.floor(box.max.z / .05); z++) result.push(`${x},${y},${z}`);
  return result;
}
function crossings(first: Face[], second: Face[], sameMesh = true) {
  const grid = new Map<string, number[]>();
  for (const [id, face] of second.entries()) for (const key of cells(face.box)) {
    let ids = grid.get(key); if (!ids) grid.set(key, ids = []); ids.push(id);
  }
  const contacts = [];
  for (const face of first) for (const id of new Set(cells(face.box).flatMap(key => grid.get(key) ?? []))) {
    const other = second[id];
    if (!face.box.intersectsBox(other.box) || sameMesh && face.ids.filter(v => other.ids.includes(v)).length >= 2) continue;
    const line = intersection(face.points, other.points);
    if (line > 1e-5) contacts.push({ first: face.face, second: other.face, line });
  }
  return { count: contacts.length, examples: contacts.slice().sort((a, b) => b.line-a.line).slice(0, 4) };
}

test('the full shirt has one connected cloth body and only its original four garment openings', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const p = shirt.geometry.attributes.position, index = shirt.geometry.index!;
  assert.deepEqual(Array.from(index.array).slice(0, donor.geometry.index!.count), Array.from(donor.geometry.index!.array), 'retain every original connected garment triangle while replacing the separate overlapping patch');
  const keys = Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)].map(value => Math.round(value * 1e6)).join(','));
  const adjacency = new Map<string, Set<string>>(), edges = new Map<string, { from: string; to: string; count: number }>(), used = new Set<number>();
  for (let face = 0; face < index.count; face += 3) for (let e = 0; e < 3; e++) {
    const a = index.getX(face + e), b = index.getX(face + (e + 1) % 3), from = keys[a], to = keys[b]; used.add(a); used.add(b);
    for (const [u, v] of [[from, to], [to, from]]) { let set = adjacency.get(u); if (!set) adjacency.set(u, set = new Set()); set.add(v); }
    const key = [from, to].sort().join('/'), edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { from, to, count: 1 });
  }
  for (let i = donor.geometry.attributes.position.count; i < p.count; i++) assert.ok(used.has(i), `new cloth vertex ${i} is not attached to an actual face`);
  const components = (graph: Map<string, Set<string>>) => {
    const remaining = new Set(graph.keys()); let count = 0;
    while (remaining.size) {
      count++; const queue = [remaining.values().next().value!];
      while (queue.length) { const key = queue.pop()!; if (!remaining.delete(key)) continue; for (const next of graph.get(key) ?? []) if (remaining.has(next)) queue.push(next); }
    }
    return count;
  };
  const boundary = new Map<string, Set<string>>();
  for (const edge of edges.values()) {
    assert.ok(edge.count <= 2, 'the original neck and new stand must join without a three-face seam');
    if (edge.count !== 1) continue;
    for (const [u, v] of [[edge.from, edge.to], [edge.to, edge.from]]) { let set = boundary.get(u); if (!set) boundary.set(u, set = new Set()); set.add(v); }
  }
  assert.equal(components(adjacency), 1, 'a separate neck patch is not a sewn shirt stand');
  assert.ok([...boundary.values()].every(neighbors => neighbors.size === 2), 'every remaining opening is a continuous ring');
  assert.equal(components(boundary), 4, 'retain the neck, two cuffs and full folded hem without a fifth front opening');
});

test('the connected neckline actually covers the front neck band in both shirt and covered modes', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  for (const wardrobe of ['shirt', 'coat'] as const) {
    const state = newMotion(), input: MotionInput = { speed: 0, turn: 0, grounded: true, verticalVelocity: 0, ambushWardrobe: wardrobe };
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); shirt.skeleton.pose(); h.rig.root.updateMatrixWorld(true);
    shirt.skeleton.update(); skin.skeleton.update();
    for (const x of [-.12, -.08, 0, .08, .12]) for (const y of [3.78, 3.82, 3.85, 3.875]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      const body = ray.intersectObject(skin)[0], cloth = ray.intersectObject(shirt)[0];
      assert.ok(body, `${wardrobe}/${x}/${y}: compare the delivered real neck surface`);
      assert.ok(cloth && cloth.distance + .006 < body.distance, `${wardrobe}/${x}/${y}: replacing the overlap must retain actual cloth in front of the neck, cloth=${cloth?.distance}, skin=${body.distance}`);
    }
  }
});

test('the complete upper shirt clears itself and every visible inner layer through neck turns and ordinary and scripted poses', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh, p = shirt.geometry.attributes.position;
  const profiles: [string, Partial<MotionInput>][] = [['idle', {}], ['crouch', { crouching: true }], ['walk', { speed: PLAYER_WALK_SPEED }], ['run', { speed: PLAYER_RUN_SPEED }],
    ['phone', { ambushCall: { role: 'morpheus', elapsed: 7 } }]];
  const rows = [];
  for (const [profile, extra] of profiles) for (const yaw of [-.45, 0, .45]) {
    const state = newMotion(), input: MotionInput = { speed: 0, turn: 0, grounded: true, verticalVelocity: 0, ambushWardrobe: 'shirt', ...extra };
    for (let frame = -59; frame <= 30; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.bones.get('head')!.rotation.y += yaw;
    if (input.ambushCall) poseAmbushCallPair({ root: h.rig.root, hero: h.rig } as CharacterRig, undefined, input.ambushCall);
    h.rig.root.updateMatrixWorld(true);
    const all = faces(shirt), upper = all.filter(face => face.ids.some(i => p.getY(i) > 3.65));
    assert.ok(upper.length > 1000 && shirt.visible && all.length > 22000, 'inspect the complete actual upper cloth rather than a hand-picked patch');
    const self = crossings(upper, all), body: { name: string; count: number }[] = [];
    h.rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && object !== shirt) {
      const result = crossings(upper, faces(object), false); if (result.count) body.push({ name: object.name, ...result });
    } });
    rows.push({ profile, yaw, self, body });
  }
  const failed = rows.filter(row => row.self.count || row.body.length);
  assert.deepEqual(failed, [], `the actual neckline overlaps itself or inner layers: ${JSON.stringify(failed.slice(0, 8))}`);
});

test('the complete neck fabric also clears every visible layer of the worn costume through ordinary head turns', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh, p = shirt.geometry.attributes.position;
  const rows = [];
  for (const [profile, speed, crouching] of [['idle', 0, false], ['walk', PLAYER_WALK_SPEED, false], ['run', PLAYER_RUN_SPEED, false], ['crouch', 0, true]] as const) for (const yaw of [-.45, 0, .45]) {
    const state = newMotion(), input: MotionInput = { speed, turn: 0, crouching, grounded: true, verticalVelocity: 0, ambushWardrobe: 'coat' };
    for (let frame = -59; frame <= 30; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.bones.get('head')!.rotation.y += yaw; h.rig.root.updateMatrixWorld(true);
    const neck = faces(shirt).filter(face => face.ids.every(i => p.getY(i) > 3.78 && Math.hypot(p.getX(i), p.getZ(i) - .08) < .4));
    assert.ok(neck.length > 700 && shirt.visible && coat.visible, 'check the full connected stand and real surrounding neck cloth against the visible leather shell');
    const layers: { name: string; count: number }[] = [];
    h.rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh && object !== shirt) {
      const result = crossings(neck, faces(object), false); if (result.count) layers.push({ name: object.name, ...result });
    } });
    rows.push({ profile, yaw, layers });
  }
  assert.deepEqual(rows.filter(row => row.layers.length), [], `the new neckline enters actual worn layers: ${JSON.stringify(rows.filter(row => row.layers.length).slice(0, 6))}`);
});

test('the connected stand has outward lighting normals on its actual nondegenerate cloth faces', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const a = shirt.geometry.attributes, index = shirt.geometry.index!, failed = [];
  assert.ok(index.count > donor.geometry.index!.count, 'retain the attached neck fabric');
  for (let face = donor.geometry.index!.count; face < index.count; face += 3) {
    const ids = [0, 1, 2].map(k => index.getX(face + k)), points = ids.map(i => new THREE.Vector3().fromBufferAttribute(a.position, i));
    const triangle = new THREE.Triangle(points[0], points[1], points[2]);
    assert.ok(triangle.getArea() > 1e-7, `stand face ${face / 3} collapses at the original folded edge`);
    const normal = triangle.getNormal(new THREE.Vector3()), shade = new THREE.Vector3();
    for (const id of ids) {
      const smooth = new THREE.Vector3().fromBufferAttribute(a.normal, id);
      assert.ok(Math.abs(smooth.length() - 1) < 1e-5, `cloth vertex ${id} has an invalid lighting normal`); shade.add(smooth);
    }
    const facing = normal.dot(shade.normalize()); if (facing <= .1) failed.push({ face: face / 3, facing });
  }
  assert.deepEqual(failed, [], 'the outer stand must not inherit inward-facing lighting from the old folded return');
});
