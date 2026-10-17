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

test('the full actual shirt hem retains its folded thickness through ordinary poses', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const source = h.rig.root.getObjectByName('morpheus-hammer-sweater') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const a = source.geometry.attributes, index = source.geometry.index!, pairs = new Map<number, { outer: number; inner: number; thickness: number }>();
  for (let face = 0; face < index.count; face += 3) for (let edge = 0; edge < 3; edge++) {
    const first = index.getX(face + edge), second = index.getX(face + (edge + 1) % 3);
    const firstHem = Math.abs(a.position.getY(first) - 2.38) < 1e-6, secondHem = Math.abs(a.position.getY(second) - 2.38) < 1e-6;
    if (firstHem === secondHem || Math.hypot(a.uv.getX(first) - a.uv.getX(second), a.uv.getY(first) - a.uv.getY(second)) > 1e-7) continue;
    const outer = firstHem ? first : second, inner = firstHem ? second : first;
    const thickness = new THREE.Vector3().fromBufferAttribute(a.position, outer).distanceTo(new THREE.Vector3().fromBufferAttribute(a.position, inner));
    pairs.set(inner, { outer, inner, thickness });
  }
  assert.ok(pairs.size > 80, 'retain the complete real donor fold, including front and sides');
  assert.equal(new Set([...pairs.values()].map(({ outer }) => `${Math.sign(a.position.getX(outer))},${Math.sign(a.position.getZ(outer))}`)).size, 4);
  const motion = newMotion();
  for (const speed of [0, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED]) {
    const input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'shirt' };
    for (let frame = 0; frame < 90; frame++) h.models.animate(h.rig, advanceMotion(motion, input, 1 / 60), motion, input, 1 / 60);
    h.rig.root.updateMatrixWorld(true); shirt.skeleton.update();
    const damaged = [...pairs.values()].map(pair => ({ ...pair, posed: shirt.getVertexPosition(pair.outer, new THREE.Vector3()).distanceTo(shirt.getVertexPosition(pair.inner, new THREE.Vector3())) }))
      .filter(pair => pair.posed < pair.thickness * .5 || pair.posed > pair.thickness * 1.5);
    assert.deepEqual(damaged, [], `speed ${speed}: actual folded hem collapses or spreads into a flange`);
  }
});
