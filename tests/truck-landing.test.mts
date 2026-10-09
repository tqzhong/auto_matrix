import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, newTruckRoad, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

// Completed-road fixture reproducing the actual cold-load/reclaim failure.
// This is not evidence of a continuous manual freeway playthrough.
test('reclaiming a rescued passenger keeps the landed body out of truck transport and cannot recreate its roof', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('landing-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(world.agents.get('neo')!, 'start', 1); players.release('landing-player', 1);
  const journey = sandbox.life.film.state!, center = FILM_SETS.film_freeway_101.center;
  const road = newTruckRoad({ x: 14, z: 167 }, { x: .3, y: 6.6, z: -3.5, yaw: Math.PI }, { x: 1.3, y: 6.6, z: -10.2, yaw: 0 }, 100);
  road.phase = 'ready'; road.elapsed = 31;
  Object.assign(journey, { scene: 'm2_trucks', actor: 'morpheus', step: 3, completed: ['m2_freeway', 'm2_trucks'],
    trucks: { phase: 'rescued', elapsed: 10, rescueElapsed: 3, lastTick: 362, attempt: 3, road } });
  const actor = world.agents.get('morpheus')!;
  actor.position = { x: center.x - 20.3, y: center.y, z: center.z + 167 }; actor.rotation = Math.PI;
  actor.currentLocation = 'film_freeway_101'; actor.isInMatrix = true; actor.currentAction = null;
  world.agents.get('keymaker')!.health = 40;
  const position = { ...actor.position }, saved = JSON.stringify(journey);
  const roof = () => sandbox.state.structures.filter(item => item.id === 'film:truck-road:roof');
  const structures = JSON.stringify(roof());

  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(players.possess('landing-player', 'morpheus', 362).agentId, 'morpheus');
    assert.equal(actor.currentAction?.parameters.truckRoad, undefined, 'a landed first-person body must not be posed at the old truck roof');
    assert.equal(sandbox.life.film.truckRoad.active(actor), false);
    assert.equal(sandbox.life.film.truckRoad.frame(actor, .05, 362), false);
    players.step(.05, false, 362);
    assert.deepEqual(actor.position, position);
    players.release('landing-player', 362);
    sandbox.life.film.reconcileCast();
    assert.equal(actor.currentAction?.parameters.truckRoad, undefined, 'release and restore must not reinstate completed transport');
    assert.equal(JSON.stringify(journey), saved);
    assert.equal(JSON.stringify(roof()), structures, 'restore must not recreate a completed roof collider');
    assert.equal(world.agents.get('keymaker')!.health, 40);
  }
  actor.currentAction = { type: 'idle', parameters: { resolved: true, truckRoad: { ...road, role: 'morpheus' }, player: false },
    startedAt: 362, duration: 1e9, progress: 0 };
  sandbox.life.film.reconcileCast();
  assert.equal(actor.currentAction, null, 'a completed legacy save must also release its stale truck pose');
  assert.deepEqual(actor.position, position);
  assert.equal(JSON.stringify(journey), saved);
  assert.equal(world.agents.get('keymaker')!.health, 40);
});
