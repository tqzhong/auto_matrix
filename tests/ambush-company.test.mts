import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, filmPosition, groundHeight, playerBlocked, distance, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const roles = ['morpheus', 'switch', 'apoc', 'trinity', 'cypher'];
const set = FILM_SETS.film_ambush_house;
const route = [[-5.5, 30.8], [-5.5, 14.5], [5.5, 14.5], [5.5, 31.8], [11, 31.8], [11, 8], [0, 8], [0, -8]];

function setup(stairCat = false) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('company-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('company-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: FILM_SCENE_BY_ID.m1_oracle.steps.length });
  command('next');
  assert.equal(sandbox.life.film.state!.scene, 'm1_dejavu', 'the fixture must enter the actual ambush scene');
  if (!stairCat) delete (sandbox.life.film.state!.ambushApproach as { stairCat?: boolean } | undefined)?.stairCat;
  const state = () => sandbox.life.film.state! as FilmJourney & { ambushApproach?: { ready: boolean; progress: Record<string, number> } };
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const move = (x: number, z: number, sprint = false) => {
    players.receiveInput('company-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint, sequence: ++sequence }); frame();
  };
  const cast = () => roles.map(id => world.agents.get(id)!);
  return { world, sandbox, players, actor, state, command, frame, move, cast, tick: () => tick };
}

test('the old-building arrival contains Neo and all five companions on its actual lower stairs', () => {
  const h = setup();
  assert.ok(h.state().ambushApproach, 'fresh entry must author the company route instead of leaving generic upstairs cast spots');
  assert.equal(h.state().ambush, undefined, 'the cat must not play before the stairs have been climbed');
  for (const actor of h.cast()) {
    assert.equal(actor.currentLocation, set.id, `${actor.name} accompanies Neo, including Cypher`);
    assert.ok(actor.position.y < set.center.y - 3, `${actor.name} must actually begin below the old corridor`);
    assert.equal(playerBlocked(actor.position, true), false);
    assert.ok(Math.abs(actor.position.y - groundHeight(actor.position, true)) < .001);
    assert.ok(distance(actor.position, h.actor.position) > 2.7, 'a companion cannot spawn inside Neo');
  }
});

function walk(h: ReturnType<typeof setup>, inspect?: () => void, sprint = false, path = route) {
  for (const [x, z] of path) {
    const target = filmPosition(set.id, x, z);
    for (let i = 0; i < 600; i++) {
      const dx = target.x - h.actor.position.x, dz = target.z - h.actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3) { h.move(0, 0); inspect?.(); break; }
      h.move(dx / gap, dz / gap, sprint); inspect?.();
      assert.ok(i < 599, `ordinary movement could not reach ${x}, ${z}`);
    }
  }
  for (let i = 0; i < 500 && !h.state().ambushApproach?.ready; i++) { h.frame(); inspect?.(); }
  h.move(0, 0);
}

test('ordinary walking brings all five companions up both flights, with supported positions and no corner teleports', () => {
  const h = setup(), last = new Map(h.cast().map(actor => [actor.id, { ...actor.position }]));
  const climbed = new Set<string>();
  walk(h, () => {
    const actors = h.cast();
    for (const actor of actors) {
      assert.equal(playerBlocked(actor.position, true), false, `${actor.name} crosses solid rails or walls`);
      assert.ok(Math.abs(actor.position.y - groundHeight(actor.position, true)) < .001, `${actor.name} floats above the stairs`);
      assert.ok(distance(actor.position, h.actor.position) >= 1.5, `${actor.name} overlaps the walking player`);
      assert.ok(distance(actor.position, last.get(actor.id)!) < .8, `${actor.name} teleports around a turn: ${JSON.stringify({ before: last.get(actor.id), after: actor.position, progress: h.state().ambushApproach?.progress[actor.id] })}`);
      if (actor.position.y > set.center.y - 3.4 && actor.position.y < set.center.y - .8) climbed.add(actor.id);
      last.set(actor.id, { ...actor.position });
      for (const other of actors.filter(other => other.id !== actor.id)) assert.ok(distance(actor.position, other.position) > 2.7, `${actor.name} overlaps ${other.name}`);
    }
  });
  assert.equal(h.state().ambushApproach?.ready, true, 'all five must reach the observation corridor without position edits');
  assert.equal(climbed.size, 5);
  for (const actor of h.cast()) assert.ok(Math.abs(actor.position.y - set.center.y) < .001);
  h.command('act'); h.frame(100);
  assert.equal(h.state().step, 1, 'the same walking save must continue through the repeat into the sealed building');
  assert.equal(h.sandbox.state.structures.filter(item => item.film?.scene === 'm1_dejavu').length, 2);
});

test('sprinting Neo reaches the same corridor while his companions keep clear and use both stair flights', () => {
  const h = setup();
  walk(h, () => {
    for (const actor of h.cast()) {
      assert.equal(playerBlocked(actor.position, true), false);
      assert.ok(distance(actor.position, h.actor.position) >= 1.5, `${actor.name} overlaps the sprinting player`);
    }
  }, true);
  assert.equal(h.state().ambushApproach?.ready, true);
});

test('the company waits for Neo and preserves route progress across pause, disconnect, occupation, loading and retry', () => {
  const h = setup(); assert.ok(h.state().ambushApproach);
  h.frame(100); assert.equal(h.state().ambushApproach.ready, false, 'the company cannot leave Neo downstairs');
  const before = JSON.stringify(h.state().ambushApproach), positions = h.cast().map(actor => ({ ...actor.position }));
  h.frame(25, false); assert.equal(JSON.stringify(h.state().ambushApproach), before);
  h.players.release('company-player', h.tick()); h.frame(25); assert.equal(JSON.stringify(h.state().ambushApproach), before);
  h.players.possess('company-player', 'neo', h.tick()); h.players.possess('cypher-player', 'cypher', h.tick());
  const occupied = { ...h.world.agents.get('cypher')!.position };
  h.actor.position = filmPosition(set.id, 11, 8); h.frame(25);
  assert.equal(JSON.stringify(h.state().ambushApproach), before);
  assert.deepEqual(h.world.agents.get('cypher')!.position, occupied, 'the scene must not grab another player');
  h.players.release('cypher-player', h.tick());
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(JSON.stringify(h.state().ambushApproach), before);
  assert.deepEqual(h.cast().map(actor => actor.position), positions, 'restore uses the saved stair route instead of staging actors upstairs');
  h.actor.status = 'dead'; h.actor.health = 0; h.command('retry');
  assert.equal(JSON.stringify(h.state().ambushApproach), before);
  assert.deepEqual(h.cast().map(actor => actor.position), positions, 'retry cannot restart or teleport the company');
});

test('the cat repeat stops the company, turns Trinity toward Neo and freezes when a companion is occupied', () => {
  const h = setup(); walk(h); assert.equal(h.state().ambushApproach?.ready, true);
  h.command('act'); h.frame(55);
  const trinity = h.world.agents.get('trinity')!;
  const heading = Math.atan2(h.actor.position.x - trinity.position.x, h.actor.position.z - trinity.position.z);
  assert.ok(Math.cos(trinity.rotation - heading) > .99, 'Trinity actually looks back at the speaker rather than continuing a generic idle');
  const clock = h.state().ambush!.elapsed, positions = h.cast().map(actor => ({ ...actor.position }));
  h.players.possess('cypher-player', 'cypher', h.tick()); h.frame(30);
  assert.equal(h.state().ambush!.elapsed, clock, 'an occupied companion pauses the repeat and the building rewrite');
  assert.deepEqual(h.cast().map(actor => actor.position), positions);
  h.players.release('cypher-player', h.tick()); h.frame(45);
  assert.equal(h.state().step, 1);
});

test('a legacy cat save continues without adding a staircase or rewinding its observation', () => {
  const h = setup(); delete h.state().ambushApproach;
  h.state().ambush = { elapsed: 4.7 }; h.actor.position = filmPosition(set.id, 0, -8);
  h.state().checkpoint = { ...h.actor.position };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.frame();
  assert.equal(h.state().ambushApproach, undefined);
  assert.ok(h.state().ambush.elapsed > 4.7);
  h.frame(50); assert.equal(h.state().step, 1);
});

test('a fresh company observes the cat on the upper stairs and preserves the longer descent across pause and loading', () => {
  const h = setup(true);
  assert.equal((h.state().ambushApproach as { stairCat?: boolean }).stairCat, true);
  walk(h, () => {
    for (const actor of h.cast()) {
      assert.equal(playerBlocked(actor.position, true), false);
      assert.ok(distance(actor.position, h.actor.position) >= 1.5);
      for (const other of h.cast()) if (actor !== other) assert.ok(distance(actor.position, other.position) >= 2.25, 'the new landing still keeps two 1.1-radius bodies apart');
    }
  }, false, route.slice(0, 5));
  assert.equal(h.state().ambushApproach?.ready, true, `the company stops at the stairs before walking into the old doorway corridor: ${JSON.stringify({ player: h.actor.position, approach: h.state().ambushApproach, company: h.cast().map(actor => ({ id: actor.id, position: actor.position })) })}`);
  h.command('act'); h.frame(50);
  assert.ok(h.state().ambush!.elapsed > 4.9);
  assert.match(h.state().lastText, /楼梯/);
  const before = JSON.stringify(h.state().ambush), positions = h.cast().map(actor => ({ ...actor.position }));
  h.frame(10, false); h.players.release('company-player', h.tick()); h.frame(10);
  assert.equal(JSON.stringify(h.state().ambush), before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  h.players.possess('company-player', 'neo', h.tick()); h.frame(1, false);
  assert.deepEqual(h.cast().map(actor => actor.position), positions);
  assert.equal(JSON.stringify(h.state().ambush), before);
  h.players.possess('cypher-player', 'cypher', h.tick()); h.frame(15);
  assert.equal(h.state().ambush!.paused, true, 'occupation suspends both server time and client prediction');
  assert.equal(h.state().ambush!.elapsed, JSON.parse(before).elapsed);
  h.players.release('cypher-player', h.tick());
  h.actor.status = 'dead'; h.actor.health = 0; h.command('retry');
  assert.deepEqual(h.cast().map(actor => actor.position), positions, 'retry keeps the company at its saved stair observation');
  assert.equal(h.state().ambush!.elapsed, JSON.parse(before).elapsed, 'retry preserves the descent instead of restarting the old cat');
  h.frame(81); assert.equal(h.state().step, 0, 'the stair pass must not use the old 9.5 second doorway clock');
  assert.equal(h.sandbox.state.structures.filter(item => item.film?.scene === 'm1_dejavu').length, 0);
  h.frame(6); assert.equal(h.sandbox.state.structures.filter(item => item.film?.scene === 'm1_dejavu').length, 2);
  h.frame(20); assert.equal(h.state().step, 1);
});
