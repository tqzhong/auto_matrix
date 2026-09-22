import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, SENTINEL_TIMING, filmEntry, filmPosition, filmStepPosition, playerBlocked, type FilmJourney, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController } from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { SentinelSetRenderer } from '../packages/client/src/engine/SentinelSetRenderer.js';

function setup() {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    {} as ActionExecutor, dynamics, sandbox);
  players.possess('player', 'neo', 0); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_sentinels; const checkpoint = filmStepPosition(scene, scene.steps[0]);
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: scene.context, checkpoint };
  neo.position = { ...checkpoint }; neo.currentLocation = scene.set; neo.isInMatrix = false;
  let tick = 0; let sequence = 0;
  sandbox.life.film.sentinelFrame(neo, { movement: 0, sprint: false, jump: false }, 0, tick);
  const command = (target: string) => players.sandboxAction('player', { kind: 'life', target: `film:${target}` }, ++tick);
  const frames = (seconds: number, movement = 0, sprint = false, running = true, jump = false) => {
    for (let i = 0; i < Math.round(seconds / .05); i++) {
      players.receiveInput('player', { x: movement, z: 0, yaw: neo.rotation, jump: jump && i === 0, sprint, sequence: ++sequence });
      players.step(.05, running, tick); if (running && i % 10 === 0) sandbox.tick(++tick);
    }
  };
  const poses = () => ['neo', 'morpheus', 'trinity', 'tank', 'dozer'].map(id => {
    const actor = world.agents.get(id)!;
    return { position: { ...actor.position }, rotation: actor.rotation, gesture: structuredClone(actor.currentAction?.parameters.sentinel) };
  });
  return { world, sandbox, players, neo, scene, command, frames, poses, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the first Sentinel encounter stays in Neo viewpoint instead of forcing control into Morpheus', () => {
  const scene = FILM_SCENE_BY_ID.m1_sentinels;
  assert.equal(scene.actor, 'neo');
  assert.deepEqual(scene.cast, ['morpheus', 'trinity', 'tank', 'dozer']);
});

test('shutdown waits for Neo, then staying still survives the complete Sentinel sweep', () => {
  const h = setup(); h.frames(20); assert.equal(h.state().sentinel?.phase, 'ready'); assert.equal(h.state().step, 0);
  h.command('act'); assert.equal(h.state().sentinel?.phase, 'shutdown');
  h.frames(SENTINEL_TIMING.shutdown + SENTINEL_TIMING.sweep + SENTINEL_TIMING.clear + .6);
  assert.equal(h.state().sentinel?.phase, 'verify'); assert.equal(h.state().step, 1); assert.equal(h.state().sentinel?.noise, 0);
  const window = filmStepPosition(h.scene, h.scene.steps[1]);
  assert.ok(Math.hypot(h.neo.position.x - window.x, h.neo.position.z - window.z) > 4, JSON.stringify(h.neo.position));
  assert.match(h.command('act'), /先走到/); assert.equal(h.state().sentinel?.phase, 'verify');
  h.neo.position = window; h.command('act'); h.frames(SENTINEL_TIMING.confirming + .2);
  assert.equal(h.state().sentinel?.phase, 'done'); assert.equal(h.state().step, 2);
  assert.equal(h.state().completed.filter(id => id === 'm1_sentinels').length, 1);
});

test('running or jumping during the scan makes noise, fails explicitly and retries from the saved shutdown checkpoint', () => {
  const h = setup(); const checkpoint = { ...h.state().checkpoint }; h.command('act'); h.frames(SENTINEL_TIMING.shutdown + .1);
  assert.equal(h.state().sentinel?.phase, 'sweep');
  h.frames(2.6, 1, true, true, true); assert.ok((h.state().sentinel?.noise ?? 0) >= 1);
  h.frames(SENTINEL_TIMING.detected + .3);
  assert.equal(h.state().sentinel?.phase, 'failed'); assert.equal(h.state().step, 0);
  h.frames(20); assert.equal(h.state().sentinel?.phase, 'failed', 'failure cannot silently reset itself');
  h.command('act'); assert.equal(h.state().sentinel?.phase, 'shutdown'); assert.equal(h.state().sentinel?.attempt, 1);
  assert.equal(h.state().sentinel?.noise, 0); assert.deepEqual(h.neo.position, checkpoint);
});

test('the exact scan clock, noise and five crew poses survive pause, disconnect, save restore and retry', () => {
  const h = setup(); h.command('act'); h.frames(SENTINEL_TIMING.shutdown + 2.25, .4);
  const encounter = structuredClone(h.state().sentinel); const before = h.poses();
  assert.equal(encounter?.phase, 'sweep'); assert.ok((encounter?.noise ?? 0) > 0);
  h.frames(3, 0, false, false); assert.deepEqual(h.state().sentinel, encounter); assert.deepEqual(h.poses(), before);
  h.players.release('player', h.tick()); h.frames(3); assert.deepEqual(h.state().sentinel, encounter); assert.deepEqual(h.poses(), before);
  h.sandbox.restore(JSON.parse(JSON.stringify(h.sandbox.state))); h.players.possess('player', 'neo', h.tick());
  h.command('retry'); assert.deepEqual(h.state().sentinel, encounter); assert.deepEqual(h.poses(), before);
});

test('occupied crew blocks shutdown and the active encounter reserves every required role', () => {
  const h = setup(); h.players.possess('other', 'tank', h.tick());
  assert.match(h.command('act'), /另一位玩家/); assert.equal(h.state().sentinel?.phase, 'ready');
  h.players.release('other', h.tick()); h.command('act');
  for (const id of ['morpheus', 'trinity', 'tank', 'dozer']) assert.match(h.players.possess('other', id, h.tick()).error!, /静默潜航/);
  assert.match(h.players.act('player', 'attack', h.tick()), /演出|哨兵/);
});

test('Neo enters the service tunnel through a continuous playable aisle', () => {
  const scene = FILM_SCENE_BY_ID.m1_sentinels; const from = filmEntry(scene); const to = filmStepPosition(scene, scene.steps[0]);
  const h = setup();
  for (let i = 0; i <= 100; i++) {
    const point = { x: from.x + (to.x - from.x) * i / 100, y: from.y, z: from.z + (to.z - from.z) * i / 100 };
    assert.equal(playerBlocked(point, false), false, `service aisle blocked at sample ${i}`);
  }
  assert.equal(h.scene.actor, 'neo');
});

test('the service pipe owns a physical cockpit, EMP key, frosted viewport and animated Sentinel scan', () => {
  const root = new THREE.Group(); const renderer = new SentinelSetRenderer(root);
  const journey: FilmJourney = { version: 1, scene: 'm1_sentinels', actor: 'neo', step: 0, completed: [], enteredAt: 0,
    reflections: {}, lastText: '', checkpoint: filmPosition('film_service_tunnels'), sentinel: { phase: 'ready', elapsed: 0, noise: 0, attempt: 0 } };
  try {
    for (const name of ['sentinel-cockpit-window', 'sentinel-emp-key', 'sentinel-machine', 'sentinel-scan-beam', 'sentinel-power-light', 'sentinel-frosted-glass']) assert.ok(root.getObjectByName(name), name);
    renderer.update(journey, 0); const power = root.getObjectByName('sentinel-power-light') as THREE.PointLight;
    const lit = power.intensity; const machine = root.getObjectByName('sentinel-machine')!; const before = machine.position.clone();
    journey.sentinel = { phase: 'shutdown', elapsed: SENTINEL_TIMING.shutdown, noise: 0, attempt: 0 }; renderer.update(journey, 4.5);
    assert.ok(power.intensity < lit * .2, 'the physical cockpit visibly loses power');
    journey.sentinel = { phase: 'sweep', elapsed: 6, noise: .8, attempt: 0 }; renderer.update(journey, 10.5);
    assert.ok(machine.position.distanceTo(before) > 10, 'the Sentinel crosses the exterior service pipe');
    assert.equal(root.getObjectByName('sentinel-scan-beam')!.visible, true);
    assert.ok(Array.from({ length: 10 }, (_, i) => root.getObjectByName(`sentinel-noise-bar-${i}`)!).filter(bar => bar.visible).length >= 8);
    journey.sentinel = { phase: 'detected', elapsed: SENTINEL_TIMING.detected, noise: 1, attempt: 0 }; renderer.update(journey, 14);
    assert.ok(machine.position.z > -54, 'detection brings the machine against the viewport instead of reporting a text-only failure');
  } finally { renderer.dispose(); }
});
