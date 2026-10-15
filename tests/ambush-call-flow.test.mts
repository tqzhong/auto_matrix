import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, FILM_SCENE_BY_ID, filmPosition, distance, groundHeight, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
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

test('fresh alarm selects the call performance while an already started old alarm stays on its original version', () => {
  const h = setup(); h.alarm();
  assert.equal(h.state().ambushEscape!.callPerformance, true, 'new physical escapes must opt into the phone handoff');
  assert.equal(h.state().ambushEscape!.callStart, undefined, 'the later handoff cannot start during the alarm');
  h.frame(12); delete h.state().ambushEscape!.callPerformance;
  const saved = structuredClone(h.state().ambushEscape), actors = presentation(h.world);
  const restored = cold(h);
  assert.deepEqual(restored.state.ambushEscape, saved, 'loading an already started old alarm must not add a new version');
  assert.deepEqual(presentation(restored.world), actors);
});

test('ordinary G begins a saved Trinity approach, hands off once and connects before tracing and forming', () => {
  const h = setup(); h.phone();
  const escape = h.state().ambushEscape!, trinity = h.world.agents.get('trinity')!, morpheus = h.world.agents.get('morpheus')!;
  const start = { trinityProgress: escape.progress.trinity, trinityYaw: trinity.rotation, morpheusYaw: morpheus.rotation };
  h.command('act');
  assert.equal(escape.phase, 'call'); assert.deepEqual(escape.callStart, start);
  assert.equal(escape.traced, false, 'pressing G before the phone reaches an ear must not immediately trace the call');
  let previous = presentation(h.world);
  for (let frame = 1; frame <= 100; frame++) {
    h.frame(); assert.equal(escape.phase, 'call', 'the handoff and listening must not be cut off at the old 5.5-second deadline');
    assert.equal(escape.traced, frame >= 38, `tracing must begin at saved clock 3.8, frame ${frame}`);
    assert.equal(h.actor.status, 'alive');
    for (const role of ['morpheus', 'trinity'] as const) {
      const actor = h.world.agents.get(role)!, gesture = actor.currentAction!.parameters.ambushCall as { role: string; elapsed: number; ready?: boolean };
      assert.equal(gesture?.role, role);
      assert.ok(Math.abs(gesture.elapsed - (escape.elapsed < 1.6 ? escape.elapsed : Math.min(7, escape.elapsed - 1.6))) < 1e-8);
      assert.equal(gesture.ready, escape.elapsed < 1.6 ? true : undefined);
      assert.equal(actor.currentAction!.parameters.phone, undefined, 'the office connected pose must not overwrite the handoff');
      assert.equal(actor.currentAction!.parameters.armed, false, 'a phone participant cannot keep a gun in the same hand');
      assert.equal(playerBlocked(actor.position, true, 1.1, h.sandbox.state.structures), false);
      assert.ok(Math.abs(actor.position.y - groundHeight(actor.position, true)) < 1e-8);
      assert.ok(distance(actor.position, previous.find(item => item.id === role)!.position) < .3, 'approaching must be continuous');
    }
    previous = presentation(h.world);
    if (frame === 16) {
      assert.ok(Math.abs(escape.progress.trinity - start.trinityProgress - 1.65) < 1e-8);
      assert.ok(Math.abs(trinity.rotation + Math.PI / 2) < 1e-8); assert.ok(Math.abs(morpheus.rotation - Math.PI / 2) < 1e-8);
    }
  }
  h.frame(2); assert.equal(escape.phase, 'forming'); assert.equal(h.state().step, 2);
  assert.deepEqual(morpheus.currentAction!.parameters.ambushCall, { role: 'morpheus', elapsed: 7 });
  assert.equal(trinity.currentAction!.parameters.ambushCall, undefined);
  assert.equal(escape.mouseDead, true); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  assert.ok(escape.progress.trinity >= start.trinityProgress + 1.65, 'forming cannot rewind the approach');
});

test('Neo blocking the handoff approach pauses preparation without pausing the approaching pursuers', () => {
  const h = setup(); h.phone(); h.walk(-3.5, -37, -14); h.command('act'); h.frame(20);
  const escape = h.state().ambushEscape!, elapsed = escape.elapsed;
  assert.equal(escape.phase, 'call'); assert.ok(elapsed < 1.6, 'the actor cannot walk through Neo to complete the approach');
  const cast = presentation(h.world), pursuit = escape.pursuers.map(item => item.progress);
  h.frame(5); assert.equal(escape.elapsed, elapsed, 'the blocked preparation clock must stay frozen');
  assert.deepEqual(presentation(h.world), cast);
  assert.ok(escape.pursuers.some((item, index) => item.progress > pursuit[index]), 'the player cannot freeze pursuit by blocking the phone handoff');
  h.walk(-5.4, -37, -13.2); h.frame(20);
  assert.ok(escape.elapsed > elapsed && escape.elapsed >= 1.6, 'clearing the path resumes the saved approach');
});

test('Morpheus turns toward the departure route continuously before the first forming frame', () => {
  const h = setup(); h.phone(); h.command('act'); h.frame(85);
  const morpheus = h.world.agents.get('morpheus')!;
  let previous = morpheus.rotation;
  for (let frame = 86; frame <= 103; frame++) {
    const before = h.state().ambushEscape!.phase; h.frame();
    const change = Math.abs(Math.atan2(Math.sin(morpheus.rotation - previous), Math.cos(morpheus.rotation - previous)));
    assert.ok(change < .4, `Morpheus snaps ${change} radians at ${frame / 10}s (${before} → ${h.state().ambushEscape!.phase})`);
    const held = morpheus.currentAction!.parameters.ambushCall as { role: string; elapsed: number };
    assert.equal(held?.role, 'morpheus'); assert.ok(Math.abs(held.elapsed - 7) < 1e-8, 'the phone stays at his ear while turning');
    previous = morpheus.rotation;
  }
  assert.equal(h.state().ambushEscape!.phase, 'forming');
});

test('nonzero-delta approach, handoff and listening preserve pause and fresh reconstruction', () => {
  const h = setup(); h.phone(); h.command('act');
  for (const clock of [.6, 1.2, 2.7, 4, 9.5]) {
    for (let i = 0; i < 200 && h.state().ambushEscape!.elapsed < clock - 1e-8; i++) h.frame();
    assert.equal(h.state().ambushEscape!.phase, 'call');
    assert.ok(Math.abs(h.state().ambushEscape!.elapsed - clock) < 1e-8, 'the preparation must progress through the saved performance clock');
    const escape = structuredClone(h.state().ambushEscape), actors = presentation(h.world);
    assert.ok(actors.some(actor => actor.parameters?.ambushCall), 'the fixture must render the new performance, not the old connected pose');
    h.frame(5, false); assert.deepEqual(h.state().ambushEscape, escape); assert.deepEqual(presentation(h.world), actors);
    const restored = cold(h);
    assert.deepEqual(restored.state.ambushEscape, escape); assert.deepEqual(presentation(restored.world), actors);
    restored.sandbox.life.film.restoreAmbushSpace(); assert.deepEqual(presentation(restored.world), actors, 'another paused restore must be idempotent');
  }
});

test('occupation, disconnect and retry retain the selected call version without resurrecting Mouse', () => {
  const h = setup(); h.phone(); h.command('act'); h.frame(28);
  const escape = h.state().ambushEscape!, elapsed = escape.elapsed, progress = { ...escape.progress };
  assert.ok(escape.callStart); h.players.possess('call-companion', 'trinity', h.tick()); h.frame(5);
  assert.equal(escape.elapsed, elapsed); assert.equal(escape.paused, true);
  h.players.release('call-companion', h.tick()); h.frame(1, false);
  h.players.release('call-player', h.tick()); h.frame(5);
  assert.equal(escape.elapsed, elapsed); assert.deepEqual(escape.progress, progress);
  const restored = cold(h); assert.equal(restored.state.ambushEscape!.elapsed, elapsed);
  h.players.possess('call-player', 'neo', h.tick()); h.command('retry');
  assert.equal(escape.phase, 'phone'); assert.equal(escape.elapsed, 0); assert.equal(escape.callPerformance, true);
  assert.equal(escape.callStart, undefined, 'retry must clear the previous origin before the next ordinary G');
  assert.equal(escape.mouseDead, true); assert.equal(h.world.agents.get('mouse')!.status, 'dead');
  for (const [x, z] of [[-18, -13.2], [-5.4, -13.2]]) h.walk(x, -37, z);
  h.command('act'); assert.equal(escape.phase, 'call'); assert.ok(escape.callStart);
  assert.equal(escape.callStart!.trinityProgress, escape.checkpoint.progress.trinity);
});

test('a saved legacy call keeps its 5.5-second connected pose, trace and checkpoint semantics', () => {
  const h = setup(); h.phone(); delete h.state().ambushEscape!.callPerformance; h.command('act'); h.frame(20);
  const escape = h.state().ambushEscape!;
  assert.equal(escape.traced, true); assert.equal(escape.callStart, undefined);
  assert.equal(h.world.agents.get('morpheus')!.currentAction!.parameters.ambushCall, undefined);
  assert.deepEqual(h.world.agents.get('morpheus')!.currentAction!.parameters.phone, { phase: 'connected', elapsed: escape.elapsed });
  const restored = cold(h); assert.deepEqual(restored.state.ambushEscape, escape); assert.deepEqual(presentation(restored.world), presentation(h.world));
  h.frame(36); assert.equal(escape.phase, 'forming'); assert.equal(h.state().step, 2);
  assert.equal(h.world.agents.get('morpheus')!.currentAction!.parameters.phone, undefined);
  for (let i = 0; i < 180 && escape.phase === 'forming'; i++) h.frame();
  assert.equal(escape.phase, 'wetwall');
  for (const [x, z] of [[-18, -13.2], [-18, -27]]) h.walk(x, -37, z);
  for (let i = 0; i < 180 && escape.phase !== 'done'; i++) h.frame();
  assert.equal(escape.phase, 'done'); h.command('next'); assert.equal(h.state().scene, 'm1_wetwall');
  assert.equal(h.world.agents.get('morpheus')!.currentAction!.parameters.ambushCall, undefined, 'an old wetwall entry must not invent a held phone');
  assert.deepEqual(presentation(cold(h).world), presentation(h.world));
});

test('Morpheus keeps the call through the walk and next node, then stows continuously when Neo starts breaking the wall', () => {
  const h = setup(); h.phone(); h.command('act'); h.frame(102);
  const held = () => h.world.agents.get('morpheus')!.currentAction!.parameters.ambushCall;
  assert.equal(h.state().ambushEscape!.phase, 'forming');
  for (let i = 0; i < 180 && h.state().ambushEscape!.phase === 'forming'; i++) {
    assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 }); h.frame();
  }
  assert.equal(h.state().ambushEscape!.phase, 'wetwall');
  for (const [x, z] of [[-18, -13.2], [-18, -27]]) { h.walk(x, -37, z); assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 }); }
  for (let i = 0; i < 180 && h.state().ambushEscape!.phase !== 'done'; i++) h.frame();
  assert.equal(h.state().ambushEscape!.phase, 'done'); assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 });
  h.command('next'); assert.equal(h.state().scene, 'm1_wetwall'); assert.equal(h.state().wetwall!.phase, 'sealed');
  assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 });
  const sealed = cold(h); assert.deepEqual(presentation(sealed.world), presentation(h.world));
  h.frame(8); assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 }, 'waiting for Neo must not silently end the call');
  h.walk(-18, -37, -28.4); h.command('act'); assert.equal(h.state().wetwall!.phase, 'breaking');
  for (const count of [6, 6]) {
    h.frame(count); const elapsed = h.state().wetwall!.elapsed;
    assert.deepEqual(held(), { role: 'morpheus', elapsed: 7 + elapsed });
    const actors = presentation(h.world); h.frame(5, false); assert.deepEqual(presentation(h.world), actors);
    const neo = structuredClone(h.actor.currentAction!.parameters);
    h.players.release('call-player', h.tick());
    assert.deepEqual(h.actor.currentAction?.parameters, neo, 'disconnect must retain the saved wall-breaking pose instead of clearing it until a cold load');
    const restored = cold(h); assert.equal(restored.state.wetwall!.elapsed, elapsed); assert.deepEqual(presentation(restored.world), actors);
    assert.deepEqual(restored.world.agents.get('neo')!.currentAction?.parameters, neo);
    h.players.possess('call-player', 'neo', h.tick());
  }
  h.frame(5); assert.equal(held(), undefined, 'the completed 1.5-second stow must release the hand before climbing');
  assert.equal(h.world.agents.get('mouse')!.status, 'dead');
});
