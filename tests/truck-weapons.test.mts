import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, TRUCK_ROAD, TRUCK_WEAPONS, newTruckRoad, truckWeaponDropPose, truckWeaponGrip, type CombatImpact, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

// Isolated ready-roof fixture; native QA starts from the previous actual retry save.
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('truck-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(world.agents.get('neo')!, 'start', 1);
  const journey = sandbox.life.film.state!, center = FILM_SETS.film_freeway_101.center;
  const road = newTruckRoad({ x: 13.7, z: -461.97904 }, { x: .3, y: 6.6, z: -3.5, yaw: Math.PI }, { x: 1.3, y: 6.6, z: -10.2, yaw: 0 }, 100);
  road.elapsed = TRUCK_ROAD.approach + TRUCK_ROAD.drop + TRUCK_ROAD.landing; road.phase = 'ready';
  Object.assign(journey, { scene: 'm2_trucks', actor: 'morpheus', step: 0, fighting: undefined,
    trucks: { phase: 'duel', elapsed: 0, lastTick: 1, attempt: 0, road } });
  const actor = world.agents.get('morpheus')!;
  actor.currentLocation = 'film_freeway_101'; actor.isInMatrix = true;
  actor.position = { x: center.x + 14, y: center.y + 6.6, z: center.z + road.truck.z - 3.5 }; actor.rotation = Math.PI;
  world.agents.get('keymaker')!.health = 40;
  sandbox.life.film.truckRoad.frame(actor, 0, 1); players.possess('truck-player', 'morpheus', 1); sandbox.life.film.reconcileCast();
  assert.equal(actor.position.y, center.y + 6.6, 'the fixture starts on the actual matrix truck roof');
  const command = (target: string) => players.sandboxAction('truck-player', { kind: 'life', target: `film:${target}` }, 2);
  const frame = (input: Partial<PlayerInput> = {}, running = true) => {
    players.receiveInput('truck-player', { x: 0, z: 0, yaw: Math.PI, pitch: 0, sprint: false, jump: false, sequence: 1, ...input });
    players.step(.05, running, 3); sandbox.life.film.tick(3);
  };
  return { world, sandbox, players, journey, actor, command, frame };
}

test('G starts the armed encounter rather than spawning a generic melee target or skipping it with a skill', () => {
  const h = setup(); h.command('act');
  assert.equal(h.journey.trucks!.weapons?.phase, 'gun');
  assert.equal(h.journey.fighting, true);
  assert.equal(h.sandbox.state.threats.filter(t => t.scene === 'm2_trucks').length, 0);
  h.players.act('truck-player', 'ability', 3); h.players.act('truck-player', 'ability2', 3); h.command('act');
  for (let i = 0; i < 10; i++) h.frame();
  assert.equal(h.journey.step, 0, 'no-threat auto advance cannot complete the armed encounter');
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
});

test('Johnson stays on the same moving roof during the free aim phase', () => {
  const h = setup(); h.command('act');
  const johnson = h.world.agents.get('agent_johnson')!, road = h.journey.trucks!.road!, center = FILM_SETS.film_freeway_101.center;
  const offset = { x: johnson.position.x - center.x - road.truck.x, z: johnson.position.z - center.z - road.truck.z };
  h.frame();
  assert.ok(Math.abs(johnson.position.x - center.x - road.truck.x - offset.x) < 1e-8);
  assert.ok(Math.abs(johnson.position.z - center.z - road.truck.z - offset.z) < 1e-8);
});

function until(h: ReturnType<typeof setup>, phase: string, seconds = 6) {
  for (let i = 0; i < seconds * 20 && h.journey.trucks!.weapons?.phase !== phase && h.actor.status === 'alive'; i++) h.frame();
  assert.equal(h.journey.trucks!.weapons?.phase, phase, JSON.stringify({ status: h.actor.status, position: h.actor.position,
    owner: h.actor.controller, weapons: h.journey.trucks!.weapons, road: h.journey.trucks!.road, text: h.journey.lastText }));
}
function blade(h: ReturnType<typeof setup>) {
  h.command('act'); h.players.act('truck-player', 'shoot', 3);
  for (let i = 0; i < 6; i++) h.frame();
  h.players.act('truck-player', 'shoot', 3); until(h, 'gun_disarm');
  for (let i = 0; i < 6; i++) h.frame();
  h.players.act('truck-player', 'dodge', 3); until(h, 'blade');
}

test('Johnson steps away from the blade on the moving roof rather than only turning his chest', () => {
  const h = setup(); blade(h);
  const road = h.journey.trucks!.road!, johnson = h.world.agents.get('agent_johnson')!, start = johnson.position.x - road.truck.x;
  h.players.act('truck-player', 'attack', 3);
  for (let i = 0; i < 4; i++) h.frame();
  assert.ok(Math.abs(johnson.position.x - road.truck.x - start) > .5);
  assert.ok(Math.abs(johnson.position.y - FILM_SETS.film_freeway_101.center.y - 6.6) < 1e-8);
  assert.equal(h.world.agents.get('keymaker')!.health, 40);
  until(h, 'counter'); for (let i = 0; i < 6; i++) h.frame();
  assert.ok(Math.abs(Math.hypot(johnson.position.x - h.actor.position.x, johnson.position.z - h.actor.position.z) - TRUCK_WEAPONS.pairDistance) < 1e-8);
});

test('aimed shots, the timed wrist guard and two blade parries produce real releases before the unarmed target', () => {
  const h = setup(); blade(h);
  const w = h.journey.trucks!.weapons!;
  assert.equal(w.shots, 2); assert.equal(w.aimed, 2); assert.equal(w.rounds, TRUCK_WEAPONS.rounds - 2);
  assert.ok(w.gun); assert.equal(h.actor.health, 100, 'the wrist guard prevents impact damage');
  assert.equal(h.world.agents.get('agent_johnson')!.health, 150, 'the agent dodges the bullets');
  for (let round = 0; round < 2; round++) {
    h.players.act('truck-player', 'attack', 3); until(h, 'counter');
    h.players.act('truck-player', 'dodge', 3); assert.equal(w.parries, round, 'early X cannot pre-arm a parry');
    for (let i = 0; i < 6; i++) h.frame();
    h.players.act('truck-player', 'dodge', 3); h.players.act('truck-player', 'dodge', 3);
    assert.equal(w.parries, round + 1, 'one contact counts once');
    until(h, round ? 'sword_disarm' : 'blade');
  }
  for (let i = 0; i < 13; i++) h.frame();
  assert.ok(w.sword); assert.equal(h.journey.step, 0);
  until(h, 'unarmed');
  const threats = h.sandbox.state.threats.filter(t => t.scene === 'm2_trucks');
  assert.equal(threats.length, 1); assert.equal(threats[0].character, 'agent_johnson');
  assert.deepEqual(threats[0].position, h.world.agents.get('agent_johnson')!.position);
  assert.equal(h.actor.health, 100); assert.equal(h.world.agents.get('keymaker')!.health, 40);
  const a = truckWeaponDropPose(w.gun!, w.total + 5, 'gun'), b = truckWeaponDropPose(w.sword!, w.total + 5, 'sword');
  assert.ok(a.landed && b.landed); assert.ok(a.y >= 6.6 && b.y >= 6.6);
  assert.deepEqual(truckWeaponDropPose(w.sword!, w.total + 10, 'sword'), b, 'the landed blade does not drift with browser time');
});

test('shots use the player aim, respect the fire interval, and cannot spend ammunition during a disarm', () => {
  const h = setup(); h.command('act'); h.frame({ yaw: 0 });
  h.players.act('truck-player', 'shoot', 3); h.players.act('truck-player', 'shoot', 3);
  const w = h.journey.trucks!.weapons!;
  assert.equal(w.shots, 1); assert.equal(w.aimed, 0); assert.equal(w.rounds, 7);
  until(h, 'gun_disarm'); const rounds = w.rounds;
  h.players.act('truck-player', 'shoot', 3); assert.equal(w.rounds, rounds);
});

test('truck gun pitch follows the same look-down convention as the player camera', () => {
  for (const pitch of [.45, -.45]) {
    const h = setup(); h.command('act');
    let shot: CombatImpact | undefined;
    h.sandbox.life.film.onImpact = impact => { shot = impact; };
    h.players.receiveInput('truck-player', { x: 0, z: 0, yaw: Math.PI, pitch, sprint: false, jump: false, sequence: 1 });
    h.players.act('truck-player', 'shoot', 3);
    assert.ok(shot?.shot);
    assert.ok(Math.abs(shot.direction.y + Math.sin(pitch)) < 1e-8, 'looking down must produce a downward bullet, and looking up an upward bullet');
    const w = h.journey.trucks!.weapons!, road = h.journey.trucks!.road!, center = FILM_SETS.film_freeway_101.center;
    const body = { x: h.actor.position.x - center.x - road.truck.x, y: h.actor.position.y - center.y,
      z: h.actor.position.z - center.z - road.truck.z, yaw: h.actor.rotation };
    assert.equal(truckWeaponGrip(w, body, 'gun').pitch, pitch, 'the visible pistol must point along the same pitch as its bullet');
  }
  const h = setup(); h.command('act');
  const johnson = h.world.agents.get('agent_johnson')!, dx = johnson.position.x - h.actor.position.x, dz = johnson.position.z - h.actor.position.z;
  const pitch = Math.atan2(h.actor.position.y + 2.1 - johnson.position.y - 1.7, Math.hypot(dx, dz));
  h.players.receiveInput('truck-player', { x: 0, z: 0, yaw: Math.atan2(dx, dz), pitch, sprint: false, jump: false, sequence: 1 });
  h.players.act('truck-player', 'shoot', 3);
  assert.equal(h.journey.trucks!.weapons!.aimed, 1, 'a camera aim at the real opponent must count as an aimed shot');
});

test('the paired disarm freezes on pause, release, cold restore and occupied or dead passengers', () => {
  const h = setup(); h.command('act'); until(h, 'gun_disarm');
  for (let i = 0; i < 6; i++) h.frame();
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), clocks = JSON.stringify(h.journey.trucks!.weapons);
  const bodies = ['morpheus', 'agent_johnson', 'keymaker'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.frame({}, false); assert.equal(JSON.stringify(h.journey.trucks!.weapons), clocks);
  h.players.release('truck-player', 3); h.players.step(.1, true, 3);
  assert.equal(JSON.stringify(h.journey.trucks!.weapons), clocks);
  h.sandbox.restore(saved); h.sandbox.life.film.reconcileCast(); h.players.possess('truck-player', 'morpheus', 3);
  assert.equal(JSON.stringify(h.sandbox.life.film.state!.trucks!.weapons), clocks);
  assert.deepEqual(['morpheus', 'agent_johnson', 'keymaker'].map(id => h.world.agents.get(id)!.position), bodies);
  const key = h.world.agents.get('keymaker')!; key.controller = 'player'; h.frame();
  assert.equal(JSON.stringify(h.sandbox.life.film.state!.trucks!.weapons), clocks);
  assert.equal(key.health, 40); assert.match(h.command('retry'), /其他玩家/);
  delete key.controller; key.status = 'dead'; key.health = 0; h.frame(); h.command('retry');
  assert.equal(key.status, 'dead'); assert.equal(key.health, 0);
  assert.equal(JSON.stringify(h.sandbox.life.film.state!.trucks!.weapons), clocks);
});

test('missed counters can kill Morpheus and retry clears only this encounter without healing the passenger', () => {
  const h = setup(); blade(h); h.actor.health = 20;
  const completed = [...h.journey.completed];
  for (let i = 0; i < 250 && h.actor.status === 'alive'; i++) h.frame();
  assert.equal(h.actor.status, 'dead'); assert.equal(h.journey.trucks!.phase, 'failed');
  h.command('retry'); assert.equal(h.actor.health, 100); assert.equal(h.journey.trucks!.weapons, undefined);
  assert.equal(h.actor.currentAction?.parameters.truckWeapons, undefined);
  assert.deepEqual(h.journey.completed, completed); assert.equal(h.world.agents.get('keymaker')!.health, 40);
});
