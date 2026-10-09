import assert from 'node:assert/strict';
import test from 'node:test';
import { HAMMER_BRIEFING, FILM_SETS, FILM_SCENE_BY_ID, filmStepPosition, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  let tick = 0, sequence = 0;
  players.possess('briefing-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  const command = (target: string) => players.sandboxAction('briefing-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm3_bane_questions', actor: 'roland', step: 6,
    completed: ['m3_oracle_absorbed', 'm3_bane_questions'], reflections: {} });
  sandbox.state.neoLife!.choices.bane_neural_scan = 'abnormal';
  players.possess('briefing-player', 'roland', tick);
  world.agents.get('neo')!.health = 43;
  command('next');
  const actor = () => players.getAgent('briefing-player') ?? world.agents.get('neo')!;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('briefing-player', { x: 0, z: 0, yaw: actor().rotation, location: actor().currentLocation, sequence: ++sequence });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  const near = (step: number) => { actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_logos_plan, FILM_SCENE_BY_ID.m3_logos_plan.steps[step], sandbox.life.film.state); };
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, command, actor, frames, near, tick: () => tick };
}

test('the ship briefing reports Bane’s uncertain identity without inventing his later disappearance', () => {
  const h = setup();
  assert.equal(h.state.scene, 'm3_logos_plan'); assert.equal(h.actor().id, 'neo'); assert.equal(h.actor().health, 43);
  assert.doesNotMatch(h.state.lastText, /不知道.{0,6}在哪里|无法.{0,6}在哪里|没有证据能证明他现在在哪里/);
  assert.equal(h.world.agents.get('maggie')!.status, 'alive');
  assert.equal(h.sandbox.state.neoLife!.choices.bane_escape_route, undefined);
});

test('Roland’s objection cannot be skipped by the old short interaction timer', () => {
  const h = setup(); h.near(0); h.frames(.1); assert.equal(h.state.step, 1);
  h.near(1); h.command('act'); h.frames(3);
  assert.equal(h.state.step, 1, 'Neo must finish his proposal, hear Roland, and explicitly insist before Niobe lends her ship');
  assert.equal(h.sandbox.state.neoLife!.choices.logos_assignment, undefined);
  assert.ok(h.state.hammerBriefing, 'the proposal and loan clocks must be saved');
});

function borrow(h: ReturnType<typeof setup>) {
  h.near(0); h.frames(.1); h.near(1); h.command('act');
  h.frames(HAMMER_BRIEFING.proposal.length * HAMMER_BRIEFING.lineSeconds + .1);
  assert.equal(h.state.hammerBriefing?.phase, 'objection');
  assert.equal(h.sandbox.state.neoLife!.choices.logos_assignment, undefined);
  h.frames(3); assert.equal(h.state.hammerBriefing?.phase, 'objection', 'waiting cannot insist for Neo');
  h.command('act'); h.frames(HAMMER_BRIEFING.loan.length * HAMMER_BRIEFING.lineSeconds + .1);
  assert.equal(h.state.step, 2); assert.equal(h.state.hammerBriefing?.phase, 'route');
}

test('the two routes require correct confirmation, then a separate belief exchange and one saved judgment', () => {
  const h = setup(), life = h.sandbox.state.neoLife!; borrow(h);
  assert.equal(life.choices.logos_assignment, 'neo_trinity'); assert.equal(life.choices.hammer_assignment, 'niobe_zion');
  const before = JSON.stringify(life.philosophy); h.command('reflect:agency'); assert.equal(JSON.stringify(life.philosophy), before);
  h.near(2); h.command('act'); h.frames(HAMMER_BRIEFING.planning.length * HAMMER_BRIEFING.lineSeconds + .1);
  assert.equal(h.state.hammerBriefing?.phase, 'confirmation');
  assert.match(h.command('route:hammer:machine_city'), /不符/); assert.equal(h.state.hammerBriefing!.mistakes, 1); assert.equal(h.state.step, 2);
  h.command('route:hammer:zion'); assert.deepEqual(h.state.hammerBriefing!.confirmed, ['hammer']);
  h.command('route:logos:machine_city'); assert.equal(h.state.step, 3); assert.equal(h.state.hammerBriefing!.phase, 'faith');
  assert.equal(life.choices.logos_ammunition, 'declined');
  h.command('reflect:agency'); assert.equal(JSON.stringify(life.philosophy), before, 'the belief dialogue cannot be bypassed');
  h.near(3); h.command('act'); h.frames(HAMMER_BRIEFING.belief.length * HAMMER_BRIEFING.lineSeconds + .1);
  assert.equal(h.state.hammerBriefing!.phase, 'reflection');
  h.command('reflect:trust'); const philosophy = JSON.stringify(life.philosophy); h.command('reflect:agency');
  assert.equal(JSON.stringify(life.philosophy), philosophy); assert.equal(h.state.hammerBriefing!.reply, 'trust');
  h.frames(HAMMER_BRIEFING.lineSeconds + .1); assert.equal(h.state.step, 4);
  h.command('next'); assert.equal(h.state.scene, 'm3_logos_plan', 'Neo must actually leave with Trinity');
  h.near(4); h.frames(3); assert.equal(h.state.hammerBriefing!.phase, 'done');
  assert.equal(h.world.agents.get('maggie')!.status, 'alive'); assert.equal(life.choices.bane_escape_route, undefined);
  h.command('next'); assert.equal(h.state.scene, 'm3_zion_prepare');
});

test('paused, released and restored proposals preserve clocks, cast poses, health, inventory and decisions', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(6.7);
  const state = structuredClone(h.state.hammerBriefing), position = { ...h.actor().position };
  const cast = HAMMER_BRIEFING.cast.map(id => structuredClone(h.world.agents.get(id)!.currentAction));
  const inventory = structuredClone(h.sandbox.state.profiles.neo.inventory);
  h.frames(7, false); assert.deepEqual(h.state.hammerBriefing, state); assert.deepEqual(h.actor().position, position);
  assert.deepEqual(HAMMER_BRIEFING.cast.map(id => h.world.agents.get(id)!.currentAction), cast);
  h.players.release('briefing-player', h.tick()); h.frames(7); assert.deepEqual(h.state.hammerBriefing, state);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('briefing-player', 'neo', h.tick());
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.hammerBriefing)), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(h.sandbox.state.profiles.neo.inventory, inventory); assert.equal(h.actor().health, 43);
  h.frames(.5); assert.ok(h.state.hammerBriefing!.elapsed > state!.elapsed);
});

test('an occupied or dead participant stops the meeting without stealing, moving or healing that character', () => {
  const h = setup(); h.near(0); h.frames(.1); h.command('act'); h.frames(4);
  const niobe = h.world.agents.get('niobe')!, saved = h.state.hammerBriefing!.elapsed;
  niobe.controller = 'other-player'; niobe.position = { x: 3, y: 2, z: 1 }; niobe.health = 17;
  h.frames(8); h.command('act'); assert.equal(h.state.hammerBriefing!.elapsed, saved);
  assert.deepEqual(niobe.position, { x: 3, y: 2, z: 1 }); assert.equal(niobe.health, 17); assert.equal(niobe.controller, 'other-player');
  niobe.controller = null; niobe.status = 'dead'; niobe.health = 0; const position = { ...niobe.position };
  h.frames(8); h.command('retry'); assert.equal(h.state.hammerBriefing!.elapsed, saved);
  assert.equal(niobe.status, 'dead'); assert.equal(niobe.health, 0); assert.deepEqual(niobe.position, position);
});

test('explicit retry restores only Neo’s injured checkpoint without undoing the meeting or refilling supplies', () => {
  const h = setup(); borrow(h); const inventory = structuredClone(h.sandbox.state.profiles.neo.inventory);
  const niobe = h.world.agents.get('niobe')!; niobe.health = 17;
  h.near(2); h.command('act'); h.frames(2.7); const clock = h.state.hammerBriefing!.elapsed;
  h.actor().status = 'dead'; h.actor().health = 0; h.frames(5); assert.equal(h.state.hammerBriefing!.elapsed, clock);
  h.command('retry'); assert.equal(h.actor().status, 'alive'); assert.equal(h.actor().health, 43);
  assert.equal(niobe.health, 17); assert.deepEqual(h.sandbox.state.profiles.neo.inventory, inventory);
  assert.equal(h.state.hammerBriefing!.elapsed, clock); assert.equal(h.sandbox.state.neoLife!.choices.logos_assignment, 'neo_trinity');
});

test('the untouched old hall entry migrates once, while an already walked checkpoint and heading stay intact', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m3_logos_plan;
  delete h.state.hammerBriefing; h.actor().position = filmPosition(scene.set, 0, FILM_SETS[scene.set].depth * .32);
  h.sandbox.life.film.hammerBriefing.frame(h.actor(), 0, h.tick());
  assert.deepEqual(h.actor().position, filmPosition(scene.set, HAMMER_BRIEFING.entry.x, HAMMER_BRIEFING.entry.z));
  delete h.state.hammerBriefing; h.actor().position.x += .8; h.actor().rotation = .42; const position = { ...h.actor().position };
  h.sandbox.life.film.hammerBriefing.frame(h.actor(), 0, h.tick());
  assert.deepEqual(h.actor().position, position); assert.equal(h.actor().rotation, .42);
});

test('the physical terminal and room walls block movement instead of relying on visible scenery alone', () => {
  const h = setup(), scene = FILM_SCENE_BY_ID.m3_logos_plan;
  assert.equal(playerBlocked(filmPosition(scene.set, HAMMER_BRIEFING.console.x, HAMMER_BRIEFING.console.z), false, 1.1, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(scene.set, HAMMER_BRIEFING.inspection.x, HAMMER_BRIEFING.inspection.z), false, 1.1, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(filmPosition(scene.set, 9.2, 3), false, 1.1, h.sandbox.state.structures), true);
});
