import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import { RelationshipGraph } from '../packages/server/src/agents/RelationshipGraph.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { StateSync } from '../packages/server/src/network/StateSync.js';
import { SimulationLoop } from '../packages/server/src/simulation/SimulationLoop.js';
import { EventBus } from '../packages/server/src/simulation/EventBus.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';

function setup() {
  const world = new WorldState();
  const manager = new AgentManager(world);
  manager.initializeAllAgents();
  const relationships = new RelationshipGraph();
  relationships.initialize();
  return { world, manager, relationships };
}

test('a stationary agent broadcasts changed health, awakening and goals', () => {
  const { world, manager } = setup();
  const sync = new StateSync();
  sync.calculateDelta(world.agents);
  manager.awakenAgent('neo');
  manager.setGoal('neo', '调查代码异常');
  const delta = sync.calculateDelta(world.agents);
  assert.equal(delta.agents.neo?.isAwakened, true);
  assert.equal(delta.agents.neo?.currentGoal, '调查代码异常');
});

test('serialized character switching clears the previous owner on merging clients', () => {
  const { world } = setup();
  const sync = new StateSync();
  const neo = world.agents.get('neo')!; const trinity = world.agents.get('trinity')!;
  neo.controller = 'player';
  const previous = structuredClone(neo);
  sync.calculateDelta(world.agents);
  delete neo.controller; trinity.controller = 'player';
  const delta = JSON.parse(JSON.stringify(sync.calculateDelta(world.agents)));
  assert.equal({ ...previous, ...delta.agents.neo }.controller, null, 'release must survive JSON transport and clear the previous marker');
  assert.equal(delta.agents.trinity.controller, 'player');
});

test('combat changes the actual target, survives the next tick and cannot cross worlds', () => {
  const { world, manager, relationships } = setup();
  const neo = manager.getAgent('neo')!;
  const smith = manager.getAgent('smith')!;
  smith.state.position = { ...neo.state.position };
  const executor = new ActionExecutor(relationships, {} as ConversationEngine);
  const action = { type: 'attack' as const, target: 'neo', parameters: {}, startedAt: 1, duration: 5, progress: 0 };
  executor.execute(smith.state, action, world.agents, 1);
  assert.ok(neo.state.health < neo.state.maxHealth, 'attacks must apply damage');
  const damaged = neo.state.health;
  manager.updateAllAgents(2);
  assert.equal(world.agents.get('neo')!.health, damaged);
  neo.state.isInMatrix = false;
  executor.execute(smith.state, { ...action, startedAt: 2 }, world.agents, 2);
  assert.equal(neo.state.health, damaged, 'separate worlds cannot attack each other');
});

test('real-world residents start outside the Matrix and pedestrians start at street level', () => {
  const { manager } = setup();
  assert.equal(manager.getAgent('tank')!.state.isInMatrix, false);
  assert.equal(manager.getAgent('neo')!.state.position.y, 1);
});

test('world NPC melee warns a player before contact and cannot hit from eight units away', () => {
  const { world, manager, relationships } = setup();
  const neo = manager.getAgent('neo')!.state; const smith = manager.getAgent('smith')!.state;
  neo.controller = 'player'; neo.position = { x: 1120, y: 1, z: 960 };
  smith.position = { ...neo.position, z: 967 };
  const executor = new ActionExecutor(relationships, {} as ConversationEngine);
  const action = { type: 'attack' as const, target: 'neo', parameters: {}, startedAt: 1, duration: 5, progress: 0 };
  executor.execute(smith, action, world.agents, 1); assert.equal(neo.health, 100);
  smith.position.z = 962;
  executor.execute(smith, action, world.agents, 2); assert.equal(neo.health, 100);
  executor.execute(smith, action, world.agents, 3); assert.equal(neo.health, 92);
});

test('slow asynchronous simulation ticks never overlap', async () => {
  let active = 0;
  let maximum = 0;
  const loop = new SimulationLoop(5, 5, 300, 1, new EventBus(), async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 25));
    active--;
  });
  loop.start();
  try {
    await new Promise(resolve => setTimeout(resolve, 80));
  } finally {
    loop.stop();
  }
  assert.equal(maximum, 1);
});
