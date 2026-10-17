import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';
import { HeroModels } from '../packages/client/src/agents/HeroModel.js';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

async function model(hemFit = true) {
  const raw = await readFile(new URL('../packages/client/public/assets/characters/morpheus.glb', import.meta.url)), length = raw.readUInt32LE(12);
  const document = JSON.parse(raw.subarray(20, 20 + length).toString());
  for (const material of document.materials) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.normalTexture; }
  document.images = []; document.textures = [];
  if (!hemFit) delete document.nodes.find((node: { name?: string }) => node.name === 'morpheus-hammer-sweater').extras.ambushHemFit;
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

test('covering retains the repaired hem and leaving the garment restores its original binding', async t => {
  const current = await model(), reference = await model(false); t.after(() => { current.models.dispose(); reference.models.dispose(); });
  for (const h of [current, reference]) { h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43; }
  const shirt = current.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const original = reference.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const points = (mesh: THREE.SkinnedMesh) => { mesh.skeleton.update(); return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)); };
  const state = newMotion(), input: MotionInput = { speed: PLAYER_RUN_SPEED, turn: .4, grounded: true, verticalVelocity: 0, ambushWardrobe: 'shirt' };
  for (let frame = -59; frame <= 30; frame++) current.models.animate(current.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  current.rig.root.updateMatrixWorld(true);
  const fitted = points(shirt), covered = { ...input, ambushWardrobe: 'coat' as const }, saved = JSON.parse(JSON.stringify(state));
  const a = shirt.geometry.attributes, b = original.geometry.attributes;
  const fittedIndices = Array.from(a.skinIndex.array), fittedWeights = Array.from(a.skinWeight.array);
  current.models.animate(current.rig, advanceMotion(state, covered, 0), state, covered, 0);
  current.rig.root.updateMatrixWorld(true);
  const actual = points(shirt), worst = Math.max(...actual.map((point, i) => point.distanceTo(fitted[i])));
  assert.ok(worst < 1e-6, `the leather layer changes the actual repaired inner hem by ${worst}`);
  assert.deepEqual(Array.from(a.skinIndex.array), fittedIndices);
  assert.deepEqual(Array.from(a.skinWeight.array), fittedWeights);
  const versions = [a.skinIndex.version, a.skinWeight.version];
  for (let frame = 0; frame < 10; frame++) current.models.animate(current.rig, advanceMotion(state, covered, 0), state, covered, 0);
  current.rig.root.updateMatrixWorld(true);
  assert.deepEqual([a.skinIndex.version, a.skinWeight.version], versions, 'unchanged wardrobe does not upload the binding each frame');
  for (let i = 0; i < a.position.count; i++) {
    const point = shirt.getVertexPosition(i, new THREE.Vector3());
    assert.ok(shirt.boundingBox!.containsPoint(point) && shirt.boundingSphere!.containsPoint(point), `covered vertex ${i} leaves its actual culling envelope`);
  }
  current.models.animate(current.rig, advanceMotion(state, input, 0), state, input, 0); current.rig.root.updateMatrixWorld(true);
  assert.ok(points(shirt).every((point, i) => point.distanceTo(fitted[i]) < 1e-6), 'returning to shirt-only recreates the complete repaired surface');
  const outside = { ...input, ambushWardrobe: undefined, realWorld: true };
  current.models.animate(current.rig, advanceMotion(state, outside, 0), state, outside, 0);
  reference.models.animate(reference.rig, advanceMotion(saved, outside, 0), saved, outside, 0);
  current.rig.root.updateMatrixWorld(true); reference.rig.root.updateMatrixWorld(true);
  assert.equal(shirt.visible, false);
  assert.deepEqual(Array.from(a.skinIndex.array), Array.from(b.skinIndex.array), 'leaving releases the original borrowed joint indices');
  assert.deepEqual(Array.from(a.skinWeight.array), Array.from(b.skinWeight.array), 'leaving releases the original borrowed weights');
  const expected = points(original);
  assert.ok(points(shirt).every((point, i) => point.distanceTo(expected[i]) < 1e-6), 'inactive cloth agrees with the independently unrepaired donor');
});
