import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 82);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor, players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  players.possess('p', 'neo', 2); world.agents.get('malachi')!.health = 55;
  const state = sandbox.life.film.state!; state.scene = 'm2_room'; state.actor = 'neo'; state.step = FILM_SCENE_BY_ID.m2_room.steps.length;
  players.sandboxAction('p', { kind: 'life', target: 'film:next' }, 3);
  let tick = 3; const step = () => sandbox.tick(++tick);
  const bane = world.agents.get('bane')!, malachi = world.agents.get('malachi')!;
  const escort = () => sandbox.life.film.state?.baneCopy?.escort;
  return { world, sandbox, players, get state() { return sandbox.life.film.state!; }, bane, malachi, step, escort };
}

test('Malachi enters beside Bane with his original injury instead of already standing at the exit phone', () => {
  const h = game(); assert.equal(h.state.scene, 'm2_bane_copy'); assert.equal(h.bane.isInMatrix, true);
  assert.ok(Math.hypot(h.bane.position.x - h.malachi.position.x, h.bane.position.z - h.malachi.position.z) < 8, 'the companion must begin the escort with Bane');
  assert.equal(h.escort()?.progress, 0); assert.equal(h.malachi.status, 'alive'); assert.equal(h.malachi.health, 55);
  const health = h.malachi.health; h.step(); assert.equal(h.malachi.health, health, 'starting an escort cannot heal the injury');
});

test('running to the phone alone cannot finish the escort and returning to Malachi resumes his walk', () => {
  const h = game(), before = { ...h.malachi.position };
  h.bane.position = filmStepPosition(FILM_SCENE_BY_ID.m2_bane_copy, FILM_SCENE_BY_ID.m2_bane_copy.steps[0]);
  for (let i = 0; i < 8; i++) h.step();
  assert.equal(h.state.step, 0, 'Bane must not bypass the companion by reaching the marker alone');
  assert.deepEqual(h.malachi.position, before); assert.equal(h.escort()?.progress, 0);
  h.bane.position = { ...before, x: before.x + 5, z: before.z - 2 }; h.step();
  assert.ok(h.malachi.position.z < before.z); assert.ok(h.escort()!.progress > 0);
});

test('the accompanied route physically moves Malachi to the telephone without crossing solid footprints or changing his health', () => {
  const h = game(), start = { ...h.malachi.position }, health = h.malachi.health;
  assert.equal(h.escort()?.progress, 0, 'a fresh escort needs saved route progress');
  for (let i = 0; i < 100 && h.malachi.position.z > filmPosition('film_industrial_loft', -5, -28).z + .01; i++) {
    h.bane.position = { ...h.malachi.position, x: h.malachi.position.x + 5, z: h.malachi.position.z - 2 };
    const before = { ...h.malachi.position }; h.step();
    assert.ok(Math.hypot(h.malachi.position.x - before.x, h.malachi.position.z - before.z) <= 1.56, 'the injured walk cannot teleport between ticks');
    assert.equal(playerBlocked(h.malachi.position, true, .7, h.sandbox.state.structures), false);
    assert.equal(h.malachi.health, health);
  }
  assert.ok(start.z - h.malachi.position.z > 55, 'the actual companion must cross the loft');
  assert.ok(Math.abs(h.malachi.position.z - filmPosition('film_industrial_loft', -5, -28).z) < .01);
  h.bane.position = filmStepPosition(FILM_SCENE_BY_ID.m2_bane_copy, FILM_SCENE_BY_ID.m2_bane_copy.steps[0]); h.step();
  assert.equal(h.state.step, 1); assert.equal(h.malachi.isInMatrix, true, 'arrival does not skip the separate disk and exit interaction');
});

test('an escort pause and sandbox restoration preserve the full companion state and saved route progress', () => {
  const h = game(); assert.equal(h.escort()?.progress, 0);
  for (let i = 0; i < 8; i++) { h.bane.position = { ...h.malachi.position, x: h.malachi.position.x + 5, z: h.malachi.position.z - 2 }; h.step(); }
  const before = JSON.stringify(h.malachi), route = JSON.stringify(h.escort()), saved = structuredClone(h.sandbox.state);
  h.players.step(.1, false, h.world.simulationTick); assert.equal(JSON.stringify(h.malachi), before, 'pausing cannot move or rewrite the companion');
  h.sandbox.restore(saved); assert.equal(JSON.stringify(h.malachi), before); assert.equal(JSON.stringify(h.escort()), route);
  const z = h.malachi.position.z; h.step(); assert.ok(h.malachi.position.z < z, 'resuming continues the same walk');
});

test('a controlled or dead Malachi is never moved, revived or silently counted as escorted', () => {
  for (const mode of ['controlled', 'dead']) {
    const h = game(); if (mode === 'controlled') h.malachi.controller = 'another-player'; else { h.malachi.status = 'dead'; h.malachi.health = 0; }
    const before = JSON.stringify(h.malachi); h.bane.position = filmStepPosition(FILM_SCENE_BY_ID.m2_bane_copy, FILM_SCENE_BY_ID.m2_bane_copy.steps[0]);
    h.step(); assert.equal(h.state.step, 0, mode); assert.equal(JSON.stringify(h.malachi), before, mode);
  }
});

test('a legacy save with Malachi already at the phone continues without moving him back to the entrance', () => {
  const h = game(); h.malachi.position = filmPosition('film_industrial_loft', -5, -28); delete h.state.baneCopy!.escort;
  const before = JSON.stringify(h.malachi); h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(JSON.stringify(h.malachi), before);
  h.bane.position = filmStepPosition(FILM_SCENE_BY_ID.m2_bane_copy, FILM_SCENE_BY_ID.m2_bane_copy.steps[0]); h.step();
  assert.equal(h.state.step, 1); assert.deepEqual(h.malachi.position, JSON.parse(before).position); assert.equal(h.malachi.health, 55);
});
