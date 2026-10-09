import assert from 'node:assert/strict';
import test from 'node:test';
import { FREEWAY_HANDOFF, newFreewayHandoff, newFreewayRide } from '@auto_matrix/shared';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';

test('the passenger steps along the moving roof using saved departure distance and returns to a planted stance', () => {
  const handoff = { ...newFreewayHandoff(newFreewayRide()), phase: 'departing' as const, elapsed: .6, role: 'keymaker' as const };
  const input = { speed: 100, grounded: true, verticalVelocity: 0, turn: 2, freewayHandoff: handoff };
  const walking = advanceMotion(newMotion(), input, 0);
  assert.ok(walking.moving > 0 && Math.abs(walking.legs[0].hip - walking.legs[1].hip) > .1,
    'moving the root alone would slide both stationary feet over the trailer');
  const previous = newMotion(); advanceMotion(previous, { ...input, freewayHandoff: { ...handoff, elapsed: 1.5 } }, .1);
  assert.deepEqual(advanceMotion(previous, input, 0), walking, 'pause and cold load must reproduce the gait without running the clock');
  const stopped = advanceMotion(newMotion(), { ...input, freewayHandoff: { ...handoff, elapsed: FREEWAY_HANDOFF.exit } }, 0);
  assert.equal(stopped.moving, 0); assert.deepEqual(stopped.legs[0], stopped.legs[1]);
  const morpheus = advanceMotion(newMotion(), { ...input, freewayHandoff: { ...handoff, role: 'morpheus' } }, 0);
  assert.equal(morpheus.moving, 0, 'vehicle speed must not make the standing receiver walk');
});
