import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

const names = ['chest', 'spine', 'pelvis', 'hip_L', 'hip_R', 'knee_L', 'knee_R', 'ankle_L', 'ankle_R', 'head', 'elbow_L', 'elbow_R', 'wrist_L', 'wrist_R'];
function patient() {
  const body = new THREE.Group();
  names.forEach((name, i) => { const bone = new THREE.Bone(); bone.name = name; bone.position.set(i % 2 ? .2 : -.2, 1.3, i * .1); body.add(bone); });
  return body;
}
function beat(elapsed: number, started = true): FilmJourney {
  return { scene: 'm1_recovery', awakening: { kind: 'recovery', elapsed, started } } as FilmJourney;
}
function capture(root: THREE.Group) {
  root.updateMatrixWorld(true);
  return { parts: Array.from({ length: 20 }, (_, i) => ['', '-tip', '-carriage', '-signal'].map(part => {
    const object = root.getObjectByName(`neb-medical-needle${part}-${i}`)!;
    return { visible: object.visible, matrix: object.matrixWorld.toArray() };
  })), leads: ['red', 'gray'].map(color => {
    const mesh = root.getObjectByName(`neb-medical-${color}-leads`) as THREE.InstancedMesh;
    return { visible: mesh.visible, matrices: Array.from(mesh.instanceMatrix.array) };
  }) };
}

test('inactive therapy skips patient bone work and recursive updates of unrelated deck geometry', t => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root), body = patient();
  const unrelated = new THREE.Group(); unrelated.name = 'unrelated-deck-branch'; root.add(unrelated);
  const visit = t.mock.method(unrelated, 'updateWorldMatrix');
  const original = body.getObjectByName.bind(body); let therapyLookups = 0;
  t.mock.method(body, 'getObjectByName', name => { if (names.includes(name)) therapyLookups++; return original(name); });
  const inactive = [undefined, beat(0, false), beat(4, false), beat(2.099), beat(7.4), beat(12), { scene: 'm1_cabin', step: 1 } as FilmJourney];
  try {
    for (const journey of inactive) {
      therapyLookups = 0; const visitsBefore = visit.mock.callCount(); renderer.update(journey, 1000, body);
      assert.equal(therapyLookups, 0, `hidden therapy still resolves patient bones in ${JSON.stringify(journey)}`);
      assert.equal(visit.mock.callCount(), visitsBefore, 'local therapy must not recursively update unrelated rooms');
      const state = capture(root);
      assert.ok(state.parts.every(parts => parts.every(part => !part.visible)) && state.leads.every(lead => !lead.visible));
    }
  } finally { renderer.dispose(); }
});

test('therapy reactivation and out-of-order restored clocks reproduce every visible needle and wire immediately', () => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root), body = patient();
  root.position.set(12, -3, 8); root.rotation.y = .27;
  const path = [0, 4, 7.4, 7.399, 1.4, 3.6, 12, 2.1, 5.8];
  try {
    for (const [index, elapsed] of path.entries()) {
      body.position.set(11 + index * .03, -2, 9 - index * .02); body.rotation.y = .2 + index * .01;
      const journey = beat(elapsed); renderer.update(journey, 100 + index, body);
      const current = capture(root), coldRoot = new THREE.Group(), cold = new NebDeckRenderer(coldRoot);
      coldRoot.position.copy(root.position); coldRoot.rotation.copy(root.rotation);
      try {
        cold.update(journey, 9999, body); const restored = capture(coldRoot);
        assert.deepEqual(current.parts.map(parts => parts.map(part => part.visible)), restored.parts.map(parts => parts.map(part => part.visible)));
        assert.deepEqual(current.leads.map(lead => lead.visible), restored.leads.map(lead => lead.visible));
        if (elapsed < 2.1 || elapsed >= 7.4) continue;
        assert.deepEqual(current, restored, `rewinding to ${elapsed}s must not show stale hidden transforms`);
      } finally { cold.dispose(); }
    }
  } finally { renderer.dispose(); }
});

test('an inactive restored clock does not project hidden needles onto loaded patient skin', t => {
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root), body = patient();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new THREE.MeshStandardMaterial(), skin = new THREE.SkinnedMesh(geometry, material);
  const skeleton = new THREE.Skeleton([body.children[0] as THREE.Bone]); body.add(skin); skin.bind(skeleton);
  skin.userData.patientBody = true; const raycast = t.mock.method(skin, 'raycast', () => {});
  try {
    renderer.update(beat(4, false), 100, body);
    assert.equal(raycast.mock.callCount(), 0, 'a restored but unstarted treatment must not raycast its invisible contacts');
    renderer.update(beat(4), 100, body);
    assert.ok(raycast.mock.callCount() > 0, 'the actual skin is sampled when treatment becomes visible');
  } finally { renderer.dispose(); skeleton.dispose(); geometry.dispose(); material.dispose(); }
});
