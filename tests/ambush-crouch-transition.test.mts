import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED } from '@auto_matrix/shared';
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

function points(mesh: THREE.Mesh) {
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
}

test('entering and leaving a free old-building crouch keeps actual pelvis and wrists continuous', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const state = newMotion(); let previous: THREE.Vector3[] | undefined;
  for (let frame = -30; frame <= 120; frame++) {
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat', crouching: frame >= 0 && frame < 60 };
    h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); h.rig.root.updateMatrixWorld(true);
    const current = ['pelvis', 'wrist_R', 'wrist_L'].map(name => h.rig.bones.get(name)!.getWorldPosition(new THREE.Vector3()));
    if (previous) for (const [i, point] of current.entries()) assert.ok(point.distanceTo(previous[i]) < .25, `${frame}/${i}: a free crouch teleports the actual body by ${point.distanceTo(previous[i])}`);
    previous = current;
  }
});

test('shirt and coat surfaces blend into and out of the crouch without an abrupt wardrobe change', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  for (const wardrobe of ['shirt', 'coat'] as const) {
    const state = newMotion(); let previous: THREE.Vector3[][] | undefined;
    const garments = ['morpheus-ambush-shirt', 'morpheus-ambush-coat', 'morpheus-ambush-lapels']
      .filter(name => wardrobe === 'coat' || name === 'morpheus-ambush-shirt').map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
    for (let frame = -30; frame <= 120; frame++) {
      const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: wardrobe, crouching: frame >= 0 && frame < 60 };
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); h.rig.root.updateMatrixWorld(true);
      const current = garments.map(mesh => points(mesh));
      assert.ok(garments.every(mesh => mesh.visible), 'the same complete garments stay visible');
      if (previous) for (const [part, surface] of current.entries()) {
        const jump = surface.reduce((max, point, i) => Math.max(max, point.distanceTo(previous![part][i])), 0);
        assert.ok(jump < .25, `${wardrobe}/${frame}/${garments[part].name}: an actual cloth point teleports by ${jump}`);
      }
      previous = current;
    }
  }
});

test('a saved partial crouch restores its complete real outfit cold and does not drift while paused', async t => {
  const h = await model(), cold = await model(); t.after(() => { h.models.dispose(); cold.models.dispose(); });
  for (const actor of [h, cold]) { actor.rig.root.position.set(-3, 4, 2); actor.rig.root.rotation.y = -.31; }
  const state = newMotion();
  const input: MotionInput = { speed: PLAYER_WALK_SPEED, grounded: true, verticalVelocity: 0, turn: -.4, ambushWardrobe: 'coat', crouching: true };
  for (let frame = -30; frame <= 3; frame++) {
    const current = { ...input, crouching: frame >= 0 };
    h.models.animate(h.rig, advanceMotion(state, current, 1 / 60), state, current, 1 / 60);
  }
  assert.ok(state.ambushCrouch! > 0 && state.ambushCrouch! < 1, 'the saved local motion is partway through the crouch');
  h.rig.root.updateMatrixWorld(true);
  const names = ['morpheus-ambush-shirt', 'morpheus-ambush-coat', 'morpheus-ambush-lapels'];
  const before = [...names.map(name => points(h.rig.root.getObjectByName(name) as THREE.Mesh)), ...h.rig.panels.map(panel => points(panel.mesh))], saved = structuredClone(state);
  for (let frame = 0; frame < 10; frame++) h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  h.rig.root.updateMatrixWorld(true);
  const after = [...names.map(name => points(h.rig.root.getObjectByName(name) as THREE.Mesh)), ...h.rig.panels.map(panel => points(panel.mesh))];
  assert.ok(after.every((surface, j) => surface.every((p, i) => p.distanceTo(before[j][i]) < 1e-6)));
  cold.models.animate(cold.rig, advanceMotion(saved, input, 0), saved, input, 0); cold.rig.root.updateMatrixWorld(true);
  const restored = [...names.map(name => points(cold.rig.root.getObjectByName(name) as THREE.Mesh)), ...cold.rig.panels.map(panel => points(panel.mesh))];
  assert.ok(restored.every((surface, j) => surface.every((p, i) => p.distanceTo(before[j][i]) < 1e-6)), 'a fresh asset and saved motion retain the actual partial crouch');
  const outside = { ...input, ambushWardrobe: undefined, realWorld: true, crouching: false };
  h.models.animate(h.rig, advanceMotion(state, outside, 0), state, outside, 0);
  assert.equal(state.ambushCrouch, undefined, 'leaving the old building clears its local crouch blend');
  for (const name of names) {
    const mesh = h.rig.root.getObjectByName(name) as THREE.Mesh;
    assert.equal(mesh.visible, false);
    assert.ok((mesh.morphTargetInfluences ?? []).every(value => value === 0));
  }
});
