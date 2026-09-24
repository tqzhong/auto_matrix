import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, hammerCenter, newHammerFlight, stepHammerFlight, filmEntry, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { HammerRouteRenderer } from '../packages/client/src/engine/HammerRouteRenderer.js';
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
  let tick = 1;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  return { world, sandbox, players, command, advance, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('Hammer route requires steering and forward speed; bent walls, debris and pursuers can end the flight', () => {
  let pilot = newHammerFlight();
  for (let i = 0; i < 900 && pilot.phase === 'riding'; i++) {
    const steer = Math.max(-1, Math.min(1, (hammerCenter(pilot.z - 15) - pilot.x) * .24 - pilot.lateral * .12));
    pilot = stepHammerFlight(pilot, { throttle: 1, steer, brake: false }, .05);
  }
  assert.equal(pilot.phase, 'arrived'); assert.equal(pilot.hits, 0);
  assert.equal(pilot.hull, 100); assert.equal(pilot.antennaLost, true);
  let straight = newHammerFlight();
  for (let i = 0; i < 900 && straight.phase === 'riding'; i++) straight = stepHammerFlight(straight, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(straight.phase, 'wrecked'); assert.ok(straight.hits >= 4);
  let stopped = newHammerFlight();
  for (let i = 0; i < 600 && stopped.phase === 'riding'; i++) stopped = stepHammerFlight(stopped, { throttle: 0, steer: 0, brake: true }, .05);
  assert.equal(stopped.phase, 'wrecked'); assert.equal(stopped.pursuit, 100);
});

test('Niobe drives Hammer with crew, save restore, failure retry and a dock handoff', () => {
  const h = game(); const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  let state = h.state(); state.scene = scene.id; state.actor = scene.actor; state.step = 2;
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = scene.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(scene, scene.steps[2]); state.checkpoint = { ...h.actor().position };
  h.players.possess('other', 'morpheus', h.tick()); assert.match(h.command('act'), /另一位玩家/);
  assert.equal(state.hammer, undefined); h.players.release('other', h.tick());
  h.command('act'); assert.equal(state.hammer?.phase, 'riding');
  assert.match(h.players.possess('other', 'morpheus', h.tick()).error!, /Hammer/);
  for (let i = 0; i < 25; i++) h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 0, brake: false }, .05, h.tick());
  const saved = structuredClone(h.sandbox.state); const location = { ...h.actor().position };
  h.sandbox.restore(saved); h.players.release('p', h.tick()); h.advance(15);
  assert.deepEqual(h.state().hammer, saved.neoLife.journey.hammer);
  h.players.possess('p', 'niobe', h.tick()); assert.deepEqual(h.actor().position, location);
  let flight = h.state().hammer!;
  for (let i = 0; i < 900 && flight.phase === 'riding'; i++) {
    const steer = Math.max(-1, Math.min(1, (hammerCenter(flight.z - 15) - flight.x) * .24 - flight.lateral * .12));
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer, brake: false }, .05, h.tick());
    flight = h.state().hammer!;
  }
  assert.equal(flight.phase, 'arrived'); assert.equal(h.world.agents.get('morpheus')!.currentLocation, scene.set);
  h.advance(); assert.equal(h.state().step, scene.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm3_dock_battle'); assert.equal(h.state().hammer, undefined);
  state = h.state(); state.scene = scene.id; state.actor = scene.actor; state.step = 2; state.hammer = { ...newHammerFlight(), hull: 1, speed: 35, x: 9 };
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = scene.set;
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: 1, brake: false }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); h.command('retry');
  assert.equal(state.hammer, undefined); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 2);
});

test('Hammer route exposes traversable objectives and renders ship, tunnel and pursuing sentinels', () => {
  const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  assert.equal(scene.set, 'film_hammer_route'); assert.equal(FILM_SETS[scene.set].world, 'real');
  assert.equal(playerBlocked(filmEntry(scene), false), false);
  for (const step of scene.steps) assert.equal(playerBlocked(filmStepPosition(scene, step), false), false, step.label);
  const root = new THREE.Group(); const renderer = new HammerRouteRenderer(root);
  const flight = { ...newHammerFlight(), z: 20, x: hammerCenter(20), speed: 28, pursuit: 55 };
  renderer.update(flight, 1);
  const meshes: THREE.Mesh[] = []; root.traverse(item => { if (item instanceof THREE.Mesh) meshes.push(item); });
  assert.ok(meshes.length > 100); assert.ok(root.children.length > 0);
  const disposed: string[] = []; meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh.uuid)));
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('a save made in the former service tunnel is moved to the new Hammer checkpoint', () => {
  const h = game(); const scene = FILM_SCENE_BY_ID.m3_hammer_tunnels; const state = h.state();
  state.scene = scene.id; state.actor = scene.actor; state.step = 2;
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = 'film_service_tunnels';
  h.actor().position = FILM_SETS.film_service_tunnels.center;
  h.advance();
  assert.equal(h.actor().currentLocation, scene.set); assert.deepEqual(h.actor().position, state.checkpoint);
  assert.equal(state.step, 2); assert.equal(state.hammer, undefined);
  assert.equal(h.world.agents.get('morpheus')!.currentLocation, scene.set);
});
