import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FILM_SCENE_BY_ID,
  FILM_SETS,
  LOGOS_DEFENSE,
  filmStepPosition,
  newLogosFlight,
  stepLogosFlight,
  type LogosFlight,
  type WorldEvent,
} from '@auto_matrix/shared';
import { LogosFlightRenderer } from '../packages/client/src/engine/LogosFlightRenderer.js';
import { rideForPlayer } from '../packages/client/src/engine/Engine.js';
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

function defenseInput(flight: LogosFlight) {
  const next = LOGOS_DEFENSE.threats.find((threat, index) => !(flight.resolved & 1 << index) && threat.z < flight.z + 2);
  const canPulse = Boolean(next && next.z > flight.z - 22 && next.id % 2 === 0 && flight.neo >= LOGOS_DEFENSE.pulseCost);
  let targetX = 0, targetAltitude = flight.z < -31 ? 41 : 25;
  if (next && !canPulse && next.z > flight.z - 27) {
    targetX = next.x > 0 ? next.x - 13 : next.x + 13;
    targetAltitude = next.altitude > 27 ? next.altitude - 11 : next.altitude + 11;
  }
  return {
    input: {
      throttle: targetAltitude > flight.altitude + .8 ? 1 : 0,
      brake: targetAltitude < flight.altitude - .8,
      steer: Math.max(-1, Math.min(1, (targetX - flight.x) * .16 - flight.lateral * .1)),
    },
    focus: canPulse,
  };
}

test('Logos defense flight combines three-axis piloting, finite Neo pulses and collision failure', () => {
  let flight = newLogosFlight('defense');
  let usedPulse = false;
  for (let frame = 0; frame < 600 && flight.phase === 'riding'; frame++) {
    const controls = defenseInput(flight); usedPulse ||= controls.focus;
    flight = stepLogosFlight(flight, controls.input, .05, controls.focus);
  }
  assert.equal(flight.phase, 'arrived'); assert.equal(flight.stage, 'clouds');
  assert.equal(usedPulse, true); assert.ok(flight.destroyed > 0); assert.ok(flight.neo < 100); assert.ok(flight.hull > 0);

  const threat = LOGOS_DEFENSE.threats[0];
  let impact = { ...newLogosFlight('defense'), x: threat.x, altitude: threat.altitude, z: threat.z + 1.5,
    speed: 20, hull: 20 };
  impact = stepLogosFlight(impact, { throttle: 0, steer: 0, brake: false }, .1, false);
  assert.equal(impact.phase, 'wrecked'); assert.equal(impact.hits, 1);
});

test('Logos climbs through cloud, holds in sunlight, then stalls back below the cloud deck', () => {
  let flight = newLogosFlight('sun');
  const stages = new Set([flight.stage]);
  for (let frame = 0; frame < 600 && flight.phase === 'riding'; frame++) {
    flight = stepLogosFlight(flight, { throttle: flight.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, .05, false);
    stages.add(flight.stage);
  }
  assert.equal(flight.phase, 'arrived');
  assert.deepEqual([...stages], ['clouds', 'sun', 'stall']);
  assert.ok(flight.altitude <= LOGOS_DEFENSE.cloudFloor);
});

test('Trinity pilots both Logos scenes with Neo occupied checks, save restore, failure retry and handoff', () => {
  const h = game(); const defense = FILM_SCENE_BY_ID.m3_defense;
  let state = h.state(); state.scene = defense.id; state.actor = defense.actor; state.step = 0;
  h.players.possess('p', 'trinity', h.tick()); h.actor().currentLocation = defense.set; h.actor().isInMatrix = false;
  h.actor().position = filmStepPosition(defense, defense.steps[0]); state.checkpoint = { ...h.actor().position };
  h.players.possess('other', 'neo', h.tick()); assert.match(h.command('act'), /另一位玩家/); assert.equal(state.logos, undefined);
  h.players.release('other', h.tick()); assert.match(h.command('act'), /Logos/); assert.equal(state.logos?.phase, 'riding');
  assert.match(h.players.possess('other', 'neo', h.tick()).error!, /Logos/);

  const neutralAltitude = state.logos!.altitude;
  for (let frame = 0; frame < 20; frame++) h.players.step(.05, true, h.tick());
  assert.ok(Math.abs(state.logos!.altitude - neutralAltitude) < .5, 'releasing flight controls should hold altitude');

  for (let frame = 0; frame < 20; frame++) {
    const controls = defenseInput(state.logos!);
    h.sandbox.life.film.driveFrame(h.actor(), controls.input, .05, h.tick(), controls.focus);
  }
  const saved = structuredClone(h.sandbox.state); const location = { ...h.actor().position };
  h.sandbox.restore(saved); h.players.release('p', h.tick()); h.advance(8);
  assert.deepEqual(h.state().logos, saved.neoLife.journey.logos);
  h.players.possess('p', 'trinity', h.tick()); assert.deepEqual(h.actor().position, location);
  state = h.state();
  for (let frame = 0; frame < 600 && state.logos?.phase === 'riding'; frame++) {
    const controls = defenseInput(state.logos);
    h.sandbox.life.film.driveFrame(h.actor(), controls.input, .05, h.tick(), controls.focus);
  }
  assert.equal(state.logos?.phase, 'arrived'); h.advance(); assert.equal(state.step, defense.steps.length);
  h.command('next'); state = h.state(); assert.equal(state.scene, 'm3_sun'); assert.equal(state.logos, undefined);
  h.command('act');
  for (let frame = 0; frame < 600 && state.logos?.phase === 'riding'; frame++)
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: state.logos.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, .05, h.tick());
  assert.equal(state.logos?.phase, 'arrived'); h.advance(); assert.equal(state.step, FILM_SCENE_BY_ID.m3_sun.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm3_farewell'); assert.equal(h.state().logos, undefined);

  state = h.state(); state.scene = defense.id; state.actor = defense.actor; state.step = 0;
  const threat = LOGOS_DEFENSE.threats[0]; state.logos = { ...newLogosFlight('defense'), x: threat.x, altitude: threat.altitude,
    z: threat.z + 1.5, speed: 20, hull: 20 };
  h.players.possess('p', 'trinity', h.tick()); h.actor().currentLocation = defense.set;
  h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: false }, .1, h.tick());
  assert.equal(h.actor().status, 'dead'); h.command('retry');
  assert.equal(state.logos, undefined); assert.equal(h.actor().status, 'alive'); assert.equal(state.step, 0);
});

test('Logos renderer exposes the ship, physical defenses, Neo pulse, cloud sea and sun', () => {
  const defenseRoot = new THREE.Group(); const defense = new LogosFlightRenderer(defenseRoot, 'defense');
  const flight = { ...newLogosFlight('defense'), pulse: .4, destroyed: 1, resolved: 1 };
  defense.update(flight, 1, false);
  assert.ok(defenseRoot.getObjectByName('logos-flight-ship'));
  assert.ok(defenseRoot.getObjectByName('logos-defense-threat-0'));
  assert.equal(defenseRoot.getObjectByName('logos-defense-threat-0')!.visible, false);
  assert.equal(defenseRoot.getObjectByName('logos-neo-pulse')!.visible, true);

  const sunRoot = new THREE.Group(); const sun = new LogosFlightRenderer(sunRoot, 'sun');
  const ascent = { ...newLogosFlight('sun'), stage: 'sun' as const, altitude: 30 };
  sun.update(ascent, 4, false);
  assert.ok(sunRoot.getObjectByName('logos-cloud-bank'));
  assert.ok(sunRoot.getObjectByName('logos-sun'));
  const landed = { ...ascent, phase: 'arrived' as const, stage: 'stall' as const, altitude: 5 };
  sun.update(landed, 6, true);
  assert.equal(sunRoot.getObjectByName('logos-flight-cockpit')!.visible, false, 'the completed first-person shot must leave the cockpit');
  assert.equal(sunRoot.getObjectByName('logos-cloud-bank')!.visible, false, 'the completed first-person shot must not remain inside cloud geometry');
  sun.update(landed, 7, false);
  assert.equal(sunRoot.getObjectByName('logos-flight-ship')!.visible, true);
  assert.equal(sunRoot.getObjectByName('logos-cloud-bank')!.visible, true);
  const meshes: THREE.Mesh[] = []; sunRoot.traverse(item => { if (item instanceof THREE.Mesh) meshes.push(item); });
  assert.ok(meshes.length > 70);
  const disposed: string[] = []; meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh.uuid)));
  defense.dispose(); sun.dispose(); assert.equal(defenseRoot.children.length, 0); assert.equal(sunRoot.children.length, 0); assert.ok(disposed.length > 0);
});

test('the completed Logos shot keeps the wide vehicle camera until the player leaves the scene', () => {
  const logos = { ...newLogosFlight('sun'), phase: 'arrived' as const, stage: 'stall' as const };
  const journey = { actor: 'trinity', visiting: undefined, logos } as Parameters<typeof rideForPlayer>[0];
  assert.equal(rideForPlayer(journey, 'trinity'), logos);
  assert.equal(rideForPlayer(journey, 'neo'), undefined);
  assert.equal(rideForPlayer({ ...journey, visiting: { scene: 'm3_sun' } } as Parameters<typeof rideForPlayer>[0], 'trinity'), undefined);
});
