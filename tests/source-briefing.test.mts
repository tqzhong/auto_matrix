import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, SOURCE_BRIEFING, sourceBriefingTarget, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('briefing-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('briefing-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_trucks', actor: 'morpheus', step: FILM_SCENE_BY_ID.m2_trucks.steps.length,
    trucks: { phase: 'rescued', elapsed: 10, lastTick: tick, attempt: 4, rescueElapsed: 3 } });
  players.possess('briefing-player', 'morpheus', tick);
  const keymaker = world.agents.get('keymaker')!; keymaker.health = 40;
  const trinity = world.agents.get('trinity')!, beforeTrinity = structuredClone(trinity);
  command('next');
  return { world, sandbox, players, journey, command, tick: () => tick, actor: () => players.getAgent('briefing-player')!, beforeTrinity };
}

test('the source operation meeting keeps the Keymaker inside the Matrix and includes the three captains', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m2_plan;
  assert.equal(h.journey.scene, scene.id);
  assert.equal(FILM_SETS[scene.set].world, 'matrix', 'a Matrix program cannot enter a real-world ship to explain the plan');
  assert.notEqual(scene.set, 'film_neb_deck');
  for (const id of ['neo', 'keymaker', 'morpheus', 'niobe', 'soren']) {
    const actor = h.world.agents.get(id)!;
    assert.equal(actor.currentLocation, scene.set, id);
    assert.equal(actor.isInMatrix, true, id);
  }
  assert.equal(h.world.agents.get('keymaker')!.health, 40, 'the rescued passenger retains his injury');
  assert.deepEqual(h.world.agents.get('trinity'), h.beforeTrinity, 'Trinity stays outside this planning meeting');
  assert.equal(h.actor().id, 'neo');
  assert.deepEqual(h.actor().position, filmEntry(scene));
});

test('dead or occupied captains are never resurrected or displaced by a planning meeting', () => {
  const h = setup(), soren = h.world.agents.get('soren')!, niobe = h.world.agents.get('niobe')!;
  soren.status = 'dead'; soren.health = 0;
  niobe.controller = 'other-player'; niobe.position = { x: 12, y: -100, z: 45 };
  const beforeSoren = structuredClone(soren), beforeNiobe = structuredClone(niobe);
  h.sandbox.tick(h.tick() + 1); h.command('act');
  assert.equal(h.journey.step, 0);
  assert.deepEqual(soren, beforeSoren);
  assert.deepEqual(niobe, beforeNiobe);
});

test('three real inspection points and the captains response are required before the existing philosophy step', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m2_plan;
  assert.match(h.command('act'), /先走近/);
  assert.equal(h.journey.sourceBriefing!.phase, 'review');
  for (const route of SOURCE_BRIEFING.routes) {
    const point = filmStepPosition(scene, scene.steps[0], h.journey);
    assert.equal(playerBlocked(point, true), false);
    assert.deepEqual(point, filmPosition(scene.set, route.x, route.z));
    h.actor().position = point; h.command('act');
    assert.equal(h.journey.sourceBriefing!.phase, 'hearing');
    h.players.step(.1, false, h.tick()); assert.equal(h.journey.sourceBriefing!.elapsed, 0);
    for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
    assert.ok(h.journey.sourceBriefing!.reviewed.includes(route.id));
    assert.equal(h.journey.step, 0);
  }
  assert.equal(h.journey.sourceBriefing!.phase, 'question');
  h.command('reflect:care');
  assert.equal(h.journey.step, 0, 'a reflection cannot skip the captains response');
  assert.equal(h.journey.reflections['m2_plan:1'], undefined);
  const target = sourceBriefingTarget(h.journey.sourceBriefing);
  h.actor().position = filmPosition(scene.set, target.x, target.z); h.command('act');
  for (let i = 0; i < 125; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.step, 1); assert.equal(h.journey.sourceBriefing!.phase, 'reflection');
  const response = h.command('reflect:care'); h.players.step(.1, false, h.tick());
  assert.doesNotMatch(response, /Trinity/, 'the reflection cannot invent an absent participant');
  assert.match(response, /Niobe/);
  assert.equal(h.journey.step, 2); assert.equal(h.journey.reflections['m2_plan:1'], 'care');
  assert.equal(h.journey.sourceBriefing!.phase, 'done');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

test('a partially heard route freezes on release or occupied cast and resumes after restore without repeating completed routes', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m2_plan;
  h.actor().position = filmStepPosition(scene, scene.steps[0], h.journey); h.command('act');
  for (let i = 0; i < 15; i++) h.players.step(.1, true, h.tick());
  const age = h.journey.sourceBriefing!.elapsed;
  const niobe = h.world.agents.get('niobe')!, before = structuredClone(niobe.position);
  niobe.controller = 'other';
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.sourceBriefing!.elapsed, age); assert.deepEqual(niobe.position, before);
  niobe.controller = null;
  h.players.release('briefing-player', h.tick());
  for (let i = 0; i < 60; i++) h.players.step(.1, true, h.tick());
  assert.equal(h.journey.sourceBriefing!.elapsed, age);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  h.players.possess('briefing-player', 'neo', h.tick());
  assert.equal(h.sandbox.life.film.state!.sourceBriefing!.elapsed, age);
  for (let i = 0; i < 45; i++) h.players.step(.1, true, h.tick());
  assert.deepEqual(h.sandbox.life.film.state!.sourceBriefing!.reviewed, ['primary']);
  assert.equal(h.sandbox.life.film.state!.step, 0);
});

test('an older ship checkpoint moves only this meeting into the Matrix and preserves its existing reflection', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m2_plan;
  h.journey.sourceBriefing = undefined; h.journey.step = 2;
  h.journey.reflections['m2_plan:1'] = 'agency';
  h.actor().currentLocation = 'film_neb_deck'; h.actor().isInMatrix = false; h.actor().position = { ...FILM_SETS.film_neb_deck.center };
  h.sandbox.life.film.sourceBriefing.frame(h.actor(), 0, h.tick());
  assert.deepEqual(h.actor().position, filmEntry(scene)); assert.equal(h.actor().isInMatrix, true);
  assert.equal(h.journey.step, 2); assert.equal(h.journey.sourceBriefing!.phase, 'done');
  assert.equal(h.journey.reflections['m2_plan:1'], 'agency');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});
