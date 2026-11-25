import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { filmPosition, type BurlyPhase } from '@auto_matrix/shared';
import { PlayerControls } from '../packages/client/src/player/PlayerControls.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the close Smith grapple retains first-person hands and restores the ordinary near plane after release', t => {
  class Target extends EventTarget { matches() { return false; } }
  const canvas = new Target(), window = new Target();
  const document = Object.assign(new Target(), { pointerLockElement: null, hidden: false, exitPointerLock() {} });
  const previous = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, { window, document });
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const neo = world.agents.get('neo')!;
  Object.assign(neo, { controller: 'grapple-camera-test', currentLocation: 'film_oracle_courtyard', isInMatrix: true,
    position: filmPosition('film_oracle_courtyard', -7, -16), rotation: .77 });
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000), group = new THREE.Group(); group.add(new THREE.Group());
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {}); controls.possess(neo);
  t.after(() => { controls.dispose(); ['window', 'document'].forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
  }); });
  const pose = (phase: BurlyPhase | undefined, firstPerson: boolean, running: boolean) => {
    neo.currentAction = phase ? { type: 'idle', parameters: { player: true, resolved: true,
      burly: { phase, role: 'neo', elapsed: 1.938, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 0, nextCopyAt: 0 } },
      startedAt: 1, duration: 1, progress: 0 } : null;
    controls.firstPerson = firstPerson; controls.update(.02, neo, group, running);
  };
  for (const aspect of [16 / 9, 9 / 16]) for (const running of [false, true]) {
    camera.aspect = aspect; camera.updateProjectionMatrix(); pose('grapple', true, running);
    assert.ok(camera.near <= .1, 'the captured close fingers lie in front of the ordinary 0.5-unit near plane');
    pose('grapple', false, running); assert.equal(camera.near, .5, 'third person retains the ordinary projection');
    pose('swarm', true, running); assert.equal(camera.near, .5, 'escaping the hand restores the normal near plane');
    pose('grapple', true, running); pose(undefined, true, running); assert.equal(camera.near, .5, 'clearing the saved gesture also restores it');
  }
});
