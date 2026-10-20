import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeModel } from '../morpheus-ambush-doff-2026-10-17/grip-fixture.mjs';
import { WithdrawalBody } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalBody.mjs';
import { WithdrawalCuffs } from '../morpheus-withdrawal-path-2026-10-20/WithdrawalCuffs.mjs';

test('moving the freed hand cannot drag the sleeve after the rim has cleared the fingers', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig); body.pose(.8);
  const cuffs = new WithdrawalCuffs(h.rig, body), rows = [];
  for (const time of [1.7, 1.8, 2, 2.2, 2.3, 3.2]) for (const side of ['R','L']) {
    body.pose(time); const expected = cuffs.matrix(side,time);
    body.pose(6.4); const displaced = cuffs.matrix(side,time);
    rows.push({ time, side, difference: Math.max(...expected.elements.map((value,i) => Math.abs(value-displaced.elements[i]))) });
  }
  console.log(JSON.stringify({ releasedSleeves: rows }));
  assert.ok(rows.every(row => row.difference < 1e-9), 'the released garment is still driven by the hand');
});

test('the released sleeve retains its movement without a velocity snap at the last finger contact', async t => {
  const h = await makeModel(); t.after(() => h.models.dispose());
  const body = new WithdrawalBody(h.rig); body.pose(.8);
  const cuffs = new WithdrawalCuffs(h.rig, body), step = .0001;
  const starts = ['R','L'].map(side => h.rig.bones.get(`wrist_${side}`)!.matrixWorld.clone());
  let maximum = 0;
  for (const [index,side] of ['R','L'].entries()) for (const local of [[0,0,0],[.1,-.08,0],[-.08,-.08,.1]]) {
    const original = new THREE.Vector3(...local).applyMatrix4(starts[index]);
    const points = [1.7-step,1.7,1.7+step].map(time => {
      body.pose(time); return original.clone().applyMatrix4(cuffs.matrix(side,time));
    });
    const before = points[1].clone().sub(points[0]).divideScalar(step);
    const after = points[2].clone().sub(points[1]).divideScalar(step);
    maximum = Math.max(maximum,before.distanceTo(after));
  }
  console.log(JSON.stringify({ maximumReleaseVelocityChange: maximum }));
  assert.ok(maximum < .002, 'releasing the cuff abruptly changes its velocity');
});
