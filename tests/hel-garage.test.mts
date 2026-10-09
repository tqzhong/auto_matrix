import assert from 'node:assert/strict';
import test from 'node:test';
import { HEL_GARAGE, FILM_SETS, FILM_SCENE_BY_ID, filmEntry, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { MemoryManager } from '../packages/server/src/memory/MemoryManager.js';
import { RelationshipGraph } from '../packages/server/src/agents/RelationshipGraph.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('hel-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  sandbox.life.film.command(world.agents.get('neo')!, 'continue', 0);
  Object.assign(sandbox.life.film.state!, { scene: 'm3_hel_garage', actor: 'trinity', step: 0, completed: ['m3_trainman_chase'], reflections: { m3_family: 'care' } });
  players.release('hel-player', 0); players.possess('hel-player', 'trinity', 0);
  const actor = world.agents.get('trinity')!, scene = FILM_SCENE_BY_ID.m3_hel_garage;
  actor.position = filmStepPosition(scene, scene.steps[0]); actor.currentLocation = scene.set; actor.isInMatrix = true;
  actor.health = 73; actor.rotation = Math.PI;
  for (const id of ['morpheus', 'seraph']) {
    const companion = world.agents.get(id)!; companion.currentLocation = scene.set; companion.isInMatrix = true;
  }
  let tick = 0;
  const command = (target: string) => players.sandboxAction('hel-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  return { world, sandbox, players, actor, scene, command, frame, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the Hel doormen first recognise Seraph rather than spawning three generic lethal agents', () => {
  const h = setup(); h.command('act');
  assert.equal(h.state().helGarage?.phase, 'talking');
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === h.scene.id).length, 0);
  assert.equal(h.actor.health, 73);
  assert.deepEqual(h.state().reflections, { m3_family: 'care' });
});

test('the visible garage door and structural columns cannot be walked through', () => {
  const h = setup(); h.frame();
  assert.equal(playerBlocked(filmPosition(h.scene.set, 0, -30), true, .7, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmPosition(h.scene.set, 10.8, -8), true, .7, h.sandbox.state.structures), true);
  assert.equal(playerBlocked(filmEntry(h.scene), true, .7, h.sandbox.state.structures), false);
});

function until(h: ReturnType<typeof setup>, phase: string) {
  for (let i = 0; i < 150 && h.state().helGarage?.phase !== phase; i++) h.frame();
  assert.equal(h.state().helGarage?.phase, phase);
}
function clearGuard(h: ReturnType<typeof setup>) {
  h.command('act'); until(h, 'evade');
  h.players.act('hel-player', 'dodge', h.tick()); h.frame(3);
  h.players.act('hel-player', 'attack', h.tick()); until(h, 'combo');
  for (let i = 0; i < 3; i++) {
    h.players.act('hel-player', 'attack', h.tick()); assert.equal(h.state().helGarage?.phase, 'striking');
    until(h, i === 2 ? 'cleared' : 'combo');
  }
}
function walk(h: ReturnType<typeof setup>, x: number, z: number) {
  const to = filmPosition(h.scene.set, x, z); let sequence = h.tick() * 10;
  for (let i = 0; i < 300 && Math.hypot(to.x - h.actor.position.x, to.z - h.actor.position.z) > .3; i++) {
    const dx = to.x - h.actor.position.x, dz = to.z - h.actor.position.z, length = Math.hypot(dx, dz);
    h.players.receiveInput('hel-player', { x: dx / Math.max(1.5, length), z: dz / Math.max(1.5, length), yaw: Math.atan2(dx, dz), sequence: ++sequence }); h.frame();
  }
  h.players.receiveInput('hel-player', { x: 0, z: 0, yaw: h.actor.rotation, sequence: ++sequence }); h.frame(3);
  assert.ok(Math.hypot(to.x - h.actor.position.x, to.z - h.actor.position.z) <= .4,
    `normal movement reaches ${x}/${z}: ${JSON.stringify({ position: h.actor.position, phase: h.state().helGarage?.phase })}`);
}

test('dodge, disarm and three paired counters advance once; a manually opened door still requires walking into the lift', () => {
  const h = setup(), before = Object.fromEntries(['neo', 'morpheus', 'seraph'].map(id => [id, h.world.agents.get(id)!.health]));
  clearGuard(h); assert.equal(h.state().step, 1); assert.equal(h.actor.health, 73);
  assert.equal(h.state().helGarage?.hits, 3); assert.equal(h.state().completed.includes(h.scene.id), false);
  h.command('act'); assert.equal(h.state().helGarage?.phase, 'cleared', 'a remote command cannot open the door');
  walk(h, 2.7, -28.55); h.command('act'); until(h, 'exit');
  assert.equal(playerBlocked(filmPosition(h.scene.set, 0, -30), true, .7, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(h.actor.position, true, 1.1, h.sandbox.state.structures), false, 'releasing the door must leave the player clear of its right jamb');
  h.frame(60); h.command('act'); assert.equal(h.state().step, 1, 'waiting or pressing G must not credit crossing the doorway');
  walk(h, 1.5, -28.3); walk(h, 1.5, -33.2); assert.equal(h.state().step, 2); assert.equal(h.state().helGarage?.phase, 'done');
  assert.equal(h.state().completed.filter(id => id === h.scene.id).length, 1);
  assert.deepEqual(Object.fromEntries(Object.keys(before).map(id => [id, h.world.agents.get(id)!.health])), before);
  h.command('next'); assert.equal(h.state().scene, 'm3_hel_entry');
  assert.equal(h.sandbox.state.structures.some(item => item.id.startsWith('film:hel-garage:')), false);
});

test('missed defence fails locally, normal attacks cannot skip it, and retry preserves injuries, reflections and earlier completions', () => {
  const h = setup(); h.command('act'); until(h, 'evade');
  h.players.act('hel-player', 'shoot', h.tick()); h.players.act('hel-player', 'attack', h.tick());
  assert.equal(h.state().helGarage?.phase, 'evade'); until(h, 'failed');
  assert.equal(h.actor.health, 64); assert.equal(h.state().step, 0);
  h.command('retry'); assert.equal(h.state().helGarage?.phase, 'drawing'); assert.equal(h.state().helGarage?.attempts, 1);
  assert.equal(h.actor.health, 64); assert.deepEqual(h.state().reflections, { m3_family: 'care' });
  assert.deepEqual(h.state().completed, ['m3_trainman_chase']);
});

test('pause and an occupied companion freeze the shared fight without moving or healing the occupied character', () => {
  const h = setup(); h.command('act'); h.frame(8);
  const snapshot = structuredClone(h.state().helGarage); h.frame(20, false); assert.deepEqual(h.state().helGarage, snapshot);
  const morph = h.world.agents.get('morpheus')!; morph.health = 43; morph.controller = 'another-player';
  const position = { ...morph.position }, age = h.state().helGarage!.age;
  h.frame(20); h.players.act('hel-player', 'attack', h.tick());
  assert.equal(h.state().helGarage?.age, age); assert.equal(h.state().helGarage?.paused, morph.name);
  assert.equal((h.actor.currentAction?.parameters.helGarage as { paused: string }).paused, morph.name);
  assert.deepEqual(morph.position, position); assert.equal(morph.health, 43);
});

test('the world rest system cannot heal injuries while the Hel encounter is active or failed', () => {
  const h = setup(); h.command('act');
  const dynamics = new WorldDynamics(h.world, new MemoryManager(), new RelationshipGraph(), () => {});
  dynamics.neoStory = true; h.actor.mind!.stress = 0;
  dynamics.tick(h.tick()); assert.equal(h.actor.health, 73, 'a talking film pose is not a rest action');
  until(h, 'failed'); assert.equal(h.actor.health, 64);
  for (let tick = 0; tick < 30; tick++) { h.actor.mind!.stress = 0; dynamics.tick(h.tick() + tick); }
  assert.equal(h.actor.health, 64, 'waiting to retry must preserve the nine-point injury');
  h.actor.currentAction = { type: 'idle', parameters: {}, startedAt: h.tick(), duration: 1, progress: 0 };
  dynamics.tick(h.tick()); assert.equal(h.actor.health, 64.15, 'normal rest outside the encounter still heals');
});

test('restoring during disarm and a partially open door reconstructs the saved phase, hand clock and collision', () => {
  const h = setup(); h.command('act'); until(h, 'evade'); h.players.act('hel-player', 'dodge', h.tick()); h.frame(3);
  h.players.act('hel-player', 'attack', h.tick()); h.frame(6);
  const verify = () => {
    const saved = structuredClone(h.sandbox.state), positions = Object.fromEntries(HEL_GARAGE.cast.map(id => [id, { ...h.world.agents.get(id)!.position }]));
    h.sandbox.restore(saved); h.frame(10, false);
    assert.deepEqual(h.state().helGarage, saved.neoLife!.journey!.helGarage);
    for (const id of HEL_GARAGE.cast) assert.deepEqual(h.world.agents.get(id)!.position, positions[id]);
    assert.deepEqual(h.sandbox.state.structures.filter(s => s.id.startsWith('film:hel-garage:')), saved.structures.filter(s => s.id.startsWith('film:hel-garage:')));
  };
  verify(); until(h, 'combo');
  for (let i = 0; i < 3; i++) { h.players.act('hel-player', 'attack', h.tick()); until(h, i === 2 ? 'cleared' : 'combo'); }
  walk(h, 2.7, -28.55); h.command('act'); h.frame(6); assert.ok(h.state().helGarage!.door > 0 && h.state().helGarage!.door < 1);
  verify(); assert.equal(h.state().step, 1); assert.equal(h.actor.health, 73);
});

test('Trinity crossing alone cannot claim both companions have already entered the lift', () => {
  const h = setup(); h.frame(); Object.assign(h.state(), { step: 1 });
  Object.assign(h.state().helGarage!, { phase: 'exit', door: 1 }); h.actor.position = filmPosition(h.scene.set, 1.5, -33.2);
  for (const id of ['seraph', 'morpheus']) h.world.agents.get(id)!.position = filmPosition(h.scene.set, id === 'seraph' ? -2 : -4, -26.4);
  h.frame(); assert.equal(h.state().helGarage?.phase, 'exit'); assert.equal(h.state().step, 1);
  until(h, 'done');
  for (const id of ['seraph', 'morpheus']) assert.ok(h.world.agents.get(id)!.position.z < FILM_SETS[h.scene.set].center.z - 32);
});

test('the rescuers use separate standing room after all three enter the lift', () => {
  const h = setup(); clearGuard(h); walk(h, 2.7, -28.55); h.command('act'); until(h, 'exit');
  walk(h, 1.5, -28.3); walk(h, 1.5, -33.2); until(h, 'done'); h.frame(30);
  for (const [i, id] of HEL_GARAGE.cast.entries()) for (const other of HEL_GARAGE.cast.slice(i + 1)) {
    const a = h.world.agents.get(id)!.position, b = h.world.agents.get(other)!.position;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.2, `${id} and ${other} share the same standing room`);
  }
});
