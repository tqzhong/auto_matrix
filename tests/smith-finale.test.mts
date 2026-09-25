import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import {
  FILM_SCENE_BY_ID,
  SMITH_FINALE,
  filmStepPosition,
  newSmithFinale,
  retrySmithFinale,
  smithFinaleAction,
  smithFinaleLocked,
  stepSmithFinale,
  type SandboxState,
  type WorldEvent,
} from '@auto_matrix/shared';
import { SmithFinaleRenderer } from '../packages/client/src/engine/SmithFinaleRenderer.js';
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
  const action = (kind: string) => players.act('p', kind, ++tick);
  const frame = (count = 1, focus = false, x = 0, z = 0) => { for (let i = 0; i < count; i++) {
    tick += .05; players.receiveInput('p', { x, z, yaw: 0, sprint: false, jump: false, focus, sequence: ++sequence });
    players.step(.05, true, tick); sandbox.tick(tick);
  } };
  return { world, sandbox, players, command, action, frame, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the Smith finale has action windows, an air checkpoint and a deliberate crater rise', () => {
  let duel = { ...newSmithFinale(), phase: 'ground_warning' as const };
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.ground.warning);
  assert.equal(duel.phase, 'ground_dodge'); assert.equal(smithFinaleLocked(duel), true);
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.ground.dodge + .1);
  assert.equal(duel.phase, 'failed'); assert.equal(duel.checkpoint, 'ground');
  duel = retrySmithFinale(duel); assert.equal(duel.phase, 'ready'); assert.equal(duel.attempts, 1);

  duel = { ...duel, phase: 'ground_dodge' };
  duel = smithFinaleAction(duel, 'dodge'); assert.equal(duel.phase, 'ground_counter');
  duel = smithFinaleAction(duel, 'attack');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, .4);
  duel = smithFinaleAction(duel, 'attack'); assert.equal(duel.phase, 'shockwave');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.shockwave);
  assert.equal(duel.phase, 'air_warning'); assert.equal(duel.checkpoint, 'air');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.air.warning);
  duel = smithFinaleAction(duel, 'dodge'); assert.equal(duel.phase, 'air_counter');
  duel = smithFinaleAction(duel, 'attack'); assert.equal(duel.phase, 'building');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.building);
  assert.equal(duel.phase, 'descent');
  duel = stepSmithFinale(duel, { focus: true, x: .5, z: 1 }, SMITH_FINALE.descent.braceSeconds);
  assert.equal(duel.phase, 'crater'); assert.ok(duel.lane > 0);
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, 4);
  assert.equal(duel.phase, 'crater', 'the game cannot choose to rise for Neo');
  duel = stepSmithFinale(duel, { focus: true, x: 0, z: 0 }, SMITH_FINALE.crater.riseSeconds);
  assert.equal(duel.phase, 'choice');
});

test('Neo must finish the pact, duel, reflection, surrender and purge as one saved encounter', () => {
  const h = game(); const previous = FILM_SCENE_BY_ID.m3_deus; const rain = FILM_SCENE_BY_ID.m3_rain;
  const state = h.state(); Object.assign(state, { scene: previous.id, actor: 'neo', step: previous.steps.length,
    deus: { phase: 'connected', elapsed: 0, total: 0, resolve: 3, consent: 1.8, attempts: 0 } });
  h.sandbox.state.neoLife!.choices.machine_pact = 'peace'; h.sandbox.state.neoLife!.choices.machine_connection = 'active';
  h.actor().currentLocation = previous.set; h.actor().isInMatrix = false; h.command('next');
  assert.equal(state.scene, rain.id); assert.equal(state.smithFinale?.phase, 'approach');
  h.actor().position = filmStepPosition(rain, rain.steps[0]);
  // Reaching is evaluated by the simulation tick, so drive one controller frame as the player.
  h.frame(); assert.equal(state.step, 1); assert.equal(state.smithFinale?.phase, 'ready');
  h.actor().position = filmStepPosition(rain, rain.steps[1]);
  h.world.agents.get('smith')!.controller = 'other'; assert.match(h.command('act'), /另一位玩家/);
  h.world.agents.get('smith')!.controller = undefined; assert.match(h.command('act'), /闪避/);
  h.frame(20); assert.equal(state.smithFinale?.phase, 'ground_dodge');
  h.action('dodge');
  h.action('attack'); h.frame(8); h.action('attack');
  for (let i = 0; i < 80 && state.smithFinale?.phase !== 'air_dodge'; i++) h.frame();
  assert.equal(state.smithFinale?.phase, 'air_dodge'); h.action('dodge'); h.action('attack');
  h.frame(35); h.frame(35, true, .5, 1); h.frame(45, true);
  assert.equal(state.smithFinale?.phase, 'choice'); assert.equal(state.step, 2);
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  assert.equal(h.state().smithFinale?.phase, 'choice');
  h.command('reflect:agency'); assert.equal(h.state().step, rain.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm3_surrender'); assert.equal(h.state().smithFinale?.phase, 'assault_ready');
  h.actor().position = filmStepPosition(FILM_SCENE_BY_ID.m3_surrender, FILM_SCENE_BY_ID.m3_surrender.steps[0]);
  h.command('act'); h.frame(90); assert.equal(h.state().smithFinale?.phase, 'vision'); assert.equal(h.state().step, 1);
  h.command('reflect:trust'); assert.equal(h.state().smithFinale?.phase, 'understanding'); assert.equal(h.state().step, 2);
  h.command('act'); h.frame(45, false); assert.equal(h.state().smithFinale?.phase, 'surrender');
  h.frame(40, true); h.frame(150, true); assert.equal(h.state().smithFinale?.phase, 'done');
  assert.equal(h.state().step, FILM_SCENE_BY_ID.m3_surrender.steps.length);
  assert.equal(h.sandbox.state.neoLife!.choices.smith_resolution, 'connection');
});

test('the dedicated avenue renders the crowd, aerial collision, crater and purge from saved state', () => {
  const root = new THREE.Group(); const renderer = new SmithFinaleRenderer(root);
  for (const name of ['smith-finale-avenue', 'smith-finale-crowd', 'smith-finale-rain', 'smith-finale-lightning',
    'smith-finale-shockwave', 'smith-finale-air-trails', 'smith-finale-building-breach', 'smith-finale-crater',
    'smith-finale-assimilation', 'smith-finale-purge']) assert.ok(root.getObjectByName(name), name);
  const encounter = { ...newSmithFinale(), phase: 'shockwave' as const, elapsed: .8, total: 2 };
  renderer.update(encounter, false, { x: 0, z: -15 });
  assert.equal(root.getObjectByName('smith-finale-shockwave')!.visible, true);
  renderer.update({ ...encounter, phase: 'descent', elapsed: 1.2 }, false, { x: 0, z: -30 });
  assert.equal(root.getObjectByName('smith-finale-crater')!.visible, true);
  renderer.update({ ...encounter, phase: 'assimilating', elapsed: 2 }, true, { x: 0, z: -38 });
  assert.equal(root.getObjectByName('smith-finale-assimilation')!.visible, true);
  renderer.update({ ...encounter, phase: 'purging', elapsed: 1.3 }, false, { x: 0, z: -38 });
  assert.equal(root.getObjectByName('smith-finale-purge')!.visible, true);
  const disposed: string[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.addEventListener('dispose', () => disposed.push(object.uuid)); });
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('the finale journal exposes combat windows, the philosophical stop and explicit assimilation consent', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const rain = FILM_SCENE_BY_ID.m3_rain; const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmStepPosition(rain, rain.steps[1]) };
  const base = { scene: rain.id, actor: 'neo', step: 1, completed: [], lastText: 'Smith 抬手。', reflections: {}, smithFinale: { ...newSmithFinale(), phase: 'ground_dodge' } };
  let html = renderFilmJourney(player, { neoLife: { journey: base } } as unknown as SandboxState);
  assert.match(html, /现在按 X/); assert.match(html, /地面交锋/);
  html = renderFilmJourney(player, { neoLife: { journey: { ...base, step: 2, smithFinale: { ...base.smithFinale, phase: 'choice' } } } } as unknown as SandboxState);
  assert.match(html, /为什么继续|选择/);
  const surrender = FILM_SCENE_BY_ID.m3_surrender;
  html = renderFilmJourney({ ...player, position: filmStepPosition(surrender, surrender.steps[2]) }, { neoLife: { journey: {
    ...base, scene: surrender.id, step: 2, smithFinale: { ...base.smithFinale, phase: 'understanding' },
  } } } as unknown as SandboxState);
  assert.match(html, /停止抵抗|接受同化/); assert.match(html, /按住 G|明确/);
});
