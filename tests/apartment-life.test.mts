import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { APARTMENT, FILM_SETS, LIFE_ACTIONS, distance, filmPosition, filmSetAt, lifeActionPosition, lifeRoomCenter, locationEntrance, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('home-player', 'neo', 0); const neo = players.getAgent('home-player')!;
  sandbox.life.begin(neo, 0);
  const command = (target: string) => players.sandboxAction('home-player', { kind: 'life', target: `film:${target}` }, 1);
  return { world, sandbox, players, neo, command };
}

test('the everyday home and film workroom share furniture, a walkable street exit and city boundaries', () => {
  const center = lifeRoomCenter('neo_apartment')!;
  assert.deepEqual(FILM_SETS.film_anderson_flat.center, center);
  for (let z = 0; z < locationEntrance('neo_apartment').z - center.z; z += .1)
    assert.equal(playerBlocked({ ...center, z: center.z + z }, true), false, `exit blocked at ${z}`);
  assert.equal(playerBlocked({ ...center, x: center.x - 9, z: center.z - 12 }, true), true, 'the actual desk is solid during daily life too');
  assert.equal(filmSetAt(locationEntrance('neo_apartment'), true), undefined, 'the street is not swallowed by the film set margin');
  assert.equal(filmSetAt({ ...center, y: 27 }, true), undefined, 'the city roof remains a roof');
});

test('Neo can walk out and back without switching ordinary home identity to a film location', () => {
  const h = setup(); const center = lifeRoomCenter('neo_apartment')!;
  for (let i = 0; i < 120; i++) {
    h.players.receiveInput('home-player', { x: 0, z: 1, yaw: 0, sprint: false, jump: false, sequence: i });
    h.players.step(.1, true, i);
  }
  assert.ok(h.neo.position.z > center.z + 30, 'walking crosses 101, the landing and the street entrance');
  assert.equal(h.neo.currentLocation, 'neo_apartment');
  for (let i = 120; i < 240; i++) {
    h.players.receiveInput('home-player', { x: 0, z: -1, yaw: Math.PI, sprint: false, jump: false, sequence: i });
    h.players.step(.1, true, i);
  }
  assert.ok(Math.abs(h.neo.position.z - center.z) < 2);
  assert.equal(h.neo.currentLocation, 'neo_apartment');
});

test('an anonymous signal begins at Neo’s existing desk position and keeps the city clock', () => {
  const h = setup(); const life = h.sandbox.life.state!;
  life.chapter = 1; life.contactSignal = true;
  const home = lifeRoomCenter('neo_apartment')!;
  h.neo.position = { ...home, x: home.x + APARTMENT.computer.x, z: home.z + APARTMENT.computer.z };
  h.neo.rotation = 2.4;
  const position = { ...h.neo.position }; const clock = h.world.timeOfDay;
  h.command('continue');
  assert.equal(life.journey?.scene, 'm1_wake_up');
  assert.deepEqual(h.neo.position, position, 'reading a signal must not teleport to a second room or its entrance');
  assert.equal(h.neo.rotation, 2.4);
  assert.equal(h.world.timeOfDay, clock);
  h.players.step(.1, true, 2); assert.equal(h.neo.currentLocation, 'film_anderson_flat');
});

test('starting a contact from the public landing cannot lock Neo outside his room', () => {
  const h = setup(); const life = h.sandbox.life.state!; life.chapter = 1; life.contactSignal = true;
  h.neo.position = filmPosition('film_anderson_flat', 0, 15);
  assert.match(h.command('continue'), /走进 101/);
  assert.equal(life.journey, undefined);
  assert.equal(playerBlocked(filmPosition('film_anderson_flat', 0, 12), true, 1.1, h.sandbox.state.structures), false);
  h.neo.position = filmPosition('film_anderson_flat', 0, 8); h.command('continue');
  assert.equal(life.journey?.scene, 'm1_wake_up');
});

test('postponing the invitation returns control at the same open doorway, including after restore', () => {
  const h = setup(); const life = h.sandbox.life.state!; life.chapter = 1; life.contactSignal = true; h.command('continue');
  const journey = life.journey!; journey.step = 5; journey.contact = { phase: 'noticed', elapsed: 0, paid: true };
  h.neo.position = filmPosition('film_anderson_flat', APARTMENT.door.x, APARTMENT.door.z); h.neo.rotation = .3;
  const position = { ...h.neo.position }; h.command('contact:wait');
  assert.equal(life.journey, undefined); assert.deepEqual(h.neo.position, position); assert.equal(h.neo.rotation, .3);
  assert.equal(playerBlocked(filmPosition('film_anderson_flat', 0, APARTMENT.doorZ), true, 1.1, h.sandbox.state.structures), false);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.command('continue');
  assert.deepEqual(h.neo.position, position); assert.equal(h.sandbox.life.state!.journey?.contact?.phase, 'noticed');
});

test('legacy remote apartment saves migrate actors, paths, checkpoints and barriers once without touching other sets', () => {
  const h = setup(); const life = h.sandbox.life.state!; life.chapter = 1; h.command('continue');
  const old = { x: 5056, y: 1, z: 4096 };
  h.neo.position = { ...old, x: old.x - 9, z: old.z - 8.8 }; h.neo.rotation = .7;
  h.neo.targetPosition = { ...old }; h.neo.currentPath = [{ ...old, z: old.z + 10 }];
  const saved = structuredClone(h.sandbox.state); const journey = saved.neoLife!.journey!;
  journey.checkpoint = { ...h.neo.position }; journey.returnPosition = { ...old };
  saved.neoLife!.deferredContact = { ...structuredClone(journey), checkpoint: { ...old, z: old.z + 10.2 } };
  saved.neoLife!.lastStreetPosition = { ...old };
  saved.structures = [{ id: 'film:apartment:door', kind: 'barricade', owner: 'matrix', matrix: true, health: 1,
    position: { ...old, z: old.z + 12 }, film: { scene: 'm1_wake_up', width: 3.8, depth: .28, height: 6.5 } }];
  const trinity = h.world.agents.get('trinity')!; trinity.position = filmPosition('film_white_rabbit_club');
  const other = { ...trinity.position }; h.sandbox.restore(saved);
  assert.ok(distance(h.neo.position, filmPosition('film_anderson_flat', APARTMENT.computer.x, APARTMENT.computer.z)) < 1e-9, 'the former chair position restores beside the new solid seat');
  assert.equal(h.neo.rotation, .7); assert.deepEqual(h.neo.targetPosition, filmPosition('film_anderson_flat'));
  assert.deepEqual(h.neo.currentPath, [filmPosition('film_anderson_flat', 0, 10)]);
  assert.deepEqual(h.sandbox.life.state!.journey!.returnPosition, filmPosition('film_anderson_flat'));
  assert.ok(distance(h.sandbox.life.state!.deferredContact!.checkpoint, filmPosition('film_anderson_flat', 0, 10.2)) < 1e-9);
  assert.deepEqual(h.sandbox.life.state!.lastStreetPosition, filmPosition('film_anderson_flat'));
  assert.deepEqual(h.sandbox.state.structures.find(s => s.id === 'film:apartment:door')?.position, filmPosition('film_anderson_flat', 0, 12));
  assert.deepEqual(trinity.position, other);
  const position = { ...h.neo.position }; const state = structuredClone(h.sandbox.state);
  h.sandbox.restore(state); assert.deepEqual(h.neo.position, position); assert.deepEqual(h.sandbox.state, state);
});

test('daily computer, sleep and calls use the same physical props as the film sequence', () => {
  const h = setup();
  for (const [id, point] of [['computer', APARTMENT.computer], ['sleep', APARTMENT.bedside], ['invite', { x: APARTMENT.phone.approachX, z: APARTMENT.phone.approachZ }]] as const) {
    const action = LIFE_ACTIONS.find(a => a.id === id)!; const position = lifeActionPosition(action);
    assert.deepEqual(position, filmPosition('film_anderson_flat', point.x, point.z));
    assert.equal(playerBlocked(position, true), false, `${id} approach must be reachable`);
    h.neo.position = position;
    h.sandbox.life.command(h.neo, id, 1); assert.equal(h.sandbox.life.state!.activity?.id, id);
    delete h.sandbox.life.state!.activity;
  }
});

test('a daily save inside furniture from the former room layout restores at a clear position', () => {
  const h = setup(); h.neo.position = filmPosition('film_anderson_flat', 6, 6.2);
  const state = structuredClone(h.sandbox.state);
  state.neoLife!.activity = { id: 'computer', position: { ...h.neo.position }, startedAt: 5, endsAt: 11 };
  h.sandbox.restore(state);
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false);
  assert.deepEqual(h.sandbox.life.state!.activity?.position, h.neo.position, 'the restore must not cancel an already paid activity by moving only its actor');
  assert.equal(h.sandbox.life.state!.activity?.endsAt, 11);
});

test('an older deferred invitation does not restore a closed story barrier into daily life', () => {
  const h = setup(); const state = structuredClone(h.sandbox.state);
  state.structures.push({ id: 'film:apartment:door', kind: 'barricade', owner: 'matrix', matrix: true, health: 1,
    position: { x: 5056, y: 1, z: 4108 }, film: { scene: 'm1_wake_up', width: 3.8, depth: .28, height: 6.5 } });
  h.sandbox.restore(state);
  assert.equal(playerBlocked(filmPosition('film_anderson_flat', 0, 12), true, 1.1, h.sandbox.state.structures), false);
});

test('the journal offers investigation at the actual desk instead of another trip home', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/NeoLifePanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderNeoLife } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const h = setup(); h.sandbox.life.state!.chapter = 1; h.sandbox.life.state!.contactSignal = true;
  h.neo.position = filmPosition('film_anderson_flat', APARTMENT.computer.x, APARTMENT.computer.z);
  const html = renderNeoLife(h.neo, h.sandbox.state, 7500);
  assert.match(html, /data-target="film:continue"/);
  assert.match(html, /data-target="computer"/);
  assert.doesNotMatch(html, /先回公寓 →/);
});
