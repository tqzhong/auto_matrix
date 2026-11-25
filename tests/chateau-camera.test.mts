import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CHATEAU, filmPosition } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

for (const weapon of ['sword', 'spear'] as const) test(`the ${weapon} rack cannot squeeze the third-person lens inside Neo`, t => {
  class Target extends EventTarget { matches() { return false; } }
  const canvas = new Target(), window = new Target();
  const document = Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group();
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const rack = CHATEAU.racks[weapon];
  Object.assign(neo, { controller: 'chateau-camera-test', currentLocation: 'film_chateau_hall', isInMatrix: true,
    health: 79.15, currentAction: { type: 'idle', parameters: { player: true, resolved: true, chateauWeapon: weapon },
      startedAt: 304168, duration: 1, progress: 0 } });
  for (const aspect of [16 / 9, 9 / 16]) for (const side of [-1, 1]) for (const yaw of [0, 1.037, -1.037, Math.PI]) {
    camera.aspect = aspect; camera.updateProjectionMatrix();
    neo.position = filmPosition('film_chateau_hall', rack.x, rack.z + side * 1.425); neo.rotation = yaw;
    controls.possess(neo);
    for (const running of [false, true]) {
      controls.firstPerson = true; controls.update(.02, neo, group, running);
      controls.firstPerson = false; controls.update(.02, neo, group, running);
      const gap = Math.hypot(camera.position.x - neo.position.x, camera.position.z - neo.position.z);
      assert.ok(gap >= 1.5 || camera.position.y >= neo.position.y + 4.15,
        `the compressed lens entered the body: ${JSON.stringify({ aspect, side, yaw, running, gap, eye: camera.position.toArray() })}`);
      if (gap < 1.5) {
        camera.updateMatrixWorld();
        const head = new THREE.Vector3(neo.position.x, neo.position.y + 3, neo.position.z).project(camera);
        assert.ok(Math.abs(head.x) < 1 && Math.abs(head.y) < 1 && head.z < 1,
          `lifting the lens must keep Neo in frame: ${JSON.stringify({ aspect, side, yaw, running, head: head.toArray() })}`);
      }
    }
  }
});
