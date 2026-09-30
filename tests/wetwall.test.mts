import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, WETWALL_SHAFT, ambushRetreatLength, ambushRetreatRoot, newAmbushEscape, filmPosition, distance, playerBlocked, wetwallEntry, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const set = FILM_SETS.film_ambush_house;
const company = ['apoc', 'switch', 'trinity', 'cypher', 'morpheus'] as const;
function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('wall-player', 'neo', 0); const neo = world.agents.get('neo')!;
  sandbox.life.begin(neo, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('wall-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  const escape = newAmbushEscape(); escape.phase = 'done'; escape.mouseDead = true;
  for (const role of company) {
    escape.progress[role] = ambushRetreatLength(role); const root = ambushRetreatRoot(escape.progress[role], role), actor = world.agents.get(role)!;
    actor.position = { ...filmPosition(set.id, root.x, root.z), y: set.center.y + root.y };
    actor.currentLocation = set.id; actor.isInMatrix = true;
  }
  Object.assign(sandbox.life.film.state!, { scene: 'm1_dejavu', actor: 'neo', step: FILM_SCENE_BY_ID.m1_dejavu.steps.length, ambushEscape: escape, completed: ['m1_dejavu'] });
  neo.position = { ...filmPosition(set.id, -18, -27), y: set.center.y - 37 }; neo.currentLocation = set.id; neo.health = 71;
  world.agents.get('mouse')!.status = 'dead'; world.agents.get('mouse')!.health = 0;
  const state = () => sandbox.life.film.state!;
  const frame = (count = 1, climb = 0, running = true, jump = false) => {
    for (let i = 0; i < count; i++) {
      players.receiveInput('wall-player', { x: 0, z: 0, yaw: 0, jump: jump && i === 0, sprint: false, climb, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  const walkToWall = () => {
    const target = { ...filmPosition(set.id, -18, -28.4), y: set.center.y - 37 };
    for (let i = 0; i < 80 && distance(neo.position, target) > .3; i++) {
      const dx = target.x - neo.position.x, dz = target.z - neo.position.z, gap = Math.hypot(dx, dz);
      players.receiveInput('wall-player', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      players.step(.05, true, ++tick);
    }
    frame(); assert.ok(distance(neo.position, target) < .65);
  };
  const enter = () => { command('next'); assert.equal(state().scene, 'm1_wetwall'); walkToWall(); command('act');
    for (let i = 0; i < 650 && state().wetwall!.phase !== 'climbing'; i++) frame();
    assert.equal(state().wetwall!.phase, 'climbing', JSON.stringify(state().wetwall)); };
  return { world, sandbox, players, neo, command, frame, state, enter, walkToWall, tick: () => tick };
}

test('the eight-floor save enters a playable wall segment without resetting Neo or the crew to floor thirteen', () => {
  const h = setup(), before = [h.neo, ...company.map(id => h.world.agents.get(id)!)].map(actor => ({ ...actor.position }));
  h.command('next'); assert.equal(h.state().scene, 'm1_wetwall');
  assert.equal(h.neo.id, h.state().actor); assert.equal(h.neo.health, 71);
  assert.deepEqual([h.neo, ...company.map(id => h.world.agents.get(id)!)].map(actor => actor.position), before);
  h.frame(50); assert.deepEqual(h.neo.position, before[0]); assert.equal(h.state().step, 0);
  h.command('act'); assert.equal(h.state().wetwall!.phase, 'sealed', 'breaking the wall requires actually approaching it');
  h.walkToWall(); h.command('act'); assert.equal(h.state().wetwall!.phase, 'breaking');
});

test('normal climb input, an explicit rescue and physical company movement reach floor six; waiting does not finish the wall', () => {
  const h = setup(); h.enter();
  const stationary = { ...h.neo.position }; h.frame(80); assert.deepEqual(h.neo.position, stationary);
  const inspect = () => {
    const actors = [h.neo, ...company.map(id => h.world.agents.get(id)!)];
    for (const actor of actors) {
      assert.equal(playerBlocked(actor.position, true, 1.1, h.sandbox.state.structures), false, `${actor.id} is inside a wall at ${JSON.stringify(actor.position)}`);
      for (const other of actors) if (actor !== other && Math.abs(actor.position.y - other.position.y) < 4.7)
        assert.ok(Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z) >= 2.24, `${actor.id} crosses ${other.id}`);
    }
  };
  for (let i = 0; i < 600 && h.state().wetwall!.phase !== 'jammed'; i++) { const before = { ...h.neo.position }; h.frame(1, 1); assert.ok(distance(before, h.neo.position) < .35); inspect(); }
  assert.equal(h.state().wetwall!.phase, 'jammed');
  const progress = { ...h.state().wetwall!.progress }; h.frame(80, 1); assert.deepEqual(h.state().wetwall!.progress, progress);
  h.command('act'); assert.equal(h.state().wetwall!.phase, 'rescuing');
  for (let i = 0; i < 80 && h.state().wetwall!.phase === 'rescuing'; i++) { h.frame(); inspect(); }
  assert.equal(h.state().wetwall!.freed, true);
  for (let i = 0; i < 500 && h.state().wetwall!.phase !== 'done'; i++) { h.frame(1, 1); inspect(); }
  assert.equal(h.state().wetwall!.phase, 'done'); assert.equal(h.neo.position.y, set.center.y - 51.8);
  assert.ok(h.state().completed.includes('m1_wetwall')); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('hanging height and company positions survive pause, disconnect, occupied roles and load', () => {
  const h = setup(); h.enter();
  for (let i = 0; i < 100 && h.state().wetwall!.progress.neo < wetwallEntry(h.state().wetwall!, 'neo') + 1; i++) h.frame(1, 1);
  const positions = () => [h.neo, ...company.map(id => h.world.agents.get(id)!)].map(actor => ({ ...actor.position }));
  const before = JSON.stringify(h.state().wetwall), cast = positions();
  h.frame(30, 1, false); assert.equal(JSON.stringify(h.state().wetwall), before); assert.deepEqual(positions(), cast);
  h.players.release('wall-player', h.tick()); h.players.step(.1, true, h.tick());
  assert.equal(JSON.stringify(h.state().wetwall), before); assert.deepEqual(positions(), cast);
  h.players.possess('wall-player', 'neo', h.tick());
  h.players.possess('other-player', 'cypher', h.tick()); h.frame();
  const occupied = JSON.stringify(h.state().wetwall); h.frame(20, 1); assert.equal(JSON.stringify(h.state().wetwall), occupied); assert.deepEqual(positions(), cast);
  h.players.release('other-player', h.tick()); h.frame();
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), expected = JSON.stringify(h.state().wetwall), savedCast = positions();
  h.sandbox.restore(saved); assert.equal(JSON.stringify(h.state().wetwall), expected); assert.deepEqual(positions(), savedCast);
  h.frame(5, 1); assert.notEqual(h.state().wetwall!.progress.neo, saved.neoLife.journey.wetwall.progress.neo);
});

test('releasing the pipe falls with gravity and retries the saved wall checkpoint without reviving Mouse', () => {
  const h = setup(); h.enter();
  for (let i = 0; i < 100 && h.state().wetwall!.progress.neo < wetwallEntry(h.state().wetwall!, 'neo') + 1; i++) h.frame(1, 1);
  const before = { ...h.neo.position };
  h.frame(1, 0, true, true); assert.equal(h.state().wetwall!.phase, 'falling');
  h.frame(3); assert.ok(h.neo.position.y < before.y - .1, 'letting go must actually fall rather than teleport or float');
  const falling = JSON.stringify(h.state().wetwall), position = { ...h.neo.position };
  h.frame(10, 0, false); assert.equal(JSON.stringify(h.state().wetwall), falling); assert.deepEqual(h.neo.position, position);
  h.frame(3); assert.equal(h.state().wetwall!.phase, 'falling', 'a short airborne interval cannot kill Neo before reaching the actual bottom');
  for (let i = 0; i < 30 && h.state().wetwall!.phase !== 'failed'; i++) h.frame();
  assert.equal(h.state().wetwall!.phase, 'failed'); assert.equal(h.neo.status, 'dead');
  assert.equal(h.neo.position.y, set.center.y + WETWALL_SHAFT.low, 'failure belongs to the physical impact, not a speed threshold in mid-air');
  h.command('retry'); assert.equal(h.state().wetwall!.phase, 'climbing'); assert.equal(h.neo.status, 'alive');
  assert.equal(h.state().wetwall!.attempts, 1); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.equal(playerBlocked(h.neo.position, true, 1.1, h.sandbox.state.structures), false);
});
