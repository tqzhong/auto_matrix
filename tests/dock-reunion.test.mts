import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmPosition, filmStepPosition, newDockGate, groundHeight, playerBlocked, type WorldEvent, type WorldStructure } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function fixture(forward = false) {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_emp;
  Object.assign(state, { scene: scene.id, actor: 'link', step: scene.steps.length, emp: { firedAt: 7, elapsed: 9 } });
  if (forward) state.dockGate = { ...newDockGate(5, -50), phase: 'done' };
  state.completed.push(scene.id);
  players.possess('p', 'link', 2); const link = players.getAgent('p')!;
  Object.assign(link, { currentLocation: scene.set, isInMatrix: false, position: filmEntry(scene) });
  const command = (target: string, tick = 10) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  return { world, sandbox, players, state, link, command };
}

test('EMP leads to Link exiting and meeting Zee before the temple game extension', () => {
  const h = fixture(); h.command('next');
  assert.equal(h.state.scene, 'm3_dock_reunion', 'the route must not omit the dock reunion');
  assert.equal(h.state.actor, 'link');
  assert.equal(h.link.currentLocation, 'film_zion_hangar');
  assert.equal(h.state.emp?.firedAt, 7, 'the EMP remains spent');
  assert.equal(h.state.templeSeal, undefined, 'the temple countdown cannot consume the reunion');
});

test('the expanded drill bay supports the player at its visible one-unit deck height', () => {
  const structures = [{ id: 'film:digger-body' }] as WorldStructure[];
  const point = filmPosition('film_zion_hangar', 20, 64), floor = FILM_SETS.film_zion_hangar.center.y;
  assert.equal(groundHeight(point, false, structures), floor + 1, 'a walking actor must not sink below the visible bay deck');
  assert.equal(groundHeight(filmPosition('film_zion_hangar', 7, 57), false, structures), floor);
});

test('the damaged hatch and crew leave the ship before Link descends, without taking an occupied crew member', () => {
  const h = fixture(), colt = h.world.agents.get('colt')!, roland = h.world.agents.get('roland')!;
  roland.health = 48; h.command('next');
  assert.equal(h.state.dockReunion?.departure, 0, 'a new reunion must start with the damaged door still attached');
  h.players.possess('other', 'colt', 10); const occupied = structuredClone(colt);
  h.command('act'); assert.equal(h.state.dockReunion?.phase, 'ready'); assert.deepEqual(colt, occupied);
  h.players.release('other', 10); h.command('act');
  assert.equal(h.state.dockReunion?.phase, 'disembarking');
  for (let i = 0; i < 18; i++) h.players.step(.1, true, 10);
  const snapshot = structuredClone(h.state.dockReunion), position = { ...roland.position };
  h.players.step(.1, false, 10); assert.deepEqual(h.state.dockReunion, snapshot);
  h.players.possess('other', 'colt', 10); h.players.step(.1, true, 10);
  assert.deepEqual(h.state.dockReunion, snapshot); assert.deepEqual(roland.position, position);
  h.players.release('other', 10); h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'link', 10);
  assert.deepEqual(h.sandbox.life.film.state!.dockReunion, snapshot);
  for (let i = 0; i < 130; i++) h.players.step(.1, true, 10);
  assert.equal(h.sandbox.life.film.state!.dockReunion?.phase, 'exiting');
  assert.equal(h.sandbox.life.film.state!.dockReunion?.elapsed, 0, 'the crew sequence does not consume Link’s held descent input');
  assert.equal(roland.health, 48, 'the assisted captain retains his injuries');
  assert.equal(h.world.agents.get('morpheus')!.currentLocation, 'film_zion_hangar');
  assert.equal(h.world.agents.get('niobe')!.currentLocation, 'film_zion_hangar');
});

for (const forward of [false, true]) test(`Link descends and meets Zee through pause, ownership and restore (${forward ? 'forward arrival' : 'legacy dock'})`, () => {
  const h = fixture(forward), zee = h.world.agents.get('zee')!, mifune = h.world.agents.get('mifune')!;
  zee.health = 62; mifune.status = 'dead'; mifune.health = 0;
  h.command('next'); let state = h.sandbox.life.film.state!;
  assert.equal(Boolean(state.dockReunion?.forward), forward);
  const meeting = filmStepPosition(FILM_SCENE_BY_ID.m3_dock_reunion, FILM_SCENE_BY_ID.m3_dock_reunion.steps[1], state);
  assert.ok(Math.abs(meeting.x - FILM_SETS.film_zion_hangar.center.x - (forward ? 33 : 7)) < 1e-6);
  assert.ok(Math.abs(meeting.z - FILM_SETS.film_zion_hangar.center.z - (forward ? 17.82 : 58.18)) < 1e-6);
  let sequence = 0, tick = 10;
  const frame = (focus = false, running = true, walk = false) => {
    const target = meeting;
    const yaw = walk ? Math.atan2(target.x - h.link.position.x, target.z - h.link.position.z) : h.link.rotation;
    h.players.receiveInput('p', { x: walk ? Math.sin(yaw) : 0, z: walk ? Math.cos(yaw) : 0, yaw, focus, sprint: false, jump: false, sequence: ++sequence });
    h.players.step(.1, running, ++tick); if (running) h.sandbox.tick(tick);
  };
  for (let i = 0; i < 10; i++) frame(true);
  assert.equal(state.dockReunion?.phase, 'ready', 'held input without starting the exit is not authorization to descend');
  h.command('act');
  for (let i = 0; i < 125 && state.dockReunion?.phase === 'disembarking'; i++) frame();
  assert.equal(state.dockReunion?.phase, 'exiting');
  for (let i = 0; i < 27; i++) frame(true);
  const saved = structuredClone(state.dockReunion), position = { ...h.link.position };
  for (let i = 0; i < 5; i++) frame(false);
  frame(true, false);
  assert.deepEqual(state.dockReunion, saved); assert.deepEqual(h.link.position, position);
  h.players.receiveInput('p', { x: 0, z: 0, yaw: 0, focus: true, sprint: false, jump: false, sequence: ++sequence });
  h.players.step(.1, true, tick, Date.now() + 500); assert.deepEqual(state.dockReunion, saved, 'stale input cannot lower the actor');
  h.players.release('p', tick); h.players.step(.1, true, ++tick); assert.deepEqual(state.dockReunion, saved);
  h.sandbox.restore(structuredClone(h.sandbox.state)); state = h.sandbox.life.film.state!;
  h.players.possess('p', 'link', tick); assert.deepEqual(state.dockReunion, saved); assert.deepEqual(h.link.position, position);
  for (let i = 0; i < 60 && state.step === 0; i++) frame(true);
  assert.equal(state.dockReunion?.phase, 'walking'); assert.equal(state.step, 1);
  assert.equal(playerBlocked(filmPosition('film_zion_hangar', 20, 38), false, 1.1, h.sandbox.state.structures), true, 'the crashed hull has matching movement obstruction');
  for (let i = 0; i < 140 && state.step === 1; i++) frame(false, true, true);
  assert.equal(state.step, 2, `normal player movement reaches Zee around the wreck: ${JSON.stringify(h.link.position)}, ${state.lastText}`);
  const approachPosition = { ...h.link.position };
  h.players.possess('other', 'zee', tick); const occupied = { ...zee.position };
  h.command('act'); assert.equal(state.dockReunion?.phase, 'walking'); assert.deepEqual(zee.position, occupied);
  h.players.release('other', tick); h.command('act');
  assert.equal(state.dockReunion?.phase, 'approaching', JSON.stringify({position:h.link.position, zee:zee.position, response:state.lastText, owners:[h.link.controller,zee.controller]}));
  assert.deepEqual(state.dockReunion?.approach, { x: approachPosition.x - FILM_SETS.film_zion_hangar.center.x, z: approachPosition.z - FILM_SETS.film_zion_hangar.center.z, yaw: h.link.rotation });
  for (let i = 0; i < 120 && state.dockReunion?.phase !== 'promise'; i++) frame();
  assert.equal(state.dockReunion?.phase, 'promise'); assert.equal(state.step, 2);
  for (let i = 0; i < 30; i++) frame();
  assert.equal(state.dockReunion?.phase, 'promise', 'Zee sees the pendant, but the player must explicitly answer');
  h.link.status = 'dead'; h.link.health = 0; h.command('retry');
  assert.equal(state.dockReunion?.phase, 'promise'); assert.equal(h.link.status, 'alive');
  h.command('act'); for (let i = 0; i < 20; i++) frame();
  const charming = structuredClone(state.dockReunion);
  h.players.possess('other', 'zee', tick); for (let i = 0; i < 10; i++) frame();
  assert.deepEqual(state.dockReunion, charming, 'the couple clock freezes when the partner is occupied');
  h.players.release('other', tick);
  for (let i = 0; i < 80 && state.dockReunion?.phase !== 'done'; i++) frame();
  assert.equal(state.dockReunion?.phase, 'done'); assert.ok(state.completed.includes('m3_dock_reunion'));
  assert.equal(h.sandbox.state.neoLife?.choices.link_zee_reunion, 'promise_kept');
  assert.equal(zee.health, 62, 'the reunion must not heal or revive a partner');
  assert.equal(mifune.status, 'dead'); assert.equal(state.emp?.firedAt, 7);
  const count = h.sandbox.state.neoLife!.journal.length; h.command('act'); assert.equal(h.sandbox.state.neoLife!.journal.length, count);
  h.command('next'); assert.equal(state.scene, 'm3_dock_briefing'); assert.equal(state.actor, 'niobe');
  assert.equal(h.sandbox.state.structures.some(s => s.id.startsWith('film:reunion:')), false);
});

test('older reunion saves do not replay the hatch, and disembarking never revives a dead crew member', () => {
  const h = fixture(); h.command('next');
  delete h.state.dockReunion!.departure;
  h.command('act'); assert.equal(h.state.dockReunion?.phase, 'exiting');
  assert.equal(h.state.dockReunion?.departure, undefined);
  const other = fixture(), morpheus = other.world.agents.get('morpheus')!;
  morpheus.status = 'dead'; morpheus.health = 0; const position = { ...morpheus.position };
  other.command('next'); other.command('act');
  for (let i = 0; i < 130; i++) other.players.step(.1, true, 10);
  assert.equal(other.state.dockReunion?.phase, 'exiting');
  assert.equal(morpheus.status, 'dead'); assert.equal(morpheus.health, 0); assert.deepEqual(morpheus.position, position);
});
