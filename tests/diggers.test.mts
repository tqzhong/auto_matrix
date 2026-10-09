import assert from 'node:assert/strict';
import test from 'node:test';
import { DIGGERS, diggerEye, diggerShield, fireDigger, newDiggers, stepDiggers } from '../packages/shared/src/constants/diggers.js';

function frames(state: ReturnType<typeof newDiggers>, seconds: number, focus = false) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) stepDiggers(state, .05, focus);
}
function aim(state: ReturnType<typeof newDiggers>, target = DIGGERS.knees[state.station]) {
  const eye = diggerEye(state), dx = target.x - eye.x, dz = target.z - eye.z;
  return { yaw: Math.atan2(dx, dz), pitch: -Math.atan2(target.y - eye.y, Math.hypot(dx, dz)) };
}
function clearShot(state: ReturnType<typeof newDiggers>) {
  // Wait for the visible screening sentinel to move away from the firing lane.
  while (Math.abs(diggerShield(state).offset) < 5) frames(state, .1);
  const direction = aim(state); fireDigger(state, direction.yaw, direction.pitch); frames(state, 2);
}
test('loading needs held input; a double rocket hits the joint only after its flight', () => {
  const state = newDiggers(); state.phase = 'loading';
  frames(state, 2); assert.equal(state.load, 0);
  frames(state, .8, true); const load = state.load;
  frames(state, .3); assert.equal(state.load, load);
  frames(state, 2.5, true); assert.equal(state.phase, 'aiming');
  while (Math.abs(diggerShield(state).offset) < 5) frames(state, .1);
  const direction = aim(state); fireDigger(state, direction.yaw, direction.pitch);
  assert.equal(state.damage, 0); assert.equal(state.rounds, 4); assert.equal(state.phase, 'rocket');
  frames(state, 2); assert.equal(state.damage, 1); assert.equal(state.phase, 'relocate');
});
test('misses and a screening sentinel consume ammunition without damaging the drill', () => {
  const state = newDiggers(); state.phase = 'aiming';
  fireDigger(state, -Math.PI / 2, 0); frames(state, 2);
  assert.equal(state.damage, 0); assert.equal(state.rounds, 4); assert.equal(state.shot?.result, 'miss');
  state.phase = 'aiming'; state.total = 0;
  const direction = aim(state); fireDigger(state, direction.yaw, direction.pitch); frames(state, 2);
  assert.equal(state.shot?.result, 'screened'); assert.equal(state.damage, 0);
  state.phase = 'aiming'; fireDigger(state, -Math.PI / 2, 0); frames(state, 2);
  assert.equal(state.phase, 'failed');
});
test('save and restore during flight produces the same collapse, without a timer completing an unfired encounter', () => {
  const state = newDiggers(1); state.phase = 'aiming';
  while (Math.abs(diggerShield(state).offset) < 5) frames(state, .1);
  const direction = aim(state); fireDigger(state, direction.yaw, direction.pitch); frames(state, .2);
  const restored = JSON.parse(JSON.stringify(state));
  frames(state, 8); frames(restored, 8);
  assert.deepEqual(restored, state); assert.equal(state.phase, 'done'); assert.equal(state.damage, 3);
  const waiting = newDiggers(); frames(waiting, 300); assert.equal(waiting.phase, 'approach');
});
test('a second station retry keeps the destroyed first support', () => {
  const state = newDiggers(1, 2); state.phase = 'loading'; frames(state, DIGGERS.limit + 1);
  assert.equal(state.phase, 'failed'); assert.equal(state.damage, 1);
  const retry = newDiggers(state.station, state.attempts + 1);
  retry.phase = 'loading'; frames(retry, 3, true); clearShot(retry); frames(retry, 8);
  assert.equal(retry.attempts, 3); assert.equal(retry.phase, 'done');
});

test('rockets stop at the real rear wall and floor instead of crossing the defense duct', () => {
  const state = newDiggers(); state.phase = 'aiming';
  fireDigger(state, -Math.PI / 2, 0);
  assert.equal(state.shot?.result, 'miss');
  assert.ok(Math.abs(state.shot!.to.x - (-47.65)) < .01, `rear wall impact: ${state.shot!.to.x}`);
  state.phase = 'aiming'; fireDigger(state, state.yaw, .5);
  assert.ok(state.shot!.to.y >= 0, 'a missed rocket cannot go below the dock floor');
});
