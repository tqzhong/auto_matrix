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

test('a paused evacuation retry restores the reopened hatch in its saved order among city traffic', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('neb-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('neb-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_ship_lost', actor: 'neo', step: 2,
    shipLoss: { phase: 'briefing', remaining: 32, lastTick: tick, attempts: 0 } });
  for (const [id, x, z] of [['neo', 0, 0], ['morpheus', -1.5, 24], ['trinity', 5, 24], ['link', 4, 1]] as const) {
    const actor = world.agents.get(id)!;
    actor.position = filmPosition('film_neb_deck', x, z); actor.currentLocation = 'film_neb_deck'; actor.isInMatrix = false;
  }
  world.agents.get('link')!.health = 80;
  sandbox.traffic.restore(); command('act');
  assert.equal(journey.shipLoss!.phase, 'evacuating');
  for (let frame = 0; frame < 340 && journey.shipLoss!.phase !== 'failed'; frame++) {
    players.receiveInput('neb-player', { x: 0, z: 0, yaw: 0, jump: false, sequence: ++sequence });
    players.step(.1, true, tick);
    if (frame % 5 === 4) sandbox.tick(++tick);
  }
  assert.equal(journey.shipLoss!.phase, 'failed');
  assert.equal(sandbox.state.structures.some(s => s.id === 'film:neb-escape:hatch'), false);
  command('retry'); players.step(.1, false, tick); players.release('neb-player', tick);
  assert.equal(journey.shipLoss!.phase, 'evacuating'); assert.equal(journey.shipLoss!.attempts, 1);
  const saved = JSON.parse(JSON.stringify(sandbox.state));
  const actors = JSON.stringify([...world.agents]);
  const order = saved.structures.map((s: { id: string }) => s.id);
  assert(order.indexOf('film:neb-escape:hatch') > order.indexOf('traffic:63'), 'retry must exercise the newly reinserted hatch');
  sandbox.restore(saved);
  assert.deepEqual(sandbox.state.structures.map(s => s.id), order, 'loading must preserve the real saved collider order');
  assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(sandbox.state)), saved), 'the complete serialized sandbox must survive the retry restore');
  assert.equal(JSON.stringify([...world.agents]), actors, 'restoring cannot change any actor or old wound');
  assert.equal(world.agents.get('link')!.health, 80);
});
