import assert from 'node:assert/strict';
import test from 'node:test';
import { SMITH_FINALE, newSmithFinale, smithCraterAmount, smithFinaleAction, smithFinaleLocked,
  smithFinalePose, stepSmithFinale, retrySmithFinale, type SmithFinaleEncounter } from '@auto_matrix/shared';

const idle = { focus: false, x: 0, z: 0 };
const begin = (): SmithFinaleEncounter => ({ ...newSmithFinale(), phase: 'pit_warning', checkpoint: 'pit',
  total: 60, impactAt: 51, breachedAt: 33, pitFight: true });

test('the final pit bout needs a dodge and a player counter instead of ending automatically', () => {
  const warning = begin();
  assert.deepEqual(smithFinaleAction(warning, 'attack'), warning, 'early spam cannot bypass the telegraph');
  const window = stepSmithFinale(warning, idle, SMITH_FINALE.pit.warning);
  assert.equal(window.phase, 'pit_dodge');
  const missed = stepSmithFinale(window, idle, SMITH_FINALE.pit.dodge);
  assert.equal(missed.phase, 'failed', 'waiting must not substitute for a counter');
  let beat = smithFinaleAction(window, 'dodge');
  assert.equal(beat.phase, 'pit_evade');
  beat = stepSmithFinale(beat, idle, SMITH_FINALE.pit.evade);
  assert.equal(beat.phase, 'pit_counter');
  assert.equal(smithFinalePose(beat).strike, 0, 'Neo does not throw an unrequested punch');
  assert.equal(stepSmithFinale(beat, idle, SMITH_FINALE.pit.counter).phase, 'failed');
  beat = smithFinaleAction(beat, 'attack');
  assert.equal(beat.phase, 'pit_punch');
  const peak = stepSmithFinale(beat, idle, .8);
  assert.ok(smithFinalePose(peak).strike > .99, 'the saved slow punch must have an actual contact interval');
  beat = stepSmithFinale(beat, idle, SMITH_FINALE.pit.punch);
  assert.equal(beat.phase, 'pit_retaliation');
  beat = stepSmithFinale(beat, idle, SMITH_FINALE.pit.retaliation);
  assert.equal(beat.phase, 'vision', 'Smith recognizes the prediction while Neo is still on the ground');
  assert.equal(smithFinalePose(beat).fallen, 1);
  assert.equal(stepSmithFinale(beat, { ...idle, focus: true }, 10).phase, 'vision', 'holding G cannot skip the philosophical response');
  beat = { ...beat, phase: 'pit_recovery' };
  assert.equal(stepSmithFinale(beat, idle, 10).phase, 'pit_recovery', 'the game cannot choose to get up for Neo');
  beat = stepSmithFinale(beat, { ...idle, focus: true }, SMITH_FINALE.crater.riseSeconds);
  assert.equal(beat.phase, 'understanding');
  assert.equal(smithFinalePose(beat).fallen, 0);
});

test('a failed final counter freezes in the existing crater and retries without undoing the first fight', () => {
  const missed = stepSmithFinale({ ...begin(), phase: 'pit_counter', elapsed: SMITH_FINALE.pit.counter - .01 }, idle, .01);
  assert.equal(missed.phase, 'failed'); assert.equal(missed.checkpoint, 'pit');
  assert.equal(smithFinaleLocked(missed), true);
  assert.deepEqual(stepSmithFinale(JSON.parse(JSON.stringify(missed)), { ...idle, focus: true }, 8), missed);
  const retry = retrySmithFinale(missed);
  assert.equal(retry.phase, 'pit_warning'); assert.equal(retry.attempts, 1);
  assert.equal(retry.impactAt, 51); assert.equal(retry.breachedAt, 33);
  assert.equal(smithCraterAmount(retry), 1, 'the completed crater cannot become intact asphalt on a pit retry');
  assert.ok(smithFinalePose(retry).neo.y < -10);
});

test('the final bout roots remain continuous at every automatic boundary and after rising', () => {
  const durations = { pit_warning: SMITH_FINALE.pit.warning, pit_evade: SMITH_FINALE.pit.evade,
    pit_punch: SMITH_FINALE.pit.punch, pit_retaliation: SMITH_FINALE.pit.retaliation,
    pit_recovery: SMITH_FINALE.crater.riseSeconds } as const;
  for (const [phase, duration] of Object.entries(durations)) {
    const before = { ...begin(), phase, elapsed: duration - .00001, focus: phase === 'pit_recovery' ? duration - .00001 : 0 } as SmithFinaleEncounter;
    const after = stepSmithFinale(before, { ...idle, focus: true }, .00001);
    for (const role of ['neo', 'smith'] as const) {
      const a = smithFinalePose(before)[role], b = smithFinalePose(after)[role];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .003, `${role}: ${phase} → ${after.phase} jumps`);
    }
  }
});

test('old in-progress assault and assimilation saves complete their original ending without replaying the new bout', () => {
  const old = { ...newSmithFinale(), pitFight: undefined, phase: 'assault' as const, elapsed: SMITH_FINALE.assault - .01 };
  assert.equal(stepSmithFinale(old, idle, .01).phase, 'vision');
  const contact = { ...old, phase: 'assimilating' as const, elapsed: SMITH_FINALE.surrender.assimilationSeconds - .01 };
  assert.equal(stepSmithFinale(contact, idle, .01).phase, 'purging');
});
