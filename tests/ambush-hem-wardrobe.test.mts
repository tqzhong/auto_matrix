import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, FILM_SETS, ambushRouteRoot, ambushFloor } from '@auto_matrix/shared';
import { HeroModels, type HeroRig } from '../packages/client/src/agents/HeroModel.js';
import type { AmbushCoatTails } from '../packages/client/src/agents/AmbushCoatTails.js';
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

test('tail contacts match Three skinning through saved poses without rebuilding a bone matrix per vertex', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  const wardrobe = (h.models as unknown as { ambushWardrobes: Map<HeroRig, { tails: AmbushCoatTails }> }).ambushWardrobes.get(h.rig)!;
  const surfaces = (wardrobe.tails as unknown as { inner: { mesh: THREE.SkinnedMesh; vertices: Uint32Array; points: Float64Array }[] }).inner;
  const state = newMotion(), input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: -.4, ambushWardrobe: 'coat' };
  h.rig.root.position.set(-3, 4, 2); h.rig.root.rotation.y = -.31;
  let worst = 0;
  for (const crouching of [false, true]) {
    const pose = { ...input, crouching };
    for (let frame = 0; frame < 20; frame++) h.models.animate(h.rig, advanceMotion(state, pose, 1 / 60), state, pose, 1 / 60);
    const saved = structuredClone(state), multiply = THREE.Matrix4.prototype.multiplyMatrices;
    let products = 0;
    THREE.Matrix4.prototype.multiplyMatrices = function (a, b) { products++; return multiply.call(this, a, b); };
    try { wardrobe.tails.update(saved, .15); } finally { THREE.Matrix4.prototype.multiplyMatrices = multiply; }
    const boneCount = surfaces.reduce((sum, surface) => sum + surface.mesh.skeleton.bones.length, 0);
    t.diagnostic(`crouch ${crouching}: ${products} matrix products / ${boneCount} bones`);
    assert.ok(products <= boneCount * 4, 'contact skinning must build transforms per bone instead of per weighted vertex');
    const inverse = h.rig.bones.get('pelvis')!.matrixWorld.clone().invert(), point = new THREE.Vector3();
    for (const surface of surfaces) {
      const transform = inverse.clone().multiply(surface.mesh.matrixWorld);
      for (const [i, id] of surface.vertices.entries()) {
        surface.mesh.getVertexPosition(id, point).applyMatrix4(transform);
        worst = Math.max(worst, point.distanceTo(new THREE.Vector3().fromArray(surface.points, i * 3)));
      }
    }
    assert.ok(worst < 1e-12, `actual contact surface differs from Three by ${worst}`);
    assert.deepEqual(state, saved, 'fitting the same saved pose does not advance motion');
  }
  t.diagnostic(`all selected real contact vertices agree within ${worst}`);
});

test('stair cloth keeps its floor clearance without refreshing the transform for every vertex', async t => {
  const h = await model(); t.after(() => h.models.dispose());
  // Extend one hem corner in memory so the floor pass must correct a contact.
  for (const panel of h.rig.panels) panel.rest[panel.rest.length - 2] -= 2;
  const center = FILM_SETS.film_ambush_house.center, state = newMotion();
  const input: MotionInput = { speed: PLAYER_RUN_SPEED, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' };
  for (const progress of [24.95, 48.95]) {
    const root = ambushRouteRoot(progress, 'morpheus');
    h.rig.root.position.set(center.x + root.x, center.y - 1 + root.y, center.z + root.z); h.rig.root.rotation.y = root.yaw;
    let updates = 0;
    const originals = h.rig.panels.map(({ mesh }) => mesh.updateWorldMatrix);
    for (const { mesh } of h.rig.panels) {
      const update = mesh.updateWorldMatrix;
      mesh.updateWorldMatrix = function (...args) { updates++; update.apply(this, args); };
    }
    try { h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60); }
    finally { h.rig.panels.forEach(({ mesh }, i) => { mesh.updateWorldMatrix = originals[i]; }); }
    t.diagnostic(`${progress}: ${updates} panel world updates`);
    // Include the ordinary whole-body pose refreshes as well as the floor pass.
    assert.ok(updates <= h.rig.panels.length * 8, 'floor fitting must share a posed panel transform across every vertex');
    let contacts = 0;
    for (const { mesh } of h.rig.panels) {
      assert.ok(mesh.visible);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        const floor = ambushFloor(point.x - center.x, point.z - center.z, root.y);
        if (floor === undefined) continue;
        assert.ok(point.y >= center.y - 1 + floor + .025 - 1e-5, `panel vertex ${i} crosses its actual tread`);
        if (point.y < center.y - 1 + floor + .026) contacts++;
      }
    }
    t.diagnostic(`${progress}: ${contacts} cloth vertices corrected to the tread`);
    assert.ok(contacts > 0, 'the regression must exercise actual cloth contacts with the stairs');
  }
});
