import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import { newHammerFlight, newHammerGunnery, fireHammerGunnery, hammerGunneryAim, hammerGunneryTrack, hammerGunneryView, hammerShipPoint } from '@auto_matrix/shared';
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
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  let tick = 1, sequence = 0;
  players.possess('p', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, tick);
  const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels, state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step: 2 });
  const niobe = world.agents.get('niobe')!;
  niobe.position = filmStepPosition(scene, scene.steps[2]); niobe.currentLocation = scene.set; niobe.isInMatrix = false;
  state.checkpoint = { ...niobe.position }; players.possess('p', 'niobe', tick);
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true, yaw = 0, pitch = 0) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('p', { x: 0, z: 0, yaw, pitch, sequence: ++sequence, location: scene.set });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  command('act');
  return { world, sandbox, players, command, frames, actor: () => players.getAgent('p')!, get state() { return sandbox.life.film.state!; }, tick: () => tick };
}

test('Hammer switches between its actual pilot and gunner without replacing flight or story progress', () => {
  const h = setup(), flight = h.state.hammer!, history = structuredClone(h.state.completed);
  h.command('hammer-gunner'); assert.equal(h.actor().id, 'ghost', 'the gunner has no playable role');
  assert.equal(h.state.actor, 'ghost'); assert.equal(h.state.hammer, flight);
  h.frames(2); assert.ok(h.state.hammer!.z < flight.z, 'Niobe must actually fly while Ghost operates the guns');
  const saved = structuredClone(h.state.hammer);
  h.command('hammer-pilot'); assert.equal(h.actor().id, 'niobe'); assert.deepEqual(h.state.hammer, saved);
  assert.deepEqual(h.state.completed, history);
});

test('gunner handoff refuses another player or unavailable crew and freezes while paused or unowned', () => {
  const h = setup(), before = structuredClone(h.state.hammer);
  h.world.agents.get('ghost')!.controller = 'player';
  assert.match(h.command('hammer-gunner'), /另一位玩家/); assert.equal(h.actor().id, 'niobe');
  h.world.agents.get('ghost')!.controller = undefined;
  h.world.agents.get('ghost')!.status = 'dead'; h.world.agents.get('ghost')!.health = 0;
  assert.match(h.command('hammer-gunner'), /无法/); assert.deepEqual(h.state.hammer, before);
  h.world.agents.get('ghost')!.status = 'alive'; h.world.agents.get('ghost')!.health = 100;
  h.command('hammer-gunner'); h.frames(1);
  const saved = structuredClone(h.sandbox.state); h.frames(2, false);
  h.players.act('p', 'shoot', h.tick()); assert.deepEqual(h.sandbox.state, saved, 'paused firing changes the saved fight');
  h.players.release('p', h.tick()); h.frames(2); h.sandbox.restore(saved);
  h.players.possess('p', 'ghost', h.tick()); assert.deepEqual(h.state.hammer, saved.neoLife!.journey!.hammer);
});

test('unopposed sentinels can destroy Hammer and retry retains Ghost and earlier story outcomes', () => {
  const h = setup(); h.command('hammer-gunner');
  h.frames(25); assert.equal(h.state.hammer?.phase, 'wrecked', 'gunner input has no consequence for the ship');
  assert.equal(h.actor().status, 'dead'); const history = structuredClone(h.state.completed);
  h.command('retry'); assert.equal(h.actor().id, 'ghost'); assert.equal(h.actor().status, 'alive');
  assert.equal(h.state.hammer?.hull, 100); assert.equal(h.state.hammer?.gunnery?.shots, 0);
  assert.deepEqual(h.state.completed, history); assert.equal(h.state.hammerHandover?.phase, 'ready');
});

test('gun rays respect aim, ammunition, cadence, finite inputs and opaque tunnel walls', () => {
  const flight = { ...newHammerFlight(), gunnery: newHammerGunnery() }, gun = flight.gunnery;
  assert.equal(fireHammerGunnery(flight, NaN, 0), false); assert.equal(gun.shots, 0);
  assert.equal(fireHammerGunnery(flight, 1, .5), true); assert.equal(gun.targets[0].health, 4, 'a miss still hits');
  assert.equal(fireHammerGunnery(flight, 0, 0), false); assert.equal(gun.ammo, 219);
  for (let i = 0; i < 4; i++) {
    flight.elapsed += .2; const aim = hammerGunneryTrack(flight, 0);
    assert.equal(fireHammerGunnery(flight, aim.yaw, aim.pitch), true);
  }
  assert.equal(gun.kills, 1); assert.ok(gun.targets[0].downFrom); assert.equal(gun.shots, 5);
  const view = hammerGunneryView(flight, 1, 0), point = {
    x: view.eye.x + view.direction.x * 50, y: view.eye.y, z: view.eye.z + view.direction.z * 50 };
  gun.targets[0] = { ...gun.targets[0], health: 4, downAt: flight.elapsed, downFrom: point };
  assert.equal(hammerGunneryAim(flight, 1, 0).target, undefined, 'the rear cannon shoots through the pipe wall');
  const muzzle = hammerShipPoint(flight, { x: 0, y: .35, z: 14.65 });
  assert.deepEqual(hammerGunneryAim(flight).from, muzzle);
});

test('normal player shots defend the rolling ship and survive a mid-flight JSON restore', () => {
  const h = setup(); h.command('hammer-gunner'); let restored = false;
  for (let i = 0; i < 600 && h.state.hammer?.phase === 'riding'; i++) {
    const flight = h.state.hammer!, gun = flight.gunnery!;
    const target = gun.targets.findIndex(t => t.health > 0 && !t.struck && t.spawn <= flight.elapsed);
    const aim = target >= 0 ? hammerGunneryTrack(flight, target) : { yaw: 0, pitch: 0 };
    h.frames(.05, true, aim.yaw, aim.pitch); if (target >= 0) h.players.act('p', 'shoot', h.tick());
    if (!restored && flight.elapsed > 5) {
      const save = JSON.parse(JSON.stringify(h.sandbox.state)); h.players.release('p', h.tick()); h.sandbox.restore(save);
      h.players.possess('p', 'ghost', h.tick()); assert.deepEqual(h.state.hammer, save.neoLife.journey.hammer); restored = true;
    }
  }
  assert.equal(h.state.hammer!.phase, 'arrived', JSON.stringify(h.state.hammer));
  assert.ok(h.state.hammer!.gunnery!.kills >= 5); assert.equal(h.state.hammer!.hits, 0);
  assert.equal(h.state.step, FILM_SCENE_BY_ID.m3_hammer_tunnels.steps.length);
  h.command('next'); assert.equal(h.state.scene, 'm3_diggers'); assert.equal(h.actor().id, 'charra');
});

test('an unavailable Niobe cannot keep piloting for Ghost or be resurrected by role switching', () => {
  const h = setup(); h.command('hammer-gunner'); h.frames(1);
  const niobe = h.world.agents.get('niobe')!; niobe.status = 'dead'; niobe.health = 0;
  const saved = structuredClone(h.state.hammer); h.frames(2);
  h.players.act('p', 'shoot', h.tick()); assert.deepEqual(h.state.hammer, saved);
  assert.match(h.command('hammer-pilot'), /无法/); assert.equal(niobe.status, 'dead'); assert.equal(h.actor().id, 'ghost');
});
