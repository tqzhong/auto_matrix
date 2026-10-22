import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { capsuleTriangleGap, cupTriangleProof } from './prop-surface.mjs';
const triangle = (values: number[][]) => values.map(p => new THREE.Vector3(...p as [number, number, number])) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
const bottom = new THREE.Vector2(.104, -.22), top = new THREE.Vector2(.115, .22);

test('a capsule face crossing is detected even when all three skin vertices are outside', () => {
  const p = triangle([[-.03, 0, -.03], [.03, 0, -.03], [0, 0, .03]]);
  assert.ok(p.every(v => v.length() > .016));
  assert.equal(capsuleTriangleGap(p, .016, .04), -.016);
});
test('capsule distance uses a finite medial segment and its rounded caps', () => {
  assert.ok(capsuleTriangleGap(triangle([[.02, -.03, -.02], [.02, .03, -.02], [.02, 0, .03]]), .016, .04) > 0);
  assert.ok(capsuleTriangleGap(triangle([[-.03, .06, -.03], [.03, .06, -.03], [0, .06, .03]]), .016, .04) > .02);
});
test('a triangle enclosing the glass axis cannot pass a vertex-only wall check', () => {
  const p = triangle([[-.15, 0, -.15], [.15, 0, -.15], [0, 0, .15]]);
  assert.ok(p.every(v => Math.hypot(v.x, v.z) > .115));
  assert.equal(cupTriangleProof(p, bottom, top).safe, false);
});
test('the glass slab clips away faces above the rim and preserves outside faces', () => {
  assert.ok(cupTriangleProof(triangle([[-.15, .23, -.15], [.15, .23, -.15], [0, .23, .15]]), bottom, top).safe);
  assert.ok(cupTriangleProof(triangle([[.13, -.1, -.02], [.13, .1, -.02], [.13, 0, .03]]), bottom, top).safe);
});
test('a conservative sloped-wall bound refines rather than rejecting a valid near-wall triangle', () => {
  const r = (y: number) => bottom.x + (top.x - bottom.x) * (y - bottom.y) / (top.y - bottom.y);
  const result = cupTriangleProof(triangle([[r(-.2) + .001, -.2, 0], [r(.2) + .001, .2, 0], [r(.1) + .001, .1, .002]]), bottom, top);
  assert.ok(result.safe && !result.unresolved && result.subdivisions > 0);
  assert.ok(result.minimumLowerBound >= -.004);
});
test('a real skin point beyond the existing glass contact margin fails', () => {
  assert.equal(cupTriangleProof(triangle([[.104, .1, 0], [.12, .1, .01], [.12, .11, -.01]]), bottom, top).safe, false);
});
