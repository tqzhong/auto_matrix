import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LAFAYETTE, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { LafayetteApproachRenderer } from '../packages/client/src/engine/LafayetteApproachRenderer.js';

test('opening 1313 clears the visible doorway as well as its collision', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new LafayetteApproachRenderer(root, new THREE.Vector3());
  const ray = new THREE.Raycaster(new THREE.Vector3(26, 87.3, 0), new THREE.Vector3(-1, 0, 0), 0, 8);
  try {
    renderer.update({ progress: HOTEL_DOOR_PROGRESS }, 84); root.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(root, true).length > 0, 'the closed wooden door is visible');
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, door: LAFAYETTE.doorSeconds }, 84); root.updateMatrixWorld(true);
    for (const height of [85.2, 86.9, 87.3, 89]) for (const z of [-1, 0, 1]) {
      ray.ray.origin.set(26, height, z);
      assert.equal(ray.intersectObject(root, true).length, 0, `trim or panelling crosses the open passage at ${height}, ${z}`);
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('each knuckle impact briefly gives the closed 1313 door', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new LafayetteApproachRenderer(root, new THREE.Vector3());
  const door = (renderer as unknown as { door: THREE.Group }).door;
  try {
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, knock: .78 }, 84); const resting = door.position.x;
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, knock: .855 }, 84);
    assert.ok(door.position.x < resting - .02, `the wooden panel must flex inward on contact: ${door.position.x} vs ${resting}`);
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, knock: 1.0 }, 84);
    assert.ok(Math.abs(door.position.x - resting) < .001, 'the panel must settle again between knocks');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('Trinity can visibly pass through the adjacent room door after Morpheus nods', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(); const renderer = new LafayetteApproachRenderer(root, new THREE.Vector3());
  const ray = new THREE.Raycaster(new THREE.Vector3(26, 87.3, LAFAYETTE.sideDoor.z), new THREE.Vector3(-1, 0, 0), 0, 8);
  try {
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, entered: true, welcome: { phase: 'ready', elapsed: 0 } }, 84); root.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(root, true).length > 0, 'the adjacent wooden door stays closed before the handshake');
    renderer.update({ progress: HOTEL_DOOR_PROGRESS, entered: true, welcome: { phase: 'departing', elapsed: 2 } }, 84); root.updateMatrixWorld(true);
    for (const height of [85.2, 87.3, 89]) for (const z of [13, 14, 15]) {
      ray.ray.origin.set(26, height, z);
      assert.equal(ray.intersectObject(root, true).length, 0, `wall trim crosses the adjacent doorway at ${height}, ${z}`);
    }
  } finally { renderer.dispose(); globalThis.document = document; }
});
