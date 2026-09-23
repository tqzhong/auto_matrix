import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (_event: Omit<WorldEvent, 'id'>) => undefined } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('neo-player', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('neo-player', { kind: 'life', target: 'film:continue' }, 1);
  const scene = FILM_SCENE_BY_ID.m2_burly; const journey = sandbox.life.film.state!; const neo = world.agents.get('neo')!;
  Object.assign(journey, { scene: scene.id, actor: 'neo', step: 0, burly: undefined, fighting: undefined, checkpoint: filmStepPosition(scene, scene.steps[0]) });
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.isAwakened = true; neo.position = filmStepPosition(scene, scene.steps[0]);
  let tick = 2;
  const command = (target: string) => players.sandboxAction('neo-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (seconds = .1) => {
    for (let frame = 0; frame < Math.ceil(seconds * 10); frame++) {
      if (frame % 5 === 0) sandbox.tick(++tick);
      players.step(.1, true, tick);
    }
  };
  return { sandbox, world, players, neo, journey, scene, command, advance, tick: () => tick };
}

test('Smith grapple needs an intentional escape; clearing copies alone cannot finish the courtyard', () => {
  const h = setup();
  assert.match(h.command('act'), /Smith|复制/);
  h.advance(2.5);
  assert.equal(h.journey.burly?.phase, 'grapple');
  assert.match(h.command('next'), /先完成/);
  assert.match(h.players.act('neo-player', 'dodge', h.tick()), /挣脱|同化/);
  assert.equal(h.journey.burly?.phase, 'swarm');
  assert.ok(h.sandbox.state.threats.filter(t => t.scene === h.scene.id).length >= 3);
  h.sandbox.state.threats = [];
  h.advance(3);
  assert.equal(h.journey.step, 0);
  assert.ok(h.sandbox.state.threats.some(t => t.scene === h.scene.id), 'copies spread into the cleared space');
});

test('staff swings create a flight opening, and the escape survives save/retry without skipping it', () => {
  const h = setup(); h.command('act'); h.advance(2.5); h.players.act('neo-player', 'dodge', h.tick());
  const strike = () => {
    const threat = h.sandbox.state.threats.find(t => t.scene === h.scene.id)!;
    threat.position = { ...h.neo.position, z: h.neo.position.z - 2 };
    h.neo.rotation = Math.PI;
    h.sandbox.attack(h.neo, h.tick(), 2);
  };
  for (let i = 0; i < 8 && h.journey.burly?.phase !== 'staff_ready'; i++) strike();
  assert.equal(h.journey.burly?.phase, 'staff_ready');
  h.neo.position = filmPosition(h.scene.set, 12, -13);
  assert.match(h.command('act'), /栏杆|长杆/);
  assert.equal(h.journey.burly?.phase, 'staff');
  const saved = JSON.parse(JSON.stringify(h.sandbox.state)); h.sandbox.restore(saved);
  assert.equal(h.sandbox.life.film.state!.burly?.phase, 'staff');
  h.neo.position = filmPosition(h.scene.set, 0, 0);
  for (let i = 0; i < 5 && h.sandbox.life.film.state!.step === 0; i++) { h.advance(.5); strike(); }
  assert.equal(h.sandbox.life.film.state!.step, 1);
  h.neo.position = filmStepPosition(h.scene, h.scene.steps[1]);
  assert.match(h.command('act'), /向上|脱离/);
  assert.equal(h.sandbox.life.film.state!.burly?.phase, 'flight');
  const before = h.neo.position.y;
  for (let i = 0; i < 8; i++) h.players.step(.1, true, h.tick());
  assert.ok(h.neo.position.y > before, 'Neo physically rises before leaving');
  assert.ok(h.neo.position.y > before + 20, 'Neo clears the courtyard wall before the camera reaches it');
  h.command('retry');
  assert.equal(h.sandbox.life.film.state!.step, 1, 'the completed staff exchange remains saved');
  h.neo.position = filmStepPosition(h.scene, h.scene.steps[1]);
  h.command('act'); h.advance(3);
  assert.equal(h.sandbox.life.film.state!.scene, 'm2_merovingian', 'the completed flight cuts to the next location');
});

test('a staff swing against another encounter does not advance Smith escape', () => {
  const h = setup(); h.command('act'); h.advance(2.5); h.players.act('neo-player', 'dodge', h.tick());
  h.journey.burly!.phase = 'staff';
  for (const threat of h.sandbox.state.threats) {
    threat.scene = 'm1_lobby'; threat.position = { ...h.neo.position, z: h.neo.position.z - 2 };
  }
  h.neo.rotation = Math.PI;
  h.sandbox.attack(h.neo, h.tick(), 2);
  assert.equal(h.journey.burly!.staffSwings, 0);
});

test('missed grapple resets the encounter without killing Neo', () => {
  const h = setup(); h.command('act'); h.advance(9);
  assert.equal(h.journey.burly?.phase, 'failed');
  assert.equal(h.neo.status, 'alive');
  assert.equal(h.neo.health, h.neo.maxHealth);
  h.command('act');
  assert.equal(h.journey.burly?.phase, 'ready');
  h.neo.position = filmStepPosition(h.scene, h.scene.steps[0]);
  h.command('act');
  assert.equal(h.journey.burly?.phase, 'approaching');
});

test('the first volley of Smith copies leaves Neo time to break the encirclement', () => {
  const h = setup(); h.command('act'); h.advance(2.5); h.players.act('neo-player', 'dodge', h.tick());
  for (let i = 0; i < 4; i++) h.sandbox.life.film.burlyContact(h.neo, h.tick());
  assert.equal(h.journey.burly?.phase, 'swarm');
  assert.equal(h.journey.burly?.assimilation, 48);
});

test('failed assimilation clears the pending volley before another copy can kill Neo', () => {
  const h = setup(); h.command('act'); h.advance(2.5); h.players.act('neo-player', 'dodge', h.tick());
  h.journey.burly!.assimilation = 95;
  const tick = h.tick() + 1;
  for (const [index, threat] of h.sandbox.state.threats.entries()) {
    threat.position = index ? filmPosition(h.scene.set, 0, 10) : { ...h.neo.position, z: h.neo.position.z - 2 };
    threat.attackAt = tick; threat.stunUntil = 0;
  }
  h.sandbox.tick(tick);
  assert.equal(h.journey.burly?.phase, 'failed');
  assert.equal(h.neo.status, 'alive');
  assert.equal(h.neo.health, h.neo.maxHealth);
});
