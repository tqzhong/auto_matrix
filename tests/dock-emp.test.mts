import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, dockPowerOffline, filmEntry, filmReflections, filmStepPosition, stepPlayer, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

test('Link fires the EMP after Hammer enters; blackout persists into Zee’s timed manual defense', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const empScene = FILM_SCENE_BY_ID.m3_emp; let state = sandbox.life.film.state!;
  state.scene = empScene.id; state.actor = 'link'; state.step = 0;
  players.possess('p', 'link', 2); const link = players.getAgent('p')!;
  link.currentLocation = empScene.set; link.isInMatrix = false; link.position = filmStepPosition(empScene, empScene.steps[0]);
  const command = (target: string, tick: number) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  assert.equal(state.emp?.firedAt, undefined);
  command('act', 3);
  sandbox.tick(4); assert.equal(state.emp?.firedAt, undefined, 'arming the detonator is not the blast');
  for (let tick = 5; tick <= 9; tick++) sandbox.tick(tick);
  assert.equal(state.step, 1); assert.equal(state.emp?.firedAt, 7);
  assert.equal(sandbox.state.zion, 15, 'the EMP also destroys Zion’s powered defenses');

  const saved = structuredClone(sandbox.state); sandbox.restore(saved); state = sandbox.life.film.state!;
  assert.equal(state.emp?.firedAt, 7);
  link.position = filmStepPosition(empScene, empScene.steps[1]);
  command(`reflect:${filmReflections(empScene.id)[0].id}`, 10);
  assert.ok(state.completed.includes(empScene.id));
  command('next', 11);
  assert.equal(state.scene, 'm3_temple_defense'); assert.equal(state.actor, 'zee');
  assert.equal(state.emp?.firedAt, 7); assert.equal(state.templeSeal?.phase, 'running');

  players.release('p', 12);
  const remaining = state.templeSeal!.remaining;
  for (let tick = 13; tick < 100; tick++) sandbox.tick(tick);
  assert.equal(state.templeSeal?.remaining, remaining, 'the countdown pauses while Zee is unpossessed');
  players.possess('p', 'zee', 100); const zee = players.getAgent('p')!;
  zee.currentLocation = FILM_SCENE_BY_ID.m3_temple_defense.set; zee.isInMatrix = false;
  sandbox.tick(200);
  assert.equal(state.templeSeal?.phase, 'failed'); assert.equal(zee.status, 'dead');
  command('retry', 201);
  assert.equal(state.templeSeal?.phase, 'running'); assert.equal(zee.status, 'alive');
  assert.deepEqual(zee.position, filmEntry(FILM_SCENE_BY_ID.m3_temple_defense));
  const temple = FILM_SCENE_BY_ID.m3_temple_defense;
  zee.position = filmStepPosition(temple, temple.steps[0]); sandbox.tick(202); assert.equal(state.step, 1);
  zee.position = filmStepPosition(temple, temple.steps[1]); command('act', 203);
  for (let tick = 204; tick <= 209; tick++) sandbox.tick(tick);
  assert.equal(state.step, 2);
  zee.position = filmStepPosition(temple, temple.steps[2]); command('act', 210);
  for (let tick = 211; tick <= 216; tick++) sandbox.tick(tick);
  assert.equal(state.templeSeal?.phase, 'sealed');
  assert.ok(state.completed.includes(temple.id));
});

test('EMP extinguishes the Hammer and dock while the temple bulkhead closes only after both manual latches', () => {
  const empScene = FILM_SCENE_BY_ID.m3_emp;
  const journey = { version: 1, scene: empScene.id, actor: 'link', step: 0, completed: [], enteredAt: 0,
    checkpoint: filmEntry(empScene), reflections: {}, lastText: '' } as FilmJourney;
  const hammerRoot = new THREE.Group(), hammer = new RevolutionsPreludeRenderer(hammerRoot, 'm3_emp');
  hammer.update(journey, 0);
  assert.ok(hammerRoot.getObjectByName('hammer-emp-detonator'));
  assert.equal(hammer.blackout, false);
  journey.step = 1; journey.emp = { firedAt: 6 }; hammer.update(journey, 1);
  assert.equal(hammer.blackout, true);
  delete journey.emp; hammer.update(journey, 2);
  assert.equal(dockPowerOffline(journey), true, 'older saves past the detonator still show the blackout');
  hammer.dispose(); assert.equal(hammerRoot.children.length, 0);

  const dockRoot = new THREE.Group(), dock = new ZionHomecomingRenderer(dockRoot, 'film_zion_hangar');
  journey.scene = 'm3_gate'; delete journey.emp; dock.update(journey, 1);
  const dockLights: THREE.PointLight[] = [];
  dockRoot.traverse(object => { if (object instanceof THREE.PointLight) dockLights.push(object); });
  assert.ok(dockLights.some(light => light.intensity > 0));
  const normal = dockLights.reduce((sum, light) => sum + light.intensity, 0);
  journey.scene = 'm3_emp'; journey.emp = { firedAt: 6 }; dock.update(journey, 2);
  assert.ok(dockLights.reduce((sum, light) => sum + light.intensity, 0) < normal / 3);
  dock.dispose(); assert.equal(dockRoot.children.length, 0);

  const templeScene = FILM_SCENE_BY_ID.m3_temple_defense;
  const templeRoot = new THREE.Group(), temple = new ZionHomecomingRenderer(templeRoot, 'film_zion_temple');
  journey.scene = templeScene.id; journey.step = 1; temple.update(journey, 0);
  const bulkhead = templeRoot.getObjectByName('zion-temple-bulkhead')!;
  assert.ok(bulkhead.position.y > 0);
  journey.step = templeScene.steps.length; temple.update(journey, 1);
  assert.ok(bulkhead.position.y < 10);
  temple.dispose(); assert.equal(templeRoot.children.length, 0);
});

test('Zee can run directly between the visible temple latches after reaching the first one', () => {
  const scene = FILM_SCENE_BY_ID.m3_temple_defense;
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  for (const [index, name] of ['left', 'right'].entries()) {
    const lever = root.getObjectByName(`zion-temple-latch-${name}`);
    assert.ok(lever, `${name} latch has a visible prop`);
    assert.equal(lever.position.x, scene.steps[index + 1].x);
    assert.equal(lever.position.z, scene.steps[index + 1].z);
  }
  renderer.dispose();
  const start = filmStepPosition(scene, scene.steps[1]), end = filmStepPosition(scene, scene.steps[2]);
  let position = start, velocity = { x: 0, z: 0 };
  for (let frame = 0; frame < 200 && Math.hypot(position.x - end.x, position.z - end.z) > 2; frame++) {
    const next = stepPlayer(position, 0, { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: false }, .05, false, [], velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  assert.ok(Math.hypot(position.x - end.x, position.z - end.z) < 2, `the podium blocks the latch route at ${JSON.stringify(position)}`);
});
