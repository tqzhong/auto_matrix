import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCK_EVACUATION, SHAFT_SEAL, FILM_SETS, FILM_SCENE_BY_ID, filmEntry, filmPosition, groundHeight, type WorldEvent } from '@auto_matrix/shared';
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
  const state = sandbox.life.film.state!, scene = FILM_SCENE_BY_ID.m3_dock_briefing;
  Object.assign(state, { scene: scene.id, actor: 'niobe', step: scene.steps.length, emp: { firedAt: 7, elapsed: 9 }, dockBriefing: { phase: 'done', elapsed: 0, escort: 4.6 } });
  state.completed.push('m3_emp', scene.id);
  for (const id of ['mifune', 'charra']) Object.assign(world.agents.get(id)!, { status: 'dead', health: 0 });
  world.agents.get('kid')!.health = 31; world.agents.get('colt')!.health = 53;
  world.agents.get('citizen_15')!.health = 40;
  players.possess('p', 'niobe', 2);
  Object.assign(players.getAgent('p')!, { currentLocation: scene.set, isInMatrix: false, position: filmEntry(scene) });
  let tick = 10, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  const frame = (goal?: { x: number; z: number }, input: { focus?: boolean; sprint?: boolean; jump?: boolean } = {}, running = true) => {
    const actor = players.getAgent('p')!, target = goal ? filmPosition(actor.currentLocation, goal.x, goal.z) : actor.position;
    const yaw = Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
    players.receiveInput('p', { x: goal ? Math.sin(yaw) : 0, z: goal ? Math.cos(yaw) : 0, yaw, focus: false, sprint: false, jump: false, ...input, sequence: ++sequence });
    players.step(.1, running, ++tick); if (running) sandbox.tick(tick);
  };
  const walk = (goal: { x: number; z: number }, max = 250) => {
    for (let i = 0; i < max; i++) {
      const p = players.getAgent('p')!.position, c = FILM_SETS[players.getAgent('p')!.currentLocation].center;
      if (Math.hypot(p.x - c.x - goal.x, p.z - c.z - goal.z) < .4) break;
      frame(goal, { sprint: true });
    }
  };
  const board = () => { walk({ x: 3, z: -12 }); walk({ x: 3, z: -19 }); walk(DOCK_EVACUATION.boarding); };
  command('next');
  return { world, sandbox, players, command, frame, walk, board, get state() { return sandbox.life.film.state!; } };
}
function unload(h: ReturnType<typeof fixture>) {
  h.walk(DOCK_EVACUATION.pickup); h.command('act');
  for (let i = 0; i < 20; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'carrying');
  h.walk(DOCK_EVACUATION.delivery, 400); h.command('act');
  for (let i = 0; i < 100 && h.state.dockEvacuation?.phase !== 'running'; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'running');
}
function clear(h: ReturnType<typeof fixture>) {
  unload(h); h.board();
  assert.equal(h.state.dockEvacuation?.phase, 'waiting', JSON.stringify({ position: h.players.getAgent('p')!.position, state: h.state.dockEvacuation }));
  for (let i = 0; i < 115; i++) h.frame();
  h.command('act');
  for (let i = 0; i < 80; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'clear');
}
test('normal player input unloads supplies, waits for the last crew and lowers the lift before shaft demolition', () => {
  const h = fixture(); assert.equal(h.state.scene, 'm3_dock_evacuation');
  assert.equal(h.players.getAgent('p')!.health, 31);
  for (let i = 0; i < 30; i++) h.frame();
  h.command('act'); assert.equal(h.state.dockEvacuation?.phase, 'supplies', 'G from the entry cannot reach the cargo');
  unload(h); const remaining = h.state.dockEvacuation!.remaining;
  h.command('next'); assert.equal(h.state.scene, 'm3_dock_evacuation');
  h.board();
  assert.equal(h.state.step, 3, JSON.stringify({ position: h.players.getAgent('p')!.position, state: h.state.dockEvacuation })); assert.equal(h.state.dockEvacuation?.phase, 'waiting');
  h.command('act'); assert.equal(h.state.dockEvacuation?.phase, 'waiting', 'closing early would abandon the approaching crew');
  for (let i = 0; i < 115; i++) h.frame();
  assert.ok(h.state.dockEvacuation!.remaining <= remaining);
  assert.equal(h.state.dockEvacuation?.phase, 'waiting', 'waiting cannot automatically close the cage');
  h.command('act'); for (let i = 0; i < 33; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'lowering');
  const deck = h.sandbox.state.structures.find(s => s.id === 'film:evacuation:floor')!;
  assert.equal(groundHeight(h.players.getAgent('p')!.position, false, h.sandbox.state.structures), deck.position.y);
  for (let i = 0; i < 50; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'clear');
  h.command('next'); assert.equal(h.state.scene, 'm3_shaft_seal'); assert.equal(h.players.getAgent('p')!.health, 40);
  h.walk(SHAFT_SEAL.operator); assert.equal(h.state.step, 1);
  for (let i = 0; i < 30; i++) h.frame(undefined, { focus: true });
  assert.equal(h.state.shaftSeal?.phase, 'ready', 'holding G without first gripping the bar cannot arm the lever');
  h.command('act'); for (let i = 0; i < 12; i++) h.frame();
  assert.equal(h.state.shaftSeal?.phase, 'armed');
  for (let i = 0; i < 8; i++) h.frame(undefined, { focus: true });
  const turn = h.state.shaftSeal!.turn; assert.ok(turn > .2 && turn < .8);
  for (let i = 0; i < 15; i++) h.frame();
  assert.equal(h.state.shaftSeal!.turn, turn, 'release keeps the real lever angle');
  for (let i = 0; i < 85; i++) h.frame(undefined, { focus: true });
  assert.equal(h.state.shaftSeal?.phase, 'done'); assert.equal(h.state.step, 2);
  const fired = h.state.shaftSeal?.firedAt; h.command('act'); assert.equal(h.state.shaftSeal?.firedAt, fired);
  const reflection = h.command('reflect:care'); assert.equal(h.state.step, 3, JSON.stringify({ reflection, state: h.state.shaftSeal, lastText: h.state.lastText }));
  const next = h.command('next'); assert.equal(h.state.scene, 'm3_temple_defense', JSON.stringify({ next, lastText: h.state.lastText }));
  assert.equal(h.world.agents.get('mifune')!.status, 'dead'); assert.equal(h.world.agents.get('charra')!.status, 'dead');
  assert.equal(h.world.agents.get('colt')!.health, 53); assert.equal(h.state.emp?.firedAt, 7);
});
test('missing the lift fails and retry preserves supplies and film consequences instead of repeating the EMP', () => {
  const h = fixture(); unload(h);
  for (let i = 0; i < 270; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'failed');
  h.command('next'); assert.equal(h.state.scene, 'm3_dock_evacuation');
  h.command('retry'); assert.equal(h.state.dockEvacuation?.phase, 'running'); assert.equal(h.state.step, 2);
  assert.equal(h.state.dockEvacuation?.delivered, true); assert.equal(h.state.dockEvacuation?.attempts, 1);
  assert.equal(h.state.emp?.firedAt, 7); assert.equal(h.world.agents.get('charra')!.status, 'dead');
  h.board(); assert.equal(h.state.dockEvacuation?.phase, 'waiting');
});
test('pause, disconnect, save restoration and an occupied crew member freeze the shaft lever', () => {
  const h = fixture(); clear(h); h.command('next'); h.walk(SHAFT_SEAL.operator); h.command('act');
  for (let i = 0; i < 14; i++) h.frame(undefined, { focus: true });
  const saved = structuredClone(h.state.shaftSeal), position = structuredClone(h.players.getAgent('p')!.position);
  h.frame(undefined, { focus: true }, false); assert.deepEqual(h.state.shaftSeal, saved);
  h.players.release('p', 1000); for (let i = 0; i < 12; i++) h.sandbox.tick(1001 + i);
  assert.deepEqual(h.state.shaftSeal, saved);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'citizen_15', 1014);
  assert.deepEqual(h.state.shaftSeal, saved); assert.deepEqual(h.players.getAgent('p')!.position, position);
  h.players.possess('other', 'lock', 1015); const lock = structuredClone(h.world.agents.get('lock')!);
  for (let i = 0; i < 30; i++) h.frame(undefined, { focus: true });
  assert.equal(h.state.shaftSeal?.turn, saved!.turn); assert.equal(h.world.agents.get('lock')!.controller, lock.controller);
  assert.deepEqual(h.world.agents.get('lock')!.position, lock.position);
  h.players.release('other', 1016); h.frame(undefined, { focus: true });
  assert.ok(h.state.shaftSeal!.turn > saved!.turn);
});
test('carrying keeps both hands occupied while ordinary walking remains available', () => {
  const h = fixture(); h.walk(DOCK_EVACUATION.pickup); h.command('act');
  for (let i = 0; i < 20; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'carrying');
  for (const action of ['attack', 'shoot', 'ability', 'ability2', 'dodge', 'talk', 'travel']) {
    const before = structuredClone(h.players.getAgent('p')!);
    assert.match(h.players.act('p', action, 700), /补给|双手/);
    assert.deepEqual(h.players.getAgent('p')!, before, `${action} must not replace the grip or spend a skill`);
  }
  const position = structuredClone(h.players.getAgent('p')!.position);
  h.walk({ x: -10, z: 24 }); assert.ok(h.players.getAgent('p')!.position.x > position.x + 2);
});
test('a partly lowered last lift freezes on pause, disconnect and Colt occupation, and restores its deck', () => {
  const h = fixture(); unload(h); h.board();
  for (let i = 0; i < 115; i++) h.frame();
  h.command('act'); for (let i = 0; i < 34; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.phase, 'lowering');
  const saved = structuredClone(h.state.dockEvacuation), position = structuredClone(h.players.getAgent('p')!.position);
  h.frame(undefined, {}, false); assert.deepEqual(h.state.dockEvacuation, saved);
  h.players.release('p', 2000); for (let i = 0; i < 12; i++) h.sandbox.tick(2001 + i);
  assert.deepEqual(h.state.dockEvacuation, saved);
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.possess('p', 'kid', 2014);
  assert.deepEqual(h.state.dockEvacuation, saved); assert.deepEqual(h.players.getAgent('p')!.position, position);
  assert.equal(groundHeight(position, false, h.sandbox.state.structures), position.y);
  h.players.possess('other', 'colt', 2015); const colt = structuredClone(h.world.agents.get('colt')!);
  for (let i = 0; i < 15; i++) h.frame();
  assert.equal(h.state.dockEvacuation?.elapsed, saved!.elapsed);
  assert.equal(h.world.agents.get('colt')!.controller, colt.controller); assert.deepEqual(h.world.agents.get('colt')!.position, colt.position);
  h.players.release('other', 2016); h.frame(); assert.ok(h.state.dockEvacuation!.elapsed > saved!.elapsed);
});
test('dead participants and an uncleared lift cannot be overwritten by changing viewpoint', () => {
  const h = fixture(); const colt = h.world.agents.get('colt')!; colt.status = 'dead'; colt.health = 0;
  const before = structuredClone(h.state.dockEvacuation);
  h.walk(DOCK_EVACUATION.pickup); h.command('act');
  assert.equal(h.state.dockEvacuation?.elapsed, before?.elapsed); assert.equal(colt.status, 'dead');
  h.command('retry'); assert.equal(colt.status, 'dead'); assert.equal(h.state.dockEvacuation?.phase, 'supplies');
  // A legacy temple save is kept at its own checkpoint; newly inserted nodes are not replayed.
  Object.assign(h.state, { scene: 'm3_temple_defense', actor: 'zee', step: 1 });
  h.players.possess('p', 'zee', 40); h.sandbox.restore(structuredClone(h.sandbox.state));
  h.players.step(.1, false, 41); assert.equal(h.state.scene, 'm3_temple_defense'); assert.equal(h.state.step, 1);
});
