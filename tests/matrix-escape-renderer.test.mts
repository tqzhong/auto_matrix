import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MATRIX_ESCAPE, matrixEscapeRoot, type FilmJourney } from '@auto_matrix/shared';
import { MatrixEscapeRenderer } from '../packages/client/src/engine/MatrixEscapeRenderer.js';

const journey = (scene: 'm1_subway' | 'm1_city_chase'): FilmJourney => ({
  version: 1, scene, actor: 'neo', step: 0, completed: [], enteredAt: 0,
  checkpoint: { x: 0, y: 1, z: 0 }, reflections: {}, lastText: '',
  matrixEscape: { kind: scene === 'm1_subway' ? 'subway' : 'city', phase: 'ready', elapsed: 0, attempt: 0,
    checkpoint: scene === 'm1_subway' ? 'duel' : 'street', hits: 0, dodges: 0, pursuit: 0, segment: 0, possessions: 0, resolved: [] },
});

test('subway set owns a story-timed train, destructible phone, wall break and track struggle', () => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_subway_platform');
  for (const name of ['matrix-subway-platform', 'matrix-subway-track', 'matrix-subway-phone', 'matrix-subway-phone-debris',
    'matrix-subway-wall-break', 'matrix-subway-train', 'matrix-subway-train-headlight']) assert.ok(root.getObjectByName(name), name);
  const state = journey('m1_subway'); const encounter = state.matrixEscape!;
  renderer.update(state, 1); const train = root.getObjectByName('matrix-subway-train')!; const saved = train.position.clone();
  renderer.update(state, 99); assert.deepEqual(train.position.toArray(), saved.toArray(), 'global client time cannot move the saved train');
  encounter.phase = 'train_window'; encounter.elapsed = 2.4; renderer.update(state, 2);
  assert.equal(train.visible, true); assert.notDeepEqual(train.position.toArray(), saved.toArray());
  encounter.phase = 'body_swap'; encounter.elapsed = 1; renderer.update(state, 3);
  assert.equal(root.getObjectByName('matrix-subway-code-transform')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});

test('city route renders distinct market, failed phones, fire escapes, garbage truck and room 303 entrance', () => {
  const root = new THREE.Group(); const renderer = new MatrixEscapeRenderer(root, 'film_escape_streets');
  for (const name of ['matrix-city-market', 'matrix-city-phone-0', 'matrix-city-phone-1', 'matrix-city-fire-escape',
    'matrix-city-garbage-truck', 'matrix-city-room-303', 'matrix-city-code-transform']) assert.ok(root.getObjectByName(name), name);
  const state = journey('m1_city_chase'); const encounter = state.matrixEscape!;
  encounter.phase = 'phone_failure'; encounter.elapsed = 1.2; renderer.update(state, 4);
  assert.equal(root.getObjectByName('matrix-city-phone-sparks')!.visible, true);
  encounter.phase = 'truck_window'; encounter.elapsed = MATRIX_ESCAPE.city.truckBeat; renderer.update(state, 5);
  const truck = root.getObjectByName('matrix-city-garbage-truck')!; assert.equal(truck.visible, true); assert.ok(truck.position.z < 15);
  const neo = matrixEscapeRoot(encounter, 'neo');
  assert.ok(Math.abs(truck.position.z - 6.48 - neo.z) < 1, 'the truck front reaches Neo at the saved dodge beat');
  encounter.phase = 'possession'; encounter.elapsed = 1; renderer.update(state, 6);
  assert.equal(root.getObjectByName('matrix-city-code-transform')!.visible, true);
  renderer.dispose(); assert.equal(root.children.length, 0);
});
