import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmEntry, filmPosition, filmStepActionReady, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

const scene = FILM_SCENE_BY_ID.m1_phone_escape;
function setup(remaining = 8) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('caller', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('caller', { kind: 'life', target: 'film:start' }, 0);
  const state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, step: 1, actor: 'trinity', checkpoint: filmEntry(scene),
    completed: ['m1_room303', 'm1_roofs'], openingPhone: { phase: 'running', remaining, lastTick: 0, attempts: 0 } });
  const caller = world.agents.get('trinity')!;
  caller.currentLocation = scene.set; caller.isInMatrix = true; caller.position = filmPosition(scene.set, -1, -28.85); caller.rotation = Math.PI;
  players.possess('caller', 'trinity', 0);
  const act = () => players.sandboxAction('caller', { kind: 'life', target: 'film:act' }, 0);
  const frame = (dt = .1, running = true) => players.step(dt, running, 0);
  return { world, sandbox, players, caller, state, act, frame };
}

test('opening answer: neither G nor the journal can connect from the old four metre arrival boundary', () => {
  const h = setup(); h.caller.position = filmPosition(scene.set, 0, -24);
  assert.equal(filmStepActionReady(scene, scene.steps[1], h.caller.position, true, h.state), false);
  h.act(); assert.equal(h.state.openingPhone!.phase, 'running');
  assert.equal(h.state.completed.includes(scene.id), false);
});

test('opening answer: a close press starts a saved pickup while repeated G cannot skip it', () => {
  const h = setup(); h.act();
  assert.equal(h.state.openingPhone!.phase, 'answering');
  assert.equal(h.state.step, 1); assert.equal(h.state.completed.includes(scene.id), false);
  const before = structuredClone(h.state.openingPhone); h.act(); assert.deepEqual(h.state.openingPhone, before);
  h.frame(); assert.equal(h.state.openingPhone!.phase, 'answering');
  assert.ok(h.state.openingPhone!.remaining < 8, 'the truck keeps approaching during pickup');
});

test('opening answer: movement cannot detach the caller from a paused or released pickup', () => {
  const h = setup(); h.act(); for (let i = 0; i < 5; i++) h.frame();
  const position = structuredClone(h.caller.position), phone = structuredClone(h.state.openingPhone), action = structuredClone(h.caller.currentAction);
  h.players.receiveInput('caller', { x: 1, z: 0, yaw: 0, jump: true, sprint: true, sequence: 1 });
  for (let i = 0; i < 5; i++) h.frame(.1, false);
  assert.deepEqual(h.state.openingPhone, phone); assert.deepEqual(h.caller.position, position); assert.deepEqual(h.caller.currentAction, action);
  h.players.release('caller', 0); h.sandbox.tick(20);
  assert.deepEqual(h.state.openingPhone, { ...phone, lastTick: 20 }); assert.deepEqual(h.caller.currentAction, action);
  h.players.possess('caller', 'trinity', 20);
  assert.deepEqual(h.caller.position, position); assert.deepEqual(h.caller.currentAction, action);
});

test('opening answer: only completing the physical pickup connects and starts the saved crash', () => {
  const h = setup(); h.act();
  for (let i = 0; i < 15; i++) h.frame();
  assert.equal(h.state.openingPhone!.phase, 'answering'); assert.equal(h.state.completed.includes(scene.id), false);
  h.frame(); assert.equal(h.state.openingPhone!.phase, 'connected');
  assert.equal(h.state.completed.includes(scene.id), true); assert.equal(h.state.openingPhone!.impactElapsed, 0);
  assert.ok(Math.abs(h.state.openingPhone!.remaining - 6.4) < 1e-8);
  h.frame(); assert.ok(Math.abs(h.state.openingPhone!.impactElapsed! - .1) < 1e-8);
});

test('opening answer: a late pickup still fails and retry restores the booth approach', () => {
  const h = setup(.6); h.act(); for (let i = 0; i < 6; i++) h.frame();
  assert.equal(h.state.openingPhone!.phase, 'failed'); assert.equal(h.state.openingPhone!.remaining, 0);
  assert.equal(h.state.completed.includes(scene.id), false); assert.equal(h.state.step, 1);
  h.players.sandboxAction('caller', { kind: 'life', target: 'film:retry' }, 0);
  assert.deepEqual(h.state.openingPhone, { phase: 'running', remaining: 15, lastTick: 0, attempts: 1 });
  assert.deepEqual(h.caller.position, filmEntry(scene)); assert.equal(h.caller.currentAction, null);
});

test('opening answer: the first story tick cannot spend pickup or countdown time already consumed by player frames', () => {
  const h = setup(); h.act(); for (let i = 0; i < 25; i++) h.frame(.02);
  const phone = structuredClone(h.state.openingPhone), action = structuredClone(h.caller.currentAction);
  h.sandbox.tick(1); assert.deepEqual(h.state.openingPhone, phone); assert.deepEqual(h.caller.currentAction, action);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.deepEqual(h.sandbox.life.film.state!.openingPhone, phone); assert.deepEqual(h.caller.currentAction, action);
});

test('opening answer: a deadline tie fails while reaching the ear before the deadline succeeds', () => {
  for (const [remaining, expected] of [[1.59, 'failed'], [1.6, 'failed'], [1.61, 'connected']] as const) {
    const h = setup(remaining); h.act(); for (let i = 0; i < 16; i++) h.frame();
    assert.equal(h.state.openingPhone!.phase, expected, `${remaining} seconds left`);
    assert.equal(h.state.completed.includes(scene.id), expected === 'connected');
  }
});
