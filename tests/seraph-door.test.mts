import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, FILM_SETS, SERAPH_ORACLE, distance, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function game(id: 'm2_seraph' | 'm2_backdoors' = 'm2_seraph') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 84), conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1); players.possess('p', 'neo', 2);
  let tick = 2, frames = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const state = () => sandbox.life.film.state!, neo = world.agents.get('neo')!, seraph = world.agents.get('seraph')!;
  const scene = FILM_SCENE_BY_ID[id];
  const at = (index: number) => { neo.position = filmStepPosition(scene, scene.steps[index]); neo.rotation = Math.PI; };
  const ticks = (count: number) => { for (let i = 0; i < count; i++) { world.simulationTick = ++tick; sandbox.tick(tick); } };
  const frame = (count = 1) => { for (let i = 0; i < count; i++) { players.receiveInput('p', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, sequence: ++sequence }); players.step(.1, true, tick); if (++frames % 5 === 0) ticks(1); } };
  Object.assign(state(),{ scene: 'm2_departure',actor: 'neo',step: 5 }); command('next');
  state().step = 1; state().seraph = { dodges: 2,counters: 2,attempts: 0 };
  if (id === 'm2_backdoors') {
    const tea = FILM_SCENE_BY_ID.m2_seraph; neo.position = filmStepPosition(tea,tea.steps[1]); command('act');
    for(let i=0;i<700&&state().step===1;i++)frame(); assert.equal(state().step,2);
    neo.position = filmStepPosition(tea,tea.steps[1],state()); command('next'); assert.equal(state().scene,id);
  }
  const open = () => { at(1); command('act'); for (let i = 0; i < 700 && state().step === 1; i++) frame(); assert.equal(state().step, 2); };
  return { world, sandbox, players, scene, state, neo, seraph, at, command, frame, ticks, open, tick: () => tick };
}

test('world ticks alone cannot open the tea door while Seraph is still across the room', () => {
  const h = game(); h.at(1); const before = { ...h.seraph.position }; h.command('act'); h.ticks(20);
  assert.equal(h.state().step, 1, 'the actual key and push must finish first'); assert.deepEqual(h.seraph.position, before);
});

test('Seraph walks to the lock, works one key and pushes the leaf continuously before advancing once', () => {
  const h = game(); h.at(1); h.command('act'); let last = { ...h.seraph.position }, door = 0, moved = 0, turn = 0; const phases = new Set<string>();
  for (let i = 0; i < 700 && h.state().step === 1; i++) { h.frame(); const state = h.state().seraphDoor; phases.add(state?.phase ?? 'missing'); moved = Math.max(moved, distance(last, h.seraph.position)); turn = Math.max(turn, Math.abs((state?.door ?? 0) - door)); door = state?.door ?? 0; last = { ...h.seraph.position }; }
  assert.equal(h.state().step, 2); assert.equal(door, 1); assert.deepEqual(h.seraph.velocity, { x: 0, y: 0, z: 0 }, 'Seraph must stop walking after the push'); assert.ok(moved <= .36); assert.ok(turn <= .05);
  for (const phase of ['approaching','retrieving','inserting','unlocking','withdrawing','grasping','opening']) assert.ok(phases.has(phase), phase);
  const completed = h.state().completed.slice(); h.frame(20); assert.deepEqual(h.state().completed, completed);
});

test('the closed and open physical tea door stay solid while the opened center threshold is clear', () => {
  const h = game(); h.frame(); const z = -FILM_SETS[h.scene.set].depth / 2 + 1.63;
  assert.equal(playerBlocked(filmPosition(h.scene.set, 0, z), true, .2, h.sandbox.state.structures), true);
  h.open(); assert.equal(playerBlocked(filmPosition(h.scene.set, 0, z), true, .2, h.sandbox.state.structures), false);
  assert.equal(playerBlocked(filmPosition(h.scene.set, -2.6, z + 2.6), true, .2, h.sandbox.state.structures), true);
});

test('the hall starts with Seraph nearby, waits for Neo and requires the actual escort at the turn', () => {
  const h = game('m2_backdoors'); assert.ok(distance(h.neo.position, h.seraph.position) < 8); h.frame(150);
  assert.ok(distance(h.neo.position, h.seraph.position) <= 8.4, 'Seraph must wait instead of walking out of sight');
  h.at(0); h.ticks(2); assert.equal(h.state().step, 0, 'Neo cannot skip the real guide by reaching the marker alone');
  for (let i = 0; i < 450 && h.state().step === 0; i++) h.frame(); assert.equal(h.state().step, 1);
  assert.ok(Math.abs(h.seraph.position.z - FILM_SETS[h.scene.set].center.z - SERAPH_ORACLE.hall.turn.z) < 4); h.open();
});

test('another controller or an unavailable guide freezes the door without healing Seraph', () => {
  const h = game(); h.at(1); h.seraph.health = 63; h.seraph.controller = 'other'; h.command('act'); h.ticks(8); assert.equal(h.state().started, undefined);
  h.seraph.controller = undefined; h.command('act'); h.frame(30); const before = structuredClone(h.state().seraphDoor); assert.equal(Boolean(before), true); const position = { ...h.seraph.position };
  h.seraph.status = 'dead'; h.frame(20); assert.deepEqual(h.state().seraphDoor, before); assert.deepEqual(h.seraph.position, position);
  h.seraph.status = 'alive'; for (let i = 0; i < 700 && h.state().step === 1; i++) h.frame(); assert.equal(h.state().step, 2); assert.equal(h.seraph.health, 63);
});

test('reconnect and retry retain an in-progress opening, key state and both actual poses', () => {
  const h = game(); h.at(1); h.command('act'); for (let i = 0; i < 700 && h.state().seraphDoor?.phase !== 'opening'; i++) h.frame(); h.frame(6);
  const state = structuredClone(h.state().seraphDoor); assert.equal(state?.phase, 'opening'); const actors = ['neo','seraph'].map(id => structuredClone(h.world.agents.get(id)!));
  h.sandbox.restore(structuredClone(h.sandbox.state)); h.players.release('p', h.tick()); h.players.possess('p', 'neo', h.tick()); assert.deepEqual(h.state().seraphDoor, state);
  for (const before of actors) for (const key of ['position','rotation','velocity','health','currentAction'] as const) assert.deepEqual(h.world.agents.get(before.id)![key], before[key], before.id + '/' + key);
  assert.match(h.players.possess('other','seraph',h.tick()).error!, /开锁|门/); h.command('retry'); assert.deepEqual(h.state().seraphDoor, state); h.frame(100); assert.equal(h.state().step, 2);
});

test('an older key timer adopts the actual saved poses and wounds before replaying the physical lock', () => {
  const h = game(); h.neo.position = filmPosition(h.scene.set,0,-25); h.seraph.position = filmPosition(h.scene.set,2.8,-24); h.seraph.health = 63; h.state().started = h.tick()-1;
  const neo = { ...h.neo.position }, seraph = { ...h.seraph.position }; h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().seraphDoor?.phase,'approaching'); assert.equal(h.state().seraphDoor?.door,0); assert.equal(h.state().started,undefined); assert.deepEqual(h.neo.position,neo); assert.deepEqual(h.seraph.position,seraph); assert.equal(h.seraph.health,63);
  for(let i=0;i<700&&h.state().step===1;i++)h.frame(); assert.equal(h.state().step,2); assert.equal(h.seraph.health,63);
});

test('the opened passage waits for an available Seraph and carries his wounds into the hall', () => {
  const h = game(); h.seraph.health = 63; h.open(); const position = { ...h.seraph.position };
  h.seraph.controller = 'other'; h.command('next'); assert.equal(h.state().scene,'m2_seraph'); assert.deepEqual(h.seraph.position,position);
  h.seraph.controller = undefined; h.seraph.status = 'dead'; h.command('next'); assert.equal(h.state().scene,'m2_seraph'); assert.equal(h.seraph.status,'dead'); assert.deepEqual(h.seraph.position,position);
  h.seraph.status = 'alive'; h.neo.position = filmStepPosition(h.scene,h.scene.steps[1],h.state()); h.command('next'); assert.equal(h.state().scene,'m2_backdoors'); assert.equal(h.seraph.health,63);
});

test('loading an older tea trial restores the closed leaf collision before the key step exists', () => {
  const h = game(), z = -FILM_SETS[h.scene.set].depth/2+1.63; h.state().step = 0; delete h.state().seraphDoor;
  h.sandbox.state.structures = h.sandbox.state.structures.filter(s => s.id !== 'film:seraph:door'); h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(playerBlocked(filmPosition(h.scene.set,0,z),true,.2,h.sandbox.state.structures),true); assert.equal(h.state().seraphDoor,undefined);
});

test('after unlocking Neo must actually reach the open threshold before entering the hall', () => {
  const h = game(); h.open(); h.command('next'); assert.equal(h.state().scene,'m2_seraph');
  const target = filmStepPosition(h.scene,h.scene.steps[1],h.state()), center = FILM_SETS[h.scene.set].center;
  assert.equal(target.x,center.x); assert.ok(Math.abs(target.z-center.z-(-FILM_SETS[h.scene.set].depth/2+1.83))<1e-9);
  h.neo.position = target; h.command('next'); assert.equal(h.state().scene,'m2_backdoors');
});
