import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  sandbox.traffic.restore();
  return { world, sandbox, players };
}

test('a train entering Mobil Ave preserves all saved carriage colliders in their original traffic order', () => {
  const h = setup(), actor = h.world.agents.get('neo')!;
  h.players.possess('mobil-player', 'neo', 0); h.sandbox.life.begin(actor, 0); h.sandbox.state.neoLife!.chapter = 1;
  h.sandbox.life.film.command(actor, 'continue', 1);
  const journey = h.sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm3_trainman', actor: 'neo', step: 0,
    mobil: { phase: 'waiting', elapsed: 0, lastTick: 1, loops: 0 } });
  actor.position = filmPosition('film_mobil_station', -7, -8); actor.currentLocation = 'film_mobil_station'; actor.isInMatrix = true;
  h.players.step(.052, true, 1); h.players.step(.1, false, 1); h.players.release('mobil-player', 1);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  assert.equal(saved.neoLife.journey.mobil.phase, 'approaching');
  const order = saved.structures.map((s: { id: string }) => s.id);
  assert(order.indexOf('film:mobil:floor') > order.indexOf('traffic:63'), 'new carriage colliders must follow the existing city traffic in this save');
  const actors = JSON.stringify([...h.world.agents]);
  h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.state.structures.map(s => s.id), order);
  assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(h.sandbox.state)), saved), 'the entire serialized sandbox must survive a paused train arrival');
  assert.ok(JSON.stringify([...h.world.agents]) === actors, 'restore cannot change any saved actor');
});

test('ordinary world structures added after traffic keep their saved values and order on restore', () => {
  const h = setup();
  h.sandbox.state.structures.push({ id: 'player:test-wall', kind: 'barricade', owner: 'neo', health: 37, matrix: true,
    position: { x: 6000, y: 1, z: 6000 } });
  const saved = structuredClone(h.sandbox.state);
  h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.state.structures, saved.structures);
  assert.ok(isDeepStrictEqual(h.sandbox.state, saved), 'a non-story save must retain the same sandbox');
});

test('restoring a missing traffic collider still generates it without reordering saved world structures', () => {
  const h = setup();
  h.sandbox.state.structures = h.sandbox.state.structures.filter(s => s.id !== 'traffic:63');
  h.sandbox.state.structures.push({ id: 'player:test-wall', kind: 'barricade', owner: 'neo', health: 37, matrix: true,
    position: { x: 6000, y: 1, z: 6000 } });
  const saved = structuredClone(h.sandbox.state);
  h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.state.structures.slice(0, saved.structures.length), saved.structures);
  assert.equal(h.sandbox.state.structures.at(-1)!.id, 'traffic:63');
  assert.equal(h.sandbox.state.structures.filter(s => s.id.startsWith('traffic:')).length, 64);
  assert.deepEqual(h.sandbox.state.traffic, saved.traffic);
});
