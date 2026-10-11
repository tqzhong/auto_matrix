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
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
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

test('Logos entry seats both living crew before launch and cannot walk off or resurrect an unavailable Neo', () => {
  const h = game(), scene = FILM_SCENE_BY_ID.m3_defense, state = h.state();
  state.scene = scene.id; state.actor = scene.actor; state.step = 0;
  h.players.release('p', h.tick());
  h.players.possess('p', 'trinity', h.tick());
  const pilot = h.actor(), neo = h.world.agents.get('neo')!;
  assert.equal(typeof pilot.currentAction?.parameters.logosPilot, 'object');
  assert.equal(typeof neo.currentAction?.parameters.logosPilot, 'object');
  const before = structuredClone(pilot.position);
  for (let frame = 0; frame < 30; frame++) h.players.step(.05, true, h.tick());
  assert.deepEqual(pilot.position, before, 'the waiting pilot must remain in her airborne seat');
  assert.equal(state.logos, undefined, 'entry and waiting must not start the timed flight');
  neo.status = 'dead'; neo.health = 0; const body = structuredClone(neo);
  assert.match(h.command('act'), /Neo.*无法/);
  assert.equal(state.logos, undefined);
  assert.deepEqual(neo, body, 'unavailable crew must not be moved, healed or restaged');
});

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

test('a legacy automatic flight still completes its saved cloud, sunlight and descent sequence', () => {
  let flight = newLogosFlight('sun');
  delete flight.ignition;
  const stages = new Set([flight.stage]);
  for (let frame = 0; frame < 600 && flight.phase === 'riding'; frame++) {
    flight = stepLogosFlight(flight, { throttle: flight.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, .05, false);
    stages.add(flight.stage);
  }
  assert.equal(flight.phase, 'arrived');
  assert.deepEqual([...stages], ['clouds', 'sun', 'stall']);
  assert.ok(flight.altitude <= LOGOS_DEFENSE.cloudFloor);
});

test('the cloud handoff preserves the damaged ship and crew, waits for input, and retries the same entry after restore', () => {
  const h = game(), state = h.state();
  state.scene = 'm3_defense'; state.actor = 'trinity'; state.step = 0;
  h.players.possess('p', 'trinity', h.tick());
  state.logos = { ...newLogosFlight('defense'), phase: 'arrived', stage: 'clouds', x: 3, altitude: 42, z: -58,
    speed: 14, lateral: 2, vertical: 5, elapsed: 9, hull: 44, neo: 32, hits: 2, destroyed: 3, resolved: 255 };
  h.actor().health = 57; h.advance();
  const incoming = structuredClone(state.logos), position = { ...h.actor().position };
  h.command('next');
  assert.equal(state.scene, 'm3_sun'); assert.equal(state.logos, undefined);
  assert.ok(state.logosEntry, 'the next scene must retain its actual flight checkpoint');
  for (const key of ['x', 'altitude', 'z', 'speed', 'lateral', 'vertical', 'elapsed', 'hull', 'neo', 'hits', 'destroyed', 'resolved'] as const)
    assert.equal(state.logosEntry[key], incoming[key], `handoff changed ${key}`);
  assert.deepEqual(h.actor().position, position, 'changing the chapter must not teleport the seated pilot');
  assert.equal(h.actor().health, 57, 'continuing the flight must not heal the pilot');
  const saved = structuredClone(h.sandbox.state), entry = structuredClone(state.logosEntry);
  h.sandbox.restore(saved); h.players.release('p', h.tick()); h.advance(30);
  assert.deepEqual(h.state().logosEntry, entry); assert.equal(h.state().logos, undefined);
  h.players.possess('p', 'trinity', h.tick()); h.command('act');
  assert.deepEqual(h.state().logos, entry, 'launch must resume the retained checkpoint');
  for (let frame = 0; frame < 400 && h.state().logos?.phase === 'riding'; frame++)
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: 0, steer: 0, brake: false }, .05, h.tick());
  assert.equal(h.state().logos?.phase, 'wrecked');
  h.command('retry'); assert.equal(h.state().logos, undefined); assert.deepEqual(h.state().logosEntry, entry);
  h.command('act'); assert.deepEqual(h.state().logos, entry, 'retry must not refill hull or Neo energy');
});

test('a legacy flight in sunlight keeps its existing altitude after an update', () => {
  const flight = { ...newLogosFlight('sun'), stage: 'sun' as const, altitude: 30, z: 12, stageElapsed: 0 };
  delete flight.cloudTop;
  delete flight.ignition;
  assert.equal(stepLogosFlight(flight, { throttle: 0, steer: 0, brake: false }, 0).altitude, 30);
});

test('a partially pumped Logos igniter survives server restore, release and paused inputs before a normal handoff', () => {
  const h = game(); let state = h.state(); state.scene = 'm3_sun'; state.actor = 'trinity'; state.step = 0;
  state.logosEntry = { ...newLogosFlight('sun'), hull: 44, neo: 32, altitude: 42 };
  h.players.possess('p', 'trinity', h.tick()); h.command('act'); let sequence = 0;
  const frame = () => {
    const flight = state.logos!;
    h.players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, focus: flight.stage === 'stall' && (flight.ignition?.pump ?? 0) < 1.3,
      drive: { throttle: flight.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, sequence: ++sequence });
    h.players.step(.05, true, h.tick());
  };
  for (let i = 0; i < 400 && (state.logos!.ignition?.pump ?? 0) < .55; i++) frame();
  assert.equal(state.logos!.ignition?.phase, 'pumping');
  const saved = structuredClone(h.sandbox.state), flight = structuredClone(state.logos);
  assert.match(h.command('act'), /保持 G/); assert.deepEqual(state.logos, flight, 'G during ignition must not relaunch the flight');
  h.players.step(.5, false, h.tick()); assert.deepEqual(state.logos, flight);
  h.players.release('p', h.tick()); h.sandbox.restore(saved); state = h.state(); h.advance(30);
  assert.deepEqual(state.logos, flight);
  h.players.possess('p', 'trinity', h.tick()); assert.deepEqual(state.logos, flight);
  for (let i = 0; i < 500 && state.logos!.phase === 'riding'; i++) frame();
  assert.equal(state.logos!.phase, 'arrived'); assert.equal(state.logos!.ignition?.attempts, 1);
  assert.equal(state.logos!.hull, 44); assert.equal(state.logos!.neo, 32);
  h.advance(); h.command('next'); assert.equal(state.scene, 'm3_farewell');
});

test('Logos scene lighting darkens again below the clouds and keeps the same ship through the chapter handoff', () => {
  const h = game(), journey = h.state(), actor = h.world.agents.get('trinity')!;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2();
  const renderer = new FilmSetRenderer(scene);
  try {
    journey.scene = 'm3_sun'; journey.actor = 'trinity'; journey.logos = { ...newLogosFlight('sun'), stage: 'sun', altitude: 66, z: -78 };
    actor.isInMatrix = false; actor.position = filmStepPosition(FILM_SCENE_BY_ID.m3_sun, FILM_SCENE_BY_ID.m3_sun.steps[0], journey);
    renderer.update(actor, h.sandbox.state, 0);
    const bright = renderer.atmosphere()!;
    journey.logos = { ...journey.logos, stage: 'stall', altitude: 25 };
    renderer.update(actor, h.sandbox.state, 0);
    assert.ok(renderer.atmosphere()!.ambient < bright.ambient * .7, 'falling back into storm clouds must remove the sunlight');
    journey.scene = 'm3_defense'; journey.logos = { ...newLogosFlight('defense'), phase: 'arrived', z: -58, altitude: 42 };
    renderer.update(actor, h.sandbox.state, 0);
    const ship = renderer.root.getObjectByName('logos-flight-ship'); assert.ok(ship);
    journey.scene = 'm3_sun'; journey.logosEntry = { ...journey.logos, mode: 'sun', phase: 'riding' }; delete journey.logos;
    renderer.update(actor, h.sandbox.state, 0);
    assert.equal(renderer.root.getObjectByName('logos-flight-ship'), ship, 'do not unload the cockpit between connected flight segments');
  } finally { renderer.dispose(); }
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
    h.sandbox.life.film.driveFrame(h.actor(), { throttle: state.logos.stage === 'clouds' ? 1 : 0, steer: 0, brake: false }, .05, h.tick(),
      state.logos.stage === 'stall' && (state.logos.ignition?.pump ?? 0) < 1.3);
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

test('Logos renders a persistent cloud atmosphere around both views and freezes it with the saved flight', () => {
  const defenseRoot = new THREE.Group(); const defense = new LogosFlightRenderer(defenseRoot, 'defense');
  const flight = { ...newLogosFlight('defense'), pulse: .4, destroyed: 1, resolved: 1 };
  defense.update(flight, 1, false);
  assert.ok(defenseRoot.getObjectByName('logos-flight-ship'));
  assert.ok(defenseRoot.getObjectByName('logos-defense-threat-0'));
  assert.equal(defenseRoot.getObjectByName('logos-defense-threat-0')!.visible, false);
  assert.equal(defenseRoot.getObjectByName('logos-neo-pulse')!.visible, true);

  const sunRoot = new THREE.Group(); const sun = new LogosFlightRenderer(sunRoot, 'sun');
  const ascent = { ...newLogosFlight('sun'), stage: 'sun' as const, altitude: 66, elapsed: 12 };
  sun.update(ascent, 4, false);
  const sky = sunRoot.getObjectByName('logos-atmosphere') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  assert.ok(sky); assert.equal(sky.material.uniforms.time.value, 12);
  sun.update(ascent, 400, true);
  assert.equal(sky.material.uniforms.time.value, 12, 'viewing a paused flight must not animate the cloud field');
  const landed = { ...ascent, phase: 'arrived' as const, stage: 'stall' as const, altitude: 5 };
  sun.update(landed, 6, true);
  assert.equal(sunRoot.getObjectByName('logos-flight-cockpit')!.visible, true, 'the crew stays inside the cockpit until leaving this scene');
  assert.equal(sky.visible, true, 'the first-person camera should stay in the same atmosphere after descent');
  sun.update(landed, 7, false);
  assert.equal(sunRoot.getObjectByName('logos-flight-ship')!.visible, true);
  assert.equal(sky.visible, true);
  const meshes: THREE.Mesh[] = []; sunRoot.traverse(item => { if (item instanceof THREE.Mesh) meshes.push(item); });
  const disposed: string[] = []; meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh.uuid)));
  defense.dispose(); sun.dispose(); assert.equal(defenseRoot.children.length, 0); assert.equal(sunRoot.children.length, 0); assert.ok(disposed.length > 0);
});

test('Logos propulsion and cockpit displays lose their emitted light when the engines stall', () => {
  const root = new THREE.Group(), renderer = new LogosFlightRenderer(root, 'sun');
  const powered = new Set<THREE.MeshStandardMaterial>();
  root.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial
    && [0x72e7ec, 0x365a79, 0x5285a3].includes(object.material.emissive.getHex())) powered.add(object.material); });
  const propulsion = root.getObjectByName('logos-flight-ship')!.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  assert.equal(powered.size, 3); assert.ok(propulsion.intensity > 0);
  const sunlight = { ...newLogosFlight('sun'), stage: 'sun' as const, altitude: 30 };
  delete sunlight.ignition;
  renderer.update(sunlight, 1); assert.ok([...powered].every(material => material.emissiveIntensity > 0));
  renderer.update({ ...sunlight, stage: 'stall', vertical: -8 }, 2);
  assert.equal(propulsion.intensity, 0);
  assert.ok([...powered].every(material => material.emissiveIntensity === 0), 'failed engines and instruments must not glow');
  renderer.update(sunlight, 3); assert.ok(propulsion.intensity > 0); assert.ok([...powered].every(material => material.emissiveIntensity > 0));
  renderer.dispose();
});

test('the completed Logos shot keeps the wide vehicle camera until the player leaves the scene', () => {
  const logos = { ...newLogosFlight('sun'), phase: 'arrived' as const, stage: 'stall' as const };
  const journey = { actor: 'trinity', visiting: undefined, logos } as Parameters<typeof rideForPlayer>[0];
  assert.equal(rideForPlayer(journey, 'trinity'), logos);
  assert.equal(rideForPlayer(journey, 'neo'), undefined);
  assert.equal(rideForPlayer({ ...journey, visiting: { scene: 'm3_sun' } } as Parameters<typeof rideForPlayer>[0], 'trinity'), undefined);
});
