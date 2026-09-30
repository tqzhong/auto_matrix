import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, type WorldEvent } from '@auto_matrix/shared';
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
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  players.possess('test', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  const act = (target = 'act') => players.sandboxAction('test', { kind: 'life', target: `film:${target}` }, 1);
  act('continue'); Object.assign(sandbox.life.film.state!, { scene: 'm1_desert', actor: 'neo', step: 2, awakening: undefined }); act('next');
  const frames = (count: number) => { for (let i = 0; i < count; i++) players.step(.1, true, 1); };
  return { world, sandbox, players, act, frames, neo: world.agents.get('neo')!, state: () => sandbox.life.film.state! };
}

test('truth is followed by a requested exit, physical unplugging and a bedside answer before training', () => {
  const h = setup();
  assert.equal(h.state().scene, 'm1_truth_exit', 'the desert cannot jump straight to kung fu upload');
  assert.equal(h.neo.currentLocation, 'film_white_construct');
  h.frames(100); assert.equal(h.state().truthRecovery?.phase, 'ready');
  h.act('next'); assert.equal(h.state().scene, 'm1_truth_exit', 'next cannot bypass the requested exit');
  h.act('reflect:agency'); assert.equal(h.state().truthRecovery?.phase, 'ready');
  h.act(); h.frames(65);
  assert.equal(h.state().scene, 'm1_truth_return');
  assert.equal(h.neo.isInMatrix, false); assert.equal(h.state().truthRecovery?.phase, 'unplug');
  assert.equal(h.neo.currentAction?.parameters.seated, true, 'the cable is removed while Neo is still seated');
  h.frames(145); assert.equal(h.state().truthRecovery?.phase, 'rest');
  assert.equal(h.state().step, 1);
  h.frames(185); assert.equal(h.state().truthRecovery?.phase, 'question');
  const agency = h.sandbox.state.neoLife!.philosophy.agency;
  h.act('reflect:agency');
  assert.equal(h.state().scene, 'm1_download');
  assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1);
  assert.equal(h.state().reflections['m1_truth_return:2'], 'agency');
  assert.ok(h.state().completed.includes('m1_truth_exit') && h.state().completed.includes('m1_truth_return'));
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.act('reflect:agency'); assert.equal(h.sandbox.state.neoLife!.philosophy.agency, agency + 1, 'reload cannot score the answer twice');
});

test('unplugging pauses for the player, world and occupied crew and resumes its physical checkpoint', () => {
  const h = setup(); h.act(); h.frames(85);
  const state = h.state(); assert.equal(state.scene, 'm1_truth_return');
  const elapsed = state.truthRecovery!.elapsed, position = { ...h.neo.position };
  h.players.step(.5, false, 1); assert.equal(state.truthRecovery!.elapsed, elapsed);
  h.players.possess('other', 'trinity', 1); h.frames(25);
  assert.equal(state.truthRecovery!.elapsed, elapsed);
  assert.match(h.act(), /另一位玩家/);
  h.players.release('other', 1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  h.players.release('test', 1); h.frames(30); h.players.possess('test', 'neo', 1);
  assert.equal(h.state().truthRecovery!.elapsed, elapsed); assert.deepEqual(h.neo.position, position);
  h.act('retry'); assert.equal(h.state().truthRecovery!.elapsed, elapsed, 'reconnecting to a safe authored scene preserves the action clock');
  h.frames(125); assert.equal(h.state().truthRecovery?.phase, 'rest');
  assert.ok(Math.abs(h.neo.position.x - filmPosition('film_neb_deck', 12, -34).x) < 1, 'blackout ends in the cabin bed');
});

test('existing training saves stay in training while completed desert saves include the new aftermath', () => {
  const h = setup(); assert.equal(FILM_SCENE_BY_ID.m1_truth_return.set, 'film_neb_deck');
  Object.assign(h.state(), { scene: 'm1_download', step: 0, truthRecovery: undefined });
  h.neo.currentLocation = 'film_neb_deck'; h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(h.state().scene, 'm1_download'); assert.equal(h.state().training?.kind, 'download');
});
