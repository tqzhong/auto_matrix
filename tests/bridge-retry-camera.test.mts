import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, filmEntry } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('a same-scene bridge retry restores the film heading, drops stale keys and keeps fresh movement input', t => {
  class InputTarget extends EventTarget { matches() { return false; } }
  const window = new InputTarget(), canvas = new InputTarget();
  const document = Object.assign(new InputTarget(), { pointerLockElement: canvas, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!, scene = FILM_SCENE_BY_ID.m1_bridge, entry = filmEntry(scene);
  neo.currentLocation = scene.set; neo.isInMatrix = true; neo.rotation = 0;
  neo.position = { ...entry, x: entry.x + 10.5 };
  neo.currentAction = { type: 'idle', parameters: { bridgeCaught: { x: neo.position.x, z: neo.position.z } }, startedAt: 0, duration: 1, progress: 0 };
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  const internal = controls as unknown as { movementYaw: number; yaw: number; keys: Set<string> };
  t.after(() => {
    controls.dispose(); ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  const caught = structuredClone(neo);
  controls.possess(caught);
  internal.keys.add('KeyW');
  controls.update(1 / 60, caught, group, false);
  assert.equal(internal.keys.has('KeyW'), false);
  internal.movementYaw = 0; internal.yaw = 0; internal.keys.add('KeyW');
  const retry = structuredClone(caught); retry.position = entry; retry.rotation = Math.PI; retry.currentAction = null;

  controls.update(1 / 60, retry, group, false);

  assert.equal(internal.movementYaw, Math.PI);
  assert.equal(internal.yaw, Math.PI);
  assert.equal(internal.keys.has('KeyW'), true);
});
