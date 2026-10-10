import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, HAMMER_ROUTE, hammerCenter, hammerHeight, newHammerFlight, stepHammerFlight, filmEntry, filmStepPosition, playerBlocked, type WorldEvent } from '@auto_matrix/shared';
import { hammerPilotInput as pilotInput } from './helpers/hammer-pilot.mts';
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

function legacyFlight() { const flight = newHammerFlight(); delete flight.maneuver; return flight; }

test('Hammer route requires steering and forward speed; bent walls, debris and pursuers can end the flight', () => {
  let pilot = legacyFlight();
  for (let i = 0; i < 900 && pilot.phase === 'riding'; i++) {
    pilot = stepHammerFlight(pilot, pilotInput(pilot), .05);
  }
  assert.equal(pilot.phase, 'arrived'); assert.equal(pilot.hits, 0);
  assert.equal(pilot.hull, 100); assert.equal(pilot.antennaLost, true);
  let straight = legacyFlight();
  for (let i = 0; i < 900 && straight.phase === 'riding'; i++) straight = stepHammerFlight(straight, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(straight.phase, 'wrecked'); assert.ok(straight.hits >= 4);
  let stopped = legacyFlight();
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
    h.sandbox.life.film.driveFrame(h.actor(), pilotInput(flight), .05, h.tick());
    flight = h.state().hammer!;
  }
  assert.equal(flight.phase, 'arrived'); assert.equal(h.world.agents.get('morpheus')!.currentLocation, scene.set);
  h.advance(); assert.equal(h.state().step, scene.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm3_diggers'); assert.equal(h.state().hammer, undefined);
  state = h.state(); state.scene = scene.id; state.actor = scene.actor; state.step = 2; state.hammer = { ...legacyFlight(), hull: 1, speed: 35, x: 9 };
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
  const flight = { ...legacyFlight(), z: 20, x: hammerCenter(20), speed: 28, pursuit: 55 };
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

test('an existing Hammer cabin save seats unowned crew without relocating the walking player or their checkpoint', () => {
  const h = game(), state = h.state(), scene = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = scene.set;
  h.actor().position = filmEntry(scene); state.checkpoint = { ...h.actor().position };
  const before = { position: { ...h.actor().position }, checkpoint: { ...state.checkpoint }, completed: state.completed.slice() };
  const morpheus = h.world.agents.get('morpheus')!, roland = h.world.agents.get('roland')!;
  morpheus.currentLocation = roland.currentLocation = scene.set;
  morpheus.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: 1, duration: 1e9, progress: 0 };
  roland.currentAction = null;
  h.players.possess('other', 'roland', h.tick()); const otherPosition = { ...roland.position };
  h.advance();
  assert.ok(morpheus.currentAction?.parameters.hammerPilot, 'the existing copilot still uses a generic sitting pose');
  assert.deepEqual({ position: h.actor().position, checkpoint: state.checkpoint, completed: state.completed }, before);
  assert.deepEqual(roland.position, otherPosition, 'another player must keep their own body');
  assert.equal(roland.currentAction?.parameters.hammerPilot, undefined);
  h.players.release('other', h.tick()); h.advance();
  assert.ok(roland.currentAction?.parameters.hammerPilot);
  assert.equal(state.hammer, undefined, 'fitting a saved cabin must not begin the flight');
});

test('the saved Hammer flight freezes pursuers and engine effects while world time is paused', () => {
  const root = new THREE.Group(), renderer = new HammerRouteRenderer(root);
  const flight = { ...legacyFlight(), elapsed: 3.25, speed: 28, lateral: 6, pursuit: 25 };
  const capture = () => {
    root.updateMatrixWorld(true); const rows: unknown[] = [];
    root.traverse(object => rows.push([object.matrixWorld.elements.slice(), object.visible,
      object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial ? object.material.emissiveIntensity : undefined]));
    return rows;
  };
  try {
    renderer.update(flight, 4); const before = capture();
    renderer.update(structuredClone(flight), 104); assert.deepEqual(capture(), before);
  } finally { renderer.dispose(); }
});

test('the former curved cabin floor is fitted to the rigid deck on possession while horizontal progress remains saved', () => {
  const h = game(), state = h.state(), scene = FILM_SCENE_BY_ID.m3_hammer_tunnels, actor = h.world.agents.get('niobe')!;
  state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  const point = filmEntry(scene); point.y = FILM_SETS[scene.set].center.y + hammerHeight(184) - 1.35;
  actor.position = { ...point }; actor.currentLocation = scene.set; state.checkpoint = { ...point };
  const completed = state.completed.slice(); h.players.possess('p', 'niobe', h.tick());
  const floor = filmEntry(scene).y;
  assert.equal(actor.position.y, floor, 'the saved soles are buried in the new rigid deck');
  assert.deepEqual(actor.position, { ...point, y: floor }); assert.deepEqual(state.checkpoint, { ...point, y: floor });
  assert.deepEqual(state.completed, completed); assert.equal(state.step, 0); assert.equal(state.hammer, undefined);
});

test('Hammer wall clearance includes the wide outer hover pods rather than just the central hull', () => {
  const flight = stepHammerFlight({ ...legacyFlight(), x: 8, speed: 25 }, { throttle: 1, steer: 0, brake: false }, .05);
  assert.equal(flight.hits, 1, 'the visible outer hull crosses the wall without a collision');
  assert.ok(flight.x <= 13.2 - 6.175);
});

test('the pilot follows the same heading as the rendered Hammer instead of a different turn rate', () => {
  const h = game(), state = h.state(), scene = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  state.scene = scene.id; state.actor = scene.actor; state.step = 2; state.hammer = { ...legacyFlight(), speed: 25, lateral: 6 };
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = scene.set;
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 1, steer: .6, brake: false }, .05, h.tick());
  const flight = state.hammer!;
  assert.ok(Math.abs(h.actor().rotation - Math.PI + Math.atan2(flight.lateral, Math.max(1, flight.speed)) * .7) < 1e-8);
});

test('the player protocol clamps lift and roll, rejects non-finite axes and preserves a saved spatial flight', () => {
  const h = game(), state = h.state(), scene = FILM_SCENE_BY_ID.m3_hammer_tunnels;
  state.scene = scene.id; state.actor = scene.actor; state.step = 2;
  h.players.possess('p', 'niobe', h.tick()); h.actor().currentLocation = scene.set;
  h.actor().position = filmStepPosition(scene, scene.steps[2]); state.checkpoint = { ...h.actor().position }; h.command('act');
  h.players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, sequence: 1, drive: { throttle: 1, steer: 0, brake: false, lift: 100, roll: NaN } });
  h.players.step(.1, true, h.tick());
  assert.ok(state.hammer!.maneuver!.vertical > 0 && state.hammer!.maneuver!.vertical < 7);
  assert.equal(state.hammer!.maneuver!.bank, 0);
  h.players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, sequence: 2, drive: { throttle: 1, steer: 0, brake: false, lift: Infinity, roll: 100 } });
  h.players.step(.1, true, h.tick());
  assert.ok(state.hammer!.maneuver!.bank > 0 && state.hammer!.maneuver!.bank < .125);
  const saved = structuredClone(h.sandbox.state); h.sandbox.restore(saved);
  h.players.release('p', h.tick()); h.advance(8); h.players.possess('p', 'niobe', h.tick());
  assert.deepEqual(h.state().hammer, saved.neoLife.journey.hammer);
});
