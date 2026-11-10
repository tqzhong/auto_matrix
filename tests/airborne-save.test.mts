import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, PLAYER_GRAVITY, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function fixture(frames = 5, jump = true) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const dynamics = { record: (_event: Partial<WorldEvent>) => {} } as unknown as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 123);
  const create = () => new PlayerController(world, conversations, {} as ActionExecutor, dynamics, sandbox);
  const players = create(), actor = world.agents.get('trinity')!;
  actor.isInMatrix = true; actor.currentLocation = 'film_hotel_roofs'; actor.position = filmPosition('film_hotel_roofs', 0, 10);
  assert.equal(players.possess('old', actor.id, 0).agentId, actor.id);
  players.receiveInput('old', { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump, sequence: 1 });
  for (let i = 0; i < frames; i++) players.step(.02, true, 1);
  return { world, sandbox, actor, players, create };
}

for (const [name, frames] of [['rising', 5], ['falling', 22]] as const) test(`airborne motion: pausing a ${name} jump freezes its actual velocity and position`, () => {
  const h = fixture(frames), before = structuredClone({ position: h.actor.position, velocity: h.actor.velocity, rotation: h.actor.rotation });
  assert.ok(h.actor.position.y > 1.2 && (name === 'rising' ? h.actor.velocity.y > 0 : h.actor.velocity.y < 0));
  for (let i = 0; i < 10; i++) h.players.step(.02, false, 1);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity, rotation: h.actor.rotation }, before);
  h.players.receiveInput('old', { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: false, sequence: 2 });
  h.players.step(.02, true, 1);
  assert.ok(Math.abs(h.actor.position.y - (before.position.y + before.velocity.y * .02 - .5 * PLAYER_GRAVITY * .02 ** 2)) < 1e-9);
});

test('airborne motion: a just-launched jump retains its upward momentum below the landing tolerance', () => {
  const h = fixture(0); h.players.step(.005, true, 1);
  const before = structuredClone({ position: h.actor.position, velocity: h.actor.velocity });
  assert.ok(before.position.y > 1 && before.position.y < 1.1 && before.velocity.y > 0);
  h.players.step(.02, false, 1); h.players.release('old', 1);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity }, before);
  const next = h.create(); next.possess('new', h.actor.id, 1); next.step(.02, true, 1);
  assert.ok(h.actor.position.y > before.position.y && h.actor.velocity.y > 0);
});

for (const paused of [false, true]) test(`airborne motion: ${paused ? 'paused' : 'active'} disconnect and a fresh controller retain momentum without replaying the jump key`, () => {
  const h = fixture(), before = structuredClone({ position: h.actor.position, velocity: h.actor.velocity });
  if (paused) h.players.step(.02, false, 1);
  h.players.release('old', 1); assert.equal(h.actor.controller, undefined); assert.equal(h.actor.currentAction, null);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity }, before);
  const next = h.create(); assert.equal(next.possess('new', h.actor.id, 1).agentId, h.actor.id);
  next.step(.02, false, 1);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity }, before);
  let peak = h.actor.position.y;
  for (let i = 0; i < 80; i++) { next.step(.02, true, 1); peak = Math.max(peak, h.actor.position.y); }
  assert.ok(peak > before.position.y && peak < 2.7, 'rejoining continues one ballistic jump');
  assert.equal(h.actor.position.y, 1); assert.equal(h.actor.velocity.y, 0);
});

test('airborne motion: transferring ownership retains the complete moving body while clearing old input', () => {
  const h = fixture(), before = structuredClone({ position: h.actor.position, velocity: h.actor.velocity });
  assert.equal(h.players.possess('new', h.actor.id, 1, true).agentId, h.actor.id);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity }, before);
  h.players.step(.02, false, 1);
  assert.deepEqual({ position: h.actor.position, velocity: h.actor.velocity }, before);
});

test('airborne motion: grounded movement and dead bodies still stop when paused and disconnected', () => {
  for (const dead of [false, true]) {
    const h = fixture(5, dead);
    if (dead) { h.actor.status = 'dead'; h.actor.health = 0; }
    h.players.step(.02, false, 1); assert.deepEqual(h.actor.velocity, { x: 0, y: 0, z: 0 });
    h.players.release('old', 1); assert.deepEqual(h.actor.velocity, { x: 0, y: 0, z: 0 });
  }
});
