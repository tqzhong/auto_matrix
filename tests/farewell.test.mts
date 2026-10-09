import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FAREWELL,
  FILM_SCENE_BY_ID,
  FILM_SETS,
  farewellLocked,
  farewellPose,
  filmEntry,
  filmStepPosition,
  newFarewell,
  stepFarewell,
  type WorldEvent,
  type FilmJourney,
  type SandboxState,
} from '@auto_matrix/shared';
import { LogosWreckRenderer } from '../packages/client/src/engine/LogosWreckRenderer.js';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';
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
  let tick = 1; let sequence = 0;
  const command = (target: string) => players.sandboxAction('p', { kind: 'life', target: `film:${target}` }, ++tick);
  const advance = (count = 1) => { for (let i = 0; i < count; i++) sandbox.tick(++tick); };
  const frame = (count = 1) => { for (let i = 0; i < count; i++) {
    players.receiveInput('p', { x: 0, z: 0, yaw: Math.PI, sprint: false, jump: false, sequence: ++sequence });
    players.step(.05, true, tick);
  } };
  return { world, sandbox, players, command, advance, frame, actor: () => players.getAgent('p')!, state: () => sandbox.life.film.state!, tick: () => tick };
}

test('the Logos farewell preserves its quiet sequence and ends in stillness', () => {
  let farewell = { ...newFarewell(), phase: 'reaching' as const };
  const phases = new Set([farewell.phase]);
  for (let frame = 0; frame < 800 && farewell.phase !== 'still'; frame++) {
    farewell = stepFarewell(farewell, .05); phases.add(farewell.phase);
  }
  assert.deepEqual([...phases], ['reaching', 'discovery', 'promise', 'goodbye', 'kiss', 'still']);
  assert.ok(farewell.total >= FAREWELL.minimumSeconds);
  assert.equal(farewellLocked(farewell), false);
  const kiss = farewellPose({ ...farewell, phase: 'kiss', elapsed: FAREWELL.seconds.kiss * .65 });
  assert.ok(kiss.neo.kneel > .95 && kiss.neo.lean > .5 && kiss.trinity.reach > .8);
  assert.ok(Math.abs(kiss.neo.z - kiss.trinity.z) < 2.3, 'the final contact stays physically close');
});

test('Neo must approach Trinity and the farewell resumes from an exact saved beat', () => {
  const h = game(); const sun = FILM_SCENE_BY_ID.m3_sun; const scene = FILM_SCENE_BY_ID.m3_farewell;
  const state = h.state(); state.scene = sun.id; state.actor = sun.actor; state.step = sun.steps.length;
  h.players.possess('p', 'trinity', h.tick()); h.actor().currentLocation = sun.set; h.actor().isInMatrix = false;
  h.command('next');
  assert.equal(state.scene, scene.id); assert.equal(h.actor().id, 'neo'); assert.equal(state.farewell?.phase, 'ready');
  assert.match(h.players.possess('other', 'trinity', h.tick()).error!, /Trinity/);

  h.actor().position = filmStepPosition(scene, scene.steps[0]); h.advance();
  assert.equal(state.step, 1); assert.equal(state.farewell?.phase, 'ready');
  h.world.agents.get('trinity')!.controller = 'other';
  assert.match(h.command('act'), /另一位玩家/); assert.equal(state.farewell?.phase, 'ready');
  h.world.agents.get('trinity')!.controller = undefined;
  assert.match(h.command('act'), /Trinity/); assert.equal(state.farewell?.phase, 'reaching');

  h.frame(75); const saved = structuredClone(h.sandbox.state); const beat = structuredClone(state.farewell);
  h.players.release('p', h.tick()); h.advance(20); assert.deepEqual(state.farewell, beat, 'disconnect pauses the scene');
  h.sandbox.restore(saved); h.players.possess('p', 'neo', h.tick());
  assert.deepEqual(h.state().farewell, beat, 'save restore keeps the exact farewell beat');
  assert.ok(h.actor().currentAction?.parameters.farewell, 'possessing a paused save restores Neo\'s farewell pose');
  assert.ok(h.world.agents.get('trinity')!.currentAction?.parameters.farewell, 'possessing a paused save restores Trinity\'s farewell pose');
  h.frame(800);
  assert.equal(h.state().farewell?.phase, 'still'); assert.equal(h.state().step, 2);
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
  h.command('reflect:care'); assert.equal(h.state().step, scene.steps.length);
  h.command('next'); assert.equal(h.state().scene, 'm3_temple_breach'); assert.equal(h.actor().id, 'lock');
  assert.equal(h.world.agents.get('trinity')!.status, 'dead');
});

test('the wreck renderer exposes the crushed cockpit, rebar, fire, sparks and golden sight', () => {
  const root = new THREE.Group(); const renderer = new LogosWreckRenderer(root);
  const farewell = { ...newFarewell(), phase: 'goodbye' as const, elapsed: 2.1, total: 12 };
  renderer.update(farewell, 4, false);
  for (const name of ['logos-wreck-hull', 'logos-wreck-windshield', 'logos-wreck-rebar', 'logos-wreck-fire', 'logos-wreck-golden-vision'])
    assert.ok(root.getObjectByName(name), name);
  assert.equal(root.getObjectByName('logos-wreck-golden-vision')!.visible, false);
  const meshes: THREE.Mesh[] = []; root.traverse(item => { if (item instanceof THREE.Mesh) meshes.push(item); });
  assert.ok(meshes.length > 55, 'the wreck must read as a dedicated physical set');
  const disposed: string[] = []; meshes.forEach(mesh => mesh.geometry.addEventListener('dispose', () => disposed.push(mesh.uuid)));
  renderer.dispose(); assert.equal(root.children.length, 0); assert.ok(disposed.length > 0);
});

test('the approach waypoint leaves the bodies and lighting clear throughout the farewell', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const player = world.agents.get('neo')!, scene = new THREE.Scene(), renderer = new FilmSetRenderer(scene);
  player.position = filmEntry(FILM_SCENE_BY_ID.m3_farewell); player.currentLocation = 'film_logos_wreck'; player.isInMatrix = false;
  const journey: FilmJourney = { version: 1, scene: 'm3_farewell', actor: 'neo', step: 1, completed: [],
    enteredAt: 0, reflections: {}, lastText: '', checkpoint: player.position, farewell: newFarewell() };
  const sandbox = { neoLife: { journey }, structures: [] } as unknown as SandboxState;
  try {
    const marker = scene.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.TorusGeometry)!;
    const light = scene.children.find(object => object instanceof THREE.PointLight)!;
    renderer.update(player, sandbox, 0); assert.equal(marker.visible, true); assert.equal(light.visible, true);
    for (const phase of ['reaching', 'discovery', 'promise', 'goodbye', 'kiss', 'still'] as const) {
      journey.farewell = { phase, elapsed: 1.5, total: 17.1 };
      for (const time of [4, 200]) {
        renderer.update(player, sandbox, time);
        assert.equal(marker.visible, false, `${phase}: the pulsing waypoint must not overlap the actors during a locked or paused farewell`);
        assert.equal(light.visible, false, `${phase}: the waypoint light must not tint the saved performance`);
      }
    }
    journey.farewell = newFarewell(); renderer.update(player, sandbox, 201); assert.equal(marker.visible, true);
  } finally { renderer.dispose(); }
});
