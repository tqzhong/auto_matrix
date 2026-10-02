import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('pausing an escort aligns the displayed body and heading with the saved pose before refreshing', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const previous = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const renderer = new AgentRenderer(new THREE.Scene()), smith = world.agents.get('smith')!;
  try {
    smith.currentAction = { type: 'move_to', parameters: { officeCustody: { role: 'smith', phase: 'escorting', elapsed: 3.2 } }, startedAt: 0, duration: 1, progress: 0 };
    renderer.updateAgent('smith', structuredClone(smith)); renderer.update(.1);
    smith.position.x += .4; smith.position.z += .5; smith.rotation = 1.3;
    smith.velocity = { x: 0, y: 0, z: 2.1 };
    renderer.updateAgent('smith', structuredClone(smith)); renderer.update(.02);
    renderer.update(0, undefined, 0);
    assert.deepEqual(renderer.getAgent('smith')!.position.toArray(), [smith.position.x, smith.position.y, smith.position.z]);
    assert.ok(Math.abs(renderer.getAgentBody('smith')!.rotation.y - smith.rotation) < .001, 'a pause must not leave the body facing velocity rather than the saved yaw');
    smith.currentAction.parameters.metacortexLift = true;
    smith.position.y -= .7;
    renderer.updateAgent('smith', structuredClone(smith)); renderer.update(.016);
    assert.equal(renderer.getAgent('smith')!.position.y, smith.position.y, 'interpolating the body independently from the car would bury the feet during descent');
  } finally { renderer.dispose(); globalThis.document = previous; }
});
