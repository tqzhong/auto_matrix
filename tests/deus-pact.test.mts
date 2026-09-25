import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import {
  DEUS_PACT,
  FILM_SCENE_BY_ID,
  deusPactLocked,
  deusPactPose,
  filmStepPosition,
  newDeusPact,
  stepDeusPact,
  type SandboxState,
  type WorldEvent,
} from '@auto_matrix/shared';
import { MachineCoreRenderer } from '../packages/client/src/engine/MachineCoreRenderer.js';
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
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  players.possess('p', 'neo', 1);
  let tick = 1; let sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  const frame = (count = 1, focus = false) => { for (let i = 0; i < count; i++) {
    tick += .05;
    players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, focus, sequence: ++sequence });
    players.step(.05, true, tick);
  } };
  return { world, sandbox, players, command, advance, frame, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the machine collective requires Neo to hold his ground before it hears the offer', () => {
  let pact = { ...newDeusPact(), phase: 'swarm' as const };
  for (let i = 0; i < 30; i++) pact = stepDeusPact(pact, false, .1);
  assert.equal(pact.phase, 'swarm'); assert.equal(pact.resolve, 0);
  for (let i = 0; i < 80 && pact.phase !== 'failed'; i++) pact = stepDeusPact(pact, false, .1);
  assert.equal(pact.phase, 'failed'); assert.equal(deusPactLocked(pact), false);

  pact = { ...newDeusPact(), phase: 'swarm' };
  const phases = new Set([pact.phase]);
  for (let i = 0; i < 200 && pact.phase !== 'terms'; i++) {
    pact = stepDeusPact(pact, true, .1); phases.add(pact.phase);
  }
  assert.deepEqual([...phases], ['swarm', 'forming', 'warning', 'terms']);
  assert.ok(pact.resolve >= DEUS_PACT.resolveSeconds);
  const warning = deusPactPose({ ...pact, phase: 'warning', elapsed: DEUS_PACT.seconds.warning * .7 });
  assert.ok(warning.face > .95 && warning.brace > .4 && warning.seated < .01);
});

test('the pact stops Zion before Neo consents to the physical connection, and resumes exact saves', () => {
  const h = game(); const previous = FILM_SCENE_BY_ID.m3_farewell; const scene = FILM_SCENE_BY_ID.m3_deus;
  const state = h.state(); state.scene = previous.id; state.actor = previous.actor; state.step = previous.steps.length;
  h.actor().currentLocation = previous.set; h.actor().isInMatrix = false;
  h.command('next');
  assert.equal(state.scene, scene.id); assert.equal(state.deus?.phase, 'approach');
  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1); assert.equal(state.deus?.phase, 'ready');
  h.actor().position = filmStepPosition(scene, scene.steps[1]);

  h.world.agents.get('deus_ex_machina')!.controller = 'other';
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.deus?.phase, 'ready');
  h.world.agents.get('deus_ex_machina')!.controller = undefined;
  assert.match(h.command('act'), /按住 G/); assert.equal(state.deus?.phase, 'swarm');
  h.frame(155, false); assert.equal(state.deus?.phase, 'failed');
  assert.match(h.command('retry'), /谈判平台/); assert.equal(state.deus?.phase, 'ready');

  h.command('act'); h.frame(240, true);
  assert.equal(state.deus?.phase, 'terms'); assert.equal(state.step, 2);
  assert.ok(h.actor().currentAction?.parameters.deusPact, 'Neo keeps a saved negotiation pose');
  h.command('reflect:care');
  assert.equal(state.step, 3); assert.equal(state.deus?.phase, 'pact');
  assert.equal(h.sandbox.state.neoLife!.choices.machine_pact, 'peace');
  assert.match(state.lastText, /停止|暂缓/);

  assert.match(h.command('act'), /连接座/); assert.equal(state.deus?.phase, 'seating');
  h.frame(80, false); assert.equal(state.deus?.phase, 'cabling');
  const saved = structuredClone(h.sandbox.state); const beat = structuredClone(state.deus);
  h.players.release('p', h.tick()); h.advance(20); assert.deepEqual(state.deus, beat, 'disconnect pauses the connection');
  h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.state().deus, beat); assert.ok(h.actor().currentAction?.parameters.deusPact);

  h.frame(160, false); assert.equal(h.state().deus?.phase, 'consent');
  h.frame(50, false); assert.equal(h.state().deus?.phase, 'consent', 'the neck probe waits for player consent');
  h.frame(50, true); assert.equal(h.state().deus?.phase, 'connecting');
  h.frame(50, true); assert.equal(h.state().deus?.phase, 'connected');
  assert.equal(h.state().step, scene.steps.length);
  assert.equal(h.sandbox.state.neoLife!.choices.machine_connection, 'active');
  h.command('next'); assert.equal(h.state().scene, 'm3_rain');
});

test('the machine core renders a traversable light tunnel, swarm face, seat, jacks and neck probe', () => {
  const root = new THREE.Group(); const renderer = new MachineCoreRenderer(root);
  for (const name of ['machine-core-light-tunnel', 'machine-core-footstep-ripples', 'machine-core-swarm',
    'machine-core-face', 'machine-core-seat', 'machine-core-body-jacks', 'machine-core-neck-probe'])
    assert.ok(root.getObjectByName(name), name);
  const encounter = { ...newDeusPact(), phase: 'swarm' as const, elapsed: 1, total: 1 };
  renderer.update(encounter, 2, false, { x: 0, z: -23 });
  assert.equal(root.getObjectByName('machine-core-swarm')!.visible, true);
  assert.equal(root.getObjectByName('machine-core-face')!.visible, false);
  renderer.update({ ...encounter, phase: 'warning', elapsed: 2 }, 4, false, { x: 0, z: -25 });
  assert.equal(root.getObjectByName('machine-core-face')!.visible, true);
  renderer.update({ ...encounter, phase: 'cabling', elapsed: 1.5 }, 6, false, { x: 0, z: -25 });
  assert.equal(root.getObjectByName('machine-core-body-jacks')!.visible, true);
  renderer.update({ ...encounter, phase: 'consent', elapsed: 1 }, 7, true, { x: 0, z: -25 });
  assert.equal(root.getObjectByName('machine-core-neck-probe')!.visible, true);
  const meshes: THREE.Mesh[] = []; root.traverse(item => { if (item instanceof THREE.Mesh) meshes.push(item); });
  assert.ok(meshes.length > 75, 'the core must be a dedicated physical set, not the old static sphere');
  const disposed: string[] = []; meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh.uuid)));
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('the Deus journal exposes the hold, failure, philosophy and consent states', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m3_deus;
  const player = { id: 'neo', status: 'alive', isInMatrix: false, position: filmStepPosition(scene, scene.steps[1]) };
  const base = { scene: scene.id, actor: 'neo', step: 1, completed: [], lastText: '机器群正在收拢。', reflections: {}, deus: { ...newDeusPact(), phase: 'swarm' } };
  let html = renderFilmJourney(player, { neoLife: { journey: base } } as unknown as SandboxState);
  assert.match(html, /按住 G/); assert.match(html, /谈判|机器群/);
  html = renderFilmJourney(player, { neoLife: { journey: { ...base, deus: { ...base.deus, phase: 'failed' } } } } as unknown as SandboxState);
  assert.match(html, /重试/);
  html = renderFilmJourney(player, { neoLife: { journey: { ...base, step: 2, deus: { ...base.deus, phase: 'terms' } } } } as unknown as SandboxState);
  assert.match(html, /共同|和平|风险/);
  html = renderFilmJourney(player, { neoLife: { journey: { ...base, step: 3, deus: { ...base.deus, phase: 'consent' } } } } as unknown as SandboxState);
  assert.match(html, /颈后|接入|G/);
});
