import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBUSH_DOFF, FILM_SETS, FILM_SCENE_BY_ID, filmPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const set = FILM_SETS.film_ambush_house;
const roles = ['morpheus', 'trinity', 'switch', 'apoc', 'cypher'] as const;
const descent = Array.from({ length: 5 }, (_, floor) => {
  const y = -floor * 7.4;
  return [[5.5, y, 31.8], [5.5, y - 3.7, 14.5], [-5.5, y - 3.7, 14.5], [-5.5, y - 7.4, 31.8]];
}).flat();
const dynamics = (world: WorldState) => ({ record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) }) as WorldDynamics;

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, dynamics(world), 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics(world), sandbox);
  players.possess('call-player', 'neo', 0); const actor = world.agents.get('neo')!;
  sandbox.life.begin(actor, 0); sandbox.state.neoLife!.chapter = 1;
  let tick = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('call-player', { kind: 'life', target: `film:${target}` }, ++tick);
  command('continue');
  Object.assign(sandbox.life.film.state!, { scene: 'm1_oracle', actor: 'neo', step: FILM_SCENE_BY_ID.m1_oracle.steps.length }); command('next');
  const state = () => sandbox.life.film.state!;
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) players.step(.1, running, ++tick); };
  const move = (x: number, z: number) => {
    players.receiveInput('call-player', { x, z, yaw: Math.atan2(x, z), jump: false, sprint: true, sequence: ++sequence }); frame();
  };
  const walk = (x: number, y: number, z: number) => {
    const target = filmPosition(set.id, x, z); target.y += y;
    for (let i = 0; i < 650; i++) {
      const dx = target.x - actor.position.x, dz = target.z - actor.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3 && Math.abs(actor.position.y - target.y) < .15) { move(0, 0); return; }
      assert.equal(actor.status, 'alive', 'ordinary call access cannot require reviving Neo');
      move(dx / Math.max(.01, gap), dz / Math.max(.01, gap));
    }
    assert.fail(`ordinary input cannot reach ${x},${y},${z}: ${JSON.stringify(actor.position)}`);
  };
  const alarm = () => {
    for (const [x, y, z] of [[-5.5, -7.4, 30.8], [-5.5, -3.7, 14.5], [5.5, -3.7, 14.5], [5.5, 0, 31.8], [11, 0, 31.8]]) walk(x, y, z);
    for (let i = 0; i < 500 && !state().ambushApproach!.ready; i++) frame();
    assert.equal(state().ambushApproach!.ready, true); command('act'); frame(150);
    assert.equal(state().ambushEscape!.phase, 'alarm');
  };
  const phone = () => {
    alarm(); frame(65);
    for (const [x, y, z] of descent) walk(x, y, z);
    for (const [x, z] of [[-11, 31.8], [-11, 8], [0, 8], [0, -16], [-18, -16]]) walk(x, -37, z);
    for (let i = 0; i < 200 && state().ambushEscape!.phase === 'descending'; i++) frame();
    assert.equal(state().ambushEscape!.phase, 'window'); command('act');
    assert.equal(state().ambushEscape!.phase, 'phone');
    for (const [x, z] of [[-18, -13.2], [-5.4, -13.2]]) walk(x, -37, z);
  };
  return { world, sandbox, players, actor, state, command, frame, walk, alarm, phone, tick: () => tick };
}

function presentation(world: WorldState) {
  return roles.map(id => {
    const actor = world.agents.get(id)!;
    return { id, position: { ...actor.position }, rotation: actor.rotation, velocity: { ...actor.velocity }, parameters: structuredClone(actor.currentAction?.parameters) };
  });
}

function cold(h: ReturnType<typeof setup>) {
  const saved = JSON.parse(JSON.stringify({ agents: Object.fromEntries(h.world.agents), sandbox: h.sandbox.state }));
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  for (const [id, actor] of Object.entries(saved.agents)) { Object.assign(world.agents.get(id)!, actor); delete world.agents.get(id)!.controller; }
  world.simulationTick = h.tick();
  const sandbox = new SandboxSystem(world, dynamics(world), 42); sandbox.restore(saved.sandbox);
  return { world, sandbox, state: sandbox.life.film.state! };
}

function startDoff() {
  const h = setup(); h.phone();
  h.state().ambushEscape!.doffPerformance = true;
  const morpheus = h.world.agents.get('morpheus')!;
  const origin = { elapsed: 0, progress: h.state().ambushEscape!.progress.morpheus, yaw: morpheus.rotation };
  h.command('act');
  return { ...h, origin };
}
function leaveSpace(h: ReturnType<typeof startDoff>) { h.walk(-5.4, -37, -10.6); }

test('ordinary G starts the saved coat removal before exposing or tracing the phone', () => {
  const h = startDoff(), escape = h.state().ambushEscape!;
  assert.equal(escape.phase, 'phone', 'the new physical removal must precede the original call clock');
  assert.deepEqual(escape.doff, h.origin);
  assert.equal(escape.callStart, undefined); assert.equal(escape.traced, false);
  const morpheus = h.world.agents.get('morpheus')!;
  assert.deepEqual(morpheus.currentAction!.parameters.ambushDoff, escape.doff);
  assert.equal(morpheus.currentAction!.parameters.armed, false);
  assert.equal(morpheus.currentAction!.parameters.ambushCall, undefined);
  h.command('act'); assert.deepEqual(escape.doff, h.origin, 'repeated G cannot restart the removal');
  leaveSpace(h); h.frame(5);
  assert.ok(escape.doff!.elapsed > 0 && escape.doff!.elapsed < AMBUSH_DOFF.duration);
  assert.equal(escape.progress.morpheus, h.origin.progress);
  assert.equal(morpheus.rotation, h.origin.yaw, 'Neo moving around cannot rotate a body inside its sleeves');
});

test('finishing the coat removal saves the shirt checkpoint then starts the unchanged call at zero', () => {
  const h = startDoff(); leaveSpace(h);
  const escape = h.state().ambushEscape!;
  for (let i = 0; i < 150 && escape.phase === 'phone'; i++) h.frame();
  assert.equal(escape.phase, 'call'); assert.equal(escape.elapsed, 0);
  assert.equal(escape.doff!.elapsed, AMBUSH_DOFF.duration);
  assert.equal(escape.checkpoint.phase, 'phone');
  assert.deepEqual(escape.checkpoint.doff, escape.doff);
  assert.notEqual(escape.checkpoint.doff, escape.doff, 'checkpoint owns its saved value');
  assert.ok(escape.callStart); assert.equal(escape.traced, false);
  h.frame(37); assert.equal(escape.traced, false);
  h.frame(); assert.equal(escape.traced, true, 'the existing call still traces at its own 3.8 seconds');
  h.frame(64); assert.equal(escape.phase, 'forming'); assert.equal(h.state().step, 2);
  assert.equal(escape.mouseDead, true); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('nonzero removal clocks survive pause, disconnect and independent cold reconstruction', () => {
  const h = startDoff(); leaveSpace(h);
  for (const time of [.6, 2.8, 4.9, 7.6]) {
    for (let i = 0; i < 150 && (h.state().ambushEscape!.doff?.elapsed ?? 0) < time - 1e-8; i++) h.frame();
    const escape = structuredClone(h.state().ambushEscape), actors = presentation(h.world);
    assert.equal(escape!.phase, 'phone'); assert.ok((escape!.doff?.elapsed ?? 0) >= time - 1e-8);
    h.frame(4, false); assert.deepEqual(h.state().ambushEscape, escape); assert.deepEqual(presentation(h.world), actors);
    const restored = cold(h); assert.deepEqual(restored.state.ambushEscape, escape);
    assert.deepEqual(presentation(restored.world), actors, 'a fresh server must rebuild the same saved actor gestures');
  }
  const saved = structuredClone(h.state().ambushEscape), actors = presentation(h.world);
  h.players.release('call-player', h.tick()); h.frame(5);
  assert.deepEqual(h.state().ambushEscape, saved); assert.deepEqual(presentation(h.world), actors);
});

test('Morpheus cannot be possessed midway through his sleeves but is released after removal', () => {
  const h = startDoff(); leaveSpace(h); h.frame(8);
  const escape = h.state().ambushEscape!, saved = structuredClone(escape.doff);
  const result = h.players.possess('doff-other', 'morpheus', h.tick());
  assert.equal(result.agentId, undefined); assert.match(result.error ?? '', /外套|脱衣|脱袖/);
  assert.deepEqual(escape.doff, saved); assert.equal(h.world.agents.get('morpheus')!.controller, undefined);
  for (let i = 0; i < 150 && escape.phase === 'phone'; i++) h.frame();
  assert.equal(escape.phase, 'call');
  assert.equal(h.players.possess('doff-other', 'morpheus', h.tick()).agentId, 'morpheus');
});

test('retry restores an unfinished coat to its earlier checkpoint and retains a completed removal', () => {
  const h = startDoff(); leaveSpace(h); h.frame(12);
  const escape = h.state().ambushEscape!;
  assert.ok(escape.doff && escape.doff.elapsed > 0 && escape.doff.elapsed < AMBUSH_DOFF.duration);
  h.command('retry');
  assert.equal(escape.phase, 'phone'); assert.equal(escape.doff, undefined);
  assert.equal(escape.doffPerformance, true); assert.equal(escape.mouseDead, true);
  for (const [x, z] of [[-18, -13.2], [-5.4, -13.2]]) h.walk(x, -37, z);
  h.command('act'); leaveSpace(h);
  for (let i = 0; i < 150 && escape.phase === 'phone'; i++) h.frame();
  assert.equal(escape.phase, 'call');
  const finished = structuredClone(escape.doff), actors = presentation(h.world);
  h.frame(5, false); assert.deepEqual(presentation(h.world), actors);
  h.command('retry');
  assert.equal(escape.phase, 'phone'); assert.deepEqual(escape.doff, finished);
  assert.equal(escape.callStart, undefined); assert.equal(escape.traced, false);
  for (const [x, z] of [[-5.4, -13.2]]) h.walk(x, -37, z);
  h.command('act'); assert.equal(escape.phase, 'call'); assert.equal(escape.elapsed, 0);
  assert.deepEqual(escape.doff, finished, 'a completed removal must not play again after a call failure');
});

test('a real pursuer can interrupt removal and retry restores the earlier clothed checkpoint', () => {
  const h = setup(); h.phone();
  const escape = h.state().ambushEscape!; escape.doffPerformance = true;
  for (let i = 0; i < 1600 && escape.caught === 0 && escape.phase !== 'failed'; i++) h.frame();
  assert.equal(h.actor.status, 'alive'); assert.ok(escape.caught > 0, 'an approaching pursuer must actually reach the stopped crew');
  const checkpoint = structuredClone(escape.checkpoint);
  h.command('act'); assert.equal(escape.phase, 'phone'); assert.equal(escape.doff!.elapsed, 0);
  for (let i = 0; i < 20 && escape.phase !== 'failed'; i++) h.frame();
  assert.equal(escape.phase, 'failed'); assert.equal(h.actor.status, 'dead'); assert.equal(h.actor.health, 0);
  assert.ok(escape.doff!.elapsed > 0 && escape.doff!.elapsed < AMBUSH_DOFF.duration);
  const failed = structuredClone(escape);
  h.frame(3); assert.deepEqual(escape, failed, 'death cannot silently finish the removal');
  const restored = cold(h); assert.deepEqual(restored.state.ambushEscape, failed);
  assert.equal(restored.world.agents.get('neo')!.status, 'dead');
  h.command('retry');
  assert.equal(h.actor.status, 'alive'); assert.equal(h.actor.health, h.actor.maxHealth);
  assert.equal(escape.phase, checkpoint.phase); assert.deepEqual(escape.progress, checkpoint.progress);
  assert.equal(escape.doff, undefined); assert.equal(escape.callStart, undefined); assert.equal(escape.traced, false);
  assert.equal(escape.mouseDead, true); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});

test('a real pursuit failure after removal keeps the placed-coat clock through death, cold load and retry', () => {
  const h = startDoff(); leaveSpace(h);
  const escape = h.state().ambushEscape!;
  for (let i = 0; i < 150 && escape.phase === 'phone'; i++) h.frame();
  assert.equal(escape.phase, 'call');
  const finished = structuredClone(escape.doff);
  for (let i = 0; i < 1600 && escape.phase !== 'failed'; i++) h.frame();
  assert.equal(escape.phase, 'failed'); assert.equal(h.actor.status, 'dead');
  assert.deepEqual(escape.doff, finished);
  const restored = cold(h); assert.deepEqual(restored.state.ambushEscape, escape);
  const checkpoint = structuredClone(escape.checkpoint);
  assert.deepEqual(checkpoint.doff, finished);
  h.command('retry');
  assert.equal(h.actor.status, 'alive'); assert.equal(escape.phase, checkpoint.phase);
  assert.deepEqual(escape.doff, finished); assert.deepEqual(escape.progress, checkpoint.progress);
  assert.equal(escape.mouseDead, true); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  const retry = cold(h); assert.deepEqual(retry.state.ambushEscape!.doff, finished);
});
