import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeModel, meshSurface, worldPoints } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { auditCage } from '../morpheus-ambush-doff-2026-10-17/cloth-rebuild/cage-contact.mjs';
import { FrontExitBody as WithdrawalBody } from './FrontExitBody.mjs';

const shoulderRelease = process.env.MORPHEUS_SHOULDER_RELEASE === 'front-exit' ? 'front-exit' : process.env.MORPHEUS_SHOULDER_RELEASE === '1';

function shirtAndInnerLayers(h: Awaited<ReturnType<typeof makeModel>>) {
  const shirt = h.rig.root.getObjectByName('morpheus-ambush-shirt') as THREE.SkinnedMesh;
  const outer = [h.rig.root.getObjectByName('morpheus-ambush-coat'), h.rig.root.getObjectByName('morpheus-ambush-lapels'), ...h.rig.panels.map(panel => panel.mesh)];
  const inner: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && object !== shirt && !outer.includes(object)) inner.push(object); });
  assert.equal(inner.length, 12, 'include wrist skin, collar and tie as well as the main skin');
  return { shirt, inner };
}

test('both elbows retain their authored flexion axis while reaching the withdrawal path', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, 'front-exit');
  for (const time of [.4, .8, 1.6, 2, 2.4, 3.2, 3.8, 6.4, 8]) {
    body.pose(time);
    for (const side of ['R', 'L']) {
      const elbow = h.rig.bones.get(`elbow_${side}`)!;
      assert.ok(Math.hypot(elbow.quaternion.y, elbow.quaternion.z) < 1e-6,
        `${side} elbow bends sideways at ${time}: ${elbow.quaternion.toArray()}`);
    }
    assert.ok(body.errors.every(error => error.distance < 1e-6), `unreachable wrists at ${time}`);
  }
});

test('hands move around the full leather tails while preparing to withdraw the sleeves', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, shoulderRelease);
  const clothes = ['morpheus-ambush-coat', 'morpheus-ambush-lapels'].map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
  clothes.push(...h.rig.panels.map(panel => panel.mesh));
  const bodies: THREE.Mesh[] = [];
  h.rig.root.traverseVisible(object => { if (object instanceof THREE.Mesh && !clothes.includes(object)) bodies.push(object); });
  const rows = [];
  for (let frame = 0; frame <= 48; frame++) {
    const time = frame / 60; body.pose(time);
    const vertices: number[][] = [], indices: number[] = [];
    for (const mesh of clothes) {
      const surface = meshSurface(mesh);
      indices.push(...surface.indices.map(id => id + vertices.length)); vertices.push(...surface.vertices);
    }
    assert.equal(indices.length / 3, 26916, 'keep the complete current coat, lapels and both tails');
    const result = auditCage({ vertices, indices }, bodies.map(mesh => meshSurface(mesh)));
    rows.push({ time, self: result.selfCount, body: result.bodyCount });
  }
  console.log(JSON.stringify({ preparation: rows }));
  assert.ok(rows.every(row => row.self === 0 && row.body === 0), `hands cross the leather garment: ${JSON.stringify(rows)}`);
});

test('withdrawing the arms does not introduce shirt folds through the torso or hands', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, shoulderRelease);
  const { shirt, inner } = shirtAndInnerLayers(h);
  const initial = auditCage(meshSurface(shirt), inner.map(mesh => meshSurface(mesh)));
  assert.equal(initial.selfCount, 0, 'the corrected centre seam must not reintroduce the old 23 crossings');
  const results = [];
  for (const time of [0, .4, .8, 1.2, 1.6, 2, 2.4, 2.6, 2.8, 3, 3.1, 3.2]) {
    body.pose(time);
    const result = auditCage(meshSurface(shirt), inner.map(mesh => meshSurface(mesh)));
    results.push({ time, self: result.selfCount, inner: result.bodyCount,
      reachError: Math.max(...body.errors.map(row => row.distance), 0) });
  }
  console.log(JSON.stringify({ baseline: initial.selfCount, results }));
  assert.ok(results.every(row => row.self === 0 && row.inner === 0), `arms enter the torso or shirt: ${JSON.stringify(results)}`);
  assert.ok(results.every(row => row.reachError < 1e-6), 'both wrist paths must be reachable without hidden clamping');
});

test('the withdrawal keeps planted feet and restores identical saved body surfaces', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, shoulderRelease);
  const feet = ['R', 'L'].map(side => h.rig.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()));
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  let previous = worldPoints(skin), maximumStep = 0, maximumFootDrift = 0, maximumReachError = 0;
  for (let frame = 0; frame <= 480; frame++) {
    body.pose(frame / 60);
    const points = worldPoints(skin);
    maximumStep = Math.max(maximumStep, ...points.map((point, i) => point.distanceTo(previous[i])));
    maximumReachError = Math.max(maximumReachError, ...body.errors.map(row => row.distance));
    previous = points;
    for (const [i, side] of ['R', 'L'].entries()) maximumFootDrift = Math.max(maximumFootDrift, h.rig.bones.get(`ankle_${side}`)!.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i]));
  }
  body.pose(2.9); const saved = worldPoints(skin);
  body.pose(.4); body.pose(2.9);
  const restored = worldPoints(skin);
  console.log(JSON.stringify({ maximumStep, maximumFootDrift, maximumReachError }));
  assert.ok(maximumFootDrift < 1e-6, `planted feet drift ${maximumFootDrift}`);
  assert.ok(maximumStep < .08, `body jumps ${maximumStep} in one 60 Hz step`);
  assert.ok(maximumReachError < 1e-6, `unreachable wrist target: ${maximumReachError}`);
  assert.ok(restored.every((point, i) => point.distanceTo(saved[i]) < 1e-9));
});

test('after exiting the sleeves the hands clear the body and return continuously to the original standing pose', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, shoulderRelease);
  const { shirt, inner } = shirtAndInnerLayers(h);
  const skin = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const initialSkin = worldPoints(skin), initialShirt = worldPoints(shirt);
  const baseline = auditCage(meshSurface(shirt), inner.map(mesh => meshSurface(mesh)));
  assert.equal(baseline.selfCount, 0);
  const rows = [];
  for (const time of [3.2, 3.5, 3.8, 4.1, 4.6, 4.9, 5.2, 5.6, 6, 6.6, 7, 7.6, 8]) {
    body.pose(time); const result = auditCage(meshSurface(shirt), inner.map(mesh => meshSurface(mesh)));
    rows.push({ time, self: result.selfCount, inner: result.bodyCount });
  }
  console.log(JSON.stringify({ recovery: rows }));
  assert.ok(rows.every(row => row.self === 0 && row.inner === 0), `recovery intersects: ${JSON.stringify(rows)}`);
  const difference = Math.max(...worldPoints(skin).map((point, i) => point.distanceTo(initialSkin[i])), ...worldPoints(shirt).map((point, i) => point.distanceTo(initialShirt[i])));
  assert.ok(difference < 1e-5, `exiting the saved action would jump ${difference}`);
});

test('a fresh transformed body restores the same saved withdrawal surfaces', async t => {
  const h = await makeModel(), cold = await makeModel();
  t.after(() => { h.models.dispose(); cold.models.dispose(); });
  cold.rig.root.position.set(12, 5, -3); cold.rig.root.rotation.y = 1.14; cold.rig.root.scale.setScalar(.4);
  cold.rig.root.updateMatrixWorld(true);
  const warmBody = new WithdrawalBody(h.rig, shoulderRelease), coldBody = new WithdrawalBody(cold.rig, shoulderRelease);
  let maximum = 0, maximumJointDifference = 0;
  const position = cold.rig.root.position.clone(), rotation = cold.rig.root.quaternion.clone(), scale = cold.rig.root.scale.clone();
  for (const time of [.4, 2.9, 3.8, 6.4, 8]) {
    warmBody.pose(time); coldBody.pose(time);
    for (const [name, bone] of h.rig.bones) {
      const other = cold.rig.bones.get(name)!;
      maximumJointDifference = Math.max(maximumJointDifference, bone.position.distanceTo(other.position),
        Math.min(...[1, -1].map(sign => Math.hypot(...bone.quaternion.toArray().map((value, i) => value - other.quaternion.toArray()[i] * sign)))));
    }
    // The unchanged pose already differs by 1.49e-6 after float32 world
    // skinning at this translated/scaled root. Compare the solved bones and
    // actual surfaces in the same frame; do not loosen the contact tolerance.
    cold.rig.root.position.set(0, 0, 0); cold.rig.root.quaternion.identity(); cold.rig.root.scale.setScalar(1);
    cold.rig.root.updateMatrixWorld(true);
    for (const name of ['Anatomical_head_and_hands', 'morpheus-ambush-shirt']) {
      const expected = worldPoints(h.rig.root.getObjectByName(name) as THREE.Mesh);
      const actual = worldPoints(cold.rig.root.getObjectByName(name) as THREE.Mesh);
      maximum = Math.max(maximum, ...actual.map((point, i) => point.distanceTo(expected[i])));
    }
    cold.rig.root.position.copy(position); cold.rig.root.quaternion.copy(rotation); cold.rig.root.scale.copy(scale);
    cold.rig.root.updateMatrixWorld(true);
  }
  console.log(JSON.stringify({ coldMaximumDifference: maximum, maximumJointDifference }));
  assert.ok(maximumJointDifference < 1e-9, `saved joint pose depends on world placement: ${maximumJointDifference}`);
  assert.ok(maximum < 1e-6, `saved body depends on its world placement: ${maximum}`);
});

test('the front-exit body restores every visible inner surface at the eight-second boundary', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig, 'front-exit');
  const { shirt, inner } = shirtAndInnerLayers(h), meshes = [shirt, ...inner];
  body.pose(0); const initial = meshes.map(mesh => worldPoints(mesh));
  body.pose(2.4); body.pose(8);
  let maximum = 0;
  for (const [part, mesh] of meshes.entries()) {
    for (const [id, point] of worldPoints(mesh).entries()) maximum = Math.max(maximum, point.distanceTo(initial[part][id]));
  }
  console.log(JSON.stringify({ standingBoundaryMaximum: maximum, visibleInnerLayers: meshes.length }));
  assert.ok(maximum < 1e-6, `the complete body jumps when leaving the saved action: ${maximum}`);
});
