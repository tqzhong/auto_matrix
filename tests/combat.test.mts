import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepPlayer, type SandboxThreat } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record() {} } as unknown as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0);
  const neo = world.agents.get('neo')!; neo.position = { x: 1120, y: 1, z: 960 }; neo.rotation = 0;
  players.receiveInput('player', { x: 0, z: 0, yaw: 0, sprint: false, jump: false, sequence: 1 });
  const threat: SandboxThreat = { id: 'test-enemy', kind: 'training', position: { x: 1120, y: 1, z: 962.2 },
    matrix: true, health: 120, maxHealth: 120, target: 'neo', mission: 'dojo', stunUntil: 0, lastStrike: -10 };
  sandbox.state.threats.push(threat);
  return { world, sandbox, players, neo, threat };
}

test('ordinary jump stays below half a character height with consistent airtime across frame rates', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 20]) {
    let position = { x: 1120, y: 1, z: 960 }; let vy = 0; let peak = 1; let landed = 0;
    for (let i = 0; i < 120 / dt; i++) {
      const result = stepPlayer(position, vy, { x: 0, z: 0, yaw: 0, jump: i === 0, sprint: false, sequence: i }, dt, true);
      position = result.position; vy = result.verticalVelocity; peak = Math.max(peak, position.y);
      if (i > 0 && position.y === 1) { landed = (i + 1) * dt; break; }
    }
    assert.ok(peak > 2.3 && peak < 2.9, `ordinary jump peak ${peak - 1} is excessive`);
    assert.ok(landed > .6 && landed < .8, `airtime ${landed} feels floaty`);
  }
});

test('melee cannot hit behind the player, outside reach, or through a barricade', () => {
  const { sandbox, neo, threat } = setup();
  threat.position.z = neo.position.z - 2; sandbox.attack(neo, 1);
  assert.equal(threat.health, 120, 'a target behind the player cannot be hit');
  threat.position.z = neo.position.z + 7; sandbox.attack(neo, 2);
  assert.equal(threat.health, 120, 'no remote melee damage');
  threat.position.z = neo.position.z + 2.5;
  sandbox.state.structures.push({ id: 'wall', kind: 'barricade', owner: 'neo', matrix: true, health: 90,
    position: { ...neo.position, z: neo.position.z + 1.25 } });
  sandbox.attack(neo, 3); assert.equal(threat.health, 120, 'cover blocks melee');
});

test('damage occurs on contact, once per swing; a target can escape during the windup', t => {
  let now = 10000; t.mock.method(Date, 'now', () => now);
  const { players, threat } = setup();
  players.act('player', 'attack', 0); assert.equal(threat.health, 120, 'starting a punch cannot deal immediate damage');
  players.step(.05, true, 0, now += 50); assert.equal(threat.health, 120);
  for (let i = 0; i < 5; i++) players.step(.05, true, 0, now += 50);
  assert.ok(threat.health < 120, 'the forward target is hit at the contact frame');
  const health = threat.health;
  for (let i = 0; i < 5; i++) players.step(.05, true, 0, now += 50);
  assert.equal(threat.health, health, 'one attack cannot damage the target twice');
  players.act('player', 'attack', 1); threat.position.z += 12;
  for (let i = 0; i < 10; i++) players.step(.05, true, 1, now += 50);
  assert.equal(threat.health, health, 'range is checked again at impact');
});

test('enemy windup warns before damage and stepping out of reach avoids the strike', () => {
  const { sandbox, neo, threat } = setup();
  sandbox.tick(1); assert.equal(neo.health, 100, 'enemy must telegraph its attack');
  neo.position.x += 10;
  sandbox.tick(2); assert.equal(neo.health, 100, 'leaving reach avoids the announced attack');
  neo.position = { ...threat.position, z: threat.position.z + 2 };
  sandbox.tick(8); assert.equal(neo.health, 100);
  sandbox.tick(9); assert.ok(neo.health < 100, 'ignoring the next windup permits damage');
});

test('a paused or released character cannot complete a queued attack', t => {
  let now = 10000; t.mock.method(Date, 'now', () => now);
  const { players, threat } = setup();
  players.act('player', 'attack', 0); players.step(.05, false, 0, now += 50);
  for (let i = 0; i < 10; i++) players.step(.05, true, 0, now += 50);
  assert.equal(threat.health, 120);
  players.act('player', 'attack', 1); players.release('player', 1);
  players.step(.1, true, 1, now += 100); assert.equal(threat.health, 120);
});

test('three connected attacks use distinct damage and the finisher pushes the target farther', t => {
  let now = 10000; t.mock.method(Date, 'now', () => now);
  const { sandbox, players, threat } = setup();
  const hits: { damage: number; combo: number }[] = [];
  sandbox.onImpact = hit => hits.push(hit);
  const start = threat.position.z;
  for (let combo = 0; combo < 3; combo++) {
    players.act('player', 'attack', combo);
    for (let i = 0; i < (combo === 2 ? 14 : 10); i++) players.step(.05, true, combo, now += 50);
  }
  assert.deepEqual(hits.map(hit => hit.combo), [0, 1, 2]);
  assert.deepEqual(hits.map(hit => hit.damage), [18, 23, 32]);
  assert.ok(threat.position.z - start > 1.5);
});

test('Neo force push affects nearby enemies, respects walls, and has a cooldown that survives switching', () => {
  const { players, sandbox, neo, threat } = setup(); neo.isAwakened = true;
  players.act('player', 'ability2', 10);
  assert.ok(threat.health < 120); assert.ok(threat.position.z > 965);
  const health = threat.health;
  players.release('player', 10); players.possess('player', 'neo', 10);
  players.act('player', 'ability2', 10); assert.equal(threat.health, health);
  for (let i = 0; i < 200; i++) players.step(.1, false, 10);
  assert.match(players.act('player', 'ability2', 10), /冷却/);
  for (let i = 0; i < 200; i++) players.step(.1, true, 10);
  threat.position = { ...neo.position, z: neo.position.z + 3 };
  sandbox.state.structures.push({ id: 'skill-wall', kind: 'barricade', owner: 'neo', matrix: true, health: 90,
    position: { ...neo.position, z: neo.position.z + 1.5 } });
  players.act('player', 'ability2', 11); assert.equal(threat.health, health);
});

test('Trinity dash strikes at the end of the lunge and cannot cross barricades', () => {
  const { world, players, sandbox, threat } = setup(); players.possess('player', 'trinity', 0);
  const trinity = world.agents.get('trinity')!; trinity.isInMatrix = true; trinity.position = { x: 1120, y: 1, z: 960 };
  players.receiveInput('player', { x: 0, z: 0, yaw: 0, sequence: 1 });
  threat.position.z = 967;
  players.act('player', 'ability', 0); assert.equal(threat.health, 120);
  for (let i = 0; i < 8; i++) players.step(.05, true, 0);
  assert.ok(trinity.position.z > 964); assert.ok(threat.health < 120);
  for (let i = 0; i < 200; i++) players.step(.1, true, 0);
  trinity.position = { x: 1120, y: 1, z: 960 }; threat.position.z = 967;
  sandbox.state.structures.push({ id: 'dash-wall', kind: 'barricade', owner: 'trinity', matrix: true, health: 90, position: { x: 1120, y: 1, z: 964 } });
  players.act('player', 'ability', 1);
  for (let i = 0; i < 8; i++) players.step(.05, true, 1);
  assert.ok(trinity.position.z < 963);
});

test('Morpheus counters a telegraphed blow and Smith drains health through infection', () => {
  const { world, players, sandbox, threat } = setup(); players.possess('player', 'morpheus', 0);
  const morpheus = world.agents.get('morpheus')!; morpheus.position = { x: 1120, y: 1, z: 960 }; morpheus.isInMatrix = true;
  threat.target = morpheus.id; players.act('player', 'ability2', 0);
  sandbox.tick(1); sandbox.tick(2);
  assert.equal(morpheus.health, morpheus.maxHealth); assert.ok(threat.health < 120);
  players.possess('player', 'smith', 3);
  const smith = world.agents.get('smith')!; smith.position = { x: 1120, y: 1, z: 960 }; smith.health = 100;
  players.receiveInput('player', { x: 0, z: 0, yaw: 0, sequence: 1 });
  threat.position = { ...smith.position, z: smith.position.z + 2 }; threat.target = smith.id;
  players.act('player', 'ability', 3); const health = threat.health;
  sandbox.tick(4); sandbox.tick(5);
  assert.ok(threat.health < health); assert.ok(smith.health > 100);
});

test('bullet time expires in game seconds, freezes on pause, and can overlap a second skill', () => {
  const { players } = setup();
  players.act('player', 'ability', 0); players.act('player', 'ability2', 0);
  assert.equal(players.timeScale(), .25);
  for (let i = 0; i < 100; i++) players.step(.1, false, 0);
  assert.equal(players.timeScale(), .25);
  for (let i = 0; i < 41; i++) players.step(.1, true, 0);
  assert.equal(players.timeScale(), 1);
});

test('dodge cancels a windup, briefly avoids damage and cannot be spammed or started in midair', () => {
  const { players, sandbox, neo, threat } = setup();
  players.act('player', 'attack', 0); players.act('player', 'dodge', 0);
  assert.match(players.act('player', 'dodge', 0), /冷却/);
  threat.attackAt = 1; sandbox.tick(1); assert.equal(neo.health, 100);
  for (let i = 0; i < 8; i++) players.step(.05, true, 1);
  assert.equal(threat.health, 120); assert.ok(neo.position.z < 958);
  for (let i = 0; i < 9; i++) players.step(.1, true, 1);
  neo.position.y = 3; assert.match(players.act('player', 'dodge', 1), /落地/);
});
