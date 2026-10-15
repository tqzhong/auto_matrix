import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, filmPosition, groundHeight, playerBlocked, distance, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const roles = ['morpheus', 'switch', 'apoc', 'trinity', 'cypher'];
const set = FILM_SETS.film_ambush_house;
const stairs = [[-5.5, -7.4, 30.8], [-5.5, -3.7, 14.5], [5.5, -3.7, 14.5], [5.5, 0, 31.8], [11, 0, 31.8]];

function setup(legacy = false) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('doorway-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('doorway-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: FILM_SCENE_BY_ID.m1_oracle.steps.length }); command('next');
  const state = () => sandbox.life.film.state!;
  if (legacy) delete state().ambushApproach!.doorwayCat;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const move = (x: number, z: number) => {
    players.receiveInput('doorway-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint: false, sequence: ++sequence }); frame();
  };
  const cast = () => [actor, ...roles.map(id => world.agents.get(id)!)];
  const walk = (x: number, y: number, z: number) => {
    const target = filmPosition(set.id, x, z); target.y += y;
    for (let i = 0; i < 650; i++) {
      const dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3 && Math.abs(actor.position.y - target.y) < .15) { move(0, 0); return; }
      const before = cast().map(other => ({ ...other.position })); move(dx / Math.max(.01, gap), dz / Math.max(.01, gap));
      cast().forEach((other, index) => {
        assert.ok(distance(other.position, before[index]) < .8, `${other.id} jumps while walking to the doorway`);
        assert.equal(playerBlocked(other.position, true, 1.1, sandbox.state.structures), false, `${other.id} intersects a wall or railing`);
        if (other !== actor) assert.ok(Math.abs(other.position.y - groundHeight(other.position, true)) < .001, `${other.id} loses physical support`);
      });
    }
    assert.fail(`ordinary input did not reach ${x}, ${y}, ${z}`);
  };
  const arrive = () => {
    for (const [x, y, z] of stairs) walk(x, y, z);
    for (let i = 0; i < 500 && !state().ambushApproach!.ready; i++) frame();
    assert.equal(state().ambushApproach!.ready, true);
  };
  const restore = () => sandbox.restore(JSON.parse(JSON.stringify(sandbox.state)));
  return { world, sandbox, players, actor, state, command, frame, move, cast, walk, arrive, restore, tick: () => tick };
}

test('new arrivals keep the physical stair approach but observe the cat on the doorway floor', () => {
  const h = setup();
  assert.equal(h.state().ambushApproach!.stairCat, true, 'the shared stair route is retained');
  assert.equal(h.state().ambushApproach!.doorwayCat, true, 'new entries must choose the film doorway performance');
  assert.equal(h.state().ambush, undefined, 'the cat cannot run before the player begins observing');
  h.arrive(); h.command('act'); h.frame(40);
  assert.match(h.state().lastText, /门洞/);
  assert.doesNotMatch(h.state().lastText, /走下楼梯|沿木楼梯|伸展身体/);
  h.frame(30); assert.match(h.state().lastText, /同样|同一/);
  assert.equal(h.sandbox.state.structures.filter(item => item.id.startsWith('film:ambush:seal:')).length, 0);
  h.frame(65); assert.ok(h.sandbox.state.structures.some(item => item.id.startsWith('film:ambush:seal:')));
  h.frame(14);
  assert.equal(h.state().step, 1);
  assert.equal(h.state().ambushEscape?.phase, 'alarm', 'the corrected cat must retain the physical retreat and Mouse encounter');
  assert.equal(h.state().fighting, undefined);
  h.frame(65); assert.equal(h.state().ambushEscape!.phase, 'descending');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

for (const arrived of [false, true]) test(`an unobserved old stair ${arrived ? 'landing' : 'entry'} opts into the doorway without changing saved routes or positions`, () => {
  const h = setup(true); if (arrived) h.arrive(); else h.walk(-5.5, -7.4, 30.8);
  const approach = structuredClone(h.state().ambushApproach!), positions = h.cast().map(actor => ({ ...actor.position }));
  const checkpoint = { ...h.state().checkpoint }, completed = [...h.state().completed];
  h.restore();
  assert.equal(h.state().ambushApproach!.doorwayCat, true);
  assert.equal(h.state().ambushApproach!.stairCat, true);
  assert.deepEqual(h.state().ambushApproach!.progress, approach.progress);
  assert.deepEqual(h.cast().map(actor => actor.position), positions);
  assert.deepEqual(h.state().checkpoint, checkpoint); assert.deepEqual(h.state().completed, completed);
  assert.equal(h.state().ambush, undefined);
});

test('an older corridor-route save keeps its own observation point instead of adopting the distant side doorway', () => {
  const h = setup(true); delete h.state().ambushApproach!.stairCat;
  const approach = structuredClone(h.state().ambushApproach!);
  h.restore(); assert.deepEqual(h.state().ambushApproach, approach);
  assert.equal(h.state().ambushApproach!.doorwayCat, undefined);
});

for (const observing of [false, true]) test(`reloading during a visit preserves the ${observing ? 'started' : 'unstarted'} old cat version, position and clock`, () => {
  const h = setup(true); h.arrive();
  if (observing) { h.command('act'); h.frame(24); }
  if (!h.state().completed.includes('m1_oracle')) h.state().completed.push('m1_oracle');
  h.command('visit:m1_oracle'); assert.equal(h.state().visiting, 'm1_oracle');
  const approach = structuredClone(h.state().ambushApproach!), ambush = structuredClone(h.state().ambush);
  const positions = h.cast().map(actor => ({ ...actor.position })), checkpoint = { ...h.state().checkpoint }, back = { ...h.state().returnPosition! };
  h.restore(); h.frame(5, false);
  assert.deepEqual(h.state().ambushApproach, approach, 'loading another scene must not silently select a new cat performance');
  assert.deepEqual(h.state().ambush, ambush); assert.deepEqual(h.cast().map(actor => actor.position), positions);
  assert.deepEqual(h.state().checkpoint, checkpoint); assert.deepEqual(h.state().returnPosition, back);
  h.command('return'); h.frame(1, false);
  assert.equal(h.state().visiting, undefined); assert.deepEqual(h.actor.position, back);
  assert.deepEqual(h.state().ambushApproach, approach, 'returning keeps the loaded version instead of introducing another global restoration pass');
  assert.deepEqual(h.state().ambush, ambush);
});

for (const elapsed of [0, 7.2]) test(`an already started stair-cat save at ${elapsed}s keeps its performance on restore`, () => {
  const h = setup(true); h.arrive(); h.command('act'); h.state().ambush!.elapsed = elapsed;
  h.sandbox.life.film.ambushFrame(h.actor, 0, h.tick());
  const approach = structuredClone(h.state().ambushApproach!), positions = h.cast().map(actor => ({ ...actor.position }));
  h.restore();
  assert.deepEqual(h.state().ambushApproach, approach);
  assert.equal(h.state().ambushApproach!.doorwayCat, undefined);
  assert.equal(h.state().ambush!.elapsed, elapsed);
  assert.deepEqual(h.cast().map(actor => actor.position), positions);
  assert.match(h.state().lastText, /楼梯/);
});

for (const floor of [0, -7.4, -37]) test(`an old free-walking save inside the new inner wall is released locally on floor ${floor}`, () => {
  const h = setup(true); h.arrive(); h.command('act'); h.frame(24);
  const old = filmPosition(set.id, 15, 31.8); old.y += floor;
  h.actor.position = { ...old }; h.state().checkpoint = { ...old }; h.state().returnPosition = { ...old };
  const approach = structuredClone(h.state().ambushApproach!), elapsed = h.state().ambush!.elapsed;
  assert.equal(playerBlocked(old, true), true, 'the fixture is covered by the newly introduced wall');
  h.restore();
  assert.equal(playerBlocked(h.actor.position, true, 1.1, h.sandbox.state.structures), false, 'loading must not leave the player trapped inside the new wall');
  assert.equal(h.actor.position.y, old.y, 'recovery must remain on the saved floor');
  assert.ok(Math.abs(groundHeight(h.actor.position, true) - old.y) < .001);
  assert.ok(distance(h.actor.position, old) <= 1.311, 'use the nearest clear side, not the scene entrance');
  assert.deepEqual(h.state().checkpoint, h.actor.position); assert.deepEqual(h.state().returnPosition, h.actor.position);
  assert.equal(h.state().ambush!.elapsed, elapsed); assert.deepEqual(h.state().ambushApproach, approach);
  const after = { ...h.actor.position };
  h.restore(); assert.deepEqual(h.actor.position, after, 'the recovery must be idempotent');
  assert.ok([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([x, z]) => distance(after, stepPlayer(after, 0,
    { x, z, yaw: 0, sprint: false, jump: false, sequence: 1 }, .1, true, h.sandbox.state.structures).position) > .1), 'ordinary input must work after loading');
});

test('new-wall recovery avoids an occupied nearest side and leaves unrelated old positions alone', () => {
  const h = setup(true); h.arrive(); h.command('act'); h.frame(24);
  const old = filmPosition(set.id, 15, 31.8); h.actor.position = { ...old }; h.state().checkpoint = { ...old };
  const other = h.world.agents.get('citizen_1')!;
  other.position = filmPosition(set.id, 13.69, 31.8); other.currentLocation = set.id; other.isInMatrix = true;
  const occupied = { ...other.position }, unchanged = h.world.agents.get('morpheus')!.position;
  h.restore();
  assert.equal(playerBlocked(h.actor.position, true), false);
  assert.ok(distance(h.actor.position, other.position) >= 2.2, 'recovery cannot place two bodies inside one another');
  assert.ok(h.actor.position.x > set.center.x + 15, 'the other side is equally close and clear');
  assert.deepEqual(other.position, occupied); assert.deepEqual(h.world.agents.get('morpheus')!.position, unchanged);
  assert.ok(distance(h.actor.position, old) <= 1.311);
});

test('doorway observation freezes away from the view, on pause and occupation, and resumes the saved beat after retry', () => {
  const h = setup(); h.arrive(); h.command('act'); h.frame(31);
  const elapsed = h.state().ambush!.elapsed;
  h.frame(5, false); assert.equal(h.state().ambush!.elapsed, elapsed);
  h.players.possess('doorway-companion', 'cypher', h.tick()); h.frame(10);
  assert.equal(h.state().ambush!.paused, true); assert.equal(h.state().ambush!.elapsed, elapsed);
  h.players.release('doorway-companion', h.tick());
  h.walk(6, 0, 32.5); const outside = h.state().ambush!.elapsed;
  h.frame(5); assert.equal(h.state().ambush!.paused, true); assert.equal(h.state().ambush!.elapsed, outside);
  h.walk(11, 0, 31.8); h.frame(2); assert.ok(h.state().ambush!.elapsed > outside);
  const saved = h.state().ambush!.elapsed, positions = h.cast().map(actor => ({ ...actor.position }));
  h.players.release('doorway-player', h.tick()); h.frame(10); h.restore();
  assert.equal(h.state().ambush!.elapsed, saved); assert.deepEqual(h.cast().map(actor => actor.position), positions);
  h.players.possess('doorway-player', 'neo', h.tick());
  h.actor.status = 'dead'; h.actor.health = 0; h.command('retry');
  assert.equal(h.state().ambush!.elapsed, saved); assert.equal(h.state().ambushApproach!.doorwayCat, true);
  h.frame(150); assert.equal(h.state().ambushEscape!.phase, 'alarm');
});
