import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  FILM_SCENE_BY_ID,
  filmStepPosition,
  filmPosition,
  playerBlocked,
  groundHeight,
  stepPlayer,
  newTrilogyEpilogue,
  stepTrilogyEpilogue,
  trilogyEpilogueLocked,
  gardenPose,
  type TrilogyEpilogueEncounter,
  type FilmJourney,
  type AgentState,
  type SandboxState,
  type WorldEvent,
} from '@auto_matrix/shared';
import { TrilogyEpilogueRenderer } from '../packages/client/src/engine/TrilogyEpilogueRenderer.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1); players.possess('p', 'neo', 1);
  let tick = 1; let sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const frame = (count = 1, running = true) => { for (let i = 0; i < count; i++) {
    tick += .05; players.receiveInput('p', { x: 0, z: 0, yaw: 0, sprint: false, jump: false, focus: false, sequence: ++sequence });
    players.step(.05, running, tick); sandbox.tick(tick);
  } };
  return { world, sandbox, players, command, frame, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the epilogue reducer preserves authored phase boundaries', () => {
  let ceasefire = { ...newTrilogyEpilogue('ceasefire'), phase: 'retreat' as const };
  for (let i = 0; i < 51; i++) ceasefire = stepTrilogyEpilogue(ceasefire, .1);
  assert.equal(ceasefire.phase, 'retreat');
  ceasefire = stepTrilogyEpilogue(ceasefire, .1); assert.equal(ceasefire.phase, 'message_ready');
  assert.equal(trilogyEpilogueLocked(ceasefire), false, 'Kid must physically carry the news after the retreat');
  let dawn = { ...newTrilogyEpilogue('dawn'), phase: 'sitting' as const };
  for (let i = 0; i < 79; i++) dawn = stepTrilogyEpilogue(dawn, .1);
  assert.equal(dawn.phase, 'choice');
  assert.equal(trilogyEpilogueLocked(dawn), true, 'the Oracle stays physically seated while the player decides');
  assert.deepEqual(stepTrilogyEpilogue(dawn, .1), dawn, 'the Architect cannot choose the meaning of peace for the player');
});

test('new street resets restore the pavement and bring the cat before Sati rises, while active legacy saves keep their beat', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_reset;
  Object.assign(h.state(), { scene: scene.id, actor: 'sati', step: 0, epilogue: newTrilogyEpilogue('reset') });
  h.players.possess('p', 'sati', h.tick()); h.command('act');
  assert.equal(h.state().epilogue?.phase, 'cat', 'Sati must still be lying down during the street restoration');
  h.frame(176); assert.equal(h.state().epilogue?.phase, 'waking');
  h.frame(44); const saved = structuredClone(h.sandbox.state), pose = structuredClone(h.state().epilogue);
  h.frame(15, false); assert.deepEqual(h.state().epilogue, pose);
  h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'sati', h.tick());
  assert.deepEqual(h.state().epilogue, pose, 'rejoining must preserve the partially supported waking pose');
  h.frame(100); assert.equal(h.state().epilogue?.phase, 'done');
  h.command('next'); assert.equal(h.state().scene, 'm3_dawn');
  let legacy = { kind: 'reset', phase: 'waking', elapsed: 3.1, total: 3.1 } as const;
  const oldCat = stepTrilogyEpilogue(legacy, .1);
  assert.equal(oldCat.phase, 'cat', 'an old active save must finish its original order instead of skipping its cat beat');
  assert.equal(stepTrilogyEpilogue({ ...oldCat, elapsed: 5.9 }, .1).phase, 'done');
});

test('the reset facade blocks a scene revisit and is removed when returning to the saved park', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_dawn;
  Object.assign(h.state(), { scene: scene.id, actor: 'oracle', step: scene.steps.length, finished: true,
    completed: ['m3_reset', scene.id], epilogue: { ...newTrilogyEpilogue('dawn'), phase: 'done' } });
  h.players.possess('p', 'oracle', h.tick()); h.command('visit:m3_reset');
  assert.equal(h.state().visiting, 'm3_reset');
  assert.ok(Math.abs(h.actor().position.z - filmPosition('film_escape_streets', 0, 0).z) < 9, 'revisiting must enter the street instead of spawning behind the opposite building');
  assert.equal(playerBlocked(filmPosition('film_escape_streets', 2, -14.8), true, 1.1, h.sandbox.state.structures), true, 'the visible low window cannot be walked through');
  assert.equal(playerBlocked(filmPosition('film_escape_streets', 1, -12), true, 1.1, h.sandbox.state.structures), false, 'the waking area remains open');
  assert.equal(playerBlocked(filmPosition('film_escape_streets', 0, 14.8), true, 1.1, h.sandbox.state.structures), true, 'the opposite facade also has collision');
  assert.equal(groundHeight(filmPosition('film_escape_streets', 0, 0), true, h.sandbox.state.structures), filmPosition('film_escape_streets', 0, 0).y - .15);
  let position = { ...h.actor().position }, velocity = { x: 0, z: 0 }, vertical = 0;
  const target = filmPosition('film_escape_streets', 0, -12);
  for (let frame = 0; frame < 180 && Math.abs(position.z - target.z) > .2; frame++) {
    const next = stepPlayer(position, vertical, { x: 0, z: -1, yaw: Math.PI, sprint: false, jump: false }, .05, true, h.sandbox.state.structures, velocity);
    position = next.position; velocity = next.horizontalVelocity; vertical = next.verticalVelocity;
  }
  assert.ok(Math.abs(position.z - target.z) < .2 && Math.abs(position.y - target.y) < .01, 'normal walking must step from the road up to the same body-support pavement');
  h.command('return');
  assert.equal(h.state().visiting, undefined); assert.equal(h.state().scene, scene.id);
  assert.equal(h.sandbox.state.structures.some(item => item.id.startsWith('film:reset:facade')), false, 'the later facade cannot block the first-film escape route');
});

test('Neo remains unresponsive while the transport is waiting or finished without advancing its clock', () => {
  for (const phase of ['ready', 'done'] as const) {
    const encounter = { ...newTrilogyEpilogue('neo_carried'), phase, total: 14.3 };
    assert.equal(trilogyEpilogueLocked(encounter), true, `${phase}: Neo cannot stand up between transport beats`);
    assert.deepEqual(stepTrilogyEpilogue(encounter, .1), encounter, `${phase}: the player still chooses when to continue`);
  }
});

test('the Oracle stays seated while the player considers the Architect’s promise', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_dawn;
  Object.assign(h.state(), { scene: scene.id, actor: 'oracle', step: 2,
    epilogue: { ...newTrilogyEpilogue('dawn'), phase: 'choice' } });
  h.players.possess('p', 'oracle', h.tick()); h.frame();
  const seat = structuredClone(h.actor().position), encounter = structuredClone(h.state().epilogue);
  h.players.receiveInput('p', { x: 1, z: 1, yaw: 1, sprint: true, jump: true, sequence: 100 });
  h.players.step(.1, true, h.tick());
  assert.deepEqual(h.actor().position, seat, 'waiting for a philosophical answer must not turn the seated Oracle into a running avatar');
  assert.deepEqual(h.state().epilogue, encounter, 'the decision has no countdown');
  assert.equal(h.actor().currentAction?.parameters.epilogue?.phase, 'choice');
  h.command('reflect:trust');
  assert.equal(h.state().step, 3, 'seated movement locking must still allow the explicit answer');
});

test('the Architect continues along the waterfront while the player waits to welcome Sati', () => {
  let encounter: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'leaving', total: 7.8 };
  for (let frame = 0; frame < 48; frame++) encounter = stepTrilogyEpilogue(encounter, .1);
  assert.equal(encounter.phase, 'promise');
  const first = gardenPose(encounter, 'architect');
  for (let frame = 0; frame < 80; frame++) encounter = stepTrilogyEpilogue(encounter, .1);
  const later = gardenPose(encounter, 'architect');
  assert.ok(later.x < first.x - 20, 'departure must continue instead of freezing at the first shore marker');
  assert.equal(encounter.phase, 'promise', 'walking away cannot answer the welcome prompt for the player');
  assert.equal(encounter.elapsed, 0, 'waiting for G still has no countdown');
  const paused = JSON.parse(JSON.stringify(encounter));
  assert.deepEqual(stepTrilogyEpilogue(paused, 0), paused, 'paused or disconnected observers cannot advance departure');
  assert.deepEqual(gardenPose(paused, 'architect'), later, 'cold loading uses the saved departure position and gait');
  let previous = later;
  for (let frame = 0; frame < 400; frame++) {
    encounter = stepTrilogyEpilogue(encounter, .1); const pose = gardenPose(encounter, 'architect');
    assert.ok(Math.hypot(pose.x - previous.x, pose.z - previous.z) <= .5, 'the physical performer cannot teleport out of the shot');
    previous = pose;
  }
  assert.ok(previous.x < -90 && previous.z > -34, 'departure reaches the far promenade without entering the water');
  assert.equal(previous.walk, 0, 'the distant performer eventually rests instead of walking on the spot');
});

test('legacy park departures resume from their saved pose without replaying or jumping', () => {
  for (const [phase, elapsed] of [['leaving', 2.2], ['promise', 0], ['sati', 3.328], ['belief', .103]] as const) {
    let encounter: TrilogyEpilogueEncounter = { kind: 'dawn', phase, elapsed, total: 31.02 };
    const before = gardenPose(encounter, 'architect');
    assert.deepEqual(stepTrilogyEpilogue(encounter, 0), encounter);
    encounter = stepTrilogyEpilogue(encounter, .1); const resumed = gardenPose(encounter, 'architect');
    assert.ok(Math.hypot(resumed.x - before.x, resumed.z - before.z) < .5, `${phase}: first active update jumps`);
    assert.ok(Math.abs(Math.atan2(Math.sin(resumed.yaw - before.yaw), Math.cos(resumed.yaw - before.yaw))) < .2,
      `${phase}: first active update snaps the body heading`);
    for (let frame = 0; frame < 100; frame++) encounter = stepTrilogyEpilogue(encounter, .1);
    assert.ok(gardenPose(encounter, 'architect').x < before.x - 20, `${phase}: the saved departure remains stuck`);
  }
});

test('park departure pauses with the world, another player’s cast ownership and a disconnected Oracle', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_dawn;
  Object.assign(h.state(), { scene: scene.id, actor: 'oracle', step: 2,
    epilogue: { ...newTrilogyEpilogue('dawn'), phase: 'choice' } });
  h.players.possess('p', 'oracle', h.tick()); h.command('reflect:trust'); h.frame(100);
  assert.equal(h.state().epilogue?.phase, 'promise');
  const architect = h.world.agents.get('architect')!, first = structuredClone(architect.position);
  h.frame(80); assert.ok(architect.position.x < first.x - 10, 'ordinary player frames must keep the departing body moving');
  const clock = structuredClone(h.state().epilogue), position = structuredClone(architect.position);
  h.frame(20, false); assert.deepEqual(h.state().epilogue, clock); assert.deepEqual(architect.position, position);
  architect.controller = 'other'; h.frame(20); assert.deepEqual(h.state().epilogue, clock); assert.deepEqual(architect.position, position);
  delete architect.controller;
  const save = JSON.parse(JSON.stringify(h.sandbox.state)); h.players.release('p', h.tick()); h.sandbox.restore(save);
  h.frame(20); assert.deepEqual(h.state().epilogue, clock); assert.deepEqual(architect.position, position);
  h.players.possess('p', 'oracle', h.tick()); h.frame(20);
  assert.ok(architect.position.x < position.x - 2, 'normal reconnection resumes the same departure');
  assert.equal(h.state().step, 3); assert.equal(h.state().finished, undefined);
});

test('Neo’s resting transport action survives later world ticks and serialized park restoration exactly', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_dawn;
  h.players.release('p', h.tick());
  Object.assign(h.state(), { scene: scene.id, actor: 'oracle', step: 3, completed: ['m3_surrender', 'm3_neo_carried', 'm3_reset'],
    epilogue: { ...newTrilogyEpilogue('dawn'), phase: 'sunrise', elapsed: 2.37, total: 29 } });
  h.sandbox.life.film.reconcileCast(); h.players.possess('p', 'oracle', h.tick());
  const neo = h.world.agents.get('neo')!, body = structuredClone({ position: neo.position, action: neo.currentAction });
  h.world.simulationTick += 10; h.sandbox.life.film.reconcileCast();
  assert.deepEqual(neo.currentAction, body.action, 'reconciliation cannot replace an existing unresponsive body’s action timestamp');
  h.frame(4); h.players.release('p', h.tick());
  const save = JSON.parse(JSON.stringify({ sandbox: h.sandbox.state, agents: Object.fromEntries(h.world.agents), tick: h.world.simulationTick }));
  const cold = game(); cold.players.release('p', cold.tick());
  cold.world.simulationTick = save.tick;
  for (const [id, actor] of Object.entries(save.agents)) cold.world.agents.set(id, actor as AgentState);
  cold.sandbox.restore(save.sandbox);
  assert.deepEqual(cold.world.agents.get('neo')!.currentAction, body.action, 'cold restoration must retain the exact body action');
  assert.deepEqual(cold.world.agents.get('neo')!.position, body.position);
  assert.equal(cold.world.agents.get('neo')!.status, 'disconnected');
  assert.equal(cold.world.agents.get('neo')!.health, 0);
});

test('Neo transport keeps a phase’s action start while its saved physical motion advances', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_neo_carried;
  Object.assign(h.state(), { scene: scene.id, actor: 'neo', step: 0,
    epilogue: { ...newTrilogyEpilogue('neo_carried'), phase: 'lowering', elapsed: 1, total: 3.8 } });
  h.players.possess('p', 'neo', h.tick()); h.frame();
  const start = h.actor().currentAction!.startedAt, first = structuredClone(h.actor().position);
  h.frame(5);
  assert.equal(h.actor().currentAction!.startedAt, start, 'frame updates are not new transport actions');
  assert.ok(h.actor().position.y < first.y, 'preserving the action timer must not freeze lowering');
  h.frame(45); assert.equal(h.state().epilogue?.phase, 'transfer');
  assert.ok(h.actor().currentAction!.startedAt > start, 'entering a new physical transport phase still starts its action');
  const moving = structuredClone(h.actor().currentAction);
  h.frame(10, false); assert.deepEqual(h.actor().currentAction, moving, 'pausing cannot rewrite the held action');
});

test('the Smith ending leaves a persistent real-world body while Kid witnesses the ceasefire', () => {
  const h = game(); const surrender = FILM_SCENE_BY_ID.m3_surrender;
  Object.assign(h.state(), { scene: surrender.id, actor: 'neo', step: surrender.steps.length, completed: [surrender.id],
    smithFinale: { phase: 'done', elapsed: 0, total: 30, focus: 0, hits: 2, lastStrike: 0, lane: 0, checkpoint: 'air', attempts: 0 } });
  const neo = h.actor(); neo.currentLocation = surrender.set; neo.isInMatrix = true;
  h.command('next');
  assert.equal(h.actor().id, 'kid');
  assert.equal(neo.currentLocation, 'film_machine_core', 'the avatar must not be mistaken for the physical body');
  assert.equal(neo.isInMatrix, false);
  assert.equal(neo.currentAction?.parameters.finaleComa, true);
  const body = structuredClone({ position: neo.position, action: neo.currentAction });
  assert.ok(h.players.possess('other', 'neo', h.tick()).error, 'ordinary possession must not revive Neo');
  h.frame(20); assert.deepEqual(neo.position, body.position);
  const save = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(save);
  assert.equal(neo.currentLocation, 'film_machine_core'); assert.equal(neo.currentAction?.parameters.finaleComa, true);
  h.players.possess('p', 'kid', h.tick());
  Object.assign(h.state(), { step: FILM_SCENE_BY_ID.m3_ceasefire.steps.length,
    epilogue: { ...newTrilogyEpilogue('ceasefire'), phase: 'done' } });
  h.command('next');
  assert.equal(h.actor().id, 'neo', 'the authored transport viewpoint must remain accessible');
  assert.equal(h.state().scene, 'm3_neo_carried');
  const ready = structuredClone(neo.position);
  h.players.receiveInput('p', { x: 1, z: 1, yaw: 1, sprint: true, jump: true, sequence: 100 });
  h.players.step(.1, true, h.tick()); assert.deepEqual(neo.position, ready, 'movement and jump cannot animate the unresponsive body');
  assert.match(h.players.act('p', 'attack', h.tick()), /动作|观察|演出|互动|片段/);
  h.frame(10);
  assert.deepEqual(neo.position, ready); assert.equal(h.state().epilogue?.phase, 'ready');
  assert.match(h.players.sandboxAction('p', { kind: 'craft', target: 'medkit' }, h.tick()), /回应|身体/);
  h.command('act'); h.frame(310);
  assert.equal(h.state().epilogue?.phase, 'done');
  const end = structuredClone(neo.position); h.frame(10); assert.deepEqual(neo.position, end);
  const completed = structuredClone(h.state()); h.command('retry'); assert.deepEqual(h.state(), completed, 'retry must not replay the ending or refill life');
  assert.ok(end.z < ready.z - 28, 'the body must remain aboard the departed vessel instead of snapping back');
  assert.equal(neo.currentAction?.parameters.finaleComa, true);
  h.command('next'); assert.equal(h.actor().id, 'sati');
  h.command('act'); h.frame(330); h.command('next'); assert.equal(h.actor().id, 'oracle');
  assert.deepEqual(neo.position, end, 'cutting to the park must not return the body to the apartment');
});

test('reconnecting after the transport can hand off to the Oracle without reviving Neo', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_neo_carried, neo = h.actor();
  Object.assign(h.state(), { scene: scene.id, actor: 'neo', step: scene.steps.length,
    completed: ['m3_surrender', scene.id], epilogue: { ...newTrilogyEpilogue('neo_carried'), phase: 'done' } });
  const save = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(save);
  assert.equal(neo.status, 'disconnected');
  const body = structuredClone({ position: neo.position, health: neo.health });
  assert.equal(h.players.possess('p', 'neo', h.tick()).error, undefined);
  assert.equal(neo.status, 'disconnected', 'the story observer must not revive the body');
  const inventory = structuredClone(h.sandbox.state.profiles.neo.inventory);
  h.players.sandboxAction('p', { kind: 'use', target: 'medkit' }, h.tick());
  assert.deepEqual(h.sandbox.state.profiles.neo.inventory, inventory);
  assert.equal(neo.health, body.health);
  h.command('next');
  assert.equal(h.state().scene, 'm3_reset', 'a saved completed transport must remain continuable');
  assert.equal(h.actor().id, 'sati'); h.command('act'); h.frame(330); h.command('next');
  assert.equal(h.state().scene, 'm3_dawn');
  assert.equal(h.actor().id, 'oracle');
  assert.equal(h.actor().currentAction?.parameters.oracleRestored, undefined);
  assert.equal(neo.status, 'disconnected'); assert.equal(neo.isInMatrix, false);
  assert.deepEqual(neo.position, body.position);
});

test('ceasefire, Neo transport and dawn form a saved playable epilogue without auto-starting a new cycle', () => {
  const h = game(); const surrender = FILM_SCENE_BY_ID.m3_surrender; const state = h.state();
  Object.assign(state, { scene: surrender.id, actor: 'neo', step: surrender.steps.length,
    smithFinale: { phase: 'done', elapsed: 0, total: 30, focus: 0, hits: 2, lastStrike: 0, lane: 0, checkpoint: 'air', attempts: 0 } });
  h.actor().currentLocation = surrender.set; h.command('next');
  const ceasefire = FILM_SCENE_BY_ID.m3_ceasefire;
  assert.equal(state.scene, ceasefire.id); assert.equal(h.actor().id, 'kid');
  h.actor().position = filmStepPosition(ceasefire, ceasefire.steps[0]); h.frame(); assert.equal(state.step, 1);
  h.actor().position = filmStepPosition(ceasefire, ceasefire.steps[1]); h.command('act'); h.frame(35);
  const savedElapsed = state.epilogue!.elapsed; h.frame(20, false); assert.equal(state.epilogue!.elapsed, savedElapsed);
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'kid', h.tick());
  assert.equal(h.state().epilogue!.elapsed, savedElapsed);
  h.frame(75); assert.equal(h.state().epilogue?.phase, 'message_ready'); assert.equal(h.state().step, 2);
  h.actor().position = filmStepPosition(ceasefire, ceasefire.steps[2]); h.command('act'); h.frame(220);
  assert.equal(h.state().epilogue?.phase, 'done'); assert.equal(h.state().step, ceasefire.steps.length);

  h.command('next'); const carried = FILM_SCENE_BY_ID.m3_neo_carried;
  assert.equal(h.state().scene, carried.id); assert.equal(h.actor().id, 'neo');
  h.actor().position = filmStepPosition(carried, carried.steps[0]); h.command('act'); h.frame(310);
  assert.equal(h.state().epilogue?.phase, 'done'); assert.equal(h.state().step, carried.steps.length);

  h.command('next');
  assert.equal(h.state().scene, 'm3_reset'); assert.equal(h.actor().id, 'sati');
  assert.equal(h.actor().currentLocation, 'film_escape_streets', 'Sati wakes on the street, before the park');
  h.command('act'); h.frame(100);
  const resetSave = structuredClone(h.sandbox.state), resetClock = structuredClone(h.state().epilogue);
  h.players.release('p', h.tick()); h.sandbox.restore(resetSave); h.players.possess('p', 'sati', h.tick());
  assert.deepEqual(h.state().epilogue, resetClock); h.frame(230);
  assert.equal(h.state().epilogue?.phase, 'done');
  h.command('next'); const dawn = FILM_SCENE_BY_ID.m3_dawn;
  assert.equal(h.state().scene, dawn.id); assert.equal(h.actor().id, 'oracle');
  h.actor().position = filmStepPosition(dawn, dawn.steps[0]); h.frame(); assert.equal(h.state().step, 1);
  h.actor().position = filmStepPosition(dawn, dawn.steps[1]); h.command('act'); h.frame(170);
  assert.equal(h.state().epilogue?.phase, 'choice'); assert.equal(h.state().step, 2);
  h.command('reflect:trust'); assert.equal(h.state().epilogue?.phase, 'leaving'); assert.equal(h.state().step, 3);
  h.command('act'); assert.equal(h.state().epilogue?.phase, 'leaving', 'wait for the Architect to leave');
  h.frame(100); assert.equal(h.state().epilogue?.phase, 'promise');
  h.command('act'); h.frame(440);
  assert.equal(h.state().epilogue?.phase, 'done'); assert.equal(h.state().step, dawn.steps.length);
  assert.equal(h.state().finished, undefined, 'watching the sunrise must not silently start another cycle');
  h.command('next'); assert.equal(h.state().finished, true); assert.equal(h.sandbox.state.ending, 'peace');
  const finalSeat = structuredClone(h.actor().position);
  h.state().completed.push('m1_lobby'); h.command('visit:m1_lobby');
  assert.equal(h.actor().currentLocation, 'film_government_lobby', 'confirmed ending must allow the existing scene revisit');
  h.command('return'); assert.deepEqual(h.actor().position, finalSeat);
  h.command('cycle'); assert.equal(h.actor().id, 'neo'); assert.equal(h.sandbox.state.neoLife!.cycle, 2);
});

test('Kid watches the city during withdrawal and faces the crowd only when delivering the news, including a restored save', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_ceasefire;
  Object.assign(h.state(), { scene: scene.id, actor: 'kid', step: 1, epilogue: newTrilogyEpilogue('ceasefire') });
  h.players.possess('p', 'kid', h.tick()); h.actor().position = filmStepPosition(scene, scene.steps[1]);
  h.command('act'); h.frame(52);
  assert.equal(h.state().epilogue?.phase, 'retreat');
  assert.ok(Math.cos(h.actor().rotation) < -.99, 'watching the departing machines must face out of the temple');
  const saved = structuredClone(h.sandbox.state), clock = structuredClone(h.state().epilogue);
  h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'kid', h.tick()); h.frame(1, false);
  assert.deepEqual(h.state().epilogue, clock); assert.ok(Math.cos(h.actor().rotation) < -.99);
  h.frame(100); h.actor().position = filmStepPosition(scene, scene.steps[2]); h.command('act');
  assert.equal(h.state().epilogue?.phase, 'announcement'); assert.ok(Math.cos(h.actor().rotation) > .99);
});

test('Kid keeps the run performed by the player instead of teleporting back to replay it', () => {
  const h = game(); const scene = FILM_SCENE_BY_ID.m3_ceasefire; const target = filmStepPosition(scene, scene.steps[2]);
  Object.assign(h.state(), { scene: scene.id, actor: 'kid', step: 2,
    epilogue: { ...newTrilogyEpilogue('ceasefire'), phase: 'message_ready' } });
  h.players.possess('p', 'kid', h.tick()); Object.assign(h.actor().position, target);
  h.command('act');
  assert.equal(h.state().epilogue?.phase, 'announcement');
  assert.equal(h.actor().position.z, target.z, 'starting the announcement must not move Kid back to the temple entrance');
});

test('each dedicated epilogue layer renders and disposes its physical story objects', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const expectations = [
    ['ceasefire', 'ceasefire-retreating-sentinel-1'],
    ['neo_carried', 'neo-machine-funeral-barge'],
    ['reset', 'matrix-reset-black-cat'],
    ['dawn', 'oracle-waterfront-bench'],
  ] as const;
  for (const [kind, name] of expectations) {
    const root = new THREE.Group(); const renderer = new TrilogyEpilogueRenderer(root, kind);
    assert.ok(root.getObjectByName(name), `${kind}: ${name}`);
    if (kind === 'neo_carried') {
      assert.ok(root.getObjectByName('neo-tray-rim-left'), 'the dark tray needs a visible silhouette');
      assert.ok(root.getObjectByName('neo-tray-body-light'), 'carried Neo needs a local key light');
    }
    const state = newTrilogyEpilogue(kind); state.phase = kind === 'ceasefire' ? 'retreat' : kind === 'neo_carried' ? 'departing' : kind === 'reset' ? 'cat' : 'sunrise'; state.elapsed = 1;
    renderer.update(state, 2);
    if (kind === 'neo_carried') assert.ok(root.getObjectByName('neo-body-transfer-tray')!.position.y > 1.05,
      'the tray must rise with the departing barge');
    const disposed: string[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
  }
});

test('the resetting sidewalk supports the cat and Sati, restores ahead of the paws, and resumes from the saved clock', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), restored = new THREE.Group();
  const renderer = new TrilogyEpilogueRenderer(root, 'reset'), cold = new TrilogyEpilogueRenderer(restored, 'reset');
  try {
    const pavement = root.getObjectByName('reset-sidewalk'); assert.ok(pavement, 'Sati needs the street-side pavement rather than the escape road');
    const wall = root.getObjectByName('reset-basement-front'); assert.ok(wall, 'the low windows must sit behind the sleeping child');
    root.updateMatrixWorld(true);
    const across = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)).intersectObject(root, true)[0];
    assert.ok(across && across.distance < 20, 'turning toward the road needs the opposite block rather than an empty backdrop');
    const tiles = root.getObjectByName('reset-paving-slabs')!;
    for (const elapsed of [0, 1.3, 3.2, 5.7, 7.8, 8.8]) {
      const state = { ...newTrilogyEpilogue('reset'), phase: 'cat' as const, elapsed, total: elapsed };
      renderer.update(state, elapsed + 100); cold.update(structuredClone(state), 0);
      root.updateMatrixWorld(true); restored.updateMatrixWorld(true);
      const cat = root.getObjectByName('matrix-reset-black-cat')!;
      const paws: THREE.Vector3[] = [];
      cat.traverse(object => { if (object.name === 'reset-cat-paw') {
        const paw = object as THREE.Mesh; let low = Infinity;
        for (let i = 0; i < paw.geometry.attributes.position.count; i++) low = Math.min(low, paw.localToWorld(paw.getVertexPosition(i, new THREE.Vector3())).y);
        const p = paw.getWorldPosition(new THREE.Vector3()); p.y = low; paws.push(p);
      } });
      assert.equal(paws.length, 4);
      assert.ok(paws.every(p => p.y >= -.003), `cat ${elapsed}: a paw penetrates the pavement`);
      assert.ok(Math.min(...paws.map(p => p.y)) < .012, `cat ${elapsed}: the cat floats without a planted paw`);
      const floor = new THREE.Raycaster(new THREE.Vector3(cat.position.x, 2, cat.position.z), new THREE.Vector3(0, -1, 0)).intersectObjects([pavement, tiles], true)[0];
      assert.ok(floor && Math.abs(floor.point.y) < .008, `cat ${elapsed}: the restoring slabs must settle before the cat steps on them`);
      assert.deepEqual(cat.position.toArray(), restored.getObjectByName('matrix-reset-black-cat')!.position.toArray());
      const matrices = tiles.children.map(tile => tile.matrixWorld.toArray()); renderer.update(state, 987); root.updateMatrixWorld(true);
      assert.deepEqual(tiles.children.map(tile => tile.matrixWorld.toArray()), matrices, 'pausing cannot advance restoration');
      assert.deepEqual(restored.getObjectByName('reset-paving-slabs')!.children.map(tile => tile.matrixWorld.toArray()), matrices, 'cold loading must reconstruct the same pavement');
    }
    const support = new THREE.Raycaster(new THREE.Vector3(1, 2, -12), new THREE.Vector3(0, -1, 0)).intersectObjects([pavement, tiles], true)[0];
    assert.ok(support && Math.abs(support.point.y) < .008, 'Sati’s body support stays at its saved floor height');
    const textures = new Set<THREE.Texture>(); root.traverse(object => { if (object instanceof THREE.Mesh) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    } });
    let disposed = 0; textures.forEach(texture => texture.addEventListener('dispose', () => disposed++)); renderer.dispose();
    assert.ok(textures.size >= 6); assert.equal(disposed, textures.size, 'leaving the street must release its textures');
  } finally { if (root.children.length) renderer.dispose(); cold.dispose(); }
});

test('saved epilogue actions reach NPC animation and carry Neo flat on the machine tray', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!; const morpheus = world.agents.get('morpheus')!;
  neo.currentAction = { type: 'idle', parameters: { epilogue: { ...newTrilogyEpilogue('neo_carried'), phase: 'transfer', role: 'neo' } }, startedAt: 0, duration: 1, progress: 0 };
  morpheus.currentAction = { type: 'idle', parameters: { epilogue: { ...newTrilogyEpilogue('ceasefire'), phase: 'embrace', role: 'morpheus' } }, startedAt: 0, duration: 1, progress: 0 };
  const renderer = new AgentRenderer(new THREE.Scene());
  try {
    renderer.updateAgent('neo', neo); renderer.updateAgent('morpheus', morpheus); renderer.update(.3);
    assert.ok(renderer.getAgentBody('neo')!.rotation.x > 1.2, 'Neo should lie face up on the machine tray');
    assert.ok(renderer.getAgentBody('neo')!.position.y > 1.2, 'Neo should rest on top of the tray instead of below the floor');
    const entries = (renderer as unknown as { agents: Map<string, { rig: { shoulders: THREE.Group[] }; shadow: THREE.Mesh }> }).agents;
    assert.equal(entries.get('neo')!.shadow.visible, false);
    assert.ok(entries.get('morpheus')!.rig.shoulders.every(shoulder => shoulder.rotation.x < -1), 'Morpheus should receive the saved embrace pose');
  } finally { renderer.dispose(); globalThis.document = originalDocument; }
});

test('park performers follow the current Oracle frame without advancing a paused clock or overriding an occupied actor', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const originalDocument = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const architect = world.agents.get('architect')!, renderer = new AgentRenderer(new THREE.Scene());
  const saved: TrilogyEpilogueEncounter = { ...newTrilogyEpilogue('dawn'), phase: 'leaving', elapsed: .3, total: 8.1,
    parkDeparture: { elapsed: .3, origin: { x: -8.3, z: -25.5, yaw: 0 } } };
  let current = saved; for (let i = 0; i < 9; i++) current = stepTrilogyEpilogue(current, .1);
  const journey = { scene: 'm3_dawn', actor: 'oracle', completed: [], epilogue: saved } as FilmJourney;
  const place = (clock: TrilogyEpilogueEncounter) => {
    const pose = gardenPose(clock, 'architect');
    Object.assign(architect, { isInMatrix: true, currentLocation: 'film_sunrise_garden', position: filmPosition('film_sunrise_garden', pose.x, pose.z),
      rotation: pose.yaw, currentAction: { type: 'idle', parameters: { epilogue: { ...clock, role: 'architect' } }, startedAt: 0, duration: 1e9, progress: 0 } });
    renderer.updateAgent('architect', architect);
  };
  const expected = (clock: TrilogyEpilogueEncounter) => { const pose = gardenPose(clock, 'architect'); return filmPosition('film_sunrise_garden', pose.x, pose.z); };
  try {
    place(saved); renderer.setPlayer('oracle');
    renderer.setPlayerMotion({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, epilogue: { ...current, role: 'oracle' } });
    const action = structuredClone(architect.currentAction);
    renderer.update(0, undefined, 0, 0, journey);
    assert.ok(renderer.getAgent('architect')!.position.distanceTo(expected(current)) < 1e-7, 'the Architect cannot wait for the slow world snapshot and jump');
    const paused = renderer.getAgent('architect')!.position.clone();
    renderer.update(.8, undefined, 0, 0, journey);
    assert.ok(renderer.getAgent('architect')!.position.equals(paused), 'render time cannot advance the authoritative saved departure');
    assert.deepEqual(architect.currentAction, action, 'rendering cannot rewrite the saved NPC action');
    const later = stepTrilogyEpilogue(current, .1); place(later); journey.epilogue = later;
    renderer.update(0, undefined, 0, 0, journey);
    assert.ok(renderer.getAgent('architect')!.position.distanceTo(expected(later)) < 1e-7, 'an older player frame cannot rewind a newer world snapshot');
    architect.controller = 'other'; architect.position.x += 4; renderer.updateAgent('architect', architect);
    renderer.update(0, undefined, 0, 0, journey);
    assert.ok(renderer.getAgent('architect')!.position.distanceTo(new THREE.Vector3(architect.position.x, architect.position.y, architect.position.z)) < 1e-7, 'another player retains the occupied body');
    architect.controller = undefined; place(saved); journey.epilogue = current; journey.visiting = 'm3_dawn';
    renderer.update(0, undefined, 0, 0, journey);
    assert.ok(renderer.getAgent('architect')!.position.distanceTo(expected(saved)) < 1e-7, 'visiting a set cannot play a different timeline over the saved body');
  } finally { renderer.dispose(); globalThis.document = originalDocument; }
});

test('the journal exposes the witness, promise and explicit final confirmation', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const dawn = FILM_SCENE_BY_ID.m3_dawn;
  const player = { id: 'oracle', status: 'alive', isInMatrix: true, position: filmStepPosition(dawn, dawn.steps[2]) } as AgentState;
  const base = { scene: dawn.id, actor: 'oracle', step: 2, completed: [], lastText: '建筑师承诺放行。', reflections: {}, epilogue: { ...newTrilogyEpilogue('dawn'), phase: 'choice' } };
  let html = renderFilmJourney(player, { neoLife: { journey: base } } as unknown as SandboxState);
  assert.match(html, /离开矩阵|和平/);
  html = renderFilmJourney(player, { neoLife: { journey: { ...base, step: dawn.steps.length, epilogue: { ...base.epilogue, phase: 'done' } } } } as unknown as SandboxState);
  assert.match(html, /确认完成本轮三部曲/); assert.match(html, /下一轮不会自动开始/);
});
