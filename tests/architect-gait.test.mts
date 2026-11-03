import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

test('the Architect walks with a supported foot and a low swing instead of a continuous crouch', () => {
  for (const speed of [2.5, 3.6]) {
    const state = newMotion(), input: MotionInput = { speed, grounded: true, verticalVelocity: 0, turn: 0 };
    for (let frame = 0; frame < 60; frame++) advanceMotion(state, input, 1 / 60, true);
    let maximumKnee = 0, maximumLift = 0, unsupportedFrames = 0, maximumArmSwing = 0, minimumArmClearance = Infinity;
    for (let frame = 0; frame < 240; frame++) {
      const pose = advanceMotion(state, input, 1 / 60, true);
      const feet = pose.legs.map(leg => pose.hipHeight - .94 * Math.cos(leg.hip) - .9 * Math.cos(leg.hip + leg.knee));
      maximumKnee = Math.max(maximumKnee, ...pose.legs.map(leg => leg.knee));
      maximumLift = Math.max(maximumLift, ...feet.map(y => y - .15));
      if (Math.abs(Math.min(...feet) - .15) > 1e-6) unsupportedFrames++;
      maximumArmSwing = Math.max(maximumArmSwing, ...pose.arms.map(arm => Math.abs(arm.shoulder)));
      minimumArmClearance = Math.min(minimumArmClearance, ...pose.arms.map(arm => Math.abs(arm.outward)));
    }
    assert(maximumKnee < .95, `speed ${speed}: knee flexion ${maximumKnee} still folds the legs into a crouch`);
    assert(maximumLift > .04 && maximumLift < .08, `speed ${speed}: swing foot lift ${maximumLift}`);
    assert.equal(unsupportedFrames, 0, `speed ${speed}: at least one foot must support every grounded walking frame`);
    assert(maximumArmSwing <= .2 && minimumArmClearance >= .08, 'relaxed arms must stay beside the coat');
  }
});

test('the Architect gait freezes with zero delta and leaves the seated meeting pose intact', () => {
  const state = newMotion(), input: MotionInput = { speed: 2.5, grounded: true, verticalVelocity: 0, turn: 0 };
  for (let frame = 0; frame < 90; frame++) advanceMotion(state, input, 1 / 60, true);
  const paused = advanceMotion(state, input, 0, true);
  assert.deepEqual(advanceMotion(state, input, 0, true), paused);
  const seated: MotionInput = { ...input, speed: 0, seated: true, architect: { role: 'architect', phase: 'cycles', elapsed: 3, chairYaw: 0 } };
  assert.deepEqual(advanceMotion(newMotion(), seated, .1, true), advanceMotion(newMotion(), seated, .1));
});
