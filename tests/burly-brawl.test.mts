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

test('Smith approaches the actual stance beside the bench through the courtyard handoff', () => {
  const h = setup(), bench = FILM_SCENE_BY_ID.m2_bench;
  h.journey.scene = bench.id; h.journey.step = bench.steps.length; h.journey.completed.push(bench.id);
  const position = filmPosition(bench.set, -6.3, -15.2), yaw = .4;
  h.neo.position = position; h.neo.rotation = yaw;
  h.command('next');
  assert.equal(h.journey.scene, h.scene.id);
  assert.deepEqual(h.neo.position, position);
  assert.equal(h.neo.rotation, yaw);
  const smith = h.world.agents.get('smith')!, before = { ...smith.position };
  assert.match(h.command('act'), /Smith/);
  assert.deepEqual(h.neo.position, position);
  assert.deepEqual(smith.position, before, 'Smith starts from his visible position');
  h.advance(2.4);
  assert.equal(h.journey.burly?.phase, 'grapple');
  assert.deepEqual(h.neo.position, position);
  assert.ok(Math.abs(Math.hypot(smith.position.x - position.x, smith.position.z - position.z) - 2) < .001);
});

test('a paused grapple reconstructs both actors before and after possession', () => {
  const h = setup(); h.command('act'); h.advance(3.2);
  assert.equal(h.journey.burly?.phase, 'grapple');
  const smith = h.world.agents.get('smith')!;
  const neoPose = structuredClone(h.neo.currentAction), smithPose = structuredClone(smith.currentAction);
  const saved = structuredClone(h.sandbox.state);
  h.players.release('neo-player', h.tick());
  assert.deepEqual(h.neo.currentAction, neoPose);
  assert.deepEqual(smith.currentAction, smithPose);
  h.neo.currentAction = null; smith.currentAction = null;
  h.world.simulationTick = h.tick();
  h.sandbox.restore(saved);
  assert.deepEqual(h.neo.currentAction, neoPose);
  assert.deepEqual(smith.currentAction, smithPose);
  assert.equal(h.players.possess('neo-player', 'neo', h.tick()).agentId, 'neo');
  assert.deepEqual(h.neo.currentAction, neoPose);
  assert.deepEqual(smith.currentAction, smithPose);
  assert.deepEqual(h.sandbox.life.film.state!.burly, saved.neoLife!.journey!.burly);
  assert.match(h.players.act('neo-player', 'dodge', h.tick()), /挣脱/);
});

test('a saved grapple without faceoff coordinates keeps the original centered pose', () => {
  const h = setup(); h.command('act'); h.advance(3.2);
  const saved = structuredClone(h.sandbox.state), encounter = saved.neoLife!.journey!.burly!;
  delete encounter.faceoff;
  h.world.simulationTick = h.tick();
  h.sandbox.restore(saved);
  const smith = h.world.agents.get('smith')!;
  assert.deepEqual(h.neo.position, filmPosition(h.scene.set, 0, 0));
  assert.deepEqual(smith.position, filmPosition(h.scene.set, 0, -2));
  assert.equal(h.neo.rotation, Math.PI);
  assert.equal(smith.rotation, 0);
  assert.equal(h.sandbox.life.film.state!.burly?.elapsed, encounter.elapsed);
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
  assert.equal((h.neo.currentAction?.parameters.burly as { phase?: string } | undefined)?.phase, 'staff', 'show the held staff while the restored clock is paused');
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

test('assimilation after the staff exchange preserves the northern escape checkpoint', () => {
  const h = setup(); h.command('act');
  Object.assign(h.journey.burly!, { phase: 'flight_ready', staffSwings: 3, repelled: 4, assimilation: 99 });
  h.journey.step = 1;
  assert.equal(h.sandbox.life.film.burlyContact(h.neo, h.tick()), true);
  assert.equal(h.journey.burly?.phase, 'failed');
  const checkpoint = filmPosition(h.scene.set, 0, -28);
  assert.deepEqual(h.neo.position, checkpoint);
  assert.deepEqual(h.journey.checkpoint, checkpoint);
  assert.match(h.journey.lastText, /北侧/);
  h.players.step(.1, true, h.tick());
  const idle = structuredClone(h.neo.currentAction);
  assert.equal((idle?.parameters.burly as { phase?: string } | undefined)?.phase, 'failed');
  const saved = structuredClone(h.sandbox.state);
  h.players.release('neo-player', h.tick());
  assert.deepEqual(h.neo.currentAction, idle);
  h.sandbox.restore(saved);
  h.players.possess('neo-player', 'neo', h.tick());
  assert.deepEqual(h.neo.currentAction, idle);
  h.command('act');
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.step, 1);
  assert.equal(restored.burly?.phase, 'flight_ready');
  assert.equal(restored.burly?.staffSwings, 3);
  assert.deepEqual(h.neo.position, checkpoint);
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
