import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, TRUCK_ROAD, TRUCK_HOOD, newTruckRoad, newTruckWeapons, truckHoodRoot, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

// A unit fixture at the actual unarmed entry, not a manual trilogy playthrough.
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('hood-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(world.agents.get('neo')!, 'start', 1);
  const journey = sandbox.life.film.state!, center = FILM_SETS.film_freeway_101.center;
  const road = newTruckRoad({ x: 14, z: -460 }, { x: 0, y: 6.6, z: -3.5, yaw: Math.PI }, { x: 1.3, y: 6.6, z: -10.2, yaw: 0 }, 100);
  road.elapsed = TRUCK_ROAD.approach + TRUCK_ROAD.drop + TRUCK_ROAD.landing; road.phase = 'ready';
  const weapons = newTruckWeapons(); weapons.phase = 'unarmed';
  Object.assign(journey, { scene: 'm2_trucks', actor: 'morpheus', step: 0, fighting: true,
    trucks: { phase: 'duel', elapsed: 0, lastTick: 1, attempt: 2, road, weapons } });
  const actor = world.agents.get('morpheus')!;
  actor.currentLocation = 'film_freeway_101'; actor.isInMatrix = true;
  actor.position = { x: center.x + 14, y: center.y + 6.6, z: center.z - 463.5 }; actor.rotation = Math.PI;
  world.agents.get('keymaker')!.health = 40;
  sandbox.life.film.truckRoad.frame(actor, 0, 1); players.possess('hood-player', 'morpheus', 1);
  const frame = (input: Partial<PlayerInput> = {}, running = true) => {
    players.receiveInput('hood-player', { x: 0, z: 0, yaw: actor.rotation, pitch: 0, sprint: false, jump: false, sequence: 1, ...input });
    players.step(.05, running, 3); sandbox.life.film.tick(3);
  };
  return { world, sandbox, players, journey, actor, frame };
}

test('finishing the unarmed challenge enters Niobe reception before the truck collision', () => {
  const h = setup(); h.sandbox.life.film.tick(3);
  assert.equal(h.journey.trucks!.phase, 'duel', 'the old shortcut skips the fall, car hood and return kick');
  assert.equal(h.journey.step, 0);
  assert.equal(h.journey.trucks!.hood?.phase, 'kick');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

test('the fall hits the windshield before recovering onto the hood, and damage survives pause, restore and retry', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'falling');
  assert.equal((h.journey.trucks!.hood as unknown as { glassAge?: number }).glassAge, undefined, 'glass cannot crack before contact');
  until(h, 'impact', { focus: true });
  for (let i = 0; i < 5; i++) h.frame();
  const saved = JSON.parse(JSON.stringify(h.journey.trucks)), position = { ...h.actor.position };
  assert.ok(saved.hood.glassAge > 0, 'the actual back impact must leave windshield damage');
  assert.equal(h.journey.step, 0); assert.equal(h.actor.status, 'alive');
  for (let i = 0; i < 12; i++) h.frame({ jump: true, focus: true }, false);
  assert.equal(JSON.stringify(h.journey.trucks), JSON.stringify(saved)); assert.deepEqual(h.actor.position, position);
  h.journey.trucks = JSON.parse(JSON.stringify(saved)); h.sandbox.life.film.reconcileCast();
  assert.equal(JSON.stringify(h.journey.trucks), JSON.stringify(saved)); assert.deepEqual(h.actor.position, position);
  until(h, 'hood'); assert.ok(h.actor.position.y > position.y, 'recovering onto the bonnet must move from back support to a foot support');
  until(h, 'failed');
  const damage = (h.journey.trucks!.hood as unknown as { glassAge: number }).glassAge, attempt = h.journey.trucks!.attempt;
  h.players.sandboxAction('hood-player', { kind: 'life', target: 'film:retry' }, 4);
  assert.equal((h.journey.trucks!.hood as unknown as { glassAge: number }).glassAge, damage, 'a local retry cannot repair the same windshield');
  assert.deepEqual(h.journey.trucks!.hood!.car, saved.hood.contactCar, 'retry restores the actual car contact position');
  assert.equal(h.journey.trucks!.attempt, attempt + 1); assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

for (const role of ['niobe', 'ghost']) test(`normally claiming the driver ${role} retains the same cabin pose without allowing her to walk through the car or advance another player’s reception`, () => {
  const h=setup();h.sandbox.life.film.tick(3);until(h,'impact');h.frame();
  const niobe=h.world.agents.get(role)!,position={...niobe.position},hood=JSON.stringify(h.journey.trucks!.hood);
  assert.equal(h.players.possess('driver-player',role,3).agentId,role);
  assert.equal((niobe.currentAction?.parameters.truckHood as {phase?: string}|undefined)?.phase,'impact','normal claim must retain the real seated driver posture');
  for(let i=0;i<20;i++){
    h.players.receiveInput('driver-player',{x:1,z:1,yaw:1.2,sprint:true,jump:true,sequence:i+1});h.frame({jump:true,focus:true});
  }
  assert.deepEqual(niobe.position,position,'the driver cannot walk through her occupied seat and windshield');
  assert.equal(JSON.stringify(h.journey.trucks!.hood),hood,'owning Niobe must wait for the other controlled cast instead of advancing Morpheus');
  assert.equal(niobe.controller,'player');assert.equal(h.actor.controller,'player');
  h.players.release('driver-player',3);
  assert.equal((niobe.currentAction?.parameters.truckHood as {phase?: string}|undefined)?.phase,'impact','release must retain the frozen cabin pose too');
  assert.equal(h.world.agents.get('keymaker')!.health,40);
});

test('the living reception crew stays in the damaged cabin after Morpheus falls, without reviving him on driver claim', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'failed');
  const hood = JSON.stringify(h.journey.trucks!.hood), position = { ...h.world.agents.get('ghost')!.position };
  h.players.possess('driver-player', 'ghost', 4);
  assert.equal((h.world.agents.get('ghost')!.currentAction?.parameters.truckHood as { phase?: string } | undefined)?.phase, 'failed');
  h.frame({ jump: true });
  assert.deepEqual(h.world.agents.get('ghost')!.position, position);
  assert.equal(JSON.stringify(h.journey.trucks!.hood), hood);
  assert.equal(h.actor.status, 'dead'); assert.equal(h.actor.health, 0);
  h.players.release('driver-player', 4);
  assert.equal((h.world.agents.get('ghost')!.currentAction?.parameters.truckHood as { phase?: string } | undefined)?.phase, 'failed');
});

function until(h: ReturnType<typeof setup>, phase: string, input: Partial<PlayerInput> = {}, seconds = 8) {
  for (let i = 0; i < seconds * 20 && h.journey.trucks!.hood?.phase !== phase && h.actor.status === 'alive'; i++) h.frame(input);
  assert.equal(h.journey.trucks!.hood?.phase, phase, JSON.stringify({ trucks: h.journey.trucks, actor: h.actor.position, text: h.journey.lastText }));
}

test('gripping the hood permits the car to pass in front, then the timed flying kick returns to the same roof', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'hood');
  const hood = h.journey.trucks!.hood!, road = h.journey.trucks!.road!, center = FILM_SETS.film_freeway_101.center;
  const landing = truckHoodRoot(hood, 'morpheus');
  assert.ok(Math.abs(h.actor.position.y - center.y - landing.y) < 1e-8);
  assert.ok(landing.y < 2, 'actual hood support is below the truck roof, without the generic fall death');
  const contactCar = { ...hood.car };
  until(h, 'passing', { focus: true });
  assert.deepEqual(hood.car, contactCar, 'accelerating away must start from the same saved car contact, without a backward teleport');
  for (let i = 0; i < 60; i++) {
    h.frame();
    if (hood.car.x < 4.8) assert.ok(hood.car.z - TRUCK_HOOD.car.depth / 2 > 14.6, 'the coupe must clear the tractor before turning in front');
  }
  until(h, 'ready');
  assert.equal(hood.car.z, 20.5); assert.equal(h.journey.step, 0);
  h.frame({ jump: true });
  const runner = truckHoodRoot(hood, 'morpheus'), opponent = truckHoodRoot(hood, 'agent_johnson');
  assert.ok(Math.sin(runner.yaw) * (opponent.x - runner.x) + Math.cos(runner.yaw) * (opponent.z - runner.z) > 0,
    'Morpheus runs up the windshield facing the truck, instead of running backward');
  until(h, 'flight');
  h.players.act('hood-player', 'attack', 3); h.players.act('hood-player', 'ability', 3);
  assert.equal(hood.kicked, undefined, 'an early attack or skill cannot fake the return kick');
  for (let i = 0; i < 24; i++) h.frame();
  assert.ok(hood.elapsed >= TRUCK_HOOD.contactStart && hood.elapsed <= TRUCK_HOOD.contactEnd);
  h.players.act('hood-player', 'attack', 3); assert.ok(hood.kickQueued);
  assert.equal(hood.kicked, undefined, 'input queues the kick; the actual contact must wait until the boot reaches Johnson');
  until(h, 'done');
  assert.equal(h.journey.step, 1); assert.equal(h.journey.trucks!.phase, 'collision');
  assert.ok(Math.abs(h.actor.position.y - center.y - 6.6) < 1e-8);
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
  assert.equal(h.journey.trucks!.road, road, 'the rescue does not replace the continuous truck');
});

test('uncontrolled balance fails naturally and normal retry restores only the hood checkpoint', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'hood'); until(h, 'slipping');
  const height = h.actor.position.y;
  h.frame(); assert.ok(h.actor.position.y < height && h.actor.status === 'alive', 'losing balance must visibly fall before impact kills the player');
  until(h, 'failed');
  assert.equal(h.actor.status, 'dead'); assert.equal(h.journey.trucks!.hood!.failure, 'balance');
  const attempt = h.journey.trucks!.attempt, health = h.journey.trucks!.hood!.health, truck = { ...h.journey.trucks!.road!.truck };
  h.players.sandboxAction('hood-player', { kind: 'life', target: 'film:retry' }, 4);
  assert.equal(h.journey.trucks!.hood!.phase, 'hood'); assert.equal(h.actor.health, health);
  assert.equal(h.journey.trucks!.attempt, attempt + 1);
  assert.deepEqual(h.journey.trucks!.road!.truck, truck);
  assert.equal(h.journey.trucks!.weapons!.phase, 'unarmed');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

test('missing the flight contact window is a real failure instead of auto advancing to the collision', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'hood'); until(h, 'passing', { focus: true }); until(h, 'ready');
  h.frame({ jump: true }); until(h, 'flight'); until(h, 'miss');
  assert.equal(h.journey.step, 0); assert.equal(h.journey.trucks!.phase, 'duel');
  until(h, 'failed'); assert.equal(h.actor.status, 'dead');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

test('pause, another player owning Niobe and a dead Ghost preserve clock, wounds and car positions', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'hood');
  const saved = JSON.stringify(h.journey.trucks), position = { ...h.actor.position };
  for (let i = 0; i < 15; i++) h.frame({ focus: true, jump: true }, false);
  assert.equal(JSON.stringify(h.journey.trucks), saved); assert.deepEqual(h.actor.position, position);
  h.world.agents.get('niobe')!.controller = { socketId: 'other-player', joinedAt: 3 };
  const elapsed = h.journey.trucks!.hood!.elapsed, car = { ...h.journey.trucks!.hood!.car };
  for (let i = 0; i < 10; i++) h.frame({ focus: true });
  assert.equal(h.journey.trucks!.hood!.elapsed, elapsed); assert.deepEqual(h.journey.trucks!.hood!.car, car);
  h.players.act('hood-player', 'attack', 3); assert.equal(h.journey.trucks!.hood!.kicked, undefined);
  h.world.agents.get('niobe')!.controller = undefined;
  const ghost = h.world.agents.get('ghost')!; ghost.status = 'dead'; ghost.health = 0;
  for (let i = 0; i < 10; i++) h.frame({ focus: true });
  assert.equal(h.journey.trucks!.hood!.elapsed, elapsed); assert.equal(ghost.health, 0); assert.equal(ghost.status, 'dead');
});

test('reconciliation of a saved mid-hood pose retains the stage and contact rather than restarting the fall', () => {
  const h = setup(); h.sandbox.life.film.tick(3); until(h, 'hood');
  for (let i = 0; i < 12; i++) h.frame({ focus: true });
  const saved = JSON.parse(JSON.stringify(h.journey.trucks)); const body = { ...h.actor.position };
  h.journey.trucks = saved; h.sandbox.life.film.reconcileCast();
  assert.deepEqual(h.journey.trucks, saved); assert.deepEqual(h.actor.position, body);
  until(h, 'passing', { focus: true }); assert.equal(h.world.agents.get('keymaker')!.health, 40);
});
