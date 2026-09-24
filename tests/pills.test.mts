import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, filmPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_pills;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 0, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmStepPosition(scene, scene.steps[0]) };
  let tick = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => { for (let i = 0; i < Math.round(seconds / .05); i++) { players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick); } };
  command('retry');
  const offer = () => { command('act'); frames(5.1); };
  return { world, sandbox, players, neo, command, frames, offer, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('Morpheus waits for an explicit pill choice and red completes only after the handoff and drink', () => {
  const h = setup(); h.offer();
  assert.equal(h.state().pills?.phase, 'choice'); assert.equal(h.state().step, 1);
  h.frames(20); assert.equal(h.state().pills?.phase, 'choice');
  h.command('reflect:agency'); assert.equal(h.state().pills?.phase, 'choice');
  h.command('pill:red');
  assert.equal(h.state().step, 1); assert.equal(h.sandbox.state.neoLife!.choices.pill, undefined);
  assert.equal(h.state().pills?.choice, 'red');
  h.frames(3); assert.equal(h.state().step, 1); assert.ok(!h.state().completed.includes('m1_pills'));
  h.command('blue'); assert.equal(h.state().pills?.choice, 'red');
  h.frames(12); assert.equal(h.state().scene, 'm1_mirror'); assert.equal(h.state().step, 0);
  assert.equal(h.sandbox.state.neoLife!.choices.pill, 'red');
  assert.equal(h.state().completed.filter(id => id === 'm1_pills').length, 1);
  assert.equal(playerBlocked(h.neo.position, true), false, 'Neo must finish clear of the chair');
  const agency = h.sandbox.state.neoLife!.philosophy.agency; h.command('pill:red'); h.frames(1);
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency);
  const beforeMirror = { ...h.neo.position };
  h.frames(1); assert.deepEqual(h.neo.position, beforeMirror, 'the same-room transition must not teleport Neo back to the doorway');
});

test('blue takes the same physical sequence before preserving the daily-life save', () => {
  const h = setup(); h.offer(); const life = h.sandbox.state.neoLife!;
  life.money = 287; life.evidence = ['clock']; h.command('blue');
  assert.ok(life.journey, 'choosing blue must not immediately remove the encounter');
  h.frames(6); assert.equal(h.neo.currentLocation, 'film_lafayette');
  h.frames(9); assert.equal(life.journey, undefined); assert.equal(life.chapter, 0);
  assert.equal(life.choices.pill, 'blue'); assert.equal(life.money, 287); assert.deepEqual(life.evidence, ['clock']);
  assert.equal(h.neo.currentLocation, 'neo_apartment');
  assert.equal(h.world.agents.get('morpheus')!.currentAction?.parameters.pills, undefined);
});

test('pill gestures survive pause, disconnection, save restore and retry without changing the chosen color', () => {
  const h = setup(); h.offer(); h.command('pill:red'); h.frames(2.25);
  const beat = structuredClone(h.state().pills); const position = { ...h.neo.position };
  const pose = structuredClone(h.neo.currentAction!.parameters.pills);
  h.frames(4, false); assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.position, position);
  h.players.release('player', h.tick()); h.frames(2);
  assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.currentAction!.parameters.pills, pose);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.neo.position, position); assert.deepEqual(h.neo.currentAction!.parameters.pills, pose);
  h.command('retry'); assert.deepEqual(h.state().pills, beat); assert.deepEqual(h.neo.position, position);
  h.frames(12); assert.equal(h.state().scene, 'm1_mirror'); assert.equal(h.state().step, 0);
});

test('a pill performance reserves Morpheus and rejects movement, combat and remote choices', () => {
  const h = setup(); const checkpoint = { ...h.neo.position };
  h.neo.position = filmPosition('film_lafayette', 0, 18);
  h.command('blue'); h.command('pill:red'); assert.equal(h.state().pills, undefined);
  h.neo.position = checkpoint; h.offer(); const position = { ...h.neo.position };
  assert.match(h.players.possess('other', 'morpheus', h.tick()).error!, /递药|交谈/);
  h.players.receiveInput('player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 1 });
  assert.match(h.players.act('player', 'attack', h.tick()), /演出/);
  h.frames(1); assert.deepEqual(h.neo.position, position); assert.equal(h.state().pills?.phase, 'choice');
});

test('an occupied Morpheus is never moved into the pill performance', () => {
  const h = setup(); h.players.possess('other', 'morpheus', h.tick());
  const morpheus = h.world.agents.get('morpheus')!; const position = { ...morpheus.position };
  assert.match(h.command('act'), /另一位玩家/); h.frames(6);
  assert.equal(h.state().pills, undefined); assert.deepEqual(morpheus.position, position);
});
