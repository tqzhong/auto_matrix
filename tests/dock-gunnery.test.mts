import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOCK_GUNNERY, FILM_SCENE_BY_ID, filmStepPosition, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
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
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const scene = FILM_SCENE_BY_ID.m3_dock_battle; const state = sandbox.life.film.state!;
  state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  players.possess('p', 'mifune', 2); const mifune = players.getAgent('p')!;
  mifune.currentLocation = scene.set; mifune.isInMatrix = false; mifune.position = filmStepPosition(scene, scene.steps[0]);
  const command = (target: string, tick: number) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  return { world, sandbox, players, scene, state, mifune, command };
}

test('Mifune must aim the APU cannon and protect Kid’s ammunition cart before the reload beat', () => {
  const h = game();
  h.command('act', 3);
  assert.equal(h.state.dockGunnery?.phase, 'firing');
  assert.equal(h.sandbox.state.threats.filter(threat => threat.scene === h.scene.id).length, 0, 'the dock has a dedicated gunner encounter');
  const initialAmmo = h.state.dockGunnery!.ammo;
  h.players.receiveInput('p', { x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sprint: false, sequence: 1 });
  h.players.act('p', 'shoot', 4);
  assert.equal(h.state.dockGunnery!.ammo, initialAmmo - 1);
  assert.equal(h.state.dockGunnery!.kills, 0, 'blind fire cannot clear the wave');
  for (let tick = 5; tick <= 30; tick++) h.sandbox.tick(tick);
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.life.film.state!.dockGunnery, saved.neoLife.journey.dockGunnery);
  const state = h.sandbox.life.film.state!, battle = state.dockGunnery!;
  let fireTick = 31;
  for (const target of battle.targets) {
    for (let shot = 0; target.health > 0 && shot < 4; shot++) {
      const yaw = Math.atan2(target.x, target.z - DOCK_GUNNERY.apuZ);
      h.sandbox.life.film.dockShoot(h.mifune, yaw, -.2, fireTick++);
    }
    assert.equal(target.health, 0, 'the cannon should disable a correctly aimed sentinel');
  }
  for (let tick = 31; tick < 70 && state.step === 0; tick++) h.sandbox.tick(tick);
  assert.equal(state.step, 1);
  assert.equal(state.dockGunnery?.phase, 'cleared');
  assert.equal(h.world.agents.get('kid')!.status, 'alive');
});

test('running out of APU ammunition fails immediately and keeps the checkpoint available', () => {
  const h = game(); h.command('act', 3);
  for (let shot = 0; shot < DOCK_GUNNERY.ammo; shot++) h.sandbox.life.film.dockShoot(h.mifune, 0, 0, 4 + shot);
  assert.equal(h.state.dockGunnery?.phase, 'failed');
  assert.equal(h.mifune.status, 'dead');
  h.command('retry', 30);
  assert.equal(h.state.dockGunnery?.ammo, DOCK_GUNNERY.ammo);
});

test('an older reload checkpoint returns to Mifune’s cannon without discarding the scene', () => {
  const h = game(); h.state.step = 1; h.mifune.position = filmStepPosition(h.scene, h.scene.steps[1]);
  h.command('act', 3);
  assert.equal(h.state.step, 0);
  assert.equal(h.state.dockGunnery?.phase, 'firing');
  assert.equal(h.mifune.position.z, filmStepPosition(h.scene, h.scene.steps[0]).z + DOCK_GUNNERY.apuZ);
});

test('a disconnected gunner freezes the wave until Mifune returns', () => {
  const h = game(); h.command('act', 3); h.sandbox.tick(4);
  const elapsed = h.state.dockGunnery!.elapsed;
  h.players.release('p', 4);
  for (let tick = 5; tick <= 30; tick++) h.sandbox.tick(tick);
  assert.equal(h.state.dockGunnery?.elapsed, elapsed);
  h.players.possess('p', 'mifune', 31); h.sandbox.tick(32);
  assert.ok(h.state.dockGunnery!.elapsed > elapsed && h.state.dockGunnery!.elapsed <= elapsed + 1);
});

test('unchecked sentinels can break the APU defense and retry restores a fresh wave', () => {
  const h = game(); h.command('act', 3);
  for (let tick = 4; tick < 160 && h.state.dockGunnery?.phase === 'firing'; tick++) h.sandbox.tick(tick);
  assert.equal(h.state.dockGunnery?.phase, 'failed');
  assert.equal(h.mifune.status, 'dead');
  h.command('retry', 161);
  assert.equal(h.state.dockGunnery?.phase, 'firing');
  assert.equal(h.state.dockGunnery?.attempts, 1);
  assert.equal(h.mifune.status, 'alive');
});

test('the dock shows the cannon, approaching sentinels and Kid’s ammunition cart', () => {
  const h = game(); h.command('act', 3);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  renderer.update(h.state, 0);
  assert.ok(root.getObjectByName('zion-ammo-cart'));
  assert.equal(root.getObjectByName('zion-dock-sentinel-1')?.visible, true);
  const cart = root.getObjectByName('zion-ammo-cart')!;
  const start = cart.position.z;
  for (let tick = 4; tick <= 8; tick++) h.sandbox.tick(tick);
  renderer.update(h.state, 2);
  assert.ok(cart.position.z > start);
  renderer.dispose(); assert.equal(root.children.length, 0);
});
