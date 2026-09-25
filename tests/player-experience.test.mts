import assert from 'node:assert/strict';
import test from 'node:test';
import { cinematicTalkSuppressed, savedEntryCharacter } from '../packages/client/src/player/PlayerExperience.js';

test('landing resumes the saved story actor instead of an unrelated browser-local character', () => {
  assert.equal(savedEntryCharacter('morpheus', 'tank', false), 'tank');
  assert.equal(savedEntryCharacter('neo', 'morpheus', false), 'morpheus');
  assert.equal(savedEntryCharacter(null, undefined, false), 'neo');
});

test('an explicit landing choice still overrides the saved story actor', () => {
  assert.equal(savedEntryCharacter('smith', 'tank', true), 'smith');
});

test('Construct and desert story beats keep ambient conversation prompts out of the reveal', () => {
  for (const scene of ['m1_construct', 'm1_desert']) {
    assert.equal(cinematicTalkSuppressed(scene, undefined), true, `${scene} uses its own G action during the reveal`);
    assert.equal(cinematicTalkSuppressed(scene, 'film_real_desert'), false, 'visiting the set outside the active story keeps normal talk');
  }
  assert.equal(cinematicTalkSuppressed('m1_recovery', undefined, 0), true, 'bedside conversation must not cover the needle performance');
  assert.equal(cinematicTalkSuppressed('m1_recovery', undefined, 1), false, 'conversation returns after Neo stands and regains control');
  assert.equal(cinematicTalkSuppressed(undefined, undefined), false);
});
