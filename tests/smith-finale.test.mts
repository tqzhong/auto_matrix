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
  smithFinalePose,
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

test('reaching the avenue plays Smith leaving the curb, waits for Neo’s reply, and saves the opening before either fighter charges', () => {
  const h = game(), rain = FILM_SCENE_BY_ID.m3_rain, state = h.state();
  Object.assign(state, { scene: 'm3_deus', actor: 'neo', step: FILM_SCENE_BY_ID.m3_deus.steps.length,
    deus: { phase: 'connected', elapsed: 0, total: 0, resolve: 3, consent: 1.8, attempts: 0 } });
  h.sandbox.state.neoLife!.choices.machine_pact = 'peace'; h.sandbox.state.neoLife!.choices.machine_connection = 'active';
  h.actor().currentLocation = 'film_machine_core'; h.command('next');
  h.actor().position = filmStepPosition(rain, rain.steps[0]); h.frame();
  assert.equal(state.smithFinale?.phase, 'entrance', 'Smith must actually walk out instead of appearing at the combat position');
  const start = smithFinalePose(state.smithFinale!);
  assert.ok(start.smith.x > 19 && start.smith.z - start.neo.z > 40, 'start in the audience and preserve the distant face-off');
  h.frame(50); const before = structuredClone(state.smithFinale!), positions = [h.actor(), h.world.agents.get('smith')!].map(actor => structuredClone(actor.position));
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.state().smithFinale, before, 'the walk clock must survive restoration');
  assert.deepEqual([h.actor(), h.world.agents.get('smith')!].map(actor => actor.position), positions);
  h.world.agents.get('smith')!.controller = 'other'; h.frame(10);
  assert.deepEqual(h.state().smithFinale, before, 'do not advance through an occupied Smith');
  h.world.agents.get('smith')!.controller = undefined;
  for (let i = 0; i < 300 && h.state().smithFinale?.phase !== 'reply'; i++) h.frame();
  assert.equal(h.state().smithFinale?.phase, 'reply'); const waiting = h.state().smithFinale!.elapsed;
  h.frame(150); h.action('attack'); assert.equal(h.state().smithFinale?.phase, 'reply');
  assert.equal(h.state().smithFinale!.elapsed, waiting, 'time and ordinary punches cannot answer for Neo');
  assert.match(h.command('act'), /今晚/); assert.equal(h.state().smithFinale?.phase, 'prediction');
  for (let i = 0; i < 160 && h.state().smithFinale?.phase !== 'charge_ready'; i++) h.frame();
  assert.equal(h.state().smithFinale?.phase, 'charge_ready');
  h.command('act'); assert.equal(h.state().smithFinale?.phase, 'charging');
  h.frame(45); assert.equal(h.state().smithFinale?.phase, 'ground_warning');
});

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
  assert.equal(duel.phase, 'interior_warning');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.interior.warning);
  duel = smithFinaleAction(duel, 'dodge'); duel = smithFinaleAction(duel, 'attack');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.interior.kick);
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.relaunch);
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.air.warning);
  duel = smithFinaleAction(duel, 'dodge'); duel = smithFinaleAction(duel, 'attack');
  duel = stepSmithFinale(duel, { focus: false, x: 0, z: 0 }, SMITH_FINALE.grapple);
  assert.equal(duel.phase, 'descent');
  duel = stepSmithFinale(duel, { focus: true, x: .5, z: 1 }, SMITH_FINALE.descent.braceSeconds);
  assert.equal(duel.phase, 'descent');
  duel = stepSmithFinale(duel, { focus: true, x: 0, z: 0 }, SMITH_FINALE.descent.seconds - duel.elapsed);
  assert.equal(duel.phase, 'crater');
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
  h.frame(); assert.equal(state.step, 1); assert.equal(state.smithFinale?.phase, 'entrance');
  for (let i = 0; i < 300 && state.smithFinale?.phase !== 'reply'; i++) h.frame();
  h.command('act');
  for (let i = 0; i < 140 && state.smithFinale?.phase !== 'charge_ready'; i++) h.frame();
  h.world.agents.get('smith')!.controller = 'other'; assert.match(h.command('act'), /另一位玩家/);
  h.world.agents.get('smith')!.controller = undefined; assert.match(h.command('act'), /冲向/);
  for (let i = 0; i < 70 && state.smithFinale?.phase !== 'ground_dodge'; i++) h.frame();
  assert.equal(state.smithFinale?.phase, 'ground_dodge');
  h.action('dodge');
  h.action('attack'); h.frame(8); h.action('attack');
  for (let i = 0; i < 80 && state.smithFinale?.phase !== 'air_dodge'; i++) h.frame();
  assert.equal(state.smithFinale?.phase, 'air_dodge'); h.action('dodge'); h.action('attack');
  for (let i = 0; i < 100 && state.smithFinale?.phase !== 'interior_dodge'; i++) h.frame();
  assert.equal(state.smithFinale?.phase, 'interior_dodge'); h.action('dodge'); h.action('attack');
  for (let i = 0; i < 160 && state.smithFinale?.phase !== 'sky_dodge'; i++) h.frame();
  assert.equal(state.smithFinale?.phase, 'sky_dodge'); h.action('dodge'); h.action('attack');
  for (let i = 0; i < 180 && state.smithFinale?.phase !== 'choice'; i++) h.frame(1, true, .5, 1);
  assert.equal(state.smithFinale?.phase, 'choice'); assert.equal(state.step, 2);
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  assert.equal(h.state().smithFinale?.phase, 'choice');
  assert.equal(h.sandbox.state.structures.filter(s => s.id === 'film:smith:crater').length, 1, 'restoring must not duplicate the crater');
  assert.equal(h.sandbox.state.structures.find(s => s.id === 'film:smith:crater')!.film!.height, SMITH_FINALE.crater.depth);
  h.command('reflect:agency'); assert.equal(h.state().step, rain.steps.length);
  const crater = { position: { ...h.actor().position }, rotation: h.actor().rotation, smith: { ...h.world.agents.get('smith')!.position } };
  h.actor().health = 73;
  h.command('next'); assert.equal(h.state().scene, 'm3_surrender'); assert.equal(h.state().smithFinale?.phase, 'assault_ready');
  assert.deepEqual(h.actor().position, crater.position, 'the last exchange continues in the crater instead of sending Neo back to the avenue entrance');
  assert.equal(h.actor().rotation, crater.rotation, 'the same conversation cannot turn Neo away from Smith');
  assert.deepEqual(h.world.agents.get('smith')!.position, crater.smith);
  assert.equal(h.actor().health, 73, 'entering the next part of the same fight cannot erase injuries');
  h.frame(8, false, .5, 0);
  assert.ok(Math.abs(h.actor().position.y - crater.position.y) < .01, 'ordinary movement between the two chapters stays on the broken surface');
  const walked = { ...h.actor().position };
  h.players.release('p', h.tick()); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.actor().position, walked, 'reconnecting on the broken road must retain ordinary movement, not return to the entrance');
  h.command('act'); h.frame(45); assert.equal(h.state().smithFinale?.phase, 'failed');
  assert.equal(h.state().smithFinale?.checkpoint, 'pit');
  h.command('retry'); assert.equal(h.actor().health, 73, 'a pit retry cannot heal the injuries from the first bout');
  assert.equal(h.sandbox.state.structures.find(s => s.id === 'film:smith:crater')!.film!.height, SMITH_FINALE.crater.depth);
  for (let i = 0; i < 30 && h.state().smithFinale?.phase !== 'pit_dodge'; i++) h.frame();
  h.action('dodge'); h.frame(14); assert.equal(h.state().smithFinale?.phase, 'pit_counter');
  h.action('attack'); h.frame(16);
  const punch = structuredClone(h.state().smithFinale), punchPosition = structuredClone(h.actor().position);
  const punchSave = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(punchSave); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.state().smithFinale, punch); assert.deepEqual(h.actor().position, punchPosition);
  h.world.agents.get('smith')!.controller = 'other'; h.frame(10);
  assert.deepEqual(h.state().smithFinale, punch, 'a counter cannot continue through an occupied Smith');
  h.world.agents.get('smith')!.controller = undefined;
  for (let i = 0; i < 180 && h.state().smithFinale?.phase !== 'vision'; i++) h.frame();
  assert.equal(h.state().smithFinale?.phase, 'vision'); assert.equal(h.state().step, 1);
  assert.equal(smithFinalePose(h.state().smithFinale!).fallen, 1);
  h.frame(40, true); assert.equal(h.state().smithFinale?.phase, 'vision', 'getting up cannot precede the player’s understanding');
  h.command('reflect:trust'); assert.equal(h.state().smithFinale?.phase, 'pit_recovery'); assert.equal(h.state().step, 2);
  h.frame(40); assert.equal(h.state().smithFinale?.phase, 'pit_recovery');
  h.frame(36, true); assert.equal(h.state().smithFinale?.phase, 'understanding');
  h.command('act'); h.frame(45, false); assert.equal(h.state().smithFinale?.phase, 'surrender');
  h.frame(40, true); h.frame(Math.ceil((SMITH_FINALE.surrender.assimilationSeconds + SMITH_FINALE.surrender.purgeSeconds) / .05), true);
  assert.equal(h.state().smithFinale?.phase, 'done');
  assert.equal(h.state().step, FILM_SCENE_BY_ID.m3_surrender.steps.length);
  assert.equal(h.sandbox.state.neoLife!.choices.smith_resolution, 'connection');
});

test('the cleared Smith host restores the same Oracle in the crater and preserves her until the park handoff', () => {
  const h = game(), state = h.state(), oracle = h.world.agents.get('oracle')!;
  Object.assign(state, { scene: 'm3_surrender', actor: 'neo', step: 2, completed: ['m3_oracle_absorbed'],
    smithFinale: { ...newSmithFinale(), phase: 'purging', elapsed: 7.85, total: 30, impactAt: 10 } });
  h.actor().currentLocation = 'film_smith_avenue'; h.sandbox.life.film.reconcileCast();
  assert.equal(oracle.status, 'disconnected', 'the host must not reappear before the infection is cleared');
  const before = structuredClone(oracle.position), clock = structuredClone(state.smithFinale);
  oracle.controller = 'other'; h.frame(5);
  assert.deepEqual(oracle.position, before, 'restoration cannot move another player');
  assert.equal(state.smithFinale!.phase, 'purging', 'do not complete the ending while its host is occupied');
  assert.ok(state.smithFinale!.elapsed < 8, 'wait before restoring an occupied host');
  oracle.controller = undefined; h.frame(5);
  assert.equal(oracle.currentLocation, 'film_smith_avenue', 'the restored host belongs in the real crater, not her apartment');
  assert.equal(oracle.status, 'alive'); assert.equal(oracle.isInMatrix, true);
  assert.equal(oracle.currentAction?.parameters.oracleRestored, true);
  assert.equal(state.step, 2, 'hold the restoration shot before completing the scene');
  const restored = structuredClone(oracle.position);
  assert.ok(restored.y < h.actor().position.y + 1, 'the Oracle must lie on the crater floor');
  assert.ok(h.players.possess('other', 'oracle', h.tick()).error, 'a recovered, unconscious host cannot be made to walk away');
  const save = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(save); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(oracle.position, restored); assert.equal(oracle.currentAction?.parameters.oracleRestored, true);
  assert.ok(h.state().smithFinale!.total > clock!.total);
  h.frame(160); assert.equal(h.state().smithFinale!.phase, 'done');
  h.command('next'); assert.equal(h.state().scene, 'm3_ceasefire'); assert.deepEqual(oracle.position, restored);
  assert.equal(oracle.currentAction?.parameters.oracleRestored, true);
  Object.assign(h.state(), { scene: 'm3_neo_carried', actor: 'kid', step: FILM_SCENE_BY_ID.m3_neo_carried.steps.length });
  h.command('next'); assert.equal(h.actor().id, 'sati'); assert.equal(h.state().scene, 'm3_reset');
  assert.equal(oracle.currentAction?.parameters.oracleRestored, true, 'the street reset does not replay the Oracle’s arrival');
  h.command('act'); h.frame(190); h.command('next');
  assert.equal(h.actor().id, 'sati', 'the park handoff must wait until Sati has actually risen');
  assert.equal(h.state().scene, 'm3_reset');
  for (let i = 0; i < 160 && h.state().epilogue?.phase !== 'done'; i++) h.frame();
  assert.equal(h.state().epilogue?.phase, 'done'); h.command('next');
  assert.equal(h.actor().id, 'oracle'); assert.equal(h.state().scene, 'm3_dawn');
  assert.equal(oracle.currentAction?.parameters.oracleRestored, undefined, 'the later park scene must release the lying pose');
});

test('a missed landing reconnects to the same failed pose and only retry restores the road', () => {
  const h = game(), state = h.state();
  Object.assign(state, { scene: 'm3_rain', step: 1, actor: 'neo', smithFinale: {
    ...newSmithFinale(), phase: 'descent', elapsed: SMITH_FINALE.descent.seconds - .02, total: 12, checkpoint: 'air',
  } });
  h.actor().currentLocation = 'film_smith_avenue'; h.frame();
  assert.equal(state.smithFinale!.phase, 'failed');
  assert.ok(h.actor().currentAction?.parameters.smithFinale, 'failed impact must retain its body pose');
  const position = { ...h.actor().position }, smith = { ...h.world.agents.get('smith')!.position };
  h.frame(10, true, 1, 1);
  assert.deepEqual(h.actor().position, position);
  h.players.release('p', h.tick()); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.actor().position, position); assert.deepEqual(h.world.agents.get('smith')!.position, smith);
  assert.equal(h.sandbox.state.structures.find(s => s.id === 'film:smith:crater')!.film!.height, SMITH_FINALE.crater.depth);
  h.command('retry'); assert.equal(state.smithFinale!.phase, 'air_warning');
  assert.equal(h.sandbox.state.structures.some(s => s.id === 'film:smith:crater'), false);
});

test('the dedicated avenue renders the crowd, aerial collision, crater and purge from saved state', () => {
  const root = new THREE.Group(); const renderer = new SmithFinaleRenderer(root);
  for (const name of ['smith-finale-avenue', 'smith-finale-crowd', 'smith-finale-rain', 'smith-finale-lightning',
    'smith-finale-shockwave', 'smith-finale-air-trails', 'smith-finale-building-breach', 'smith-finale-crater',
    'smith-finale-purge']) assert.ok(root.getObjectByName(name), name);
  const encounter = { ...newSmithFinale(), phase: 'shockwave' as const, elapsed: .8, total: 2 };
  renderer.update(encounter, false, { x: 0, z: -15 });
  assert.equal(root.getObjectByName('smith-finale-shockwave')!.visible, true);
  renderer.update({ ...encounter, phase: 'descent', elapsed: 1.2 }, false, { x: 0, z: -30 });
  assert.equal(root.getObjectByName('smith-finale-crater')!.visible, false, 'the street is intact before the fighters reach it');
  renderer.update({ ...encounter, phase: 'crater', elapsed: 0 }, false, { x: 0, z: -38 });
  assert.equal(root.getObjectByName('smith-finale-crater')!.visible, true);
  renderer.update({ ...encounter, phase: 'assimilating', elapsed: 2 }, true, { x: 0, z: -38 });
  assert.equal(root.getObjectByName('smith-finale-code-shell'), undefined, 'coating belongs to the real character surfaces');
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

test('an interior timeout survives server restoration, occupation and retry at the same real floor', () => {
  const h = game(), state = h.state();
  Object.assign(state, { scene: 'm3_rain', actor: 'neo', step: 1, smithFinale: {
    ...newSmithFinale(), phase: 'interior_dodge', elapsed: SMITH_FINALE.interior.dodge - .02, total: 35,
    checkpoint: 'interior', breachedAt: 30,
  } });
  h.actor().currentLocation = 'film_smith_avenue'; h.frame();
  assert.equal(state.smithFinale!.phase, 'failed');
  const held = structuredClone(state.smithFinale), position = structuredClone(h.actor().position);
  assert.ok(position.y >= 15, 'failure cannot release Neo into ordinary street gravity');
  const saved = structuredClone(h.sandbox.state); h.players.release('p', h.tick()); h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  h.frame(10, true, 1, 1);
  assert.deepEqual(h.state().smithFinale, held); assert.deepEqual(h.actor().position, position);
  h.command('retry'); assert.equal(h.state().smithFinale!.phase, 'interior_warning');
  assert.equal(h.state().smithFinale!.breachedAt, 30);
  h.world.agents.get('smith')!.controller = 'other';
  const waiting = structuredClone(h.state().smithFinale); h.frame(20);
  assert.deepEqual(h.state().smithFinale, waiting, 'the new clock also waits for an occupied Smith');
});

test('production upgrades only old pre-collision checkpoints without replaying an existing descent', () => {
  for (const phase of ['air_warning', 'descent'] as const) {
    const h = game(), state = h.state();
    Object.assign(state, { scene: 'm3_rain', actor: 'neo', step: 1, smithFinale: {
      ...newSmithFinale(), phase, elapsed: .1, total: 30, checkpoint: 'air', roomFight: undefined,
    } });
    h.actor().currentLocation = 'film_smith_avenue'; h.frame();
    assert.equal(state.smithFinale!.roomFight, phase === 'air_warning' ? true : undefined);
    assert.equal(state.smithFinale!.phase, phase);
  }
});
