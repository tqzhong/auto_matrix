import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CITY_BUILDINGS, groundHeight, playerBlocked, stepPlayer, locationEntrance, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { CheckpointStore } from '../packages/server/src/world/CheckpointStore.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const input = { x: 1, z: 0, yaw: Math.PI / 2, sprint: false, jump: false, sequence: 1 };
function setup() {
  const world = new WorldState(); const manager = new AgentManager(world); manager.initializeAllAgents();
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const events: Partial<WorldEvent>[] = [];
  const dynamics = { record: (event: Partial<WorldEvent>) => events.push(event) } as unknown as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 123);
  const players = new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  return { world, manager, players, events, sandbox };
}

test('every live character can be possessed; ownership is exclusive and disconnect releases AI', () => {
  const { world, players } = setup();
  for (const id of world.agents.keys()) {
    assert.equal(players.possess('player-1', id, 0).agentId, id);
    assert.equal(world.agents.get(id)!.controller, 'player');
    assert.ok(players.possess('player-2', id, 0).error);
    players.release('player-1', 0);
    assert.equal(world.agents.get(id)!.controller, undefined);
  }
});

test('explicitly continuing in another page transfers control without resetting saved progress', () => {
  const { world, players, sandbox } = setup();
  players.possess('old-page', 'neo', 10);
  const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 10);
  neo.position = { x: 1120, y: 1, z: 960 }; neo.rotation = .7; neo.health = 63;
  sandbox.state.profiles.neo.inventory.code = 23;
  sandbox.state.neoLife!.chapter = 4; sandbox.state.neoLife!.money = 280;
  const position = { ...neo.position };
  const replaced: string[] = []; players.onReplaced = id => replaced.push(id);
  players.receiveInput('old-page', { ...input, sequence: 50 });
  players.possess('new-page', 'trinity', 11);
  const progress = structuredClone(sandbox.state);
  assert.equal(players.possess('new-page', 'neo', 12, true).agentId, 'neo');
  sandbox.life.begin(neo, 12);
  assert.deepEqual(replaced, ['old-page']);
  assert.equal(players.getAgent('old-page'), undefined);
  assert.equal(players.getAgent('new-page'), neo);
  assert.equal(world.agents.get('trinity')!.controller, undefined);
  assert.equal(neo.controller, 'player'); assert.equal(neo.health, 63);
  assert.deepEqual(sandbox.state, progress);
  players.receiveInput('old-page', { ...input, sequence: 51 });
  players.release('old-page', 13); players.step(.05, true, 14);
  assert.equal(neo.controller, 'player', 'a late disconnect from the old page must not release the new player');
  assert.deepEqual(neo.position, position, 'old movement must not carry over');
  assert.equal(neo.rotation, .7);
  players.receiveInput('new-page', input); players.step(.05, true, 15);
  assert.ok(neo.position.x > position.x, 'new page can send input starting from sequence one');
});

test('continuing an invalid character cannot displace either active player', () => {
  const { players } = setup();
  players.possess('old-page', 'neo', 0); players.possess('new-page', 'trinity', 0);
  assert.ok(players.possess('new-page', 'missing-character', 1, true).error);
  assert.equal(players.getAgent('old-page')!.id, 'neo');
  assert.equal(players.getAgent('new-page')!.id, 'trinity');
});

test('movement is server-integrated, input is bounded, and pauses stop the player', () => {
  const { world, players } = setup();
  players.possess('player', 'neo', 0);
  const agent = world.agents.get('neo')!;
  agent.position = { x: 1120, y: 1, z: 960 };
  const start = { ...agent.position };
  players.receiveInput('player', input); players.step(0.05, true, 1);
  assert.ok(agent.position.x > start.x);
  const moved = { ...agent.position };
  players.step(0.05, false, 2);
  assert.deepEqual(agent.position, moved);
  players.receiveInput('player', { ...input, x: 9999, sequence: 2 }); players.step(0.05, true, 3);
  assert.ok(agent.position.x - moved.x <= 12 * 0.05 + 0.001);
  players.step(0.05, true, 4, Date.now() + 1000);
  const stopped = { ...agent.position };
  players.step(0.05, true, 5, Date.now() + 1100);
  assert.deepEqual(agent.position, stopped, 'stale input must stop movement');
  assert.equal(agent.rotation, input.yaw, 'losing input must preserve the camera heading');
});

test('choosing a fallen character reconstructs it without erasing its identity or history', () => {
  const { world, players, events } = setup();
  const agent = world.agents.get('neo')!;
  agent.status = 'dead'; agent.health = 0; agent.isAwakened = true;
  const home = agent.mind!.home;
  const suspicion = agent.mind!.suspicion;
  assert.equal(players.possess('player', 'neo', 240).agentId, 'neo');
  assert.equal(agent.status, 'alive'); assert.equal(agent.health, agent.maxHealth);
  assert.equal(agent.isAwakened, true); assert.equal(agent.mind!.suspicion, suspicion);
  assert.deepEqual(agent.position, locationEntrance(home));
  assert.equal(events[0].type, 'agent_spawn'); assert.equal(events[0].tick, 240);
  assert.deepEqual(events[0].involvedAgents, ['neo']);
});

test('player cannot walk through rendered buildings and jumps land on the ground', () => {
  const building = CITY_BUILDINGS[0];
  let position = { x: building.x - building.width / 2 - 2, y: 1, z: building.z };
  for (let i = 0; i < 100; i++) position = stepPlayer(position, 0, input, 0.05, true).position;
  assert.equal(playerBlocked(position, true), false);
  assert.ok(position.x < building.x - building.width / 2);
  position = { x: 1120, y: 1, z: 960 };
  let vy = 0; let peak = 1;
  for (let i = 0; i < 100; i++) {
    const result = stepPlayer(position, vy, { ...input, x: 0, jump: i === 0 }, 0.05, true);
    position = result.position; vy = result.verticalVelocity; peak = Math.max(peak, position.y);
  }
  assert.ok(peak > 2.3 && peak < 2.9);
  assert.equal(position.y, groundHeight(position, true));
  assert.equal(playerBlocked(locationEntrance('mobil_ave'), true), false);
});

test('locomotion accelerates, brakes and removes velocity into a wall', () => {
  let position = { x: 1120, y: 1, z: 960 }; let velocity = { x: 0, z: 0 };
  const start = stepPlayer(position, 0, input, .05, true, [], velocity);
  assert.ok(start.position.x - position.x > 0 && start.position.x - position.x < 6 * .05);
  position = start.position; velocity = start.horizontalVelocity;
  for (let i = 0; i < 60; i++) {
    const step = stepPlayer(position, 0, { ...input, x: 0 }, .016, true, [], velocity);
    position = step.position; velocity = step.horizontalVelocity;
  }
  assert.ok(Math.abs(velocity.x) < .01);
  const wall = CITY_BUILDINGS[0]; position = { x: wall.x - wall.width / 2 - 1.11, y: 1, z: wall.z };
  const blocked = stepPlayer(position, 0, input, .05, true, [], { x: 6, z: 0 });
  assert.equal(blocked.horizontalVelocity.x, 0);
});

test('possessing a resident inside an old building footprint places them at a walkable entrance', () => {
  const { world, players } = setup();
  const agent = world.agents.get('neo')!; const building = CITY_BUILDINGS[0];
  agent.position = { x: building.x, y: 1, z: building.z };
  players.possess('player', agent.id, 20);
  assert.equal(playerBlocked(agent.position, true), false);
});

test('checkpoints restore agent state and causal history atomically', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-world-'));
  try {
    const store = new CheckpointStore(path.join(directory, 'world.json'));
    assert.equal(await store.load(), null);
    const { world } = setup(); world.agents.get('neo')!.health = 63;
    await store.save({ version: 1, tick: 180, phase: 'phase2_awakening', agents: Object.fromEntries(world.agents), events: [], relationships: [] });
    const restored = await store.load();
    assert.equal(restored!.tick, 180); assert.equal(restored!.agents.neo.health, 63);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
