import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
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
  const sandbox = new SandboxSystem(world, dynamics, 84), conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1); players.possess('p', 'neo', 2);
  let tick = 2, frames = 0, sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  Object.assign(sandbox.life.film.state!, { scene: 'm2_hamann', actor: 'neo', step: FILM_SCENE_BY_ID.m2_hamann.steps.length }); command('next');
  const scene = FILM_SCENE_BY_ID.m2_oracle_message, state = () => sandbox.life.film.state!, actor = () => players.getAgent('p')!;
  const at = (index: number) => { actor().position = filmStepPosition(scene, scene.steps[index]); };
  const advance = (count: number) => { for (let i = 0; i < count; i++) { world.simulationTick = ++tick; sandbox.tick(tick); } };
  const frame = (count = 1) => { for (let i = 0; i < count; i++) {
    players.receiveInput('p', { x: 0, z: 0, yaw: actor().rotation, jump: false, sprint: false, sequence: ++sequence }); players.step(.1, true, tick);
    if (++frames % 5 === 0) advance(1);
  } };
  const open = () => { at(0); command('act'); for (let i = 0; i < 180 && state().step === 0; i++) frame(); assert.equal(state().step, 1); };
  return { world, sandbox, players, scene, state, actor, command, at, advance, frame, open, tick: () => tick };
}

test('world ticks alone cannot teleport the visitors into the room after answering the knock', () => {
  const h = game(), ballard = structuredClone(h.world.agents.get('ballard')!.position), malachi = structuredClone(h.world.agents.get('malachi')!.position);
  h.at(0); h.command('act'); h.advance(10);
  assert.equal(h.state().step, 0, 'the visible opening and walk must run before the next step');
  assert.deepEqual(h.world.agents.get('ballard')!.position, ballard); assert.deepEqual(h.world.agents.get('malachi')!.position, malachi);
});

test('Trinity reaches the door, opens it continuously and lets the guests walk through at bounded speed', t => {
  const h = game(), root = new THREE.Group(), room = new ZionHomecomingRenderer(root, 'film_zion_bedroom'); t.after(() => room.dispose());
  room.update(h.state(), 0); const leaf = root.getObjectByName('zion-bedroom-door')!;
  let angle = leaf.parent!.rotation.y, maximumTurn = 0, maximumMove = 0, trinityTravel = 0;
  h.at(0); h.command('act');
  for (let i = 0; i < 180 && h.state().step === 0; i++) {
    const positions = ['trinity', 'ballard', 'malachi'].map(id => ({ ...h.world.agents.get(id)!.position })); h.frame(); room.update(h.state(), i / 10);
    maximumTurn = Math.max(maximumTurn, Math.abs(leaf.parent!.rotation.y - angle)); angle = leaf.parent!.rotation.y;
    for (const [index, id] of ['trinity', 'ballard', 'malachi'].entries()) {
      const next = h.world.agents.get(id)!.position, moved = Math.hypot(next.x - positions[index].x, next.z - positions[index].z);
      if (id === 'trinity') trinityTravel += moved; else maximumMove = Math.max(maximumMove, moved);
    }
  }
  assert.equal(h.state().step, 1); assert.ok(trinityTravel > 1, 'Trinity must actually approach and work the door');
  assert.ok(maximumTurn <= .07, 'the door cannot jump a right angle in a frame'); assert.ok(maximumMove <= .31, 'the visitors must not teleport or slide eight metres');
});

test('the opened visible door leaf remains solid while the center threshold becomes passable', t => {
  const h = game(); h.open(); const root = new THREE.Group(), room = new ZionHomecomingRenderer(root, 'film_zion_bedroom'); t.after(() => room.dispose());
  room.update(h.state(), 0); root.updateMatrixWorld(true); const leaf = root.getObjectByName('zion-bedroom-door')!;
  const center = new THREE.Box3().setFromObject(leaf).getCenter(new THREE.Vector3());
  assert.equal(playerBlocked(filmPosition('film_zion_bedroom', center.x, center.z), false, .2, h.sandbox.state.structures), true, 'the visible open leaf must not lose all collision');
  assert.equal(playerBlocked(filmPosition('film_zion_bedroom', 0, 17.6), false, 1.1, h.sandbox.state.structures), false);
});

test('the disk cannot be awarded by the old timer before an actual saved handoff', () => {
  const h = game(); h.open(); h.at(1); h.command('act'); h.advance(8);
  assert.equal(h.state().step, 1); assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, undefined);
});

test('pausing and restoring the moving door preserves all four actors and the exact saved opening progress', () => {
  const h = game(); h.at(0); h.command('act');
  for (let i = 0; i < 100 && !(h.state().zionMessage?.door && h.state().zionMessage!.door < 1); i++) h.frame();
  assert.ok(h.state().zionMessage?.door && h.state().zionMessage!.door < 1, 'an actual intermediate opening state must exist');
  const actors = () => JSON.stringify(['neo', 'trinity', 'ballard', 'malachi'].map(id => h.world.agents.get(id))), before = actors(), saved = structuredClone(h.sandbox.state), progress = JSON.stringify(h.state().zionMessage);
  h.players.step(.1, false, h.tick()); assert.equal(actors(), before); h.sandbox.restore(saved); assert.equal(actors(), before); assert.equal(JSON.stringify(h.state().zionMessage), progress);
});

test('the old distant response radius cannot start either physical interaction', () => {
  const h = game(); h.actor().position = filmPosition(h.scene.set, 0, 9.5); h.command('act'); h.frame(30);
  assert.equal(h.state().step, 0); assert.equal(h.state().zionMessage?.phase, 'waiting');
  h.open(); h.actor().position = filmPosition(h.scene.set, 0, 9.5); h.command('act'); h.frame(40);
  assert.equal(h.state().zionMessage?.phase, 'offer'); assert.equal(h.state().step, 1); assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, undefined);
});

test('retry before and after the disk transfer preserves its unique owner and awards the delivery once', () => {
  const h = game(); h.open(); h.at(1); h.command('act');
  for (let i = 0; i < 80 && !(h.state().zionMessage?.phase === 'taking' && h.state().zionMessage!.elapsed > .3); i++) h.frame();
  assert.equal(h.state().zionMessage?.owner, 'ballard'); h.command('retry'); assert.equal(h.state().zionMessage?.phase, 'offer'); assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, undefined);
  h.command('act'); for (let i = 0; i < 80 && h.state().zionMessage?.owner !== 'neo'; i++) h.frame();
  assert.equal(h.state().zionMessage?.owner, 'neo'); h.command('retry'); assert.equal(h.state().zionMessage?.owner, 'neo'); assert.equal(h.state().zionMessage?.phase, 'stowing');
  h.frame(20); assert.equal(h.state().step, 2); assert.equal(h.state().zionMessage?.owner, 'stowed'); assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, 'yes');
  h.frame(40); assert.equal(h.state().completed.filter(id => id === h.scene.id).length, 1);
});

test('a controlled participant pauses staging without moving or healing the guests', () => {
  const h = game(), trinity = h.world.agents.get('trinity')!, malachi = h.world.agents.get('malachi')!;
  trinity.health = 43; malachi.health = 37; trinity.controller = 'player'; const before = JSON.stringify([trinity.position, malachi.position]); h.at(0); h.command('act'); h.frame(40);
  assert.equal(JSON.stringify([trinity.position, malachi.position]), before); assert.equal(h.state().zionMessage?.door, 0); assert.equal(trinity.health, 43); assert.equal(malachi.health, 37);
  delete trinity.controller; h.frame(); assert.ok(h.players.possess('other', 'trinity', h.tick()).error, 'another client cannot take an active door participant');
  for (let i = 0; i < 180 && h.state().step === 0; i++) h.frame(); assert.equal(h.state().step, 1); assert.equal(trinity.health, 43); assert.equal(malachi.health, 37);
});

test('a legacy disk timer keeps the actual saved poses and injuries until real handoff frames resume', () => {
  const h = game(), neo = h.actor(); h.players.release('p', h.tick()); h.state().step = 1; delete h.state().zionMessage; h.state().started = h.tick();
  neo.position = filmPosition(h.scene.set, 0, 9); neo.health = 63;
  h.world.agents.get('ballard')!.position = filmPosition(h.scene.set, 2, 11); h.world.agents.get('malachi')!.health = 38;
  const poses = JSON.stringify(['neo', 'trinity', 'ballard', 'malachi'].map(id => h.world.agents.get(id)!.position)); h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.equal(h.state().started, undefined); assert.equal(h.state().step, 1); assert.equal(h.state().zionMessage?.owner, 'ballard');
  assert.equal(JSON.stringify(['neo', 'trinity', 'ballard', 'malachi'].map(id => h.world.agents.get(id)!.position)), poses); assert.equal(neo.health, 63); assert.equal(h.world.agents.get('malachi')!.health, 38);
  h.players.possess('p', 'neo', h.tick()); for (let i = 0; i < 100 && h.state().step === 1; i++) h.frame();
  assert.equal(h.state().step, 2); assert.equal(h.sandbox.state.neoLife!.choices.oracle_disk_received, 'yes'); assert.equal(neo.health, 63); assert.equal(h.world.agents.get('malachi')!.health, 38);
});
