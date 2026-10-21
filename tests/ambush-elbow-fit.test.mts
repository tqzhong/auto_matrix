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
function faces(mesh: THREE.Mesh): Face[] {
  if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update(); const { position } = mesh.geometry.attributes, index = mesh.geometry.index!;
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

test('the complete old-building upper coat does not fold through itself at the real guarding elbows', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
    attack: 1, combo: 2, ambushWardrobe: 'coat' };
  for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  const coat = h.rig.root.getObjectByName('morpheus-ambush-coat') as THREE.SkinnedMesh;
  assert.ok(coat.visible && coat.geometry.index!.count / 3 > 20000, 'keep the complete real upper coat');
  const surface = faces(coat), result = crossings(surface, surface, true);
  assert.equal(result.count, 0, `the guarding leather sleeves cross themselves: ${JSON.stringify(result)}`);
});

test('the complete underlying shirt does not fold through itself with the same guarding arms', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0,
    attack: 1, combo: 2, ambushWardrobe: 'coat' };
  for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  assert.ok(shirt.visible && shirt.geometry.index!.count / 3 > 22000, 'keep the actual complete shirt under the coat');
  const surface = faces(shirt), result = crossings(surface, surface, true);
  assert.equal(result.count, 0, `the guarding woven sleeves cross themselves: ${JSON.stringify(result)}`);
});

test('the real fitted elbow layers remain separate without deleting faces or changing their UVs and skin weights', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const meshes = ['morpheus-ambush-coat', 'morpheus-ambush-shirt'].map(name => h.rig.root.getObjectByName(name) as THREE.SkinnedMesh);
  const original = meshes.map(mesh => Object.fromEntries(['uv', 'skinIndex', 'skinWeight'].map(name => [name, Array.from(mesh.geometry.attributes[name].array)])));
  const topology = meshes.map(mesh => Array.from(mesh.geometry.index!.array));
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' };
  h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
  for (let frame = 0; frame < 54; frame++) {
    h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    if (![6, 15, 25, 37].includes(frame)) continue;
    h.rig.root.updateMatrixWorld(true);
    const surface = meshes.map(faces), result = crossings(surface[0], surface[1], false);
    const skin = faces(h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh);
    assert.equal(result.count, 0, `${frame}: leather crosses the actual whole shirt: ${JSON.stringify(result)}`);
    for (const [i, mesh] of meshes.entries()) {
      assert.equal(crossings(surface[i], surface[i]).count, 0, `${frame}/${mesh.name}: the complete garment folds through itself`);
      const body = crossings(surface[i], skin, false);
      assert.equal(body.count, 0, `${frame}/${mesh.name}: the rounded sleeve crosses the actual body: ${JSON.stringify(body)}`);
      assert.deepEqual(Array.from(mesh.geometry.index!.array), topology[i], 'retain every original face and its winding');
      for (const name of ['uv', 'skinIndex', 'skinWeight']) assert.deepEqual(Array.from(mesh.geometry.attributes[name].array), original[i][name]);
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        const point = mesh.getVertexPosition(vertex, new THREE.Vector3());
        assert.ok(point.toArray().every(Number.isFinite));
        assert.ok(mesh.frustumCulled && mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), `${frame}/${mesh.name}/${vertex}: the deformed garment escapes its real render bounds`);
      }
    }
  }
});

test('both actual sleeves preserve a paused and cold guard, then restore their original surface on leaving the old-building costume', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  const meshes = (actor: typeof h) => ['morpheus-ambush-coat', 'morpheus-ambush-shirt'].map(name => actor.rig.root.getObjectByName(name) as THREE.SkinnedMesh);
  const attributes = (mesh: THREE.SkinnedMesh) => ['position', 'normal'].map(name => Array.from(mesh.geometry.attributes[name].array));
  const before = meshes(h).map(attributes);
  const arms = meshes(h).map(mesh => Array.from({ length: mesh.geometry.attributes.position.count }, (_, id) => id).filter(id =>
    [0, 1, 2, 3].reduce((sum, k) => sum + (/^(shoulder|elbow|wrist|forearm_twist)_[RL]/.test(mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(id, k)].name)
      ? mesh.geometry.attributes.skinWeight.getComponent(id, k) : 0), 0) > .99));
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, attack: 1, combo: 2, ambushWardrobe: 'coat' };
  for (const actor of [h, cold]) { actor.rig.root.position.set(-3, 4, 2); actor.rig.root.rotation.y = -.31; }
  for (let frame = 0; frame <= 15; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  const saved = structuredClone(state), surface = meshes(h).map(attributes);
  assert.ok(meshes(h).some((_, layer) => arms[layer].some(id => [0, 1, 2].some(axis => before[layer][0][id * 3 + axis] !== surface[layer][0][id * 3 + axis]))), 'exercise an actual nonzero elbow correction');
  const versions = meshes(h).map(mesh => ['position', 'normal'].map(name => mesh.geometry.attributes[name].version));
  const hands = ['wrist_R', 'wrist_L', 'finger2-3_R', 'finger2-3_L'].map(name => h.rig.bones.get(name)!.matrixWorld.clone());
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  assert.deepEqual(meshes(h).map(attributes), surface);
  assert.deepEqual(meshes(h).map(mesh => ['position', 'normal'].map(name => mesh.geometry.attributes[name].version)), versions, 'paused corrected sleeves do not upload new GPU buffers');
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0);
  for (const [layer, mesh] of meshes(cold).entries()) for (const [attribute, values] of attributes(mesh).entries()) {
    assert.ok(values.every((value, i) => Math.abs(value - surface[layer][attribute][i]) < 1e-6), `${mesh.name}: cold geometry and shading reconstruct the saved pose`);
  }
  for (const [i, name] of ['wrist_R', 'wrist_L', 'finger2-3_R', 'finger2-3_L'].entries()) assert.ok(cold.rig.bones.get(name)!.matrixWorld.elements.every((value, k) => Math.abs(value - hands[i].elements[k]) < 1e-6), 'saved real hand contacts remain deterministic');
  const outside = { ...input, realWorld: true, ambushWardrobe: undefined };
  h.models.animate(h.rig, advanceMotion(state, outside, 0), state, outside, 0);
  for (const [layer, mesh] of meshes(h).entries()) {
    assert.equal(mesh.visible, false);
    for (const [attribute, values] of attributes(mesh).entries()) for (const id of arms[layer]) for (let axis = 0; axis < 3; axis++) {
      assert.equal(values[id * 3 + axis], before[layer][attribute][id * 3 + axis], `${mesh.name}: release the original arm surface and normals`);
    }
  }
});
