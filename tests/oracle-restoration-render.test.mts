import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILM_SETS, SMITH_FINALE, filmPosition } from '@auto_matrix/shared';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

test('the restored Oracle lies on the actual crater floor and cold-loads without standing or foot IK', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'loadAsync', () => new Promise(() => {}));
  const document = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const oracle = world.agents.get('oracle')!;
  oracle.currentLocation = 'film_smith_avenue'; oracle.isInMatrix = true;
  oracle.position = filmPosition(oracle.currentLocation, SMITH_FINALE.oracle.x, SMITH_FINALE.oracle.z);
  oracle.position.y -= SMITH_FINALE.crater.depth - .025; oracle.rotation = SMITH_FINALE.oracle.yaw;
  const renderer = new AgentRenderer(new THREE.Scene()), cold = new AgentRenderer(new THREE.Scene());
  const bounds = (body: THREE.Group) => {
    body.updateWorldMatrix(true, true); const box = new THREE.Box3(), point = new THREE.Vector3();
    body.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.updateMatrixWorld(true); if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, point); object.localToWorld(point); box.expandByPoint(point);
      }
    });
    return box;
  };
  try {
    oracle.velocity = { x: 9, y: 0, z: 3 }; renderer.updateAgent('oracle', oracle);
    for (let i = 0; i < 25; i++) renderer.update(.03);
    oracle.velocity = { x: 0, y: 0, z: 0 };
    oracle.currentAction = { type: 'idle', parameters: { resolved: true, oracleRestored: true }, startedAt: 0, duration: 100000, progress: 0 };
    renderer.updateAgent('oracle', oracle); renderer.update(0);
    cold.updateAgent('oracle', structuredClone(oracle)); cold.update(0);
    const body = renderer.getAgentBody('oracle')!, box = bounds(body), restored = bounds(cold.getAgentBody('oracle')!);
    const floor = FILM_SETS.film_smith_avenue.center.y - 1 - SMITH_FINALE.crater.depth;
    assert.ok(box.max.y - box.min.y < 1.15, `unconscious body must be horizontal, height ${box.max.y - box.min.y}`);
    assert.ok(box.min.y >= floor - .005 && box.min.y < floor + .065, `actual skin/clothes must touch the pit floor: ${box.min.y - floor}`);
    const head = body.getObjectByName('oracle-head')!;
    const up = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(up.y > .95, 'the face must look upward, not into the water');
    const headBox = bounds(head as THREE.Group);
    assert.ok(headBox.min.y < floor + .12 && headBox.min.y >= floor - .005, `the back of the head must rest on the wet ground: ${headBox.min.y - floor}`);
    assert.ok(box.getSize(new THREE.Vector3()).length() > 3, 'keep the real full-size character mesh');
    assert.ok(box.min.distanceTo(restored.min) < .00001 && box.max.distanceTo(restored.max) < .00001, 'cold load must reproduce the same supported limbs');
    for (const dt of [.03, .1, 0]) { renderer.update(dt); const paused = bounds(body);
      assert.ok(box.min.distanceTo(paused.min) < .00001 && box.max.distanceTo(paused.max) < .00001, 'render time cannot alter a saved resting body'); }
    oracle.currentAction = null; renderer.updateAgent('oracle', oracle); renderer.update(.1);
    const standing = bounds(body); assert.ok(standing.max.y - standing.min.y > 3, 'the later park handoff releases the lying pose');
  } finally { renderer.dispose(); cold.dispose(); globalThis.document = document; }
});
