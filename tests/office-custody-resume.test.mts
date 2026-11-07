import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, OFFICE_CUSTODY, filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(moving: boolean) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0);
  const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  neo.position = filmPosition('film_metacortex_floor', 0, -12); neo.currentLocation = 'film_metacortex_floor';
  sandbox.state.neoLife!.journey = {
    version: 1, scene: 'm1_office_escape', step: FILM_SCENE_BY_ID.m1_office_escape.steps.length,
    actor: 'neo', completed: ['m1_boss'], enteredAt: 0, checkpoint: { ...neo.position }, reflections: {}, lastText: '',
    office: { alert: 100, suspicion: [100, 0, 0], waypoints: [1, 1, 1], lastTick: 0, guide: '', outcome: 'captured' },
  };
  sandbox.life.film.custody.begin(neo, 0);
  const custody = sandbox.state.neoLife!.journey.office!.custody!;
  custody.phase = 'escorting'; custody.elapsed = OFFICE_CUSTODY.securing;
  players.receiveInput('player', { x: moving ? 1 : 0, z: 0, yaw: Math.PI / 2, sprint: false, jump: false, sequence: 1 });
  players.step(.05, true, 1);
  assert.equal(neo.currentAction?.type, moving ? 'move_to' : 'idle');
  return { world, sandbox, neo, players, conversations, dynamics };
}

for (const moving of [false, true]) {
  test(`paused cuffed ${moving ? 'walking' : 'standing'} retains its full action through release, restore and re-entry`, () => {
    const h = setup(moving); h.players.step(.05, false, 1);
    const snapshot = () => structuredClone({ action: h.neo.currentAction, position: h.neo.position, rotation: h.neo.rotation, velocity: h.neo.velocity });
    const expected = snapshot(), custody = structuredClone(h.sandbox.state.neoLife!.journey!.office!.custody);
    h.players.release('player', 1); assert.deepEqual(snapshot(), expected, 'disconnect must retain the paused action');
    h.sandbox.restore(structuredClone(h.sandbox.state)); assert.deepEqual(snapshot(), expected, 'restoring custody must retain the paused action');
    const restarted = new PlayerController(h.world, h.conversations, {} as ActionExecutor, h.dynamics, h.sandbox);
    restarted.step(.05, false, 1); assert.equal(restarted.possess('new-player', 'neo', 1).agentId, 'neo');
    assert.deepEqual(snapshot(), expected, 'a new session must retain the paused action');
    assert.deepEqual(h.sandbox.state.neoLife!.journey!.office!.custody, custody);
    restarted.step(.05, true, 2);
    assert.equal(h.neo.currentAction?.type, 'idle', 'resuming must wait for fresh movement input');
    assert.deepEqual(h.neo.position, expected.position);
  });
}

test('a running cuffed player stops walking when disconnected', () => {
  const h = setup(true), position = { ...h.neo.position };
  h.players.release('player', 1); h.players.step(.1, true, 2);
  assert.notEqual(h.neo.currentAction?.type, 'move_to');
  assert.deepEqual(h.neo.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(h.neo.position, position);
});

test('a legacy custody save without an action rebuilds its cuffs on re-entry', () => {
  const h = setup(false); h.players.step(.05, false, 1); h.players.release('player', 1); h.neo.currentAction = null;
  const position = { ...h.neo.position };
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.players.possess('returning-player', 'neo', 1).agentId, 'neo');
  assert.equal(h.neo.currentAction?.parameters.officeCustody?.phase, 'escorting');
  assert.deepEqual(h.neo.position, position);
});
