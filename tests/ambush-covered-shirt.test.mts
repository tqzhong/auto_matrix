import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';
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

function surface(mesh: THREE.SkinnedMesh) {
  mesh.skeleton.update();
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
}

test('wearing leather preserves the complete fitted inner shirt through the same saved ordinary motion', async t => {
  for (const speed of [0, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED]) {
    const h = await model(); t.after(() => h.models.dispose());
    h.rig.root.position.set(4, 2, -3); h.rig.root.rotation.y = .43;
    const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
    const state = newMotion(), input: MotionInput = { speed, turn: .4, grounded: true, verticalVelocity: 0, ambushWardrobe: 'shirt' };
    for (let frame = -59; frame <= 30; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true);
    const fitted = surface(shirt), a = shirt.geometry.attributes;
    const versions = [a.position.version, a.normal.version, a.skinIndex.version, a.skinWeight.version];
    const covered = { ...input, ambushWardrobe: 'coat' as const };
    h.models.animate(h.rig, advanceMotion(state, covered, 0), state, covered, 0); h.rig.root.updateMatrixWorld(true);
    const actual = surface(shirt), worst = Math.max(...actual.map((point, i) => point.distanceTo(fitted[i])));
    assert.ok(worst < 1e-6, `${speed}: the same saved pose changes the inner fabric by ${worst} when covered, reintroducing its old cut or binding`);
    assert.deepEqual([a.position.version, a.normal.version, a.skinIndex.version, a.skinWeight.version], versions, 'the outer-layer switch keeps the shared fitted cut without uploading replacement bindings');
    for (let i = 0; i < a.position.count; i++) {
      const point = shirt.getVertexPosition(i, new THREE.Vector3());
      assert.ok(shirt.boundingBox!.containsPoint(point) && shirt.boundingSphere!.containsPoint(point), `covered fabric vertex ${i} escapes its actual skin bounds`);
    }
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0); h.rig.root.updateMatrixWorld(true);
    assert.ok(surface(shirt).every((point, i) => point.distanceTo(fitted[i]) < 1e-6), 'removing leather keeps the same actual inner garment');
  }
});

test('a covered fitted shirt survives pause and cold reconstruction while leaving restores the original donor', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  for (const actor of [h, cold]) { actor.rig.root.position.set(-3, 4, 2); actor.rig.root.rotation.y = -.31; }
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const donor = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const original = Array.from(donor.geometry.attributes.position.array), state = newMotion();
  const input: MotionInput = { speed: PLAYER_RUN_SPEED, turn: -.4, grounded: true, verticalVelocity: 0, ambushWardrobe: 'coat' };
  for (let frame = 0; frame < 127; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateMatrixWorld(true);
  assert.equal(shirt.morphTargetInfluences![0], 1, 'leather cannot disable the actual inner fitting');
  const before = surface(shirt), saved = structuredClone(state);
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true); assert.ok(surface(shirt).every((point, i) => point.distanceTo(before[i]) < 1e-6));
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0); cold.rig.root.updateMatrixWorld(true);
  assert.ok(surface(cold.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh).every((point, i) => point.distanceTo(before[i]) < 1e-6), 'the saved covered cloth rebuilds on a fresh real asset');
  const outside = { ...input, realWorld: true, ambushWardrobe: undefined };
  h.models.animate(h.rig, advanceMotion(state, outside, 0), state, outside, 0); h.rig.root.updateMatrixWorld(true);
  assert.equal(shirt.visible, false); assert.ok(shirt.morphTargetInfluences!.every(weight => weight === 0));
  assert.deepEqual(Array.from(donor.geometry.attributes.position.array), original); assert.ok(donor.morphTargetInfluences!.every(weight => weight === 0));
});
