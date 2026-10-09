import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DOCK_GUNNERY, dockGunneryTarget, newDockGunnery, newDockLastStand, fireDockGunnery, stepDockGunnery, FILM_SCENE_BY_ID, filmStepPosition, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
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

test('aiming under a flying sentinel spends ammunition without damaging it', () => {
  const h = game(); h.command('act', 3);
  const battle = h.state.dockGunnery!, enemy = battle.targets[0], health = enemy.health;
  h.sandbox.life.film.dockShoot(h.mifune, Math.atan2(enemy.x, enemy.z - DOCK_GUNNERY.apuZ), .65, 4);
  assert.equal(enemy.health, health, 'horizontal alignment alone must not hit a target above the cannon');
  assert.equal(battle.ammo, DOCK_GUNNERY.ammo - 1);
});

test('a paused gunner target keeps the same rendered height after loading the scene', () => {
  const h = game(); h.command('act', 3);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    renderer.update(h.state, 2); const before = root.getObjectByName('zion-dock-sentinel-1')!.position.clone();
    renderer.update(structuredClone(h.state), 77);
    assert.deepEqual(root.getObjectByName('zion-dock-sentinel-1')!.position.toArray(), before.toArray());
  } finally { renderer.dispose(); }
});

test('APU barrels actually turn toward the saved three-dimensional aim', () => {
  const h = game(); h.command('act', 3);
  h.sandbox.life.film.dockShoot(h.mifune, Math.PI - .5, -.3, 4);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    renderer.update(h.state, 0); root.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const cannon = root.getObjectByName(`apu-cannon-${side}`)!;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cannon.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(forward.x > .25 && forward.y > .15, `barrel remains fixed: ${forward.toArray()}`);
    }
  } finally { renderer.dispose(); }
});

test('the last stand cannon burst is independent of the previous player aim', () => {
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  const journey = { scene: 'm3_dock_battle', actor: 'kid', step: 2, completed: [],
    dockLastStand: { ...newDockLastStand(), phase: 'attack', elapsed: 1.1, total: 1.1 } } as FilmJourney;
  try {
    renderer.update(journey, 0);
    const cannon = root.getObjectByName('apu-cannon-1')!, before = cannon.quaternion.clone();
    journey.dockGunnery = { ...newDockGunnery(0), phase: 'cleared', yaw: Math.PI + .8, pitch: -.5 };
    renderer.update(journey, 0);
    assert.ok(cannon.quaternion.angleTo(before) < 1e-8, 'saved free aim must not redirect the later scripted cannon burst');
  } finally { renderer.dispose(); }
});

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
  for (let tick = 31; tick < 90 && state.step === 0; tick++) {
    h.sandbox.tick(tick);
    for (const [index, target] of battle.targets.entries()) {
      if (target.spawnAt > battle.elapsed || target.health <= 0) continue;
      const point = dockGunneryTarget(battle, index), eye = DOCK_GUNNERY.eye;
      const yaw = Math.atan2(point.x - eye.x, point.z - eye.z), pitch = -Math.atan2(point.y - eye.y, Math.hypot(point.x - eye.x, point.z - eye.z));
      for (let shot = 0; target.health > 0 && shot < battle.targets.length * 3; shot++) {
        const health = battle.targets.reduce((sum, enemy) => sum + enemy.health, 0);
        h.sandbox.life.film.dockShoot(h.mifune, yaw, pitch, tick);
        assert.equal(battle.targets.reduce((sum, enemy) => sum + enemy.health, 0), health - 1,
          'each aimed shot hits either the target or a nearer sentinel blocking it');
      }
      assert.equal(target.health, 0, `the cannon should disable a correctly aimed sentinel: ${JSON.stringify({ index, point, yaw, pitch, shot: battle.lastShot })}`);
    }
  }
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

test('an in-progress four-target save keeps its ammunition, injuries and targets', () => {
  const h = game(); h.command('act', 3);
  Object.assign(h.state.dockGunnery!, { ammo: 11, hull: 64, elapsed: 7, targets: h.state.dockGunnery!.targets.slice(0, 4) });
  delete h.state.dockGunnery!.yaw; delete h.state.dockGunnery!.pitch;
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  assert.deepEqual(h.sandbox.life.film.state!.dockGunnery, saved.neoLife.journey.dockGunnery);
  assert.equal(h.sandbox.life.film.state!.dockGunnery!.targets.length, 4);
});

test('a downed sentinel has saved gravity-driven wreckage and shot effects that survive cold rendering', () => {
  const battle = newDockGunnery(0); battle.phase = 'firing';
  const point = dockGunneryTarget(battle, 0), eye = DOCK_GUNNERY.eye;
  const yaw = Math.atan2(point.x - eye.x, point.z - eye.z), pitch = -Math.atan2(point.y - eye.y, Math.hypot(point.x - eye.x, point.z - eye.z));
  for (let shot = 0; shot < 3; shot++) assert.equal(fireDockGunnery(battle, yaw, shot, pitch), true);
  const start = dockGunneryTarget(battle, 0), saved = structuredClone(battle);
  stepDockGunnery(battle, .5); assert.ok(dockGunneryTarget(battle, 0).y < start.y - 1);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_hangar');
  try {
    const journey = { scene: 'm3_dock_battle', actor: 'mifune', completed: [], dockGunnery: saved } as unknown as FilmJourney;
    renderer.update(journey, 999); root.updateMatrixWorld(true);
    assert.equal(root.getObjectByName('apu-gunnery-tracer')!.visible, true);
    assert.equal(root.getObjectByName('apu-sentinel-impact')!.visible, true);
    assert.equal(root.getObjectByName('zion-dock-sentinel-1')!.visible, true);
    journey.dockGunnery = battle; renderer.update(journey, 1000);
    assert.equal(root.getObjectByName('apu-gunnery-tracer')!.visible, false);
    assert.deepEqual(root.getObjectByName('zion-dock-sentinel-1')!.position.toArray(), Object.values(dockGunneryTarget(battle, 0)));
    for (let i = 0; i < 3; i++) stepDockGunnery(battle, 1);
    renderer.update(journey, 1001);
    const tails = root.getObjectByName('apu-sentinel-articulated-tails') as THREE.InstancedMesh;
    for (let arm = 0; arm < 8; arm++) {
      const matrix = new THREE.Matrix4(); tails.getMatrixAt(arm * 16 + 15, matrix);
      for (let vertex = 0; vertex < tails.geometry.attributes.position.count; vertex++) {
        const point = new THREE.Vector3().fromBufferAttribute(tails.geometry.attributes.position, vertex).applyMatrix4(matrix);
        assert.ok(point.y >= 0 && point.y < .6, `a grounded wreck's tail stays on the floor: ${point.y}`);
      }
    }
  } finally { renderer.dispose(); }
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

test('reconnecting while paused restores the pilot seat and saved aim before time advances', () => {
  const h = game(); h.command('act', 3);
  h.sandbox.life.film.dockGunneryFrame(h.mifune, 4, { x: 0, z: 0, yaw: Math.PI - .4, pitch: -.3, firstPerson: true, sprint: false, jump: false, sequence: 1 });
  const position = { ...h.mifune.position }, saved = structuredClone(h.sandbox.state);
  h.players.release('p', 4); h.sandbox.restore(saved); h.players.possess('p', 'mifune', 4);
  assert.deepEqual(h.mifune.position, position);
  assert.deepEqual(h.mifune.currentAction?.parameters.dockGunnery, { yaw: Math.PI - .4, pitch: -.3 });
  assert.equal(h.mifune.currentAction?.parameters.seated, true);
  assert.deepEqual(h.sandbox.life.film.state!.dockGunnery, saved.neoLife.journey.dockGunnery);
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
