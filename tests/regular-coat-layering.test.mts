import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from '@auto_matrix/shared';
import { actor } from './helpers/fighting-hand-fixture.mts';
import { crossings } from './helpers/hand-self-contact.mts';
import { newMotion, advanceMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

function faces(mesh: THREE.SkinnedMesh) {
  mesh.updateWorldMatrix(true, false); mesh.skeleton.update();
  const index = mesh.geometry.index!, point = new THREE.Vector3();
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, vertex) => mesh.localToWorld(mesh.getVertexPosition(vertex, point)).clone());
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const ids = [0, 1, 2].map(corner => index.getX(face * 3 + corner)), triangle = ids.map(id => points[id]);
    return { face, ids, points: triangle, box: new THREE.Box3().setFromPoints(triangle) };
  });
}

test('Morpheus ordinary coat stays outside the complete undershirt during the pill explanation', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const center = FILM_SETS.film_lafayette.center;
  h.rig.root.position.set(center.x - PILL_ROOM.seat, center.y - 1, center.z + PILL_ROOM.z); h.rig.root.rotation.y = Math.PI / 2;
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true,
    pills: { role: 'morpheus', phase: 'talking', elapsed: 9.902, conversation: { beat: 3, belief: 'agency' } } };
  for (let frame = 0; frame < 90; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateWorldMatrix(true, true);
  const coat = h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('Black_crew_neck') as THREE.SkinnedMesh;
  assert.ok(coat.visible && shirt.visible);
  assert.equal(coat.geometry.attributes.position.count, 8255, 'keep the complete original coat');
  assert.equal(shirt.geometry.attributes.position.count, 3839, 'keep the complete original undershirt');
  const contact = crossings(faces(coat), faces(shirt), false);
  t.diagnostic(JSON.stringify(contact));
  assert.equal(contact.count, 0, `the undershirt breaks through the worn coat: ${JSON.stringify(contact)}`);
});

test('the ordinary coat also clears its complete undershirt through walking and running', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  h.rig.root.position.set(3, 2, -4); h.rig.root.rotation.y = .43;
  const coat = h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('Black_crew_neck') as THREE.SkinnedMesh;
  for (const speed of [PLAYER_WALK_SPEED, PLAYER_RUN_SPEED]) {
    const state = newMotion(), input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: 0 };
    for (let frame = 1; frame <= 120; frame++) {
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame % 20) continue;
      h.rig.root.updateWorldMatrix(true, true);
      const contact = crossings(faces(coat), faces(shirt), false);
      assert.equal(contact.count, 0, `${speed}/${frame}: ${JSON.stringify(contact)}`);
    }
  }
});

test('the ordinary fit preserves its source and skinning and restores exactly after the lesson outfit', async t => {
  let source: THREE.BufferGeometry, sourceCoat: THREE.BufferGeometry;
  let sourcePositions: Float32Array, sourceNormals: Float32Array;
  const h = await actor('morpheus', scene => {
    source = (scene.getObjectByName('Black_crew_neck') as THREE.Mesh).geometry;
    sourceCoat = (scene.getObjectByName('Tailored_coat_upper') as THREE.Mesh).geometry;
    sourcePositions = new Float32Array(source.attributes.position.array); sourceNormals = new Float32Array(source.attributes.normal.array);
  });
  t.after(() => h.models.dispose());
  const coat = h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  const shirt = h.rig.root.getObjectByName('Black_crew_neck') as THREE.SkinnedMesh, fitted = shirt.geometry;
  assert.deepEqual(coat.geometry.attributes.position.array, sourceCoat!.attributes.position.array, 'retain the authored coat fit');
  assert.deepEqual(coat.geometry.attributes.normal.array, sourceCoat!.attributes.normal.array, 'retain the authored coat normals');
  assert.notEqual(fitted, source!);
  assert.deepEqual(source!.attributes.position.array, sourcePositions!); assert.deepEqual(source!.attributes.normal.array, sourceNormals!);
  assert.deepEqual(fitted.index!.array, source!.index!.array);
  // Rig preparation adds twist joints before the wardrobe receives its input.
  const prepared = h.models['constructSuits'].get(h.rig)!['originalShirt'];
  for (const name of ['uv', 'skinIndex', 'skinWeight']) assert.deepEqual(fitted.attributes[name].array, prepared.attributes[name].array, name);
  assert.notDeepEqual(fitted.attributes.position.array, sourcePositions!);
  const ordinary = [new Float32Array(fitted.attributes.position.array), new Float32Array(fitted.attributes.normal.array)];
  const normal = new THREE.Vector3();
  for (let vertex = 0; vertex < fitted.attributes.normal.count; vertex++) {
    normal.fromBufferAttribute(fitted.attributes.normal, vertex); assert.ok(normal.toArray().every(Number.isFinite));
    assert.ok(Math.abs(normal.length() - 1) < 2e-6);
  }
  const state = newMotion();
  const draw = (outfit: Partial<MotionInput>) => {
    const input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, ...outfit };
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  };
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const outfit of [{ constructSuit: true }, { realWorld: true }, { ambushWardrobe: 'coat' }, { ambushWardrobe: 'shirt' }] as Partial<MotionInput>[]) {
      draw(outfit); assert.equal(shirt.geometry, prepared, 'the other outfits retain their original inner layer');
      draw({}); assert.equal(shirt.geometry, fitted);
    }
    assert.deepEqual(fitted.attributes.position.array, ordinary[0]); assert.deepEqual(fitted.attributes.normal.array, ordinary[1]);
  }
  let releases = 0; fitted.addEventListener('dispose', () => releases++);
  h.models.dispose(); assert.equal(releases, 1, 'the owned fitted geometry must be released exactly once');
});

test('easing the ordinary coat cannot add self crossings at the seated armholes', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const center = FILM_SETS.film_lafayette.center;
  h.rig.root.position.set(center.x - PILL_ROOM.seat, center.y - 1, center.z + PILL_ROOM.z); h.rig.root.rotation.y = Math.PI / 2;
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, seated: true,
    pills: { role: 'morpheus', phase: 'talking', elapsed: 9.902, conversation: { beat: 3, belief: 'agency' } } };
  for (let frame = 0; frame < 90; frame++) h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
  h.rig.root.updateWorldMatrix(true, true);
  const coat = h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh, fitted = coat.geometry;
  const current = faces(coat);
  let original: ReturnType<typeof faces>;
  try { coat.geometry = h.models['constructSuits'].get(h.rig)!['originalJacket']; original = faces(coat); }
  finally { coat.geometry = fitted; }
  const source = crossings(original!, original!), candidate = crossings(current, current);
  t.diagnostic(JSON.stringify({ source, candidate }));
  assert.ok(candidate.count <= source.count, 'clearing the inner shirt must not introduce more cloth self crossings');
  assert.equal(crossings([current[4118]], [current[4121]]).count, 0, 'the actual two back-armhole faces must not fold through one another');
});

test('the fitted inner layer stays free of self crossings and its changed faces clear the complete skin', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose());
  const shirt = h.rig.root.getObjectByName('Black_crew_neck') as THREE.SkinnedMesh;
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const coat = h.rig.root.getObjectByName('Tailored_coat_upper') as THREE.SkinnedMesh;
  const original = h.models['constructSuits'].get(h.rig)!['originalShirt'].attributes.position, fitted = shirt.geometry.attributes.position;
  const moved = Array.from({ length: fitted.count }, (_, i) => [0, 1, 2].some(k => fitted.getComponent(i, k) !== original.getComponent(i, k)));
  assert.ok(moved.some(Boolean), 'check the actual fitted inner layer');
  const verify = (name: string) => {
    h.rig.root.updateWorldMatrix(true, true);
    const cloth = faces(shirt), body = faces(skin);
    assert.equal(crossings(faces(coat), cloth, false).count, 0, `${name}: complete coat and shirt`);
    assert.equal(crossings(cloth, cloth).count, 0, `${name}: complete inner layer self contact`);
    assert.equal(crossings(cloth.filter(face => face.ids.some(id => moved[id])), body, false).count, 0, `${name}: fitted faces must not move into the skin`);
  };
  verify('bind pose');
  const center = FILM_SETS.film_lafayette.center;
  h.rig.root.position.set(center.x - PILL_ROOM.seat, center.y - 1, center.z + PILL_ROOM.z); h.rig.root.rotation.y = Math.PI / 2;
  for (const profile of ['idle', 'pill', 'walk', 'run']) {
    const state = newMotion(), input: MotionInput = { speed: profile === 'walk' ? PLAYER_WALK_SPEED : profile === 'run' ? PLAYER_RUN_SPEED : 0,
      grounded: true, verticalVelocity: 0, turn: 0, ...(profile === 'pill' ? { seated: true,
        pills: { role: 'morpheus', phase: 'talking', elapsed: 9.902, conversation: { beat: 3, belief: 'agency' } } } as Partial<MotionInput> : {}) };
    for (let frame = 1; frame <= 120; frame++) {
      h.models.animate(h.rig, advanceMotion(state, input, 1 / 60), state, input, 1 / 60);
      if (frame % 20 === 0) verify(`${profile}/${frame}`);
    }
  }
});
