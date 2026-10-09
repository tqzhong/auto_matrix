import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, groundHeight, truckRoadRoot, truckRescuePose, filmSceneForJourney, filmPosition, FREEWAY_HANDOFF, freewayHandoffReady, freewayHandoffRoot, freewayHandoffText, newFreewayHandoff, newFreewayRide, stepFreewayHandoff, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { musicForScene } from '../packages/client/src/engine/Soundtrack.js';
const gas = { throttle: 1, steer: 0, brake: false };
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('handoff-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(world.agents.get('neo')!, 'start', 1);
  const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm2_freeway', actor: 'trinity', step: 2, ride: { ...newFreewayRide(), x: FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, z: -660, speed: 30, phase: 'arrived' }, freewayPickup: undefined });
  players.possess('handoff-player', 'trinity', 1);
  const actor = world.agents.get('trinity')!; actor.currentLocation = 'film_freeway_101'; actor.position = filmPosition('film_freeway_101', FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, -660);
  const command = (target: string) => players.sandboxAction('handoff-player', { kind: 'life', target: `film:${target}` }, 2);
  command('act');
  const frame = (input = gas, dt = .05) => { players.receiveInput('handoff-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, sequence: 1, drive: input }); players.step(dt, true, 3); };
  return { world, sandbox, journey, players, actor, command, frame };
}

test('the truck approaches in the opposite direction, and passing it cannot automatically hand over the passenger', () => {
  const start = newFreewayHandoff({ ...newFreewayRide(), x: FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, z: -660, speed: 30 });
  const first = stepFreewayHandoff(start, gas, .1);
  assert.ok(first.bike.z < start.bike.z && first.truck.z > start.truck.z);
  let state = start;
  for (let i = 0; i < 600 && state.phase === 'approach'; i++) state = stepFreewayHandoff(state, gas, .05);
  assert.equal(state.phase, 'failed'); assert.match(state.failure!, /错过/);
  assert.equal(state.passengerStart, undefined);
  assert.deepEqual(stepFreewayHandoff(state, gas, .1), state, 'failure freezes the actual vehicle positions');
});

test('G requires stable lateral alignment and a nearby passenger; early G cannot start a transfer', () => {
  const h = setup(); h.command('act');
  assert.equal(h.journey.freewayHandoff!.phase, 'approach'); assert.equal(h.journey.started, undefined);
  const state = h.journey.freewayHandoff!;
  state.truck.z = state.bike.z + 5.4;
  assert.equal(freewayHandoffReady(state), true);
  assert.equal(freewayHandoffReady({ ...state, bike: { ...state.bike, x: 24 } }), false);
  assert.equal(freewayHandoffReady({ ...state, bike: { ...state.bike, bank: .2 } }), false);
  h.command('act'); assert.equal(h.journey.freewayHandoff!.phase, 'reaching');
  assert.equal(h.journey.step, 2, 'acceptance starts the physical reach, rather than completing the chapter');
});

test('the passenger rises outside the trailer before crossing the roof edge, while Trinity continues away', () => {
  const state = newFreewayHandoff({ ...newFreewayRide(), x: FREEWAY_HANDOFF.lane + FREEWAY_HANDOFF.side, z: -660, speed: 30 });
  state.truck.z = state.bike.z + 5.4; state.phase = 'reaching';
  let next = state;
  for (let i = 0; i < 90; i++) {
    const before = freewayHandoffRoot(next, 'keymaker'); next = stepFreewayHandoff(next, gas, .05);
    const root = freewayHandoffRoot(next, 'keymaker');
    assert.ok(Math.hypot(root.x - before.x, root.y - before.y, root.z - before.z) < 2, 'the lift is continuous');
    if (next.phase === 'lifting' && root.x < next.truck.x + 3.3) assert.ok(root.y >= 6.55, 'boots must be above the roof before crossing its side');
  }
  assert.equal(next.phase, 'departing');
  assert.ok(freewayHandoffRoot(next, 'keymaker').y >= 6.6);
  assert.ok(freewayHandoffRoot(next, 'trinity').z < state.bike.z);
  assert.ok(next.truck.z > state.truck.z);
});

test('pause, release and a cold JSON restore preserve the transfer clock, damage and three bodies', () => {
  const h = setup(); const state = h.journey.freewayHandoff!;
  state.truck.z = state.bike.z + 5.4; h.command('act');
  for (let i = 0; i < 28; i++) h.frame();
  assert.equal(h.journey.freewayHandoff!.phase, 'lifting');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), bodies = ['trinity', 'keymaker', 'morpheus'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.players.step(.1, false, 3); assert.equal(JSON.stringify(h.journey.freewayHandoff), JSON.stringify(saved.neoLife.journey.freewayHandoff));
  h.players.release('handoff-player', 3);
  assert.equal(h.actor.currentAction?.parameters.player, false);
  h.sandbox.restore(saved); h.sandbox.life.film.reconcileCast();
  h.players.possess('handoff-player', 'trinity', 3);
  assert.equal(JSON.stringify(h.sandbox.life.film.state!.freewayHandoff), JSON.stringify(saved.neoLife.journey.freewayHandoff));
  assert.deepEqual(['trinity', 'keymaker', 'morpheus'].map(id => h.world.agents.get(id)!.position), bodies);
});

test('occupied or dead companions freeze the approach without moving, healing or stealing them', () => {
  const h = setup(), other = h.world.agents.get('morpheus')!;
  other.controller = 'player'; const position = { ...other.position }, total = h.journey.freewayHandoff!.total;
  h.frame(); assert.deepEqual(other.position, position); assert.equal(h.journey.freewayHandoff!.total, total);
  assert.match(h.command('retry'), /另一位玩家/);
  delete other.controller; other.status = 'dead'; other.health = 0;
  h.frame(); h.command('retry'); assert.equal(other.health, 0); assert.equal(other.status, 'dead');
  assert.equal(h.journey.freewayHandoff!.total, total);
});

test('a missed transfer retries only this encounter and success waits for explicit confirmation before the next scene', () => {
  const h = setup();
  for (let i = 0; i < 600 && h.journey.freewayHandoff!.phase === 'approach'; i++) h.frame();
  assert.equal(h.journey.freewayHandoff!.phase, 'failed');
  const completed = [...h.journey.completed]; h.command('retry');
  assert.equal(h.journey.freewayHandoff!.attempt, 2); assert.deepEqual(h.journey.completed, completed);
  for (let i = 0; i < 600 && h.journey.freewayHandoff!.phase !== 'done'; i++) {
    if (freewayHandoffReady(h.journey.freewayHandoff!)) h.command('act');
    h.frame();
  }
  assert.equal(h.journey.freewayHandoff!.phase, 'done'); assert.equal(h.journey.step, 2);
  h.command('act'); assert.equal(h.journey.step, FILM_SCENE_BY_ID.m2_freeway.steps.length);
  assert.ok(h.world.agents.get('keymaker')!.position.y > filmPosition('film_freeway_101', 0, 0).y + 6);
  assert.equal(h.journey.actor, 'trinity');
  h.command('next'); assert.equal(h.journey.scene, 'm2_trucks'); assert.equal(h.journey.actor, 'morpheus');
});

test('handoff prompts distinguish the passenger settling on the roof from completion and entering the next scene', () => {
  const state = newFreewayHandoff(newFreewayRide());
  assert.match(freewayHandoffText({ ...state, phase: 'departing' }), /正在车顶站稳/);
  assert.doesNotMatch(freewayHandoffText({ ...state, phase: 'departing' }), /按 G/);
  assert.match(freewayHandoffText({ ...state, phase: 'done' }), /按 G 确认接应完成/);
  assert.match(freewayHandoffText({ ...state, phase: 'done' }), /从手记进入 Morpheus/);
});

test('entering the truck duel keeps the same truck, passenger, Morpheus position and injuries', () => {
  const h = setup(); h.journey.freewayHandoff!.truck.z = h.journey.freewayHandoff!.bike.z + 5.4;
  h.command('act');
  for (let i = 0; i < 200 && h.journey.freewayHandoff!.phase !== 'done'; i++) h.frame();
  assert.equal(h.journey.freewayHandoff!.phase, 'done');
  const morpheus = h.world.agents.get('morpheus')!, keymaker = h.world.agents.get('keymaker')!;
  morpheus.health = 73; keymaker.health = 41;
  const roots = [morpheus, keymaker].map(agent => ({ ...agent.position }));
  h.command('act'); h.command('next');
  h.sandbox.life.film.tick(3);
  assert.equal(morpheus.currentLocation, 'film_freeway_101');
  assert.deepEqual([morpheus, keymaker].map(agent => agent.position), roots);
  assert.deepEqual([morpheus.health, keymaker.health], [73, 41]);
  assert.equal(h.journey.scene, 'm2_trucks');
});

function truckSetup() {
  const h = setup(); h.journey.freewayHandoff!.truck.z = h.journey.freewayHandoff!.bike.z + 5.4;
  h.command('act');
  for (let i = 0; i < 200 && h.journey.freewayHandoff!.phase !== 'done'; i++) h.frame();
  h.command('act'); h.command('next');
  const actor = h.world.agents.get('morpheus')!;
  const frame = (input: Partial<PlayerInput> = {}, running = true) => {
    h.players.receiveInput('handoff-player', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, sequence: 1, ...input });
    h.players.step(.05, running, 4);
  };
  return { ...h, actor, frame };
}

test('the continuous truck road keeps the freeway score instead of falling back to matrix exploration', () => {
  const h = truckSetup();
  assert.equal(musicForScene({ player: h.actor, sandbox: h.sandbox.state, time: h.world.timeOfDay, matrix: true, running: true }), 'chase');
});

test('Johnson falls from the overpass onto the moving roof before G can start the duel', () => {
  const h = truckSetup(), johnson = h.world.agents.get('agent_johnson')!, key = h.world.agents.get('keymaker')!;
  const roof = FILM_SETS.film_freeway_101.center.y + 6.6;
  assert.equal(johnson.position.y, roof + 10);
  h.command('act'); assert.equal(h.journey.fighting, undefined);
  const first = { ...h.actor.position };
  for (let i = 0; i < 76; i++) h.frame();
  assert.equal(h.journey.trucks!.road!.phase, 'dropping');
  assert.ok(johnson.position.y < roof + 10 && johnson.position.y > roof);
  const onBridge = johnson.position.z;
  h.frame(); assert.equal(johnson.position.z, onBridge, 'the agent falls beyond the stationary overpass edge');
  assert.ok(h.actor.position.z > first.z + 70);
  for (let i = 0; i < 26; i++) h.frame();
  assert.equal(h.journey.trucks!.road!.phase, 'ready');
  assert.ok(Math.abs(johnson.position.y - roof) < 1e-8); assert.equal(key.position.y, roof);
  assert.ok(johnson.position.z < h.actor.position.z);
  assert.ok(Math.hypot(key.position.x - johnson.position.x, key.position.z - johnson.position.z) > 2.5);
  assert.equal(groundHeight(h.actor.position, true, h.sandbox.state.structures), roof);
  const johnsonPosition = { ...johnson.position };
  h.command('act'); assert.equal(h.journey.fighting, true);
  assert.equal(h.journey.trucks!.weapons!.phase, 'gun');
  assert.deepEqual(johnson.position, johnsonPosition);
  assert.equal(h.sandbox.state.threats.some(item => item.character === 'agent_johnson'), false, 'armed choreography precedes the unarmed target');
  const before = h.actor.position.z - h.journey.trucks!.road!.truck.z;
  for (let i = 0; i < 20; i++) h.frame({ z: -1 });
  assert.ok(h.actor.position.z - h.journey.trucks!.road!.truck.z < before - 2, 'the player can walk relative to the moving trailer');
  assert.equal(h.actor.position.y, roof);
});

test('pause, release, occupied cast and cold restore freeze the truck, drop and injuries together', () => {
  const h = truckSetup(); for (let i = 0; i < 76; i++) h.frame();
  const key = h.world.agents.get('keymaker')!; key.health = 27; h.actor.health = 63;
  const road = JSON.stringify(h.journey.trucks!.road), roots = ['morpheus', 'keymaker', 'agent_johnson'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.frame({}, false); assert.equal(JSON.stringify(h.journey.trucks!.road), road);
  h.players.release('handoff-player', 4); h.players.step(.1, true, 4);
  assert.equal(JSON.stringify(h.journey.trucks!.road), road);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved); h.sandbox.life.film.reconcileCast();
  assert.deepEqual(['morpheus', 'keymaker', 'agent_johnson'].map(id => h.world.agents.get(id)!.position), roots);
  assert.equal(h.actor.currentAction?.parameters.player, false);
  h.players.possess('handoff-player', 'morpheus', 4);
  key.controller = 'player'; const keyPosition = { ...key.position }, elapsed = h.sandbox.life.film.state!.trucks!.road!.elapsed;
  h.frame(); assert.deepEqual(key.position, keyPosition); assert.equal(h.sandbox.life.film.state!.trucks!.road!.elapsed, elapsed);
  assert.match(h.command('retry'), /其他玩家/); assert.equal(key.health, 27); assert.equal(h.actor.health, 63);
  delete key.controller; key.status = 'dead'; key.health = 0;
  h.frame(); h.command('retry'); assert.equal(key.health, 0); assert.equal(key.status, 'dead');
});

test('falling off the moving truck retries only this encounter and translated rescue keeps actual saved roots', () => {
  const h = truckSetup(); for (let i = 0; i < 104; i++) h.frame();
  const key = h.world.agents.get('keymaker')!; key.health = 29;
  h.actor.position.x += 10; h.actor.position.y = FILM_SETS.film_freeway_101.center.y;
  h.frame(); assert.equal(h.journey.trucks!.phase, 'failed');
  const completed = [...h.journey.completed], truck = { ...h.journey.trucks!.road!.truck };
  h.command('retry'); assert.equal(h.journey.trucks!.phase, 'duel');
  assert.deepEqual(h.journey.completed, completed); assert.deepEqual(h.journey.trucks!.road!.truck, truck);
  assert.equal(key.health, 29); assert.equal(h.actor.status, 'alive'); assert.equal(h.journey.trucks!.attempt, 1);
  assert.equal(filmSceneForJourney(h.journey)!.set, 'film_freeway_101');
  const center = FILM_SETS.film_freeway_101.center, encounter = h.journey.trucks!;
  encounter.phase = 'rescue'; encounter.rescueElapsed = 1.9; encounter.startElapsed = 1.9;
  encounter.starts = Object.fromEntries(['morpheus', 'keymaker', 'neo'].map(id => {
    const member = h.world.agents.get(id)!; return [id, { x: member.position.x - center.x, y: member.position.y - center.y, z: member.position.z - center.z, yaw: member.rotation }];
  })) as NonNullable<typeof encounter.starts>;
  for (const role of ['morpheus', 'keymaker', 'neo'] as const) {
    const pose = truckRescuePose(JSON.parse(JSON.stringify(encounter)), role), start = encounter.starts[role];
    assert.ok(Math.hypot(pose.x - start.x, pose.y - start.y, pose.z - start.z) < 1e-8);
    assert.ok(Math.abs(pose.yaw - start.yaw) < 1e-8);
  }
  const legacy = { ...encounter, road: undefined, starts: undefined, startElapsed: undefined };
  assert.ok(truckRescuePose(legacy, 'morpheus').z < 60, 'legacy rescue saves retain their original set coordinates');
});

test('Johnson leaves the overpass edge before descending through its solid deck', () => {
  const h = truckSetup(), road = h.journey.trucks!.road!;
  for (let i = 1; i <= 10; i++) {
    const root = truckRoadRoot({ ...road, elapsed: 3 + i * .04, phase: 'dropping' }, 'agent_johnson');
    assert.ok(root.y >= 16.6 || Math.abs(root.z - road.bridgeZ) > 7.6, 'both soles must clear the deck before passing below its top');
  }
});
