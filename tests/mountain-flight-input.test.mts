import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type MountainFlight, type PlayerInput } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const firstPerson of [false, true]) test(`the restored ${firstPerson ? 'first' : 'third'}-person mountain flight steers with its south-facing camera`, t => {
  class Target extends EventTarget { matches() { return false; } }
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window: new Target(), document: Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} }) });
  let now = 100; t.mock.method(performance, 'now', () => now);
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { currentLocation: 'film_mountain_range', isInMatrix: true, health: 73 });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const sent: PlayerInput[] = [], controls = new PlayerControls(new Target() as unknown as HTMLCanvasElement, camera, input => sent.push(input), () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const input = (keys: string[]) => {
    for (const code of keys) window.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false }));
    now += 120; controls.update(.02, neo, group, true); const result = sent.at(-1)!;
    for (const code of keys) window.dispatchEvent(Object.assign(new Event('keyup'), { code }));
    now += 120; controls.update(.02, neo, group, true); return result;
  };
  for (const phase of ['takeoff', 'flying', 'arrived'] as const) for (const yaw of [Math.PI / 2, 0, -Math.PI / 2, Math.PI]) {
    const flight: MountainFlight = { phase, elapsed: 2.121, x: 38.7087, z: 176.8852, altitude: 47.6872, attempt: 1 };
    neo.position = { ...filmPosition('film_mountain_range', flight.x, flight.z), y: 48.6872 }; neo.rotation = yaw;
    neo.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, mountainFlight: flight }, startedAt: 304554, duration: 1, progress: 0 };
    controls.possess(neo); controls.firstPerson = firstPerson; controls.update(0, neo, group, false);
    for (const keys of [['KeyW'], ['ArrowUp']]) {
      const forward = input(keys); assert.ok(Math.abs(forward.x) < 1e-8 && forward.z < -.999, 'W must fly toward the city after a side-facing cold restore');
    }
    const left = input(['KeyA']), right = input(['KeyD']), back = input(['KeyS']), diagonal = input(['KeyW', 'KeyD', 'ShiftLeft']);
    assert.ok(left.x < -.999 && Math.abs(left.z) < 1e-8); assert.ok(right.x > .999 && Math.abs(right.z) < 1e-8);
    assert.ok(Math.abs(back.x) < 1e-8 && back.z > .999);
    assert.ok(diagonal.x > .7 && diagonal.z < -.7); assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-8); assert.equal(diagonal.sprint, true);
    assert.equal(neo.rotation, yaw); assert.equal(neo.health, 73); assert.deepEqual(neo.currentAction.parameters.mountainFlight, flight);
  }
  neo.currentAction = null; neo.position = filmPosition('film_mountain_range', 0, 245); neo.rotation = Math.PI / 2;
  controls.possess(neo); controls.firstPerson = firstPerson; controls.update(0, neo, group, false);
  const walking = input(['KeyW']); assert.ok(walking.x > .999 && Math.abs(walking.z) < 1e-8, 'ground walking still follows the current view');
});
