import assert from 'node:assert/strict';
import test from 'node:test';
import { ARREST_CAR, FILM_SCENE_BY_ID, arrestCarPoint, playerBlocked, type OfficeCustody, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

for (const parking of [13, 25, -40]) test(`the rear passenger yields to a real car at parking ${parking}, then boards without clipping or healing`, () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const custody: OfficeCustody = { phase: 'street', elapsed: 3.2, catcher: 'smith', leader: 'agent_brown',
    bodies: { smith: { position: { ...neo.position }, yaw: 0 }, agent_brown: { position: { ...neo.position }, yaw: 0 }, agent_jones: { position: { ...neo.position }, yaw: 0 } },
    street: { phase: 'rear_approach', elapsed: 0, parking: { x: parking, z: 49 }, from: {} } };
  const rear = arrestCarPoint(ARREST_CAR.rear.x, ARREST_CAR.rear.z, custody.street);
  const start = { ...rear, x: rear.x - 1.129, z: rear.z - .482 };
  for (const [id, seat] of [['neo', ARREST_CAR.seats.neo], ['smith', ARREST_CAR.seats.rear], ['agent_brown', ARREST_CAR.seats.driver], ['agent_jones', ARREST_CAR.seats.front]] as const) {
    const actor = world.agents.get(id)!; actor.health = 63; actor.currentLocation = 'metacortex_office'; actor.isInMatrix = true;
    actor.position = id === 'smith' ? { ...start } : arrestCarPoint(seat.x, seat.z, custody.street); actor.rotation = Math.PI / 2;
    custody.street!.from![id] = { position: { ...actor.position }, yaw: actor.rotation };
    if (id !== 'neo') custody.bodies[id] = { position: { ...actor.position }, yaw: actor.rotation };
  }
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_office_escape', actor: 'neo', step: FILM_SCENE_BY_ID.m1_office_escape.steps.length,
    completed: ['m1_office_escape'], enteredAt: 0, reflections: {}, lastText: '', checkpoint: { ...neo.position },
    office: { alert: 100, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: 'captured', bugged: false, custody } };
  // Route 46 travels left along z=884. Its bumper and the stopped passenger recreate the original deadlock.
  const carDistance = 1850 - (rear.x + 3.615);
  sandbox.state.traffic = { elapsed: 0, cars: Array.from({ length: 47 }, (_, i) => ({ distance: i === 46 ? carDistance : 20, speed: 0, ...(i === 46 ? {} : { waiting: true }) })) };
  sandbox.traffic.restore(); players.possess('player', 'neo', 0);
  const smith = world.agents.get('smith')!, health = ['neo', 'smith', 'agent_brown', 'agent_jones'].map(id => world.agents.get(id)!.health);
  const frame = (sequence: number) => {
    const before = { ...smith.position }, walking = custody.street!.phase === 'rear_approach';
    players.receiveInput('player', { x: 0, z: 0, yaw: neo.rotation, sprint: false, jump: false, sequence }); players.step(.05, true, 0);
    if (walking && custody.street!.phase === 'rear_approach') {
      assert.ok(Math.hypot(smith.position.x - before.x, smith.position.z - before.z) <= .106, 'yielding uses ordinary walking rather than a teleport');
      assert.equal(playerBlocked(smith.position, true, .7, sandbox.state.structures), false, 'the passenger must clear both visible vehicle bodies');
    }
  };
  for (let i = 0; i < 20; i++) frame(i + 1);
  assert.ok(Math.hypot(smith.position.x - start.x, smith.position.z - start.z) > .3, 'the passenger should retreat to the pavement instead of pinning traffic');
  for (let i = 20; i < 700 && custody.street!.phase !== 'done'; i++) frame(i + 1);
  assert.equal(custody.street!.phase, 'done', 'traffic should pass and the same passenger should enter the rear seat');
  assert.ok(sandbox.state.traffic.cars[46].distance > carDistance + 8, 'yielding must let the real car pass');
  assert.deepEqual([neo.health, smith.health, world.agents.get('agent_brown')!.health, world.agents.get('agent_jones')!.health], health);
});
