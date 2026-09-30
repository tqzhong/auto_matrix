import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, FILM_SCENE_BY_ID, filmEntry, filmPosition, groundHeight, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { AmbushSetRenderer } from '../packages/client/src/engine/AmbushSetRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const set = FILM_SETS.film_ambush_house;
const route = [[-5.5, 30.8], [-5.5, 14.5], [5.5, 14.5], [5.5, 31.8], [11, 31.8], [11, 8], [0, 8], [0, -8]];

test('the old-building entry is below the ambush corridor, with an ordinary walk up and down both flights', () => {
  let position = filmEntry(FILM_SCENE_BY_ID.m1_dejavu), vy = 0, velocity = { x: 0, z: 0 };
  assert.ok(position.y < set.center.y - 7, 'fresh arrival must start on the lower landing, rather than a flat corridor');
  const entry = { ...position };
  for (const [x, z] of [...route, ...route.slice(0, -1).reverse(), [-5.5, 32]]) {
    const target = filmPosition(set.id, x, z);
    for (let frame = 0; frame < 700; frame++) {
      const dx = target.x - position.x, dz = target.z - position.z, gap = Math.hypot(dx, dz);
      if (gap < .25) break;
      const result = stepPlayer(position, vy, { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), sprint: false, jump: false, sequence: frame }, .05, true, [], velocity);
      assert.ok(Math.hypot(result.position.x - position.x, result.position.y - position.y, result.position.z - position.z) < .6, 'walking cannot teleport between landings');
      position = result.position; vy = result.verticalVelocity; velocity = result.horizontalVelocity;
      assert.ok(frame < 699, `stairs blocked toward ${x}, ${z}: ${JSON.stringify(position)}`);
    }
    if (z === -8) assert.ok(Math.abs(position.y - set.center.y) < .4, 'Neo reaches the unchanged cat observation corridor');
  }
  for (let frame = 0; frame < 20; frame++) {
    const result = stepPlayer(position, vy, { x: 0, z: 0, yaw: 0, sprint: false, jump: false, sequence: frame }, .05, true, [], velocity);
    position = result.position; vy = result.verticalVelocity; velocity = result.horizontalVelocity;
  }
  assert.ok(Math.abs(position.y - entry.y) < .05, 'descending returns to the lower landing under gravity');
});

test('the cage and upper rail block walking while landings and the existing cat corridor remain open', () => {
  for (const y of [-7.4, -3.7, 0]) {
    const cage = filmPosition(set.id, 0, 23); cage.y += y;
    assert.equal(playerBlocked(cage, true), true, 'there is no walk-through elevator shaft');
  }
  assert.equal(playerBlocked(filmPosition(set.id, 8.8, 23), true), true, 'the upper floor opening has a solid visible railing');
  for (const [x, z] of [[11, 23], [0, 8], [0, -8], [-17, -16]]) assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false);
});

test('rendered stair treads support the exact physics heights, without a flat floor cutting through Neo', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent); parent.updateMatrixWorld(true);
  try {
    for (const [x, z, y] of [[-5.5, 32, -7.4], [-5.5, 28.5, -7.4 + 3.7 / 12], [-5.5, 17.5, -3.7], [0, 14.5, -3.7], [5.5, 17.5, -3.7 + 3.7 / 12], [5.5, 28.5, 0], [11, 23, 0]]) {
      const position = filmPosition(set.id, x, z); position.y += y;
      assert.ok(Math.abs(groundHeight(position, true) - position.y) < .001);
      const hits = new THREE.Raycaster(new THREE.Vector3(x, y + .06, z), new THREE.Vector3(0, -1, 0), 0, .12).intersectObject(parent, true);
      assert.ok(hits.some(hit => Math.abs(hit.point.y - y) < .001), `no rendered support at ${x}, ${y}, ${z}`);
      if (y < -.8) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, y + .1, z), new THREE.Vector3(0, 1, 0), 0, 3.5).intersectObject(parent, true).length, 0, 'the previous flat floor must not clip a climbing body');
    }
  } finally { renderer.dispose(); }
});

test('the lower stairwell has enclosing walls and a solid floor, while low stair undersides reject a standing body', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(), renderer = new AmbushSetRenderer(parent); parent.updateMatrixWorld(true);
  try {
    for (const direction of [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
      assert.ok(new THREE.Raycaster(new THREE.Vector3(-5.5, -5, 25), direction, 0, 20).intersectObject(parent, true).length, 'the lower flight cannot open onto the background sky');
    }
    assert.ok(new THREE.Raycaster(new THREE.Vector3(5.5, -36.9, 23), new THREE.Vector3(0, -1, 0), 0, .2).intersectObject(parent, true).length, 'the connected stairwell ends at a rendered eighth-floor base');
    const underLanding = filmPosition(set.id, 0, 14.5); underLanding.y -= 7.4;
    assert.equal(playerBlocked(underLanding, true), true, 'a standing body cannot enter beneath a low landing slab');
  } finally { renderer.dispose(); }
});

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('stairs-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('stairs-player', { kind: 'life', target: 'film:continue' }, 0);
  Object.assign(sandbox.life.film.state!, { scene: 'm1_dejavu', actor: 'neo', step: 0, ambush: { elapsed: 3.4 } });
  actor.currentLocation = set.id; actor.isInMatrix = true;
  return { world, sandbox, players, actor, state: () => sandbox.life.film.state! };
}

test('loading an old flat-floor save moves it out of the new shaft without losing observation progress', () => {
  const h = setup(); h.actor.position = filmPosition(set.id, 0, set.depth * .32); h.state().checkpoint = { ...h.actor.position };
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  assert.equal(playerBlocked(h.actor.position, true), false);
  assert.ok(h.actor.position.z < set.center.z + 12, 'the obsolete standing point must move to the preserved corridor');
  assert.deepEqual(h.state().checkpoint, h.actor.position);
  assert.equal(h.state().ambush?.elapsed, 3.4); assert.equal(h.state().step, 0);
});

test('a current stair save keeps its position on pause and reload, and retry uses the same supported checkpoint', () => {
  const h = setup(); h.actor.position = filmPosition(set.id, -5.5, 21.5); h.actor.position.y += -7.4 + 8 * 3.7 / 12;
  h.state().checkpoint = { ...h.actor.position }; const before = { ...h.actor.position };
  h.players.receiveInput('stairs-player', { x: 0, z: -1, yaw: Math.PI, sprint: false, jump: false, sequence: 1 });
  h.players.step(.1, false, 1); assert.deepEqual(h.actor.position, before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); assert.deepEqual(h.actor.position, before);
  assert.equal(playerBlocked(h.actor.position, true), false);
  h.actor.status = 'dead'; h.actor.health = 0;
  h.players.sandboxAction('stairs-player', { kind: 'life', target: 'film:retry' }, 2);
  assert.deepEqual(h.actor.position, before); assert.equal(h.state().scene, 'm1_dejavu');
});
