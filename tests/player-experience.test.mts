import assert from 'node:assert/strict';
import test from 'node:test';
import { savedEntryCharacter } from '../packages/client/src/player/PlayerExperience.js';

test('landing resumes the saved story actor instead of an unrelated browser-local character', () => {
  assert.equal(savedEntryCharacter('morpheus', 'tank', false), 'tank');
  assert.equal(savedEntryCharacter('neo', 'morpheus', false), 'morpheus');
  assert.equal(savedEntryCharacter(null, undefined, false), 'neo');
});

test('an explicit landing choice still overrides the saved story actor', () => {
  assert.equal(savedEntryCharacter('smith', 'tank', true), 'smith');
});
