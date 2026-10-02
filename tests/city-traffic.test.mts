import assert from 'node:assert/strict';
import test from 'node:test';
import { CITY_CAR, cityTrafficPose, cityTrafficSignal, cityTrafficStructures, cityVehicleBlocked, stepPlayer, playerBlocked, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup(populate = false) {
  const world = new WorldState(), manager = new AgentManager(world);
  if (populate) manager.initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  return { world, manager, sandbox, players };
}

test('two traffic-light cycles keep all 64 actual cars apart and outside the city buildings', () => {
  const h = setup(); h.sandbox.traffic.restore();
  let traveled = 0;
  const before = h.sandbox.state.traffic!.cars.map(car => car.distance);
  for (let frame = 0; frame < 480; frame++) {
    h.sandbox.traffic.frame(.1);
    const poses = h.sandbox.state.traffic!.cars.map((car, i) => cityTrafficPose(i, car));
    for (let i = 0; i < poses.length; i++) {
      const a = poses[i];
      assert.ok(h.sandbox.state.traffic!.cars[i].speed >= 0);
      for (let j = i + 1; j < poses.length; j++) {
        const b = poses[j];
        assert.ok(Math.abs(a.position.x - b.position.x) >= (a.width + b.width) / 2
          || Math.abs(a.position.z - b.position.z) >= (a.depth + b.depth) / 2, `traffic body overlap: ${frame}/${i}/${j}`);
      }
      if (frame % 20 === 0) for (const x of [-1, 0, 1]) for (const z of [-1, 0, 1])
        assert.equal(playerBlocked({ ...a.position, x: a.position.x + x * a.width / 2, z: a.position.z + z * a.depth / 2 }, true, 0), false, `traffic clips a building: ${frame}/${i}`);
    }
  }
  h.sandbox.state.traffic!.cars.forEach((car, i) => { if (car.distance !== before[i]) traveled++; });
  assert.equal(traveled, 64, 'collision handling must not disable city traffic');
  assert.equal(h.sandbox.state.structures.filter(item => item.id.startsWith('traffic:')).length, 64);
});

test('an approaching car brakes for an injured pedestrian, waits and resumes without editing the person', () => {
  const h = setup();
  h.sandbox.state.traffic = { elapsed: 0, cars: [{ distance: 450, speed: 10 }] };
  const pedestrian = { id: 'pedestrian', position: { x: 780, y: 1, z: 636 }, isInMatrix: true, status: 'alive', health: 21 } as AgentState;
  h.world.agents.set(pedestrian.id, pedestrian); const before = structuredClone(pedestrian);
  const speeds: number[] = [];
  for (let i = 0; i < 150; i++) { h.sandbox.traffic.frame(.1); speeds.push(h.sandbox.state.traffic.cars[0].speed); }
  const pose = cityTrafficPose(0, h.sandbox.state.traffic.cars[0]);
  assert.ok(pose.position.x + CITY_CAR.depth / 2 < pedestrian.position.x - 1.1);
  assert.equal(h.sandbox.state.traffic.cars[0].speed, 0); assert.deepEqual(pedestrian, before);
  assert.ok(speeds.some(speed => speed > 0 && speed < 10), 'the car should visibly decelerate before waiting');
  pedestrian.position.z += 20; h.sandbox.state.traffic.elapsed = 24;
  for (let i = 0; i < 30; i++) h.sandbox.traffic.frame(.1);
  assert.ok(cityTrafficPose(0, h.sandbox.state.traffic.cars[0]).position.x > pose.position.x + 2);
  assert.equal(pedestrian.health, 21);
});

test('players and autonomous walkers cannot pass through the same visible car collider', () => {
  const h = setup(true), actor = h.world.agents.get('choi')!;
  const structures = cityTrafficStructures({ elapsed: 0, cars: [{ distance: 460, speed: 0 }] });
  const car = structures[0];
  let position = { x: 750, y: 1, z: 636 }, velocity = { x: 0, z: 0 };
  for (let i = 0; i < 80; i++) {
    const next = stepPlayer(position, 0, { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: false, sequence: i }, .05, true, structures, velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  assert.ok(position.x <= car.position.x - car.film!.width / 2 - 1.1 + .01);
  actor.position = { x: 750, y: 1, z: 636 }; actor.targetPosition = { x: 770, y: 1, z: 636 }; actor.currentPath = []; actor.health = 21;
  for (let i = 0; i < 10; i++) h.manager.updateAllAgents(i, (from, to, matrix) => cityVehicleBlocked(from, to, matrix, structures));
  assert.ok(actor.position.x < car.position.x - car.film!.width / 2 - .9); assert.equal(actor.health, 21);
  assert.equal(cityVehicleBlocked({ x: 750, y: 6, z: 636 }, { x: 770, y: 6, z: 636 }, true, structures), false, 'airborne actors clear the low roof');
});

test('a car can leave a pedestrian safely beside its rear rather than deadlocking at its safety margin', () => {
  const h = setup();
  h.sandbox.state.traffic = { elapsed: 12, cars: [{ distance: 910.7, speed: 0 }] };
  const pedestrian = { id: 'pedestrian', position: { x: 1210, y: 1, z: 632.797 }, isInMatrix: true, status: 'alive', health: 21 } as AgentState;
  h.world.agents.set(pedestrian.id, pedestrian); const before = structuredClone(pedestrian);
  for (let i = 0; i < 20; i++) h.sandbox.traffic.frame(.1);
  assert.ok(h.sandbox.state.traffic.cars[0].distance > 913, 'a widening gap outside the actual body must release traffic');
  assert.deepEqual(pedestrian, before);
});

test('a queued car waits for a clear street entry instead of appearing inside a junction', () => {
  const h = setup();
  h.sandbox.state.traffic = { elapsed: 12, cars: [{ distance: 20, speed: 0, waiting: true }] };
  h.sandbox.traffic.frame(.1);
  assert.equal(h.sandbox.state.traffic.cars[0].waiting, true, 'a red-light junction is not a safe place to spawn a car');
  assert.equal(h.sandbox.state.structures[0].health, 0);
  for (let i = 0; i < 30; i++) h.sandbox.traffic.frame(.1);
  assert.equal(h.sandbox.state.traffic.cars[0].waiting, undefined, 'traffic should enter when its whole footprint is beyond the junction');
  assert.equal(h.sandbox.state.structures[0].health, 99999);
});

test('traffic advances once per world frame, freezes on pause and retains exact poses through save recovery', () => {
  const h = setup(true); h.players.possess('a', 'neo', 0); h.players.possess('b', 'morpheus', 0);
  h.players.step(.05, true, 0); assert.equal(h.sandbox.state.traffic!.elapsed, .05);
  const before = structuredClone(h.sandbox.state);
  for (let i = 0; i < 20; i++) h.players.step(.05, false, 0);
  assert.deepEqual(h.sandbox.state.traffic, before.traffic);
  h.sandbox.restore(before); assert.deepEqual(h.sandbox.state.traffic, before.traffic);
  assert.deepEqual(h.sandbox.state.structures.filter(item => item.id.startsWith('traffic:')), cityTrafficStructures(before.traffic));
  h.players.step(.05, true, 0); assert.equal(h.sandbox.state.traffic!.elapsed, .1);
  assert.equal(cityTrafficSignal(0, 9.5), 'amber'); assert.equal(cityTrafficSignal(1, 9.5), 'red');
});

test('starting another film cycle retains city vehicle colliders and their saved traffic clock', () => {
  const h = setup(); h.sandbox.traffic.frame(.1);
  const before = structuredClone({ traffic: h.sandbox.state.traffic, structures: h.sandbox.state.structures });
  h.sandbox.life.film.releaseCast(true);
  assert.deepEqual({ traffic: h.sandbox.state.traffic, structures: h.sandbox.state.structures }, before);
});
