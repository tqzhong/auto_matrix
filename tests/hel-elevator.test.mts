import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, playerBlocked } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  const neo = world.agents.get('neo')!; sandbox.enter(neo); sandbox.life.begin(neo, 0);
  const trinity = world.agents.get('trinity')!; trinity.controller = 'player'; sandbox.enter(trinity);
  const scene = FILM_SCENE_BY_ID.m3_hel_entry;
  trinity.position = filmStepPosition(scene, scene.steps[0]); trinity.currentLocation = scene.set; trinity.isInMatrix = true;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 0, actor: trinity.id, completed: ['m3_hel_garage'],
    enteredAt: 0, checkpoint: { ...trinity.position }, reflections: { 'm3_family:0': 'care' }, lastText: '',
    helElevator: { phase: 'ready', elapsed: 0, lastTick: 0 }, helDanceDoor: { phase: 'sealed', elapsed: 0, lastTick: 0 } };
  for (const [id, x] of [['morpheus', -2], ['seraph', 2]] as const) {
    const ally = world.agents.get(id)!; ally.position = filmPosition(scene.set, x, 34); ally.currentLocation = scene.set; ally.isInMatrix = true;
  }
  return { world, sandbox, trinity, film: sandbox.life.film, center: FILM_SETS.film_club_hel.center };
}

test('the cage and all three passengers descend from the upper landing to the coat-check floor', () => {
  const h = setup(); h.film.reconcileCast();
  assert.equal(h.trinity.position.y, h.center.y + 12, 'the source checkpoint must stand on the upper cage floor');
  const message = h.film.command(h.trinity, 'act', 0);
  assert.equal(h.film.state!.helElevator!.phase, 'descending', JSON.stringify({ message, actor: h.trinity.position, lift: h.film.state!.helElevator,
    target: filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, h.film.step!, h.film.state!) }));
  h.film.tick(4);
  const y = h.trinity.position.y;
  assert.ok(y < h.center.y + 11.9 && y > h.center.y, `the cage has not really descended: ${y}`);
  for (const id of ['morpheus', 'seraph']) assert.equal(h.world.agents.get(id)!.position.y, y, `${id} must ride the same saved floor`);
  assert.equal(playerBlocked(filmPosition('film_club_hel', 0, 24.6), true, .7, h.sandbox.state.structures), true);
  h.film.tick(30);
  assert.equal(h.film.state!.step, 0); assert.equal(h.trinity.position.y, h.center.y);
  assert.equal(h.film.state!.helElevator!.phase, 'arrived');
  assert.equal(playerBlocked(filmPosition('film_club_hel', 0, 24.6), true, .7, h.sandbox.state.structures), true, 'arrival does not open the gate for the player');
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[0], h.film.state!);
  h.film.command(h.trinity, 'act', 30); h.film.tick(34);
  assert.equal(h.film.state!.step, 1);
  assert.equal(playerBlocked(filmPosition('film_club_hel', 0, 24.6), true, .7, h.sandbox.state.structures), false);
  assert.deepEqual(h.film.state!.completed, ['m3_hel_garage']);
  assert.equal(h.film.state!.reflections['m3_family:0'], 'care');
});

test('an occupied companion stops the whole lift without moving that player or consuming travel', () => {
  const h = setup(); h.film.reconcileCast();
  h.world.agents.get('morpheus')!.controller = 'other-player';
  const before = structuredClone(h.world.agents.get('morpheus')!);
  h.film.command(h.trinity, 'act', 1); h.film.tick(5);
  assert.equal(h.film.state!.helElevator!.elapsed, 0, 'the elevator cannot depart with an occupied companion');
  assert.deepEqual(h.world.agents.get('morpheus'), before);
});

test('companions boarding from the garage belong to the same Matrix landing before coat-check combat', () => {
  const h = setup();
  for (const id of ['morpheus', 'seraph']) h.world.agents.get(id)!.currentLocation = 'film_hel_garage';
  h.film.reconcileCast(); h.film.command(h.trinity, 'act', 0); h.film.tick(30);
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[0], h.film.state!);
  h.film.command(h.trinity, 'act', 30); h.film.tick(34);
  for (const id of ['morpheus', 'seraph']) assert.equal(h.world.agents.get(id)!.currentLocation, 'film_club_hel');
  h.trinity.position = filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[1]);
  h.film.command(h.trinity, 'act', 35);
  assert.equal(h.film.state!.helCoatcheck!.phase, 'combat');
  assert.equal(h.sandbox.state.threats.length, 3);
});

test('a saved moving floor survives pause, release and restore without dropping passengers or replaying the button', () => {
  const h = setup(); h.film.reconcileCast(); h.film.command(h.trinity, 'act', 0); h.film.tick(4);
  const before = { lift: structuredClone(h.film.state!.helElevator), positions: ['trinity', 'morpheus', 'seraph'].map(id => structuredClone(h.world.agents.get(id)!.position)) };
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(h.film.state!.helElevator, before.lift);
  assert.deepEqual(['trinity', 'morpheus', 'seraph'].map(id => h.world.agents.get(id)!.position), before.positions);
  h.trinity.controller = null; h.film.tick(40);
  assert.equal(h.film.state!.helElevator!.elapsed, before.lift!.elapsed);
  assert.deepEqual(['trinity', 'morpheus', 'seraph'].map(id => h.world.agents.get(id)!.position), before.positions);
  h.trinity.controller = 'player'; h.film.tick(41);
  assert.ok(h.trinity.position.y < before.positions[0].y, 'resuming continues the saved descent');
});
