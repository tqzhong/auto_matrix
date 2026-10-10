import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import { hammerCrewRoot, newHammerFlight, newHammerGunnery, FILM_SETS } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(step = 0) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  let tick = 1, sequence = 0;
  players.possess('p', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, tick);
  const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels, state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: scene.actor, step });
  const actor = world.agents.get('niobe')!;
  actor.position = filmStepPosition(scene, scene.steps[step]); actor.currentLocation = scene.set; actor.isInMatrix = false; state.checkpoint = { ...actor.position };
  players.possess('p', 'niobe', tick);
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds / .05); i++) {
      players.receiveInput('p', { x: 0, z: 0, yaw: actor.rotation, sequence: ++sequence, location: scene.set });
      players.step(.05, running, ++tick); if (running) sandbox.tick(tick);
    }
  };
  return { world, sandbox, players, actor, scene, command, frames, get state() { return sandbox.life.film.state!; }, tick: () => tick };
}

test('Ghost occupies the copilot seat until Niobe explicitly orders the saved handover', () => {
  const h = setup();
  const ghost = h.world.agents.get('ghost')!, morpheus = h.world.agents.get('morpheus')!;
  assert.equal(ghost.currentLocation, h.scene.set, 'Ghost is only mentioned in subtitles, absent from the cockpit');
  assert.equal(ghost.currentAction?.parameters.seated, true);
  assert.equal(morpheus.currentAction?.parameters.seated, false, 'Morpheus takes the seat before replacing Ghost');
  h.command('act'); h.frames(3); assert.equal(h.state.step, 1);
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.command('act'); h.frames(2);
  assert.equal(h.state.step, 1, 'the old use timer skips the physical seat exchange');
  assert.equal(h.state.hammer, undefined);
  h.frames(20); assert.equal(h.state.step, 2);
  assert.equal(morpheus.currentAction?.parameters.seated, true);
});

test('handover clocks and cast freeze on pause, release, restore and occupied or unavailable crew', () => {
  const h = setup(1); h.command('act'); h.frames(4);
  const saved = structuredClone(h.sandbox.state), pose = structuredClone(h.world.agents.get('ghost')!.position);
  h.frames(4, false); assert.deepEqual(h.sandbox.state.neoLife!.journey, saved.neoLife!.journey);
  h.players.release('p', h.tick()); h.frames(2); h.sandbox.restore(saved);
  h.players.possess('p', 'niobe', h.tick());
  assert.deepEqual(h.world.agents.get('ghost')!.position, pose);
  h.players.possess('other', 'ghost', h.tick()); const owned = { ...h.world.agents.get('ghost')!.position };
  h.frames(3); assert.equal(h.state.step, 1); assert.deepEqual(h.world.agents.get('ghost')!.position, owned);
  h.players.release('other', h.tick()); h.world.agents.get('ghost')!.health = 0; h.world.agents.get('ghost')!.status = 'dead';
  h.frames(20); assert.equal(h.state.step, 1); assert.equal(h.world.agents.get('ghost')!.status, 'dead');
});

test('a player blocking the crew aisle stops the exchange until the passage is clear', () => {
  const h = setup(1); h.command('act');
  h.actor.position = filmPosition(h.scene.set, 0, 170); h.frames(20);
  assert.equal(h.state.step, 1, 'Ghost walks through the player');
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]); h.frames(20);
  assert.equal(h.state.step, 2);
});

test('a previously completed copilot preparation remains complete and flight retry keeps it', () => {
  const h = setup(2); h.command('act');
  assert.equal(h.state.hammer?.phase, 'riding');
  h.state.hammer!.hull = 1; h.state.hammer!.x = 30; h.frames(.1);
  h.command('retry'); assert.equal(h.state.step, 2); assert.equal(h.actor.status, 'alive');
  h.command('act'); assert.equal(h.state.hammer?.phase, 'riding');
});

test('new preparation waits for Ghost to reach and grip the actual gunner seat without a launch teleport', () => {
  const h = setup(1); h.command('act'); h.frames(13);
  assert.equal(h.state.step, 1, 'flight becomes available while the gunner is still walking');
  const saved = structuredClone(h.sandbox.state); h.frames(3, false);
  assert.deepEqual(h.state, saved.neoLife!.journey);
  h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'niobe', h.tick());
  h.frames(5); assert.equal(h.state.step, 2);
  const ghost = h.world.agents.get('ghost')!, before = structuredClone(ghost.position);
  assert.equal(ghost.currentAction?.parameters.seated, true);
  const expected = hammerCrewRoot({ ...newHammerFlight(), gunnery: newHammerGunnery() }, 'ghost'), center = FILM_SETS[h.scene.set].center;
  assert.ok(Math.hypot(before.x - center.x - expected.x, before.y - center.y - expected.y, before.z - center.z - expected.z) < .001);
  h.command('act'); assert.deepEqual(ghost.position, before, 'launch teleports Ghost through the gunner chair');
});

test('an already moving legacy handover finishes its original path without being restarted', () => {
  const h = setup(1);
  h.state.hammerHandover = { phase: 'moving', elapsed: 11.4 };
  h.frames(2);
  assert.equal(h.state.step, 2); assert.equal(h.state.hammerHandover.station, undefined);
  assert.equal(h.state.hammerHandover.elapsed, 12.5);
});
