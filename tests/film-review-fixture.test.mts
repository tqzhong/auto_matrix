import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

test('the successful office escape review save skips interrogation and has no tracker', () => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_wake_again', 'wake-clear-ringing'], { encoding: 'utf8' }).trim();
  try {
    const world = JSON.parse(readFileSync(path.join(directory, 'world.json'), 'utf8'));
    const journey = world.sandbox.neoLife.journey;
    assert.equal(journey.office?.outcome, 'escaped');
    assert.equal(journey.office?.bugged, false);
    assert.equal(journey.wakeCall?.nightmare, false);
    assert.equal(journey.wakeCall?.phase, 'ringing');
    assert.ok(journey.skipped?.includes('m1_interrogation'));
    assert.ok(!journey.completed.includes('m1_interrogation'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
