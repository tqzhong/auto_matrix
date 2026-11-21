import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type AgentState } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('same-scene checkpoint rebuild restores the camera and movement heading', t => {
  class Target extends EventTarget { matches() { return false; } }
  const canvas = new Target(), window = new Target();
  const document = Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.controller = 'respawn-camera-test'; neo.currentLocation = 'film_ambush_house'; neo.isInMatrix = true;
  neo.position = filmPosition('film_ambush_house', 11, 31.8); neo.rotation = Math.PI;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}); controls.possess(neo);
  t.after(() => {
    controls.dispose(); ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });

  const local = controls as unknown as { yaw: number; movementYaw: number; facing: number };
  local.yaw = local.movementYaw = local.facing = 1.4;
  controls.update(0, { ...neo, status: 'dead', health: 0, position: { ...neo.position } }, group, false);
  controls.update(0, { ...neo, status: 'alive', health: 100, rotation: Math.PI, position: { ...neo.position } } as AgentState, group, false);

  assert.equal(local.yaw, Math.PI);
  assert.equal(local.movementYaw, Math.PI);
  assert.equal(local.facing, Math.PI);
});
