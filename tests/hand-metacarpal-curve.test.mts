import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { HandCurve } from '../packages/client/src/agents/HandCurve.js';

test('a hand curve retains the distal tip when it includes a metacarpal span', () => {
  const points = [new THREE.Vector3(0, -.1, 0), new THREE.Vector3(), new THREE.Vector3(.09, .01, 0),
    new THREE.Vector3(.10, .09, 0), new THREE.Vector3(.05, .12, 0)];
  const curve = new HandCurve(points, [.025, .022, .016]);
  assert.ok(curve.sample(curve.length).p.distanceTo(points[4]) < 1e-8, 'rounding the MCP must not truncate the last phalanx');
  assert.equal(curve.anchors.length, 5, 'retain the root, MCP, PIP, DIP and distal anchors');
  for (let joint = 1; joint <= 3; joint++) {
    const before = curve.sample(curve.anchors[joint] - 1e-5), after = curve.sample(curve.anchors[joint] + 1e-5);
    assert.ok(before.k > 0 && after.k > 0, `joint ${joint} has a rounded transition`);
    assert.ok(before.p.distanceTo(after.p) < 2.1e-5 && before.t.angleTo(after.t) < .01);
  }
});
