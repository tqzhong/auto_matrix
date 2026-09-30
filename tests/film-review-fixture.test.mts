import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { APARTMENT, filmPosition } from '@auto_matrix/shared';

test('the spoon review save reaches each handoff checkpoint through the playable sequence', () => {
  for (const [mode, phase, owner] of [['spoon-offered', 'offered', 'spoon_boy'], ['spoon-focus', 'focus', 'neo'], ['spoon', 'understood', 'neo']]) {
    const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_spoon', mode], { encoding: 'utf8' }).trim();
    try {
      const world = JSON.parse(readFileSync(path.join(directory, 'world.json'), 'utf8'));
      assert.equal(world.sandbox.neoLife.journey.oracle.spoonLesson.phase, phase);
      assert.equal(world.sandbox.neoLife.journey.step, 0, 'understanding still waits for the player to stand');
      for (const id of ['neo', 'spoon_boy']) assert.equal(world.agents[id].currentAction.parameters.spoon !== undefined, id === owner);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

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

test('the apartment departure review save opens 101 while Neo crosses its threshold', () => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_wake_again', 'wake-leaving'], { encoding: 'utf8' }).trim();
  try {
    const world = JSON.parse(readFileSync(path.join(directory, 'world.json'), 'utf8'));
    const journey = world.sandbox.neoLife.journey; const neo = world.agents.neo;
    assert.equal(journey.scene, 'm1_wake_again');
    assert.equal(journey.step, 1);
    assert.equal(journey.wakeCall?.phase, 'leaving');
    assert.ok(journey.wakeCall.elapsed > 3 && journey.wakeCall.elapsed < 4);
    assert.ok(neo.position.z > filmPosition('film_anderson_flat', 0, APARTMENT.doorZ).z,
      'Neo must already be visible on the landing side of the open door');
    assert.ok(neo.currentAction?.parameters.wakeCall, 'the saved actor pose must reconstruct the departure performance');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the apartment review save can freeze the closing door before the bridge cut', () => {
  const directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm1_wake_again', 'wake-closing'], { encoding: 'utf8' }).trim();
  try {
    const world = JSON.parse(readFileSync(path.join(directory, 'world.json'), 'utf8'));
    const journey = world.sandbox.neoLife.journey; const neo = world.agents.neo;
    assert.equal(journey.scene, 'm1_wake_again');
    assert.equal(journey.wakeCall?.phase, 'leaving');
    assert.ok(journey.wakeCall.elapsed >= 3.5 && journey.wakeCall.elapsed < 3.8);
    assert.ok(neo.position.z > filmPosition('film_anderson_flat', 0, APARTMENT.doorZ).z);
    assert.ok(!world.sandbox.structures.some((structure: { id: string }) => structure.id === 'film:apartment:door'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
