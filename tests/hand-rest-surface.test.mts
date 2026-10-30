import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor, fingerGroups } from './helpers/fighting-hand-fixture.mjs';
import { HandCurve } from '../packages/client/src/agents/HandCurve.js';

test('a nearly straight finger spreads its small bend across skin instead of making a sharp crease', () => {
  const curvature = (angle: number) => {
    const next = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const curve = new HandCurve([new THREE.Vector3(), new THREE.Vector3(.1, 0, 0),
      new THREE.Vector3(.1, 0, 0).addScaledVector(next, .1), new THREE.Vector3(.1, 0, 0).addScaledVector(next, .2)], [.03, .03]);
    return Math.max(...Array.from({ length: 2001 }, (_, i) => curve.sample(curve.length * i / 2000).k));
  };
  assert.ok(curvature(.05) < curvature(.2) * .4, 'opening a finger must soften the bend instead of narrowing the same sharp indentation');
});

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) test(`${id}: the hand surface correction preserves the actual skin when its finger joints are still in bind pose`, async t => {
  const h = await actor(id); t.after(() => h.models.dispose());
  const hands = h.models['fightingHands'].get(h.rig)!;
  const groups = ['R', 'L'].map(side => fingerGroups(h.rig, side));
  h.rig.root.updateMatrixWorld(true);
  const points = () => groups.map(({ skin, hand }) => {
    skin.skeleton.update();
    return hand.map(id => skin.getVertexPosition(id, new THREE.Vector3()));
  });
  const original = points();
  hands.begin({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0 });
  hands.pose('R', 0); hands.pose('L', 0); hands.update();
  const actual = points();
  for (const [which, side] of ['R', 'L'].entries()) {
    const displacement = Math.max(...actual[which].map((point, i) => point.distanceTo(original[which][i])));
    assert.ok(displacement < 2e-6, `${side}: an unchanged finger pose dents the skin by ${displacement}`);
  }
});
