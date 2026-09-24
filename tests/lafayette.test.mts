import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, HOTEL_ROUTE, HOTEL_ROUTE_LENGTH, HOTEL_DOOR_PROGRESS, LAFAYETTE, filmPosition, filmStepPosition, filmSetAt, hotelRoutePose, hotelRouteProgress, lafayetteWelcomeRoot, playerBlocked, stepPlayer, groundHeight, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (e: Omit<WorldEvent, 'id'>) => world.addWorldEvent(e) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine, {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_bug;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 2, completed: [], enteredAt: 0, reflections: {}, lastText: '', checkpoint: filmStepPosition(scene, scene.steps[2]),
    meeting: { phase: 'outside', elapsed: 8, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } } };
  neo.position = filmStepPosition(scene, scene.steps[2]); neo.currentLocation = scene.set;
  let tick = 0; let sequence = 0;
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (x = 0, z = 0, running = true, sprint = false) => {
    players.receiveInput('player', { x, z, yaw: x || z ? Math.atan2(x, z) : neo.rotation, jump: false, sprint, sequence: ++sequence });
    players.step(.05, running, tick); if (running && sequence % 10 === 0) sandbox.tick(++tick);
  };
  const frames = (seconds: number, running = true) => { for (let i = 0; i < seconds * 20; i++) frame(0, 0, running); };
  const state = () => sandbox.life.film.state!;
  const walk = (point: { x: number; y: number; z: number }, sprint = false) => {
    const target = { x: FILM_SETS.film_lafayette.center.x + point.x, y: 1 + point.y, z: FILM_SETS.film_lafayette.center.z + point.z };
    for (let i = 0; i < 1200; i++) {
      const dx = target.x - neo.position.x; const dz = target.z - neo.position.z; const distance = Math.hypot(dx, dz);
      if (distance < .3 && Math.abs(neo.position.y - target.y) < .6) return;
      frame(dx / Math.max(1, distance), dz / Math.max(1, distance), true, sprint);
    }
    assert.fail(`cannot reach ${JSON.stringify(point)} from ${JSON.stringify(neo.position)}`);
  };
  return { world, sandbox, players, neo, command, frame, frames, state, walk, tick: () => tick };
}

test('the hotel has a physical route from the alley to floor 13 without position jumps', () => {
  const room = FILM_SETS.film_lafayette; const base = room.center.y - LAFAYETTE.upper;
  let position = { x: room.center.x, y: base, z: room.center.z + 31 }; let velocity = { x: 0, z: 0 }; let vy = 0;
  let steps = 0; let largestRise = 0;
  for (const point of [...HOTEL_ROUTE.slice(4), { x: 18, y: 84, z: 0 }]) {
    const target = { x: room.center.x + point.x, y: base + point.y, z: room.center.z + point.z };
    for (let frame = 0; frame < 800; frame++) {
      const dx = target.x - position.x; const dz = target.z - position.z; const length = Math.hypot(dx, dz);
      if (length < .3 && Math.abs(position.y - target.y) < .6) break;
      const next = stepPlayer(position, vy, { x: dx / Math.max(length, 1), z: dz / Math.max(length, 1), yaw: Math.atan2(dx, dz), sequence: ++steps, sprint: false, jump: false }, .05, true, [], velocity);
      largestRise = Math.max(largestRise, Math.abs(next.position.y - position.y));
      position = next.position; velocity = next.horizontalVelocity; vy = next.verticalVelocity;
      assert.ok(frame < 799, `stuck approaching ${JSON.stringify(point)} at ${JSON.stringify(position)}`);
    }
  }
  assert.equal(filmSetAt(position, true)?.id, 'film_lafayette');
  assert.ok(Math.abs(position.y - room.center.y) < .1); assert.ok(largestRise < .81);
  assert.ok(steps > 500, 'the trip consists of walking, not a scene teleport');
});

test('Trinity route stays on the same steps and landings as the player', () => {
  const room = FILM_SETS.film_lafayette;
  for (let progress = 60; progress <= HOTEL_ROUTE_LENGTH; progress += .3) {
    const point = hotelRoutePose(progress); const position = { x: room.center.x + point.x, y: 1 + point.y, z: room.center.z + point.z };
    assert.equal(playerBlocked(position, true), false, `guide path blocked at ${progress}: ${JSON.stringify(point)}`);
    assert.ok(Math.abs(groundHeight(position, true) - position.y) < .6);
  }
  assert.equal(groundHeight(filmPosition('film_lafayette'), true), room.center.y);
});

test('Trinity walks around the 1313 furniture before using the adjacent door', () => {
  const furniture = [
    { name: 'desk chair', x: 8, z: 5, halfWidth: 1.35, halfDepth: 1.65 },
    { name: 'console table', x: 13, z: 10, halfWidth: 4.5, halfDepth: 2.15 },
  ];
  for (let elapsed = 0; elapsed <= 5.4; elapsed += .05) {
    const point = lafayetteWelcomeRoot({ phase: 'departing', elapsed }, 'trinity');
    for (const obstacle of furniture) {
      const clear = Math.abs(point.x - obstacle.x) > obstacle.halfWidth || Math.abs(point.z - obstacle.z) > obstacle.halfDepth;
      assert.ok(clear, `Trinity crosses the ${obstacle.name} at ${elapsed.toFixed(2)}s: ${JSON.stringify(point)}`);
    }
  }
});

test('the rear door preserves Neo position, Trinity waits, and room choices cannot bypass the climb', () => {
  const h = setup(); const position = { ...h.neo.position }; const rotation = h.neo.rotation;
  h.command('act'); assert.equal(h.state().scene, 'm1_pills');
  assert.deepEqual(h.neo.position, position); assert.equal(h.neo.rotation, rotation);
  assert.equal(h.state().hotel?.progress, 0); assert.equal(h.state().pills, undefined);
  const guide = h.world.agents.get('trinity')!;
  h.frames(35); const stopped = { ...guide.position }; const progress = h.state().hotel!.progress;
  h.frames(10); assert.deepEqual(guide.position, stopped); assert.equal(h.state().hotel!.progress, progress);
  for (const target of ['act', 'next', 'pill:red', 'pill:blue']) h.command(target);
  assert.equal(h.state().step, 0); assert.equal(h.state().pills, undefined); assert.equal(h.state().hotel?.entered, undefined);
  assert.match(h.players.possess('other', 'trinity', h.tick()).error!, /带路/);
  assert.equal(playerBlocked(filmPosition('film_lafayette', 21, 0), true, 1.1, h.sandbox.state.structures), true);
});

test('all thirteen floors and the locked 1313 door are playable through controller input', () => {
  const h = setup(); h.command('act');
  for (const point of HOTEL_ROUTE.slice(4, -3)) h.walk(point);
  h.frames(12); assert.ok(h.state().hotel!.progress >= HOTEL_DOOR_PROGRESS - .01);
  const door = filmPosition('film_lafayette', 21, 0);
  for (let i = 0; i < 40; i++) h.frame(-1, 0);
  assert.ok(h.neo.position.x > door.x, 'the closed door blocks walking into the room');
  h.command('act'); h.frames(1);
  assert.ok((h.state().hotel!.knock ?? 0) > .9 && h.state().hotel!.door === undefined);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), true);
  h.frames(3.4); assert.equal(h.state().hotel!.door, LAFAYETTE.doorSeconds);
  assert.equal(playerBlocked(door, true, 1.1, h.sandbox.state.structures), false);
  h.walk({ x: 18, y: 84, z: 0 }); h.frames(.2);
  assert.equal(h.state().hotel?.entered, true); assert.equal(h.state().step, 0);
  h.frames(10); assert.equal(h.state().hotel!.welcome?.phase, 'ready');
  const guide = h.world.agents.get('trinity')!;
  const trinityPose = lafayetteWelcomeRoot(h.state().hotel!.welcome!, 'trinity');
  assert.deepEqual(guide.position, filmPosition('film_lafayette', trinityPose.x, trinityPose.z));
  h.command('act'); h.frames(9); assert.equal(h.state().hotel!.welcome?.phase, 'done');
  h.walk({ x: 0, y: 84, z: 0 }); h.walk({ x: 0, y: 84, z: -3.3 });
  h.command('act'); h.frames(6); assert.equal(h.state().pills?.phase, 'choice');
});

test('sprinting to 1313 does not leave Trinity half a minute behind at the door', () => {
  const h = setup(); h.command('act');
  for (const point of HOTEL_ROUTE.slice(4, -3)) h.walk(point, true);
  assert.ok(h.state().hotel!.progress >= HOTEL_DOOR_PROGRESS - 30,
    `Trinity is ${Math.round(HOTEL_DOOR_PROGRESS - h.state().hotel!.progress)} m behind Neo`);
});

test('arriving at 1313 before Trinity explains why the door is not ready', () => {
  const h = setup(); h.command('act');
  h.neo.position = filmPosition('film_lafayette', 24, 0); h.frames(.1);
  assert.match(h.state().lastText, /Trinity.*赶来/);
  assert.ok(h.state().hotel!.progress < HOTEL_DOOR_PROGRESS);
});

test('Neo knocks before 1313 opens, and the saved knock cannot be skipped by movement or pause', () => {
  const h = setup(); h.command('act');
  h.neo.position = filmPosition('film_lafayette', 22.5, 0);
  h.state().hotel!.progress = HOTEL_DOOR_PROGRESS; h.frames(.1);
  h.command('act');
  assert.equal(h.state().hotel!.knock, 0); assert.equal(h.state().hotel!.door, undefined);
  h.frame(1, 0); h.frames(.7);
  assert.ok((h.state().hotel!.knock ?? 0) > .7); assert.equal(h.state().hotel!.door, undefined);
  assert.ok(Math.abs(h.neo.position.x - filmPosition('film_lafayette', 22.5, 0).x) < .01, 'the authored knock holds Neo at the door');
  const paused = structuredClone(h.state().hotel); h.frames(1, false); assert.deepEqual(h.state().hotel, paused);
  h.frames(1.2); assert.equal(h.state().hotel!.knock, undefined); assert.ok((h.state().hotel!.door ?? -1) >= 0);
});

test('the guide and swinging door pause, reload and retry at the saved floor', () => {
  const h = setup(); h.command('act');
  const point = { x: 26, y: 84, z: 0 }; h.neo.position = filmPosition('film_lafayette', point.x, point.z);
  h.state().hotel!.progress = HOTEL_DOOR_PROGRESS; h.frames(.1); h.command('act'); h.frames(1);
  const saved = structuredClone(h.sandbox.state); const position = { ...h.neo.position };
  const guide = { ...h.world.agents.get('trinity')!.position }; const hotel = structuredClone(h.state().hotel);
  h.frames(3, false); assert.deepEqual(h.state().hotel, hotel); assert.deepEqual(h.world.agents.get('trinity')!.position, guide);
  h.players.release('player', h.tick()); h.frames(3); assert.deepEqual(h.state().hotel, hotel);
  h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.neo.position, position); assert.deepEqual(h.state().hotel, hotel); assert.deepEqual(h.world.agents.get('trinity')!.position, guide);
  h.neo.status = 'dead'; h.neo.health = 0; h.command('retry');
  assert.deepEqual(h.neo.position, position); assert.equal(h.neo.status, 'alive'); assert.deepEqual(h.state().hotel, hotel);
  h.frames(4); assert.equal(h.state().hotel?.door, LAFAYETTE.doorSeconds);
  assert.equal(h.sandbox.state.structures.filter(s => s.id === 'film:lafayette:door').length, 0);
});

test('crossing 1313 starts a saved greeting, waits for the handshake, then releases Neo to the chairs', () => {
  const h = setup(); h.command('act');
  h.neo.position = { ...filmPosition('film_lafayette', 24, 0), y: 85 };
  h.state().hotel!.progress = HOTEL_DOOR_PROGRESS; h.frames(.1); h.command('act'); h.frames(3);
  h.walk({ x: 18, y: 84, z: 0 }); h.frames(.2);
  const welcome = () => (h.state().hotel as any).welcome;
  assert.equal(welcome()?.phase, 'approach'); assert.equal(h.state().pills, undefined);
  const start = { ...h.neo.position }; h.players.receiveInput('player', { x: 1, z: 1, yaw: 0, jump: true, sprint: true, sequence: 50000 });
  h.frames(1); assert.notDeepEqual(h.neo.position, start, 'the greeting moves Neo along its authored path, not free player input');
  h.frames(6); assert.equal(welcome()?.phase, 'ready');
  const waiting = structuredClone(welcome()); h.frames(12); assert.deepEqual(welcome(), waiting, 'Morpheus must wait for an explicit handshake');
  for (const target of ['pill:red', 'blue', 'next']) h.command(target);
  assert.equal(h.state().pills, undefined); assert.equal(welcome()?.phase, 'ready');
  assert.match(h.players.possess('morpheus-player', 'morpheus', h.tick()).error!, /迎接|交谈/);
  assert.match(h.players.possess('trinity-player', 'trinity', h.tick()).error!, /迎接|带路/);
  h.command('act'); h.frames(1.25);
  assert.equal(welcome()?.phase, 'handshake');
  const saved = structuredClone(h.sandbox.state); const neo = { ...h.neo.position };
  const morpheus = { ...h.world.agents.get('morpheus')!.position }; const trinity = { ...h.world.agents.get('trinity')!.position };
  h.frames(3, false); assert.deepEqual(welcome(), (saved.neoLife!.journey!.hotel as any).welcome);
  h.players.release('player', h.tick()); h.sandbox.restore(saved); h.players.possess('player', 'neo', h.tick());
  assert.deepEqual(h.neo.position, neo); assert.deepEqual(h.world.agents.get('morpheus')!.position, morpheus); assert.deepEqual(h.world.agents.get('trinity')!.position, trinity);
  h.frames(8); assert.equal(welcome()?.phase, 'done'); assert.equal(h.state().step, 0); assert.equal(h.state().pills, undefined);
  assert.ok(h.world.agents.get('trinity')!.position.x > FILM_SETS.film_lafayette.center.x + 21, 'Trinity leaves through the adjacent doorway');
  h.neo.position = filmStepPosition(FILM_SCENE_BY_ID.m1_pills, FILM_SCENE_BY_ID.m1_pills.steps[0]);
  h.command('act'); h.frames(6); assert.equal(h.state().pills?.phase, 'choice');
});

test('legacy room saves migrate once while new lower-floor saves retain their actual height', () => {
  const h = setup(); h.command('act');
  delete h.state().hotel;
  h.neo.position = { ...filmPosition('film_lafayette', 6, -7), y: 1 };
  h.neo.currentLocation = 'film_lafayette'; h.state().checkpoint = { ...h.neo.position }; h.state().returnPosition = { ...h.neo.position };
  h.sandbox.restore(structuredClone(h.sandbox.state)); assert.equal(h.neo.position.y, 85);
  assert.equal(h.state().checkpoint.y, 85); assert.equal(h.state().returnPosition?.y, 85);
  h.sandbox.restore(structuredClone(h.sandbox.state)); assert.equal(h.neo.position.y, 85);
  const stair = { x: 35, y: 14, z: 23 };
  h.state().hotel = { progress: hotelRouteProgress(stair) };
  h.neo.position = { ...filmPosition('film_lafayette', stair.x, stair.z), y: 15 };
  h.state().checkpoint = { ...h.neo.position };
  h.sandbox.restore(structuredClone(h.sandbox.state)); assert.equal(h.neo.position.y, 15); assert.equal(h.state().checkpoint.y, 15);
});
