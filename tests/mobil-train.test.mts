import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, MOBIL_FAMILY, mobilPassengerPose, mobilLuggagePose, mobilTrainPose, type WorldEvent } from '@auto_matrix/shared';
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
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('train-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1; let tick = 0;
  const command = (target: string) => { world.simulationTick = ++tick; return players.sandboxAction('train-player', { kind: 'life', target: `film:${target}` }, tick); };
  command('continue'); const journey = sandbox.life.film.state!;
  Object.assign(journey, { scene: 'm3_trainman', actor: 'neo', step: 0,
    mobil: { phase: 'waiting', elapsed: 0, lastTick: tick, loops: 0 } });
  actor.position = filmPosition('film_mobil_station', -6, -8); actor.currentLocation = 'film_mobil_station';
  sandbox.life.film.reconcileCast();
  const frame = (seconds: number, running = true) => { for (let i = 0; i < Math.ceil(seconds * 20); i++) players.step(.05, running, tick); };
  const advance = () => { world.simulationTick = ++tick; sandbox.tick(tick); };
  return { world, sandbox, players, actor, journey, command, frame, advance, tick: () => tick };
}

test('the late train arrives before Neo offers to carry luggage, and its saved approach advances between slow ticks', () => {
  const h = setup(); h.command('act');
  assert.equal(h.journey.started, undefined, 'Neo cannot collect luggage before the train is seen');
  h.frame(.2); assert.equal(h.journey.mobil!.phase, 'approaching');
  assert.ok(h.journey.mobil!.elapsed > 0, 'arrival needs a continuous clock, not a half-second jump');
  h.frame(5); assert.equal(h.journey.mobil!.phase, 'stopped');
  assert.equal(h.journey.step, 0, 'time and train arrival must not complete the player interaction');
  assert.equal(h.journey.mobil!.boarding ?? 0, 0, 'the family waits for the actual luggage interaction');
});

test('arrival and family movement freeze during pause, release and unavailable cast', () => {
  const h = setup(); h.frame(1); const before = structuredClone(h.journey.mobil);
  h.frame(2, false); assert.deepEqual(h.journey.mobil, before);
  h.players.release('train-player', h.tick()); h.frame(2); assert.deepEqual(h.journey.mobil, before);
  h.players.possess('train-player', 'neo', h.tick());
  const member = h.world.agents.get('sati')!; member.controller = 'another-player';
  const position = structuredClone(member.position); h.frame(2);
  assert.equal(h.journey.mobil!.elapsed, before!.elapsed); assert.deepEqual(member.position, position);
  member.controller = null; member.status = 'dead'; member.health = 0; h.frame(2);
  assert.equal(member.status, 'dead'); assert.equal(h.journey.mobil!.elapsed, before!.elapsed);
});

test('Neo must lift the real suitcase after arrival and carry it himself, retaining the grip across pause and reconnect', () => {
  const h = setup(); h.frame(6);
  h.actor.position = filmPosition('film_mobil_station', -10.8, -10); h.command('act');
  assert.equal(h.journey.started, undefined, 'a timed subtitle cannot replace lifting the suitcase');
  assert.equal(h.journey.mobil!.luggage?.phase, 'lifting');
  h.frame(.8); const saved = structuredClone(h.journey.mobil);
  h.frame(1, false); assert.deepEqual(h.journey.mobil, saved);
  h.players.release('train-player', h.tick()); h.frame(1); assert.deepEqual(h.journey.mobil, saved);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('train-player', 'neo', h.tick()); h.frame(1.2);
  const current = h.sandbox.life.film.state!;
  assert.equal(current.mobil!.luggage?.phase, 'carried'); assert.equal(current.step, 1);
  const before = { ...h.actor.position };
  h.players.receiveInput('train-player', { x: 1, z: 0, yaw: Math.PI / 2, sequence: 1, location: 'film_mobil_station' });
  h.frame(.4); assert.ok(h.actor.position.x > before.x + .2, 'carrying still requires the normal movement controls');
  assert.equal(current.step, 1, 'carrying and time alone must not complete walking to the door');
});

test('Rama waits beside the entrance and leaves Neo and his held suitcase room to approach Trainman', () => {
  const h = setup(); h.frame(6);
  h.actor.position = filmPosition('film_mobil_station', -10.8, -10); h.command('act'); h.frame(2);
  h.frame(6); const parent = h.world.agents.get('rama_kandra')!;
  for (const x of [5.4, 6.4]) {
    const entry = filmPosition('film_mobil_station', x, -20);
    assert.ok(Math.hypot(parent.position.x - entry.x, parent.position.z - entry.z) >= 2,
      'the waiting parent must not occupy Neo\'s approach or the held suitcase at the open door');
  }
});

test('Trainman knocks the held bag onto the platform, Rama retrieves it, and the doors wait for his actual return', () => {
  const h = setup(); h.frame(6);
  h.command('act'); assert.equal(h.journey.mobil!.luggage?.phase, 'ready', 'a distant player cannot lift a physical box');
  h.actor.position = filmPosition('film_mobil_station', -10.8, -10); h.command('act'); h.frame(2);
  h.actor.position = filmPosition('film_mobil_station', 6, -20); h.actor.rotation = Math.PI / 2;
  h.advance(); assert.equal(h.journey.step, 2); h.command('act'); h.frame(.6);
  assert.equal(h.journey.mobil!.luggage?.phase, 'dropped');
  const airborne = mobilLuggagePose(h.journey.mobil!.luggage); h.frame(.4);
  const fallen = mobilLuggagePose(h.journey.mobil!.luggage);
  assert.ok(fallen.y < airborne.y && fallen.y >= 0, 'saved gravity lowers the released suitcase onto the floor');
  h.frame(1); assert.equal(h.journey.mobil!.luggage?.phase, 'retrieving');
  assert.equal(mobilTrainPose(h.journey.mobil).doors, 1, 'doors cannot close through the retrieving parent');
  const paused = structuredClone(h.journey.mobil), parent = structuredClone(h.world.agents.get('rama_kandra')!.position);
  h.frame(1, false); assert.deepEqual(h.journey.mobil, paused); assert.deepEqual(h.world.agents.get('rama_kandra')!.position, parent);
  h.frame(16); assert.equal(h.journey.mobil!.luggage?.phase, 'returned');
  assert.equal(h.journey.mobil!.phase, 'gone'); assert.equal(h.journey.step, 3);
  assert.equal(h.actor.health, 90, 'waiting for the luggage cannot apply the strike twice');
});

test('Kamala rises from the bench before walking and can cold-load any saved fraction of standing', () => {
  const first = mobilPassengerPose(1, .14), middle = mobilPassengerPose(1, .21), upright = mobilPassengerPose(1, .32);
  assert.equal(first.seated, 1);
  assert.ok(middle.seated > 0 && middle.seated < 1, 'boarding must contain the missing sit-to-stand motion');
  assert.equal(first.x, MOBIL_FAMILY[1].x);
  assert.ok(middle.x > first.x && middle.x < first.x + .75, 'her hips move over her planted feet before she walks');
  assert.equal(middle.moving, false, 'her feet remain planted until she has stood up');
  assert.equal(upright.seated, 0); assert.equal(upright.moving, true);
  for (let i = 1; i <= 1000; i++) {
    const a = mobilPassengerPose(1, (i - 1) / 1000), b = mobilPassengerPose(1, i / 1000);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .09, 'the saved root cannot jump from the seat to the path');
  }
});
