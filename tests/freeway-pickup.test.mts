import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FREEWAY_PICKUP, freewayPickupBike, freewayPickupRoot, newFreewayPickup, newFreewayRide, stepFreeway, stepFreewayPickup, filmPosition, type PlayerInput, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
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
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('pickup-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  let tick = 0;
  const command = (target: string) => players.sandboxAction('pickup-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('start');
  const state = sandbox.life.film.state!;
  Object.assign(state, { scene: 'm2_garage', actor: 'trinity', step: FILM_SCENE_BY_ID.m2_garage.steps.length });
  players.possess('pickup-player', 'trinity', tick);
  command('next');
  const frame = (input: Partial<PlayerInput> = {}, count = 1) => { for (let i = 0; i < count; i++) {
    players.receiveInput('pickup-player', { x: 0, z: 0, yaw: 0, sprint: false, jump: false, sequence: tick, ...input });
    players.step(.05, true, ++tick); world.simulationTick = tick; sandbox.tick(tick);
  } };
  return { world, sandbox, players, command, frame, state: () => sandbox.life.film.state!, actor: () => players.getAgent('pickup-player')!, tick: () => tick };
}

function reachDeck(h: ReturnType<typeof setup>) {
  h.command('act'); h.frame({ z: 1 }, 20); h.frame({}, 37); h.frame({ jump: true }); h.frame({}, 39);
  assert.equal(h.state().freewayPickup!.phase, 'deck');
}

test('the garage leads to the overpass and carrier pickup rather than a motorcycle spawned on the road', () => {
  const h = setup(), state = h.state();
  assert.equal(state.scene, 'm2_freeway');
  assert.equal(state.freewayPickup?.phase, 'ready');
  assert.equal(state.ride, undefined);
  assert.ok(h.actor().position.y > filmPosition('film_freeway_101', 14, 400).y + 16);
  h.command('act');
  assert.equal(h.state().freewayPickup?.phase, 'bridge');
  assert.equal(h.state().ride, undefined, 'G cannot skip the transfer');
  h.actor().position = filmPosition('film_freeway_101', 14, 660);
  h.sandbox.tick(h.tick() + 1);
  assert.equal(h.state().step, 0, 'the old reach marker cannot bypass the carrier');
});

test('reconnecting to a paused inverse escort restores both riding contacts without advancing its save', () => {
  const h = setup(), state = h.state();
  state.step = 1; state.freewayPickup!.phase = 'done';
  state.ride = { ...newFreewayRide(), elapsed: 24, speed: 25, lateral: 8, hull: 73, passenger: 81, startedAt: 19, bank: .25, braking: .4 };
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: false }, 0, h.tick());
  const saved = JSON.stringify(state.ride); h.players.release('pickup-player', h.tick());
  assert.equal(h.world.agents.get('trinity')!.currentAction?.parameters.player, false, 'released riding contact must not be discarded as a transient player action on restart');
  assert.equal(h.players.possess('pickup-player', 'trinity', h.tick()).agentId, 'trinity');
  assert.ok(h.actor().currentAction?.parameters.freewayRide, 'paused re-entry must rebuild the driver contact before time runs');
  assert.ok(h.world.agents.get('keymaker')!.currentAction?.parameters.freewayRide, 'the passenger needs the same saved ride');
  assert.equal(JSON.stringify(state.ride), saved, 'reconnecting cannot accelerate, level the bike or clear accumulated damage');
});

test('arrival retains the motorcycle seats and damage while beginning the moving truck approach', () => {
  const h = setup(), state = h.state();
  state.step = 1; state.freewayPickup!.phase = 'done';
  state.ride = { ...newFreewayRide(), x: 17.6, z: -660, elapsed: 64, speed: 26, hull: 49.2, passenger: 74.6 };
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: false }, 0, h.tick());
  state.ride.phase = 'arrived'; h.frame();
  assert.equal(state.step, 2);
  assert.equal(state.freewayHandoff?.phase, 'approach');
  assert.equal(state.freewayHandoff?.bike.speed, 26, 'arrival must not brake or dismount the riders');
  assert.equal(state.ride.hull, 49.2); assert.equal(state.ride.passenger, 74.6);
  assert.ok(h.actor().currentAction?.parameters.freewayRide);
  assert.ok(h.world.agents.get('keymaker')!.currentAction?.parameters.freewayRide);
  const saved = JSON.stringify(state.freewayHandoff), positions = [{ ...h.actor().position }, { ...h.world.agents.get('keymaker')!.position }];
  h.players.release('pickup-player', h.tick()); h.players.possess('pickup-player', 'trinity', h.tick());
  assert.equal(JSON.stringify(state.freewayHandoff), saved);
  assert.deepEqual(h.actor().position, positions[0]); assert.deepEqual(h.world.agents.get('keymaker')!.position, positions[1]);
});

test('retrying a failed inverse escort places the player at an actionable motorcycle checkpoint', () => {
  const h = setup(), state = h.state();
  state.step = 1; state.freewayPickup!.phase = 'done';
  state.checkpoint = filmPosition('film_freeway_101', 17.6, 901);
  state.ride = { ...newFreewayRide(), phase: 'wrecked', hull: 0, passenger: 49.2 };
  const completed = [...state.completed];
  h.command('retry');
  assert.equal(state.ride, undefined);
  assert.match(h.command('act'), /已上车/, 'retry must not require walking hundreds of metres back to the static start marker');
  assert.equal(state.ride?.phase, 'riding');
  assert.deepEqual(state.completed, completed);
  assert.equal(state.freewayPickup.phase, 'done', 'the completed carrier transfer is not replayed');
  h.frame({ drive: { throttle: 1, steer: 0, brake: false } });
  assert.ok(state.ride!.speed > 0);
});

test('the old arrival checkpoint starts a moving transfer instead of a timed G handoff', () => {
  const h = setup(), state = h.state();
  state.step = 2; state.freewayPickup!.phase = 'done';
  state.ride = { ...newFreewayRide(), x: 20, z: -660, phase: 'arrived', hull: 49.2, passenger: 74.6 };
  h.actor().position = filmPosition('film_freeway_101', 14, -660);
  h.command('act');
  assert.equal(state.started, undefined, 'a timer cannot stand in for the actual passenger transfer');
  assert.equal(state.step, 2);
  assert.ok(state.freewayHandoff, 'the old checkpoint must remain playable through the new handoff');
  assert.equal(state.freewayHandoff.phase, 'approach');
  assert.equal(state.freewayHandoff.bike.hull, 49.2);
});

test('ordinary movement, timed leap, key handoff, shot and steering complete the transfer without advancing early', () => {
  const h = setup(); reachDeck(h);
  assert.equal(h.state().step, 0); assert.equal(h.state().ride, undefined);
  assert.match(h.command('act'), /先沿/);
  h.frame({ z: 1 }, 97); h.command('act'); assert.equal(h.state().freewayPickup!.phase, 'key');
  h.frame({}, 28); assert.equal(h.state().freewayPickup!.phase, 'key', 'waiting does not accept the offered key');
  h.command('act'); assert.equal(h.state().freewayPickup!.key, false);
  h.frame({}, 34); assert.equal(h.state().freewayPickup!.key, true);
  h.frame({}, 49); assert.equal(h.state().freewayPickup!.phase, 'mounted');
  h.frame({ drive: { throttle: 1, steer: 0, brake: false } }, 3); assert.equal(h.state().freewayPickup!.phase, 'mounted', 'the unbroken chain holds the bike');
  h.players.act('pickup-player', 'attack', h.tick()); assert.equal(h.state().freewayPickup!.chain, true);
  h.frame({}, 24); assert.equal(h.state().freewayPickup!.chain, false);
  h.frame({ drive: { throttle: 1, steer: 0, brake: false } });
  assert.equal(h.state().freewayPickup!.phase, 'launching');
  h.frame({}, Math.ceil(FREEWAY_PICKUP.launchSeconds / .05)); assert.equal(h.state().freewayPickup!.phase, 'merging');
  assert.equal(h.state().step, 0, 'landing cannot substitute for controlling the motorcycle');
  let turning = false;
  for (let frame = 0; frame < 300 && h.state().freewayPickup!.phase === 'merging'; frame++) {
    const pickup = h.state().freewayPickup!;
    if (pickup.chase?.phase === 'crossing') {
      turning ||= pickup.speed <= 20;
      h.frame({ drive: { throttle: turning ? 1 : 0, steer: turning ? -1 : 0, brake: !turning } });
    } else {
      const desired = Math.atan2(2.5 - pickup.x, 20);
      h.frame({ drive: { throttle: pickup.speed < 35 ? 1 : 0, steer: Math.max(-1, Math.min(1, (pickup.heading - desired) * 3)), brake: false } });
    }
  }
  assert.equal(h.state().freewayPickup!.phase, 'done');
  assert.equal(h.state().step, 1); assert.equal(h.state().ride!.phase, 'riding');
  assert.ok(h.state().ride!.z < FREEWAY_PICKUP.roadEnd); assert.equal(h.world.agents.get('keymaker')!.status, 'alive');
  assert.equal(h.state().freewayPickup!.chase!.phase, 'crossing'); assert.ok(h.state().freewayPickup!.chase!.impactAt);
  assert.equal(h.state().ride!.obstacles!.length, 2, 'the stopped truck and shield car remain physical after the handoff');
});

test('a missed leap keeps its real failure pose, then an explicit retry restores the carrier and bridge', () => {
  const h = setup(); h.command('act'); h.frame({ z: 1 }, 20); h.frame({ jump: true }); h.frame({}, 39);
  const failed = h.state().freewayPickup!;
  assert.equal(failed.phase, 'failed'); assert.ok(failed.failedRoots);
  assert.deepEqual(freewayPickupRoot(failed, 'trinity'), failed.failedRoots.trinity);
  h.frame({}, 20); assert.deepEqual(h.state().freewayPickup, failed);
  h.command('act'); assert.equal(h.state().freewayPickup!.phase, 'ready');
  assert.equal(h.state().freewayPickup!.attempts, 1); assert.equal(h.state().freewayPickup!.total, 0);
  assert.equal(h.state().ride, undefined); assert.equal(h.state().step, 0);
});

test('a guardrail failure keeps the motorcycle beneath its passengers rather than returning it to the carrier', () => {
  const state = { ...newFreewayPickup(), phase: 'merging' as const, x: 26.2, z: 550, heading: Math.PI / 2, speed: 20 };
  const failed = stepFreewayPickup(state, { drive: { throttle: 1, steer: 0, brake: false } }, .1);
  assert.equal(failed.phase, 'failed');
  const bike = freewayPickupBike(failed);
  assert.deepEqual(bike, { x: failed.x, y: 0, z: failed.z, yaw: failed.heading, pitch: 0 });
  for (const role of ['trinity', 'keymaker'] as const) {
    const root = freewayPickupRoot(failed, role), seat = FREEWAY_PICKUP.bike.rider - (role === 'keymaker' ? 1.25 : 0);
    assert.ok(Math.abs(root.x - bike.x - Math.sin(bike.yaw) * seat) < .001);
    assert.ok(Math.abs(root.y - bike.y - .9) < .001);
    assert.ok(Math.abs(root.z - bike.z - Math.cos(bike.yaw) * seat) < .001);
  }
  assert.deepEqual(freewayPickupBike(JSON.parse(JSON.stringify(failed))), bike, 'cold loading cannot separate the saved passengers and vehicle');
});

test('the moving carrier and both characters preserve the clock, positions and actions across pause and reconnect', () => {
  const h = setup(); reachDeck(h); h.frame({ z: 1 }, 12);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), position = { ...h.actor().position };
  h.players.step(.1, false, h.tick()); assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup);
  h.players.release('pickup-player', h.tick()); h.sandbox.restore(saved); h.sandbox.tick(h.tick());
  assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup);
  assert.equal(h.players.possess('pickup-player', 'trinity', h.tick()).error, undefined);
  assert.deepEqual(h.actor().position, position);
  assert.equal(h.actor().currentAction!.parameters.freewayPickup && h.actor().currentAction!.startedAt, saved.neoLife.journey.freewayPickup.startedAt);
  h.frame({}, 1); assert.ok(h.state().freewayPickup!.total > saved.neoLife.journey.freewayPickup.total);
});

test('another player or an unavailable keymaker cannot be taken over or revived to make the pickup pass', () => {
  const h = setup(); h.players.possess('other-player', 'keymaker', h.tick());
  const other = h.world.agents.get('keymaker')!, position = { ...other.position };
  assert.match(h.command('act'), /另一位玩家/); h.frame({ z: 1, jump: true }, 20);
  assert.equal(h.state().freewayPickup!.total, 0); assert.deepEqual(other.position, position);
  h.players.release('other-player', h.tick()); other.status = 'dead'; other.health = 0;
  assert.match(h.command('retry'), /无法同行/); h.frame({}, 10);
  assert.equal(other.status, 'dead'); assert.equal(other.health, 0); assert.equal(h.state().freewayPickup!.total, 0);
});

test('the call finishes before a timed physical key handoff, and reconnect resumes the unaccepted key', () => {
  const h = setup(); reachDeck(h); h.frame({ z: 1 }, 97); h.command('act');
  h.command('act');
  assert.equal(h.state().freewayPickup!.phase, 'key', 'G cannot skip the call while the handset is being raised');
  assert.equal(h.state().freewayPickup!.key, false);
  h.frame({}, 28); h.command('act'); h.frame({}, 7);
  assert.equal(h.state().freewayPickup!.phase, 'keyhandoff');
  assert.equal(h.state().freewayPickup!.key, false, 'the key remains in the Keymaker hand until contact');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), position = { ...h.actor().position };
  h.players.step(.1, false, h.tick()); h.command('act');
  assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup, 'pause/repeated G cannot restart or accept the key');
  h.players.release('pickup-player', h.tick()); h.sandbox.restore(saved); h.sandbox.tick(h.tick());
  h.players.possess('pickup-player', 'trinity', h.tick());
  assert.deepEqual(h.actor().position, position);
  assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup);
  h.frame({}, 10); assert.equal(h.state().freewayPickup!.key, true);
  assert.equal(h.state().freewayPickup!.phase, 'keyhandoff', 'contact is followed by withdrawing the key before mounting');
  h.frame({}, 18); assert.equal(h.state().freewayPickup!.phase, 'mounting');
  assert.equal(h.state().step, 0); assert.equal(h.state().ride, undefined);
});

test('the gun is drawn and fired before the chain breaks; pause and reconnect cannot fire twice', () => {
  const h = setup(); reachDeck(h); h.frame({ z: 1 }, 97); h.command('act'); h.frame({}, 28); h.command('act'); h.frame({}, 85);
  assert.equal(h.state().freewayPickup!.phase, 'mounted');
  h.players.act('pickup-player', 'attack', h.tick());
  assert.equal(h.state().freewayPickup!.phase, 'shooting'); assert.equal(h.state().freewayPickup!.chain, true);
  h.frame({ drive: { throttle: 1, steer: 0, brake: false } }, 7);
  assert.equal(h.state().freewayPickup!.chain, true, 'throttle cannot start the launch before the visible shot');
  assert.equal(h.state().freewayPickup!.shotAt, undefined);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state));
  h.players.release('pickup-player', h.tick()); h.sandbox.restore(saved); h.sandbox.tick(h.tick()); h.players.possess('pickup-player', 'trinity', h.tick());
  assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup);
  h.players.act('pickup-player', 'attack', h.tick()); h.frame({}, 4);
  const shot = h.state().freewayPickup!.shotAt;
  assert.equal(h.state().freewayPickup!.chain, false); assert.equal(typeof shot, 'number');
  h.players.act('pickup-player', 'attack', h.tick()); h.frame({}, 18);
  assert.equal(h.state().freewayPickup!.phase, 'mounted'); assert.equal(h.state().freewayPickup!.shotAt, shot);
  h.frame({ drive: { throttle: 1, steer: 0, brake: false } }); assert.equal(h.state().freewayPickup!.phase, 'launching');
});

test('a new landing starts the same-direction Agent pursuit instead of allowing an unexplained immediate reversal', () => {
  const airborne = { ...newFreewayPickup(), phase: 'launching' as const, elapsed: FREEWAY_PICKUP.launchSeconds - .01, total: 17, key: true, chain: false };
  const landed = stepFreewayPickup(airborne, {}, .05);
  assert.equal(landed.phase, 'merging'); assert.ok(landed.chase, 'the truck and shield car must already exist on landing');
  assert.equal(landed.chase.phase, 'approach'); assert.equal(landed.heading, 0);
  const before = landed.z, following = stepFreewayPickup(landed, { drive: { throttle: 1, steer: 0, brake: false } }, .05);
  assert.ok(following.z > before, 'landing first follows the existing traffic');
  const early = stepFreewayPickup({ ...landed, heading: Math.PI - .02, speed: 8 }, { drive: { throttle: 1, steer: 0, brake: false } }, .05);
  assert.notEqual(early.phase, 'done', 'turning before the pursuit and shielding cannot skip their causality');
});

test('the pursuit has physical truck collisions and restores the complete moving vehicles on pause and reconnect', () => {
  const airborne = { ...newFreewayPickup(), phase: 'launching' as const, elapsed: FREEWAY_PICKUP.launchSeconds - .01, total: 17, key: true, chain: false };
  const landed = stepFreewayPickup(airborne, {}, .05); assert.ok(landed.chase);
  const h = setup(); h.state().freewayPickup = landed; h.frame({}, 3);
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), positions = ['trinity', 'keymaker', 'agent_jackson'].map(id => ({ ...h.world.agents.get(id)!.position }));
  h.players.step(.1, false, h.tick()); h.players.release('pickup-player', h.tick()); h.sandbox.restore(saved); h.sandbox.tick(h.tick());
  h.players.possess('pickup-player', 'trinity', h.tick()); assert.deepEqual(h.state().freewayPickup, saved.neoLife.journey.freewayPickup);
  ['trinity', 'keymaker', 'agent_jackson'].forEach((id, i) => assert.deepEqual(h.world.agents.get(id)!.position, positions[i]));
  const blocked = { ...landed, x: landed.chase.truck.x, z: landed.chase.truck.z - 11.3, speed: 44 };
  const failed = stepFreewayPickup(blocked, { drive: { throttle: 1, steer: 0, brake: false } }, .1);
  assert.equal(failed.phase, 'failed', 'a real truck in the motorcycle path must stop the attempt');
  assert.ok(failed.failedBike && failed.failedRoots); assert.deepEqual(freewayPickupBike(failed), freewayPickupBike(JSON.parse(JSON.stringify(failed))));
});

test('legacy landing and inverse-road saves retain their original route without replaying the new pursuit', () => {
  const airborne = { ...newFreewayPickup(), phase: 'launching' as const, elapsed: FREEWAY_PICKUP.launchSeconds - .01, total: 17, key: true, chain: false };
  delete airborne.route;
  const landed = stepFreewayPickup(airborne, {}, .05); assert.equal(landed.chase, undefined);
  const done = stepFreewayPickup({ ...landed, heading: Math.PI, speed: 8 }, { drive: { throttle: 1, steer: 0, brake: false } }, .05);
  assert.equal(done.phase, 'done');
});

test('Jackson ownership or death freezes the new pursuit before landing without moving or reviving him', () => {
  const h = setup(), jackson = h.world.agents.get('agent_jackson')!;
  h.state().freewayPickup = { ...newFreewayPickup(), phase: 'launching', elapsed: FREEWAY_PICKUP.launchSeconds - .01, total: 17, key: true, chain: false };
  h.players.possess('other-player', jackson.id, h.tick()); const position = { ...jackson.position };
  h.frame({}, 5); assert.equal(h.state().freewayPickup!.total, 17); assert.deepEqual(jackson.position, position);
  assert.match(h.state().lastText, /另一位玩家/);
  h.players.release('other-player', h.tick()); jackson.status = 'dead'; jackson.health = 0;
  h.command('retry'); h.frame({}, 5);
  assert.equal(h.state().freewayPickup!.total, 17); assert.equal(jackson.status, 'dead'); assert.equal(jackson.health, 0);
});

test('early reversing cannot drive indefinitely past the physical road before shielding the pursuit', () => {
  const airborne = { ...newFreewayPickup(), phase: 'launching' as const, elapsed: FREEWAY_PICKUP.launchSeconds - .01, total: 17, key: true, chain: false };
  const state = stepFreewayPickup(airborne, {}, .05); state.x = 2.5; state.z = -1160; state.heading = Math.PI; state.speed = 44;
  const failed = stepFreewayPickup(state, { drive: { throttle: 1, steer: 0, brake: false } }, .1);
  assert.equal(failed.phase, 'failed'); assert.ok(failed.failedBike); assert.equal(failed.z, state.z);
});

test('the shield car remains a damaging physical obstacle during the inverse escort', () => {
  const ride = { ...newFreewayRide(), x: 6, z: 800, speed: 44, elapsed: 20,
    obstacles: [{ id: 101, x: 6, z: 791, speed: 0, color: 0x949b8c, truck: false }] };
  const hit = stepFreeway(ride, { throttle: 1, steer: 0, brake: false }, .1);
  assert.equal(hit.hits, 1); assert.ok(hit.hull < 100 && hit.passenger < 100);
});

test('a lateral truck impact freezes the last clear vehicle frame instead of pushing its cab through the failed riders', () => {
  const state = { ...newFreewayPickup(), phase: 'merging' as const, x: 6.19, z: 800, speed: 0, total: 20,
    chase: { phase: 'ramming' as const, elapsed: .5, truck: { x: 10, z: 800, speed: 28, yaw: 0 }, shield: { x: 6, z: 850, speed: 12 } } };
  const failed = stepFreewayPickup(state, { drive: { throttle: 0, steer: 0, brake: true } }, .1);
  assert.equal(failed.phase, 'failed'); assert.deepEqual(failed.chase, state.chase);
  assert.equal(failed.total, state.total, 'all rendered traffic must freeze on the same last clear frame');
  assert.ok(Math.abs(failed.failedBike!.x - failed.chase!.truck.x) > 3.8);
});
