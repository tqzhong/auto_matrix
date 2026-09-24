import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmEntry, filmStepPosition, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); const manager = new AgentManager(world); manager.initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false, startConversation: () => false } as unknown as ConversationEngine;
  const actions = { execute() {} } as unknown as ActionExecutor;
  const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
  let tick = 0; let sequence = 0;
  players.possess('film-player', 'neo', tick); sandbox.life.begin(world.agents.get('neo')!, tick); sandbox.state.neoLife!.chapter = 1;
  players.sandboxAction('film-player', { kind: 'life', target: 'film:continue' }, ++tick);
  const scene = FILM_SCENE_BY_ID.m3_bane; const state = sandbox.life.film.state!;
  Object.assign(state, { scene: scene.id, actor: 'neo', step: 0, bane: undefined, checkpoint: filmEntry(scene), completed: [], lastText: scene.context });
  const actor = players.getAgent('film-player')!;
  actor.currentLocation = scene.set; actor.isInMatrix = false; actor.position = filmEntry(scene);
  const command = (target: string) => players.sandboxAction('film-player', { kind: 'life', target: `film:${target}` }, ++tick);
  const act = (kind: string) => players.act('film-player', kind, ++tick);
  const frames = (count: number, focus = false, yaw = actor.rotation, x = 0, z = 0) => {
    players.receiveInput('film-player', { x, z, yaw, jump: false, sprint: false, focus, sequence: ++sequence });
    for (let i = 0; i < count; i++) players.step(.1, true, ++tick);
  };
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, scene, state, actor, command, act, frames, advance, tick: () => tick };
}

test('Neo must survive the power cut, fight Bane, lose his sight and use gold perception before freeing Trinity', () => {
  const h = setup(); const { state, scene } = h;
  h.actor.position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1); assert.equal(state.bane?.phase, 'ready');
  assert.match(h.command('act'), /Bane|电枪/); assert.equal(state.bane?.phase, 'gun_warning');
  state.completed.push('m1_pills');
  assert.match(h.command('visit:m1_pills'), /先完成/);
  assert.equal(state.visiting, undefined);
  assert.match(h.act('ability'), /现实|无法/); assert.equal(state.bane?.phase, 'gun_warning');
  h.frames(9); assert.equal(state.bane?.phase, 'gun_window');
  const gunGesture = h.world.agents.get('bane')?.currentAction?.startedAt;
  assert.equal(h.world.agents.get('bane')?.currentAction?.parameters.armed, true);
  h.frames(2); assert.equal(h.world.agents.get('bane')?.currentAction?.startedAt, gunGesture, 'the attack animation must not restart every frame');
  h.act('dodge'); assert.equal(state.bane?.phase, 'grapple');
  assert.equal(h.world.agents.get('bane')?.currentAction?.parameters.armed, false);
  assert.notEqual(h.world.agents.get('bane')?.currentAction?.startedAt, gunGesture);
  assert.match(h.act('attack'), /靠近|面向/);
  const before = h.actor.position.x;
  h.frames(3, false, h.actor.rotation, 1);
  assert.ok(h.actor.position.x > before + .2, 'Neo can close the distance during the grapple');
  const bane = h.world.agents.get('bane')!;
  h.actor.position = { ...bane.position, x: bane.position.x - 2 };
  h.actor.rotation = Math.atan2(bane.position.x - h.actor.position.x, bane.position.z - h.actor.position.z);
  h.act('attack'); h.frames(4); h.act('attack');
  assert.equal(state.bane?.phase, 'burning'); assert.equal(state.step, 1);
  h.frames(16);
  assert.equal(state.bane?.phase, 'blind');
  assert.equal(h.sandbox.state.neoLife!.choices.neo_eyes, 'burned');
  assert.equal(h.world.agents.get('bane')?.status, 'alive');
  h.frames(22, true);
  assert.equal(state.bane?.phase, 'pipe_window');
  h.act('dodge'); assert.equal(state.bane?.phase, 'counter');
  h.act('attack'); h.frames(4); h.act('attack');
  assert.equal(state.bane?.phase, 'defeated'); assert.equal(state.step, 2);
  assert.equal(h.world.agents.get('bane')?.status, 'dead');
  h.actor.position = filmStepPosition(scene, scene.steps[2]); h.command('act'); h.advance(4);
  assert.equal(state.step, scene.steps.length);
  assert.ok(state.completed.includes(scene.id));
  assert.equal(h.world.agents.get('trinity')?.status, 'alive');
});

test('the gun and blind checkpoints fail and retry without skipping the injury or losing saved focus', () => {
  const h = setup(); const { state, scene } = h;
  h.actor.position = filmStepPosition(scene, scene.steps[0]); h.advance(); h.command('act'); h.frames(28);
  assert.equal(state.bane?.phase, 'failed'); assert.equal(state.bane?.checkpoint, 'gun');
  assert.match(h.command('retry'), /重试/); assert.equal(state.bane?.attempts, 1);
  h.frames(9); h.act('dodge');
  const bane = h.world.agents.get('bane')!;
  h.actor.position = { ...bane.position, x: bane.position.x - 2 };
  h.actor.rotation = Math.atan2(bane.position.x - h.actor.position.x, bane.position.z - h.actor.position.z);
  h.act('attack'); h.frames(4); h.act('attack'); h.frames(16);
  assert.equal(state.bane?.phase, 'blind'); h.frames(8, true);
  const savedFocus = state.bane!.focus;
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state)));
  const restored = h.sandbox.life.film.state!;
  assert.equal(restored.bane?.focus, savedFocus);
  h.players.release('film-player', h.tick()); h.advance(20);
  assert.equal(restored.bane?.focus, savedFocus, 'disconnect does not advance the fight');
  h.players.possess('film-player', 'neo', h.tick()); h.frames(15, true); h.frames(20);
  assert.equal(restored.bane?.phase, 'failed'); assert.equal(restored.bane?.checkpoint, 'blind');
  h.command('retry'); assert.equal(restored.bane?.phase, 'blind'); assert.equal(restored.bane?.attempts, 2);
  assert.equal(h.sandbox.state.neoLife!.choices.neo_eyes, 'burned');
});

test('Bane controlled by another player cannot be taken over by the scene', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  h.players.possess('other-player', 'bane', h.tick());
  assert.match(h.command('act'), /另一位玩家/);
  assert.equal(h.state.bane?.phase, 'ready');
  assert.equal(h.players.getAgent('other-player')?.id, 'bane');
});

test('the scripted fight reserves Bane and Trinity after Neo starts it', () => {
  const h = setup(); h.actor.position = filmStepPosition(h.scene, h.scene.steps[0]); h.advance();
  h.command('act');
  assert.equal(h.state.bane?.phase, 'gun_warning');
  assert.match(h.players.possess('other-player', 'bane', h.tick()).error ?? '', /剧情|片段|交手/);
  assert.match(h.players.possess('other-player', 'trinity', h.tick()).error ?? '', /剧情|片段|交手/);
  assert.equal(h.players.getAgent('other-player'), undefined);
});

test('an unfinished old save restores Bane alive before replaying the new encounter', () => {
  const h = setup();
  h.state.step = 2;
  h.actor.position = filmStepPosition(h.scene, h.scene.steps[1]);
  const bane = h.world.agents.get('bane')!;
  bane.status = 'dead'; bane.health = 0;
  assert.match(h.command('act'), /电枪/);
  assert.equal(h.state.bane?.phase, 'gun_warning');
  assert.equal(bane.status, 'alive');
  assert.equal(bane.health, bane.maxHealth);
});
