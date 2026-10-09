import assert from 'node:assert/strict';
import test from 'node:test';
import { APU_RIG, APU_ROUTE, FILM_SCENE_BY_ID, FILM_SETS, filmPosition, filmStepPosition, newApuRun, stepApuRun, type WorldEvent } from '@auto_matrix/shared';
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
  assert.equal(evasive.hits, 0, 'leaving the captain must still leave enough space to avoid the first dive');
  assert.equal(evasive.z, APU_ROUTE.finish);
  assert.ok(evasive.hull > 0);
});

test('the slower walking pace leaves a late legacy save enough time and still enforces the route deadline', () => {
  let run = { ...newApuRun(), elapsed: 17, speed: 12 };
  for (let frame = 0; frame < 500 && run.phase === 'riding'; frame++)
    run = stepApuRun(run, { throttle: 1, steer: run.x < 6.6 ? 1 : 0, brake: false }, .05);
  assert.equal(run.phase, 'arrived'); assert.equal(run.gait?.progress, 0);
  assert.ok(run.gait?.feet.every(foot => foot.y === 0), 'finish the last step before handing control back');
  const idle = stepApuRun({ ...newApuRun(), elapsed: APU_ROUTE.limit - .025 }, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(idle.phase, 'wrecked');
});

test('the APU ride saves, retries and hands Kid to the counterweight firing station', () => {
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
  assert.equal(kid.currentAction?.parameters.apuDriving, true, 'disconnecting mid-step keeps Kid seated in the moving machine');
  for (let tick = 37; tick < 48; tick++) sandbox.tick(tick);
  assert.deepEqual(state.apu, saved.neoLife.journey.apu);
  players.possess('p', 'kid', 48); assert.deepEqual(kid.position, position);
  assert.equal(kid.currentAction?.parameters.apuDriving, true, 'reconnecting while paused must restore the cockpit pose before time resumes');
  assert.deepEqual(state.apu, saved.neoLife.journey.apu, 'restoring the pose cannot advance a footstep');
  run = state.apu!;
  for (let frame = 0; frame < 500 && run.phase === 'riding'; frame++) {
    sandbox.life.film.driveFrame(kid, { throttle: 1, steer: run.x < 6.6 ? 1 : 0, brake: false }, .05, 49 + frame);
    run = state.apu!;
  }
  assert.equal(run.phase, 'arrived');
  const arrived = structuredClone(run), arrivalPosition = { ...kid.position };
  players.release('p', 548);
  assert.equal(kid.currentAction?.parameters.apuDriving, true, 'arrival keeps the cockpit pose while paused before handoff');
  players.possess('p', 'kid', 549);
  assert.equal(kid.currentAction?.parameters.apuDriving, true, 'reconnecting at the gate must not turn the seated pilot into a walking character');
  assert.deepEqual(kid.position, arrivalPosition); assert.deepEqual(state.apu, arrived);
  sandbox.tick(550); assert.equal(state.step, 2);
  kid.position = filmStepPosition(scene, scene.steps[2]); command('act', 551);
  for (let tick = 552; tick <= 565; tick++) sandbox.tick(tick);
  assert.equal(state.step, 2); assert.equal(state.dockGate?.phase, 'falling');
  assert.equal(state.completed.includes(scene.id), false, 'the arrival does not cut the cable');

  delete state.dockGate; state.step = 1; state.apu = { ...newApuRun(), x: 0, z: -29, speed: 12, hull: 20 };
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
  journey.step = scene.steps.length; journey.completed.push(scene.id); renderer.update(journey, 2);
  assert.ok(gate.position.x > 0); assert.equal(gate.position.y, 0, 'the gate slides along its horizontal channel');
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

for (const legacy of [false, true]) test(`Kid can walk from Mifune to the APU without an on-foot sentinel fight (${legacy ? 'old combat save' : 'new handoff'})`, () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_gate;
  state.scene = 'm3_dock_battle'; state.actor = 'kid'; state.step = 3;
  state.completed.push('m3_dock_battle'); state.dockLastStand = { phase: 'done', elapsed: 0, total: 20 };
  players.possess('p', 'kid', 2); const kid = players.getAgent('p')!;
  kid.currentLocation = scene.set; kid.isInMatrix = false; kid.position = filmPosition(scene.set, -1.55, 6.3);
  const command = (target: string, tick: number) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  command('next', 3); assert.equal(state.scene, scene.id);
  const mifune = world.agents.get('mifune')!, body = structuredClone(mifune);
  assert.equal(body.status, 'dead');
  if (legacy) {
    state.fighting = true; state.started = 1;
    sandbox.state.threats.push({ id: 'old-gate-sentinel', kind: 'sentinel', scene: scene.id,
      position: filmPosition(scene.set, 0, 0), matrix: false, target: kid.id, health: 58, maxHealth: 58, stunUntil: 999, lastStrike: 0 });
    sandbox.restore(structuredClone(sandbox.state));
  }
  let sequence = 0, tick = 4;
  const active = () => sandbox.life.film.state!;
  sandbox.tick(tick++);
  assert.equal(sandbox.state.threats.some(t => t.scene === scene.id), false, 'old gate combat is retired on restore');
  assert.equal(Boolean(active().fighting), false);
  command('act', tick++);
  assert.equal(active().step, 0, 'the task cannot start beside the fallen captain');
  for (const [x, z] of [[-5.5, 6.3], [-4.4, 12]]) {
    const target = filmPosition(scene.set, x, z);
    for (let frame = 0; frame < 240; frame++) {
      const dx = target.x - kid.position.x, dz = target.z - kid.position.z, gap = Math.hypot(dx, dz);
      if (gap < .3) break;
      players.receiveInput('p', { x: dx / gap, z: dz / gap, yaw: Math.atan2(dx, dz), jump: false, sprint: false, sequence: ++sequence });
      players.step(.05, true, tick); if (frame % 10 === 0) sandbox.tick(tick++);
      assert.ok(frame < 239, `blocked on the route to ${x}, ${z}`);
    }
  }
  players.receiveInput('p', { x: 0, z: 0, yaw: kid.rotation, jump: false, sprint: false, sequence: ++sequence });
  sandbox.tick(tick++); assert.equal(active().step, 1, 'walking beside the APU unlocks the cockpit');
  const checkpoint = { ...kid.position };
  sandbox.restore(structuredClone(sandbox.state)); players.release('p', tick++);
  sandbox.tick(tick++); players.possess('p', 'kid', tick++);
  assert.deepEqual(kid.position, checkpoint); assert.equal(active().apu, undefined);
  command('act', tick++);
  assert.equal(active().apu?.phase, 'riding');
  assert.equal(kid.position.y, FILM_SETS[scene.set].center.y + APU_RIG.floor + APU_RIG.pilot.y, 'the saved entry immediately uses the actual cockpit height');
  assert.equal(kid.currentAction?.parameters.apuDriving, true, 'the first seated frame must not wait for movement');
  assert.equal(mifune.status, 'dead'); assert.deepEqual(mifune.position, body.position);
  assert.equal(sandbox.state.threats.some(t => t.scene === scene.id), false);
});
