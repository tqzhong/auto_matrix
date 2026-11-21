import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { METACORTEX } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the third-person camera stays on Neo\'s side of the Metacortex entrance after reattaching', t => {
  class Target extends EventTarget { matches() { return false; } }
  const canvas = new Target(), window = new Target();
  const document = Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const neo = world.agents.get('neo')!;
  neo.controller = 'metacortex-camera-test'; neo.currentLocation = 'metacortex_office'; neo.isInMatrix = true;
  neo.position = { x: 1139.976304142544, y: 1, z: 851.3619521599023 }; neo.rotation = -3.2004103309361205;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  controls.possess(neo);
  controls.structures = [];
  t.after(() => {
    controls.dispose(); ['window', 'document'].forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });

  controls.update(0, neo, new THREE.Group(), false);

  const rearWall = METACORTEX.center.z + METACORTEX.depth / 2;
  assert.ok(camera.position.z < rearWall - .5,
    `the camera crossed the lobby's rear wall at z=${rearWall}: ${camera.position.z}`);
  assert.ok(camera.position.z > neo.position.z, 'the camera should remain behind Neo inside the lobby');

  const outside = { ...neo, currentLocation: 'times_square', position: { ...neo.position, z: rearWall + 9 }, rotation: 0 };
  controls.possess(outside);
  controls.update(0, outside, new THREE.Group(), false);
  assert.ok(camera.position.z > rearWall + .5,
    `the camera crossed into the lobby from outside at z=${rearWall}: ${camera.position.z}`);

  const transition = { ...neo, currentLocation: 'metacortex_office', position: { ...neo.position, z: rearWall - 2 }, rotation: 0 };
  const transitionGroup = new THREE.Group();
  controls.possess(transition);
  controls.update(0, transition, transitionGroup, false);
  window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW', repeat: false }));
  for (let step = 0; step < 72; step++) {
    controls.update(.05, transition, transitionGroup, false);
    transition.position = { x: transitionGroup.position.x, y: transitionGroup.position.y, z: transitionGroup.position.z };
    transition.currentLocation = transition.position.z < rearWall + 9 ? 'metacortex_office' : 'times_square';
    assert.ok(transition.position.z < rearWall ? camera.position.z < rearWall : camera.position.z > rearWall,
      `the camera crossed the rear wall while Neo was at z=${transition.position.z}: ${camera.position.z}`);
  }
  window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyW' }));
});
