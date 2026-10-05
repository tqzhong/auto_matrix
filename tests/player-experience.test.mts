import assert from 'node:assert/strict';
import test from 'node:test';
import { cinematicTalkSuppressed, PlayerExperience, savedEntryCharacter } from '../packages/client/src/player/PlayerExperience.js';
import type { AgentState, SimulationState } from '@auto_matrix/shared';

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

test('APU loading keeps ambient talk out of the handhold and kick controls', () => {
  assert.equal(cinematicTalkSuppressed('m3_dock_battle', undefined, 1), true);
  assert.equal(cinematicTalkSuppressed('m3_dock_battle', undefined, 2), false);
  assert.equal(cinematicTalkSuppressed('m3_dock_battle', 'film_zion_hangar', 1), false);
});

test('a paused save is presented as paused before entry and its landing status follows resume', t => {
  const elements = new Map<string, { textContent: string; innerHTML: string; classList: { add(): void } }>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', classList: { add() {} } });
    return elements.get(id)!;
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { body: { classList: { toggle() {} } } } as unknown as Document;
  const ui = Object.assign(Object.create(PlayerExperience.prototype), { root: { querySelector: element, querySelectorAll: () => [] },
    chosen: 'neo', lastPlayed: 'neo', controlled: null, menuOpen: false, entryExplicit: false, tipUntil: Infinity });
  const agents = { neo: { id: 'neo', name: 'Neo', status: 'alive' } as AgentState };
  ui.update(agents, { running: false, population: 85 } as SimulationState);
  assert.match(element('#landing-live').textContent, /85.*暂停/);
  assert.match(element('#landing-title').innerHTML, /世界已暂停/);
  assert.match(element('#landing-status').textContent, /PAUSED/);
  assert.match(element('#landing-world-state').textContent, /继续时间/);
  assert.match(element('#enter-world').innerHTML, /继续 Neo 的进度/);
  ui.update(agents, { running: true, population: 85 } as SimulationState);
  assert.match(element('#landing-live').textContent, /正在生活/);
  assert.match(element('#landing-title').innerHTML, /世界正在运行/);
  assert.match(element('#landing-status').textContent, /RUNNING/);
  assert.doesNotMatch(element('#landing-world-state').textContent, /继续时间/);
});
