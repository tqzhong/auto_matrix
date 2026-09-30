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
  assert.equal(cinematicTalkSuppressed('m1_pod', undefined, 1), true, 'rescue crew use the saved boarding performance, not ambient talk');
  assert.equal(cinematicTalkSuppressed('m1_pod', 'film_pods', 1), false, 'visiting keeps normal talk');
  assert.equal(cinematicTalkSuppressed('m1_spoon', undefined, 0), true, 'ambient E prompts must not cover the held-G spoon interaction');
  assert.equal(cinematicTalkSuppressed('m1_spoon', undefined, 1), false, 'ordinary conversation returns when the focus exercise is finished');
  assert.equal(cinematicTalkSuppressed(undefined, undefined), false);
});

test('wall escape keeps ambient conversation out of breaking, climbing and rescue controls', () => {
  for (const step of [0, 1, 2, 3, 4]) assert.equal(cinematicTalkSuppressed('m1_wetwall', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m1_wetwall', 'film_ambush_house', 1), false, 'visiting outside the escape keeps ordinary conversation');
});
