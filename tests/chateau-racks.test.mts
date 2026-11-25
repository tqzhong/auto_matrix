import assert from 'node:assert/strict';
import test from 'node:test';
import { CHATEAU, FILM_SETS, filmPosition, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

for (const weapon of ['sword', 'spear'] as const) test(`the visible ${weapon} stand blocks walking while its four-metre pickup remains reachable`, () => {
  const rack = CHATEAU.racks[weapon], set = FILM_SETS.film_chateau_hall;
  assert.equal(playerBlocked(filmPosition(set.id, rack.x, rack.z), true), true, 'the wooden stand cannot be walked through');
  let position = filmPosition(set.id, rack.x, rack.z + 4), velocity = { x: 0, z: 0 };
  assert.equal(playerBlocked(position, true), false);
  for (let i = 0; i < 100; i++) {
    const next = stepPlayer(position, 0, { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: false }, .05, true, [], velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  const gap = position.z - set.center.z - rack.z;
  assert.ok(gap >= .55 / 2 + 1.1 - .04, 'stop the player before the visible wooden face');
  assert.ok(gap <= 4, 'G remains in range after the body stops');
  assert.equal(playerBlocked({ ...filmPosition(set.id, rack.x, rack.z), y: set.center.y + 6 }, true), false);
});

function savedSword() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (_event: Omit<WorldEvent, 'id'>) => undefined } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42), neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0);
  Object.assign(neo, { currentLocation: 'film_chateau_hall', isInMatrix: true, health: 79.15,
    position: filmPosition('film_chateau_hall', CHATEAU.racks.sword.x + .35, CHATEAU.racks.sword.z - .2), rotation: 1.3,
    currentAction: { type: 'idle', parameters: { player: true, resolved: true, chateauWeapon: 'sword' }, startedAt: 304168, duration: 1, progress: .4 } });
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm2_chateau', step: 0, actor: 'neo', enteredAt: 304143,
    checkpoint: filmPosition('film_chateau_hall', 0, 10), completed: [], reflections: {}, lastText: '',
    chateau: { phase: 'duel', wave: 1, weapon: 'sword', parries: 0, disarms: 0, attempts: 0, wounded: true } };
  return { sandbox, neo, state: sandbox.life.film.state! };
}

for (const atCheckpoint of [false, true]) test(`a legacy sword save inside the stand moves clear without losing its pose or wounds (${atCheckpoint ? 'same' : 'separate'} checkpoint)`, () => {
  const h = savedSword(), before = structuredClone(h.neo), checkpoint = { ...h.state.checkpoint };
  if (atCheckpoint) h.state.checkpoint = { ...h.neo.position };
  h.sandbox.life.film.restoreChateauSpace();
  assert.notDeepEqual(h.neo.position, before.position, 'the old saved body must leave the newly solid stand');
  assert.equal(playerBlocked(h.neo.position, true), false);
  assert.equal(h.neo.position.x, before.position.x); assert.equal(h.neo.position.y, before.position.y);
  assert.equal(h.neo.health, before.health); assert.equal(h.neo.rotation, before.rotation); assert.deepEqual(h.neo.currentAction, before.currentAction);
  assert.equal(h.state.chateau!.weapon, 'sword'); assert.equal(h.state.chateau!.wounded, true);
  assert.deepEqual(h.state.checkpoint, atCheckpoint ? h.neo.position : checkpoint);
});

test('a valid stance beside the weapon rack is not moved during restoration', () => {
  const h = savedSword(); h.neo.position = filmPosition('film_chateau_hall', -26, 15);
  const before = structuredClone(h.neo), checkpoint = { ...h.state.checkpoint };
  h.sandbox.life.film.restoreChateauSpace();
  assert.deepEqual(h.neo, before); assert.deepEqual(h.state.checkpoint, checkpoint);
});
