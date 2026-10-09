import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCK_BRIEFING, FILM_SETS, FILM_SCENE_BY_ID, dockBriefingLift, dockBriefingRoot, filmEntry, filmPosition, groundHeight, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function fixture() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_dock_reunion;
  Object.assign(state, { scene: scene.id, actor: 'link', step: scene.steps.length, emp: { firedAt: 7, elapsed: 9 },
    dockReunion: { phase: 'done', elapsed: 0, floor: 0, departure: 26.2 } });
  state.completed.push('m3_emp', scene.id);
  players.possess('p', 'link', 2); const link = players.getAgent('p')!;
  Object.assign(link, { currentLocation: scene.set, isInMatrix: false, position: filmEntry(scene) });
  const command = (target: string, tick = 10) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  return { world, sandbox, players, state, command };
}

test('the three captains face Lock after the reunion, before the temple extension', () => {
  const h = fixture(), niobe = h.world.agents.get('niobe')!, roland = h.world.agents.get('roland')!;
  niobe.health = 61; niobe.activeEffects = [{ abilityId: 'injury', remainingTicks: 10, visualEffect: 'none' }];
  const effects = structuredClone(niobe.activeEffects); roland.health = 48; h.command('next');
  assert.equal(h.state.scene, 'm3_dock_briefing', 'the EMP cost cannot disappear into a direct jump to the temple');
  assert.equal(h.state.actor, 'niobe');
  assert.equal(niobe.health, 61); assert.equal(roland.health, 48);
  assert.deepEqual(niobe.activeEffects, effects, 'the change of viewpoint cannot erase a saved injury');
  assert.equal(h.state.emp?.firedAt, 7); assert.equal(h.state.templeSeal, undefined);
});

test('a lost participant stops the scene without reviving him or speaking through a dead body', () => {
  const h = fixture(); h.command('next'); h.command('act');
  for (let i = 0; i < 12; i++) h.players.step(.1, true, 10);
  const lock = h.world.agents.get('lock')!, age = h.state.dockBriefing!.elapsed, position = { ...lock.position };
  lock.status = 'dead'; lock.health = 0;
  for (let i = 0; i < 90; i++) h.players.step(.1, true, 10);
  assert.equal(h.state.dockBriefing!.elapsed, age, 'the film clock must wait for a real participant');
  assert.equal(lock.status, 'dead'); assert.equal(lock.health, 0); assert.deepEqual(lock.position, position);
  h.command('retry'); assert.equal(lock.status, 'dead'); assert.equal(h.state.step, 0);
  assert.match(h.state.lastText, /Lock.*信号/);
  h.players.possess('other', 'lock', 10); h.players.release('other', 10); h.players.step(.1, true, 10);
  assert.ok(h.state.dockBriefing!.elapsed > age, 'an explicit player rebuild permits continuation');
});

test('Niobe explicitly lowers the cage, walks to Lock and responds; dialogue and reflection cannot be skipped by timers', () => {
  const h = fixture(); h.command('next'); let state = h.sandbox.life.film.state!;
  let sequence = 0, tick = 10;
  const frame = (goal?: { x: number; z: number }, running = true) => {
    const actor = h.players.getAgent('p')!;
    const target = goal ? filmPosition('film_zion_personnel', goal.x, goal.z) : actor.position;
    const yaw = Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
    h.players.receiveInput('p', { x: goal ? Math.sin(yaw) : 0, z: goal ? Math.cos(yaw) : 0, yaw, focus: false, sprint: false, jump: false, sequence: ++sequence });
    h.players.step(.1, running, ++tick); if (running) h.sandbox.tick(tick);
  };
  for (let i = 0; i < 30; i++) frame();
  assert.equal(state.dockBriefing?.phase, 'ready'); assert.equal(state.step, 0);
  h.command('act'); for (let i = 0; i < 15; i++) frame();
  assert.equal(state.dockBriefing?.phase, 'lowering');
  const saved = structuredClone(state.dockBriefing), position = { ...h.players.getAgent('p')!.position };
  frame(undefined, false); assert.deepEqual(state.dockBriefing, saved); assert.deepEqual(h.players.getAgent('p')!.position, position);
  h.players.release('p', tick); for (let i = 0; i < 10; i++) h.players.step(.1, true, ++tick);
  assert.deepEqual(state.dockBriefing, saved);
  h.sandbox.restore(structuredClone(h.sandbox.state)); state = h.sandbox.life.film.state!;
  h.players.possess('p', 'niobe', tick); assert.deepEqual(state.dockBriefing, saved);
  assert.deepEqual(h.players.getAgent('p')!.position, position);
  for (let i = 0; i < 55 && state.step === 0; i++) frame();
  assert.equal(state.step, 1); assert.equal(state.dockBriefing?.phase, 'walking');
  assert.equal(h.players.getAgent('p')!.position.y, FILM_SETS.film_zion_personnel.center.y);
  assert.equal(h.sandbox.state.structures.some(s => s.id === 'film:briefing:gate'), false);
  for (let i = 0; i < 160 && state.step === 1; i++) frame(DOCK_BRIEFING.meeting);
  assert.equal(state.step, 2, `ordinary input must reach Lock with the escort: ${JSON.stringify(h.players.getAgent('p')!.position)}, ${state.lastText}`);
  assert.equal(state.dockBriefing?.escort, DOCK_BRIEFING.escortSeconds);
  h.command('act'); assert.equal(state.dockBriefing?.phase, 'greeting');
  for (let i = 0; i < 85; i++) frame();
  assert.equal(state.dockBriefing?.phase, 'reply'); assert.equal(state.step, 2, 'waiting cannot choose Niobe’s answer');
  h.command('act'); for (let i = 0; i < 135 && state.step === 2; i++) frame();
  assert.equal(state.dockBriefing?.phase, 'reflection'); assert.equal(state.step, 3);
  for (let i = 0; i < 30; i++) frame(); assert.equal(state.step, 3);
  h.command('reflect:care'); frame(); assert.equal(state.step, 4);
  const diary = h.sandbox.state.neoLife!.journal.length;
  h.command('reflect:care'); assert.equal(h.sandbox.state.neoLife!.journal.length, diary, 'the answer is recorded once');
  for (let i = 0; i < 160 && state.step === 4; i++) frame(DOCK_BRIEFING.exit);
  assert.equal(state.dockBriefing?.phase, 'done'); assert.ok(state.completed.includes('m3_dock_briefing'));
  assert.equal(state.emp?.firedAt, 7);
  h.command('next'); assert.equal(state.scene, 'm3_dock_evacuation', 'the next wave and last dock evacuation must precede the temple extension');
  assert.equal(h.sandbox.state.structures.some(s => s.id.startsWith('film:briefing:')), false);
  for (const role of ['morpheus', 'roland', 'lock']) assert.equal(h.world.agents.get(role)!.currentAction?.parameters.dockBriefing, undefined);
});

test('occupation freezes the saved lift without stealing the captains, and retry preserves other injuries and deaths', () => {
  const h = fixture(), roland = h.world.agents.get('roland')!, mifune = h.world.agents.get('mifune')!;
  roland.health = 48; mifune.status = 'dead'; mifune.health = 0; h.command('next'); h.command('act');
  for (let i = 0; i < 12; i++) h.players.step(.1, true, 10);
  const age = h.state.dockBriefing!.elapsed, position = { ...roland.position };
  h.players.possess('other', 'roland', 10); const occupied = structuredClone(roland);
  for (let i = 0; i < 15; i++) h.players.step(.1, true, 10);
  assert.equal(h.state.dockBriefing!.elapsed, age);
  assert.deepEqual(roland.position, occupied.position, 'ordinary gravity must keep the occupied captain on the stopped cage');
  for (const key of ['controller', 'status', 'health', 'currentLocation', 'rotation'] as const) assert.equal(roland[key], occupied[key]);
  assert.equal(roland.currentAction?.parameters.dockBriefing, undefined, 'the other player retains control of his own action');
  h.players.receiveInput('other', { x: -1, z: 0, yaw: -Math.PI / 2, jump: false, sprint: false, sequence: 1 });
  h.players.step(.1, true, 10);
  assert.ok(roland.position.x < occupied.position.x, 'pausing the shared scene must not confiscate the other player’s movement');
  assert.equal(roland.position.y, occupied.position.y);
  h.command('act'); assert.equal(h.state.dockBriefing!.elapsed, age);
  h.players.release('other', 10); h.players.step(.1, true, 10);
  assert.ok(h.state.dockBriefing!.elapsed > age); assert.equal(roland.health, 48);
  const niobe = h.players.getAgent('p')!; niobe.status = 'dead'; niobe.health = 0;
  const previous = structuredClone(h.state.dockBriefing); h.command('retry');
  assert.deepEqual(h.state.dockBriefing, previous); assert.equal(niobe.status, 'alive');
  assert.equal(mifune.status, 'dead'); assert.equal(roland.health, 48); assert.equal(h.state.emp?.firedAt, 7);
  assert.notDeepEqual(roland.position, position, 'after release the occupied captain rejoins the same moving cage');
});

test('crew standing footprints and the route agree with visible lift and pipe-bank collision', () => {
  const h = fixture(); h.command('next'); h.command('act');
  for (let i = 0; i < 12; i++) h.players.step(.1, true, 10);
  const deck = h.sandbox.state.structures.find(s => s.id === 'film:briefing:floor');
  assert.ok(deck, 'the delivered lift requires a saved physical support surface');
  assert.equal(groundHeight(h.world.agents.get('roland')!.position, false, h.sandbox.state.structures), deck.position.y);
  assert.equal(groundHeight(filmPosition('film_zion_personnel', 0, 0), false, h.sandbox.state.structures), FILM_SETS.film_zion_personnel.center.y);
  for (const elapsed of [0, .6, 1.5, 3.9, 4.2]) {
    const state = { phase: 'lowering', elapsed, escort: 0 } as const;
    for (const role of ['niobe', 'morpheus', 'roland'] as const) {
      const root = dockBriefingRoot(state, role);
      assert.equal(root.y, dockBriefingLift(state));
      assert.ok(Math.abs(root.x) < DOCK_BRIEFING.lift.width / 2 - .8);
      assert.ok(Math.abs(root.z - DOCK_BRIEFING.lift.z) < DOCK_BRIEFING.lift.depth / 2 - .8);
    }
  }
  assert.equal(playerBlocked(filmPosition('film_zion_personnel', 9.25, 0), false), true);
  assert.equal(playerBlocked(filmPosition('film_zion_personnel', 0, 0), false), false);
  assert.equal(playerBlocked(filmPosition('film_zion_personnel', -6, -14), false), false);
});

test('a save already at the temple is not rewound by inserting the earlier briefing', () => {
  const h = fixture(); Object.assign(h.state, { scene: 'm3_temple_defense', actor: 'zee', step: 1 });
  h.players.possess('p', 'zee', 10); h.sandbox.restore(structuredClone(h.sandbox.state));
  h.players.step(.1, false, 10);
  assert.equal(h.sandbox.life.film.state!.scene, 'm3_temple_defense');
  assert.equal(h.sandbox.life.film.state!.step, 1); assert.equal(h.sandbox.life.film.state!.dockBriefing, undefined);
});
