import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SCENE_BY_ID, MATRIX_ESCAPE, filmEntry, filmPosition, matrixEscapeLocked, playerBlocked, subwayCrewRoot, type WorldEvent } from '@auto_matrix/shared';
import * as THREE from 'three';
import { MatrixEscapeRenderer } from '../packages/client/src/engine/MatrixEscapeRenderer.js';
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
  const sandbox = new SandboxSystem(world, dynamics, 61);
  const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as unknown as ConversationEngine,
    { execute() {} } as unknown as ActionExecutor, dynamics, sandbox);
  const neo = world.agents.get('neo')!; players.possess('escape-player', 'neo', 0); sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m1_subway;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 0, actor: 'neo', completed: ['m1_rooftop_rescue'],
    enteredAt: 0, checkpoint: filmEntry(scene), reflections: {}, lastText: scene.context,
    matrixEscape: { kind: 'subway', phase: 'ready', elapsed: 0, attempt: 0, checkpoint: 'duel', hits: 0, dodges: 0,
      pursuit: 0, segment: 0, possessions: 0, resolved: [] } };
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.position = filmEntry(scene);
  for (const [id, health] of [['morpheus', 37], ['trinity', 64]] as const) {
    const actor = world.agents.get(id)!;
    actor.currentLocation = 'film_government_roof'; actor.isInMatrix = true; actor.health = health;
    actor.position = filmPosition('film_government_roof', id === 'morpheus' ? -3 : 2, 3);
  }
  let tick = 0, sequence = 0;
  const frames = (seconds: number, running = true) => {
    for (let i = 0; i < Math.ceil(seconds * 10); i++) {
      players.receiveInput('escape-player', { x: 0, z: 0, yaw: neo.rotation, jump: false, sprint: false, sequence: ++sequence });
      players.step(.1, running, ++tick);
    }
  };
  const command = (target = 'act') => players.sandboxAction('escape-player', { kind: 'life', target: `film:${target}` }, ++tick);
  return { world, sandbox, players, neo, frames, command, tick: () => tick, journey: () => sandbox.life.film.state! };
}

test('roof survivors physically approach the subway phone before Neo can take the line', () => {
  const h = setup(); h.frames(.1);
  assert.equal(h.journey().matrixEscape!.phase, 'crew_exit', 'the old ready state skips both crew departures');
  assert.equal(matrixEscapeLocked(h.journey()), true);
  const morpheus = h.world.agents.get('morpheus')!, trinity = h.world.agents.get('trinity')!;
  const start = { ...morpheus.position };
  assert.equal(morpheus.currentLocation, 'film_subway_platform'); assert.equal(trinity.currentLocation, 'film_subway_platform');
  assert.match(h.command(), /Morpheus|Trinity|撤离/); assert.equal(h.journey().matrixEscape!.phase, 'crew_exit');
  h.frames(1);
  assert.ok(Math.hypot(morpheus.position.x - start.x, morpheus.position.z - start.z) > .5, 'walking must precede departure');
  assert.equal(morpheus.isInMatrix, true); assert.equal(morpheus.health, 37);
  h.frames(4);
  const gesture = morpheus.currentAction?.parameters.tvExit as { phase: string; elapsed: number; role: string; subway: boolean };
  assert.equal(gesture.phase, 'pickup'); assert.equal(gesture.role, 'morpheus'); assert.equal(gesture.subway, true);
  assert.ok(gesture.elapsed >= .8, 'the real receiver must be in his hand before he exits');
  assert.equal(morpheus.isInMatrix, true); assert.equal(trinity.isInMatrix, true);
  assert.equal(Boolean(h.journey().matrixEscape!.phoneBroken), false);
});

test('Morpheus exits first, Trinity follows, and neither injury nor a later Neo retry replays their departure', () => {
  const h = setup(); h.frames(8.6);
  const morpheus = h.world.agents.get('morpheus')!, trinity = h.world.agents.get('trinity')!;
  assert.equal(morpheus.currentLocation, 'film_neb_deck'); assert.equal(morpheus.isInMatrix, false);
  assert.equal(morpheus.health, 37); assert.equal(trinity.isInMatrix, true);
  const returned = structuredClone(morpheus);
  h.frames(9);
  assert.equal(trinity.currentLocation, 'film_neb_deck'); assert.equal(trinity.isInMatrix, false); assert.equal(trinity.health, 64);
  assert.equal(h.journey().matrixEscape!.phase, 'ready'); assert.equal(h.journey().step, 0);
  assert.deepEqual(morpheus, returned, 'finished crew must not be restaged every frame');
  h.command(); assert.equal(h.journey().matrixEscape!.phase, 'phone_shot');
  h.frames(4); assert.equal(h.journey().matrixEscape!.phase, 'duel');
  h.neo.health = 0; h.neo.status = 'dead'; h.frames(.1);
  assert.equal(h.journey().matrixEscape!.phase, 'failed');
  h.command('retry'); assert.equal(h.journey().matrixEscape!.phase, 'ready');
  assert.deepEqual(morpheus, returned); assert.equal(trinity.isInMatrix, false);
  h.command(); assert.equal(h.journey().matrixEscape!.phase, 'phone_shot');
});

test('pause, disconnect and restore retain the complete in-progress phone gesture and both crew positions', () => {
  const h = setup(); h.frames(5.2); h.frames(.1, false); h.world.simulationTick = h.tick();
  assert.equal(h.journey().matrixEscape!.phase, 'crew_exit');
  const clock = structuredClone(h.journey().matrixEscape);
  const actors = ['neo', 'morpheus', 'trinity'].map(id => structuredClone(h.world.agents.get(id)!));
  h.players.release('escape-player', h.tick());
  h.sandbox.restore(structuredClone(h.sandbox.state));
  assert.deepEqual(h.players.possess('returned-player', 'neo', h.tick()), { agentId: 'neo' });
  assert.deepEqual(h.journey().matrixEscape, clock);
  for (const before of actors) {
    const after = h.world.agents.get(before.id)!;
    assert.deepEqual(after.position, before.position); assert.deepEqual(after.currentAction, before.currentAction);
    assert.equal(after.isInMatrix, before.isInMatrix); assert.equal(after.health, before.health);
  }
});

test('an existing crew owner freezes departure and new possession cannot interrupt the phone sequence', () => {
  const h = setup(), morpheus = h.world.agents.get('morpheus')!;
  morpheus.controller = 'other-player'; const before = structuredClone(morpheus);
  h.frames(2);
  assert.deepEqual(morpheus, before); assert.match(h.journey().lastText, /另一位玩家/);
  assert.equal(h.journey().matrixEscape!.elapsed, 0);
  delete morpheus.controller; h.frames(.1);
  const error = h.players.possess('other-player', 'trinity', h.tick()).error;
  assert.match(error ?? '', /撤离|电话/);
  assert.equal(h.world.agents.get('trinity')!.controller, undefined);
});

test('dead crew and already returned crew are never resurrected or brought back into the Matrix', () => {
  const h = setup(), morpheus = h.world.agents.get('morpheus')!, trinity = h.world.agents.get('trinity')!;
  morpheus.status = 'dead'; morpheus.health = 0;
  trinity.isInMatrix = false; trinity.currentLocation = 'film_neb_deck';
  const before = [structuredClone(morpheus), structuredClone(trinity)];
  h.frames(.1); assert.equal(h.journey().matrixEscape!.phase, 'ready');
  h.command(); assert.equal(h.journey().matrixEscape!.phase, 'phone_shot');
  assert.deepEqual(morpheus, before[0]); assert.deepEqual(trinity, before[1]);
});

test('both approaches clear the phone backing, the visible bench, and Neo without jumping between waypoints', () => {
  for (const role of ['morpheus', 'trinity'] as const) {
    let previous = subwayCrewRoot(role, 0);
    for (let time = .1; time <= MATRIX_ESCAPE.subway.crewApproach + .01; time += .1) {
      const root = subwayCrewRoot(role, time);
      assert.equal(playerBlocked(filmPosition('film_subway_platform', root.x, root.z), true), false);
      assert.ok(Math.hypot(root.x - previous.x, root.z - previous.z) < .4);
      assert.ok(Math.hypot(root.x + .5, root.z - 31.1) > 1.2, 'do not walk through Neo');
      assert.ok(Math.abs(root.x + 8) > 4.25 + .55 || Math.abs(root.z - 27) > .55 + .55, 'clear the rendered bench');
      assert.ok(Math.abs(root.x + 7) > 1.15 + .55 || Math.abs(root.z - 32.45) > .25 + .55, 'clear the phone backing');
      previous = root;
    }
  }
});

test('the intact phone transfers one receiver to the crew and its cord follows the real hand across refresh clocks', t => {
  const root = new THREE.Group(), renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  t.after(() => renderer.dispose());
  const h = setup(), state = h.journey();
  state.matrixEscape!.phase = 'crew_exit'; state.matrixEscape!.crewExit = { roles: ['morpheus', 'trinity'], index: 0, elapsed: 4.7 };
  const fixed = root.getObjectByName('hardline-handset')!;
  assert.ok(fixed, 'the wall receiver must remain a separate dynamic object');
  renderer.update(state, 0); assert.equal(fixed.visible, true);
  const subject = new THREE.Group(), held = new THREE.Group(); held.name = 'hardline-handset'; held.position.set(3, 4, 5); subject.add(held);
  state.matrixEscape!.crewExit.elapsed = 5.8; renderer.update(state, 1, subject);
  assert.equal(fixed.visible, false); assert.equal(root.getObjectByName('matrix-subway-phone-debris')!.visible, false);
  const cord = root.getObjectByName('matrix-subway-phone-cord') as THREE.Line;
  assert.ok(cord);
  const positions = cord.geometry.attributes.position;
  assert.ok(new THREE.Vector3().fromBufferAttribute(positions, positions.count - 1).distanceTo(held.position) < .001);
  const saved = Array.from(positions.array); renderer.update(state, 999, subject); assert.deepEqual(Array.from(positions.array), saved);
});
