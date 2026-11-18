import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';

// Count redundant topology/material lookups instead of using a flaky wall-clock
// limit. The complete skin and its normals must still be evaluated every pose.
test('hand skinning builds transforms only for joints referenced by its vertices', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(.65);
  const hands = h.models['fightingHands'].get(h.rig)!, binding = hands['binding'];
  const required = binding.hands.map(hand => new Set(hand.vertices.flatMap(id =>
    [hands['base'], binding.attributes].flatMap(a => [0, 1, 2, 3].map(k => a.skinIndex.getComponent(id, k))))));
  let active = false, matrices = 0, calls = 0;
  const multiply = THREE.Matrix4.prototype.multiplyMatrices, deform = hands['deform'];
  t.mock.method(THREE.Matrix4.prototype, 'multiplyMatrices', function (...args) {
    if (active) matrices++;
    return multiply.apply(this, args);
  });
  t.mock.method(hands, 'deform', function (hand) {
    active = true; calls++;
    try { return deform.call(this, hand); } finally { active = false; }
  });
  h.rig.bones.get('wrist_R')!.rotation.set(.2, .7, -.4);
  h.rig.bones.get('wrist_L')!.rotation.set(-.3, -.6, .25);
  hands.update();
  assert.equal(calls, 2, 'both changed hands must still receive a complete deformation');
  const maximum = required.reduce((sum, joints) => sum + joints.size * 4 + 1, 0);
  t.diagnostic(JSON.stringify({ matrices, maximum, joints: required.map(joints => joints.size), skeleton: hands['skin'].skeleton.bones.length }));
  assert.ok(matrices <= maximum, `building unused skeleton transforms: ${matrices} > ${maximum}`);
});

test('a wrist turn does not look up immutable normal groups again for every face corner', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(.6);
  const hands = h.models['fightingHands'].get(h.rig)!, binding = hands['binding'], original = binding.groups;
  let reads = 0;
  binding.groups = new Proxy(original, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  try {
    h.rig.bones.get('wrist_R')!.rotation.set(.2, .7, -.4); h.rig.bones.get('wrist_L')!.rotation.set(-.3, -.6, .25);
    hands.update();
  } finally { binding.groups = original; }
  const vertices = binding.hands.reduce((sum, hand) => sum + hand.vertices.length, 0);
  t.diagnostic(JSON.stringify({ reads, vertices }));
  assert.ok(reads <= vertices, `immutable normal-group lookups: ${reads} for ${vertices} vertices`);
});

test('changing a grip reuses the bound material intervals instead of searching them for every vertex', async t => {
  const h = await actor('morpheus'); t.after(() => h.models.dispose()); h.draw(.1);
  const hands = h.models['fightingHands'].get(h.rig)!;
  let searches = 0;
  const originals = hands['binding'].hands.flatMap(hand => hand.fingers.map(finger => {
    const anchors = finger.rest.anchors, find = anchors.findIndex;
    anchors.findIndex = function (...args) { searches++; return find.apply(this, args); };
    return { anchors, find };
  }));
  try { h.draw(.65); } finally { originals.forEach(({ anchors, find }) => { anchors.findIndex = find; }); }
  t.diagnostic(JSON.stringify({ searches }));
  assert.equal(searches, 0, 'the bound material interval does not change with the grip');
});
