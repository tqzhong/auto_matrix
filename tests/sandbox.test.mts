import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MISSIONS, LOCATIONS, missionPosition, playerBlocked, stepPlayer, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { CheckpointStore } from '../packages/server/src/world/CheckpointStore.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup(seed = 42) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, seed);
  const neo = world.agents.get('neo')!; neo.controller = 'player'; neo.position = { x: 1120, y: 1, z: 880 };
  sandbox.enter(neo);
  return { world, sandbox, neo, profile: sandbox.state.profiles.neo };
}

test('sandbox interactions enforce range, world, cooldown and atomic material costs', () => {
  const { sandbox, neo, profile } = setup();
  const crate = sandbox.state.nodes.find(n => n.kind === 'cache')!;
  const initial = { ...profile.inventory };
  sandbox.command(neo, { kind: 'interact', target: crate.id }, 0);
  assert.deepEqual(profile.inventory, initial, 'remote resources cannot be harvested');
  neo.position = { ...crate.position }; neo.isInMatrix = !crate.matrix;
  sandbox.command(neo, { kind: 'interact', target: crate.id }, 0);
  assert.deepEqual(profile.inventory, initial, 'cross-world interactions cannot harvest');
  neo.isInMatrix = crate.matrix;
  sandbox.command(neo, { kind: 'interact', target: crate.id }, 1);
  assert.ok(profile.inventory.code > initial.code);
  const collected = { ...profile.inventory };
  sandbox.command(neo, { kind: 'interact', target: crate.id }, 2);
  assert.deepEqual(profile.inventory, collected, 'no repeated rewards while regenerating');
  profile.inventory.code = 0;
  const before = { ...profile.inventory };
  sandbox.command(neo, { kind: 'craft', target: 'decoder' }, 3);
  assert.deepEqual(profile.inventory, before, 'failed crafting cannot consume partial resources');
  sandbox.command(neo, { kind: 'craft', target: '__proto__' }, 4);
  assert.deepEqual(profile.inventory, before);
});

test('hacking is interruptible and a shared terminal only pays one completion', () => {
  const { sandbox, world, neo, profile } = setup();
  const terminal = sandbox.state.nodes.find(n => n.kind === 'terminal')!;
  neo.position = { ...terminal.position };
  sandbox.command(neo, { kind: 'interact', target: terminal.id }, 1);
  neo.position.x += 5; sandbox.tick(2);
  assert.equal(profile.job, undefined);
  neo.position = { ...terminal.position };
  const trinity = world.agents.get('trinity')!; trinity.controller = 'player'; trinity.isInMatrix = true; trinity.position = { ...terminal.position }; sandbox.enter(trinity);
  sandbox.command(neo, { kind: 'interact', target: terminal.id }, 3);
  sandbox.command(trinity, { kind: 'interact', target: terminal.id }, 3);
  const total = profile.inventory.code + sandbox.state.profiles.trinity.inventory.code;
  sandbox.tick(13);
  assert.equal(profile.inventory.code + sandbox.state.profiles.trinity.inventory.code, total + 4);
});

test('every character keeps an independent persistent inventory and progression', () => {
  const { sandbox, world, profile } = setup();
  profile.xp = 110; profile.inventory.code = 27;
  for (const agent of world.agents.values()) {
    agent.controller = 'player'; sandbox.enter(agent);
    assert.ok(sandbox.state.profiles[agent.id]); delete agent.controller;
  }
  assert.equal(sandbox.state.profiles.neo.inventory.code, 27);
  assert.equal(sandbox.state.profiles.neo.xp, 110);
  assert.equal(sandbox.state.profiles.trinity.inventory.code, 4);
});

test('built barricades affect actual movement and shelter healing survives character switching', () => {
  const { sandbox, neo, profile } = setup();
  neo.position = { x: 1200, y: 1, z: 1200 }; neo.rotation = 0;
  sandbox.command(neo, { kind: 'build', target: 'barricade' }, 0);
  const barrier = sandbox.state.structures[0]; assert.equal(barrier.kind, 'barricade');
  let position = { ...neo.position };
  for (let i = 0; i < 60; i++) position = stepPlayer(position, 0, { x: 0, z: 1, yaw: 0, sprint: false, jump: false, sequence: i }, .05, true, sandbox.state.structures).position;
  assert.ok(position.z < barrier.position.z - 2);
  neo.position = { x: 1280, y: 1, z: 1200 };
  sandbox.command(neo, { kind: 'build', target: 'beacon' }, 1);
  neo.health = 30; profile.trace = 40; sandbox.tick(4);
  assert.ok(neo.health > 30); assert.ok(profile.trace < 40);
  sandbox.enter(neo); assert.equal(sandbox.state.structures.length, 2);
});

test('travel and story choices require a nearby valid world object', () => {
  const { sandbox, neo } = setup();
  const original = { ...neo.position };
  sandbox.command(neo, { kind: 'transit', target: 'nightclub' }, 0);
  assert.deepEqual(neo.position, original);
  neo.position = { ...sandbox.state.nodes.find(n => n.kind === 'phone' && n.matrix)!.position };
  sandbox.command(neo, { kind: 'transit', target: 'nightclub' }, 1);
  assert.equal(neo.currentLocation, 'nightclub');
  neo.position = missionPosition('rabbit');
  sandbox.command(neo, { kind: 'interact', target: 'mission:rabbit' }, 2);
  neo.position.x += 100;
  sandbox.command(neo, { kind: 'choose', target: 'rabbit:red' }, 3);
  assert.notEqual(sandbox.state.missions.rabbit.status, 'complete');
  neo.position = missionPosition('rabbit');
  sandbox.command(neo, { kind: 'choose', target: 'rabbit:blue' }, 4);
  assert.equal(sandbox.state.missions.rabbit.status, 'available');
});

test('all three films can be completed through combat, escort, crafting and consequential choices', () => {
  const { sandbox, neo, profile, world } = setup();
  sandbox.enter(world.agents.get('trinity')!);
  profile.inventory.code = 100; profile.inventory.scrap = 100;
  sandbox.command(neo, { kind: 'craft', target: 'decoder' }, 0);
  sandbox.command(neo, { kind: 'craft', target: 'emp' }, 0);
  let tick = 100;
  for (const mission of MISSIONS) {
    neo.isInMatrix = LOCATIONS[mission.location].world === 'matrix'; neo.currentLocation = mission.location;
    neo.position = missionPosition(mission.id);
    assert.equal(playerBlocked(neo.position, neo.isInMatrix), false, mission.id);
    assert.equal(sandbox.state.missions[mission.id].status, 'available', mission.id);
    sandbox.command(neo, { kind: 'interact', target: `mission:${mission.id}` }, tick);
    if (mission.mode === 'hack') { tick += 12; sandbox.tick(tick); }
    for (let attempts = 0; sandbox.state.threats.some(t => t.mission === mission.id) && attempts < 80; attempts++) {
      const threat = sandbox.state.threats.find(t => t.mission === mission.id)!;
      neo.position = { ...threat.position }; sandbox.attack(neo, tick += 2);
    }
    if (mission.mode === 'escort') {
      while (sandbox.state.missions[mission.id].status === 'active' && tick < 1500) {
        neo.position = { ...sandbox.state.missions[mission.id].escort!.position };
        sandbox.tick(++tick);
      }
    }
    if (mission.choices) {
      neo.position = missionPosition(mission.id);
      sandbox.command(neo, { kind: 'choose', target: `${mission.id}:${mission.choices[0].id}` }, ++tick);
    }
    assert.equal(sandbox.state.missions[mission.id].status, 'complete', mission.id);
    assert.equal(sandbox.state.profiles.trinity.trackedMission, profile.trackedMission, 'shared chapters advance for other character perspectives');
  }
  assert.equal(sandbox.state.ending, 'peace');
  assert.equal(sandbox.state.corruption, 0);
  assert.ok(profile.xp > 500);
  assert.ok(world.globalEvents.some(e => e.title?.includes('雨中的最后一战：完成')));
});

test('failed combat can be retried without replaying completed chapters', () => {
  const { sandbox, neo } = setup();
  sandbox.state.missions.rabbit.status = 'complete'; sandbox.state.missions.dojo.status = 'available';
  neo.position = missionPosition('dojo');
  sandbox.command(neo, { kind: 'interact', target: 'mission:dojo' }, 1);
  neo.health = 0; neo.status = 'dead'; sandbox.tick(2);
  assert.equal(sandbox.state.missions.dojo.status, 'available');
  assert.equal(sandbox.state.threats.filter(t => t.mission === 'dojo').length, 0);
  assert.equal(sandbox.state.missions.rabbit.status, 'complete');
});

test('random events and weather resume identically from a checkpoint seed', () => {
  const { sandbox, world } = setup(123);
  const saved = structuredClone(sandbox.state);
  const otherWorld = new WorldState();
  for (const agent of world.agents.values()) otherWorld.registerAgent(structuredClone(agent));
  const other = new SandboxSystem(otherWorld, { record: () => ({}) } as WorldDynamics); other.restore(saved);
  for (let tick = 1; tick < 500; tick++) { sandbox.tick(tick); other.tick(tick); }
  assert.deepEqual(sandbox.state, other.state);
  assert.ok(sandbox.state.incidents.length > 0);
  assert.notEqual(sandbox.state.seed, saved.seed);
});

test('checkpoints preserve structures, individual inventory, campaign and RNG without aliasing', async () => {
  const { sandbox, world, profile } = setup();
  profile.inventory.emp = 7; sandbox.state.missions.rabbit.status = 'complete';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-sandbox-'));
  try {
    const store = new CheckpointStore(path.join(directory, 'world.json'));
    await store.save({ version: 1, tick: 500, phase: 'phase2_awakening', agents: Object.fromEntries(world.agents), events: [], relationships: [], sandbox: sandbox.state });
    const saved = (await store.load())!.sandbox!;
    profile.inventory.emp = 0;
    sandbox.restore(saved);
    assert.equal(sandbox.state.profiles.neo.inventory.emp, 7);
    assert.equal(sandbox.state.missions.rabbit.status, 'complete');
    saved.profiles.neo.inventory.emp = 99;
    assert.equal(sandbox.state.profiles.neo.inventory.emp, 7);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
