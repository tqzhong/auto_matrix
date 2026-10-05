import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, filmStepPosition, newApuRun, type WorldEvent } from '@auto_matrix/shared';
import { DOCK_GATE, dockGateEye, dockGateOpen, fireDockGate, newDockGate, stepDockGate } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const conversations = { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine;
  const players = new PlayerController(world, conversations, { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  players.possess('p', 'neo', 0); sandbox.life.begin(world.agents.get('neo')!, 0);
  sandbox.state.neoLife!.chapter = 1; players.sandboxAction('p', { kind: 'life', target: 'film:start' }, 1);
  const scene = FILM_SCENE_BY_ID.m3_gate, journey = sandbox.life.film.state!;
  journey.scene = scene.id; journey.actor = 'kid'; journey.step = 2;
  journey.apu = { ...newApuRun(), x: 5, z: -50, phase: 'arrived', hull: 70 };
  players.possess('p', 'kid', 2); const kid = world.agents.get('kid')!;
  kid.currentLocation = scene.set; kid.isInMatrix = false; kid.position = filmStepPosition(scene, scene.steps[2]);
  const command = (target: string, tick = 3) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, tick);
  return { world, sandbox, players, journey, kid, command };
}

test('Gate Three cannot be opened by waiting at a console; the counterweight cable must be shot', () => {
  const h = setup(); h.command('act');
  assert.equal(h.journey.dockGate?.phase, 'aiming');
  for (let tick = 4; tick < 80; tick++) h.sandbox.tick(tick);
  assert.equal(h.journey.step, 2, 'elapsed time and G must not replace cutting the actual cable');
  assert.equal(h.journey.completed.includes('m3_gate'), false);
  assert.equal(h.kid.currentAction?.parameters.riding, true, 'Kid must remain in the APU at the gate');
});

function aim(gate: { x: number; z: number }) {
  const eye = dockGateEye(gate), dx = DOCK_GATE.cable.x - eye.x, dz = DOCK_GATE.cable.z - eye.z;
  return { yaw: Math.atan2(dx, dz), pitch: -Math.atan2(32 - eye.y, Math.hypot(dx, dz)) };
}

test('only aimed bursts damage the visible vertical cable; misses, pitch and duplicate shots matter', () => {
  const gate = newDockGate(5, -50); gate.phase = 'aiming'; const target = aim(gate);
  assert.equal(fireDockGate(gate, target.yaw, 0), false, 'horizontal fire passes below the cable');
  assert.equal(gate.ammo, DOCK_GATE.ammo - 1); assert.equal(gate.hits, 0);
  assert.equal(fireDockGate(gate, target.yaw, target.pitch), false, 'duplicate input cannot bypass fire cadence');
  for (let i = 0; i < DOCK_GATE.hits; i++) {
    stepDockGate(gate, .1); assert.equal(fireDockGate(gate, target.yaw, target.pitch), true);
  }
  assert.equal(gate.phase, 'opening'); assert.equal(dockGateOpen(gate), 0);
  const ammo = gate.ammo; assert.equal(fireDockGate(gate, target.yaw, target.pitch), false); assert.equal(gate.ammo, ammo);
  stepDockGate(gate, .1); assert.ok(Number.isFinite(gate.lastShot!.y));
});

test('the real controller preserves the damaged cable through pause, disconnect and restore, then hands off only after Hammer clears the gate', () => {
  const h = setup(); h.command('act'); const target = aim(h.journey.dockGate!);
  h.sandbox.life.film.dockGate.shoot(h.kid, target.yaw, target.pitch, 4);
  const saved = structuredClone(h.sandbox.state), position = { ...h.kid.position };
  h.players.step(.1, false, 5); assert.deepEqual(h.journey.dockGate, saved.neoLife.journey.dockGate);
  h.players.release('p', 6); h.sandbox.restore(saved);
  for (let tick = 7; tick < 20; tick++) h.sandbox.tick(tick);
  const journey = h.sandbox.life.film.state!;
  assert.deepEqual(journey.dockGate, saved.neoLife.journey.dockGate);
  h.players.possess('p', 'kid', 20); assert.deepEqual(h.kid.position, position);
  for (let i = 1; i < DOCK_GATE.hits; i++) {
    h.sandbox.life.film.dockGate.frame(h.kid, .1, 21 + i);
    h.sandbox.life.film.dockGate.shoot(h.kid, target.yaw, target.pitch, 21 + i);
  }
  assert.equal(journey.dockGate?.phase, 'opening'); h.command('next', 40); assert.equal(journey.scene, 'm3_gate');
  for (let i = 0; i < 52; i++) h.sandbox.life.film.dockGate.frame(h.kid, .1, 41 + i);
  assert.equal(journey.dockGate?.phase, 'entering'); assert.equal(journey.step, 2);
  h.world.agents.get('link')!.controller = 'other'; const held = structuredClone(journey.dockGate);
  h.sandbox.life.film.dockGate.frame(h.kid, .1, 100); assert.deepEqual(journey.dockGate, held);
  delete h.world.agents.get('link')!.controller;
  for (let i = 0; i < 65; i++) h.sandbox.life.film.dockGate.frame(h.kid, .1, 101 + i);
  assert.equal(journey.step, 3); assert.ok(journey.completed.includes('m3_gate'));
  const xp = h.sandbox.state.profiles.kid.xp;
  for (let i = 0; i < 20; i++) h.sandbox.life.film.dockGate.frame(h.kid, .1, 200 + i);
  assert.equal(h.sandbox.state.profiles.kid.xp, xp);
  h.command('next', 230); assert.equal(journey.scene, 'm3_emp'); assert.equal(journey.actor, 'link');
});

test('an exhausted or timed out gunner retries at the gate without replaying the drive or resurrecting Mifune', () => {
  const h = setup(); h.world.agents.get('mifune')!.status = 'dead'; h.world.agents.get('mifune')!.health = 0;
  h.command('act'); const gate = h.journey.dockGate!, savedRide = structuredClone(h.journey.apu);
  for (let i = 0; i < DOCK_GATE.ammo; i++) { h.sandbox.life.film.dockGate.frame(h.kid, .1, 5 + i); h.sandbox.life.film.dockGate.shoot(h.kid, 0, 0, 5 + i); }
  assert.equal(gate.phase, 'failed'); h.command('retry', 100);
  assert.equal(h.journey.dockGate?.phase, 'ready'); assert.equal(h.journey.step, 2); assert.deepEqual(h.journey.apu, savedRide);
  assert.equal(h.world.agents.get('mifune')!.status, 'dead'); assert.equal(h.world.agents.get('mifune')!.health, 0);
  h.command('act', 101); h.journey.dockGate!.remaining = .04;
  h.sandbox.life.film.dockGate.frame(h.kid, .1, 102); assert.equal(h.journey.dockGate?.phase, 'failed');
  h.command('retry', 103); assert.equal(h.journey.dockGate?.remaining, 120);
});

test('reconciling a gate save does not restart the completed Mifune body action', () => {
  const h = setup(); h.journey.dockLastStand = { phase: 'done', elapsed: 0, total: 19.2 };
  h.journey.completed.push('m3_dock_battle');
  h.sandbox.life.film.reconcileCast(); const mifune = h.world.agents.get('mifune')!;
  const action = structuredClone(mifune.currentAction);
  h.world.simulationTick = 548; h.sandbox.life.film.reconcileCast();
  assert.deepEqual(mifune.currentAction, action); assert.equal(mifune.status, 'dead'); assert.equal(mifune.health, 0);
});
