import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SCENE_BY_ID, FILM_SETS, filmEntry, filmBlocked, filmPosition, LOGOS_COCKPIT } from '@auto_matrix/shared';
import { LogosFlightRenderer } from '../packages/client/src/engine/LogosFlightRenderer.js';
import { LogosWreckRenderer } from '../packages/client/src/engine/LogosWreckRenderer.js';

test('the broken cockpit retains the flown cabin width and window-bay spacing', () => {
  const root = new THREE.Group(), wreck = new THREE.Group();
  const flightRenderer = new LogosFlightRenderer(root, 'sun'), wreckRenderer = new LogosWreckRenderer(wreck);
  try {
    root.updateMatrixWorld(true); wreck.updateMatrixWorld(true);
    const cabin = root.getObjectByName('logos-flight-cockpit')!;
    // The displaced pilot seat is the anchor between the flight and farewell sets.
    const offset = new THREE.Vector3(-LOGOS_COCKPIT.roots.trinity.x, -LOGOS_COCKPIT.floor, -10.88);
    for (const side of [-1, 1]) for (const z of [-8, -6.5, -4, -1.5]) {
      const point = new THREE.Vector3(0, -.55, z), direction = new THREE.Vector3(side, 0, 0);
      const flown = new THREE.Raycaster(cabin.localToWorld(point.clone()), direction, 0, 12).intersectObject(cabin, true)[0];
      const broken = new THREE.Raycaster(point.clone().add(offset), direction, 0, 12).intersectObject(wreck.getObjectByName('logos-wreck-hull')!, true)[0];
      assert.ok(flown && broken, `both cabins need a physical sill at ${side}/${z}`);
      assert.ok(Math.abs(flown.distance - broken.distance) < .22,
        `a crash cannot turn a ${flown.distance.toFixed(2)}-wide half cabin into ${broken.distance.toFixed(2)}`);
    }
  } finally { flightRenderer.dispose(); wreckRenderer.dispose(); }
});

test('Neo enters beside the cockpit and the visible sill blocks leaving the wreck while the approach remains open', () => {
  const scene = FILM_SCENE_BY_ID.m3_farewell, set = FILM_SETS[scene.set], entry = filmEntry(scene);
  assert.ok(Math.abs(entry.z - set.center.z + 10.5) < 7, 'handoff must not spawn Neo in a distant generic hall');
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, x = (entry.x - set.center.x) * (1 - u), z = (entry.z - set.center.z) * (1 - u) - 13.1 * u;
    assert.equal(filmBlocked(filmPosition(scene.set, x, z), set, .38), false, `the actual approach is blocked at ${x}/${z}`);
  }
  for (const side of [-1, 1]) assert.equal(filmBlocked(filmPosition(scene.set, 1.35 + side * 3.3, -17), set, .38), true,
    'visible cockpit sides must stop the player instead of using unrelated ship columns');
});
