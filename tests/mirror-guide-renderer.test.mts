import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { filmPosition, mirrorGuidePose } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('Morpheus walks the tracking-room route evenly between snapshots and stops his feet when waiting', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const morpheus = world.agents.get('morpheus')!;
  morpheus.position = filmPosition('film_lafayette', mirrorGuidePose(0).x, mirrorGuidePose(0).z);
  morpheus.currentLocation = 'film_lafayette'; morpheus.isInMatrix = true;
  morpheus.currentAction = { type: 'idle', parameters: { mirrorGuide: 0, seated: true }, startedAt: 0, duration: 1, progress: 0 };
  const renderer = new AgentRenderer(new THREE.Scene());
  try {
    renderer.updateAgent('morpheus', morpheus);
    const group = renderer.getAgent('morpheus')!;
    const rig = (renderer as unknown as { agents: Map<string, { rig: { motion: { speed: number } } }> }).agents.get('morpheus')!.rig;
    const snapshot = (progress: number, tick: number) => {
      const pose = mirrorGuidePose(progress);
      morpheus.position = filmPosition('film_lafayette', pose.x, pose.z);
      morpheus.velocity = { x: 0, y: 0, z: 3.2 };
      morpheus.currentAction = { type: 'move_to', parameters: { mirrorGuide: progress, seated: false }, startedAt: tick, duration: 1, progress: 0 };
      renderer.updateAgent('morpheus', morpheus);
    };

    snapshot(1.6, 1);
    for (let frame = 1; frame <= 5; frame++) {
      renderer.update(.1);
      const pose = mirrorGuidePose(frame * .32);
      const expected = filmPosition('film_lafayette', pose.x, pose.z);
      assert.ok(group.position.distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z)) < .01,
        `frame ${frame} should follow the authored route at a steady walking pace`);
    }
    snapshot(3.2, 2);
    renderer.update(.25);
    const corner = mirrorGuidePose(2.4);
    const expected = filmPosition('film_lafayette', corner.x, corner.z);
    assert.ok(group.position.distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z)) < .01,
      'interpolation must stay on the route through the turn');
    renderer.update(.25);
    renderer.update(.2);
    assert.ok(rig.motion.speed < 1, 'feet should settle while waiting for Neo instead of walking in place');

    const paused = group.position.clone();
    snapshot(4.8, 3); renderer.update(.2, undefined, 0);
    assert.ok(group.position.distanceTo(paused) < .001, 'pausing the simulation freezes the guide between snapshots');
  } finally { renderer.dispose(); globalThis.document = document; }
});
