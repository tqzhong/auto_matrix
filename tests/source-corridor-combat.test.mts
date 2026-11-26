import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, meleeReach, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('corridor-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('corridor-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue'); const journey = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m2_key_door;
  Object.assign(journey, { scene: scene.id, actor: 'neo', step: 1, keyDoor: { portalOpened: false, keyTaken: false },
    grid: { primary: 'off', emergency: 'off', vigilant: 'lost', trinity: 'connected', phase: 'window', remaining: 290, lastTick: tick, reroute: 0, attempts: 0 } });
  const actor = world.agents.get('neo')!; actor.currentLocation = scene.set; actor.isInMatrix = true;
  actor.position = filmStepPosition(scene, scene.steps[1], journey); actor.rotation = 0;
  for (const id of ['keymaker', 'morpheus', 'smith']) {
    const a = world.agents.get(id)!; a.currentLocation = scene.set; a.isInMatrix = true; a.position = filmPosition(scene.set, 0, -31);
  }
  world.agents.get('keymaker')!.health = 5;
  for (const id of ['soren', 'axel']) { world.agents.get(id)!.status = 'dead'; world.agents.get(id)!.health = 0; }
  sandbox.tick(tick);
  return { world, sandbox, command, journey, actor, scene };
}

test('all three Smith copies spawn on the playable side of the narrow corridor walls', () => {
  const h = setup(); h.command('act');
  const threats = h.sandbox.state.threats.filter(t => t.scene === 'm2_key_door');
  assert.equal(threats.length, 3); assert.equal(h.journey.fighting, true);
  for (const threat of threats) {
    assert.equal(playerBlocked(threat.position, true, 1.1, h.sandbox.state.structures), false);
    const yaw = Math.atan2(threat.position.x - h.actor.position.x, threat.position.z - h.actor.position.z);
    assert.equal(meleeReach(h.actor.position, yaw, threat.position, 20, true, h.sandbox.state.structures), true,
      'an otherwise free spawn outside a wall is still unreachable from inside the corridor');
    assert.equal(threat.health, 135);
  }
});

test('resuming an old fight brings only its live wall-side copies inside without resetting wounds or kills', () => {
  const h = setup(), center = FILM_SETS.film_source_corridor.center;
  const threat = (id: string, x: number, z: number, health: number) => ({ id, scene: 'm2_key_door', kind: 'smith' as const,
    position: filmPosition(h.scene.set, x, z), matrix: true, health, maxHealth: 135, target: 'neo', stunUntil: 3, lastStrike: 7 });
  h.journey.fighting = true; h.actor.health = 88.6;
  h.actor.position = filmPosition(h.scene.set, 3.799542788146, -28.999237050346);
  h.sandbox.state.threats = [threat('saved-right', 6.442596450574, -29.356932517581, 135), threat('saved-left', -7.79422863406, -29.5, 19),
    threat('inside', 0, -25, 16), threat('past-wall', 7.8, 60, 8), { ...threat('other-room', 7.8, -29.5, 12), scene: 'm2_backup' },
    threat('dead', 7.8, -29.5, 0), { ...threat('other-player', 7.8, -29.5, 9), target: 'trinity' }];
  const saved = structuredClone(h.sandbox.state), actors = JSON.stringify([...h.world.agents]);
  h.sandbox.restore(saved); h.command('act');
  const restored = h.sandbox.state.threats;
  for (let i = 0; i < 2; i++) {
    assert.ok(Math.abs(restored[i].position.x - center.x) < 3.8);
    assert.equal(restored[i].position.y, saved.threats[i].position.y); assert.equal(restored[i].position.z, saved.threats[i].position.z);
    const { position: _oldPosition, ...before } = saved.threats[i], { position: _position, ...after } = restored[i];
    assert.deepEqual(after, before);
  }
  assert.equal(meleeReach(h.actor.position, Math.atan2(restored[0].position.x - h.actor.position.x, restored[0].position.z - h.actor.position.z),
    restored[0].position, 3.7, true, h.sandbox.state.structures), true, 'the actual stranded survivor can now be hit normally');
  assert.deepEqual(restored.slice(2), saved.threats.slice(2)); assert.equal(JSON.stringify([...h.world.agents]), actors);
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.life.film.state!.fighting, true);
  const once = structuredClone(restored); h.command('act'); assert.deepEqual(h.sandbox.state.threats, once);
});
