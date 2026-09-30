import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, FILM_SCENE_BY_ID, AMBUSH_ESCAPE, filmPosition, groundHeight, playerBlocked, stepPlayer, distance, filmCharacterFates, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const set = FILM_SETS.film_ambush_house;
const roles = ['morpheus', 'switch', 'apoc', 'trinity', 'cypher'];
const descent = Array.from({ length: 5 }, (_, floor) => {
  const y = -floor * 7.4;
  return [[5.5, y, 31.8], [5.5, y - 3.7, 14.5], [-5.5, y - 3.7, 14.5], [-5.5, y - 7.4, 31.8]];
}).flat();

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('escape-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('escape-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: FILM_SCENE_BY_ID.m1_oracle.steps.length }); command('next');
  const state = () => sandbox.life.film.state!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const move = (x: number, z: number, sprint = false) => {
    players.receiveInput('escape-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint, sequence: ++sequence }); frame();
  };
  const walk = (x: number, y: number, z: number, inspect?: () => void) => {
    const target = filmPosition(set.id, x, z); target.y += y;
    for (let i = 0; i < 650; i++) {
      const dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3 && Math.abs(actor.position.y - target.y) < .15) { move(0, 0); inspect?.(); return; }
      move(dx / Math.max(.01, gap), dz / Math.max(.01, gap), true); inspect?.();
    }
    assert.fail(`normal input cannot reach ${x}, ${y}, ${z}: ${JSON.stringify({ neo: actor.position, escape: state().ambushEscape, cast: roles.map(id => ({ id, position: world.agents.get(id)!.position })) })}`);
  };
  return { world, sandbox, players, actor, state, command, frame, move, walk, tick: () => tick };
}

function cat(h: ReturnType<typeof setup>) {
  for (const [x, y, z] of [[-5.5, -7.4, 30.8], [-5.5, -3.7, 14.5], [5.5, -3.7, 14.5], [5.5, 0, 31.8], [11, 0, 31.8]]) h.walk(x, y, z);
  for (let i = 0; i < 500 && !h.state().ambushApproach!.ready; i++) h.frame();
  assert.ok(h.state().ambushApproach!.ready); h.command('act'); h.frame(150);
}

test('the fresh cat leads to the cut hardline and a physical retreat, instead of a generic two-agent brawl', () => {
  const h = setup(); cat(h);
  assert.equal(h.state().step, 1);
  assert.equal(h.state().ambushEscape?.phase, 'alarm', 'the crew needs an actual retreat before it can reach the eighth-floor window');
  h.command('act'); assert.equal(h.state().fighting, undefined);
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === 'm1_dejavu' && !threat.patrol).length, 0);
});

test('ordinary movement can descend five connected storeys with physical support and no floor teleport', () => {
  let position = filmPosition(set.id, 11, 31.8), vy = 0, velocity = { x: 0, z: 0 };
  for (const [x, y, z] of descent) {
    const target = filmPosition(set.id, x, z); target.y += y;
    for (let frame = 0; frame < 900; frame++) {
      const dx = target.x - position.x, dz = target.z - position.z, gap = Math.hypot(dx, dz);
      if (gap < .25 && Math.abs(position.y - target.y) < .12) break;
      const result = stepPlayer(position, vy, { x: dx / Math.max(.01, gap), z: dz / Math.max(.01, gap), yaw: 0, sprint: false, jump: false, sequence: frame }, .05, true, [], velocity);
      assert.ok(distance(position, result.position) < .6, 'stairs cannot transport the player to another floor');
      position = result.position; vy = result.verticalVelocity; velocity = result.horizontalVelocity;
      assert.equal(playerBlocked(position, true), false);
      assert.ok(frame < 899, `no connected retreat toward floor ${y}: ${JSON.stringify(position)}`);
    }
    assert.ok(Math.abs(groundHeight(position, true) - target.y) < .1);
  }
  assert.ok(Math.abs(position.y - (set.center.y - 37)) < .1, 'the eighth floor is five storeys below room 1313');
});

test('the five-storey descent brings the entire company to a sealed window, exposes the risky call and reaches the actual wet wall', () => {
  const h = setup(); cat(h); h.frame(65);
  assert.equal(h.state().ambushEscape!.phase, 'descending');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.equal(filmCharacterFates(h.state()).mouse, 'dead');
  const last = new Map(roles.map(role => [role, { ...h.world.agents.get(role)!.position }]));
  const inspect = () => {
    const cast = roles.map(role => h.world.agents.get(role)!);
    for (const actor of cast) {
      assert.equal(playerBlocked(actor.position, true, 1.1, h.sandbox.state.structures), false, `${actor.id} crosses a wall or rail`);
      assert.ok(Math.abs(actor.position.y - groundHeight(actor.position, true)) < .001, `${actor.id} loses stair support`);
      assert.ok(distance(actor.position, last.get(actor.id)!) < 1.1, `${actor.id} teleports around a turn: ${JSON.stringify({ before: last.get(actor.id), after: actor.position })}`);
      assert.ok(distance(actor.position, h.actor.position) >= 1.5, `${actor.id} intersects Neo`);
      for (const other of cast) if (actor !== other) assert.ok(distance(actor.position, other.position) >= 2.25, `${actor.id} intersects ${other.id}`);
      last.set(actor.id, { ...actor.position });
    }
    assert.notEqual(h.state().ambushEscape!.phase, 'failed', `a sprinting retreat must have enough time to bring the crew: ${JSON.stringify({ neo: h.actor.position, cast: cast.map(a => ({ id: a.id, position: a.position })), escape: h.state().ambushEscape, threats: h.sandbox.state.threats.map(t => t.position) })}`);
  };
  for (const [x, y, z] of descent) h.walk(x, y, z, inspect);
  for (const [x, z] of [[-11, 31.8], [-11, 8], [0, 8], [0, -16], [-18, -16]]) h.walk(x, -37, z, inspect);
  for (let i = 0; i < 200 && h.state().ambushEscape!.phase === 'descending'; i++) { h.frame(); inspect(); }
  assert.equal(h.state().ambushEscape!.phase, 'window'); assert.equal(h.state().step, 1);
  assert.equal(h.state().fighting, undefined);
  h.command('act'); assert.equal(h.state().ambushEscape!.phase, 'phone');
  h.command('act'); assert.equal(h.state().ambushEscape!.phase, 'phone', 'inspecting the window cannot automatically dial from another room');
  for (const [x, z] of [[-18, -13.2], [-5.4, -13.2]]) h.walk(x, -37, z);
  h.command('act'); assert.equal(h.state().ambushEscape!.phase, 'call');
  assert.equal(h.state().ambushEscape!.traced, true, 'using a mobile phone must expose the floor rather than act as a safe exit');
  h.frame(56); assert.equal(h.state().step, 2); assert.equal(h.state().ambushEscape!.phase, 'forming');
  for (let i = 0; i < 180 && h.state().ambushEscape!.phase === 'forming'; i++) h.frame();
  assert.equal(h.state().ambushEscape!.phase, 'wetwall', 'all five companions must actually move to the sides before Neo enters the narrow room');
  for (const [x, z] of [[-18, -13.2], [-18, -27]]) h.walk(x, -37, z);
  for (let i = 0; i < 180 && h.state().ambushEscape!.phase !== 'done'; i++) h.frame();
  assert.equal(h.state().ambushEscape!.phase, 'done'); assert.ok(h.state().completed.includes('m1_dejavu'));
  assert.equal(h.actor.position.y, set.center.y + AMBUSH_ESCAPE.wetwall.y, 'the route ends on the eighth floor, not a teleported upper corridor');
});

test('the player cannot walk through a waiting companion at the retreat merge', () => {
  const h = setup(); cat(h); h.frame(65);
  for (let i = 0; i < 60 && h.actor.status === 'alive'; i++) {
    const trinity = h.world.agents.get('trinity')!;
    const dx = trinity.position.x - h.actor.position.x, dz = trinity.position.z - h.actor.position.z, gap = Math.hypot(dx, dz);
    h.move(dx / Math.max(.01, gap), dz / Math.max(.01, gap), true);
    assert.ok(Math.hypot(trinity.position.x - h.actor.position.x, trinity.position.z - h.actor.position.z) >= 2.24, 'Neo phases through Trinity at the merge');
  }
});

test('retreat progress, the actual crew and pursuit preserve pause, disconnect, occupied companions and loading', () => {
  const h = setup(); cat(h); h.frame(65);
  for (const [x, y, z] of descent.slice(0, 4)) h.walk(x, y, z);
  const positions = () => [h.actor, ...roles.map(role => h.world.agents.get(role)!)].map(actor => ({ ...actor.position }));
  const before = JSON.stringify(h.state().ambushEscape), cast = positions(), threats = JSON.stringify(h.sandbox.state.threats);
  h.frame(30, false); assert.equal(JSON.stringify(h.state().ambushEscape), before); assert.deepEqual(positions(), cast);
  h.players.release('escape-player', h.tick()); h.frame(30);
  assert.equal(JSON.stringify(h.state().ambushEscape), before); assert.equal(JSON.stringify(h.sandbox.state.threats), threats);
  h.players.possess('escape-player', 'neo', h.tick()); h.players.possess('cypher-player', 'cypher', h.tick());
  h.frame(); const occupied = JSON.stringify(h.state().ambushEscape); h.frame(30);
  assert.equal(JSON.stringify(h.state().ambushEscape), occupied); assert.deepEqual(positions(), cast);
  h.command('act'); assert.equal(JSON.stringify(h.state().ambushEscape), occupied);
  h.players.release('cypher-player', h.tick()); h.frame();
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)), expected = JSON.stringify(h.state().ambushEscape), beforeRestore = positions();
  h.sandbox.restore(saved); assert.equal(JSON.stringify(h.state().ambushEscape), expected);
  assert.deepEqual(positions(), beforeRestore); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  h.frame(); assert.notEqual(JSON.stringify(h.state().ambushEscape!.pursuers), JSON.stringify(saved.neoLife.journey.ambushEscape.pursuers), 'the same pursuit resumes instead of respawning or rewinding');
});

test('a real pursuit failure retries the latest supported floor without resurrecting Mouse or replaying the cat', () => {
  const h = setup(); cat(h); h.frame(65);
  for (const [x, y, z] of descent.slice(0, 8)) h.walk(x, y, z);
  assert.equal(h.state().ambushEscape!.checkpoint.floor, 11);
  const checkpoint = { ...h.state().checkpoint }, company = { ...h.state().ambushEscape!.checkpoint.progress };
  for (let i = 0; i < 800 && h.state().ambushEscape!.phase !== 'failed'; i++) h.frame();
  assert.equal(h.state().ambushEscape!.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(h.state().ambushEscape!.phase, 'failed'); h.command('retry');
  assert.equal(h.actor.status, 'alive'); assert.equal(h.state().step, 1); assert.equal(h.state().ambushEscape!.phase, 'descending');
  assert.deepEqual(h.actor.position, checkpoint); assert.deepEqual(h.state().ambushEscape!.progress, company);
  assert.equal(playerBlocked(h.actor.position, true, 1.1, h.sandbox.state.structures), false);
  assert.equal(h.world.agents.get('mouse')!.status, 'dead'); assert.equal(h.state().ambushEscape!.mouseDead, true);
  assert.equal(h.state().ambushEscape!.attempts, 1); assert.ok(h.state().ambush!.elapsed >= 14.8);
});

test('a pursuer stops at body contact instead of crossing the crew before capture is resolved', () => {
  const h = setup(); cat(h); h.frame(65);
  for (const [x, y, z] of descent.slice(0, 8)) h.walk(x, y, z);
  for (let frame = 0; frame < 800 && h.state().ambushEscape!.phase !== 'failed'; frame++) {
    h.frame();
    for (const threat of h.sandbox.state.threats.filter(threat => threat.ambushPursuit !== undefined))
      for (const actor of [h.actor, ...roles.map(role => h.world.agents.get(role)!)])
        if (Math.abs(threat.position.y - actor.position.y) < 3.6) assert.ok(Math.hypot(threat.position.x - actor.position.x, threat.position.z - actor.position.z) >= 2.24,
          `the pursuer crosses ${actor.id}'s body before the failure clock resolves`);
  }
  assert.equal(h.state().ambushEscape!.phase, 'failed', 'body contact still allows the pursuit to capture a stopped crew');
});

test('every new landing has rendered support and head clearance that agrees with ordinary movement', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent); parent.updateMatrixWorld(true);
  try {
    for (let floor = 0; floor < 5; floor++) for (const [x, y, z] of [[5.5, -floor * 7.4, 31.8], [5.5, -floor * 7.4 - 1.85, 23], [0, -floor * 7.4 - 3.7, 14.5], [-5.5, -floor * 7.4 - 7.4, 31.8]]) {
      const position = filmPosition(set.id, x, z); position.y += y;
      assert.equal(playerBlocked(position, true), false);
      const floorHeight = groundHeight(position, true) - set.center.y;
      const foot = new THREE.Vector3(x, floorHeight + .06, z);
      assert.ok(new THREE.Raycaster(foot, new THREE.Vector3(0, -1, 0), 0, .12).intersectObject(parent, true).length, `no floor at ${foot.toArray()}`);
      assert.equal(new THREE.Raycaster(foot, new THREE.Vector3(0, 1, 0), 0, 3.8).intersectObject(parent, true).length, 0, `a slab intersects a standing player at ${foot.toArray()}`);
    }
  } finally { renderer.dispose(); }
});
