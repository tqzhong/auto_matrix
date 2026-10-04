import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  FILM_SCENE_BY_ID,
  filmStepPosition,
  newTrilogyEpilogue,
  stepTrilogyEpilogue,
  trilogyEpilogueLocked,
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
  let dawn = { ...newTrilogyEpilogue('dawn'), phase: 'cat' as const };
  for (let i = 0; i < 79; i++) dawn = stepTrilogyEpilogue(dawn, .1);
  assert.equal(dawn.phase, 'choice');
  assert.equal(trilogyEpilogueLocked(dawn), false, 'the Architect cannot choose the meaning of peace for the player');
});

test('Neo remains unresponsive while the transport is waiting or finished without advancing its clock', () => {
  for (const phase of ['ready', 'done'] as const) {
    const encounter = { ...newTrilogyEpilogue('neo_carried'), phase, total: 14.3 };
    assert.equal(trilogyEpilogueLocked(encounter), true, `${phase}: Neo cannot stand up between transport beats`);
    assert.deepEqual(stepTrilogyEpilogue(encounter, .1), encounter, `${phase}: the player still chooses when to continue`);
  }
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
  h.command('next'); assert.equal(h.actor().id, 'oracle');
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
  assert.equal(h.state().scene, 'm3_dawn', 'a saved completed transport must remain continuable');
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

  h.command('next'); const dawn = FILM_SCENE_BY_ID.m3_dawn;
  assert.equal(h.state().scene, dawn.id); assert.equal(h.actor().id, 'oracle');
  h.actor().position = filmStepPosition(dawn, dawn.steps[0]); h.frame(); assert.equal(h.state().step, 1);
  h.actor().position = filmStepPosition(dawn, dawn.steps[1]); h.command('act'); h.frame(170);
  assert.equal(h.state().epilogue?.phase, 'choice'); assert.equal(h.state().step, 2);
  h.command('reflect:trust'); assert.equal(h.state().epilogue?.phase, 'promise'); assert.equal(h.state().step, 3);
  h.actor().position = filmStepPosition(dawn, dawn.steps[3]); h.command('act'); h.frame(255);
  assert.equal(h.state().epilogue?.phase, 'done'); assert.equal(h.state().step, dawn.steps.length);
  assert.equal(h.state().finished, undefined, 'watching the sunrise must not silently start another cycle');
  h.command('next'); assert.equal(h.state().finished, true); assert.equal(h.sandbox.state.ending, 'peace');
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

test('each dedicated epilogue layer renders and disposes its physical story objects', () => {
  const expectations = [
    ['ceasefire', 'ceasefire-retreating-sentinel-1'],
    ['neo_carried', 'neo-machine-funeral-barge'],
    ['dawn', 'matrix-reset-black-cat'],
  ] as const;
  for (const [kind, name] of expectations) {
    const root = new THREE.Group(); const renderer = new TrilogyEpilogueRenderer(root, kind);
    assert.ok(root.getObjectByName(name), `${kind}: ${name}`);
    if (kind === 'neo_carried') {
      assert.ok(root.getObjectByName('neo-tray-rim-left'), 'the dark tray needs a visible silhouette');
      assert.ok(root.getObjectByName('neo-tray-body-light'), 'carried Neo needs a local key light');
    }
    const state = newTrilogyEpilogue(kind); state.phase = kind === 'ceasefire' ? 'retreat' : kind === 'neo_carried' ? 'departing' : 'sunrise'; state.elapsed = 1;
    renderer.update(state, 2);
    if (kind === 'neo_carried') assert.ok(root.getObjectByName('neo-body-transfer-tray')!.position.y > 1.05,
      'the tray must rise with the departing barge');
    const disposed: string[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
    renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
  }
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
