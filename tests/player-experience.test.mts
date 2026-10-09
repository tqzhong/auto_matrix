import assert from 'node:assert/strict';
import test from 'node:test';
import { cinematicTalkSuppressed, PlayerExperience, savedEntryCharacter } from '../packages/client/src/player/PlayerExperience.js';
import type { AgentState, SimulationState, NeoLifeState } from '@auto_matrix/shared';

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
  assert.equal(cinematicTalkSuppressed('m3_dock_battle', undefined, 2), true, 'Mifune’s last orders use the specific G action');
  assert.equal(cinematicTalkSuppressed('m3_dock_battle', 'film_zion_hangar', 1), false);
});

test('Link’s EMP controls and exterior shot suppress nearby ambient conversation', () => {
  for (const step of [0, 1]) assert.equal(cinematicTalkSuppressed('m3_emp', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m3_emp', 'film_hammer_deck', 1), false);
});

test('the midnight watch and explosion keep ambient conversation out of the observation view', () => {
  assert.equal(cinematicTalkSuppressed('m2_blackout', undefined, 0), true);
  assert.equal(cinematicTalkSuppressed('m2_blackout', 'film_power_station', 0), false);
});

test('the real-world signal and collapse suppress ambient E talk while a later visit keeps it', () => {
  for (const step of [0, 1, 2]) assert.equal(cinematicTalkSuppressed('m2_stop_sentinels', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m2_stop_sentinels', 'film_service_tunnels', 1), false);
});

test('Mobil conversations and the refusal use their story controls without overlapping ambient E talk', () => {
  for (const scene of ['m3_mobil', 'm3_family', 'm3_trainman']) {
    for (const step of [0, 1, 2, 3, 4]) assert.equal(cinematicTalkSuppressed(scene, undefined, step), true);
    assert.equal(cinematicTalkSuppressed(scene, 'film_mobil_station', 0), false, 'a later visit keeps ordinary conversation');
  }
});

test('Link’s descent and reunion use their own controls instead of ambient E conversation', () => {
  for (const step of [0, 1, 2, 3]) assert.equal(cinematicTalkSuppressed('m3_dock_reunion', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m3_dock_reunion', 'film_zion_hangar', 1), false);
});

test('the captains’ lift and Lock briefing keep ambient E prompts out of the manual G responses', () => {
  for (const step of [0, 1, 2, 3, 4, 5]) assert.equal(cinematicTalkSuppressed('m3_dock_briefing', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m3_dock_briefing', 'film_zion_personnel', 2), false, 'ordinary conversation remains available on a later visit');
});

test('temple artillery and the final city breach keep ambient talk out of their saved actions', () => {
  for (const scene of ['m3_temple_defense', 'm3_temple_breach']) {
    for (const step of [0, 1, 2, 3, 4]) assert.equal(cinematicTalkSuppressed(scene, undefined, step), true);
    assert.equal(cinematicTalkSuppressed(scene, 'film_zion_temple', 1), false);
  }
});

test('the last doors keep ambient E prompts out of the key handoff and source continuation', () => {
  for (const step of [3, 4, 5, 6]) assert.equal(cinematicTalkSuppressed('m2_key_door', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m2_key_door', 'film_source_corridor', 5), false, 'a later visit keeps ordinary conversation');
  assert.equal(cinematicTalkSuppressed('m2_key_door', undefined, 0), false, 'the entry remains outside the scripted handoff');
});

test('Hel keeps ambient talk out of the elevator and coat-check actions, but restores it outside the active scene', () => {
  for (const step of [0, 1, 2, 3, 4]) assert.equal(cinematicTalkSuppressed('m3_hel_entry', undefined, step), true);
  assert.equal(cinematicTalkSuppressed('m3_hel_entry', undefined, 5), false);
  assert.equal(cinematicTalkSuppressed('m3_hel_entry', 'film_club_hel', 0), false);
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

test('the assimilated Oracle continues her saved scene without a rebuild prompt', t => {
  const elements = new Map<string, { textContent: string; innerHTML: string; classList: { add(): void } }>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', classList: { add() {} } });
    return elements.get(id)!;
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { body: { classList: { toggle() {} } } } as unknown as Document;
  const ui = Object.assign(Object.create(PlayerExperience.prototype), { root: { querySelector: element, querySelectorAll: () => [] },
    chosen: 'neo', lastPlayed: 'oracle', controlled: null, menuOpen: true, lastRender: -Infinity, search: '', entryExplicit: false, tipUntil: Infinity });
  const agents = { oracle: { id: 'oracle', name: 'The Oracle', faction: 'oracle', status: 'disconnected' } as AgentState,
    neo: { id: 'neo', name: 'Neo', faction: 'zion', status: 'dead' } as AgentState };
  const life = { journey: { scene: 'm3_oracle_absorbed', actor: 'oracle', oracleAbsorption: { phase: 'done' } } } as NeoLifeState;
  ui.update(agents, { running: false, population: 78 } as SimulationState, life);
  assert.match(element('#enter-world').innerHTML, /继续 The Oracle 的剧情存档/);
  const card = element('#character-grid').innerHTML.match(/data-play="oracle".*?<\/button>/)![0];
  assert.match(card, /继续剧情/);
  assert.doesNotMatch(card, /重建/);
  assert.match(element('#character-grid').innerHTML.match(/data-play="neo".*?<\/button>/)![0], /重建并接入/);
  life.journey!.oracleAbsorption!.phase = 'coating';
  ui.update(agents, { running: false, population: 78 } as SimulationState, life);
  assert.match(element('#enter-world').innerHTML, /重建并进入角色/);
  life.journey!.oracleAbsorption!.phase = 'done'; life.journey!.visiting = 'film_oracle_home';
  ui.update(agents, { running: false, population: 78 } as SimulationState, life);
  assert.match(element('#enter-world').innerHTML, /重建并进入角色/);
  assert.equal(agents.oracle.status, 'disconnected');
});
