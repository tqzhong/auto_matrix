import assert from 'node:assert/strict';
import test from 'node:test';
import { actor } from './helpers/fighting-hand-fixture.mjs';

// Count redundant topology/material lookups instead of using a flaky wall-clock
// limit. The complete skin and its normals must still be evaluated every pose.
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
