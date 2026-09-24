import assert from 'node:assert/strict';
import test from 'node:test';
import { APU_ROUTE, FILM_SCENE_BY_ID, filmStepPosition, newApuRun, stepApuRun, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import * as THREE from 'three';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

test('Kid must steer the damaged APU past sentinel dives to reach Gate Three', () => {
  let direct = newApuRun();
  for (let i = 0; i < 500 && direct.phase === 'riding'; i++) direct = stepApuRun(direct, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(direct.phase, 'wrecked');
  assert.ok(direct.hits >= 3);

  let evasive = newApuRun();
  for (let i = 0; i < 500 && evasive.phase === 'riding'; i++) {
    const steer = evasive.x < 6.6 ? 1 : 0;
    evasive = stepApuRun(evasive, { throttle: 1, steer, brake: false }, .05);
  }
  assert.equal(evasive.phase, 'arrived');
  assert.equal(evasive.z, APU_ROUTE.finish);
  assert.ok(evasive.hull > 0);
});

test('the APU ride saves, retries and hands Kid to the physical gate control', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const scene = FILM_SCENE_BY_ID.m3_gate; let state = sandbox.life.film.state!;
  state.scene = scene.id; state.actor = scene.actor; state.step = 1;
  players.possess('p', 'kid', 2); const kid = players.getAgent('p')!;
  kid.currentLocation = scene.set; kid.isInMatrix = false; kid.position = filmStepPosition(scene, scene.steps[1]);
  const command = (target: string, tick: number) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  command('act', 3); assert.equal(state.apu?.phase, 'riding');
  let run = state.apu!;
  for (let frame = 0; frame < 32; frame++) {
    sandbox.life.film.driveFrame(kid, { throttle: 1, steer: 1, brake: false }, .05, 4 + frame);
    run = state.apu!;
  }
  const saved = structuredClone(sandbox.state); const position = { ...kid.position };
  sandbox.restore(saved); state = sandbox.life.film.state!; players.release('p', 36);
  for (let tick = 37; tick < 48; tick++) sandbox.tick(tick);
  assert.deepEqual(state.apu, saved.neoLife.journey.apu);
  players.possess('p', 'kid', 48); assert.deepEqual(kid.position, position);
  run = state.apu!;
  for (let frame = 0; frame < 500 && run.phase === 'riding'; frame++) {
    sandbox.life.film.driveFrame(kid, { throttle: 1, steer: run.x < 6.6 ? 1 : 0, brake: false }, .05, 49 + frame);
    run = state.apu!;
  }
  assert.equal(run.phase, 'arrived'); sandbox.tick(550); assert.equal(state.step, 2);
  kid.position = filmStepPosition(scene, scene.steps[2]); command('act', 551);
  for (let tick = 552; tick <= 565; tick++) sandbox.tick(tick);
  assert.equal(state.step, scene.steps.length); assert.ok(state.completed.includes(scene.id));

  state.step = 1; state.apu = { ...newApuRun(), x: 0, z: -29, speed: 12, hull: 20 };
  kid.position = filmStepPosition(scene, scene.steps[1]);
  for (let frame = 0; frame < 60 && state.apu.phase === 'riding'; frame++)
    sandbox.life.film.driveFrame(kid, { throttle: 1, steer: 0, brake: false }, .05, 566 + frame);
  assert.equal(kid.status, 'dead'); command('retry', 630);
  assert.equal(kid.status, 'alive'); assert.equal(state.apu, undefined); assert.equal(state.step, 1);
});

test('the Zion dock renders a damaged APU and opens Gate Three after Kid succeeds', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const scene = FILM_SCENE_BY_ID.m3_gate;
  const journey = { scene: scene.id, actor: scene.actor, step: 1, completed: [], checkpoint: filmStepPosition(scene, scene.steps[1]),
    enteredAt: 0, reflections: {}, lastText: '', apu: { ...newApuRun(), x: 4, z: -12 } } as unknown as import('@auto_matrix/shared').FilmJourney;
  renderer.update(journey, 1);
  const apu = root.getObjectByName('zion-kid-apu')!;
  const gate = root.getObjectByName('zion-gate-three')!;
  assert.equal(apu.visible, true); assert.equal(apu.position.x, 4); assert.equal(apu.position.z, -12);
  assert.equal(gate.position.y, 0);
  journey.step = scene.steps.length; renderer.update(journey, 2);
  assert.ok(gate.position.y > 0);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('the former one-button gate checkpoint resumes at the APU route', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const scene = FILM_SCENE_BY_ID.m3_gate;
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  const kid = world.agents.get('kid')!;
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const journey = sandbox.life.film.state!; journey.scene = scene.id; journey.actor = 'kid'; journey.step = 1;
  players.possess('p', 'kid', 2); kid.currentLocation = scene.set; kid.isInMatrix = false;
  kid.position = filmStepPosition(scene, scene.steps[2]);
  sandbox.tick(3);
  assert.deepEqual(kid.position, filmStepPosition(scene, scene.steps[1]));
  assert.deepEqual(journey.checkpoint, kid.position); assert.equal(journey.step, 1);
  journey.completed.push(scene.id); journey.step = 2;
  sandbox.tick(4); assert.equal(journey.step, scene.steps.length);
});
