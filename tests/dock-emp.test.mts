import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, TEMPLE_DEFENSE, dockPowerOffline, filmEntry, filmPosition, filmReflections, filmStepPosition, stepPlayer, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { RevolutionsPreludeRenderer } from '../packages/client/src/engine/RevolutionsPreludeRenderer.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

test('waiting at the EMP console cannot fire it without Link actively turning the crank', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_emp;
  Object.assign(state, { scene: scene.id, actor: 'link', step: 0 });
  players.possess('p', 'link', 2); const link = players.getAgent('p')!;
  Object.assign(link, { currentLocation: scene.set, isInMatrix: false, position: filmStepPosition(scene, scene.steps[0]) });
  // Older saves could contain the former generic interaction countdown.
  state.started = 0; sandbox.tick(100);
  assert.equal(state.emp, undefined, 'a legacy countdown must not discharge the new manual detonator');
  assert.equal(state.step, 0);
  link.position = filmPosition(scene.set, 0, -16); players.step(0, false, 2);
  assert.deepEqual(link.position, filmStepPosition(scene, scene.steps[0]), 'a legacy operator standing inside the new chair returns to its free approach side');
  players.sandboxAction('p', { kind: 'life', target: 'film:act' }, 3);
  for (let tick = 4; tick < 40; tick++) { sandbox.tick(tick); players.step(.1, true, tick); }
  assert.equal(state.emp, undefined, 'standing by the console and waiting is not the act of releasing EMP');
  assert.equal(state.step, 0, 'only completed manual operation advances the task');
});

test('a saved EMP flash freezes with the world and never restarts on page reload', () => {
  const journey = { scene: 'm3_emp', step: 1, completed: [], emp: { firedAt: 6, elapsed: .2 } } as unknown as FilmJourney;
  const root = new THREE.Group(), hammer = new RevolutionsPreludeRenderer(root, 'm3_emp');
  const intensity = () => { let sum = 0; root.traverse(object => { if (object instanceof THREE.PointLight) sum += object.intensity; }); return sum; };
  hammer.update(journey, 0); const lit = intensity(); assert.ok(lit > 0);
  hammer.update(journey, 120); assert.equal(intensity(), lit, 'wall-clock time cannot advance a paused discharge');
  hammer.dispose();
  const loaded = new RevolutionsPreludeRenderer(root, 'm3_emp');
  Object.assign(journey.emp!, { elapsed: 9 }); loaded.update(journey, 0);
  assert.equal(intensity(), 0, 'loading spent EMP cannot replay the flash');
  delete (journey.emp as { elapsed?: number }).elapsed; loaded.update(journey, 1);
  assert.equal(intensity(), 0, 'legacy firedAt-only saves are already spent');
  loaded.dispose();
});

test('Link fires the EMP after Hammer enters; blackout persists through reunion and the briefing into Kid’s evacuation', () => {
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
  for (let frame = 0; frame < 37; frame++) players.step(.1, true, 5);
  assert.equal(state.empOperator?.phase, 'ready'); assert.equal(state.step, 0);
  let sequence = 0;
  const hold = (count: number, focus: boolean, tick = 7) => { for (let frame = 0; frame < count; frame++) {
    players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, jump: false, sprint: false, focus, sequence: ++sequence });
    players.step(.1, true, tick);
  } };
  hold(12, true);
  const turning = structuredClone(state.empOperator), standing = { ...link.position };
  hold(8, false); assert.deepEqual(state.empOperator, turning, 'releasing G freezes the crank instead of firing');
  players.receiveInput('p', { x: 0, z: 0, yaw: 0, focus: true, jump: false, sprint: false, sequence: ++sequence });
  players.step(.1, true, 7, Date.now() + 500);
  assert.deepEqual(state.empOperator, turning, 'stale held input cannot operate the detonator');
  players.step(.1, false, 7); assert.deepEqual(state.empOperator, turning, 'pause freezes seating and crank');
  players.release('p', 7); players.step(.1, true, 7); assert.deepEqual(state.empOperator, turning);
  sandbox.restore(structuredClone(sandbox.state)); state = sandbox.life.film.state!;
  players.possess('p', 'link', 7); assert.deepEqual(state.empOperator, turning); assert.deepEqual(link.position, standing);
  link.status = 'dead'; command('retry', 7); assert.equal(link.status, 'alive'); assert.deepEqual(state.empOperator, turning);
  sequence = 100;
  hold(13, true);
  assert.equal(state.step, 1); assert.equal(state.emp?.firedAt, 7);
  assert.equal(state.empOperator?.phase, 'fired');
  assert.equal(sandbox.state.zion, 15, 'the EMP also destroys Zion’s powered defenses');

  command(`reflect:${filmReflections(empScene.id)[0].id}`, 9);
  assert.equal(state.step, 1, 'the player must see the discharge before leaving for the temple');
  for (let frame = 0; frame < 23; frame++) players.step(.1, true, 9);
  const elapsed = state.emp!.elapsed;
  assert.ok(elapsed! > 2 && elapsed! < 3);
  const position = { ...link.position };
  players.receiveInput('p', { x: 1, z: 1, yaw: 0, sprint: true, jump: true, sequence: ++sequence });
  players.step(.1, false, 9);
  assert.equal(state.emp!.elapsed, elapsed, 'world pause freezes the whole effect');
  assert.deepEqual(link.position, position);
  players.release('p', 9);
  for (let frame = 0; frame < 30; frame++) players.step(.1, true, 9);
  assert.equal(state.emp!.elapsed, elapsed, 'disconnect cannot consume the cinematic');
  players.possess('p', 'link', 9);
  assert.equal(link.currentAction?.parameters.dockEmp, elapsed, 'reconnecting resumes the exact saved moment');

  const saved = structuredClone(sandbox.state); sandbox.restore(saved); state = sandbox.life.film.state!;
  assert.equal(state.emp?.firedAt, 7);
  assert.equal(state.emp?.elapsed, elapsed);
  command('retry', 9); assert.equal(state.emp?.elapsed, elapsed, 'an already discharged EMP cannot be fired a second time');
  for (let frame = 0; frame < 140; frame++) players.step(.1, true, 9);
  assert.equal(state.emp?.elapsed, 9); assert.equal(state.empOperator?.phase, 'done');
  link.position = filmStepPosition(empScene, empScene.steps[1]);
  command(`reflect:${filmReflections(empScene.id)[0].id}`, 10);
  assert.ok(state.completed.includes(empScene.id));
  command('next', 11);
  assert.equal(state.scene, 'm3_dock_reunion'); assert.equal(state.actor, 'link');
  command('act', 11); hold(205, true, 11);
  const reunion = FILM_SCENE_BY_ID.m3_dock_reunion;
  link.position = filmStepPosition(reunion, reunion.steps[1]); sandbox.tick(11);
  command('act', 11); hold(112, false, 11);
  assert.equal(state.dockReunion?.phase, 'promise');
  command('act', 11); hold(81, false, 11);
  assert.equal(state.dockReunion?.phase, 'done'); command('next', 11);
  assert.equal(state.scene, 'm3_dock_briefing'); assert.equal(state.actor, 'niobe');
  const briefing = FILM_SCENE_BY_ID.m3_dock_briefing, niobe = players.getAgent('p')!;
  command('act', 11); hold(65, false, 11);
  niobe.position = filmStepPosition(briefing, briefing.steps[1]); hold(60, false, 11);
  assert.equal(state.step, 2); command('act', 11); hold(50, false, 11);
  assert.equal(state.dockBriefing?.phase, 'reply'); command('act', 11); hold(135, false, 11);
  assert.equal(state.step, 3); command('reflect:care', 11);
  niobe.position = filmStepPosition(briefing, briefing.steps[4]); hold(1, false, 11);
  assert.equal(state.dockBriefing?.phase, 'done'); command('next', 11);
  assert.equal(state.scene, 'm3_dock_evacuation'); assert.equal(state.actor, 'kid');
  assert.equal(state.emp?.firedAt, 7); assert.equal(state.templeSeal, undefined, 'the temple deadline starts only after evacuation and shaft sealing');
});

test('EMP extinguishes the Hammer and dock while the temple entrance remains open for the artillery', () => {
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
  assert.equal(templeRoot.getObjectByName('zion-temple-bulkhead'), undefined);
  assert.ok(templeRoot.getObjectByName('temple-artillery-0'));
  journey.step = templeScene.steps.length; temple.update(journey, 1);
  assert.equal(templeRoot.getObjectByName('zion-temple-bulkhead'), undefined);
  temple.dispose(); assert.equal(templeRoot.children.length, 0);
});

test('Zee can run directly between the visible artillery wheels after reaching the first one', () => {
  const scene = FILM_SCENE_BY_ID.m3_temple_defense;
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  for (let index = 0; index < 2; index++) {
    const lever = root.getObjectByName(`temple-mount-wheel-${index}`);
    assert.ok(lever, `wheel ${index} has a visible prop`);
    assert.equal(lever.position.x, scene.steps[index + 1].x);
    assert.equal(lever.position.z, TEMPLE_DEFENSE.wheel.z);
  }
  renderer.dispose();
  const start = filmStepPosition(scene, scene.steps[1]), end = filmStepPosition(scene, scene.steps[2]);
  let position = start, velocity = { x: 0, z: 0 };
  for (let frame = 0; frame < 200 && Math.hypot(position.x - end.x, position.z - end.z) > 2; frame++) {
    const next = stepPlayer(position, 0, { x: 1, z: 0, yaw: Math.PI / 2, sprint: true, jump: false }, .05, false, [], velocity);
    position = next.position; velocity = next.horizontalVelocity;
  }
  assert.ok(Math.hypot(position.x - end.x, position.z - end.z) < 2, `the podium blocks the artillery route at ${JSON.stringify(position)}`);
});
