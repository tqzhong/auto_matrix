import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { newSmithFinale, smithFinalePose, stepSmithFinale } from '@auto_matrix/shared';
import { SmithFinaleRenderer } from '../packages/client/src/engine/SmithFinaleRenderer.js';

test('destroyed avenue geometry stays at the same saved pose during pause and cold loading', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  const coldRoot = new THREE.Group(), cold = new SmithFinaleRenderer(coldRoot);
  const beat = { ...newSmithFinale(), phase: 'building' as const, elapsed: .9, total: 8 };
  const snapshot = (group: THREE.Group) => {
    const result: number[][] = [];
    group.traverse(object => { if (object.name.includes('debris') || object.name.includes('rubble')) result.push(object.quaternion.toArray()); });
    return result;
  };
  try {
    renderer.update(beat, false, { x: 0, z: -15 }); const initial = snapshot(root);
    for (let i = 0; i < 45; i++) renderer.update(beat, false, { x: 0, z: -15 });
    assert.deepEqual(snapshot(root), initial, 'paused rubble cannot rotate per rendered frame');
    cold.update(beat, false, { x: 0, z: -15 }); assert.deepEqual(snapshot(coldRoot), initial);
  } finally { renderer.dispose(); cold.dispose(); }
});

test('the rain shock front starts between the two fighters, without a second local offset', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    const beat = { ...newSmithFinale(), phase: 'shockwave' as const };
    renderer.update(beat, false, { x: 0, z: -15 }); root.updateMatrixWorld(true);
    const center = root.getObjectByName('smith-finale-pressure-sphere')!.getWorldPosition(new THREE.Vector3());
    const pose = smithFinalePose(beat);
    assert.ok(Math.abs(center.z - (pose.neo.z + pose.smith.z) / 2) < .5, `pressure front is at ${center.z}`);
  } finally { renderer.dispose(); }
});

test('rain remains visible when the first-person player crosses the avenue origin', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    renderer.update(newSmithFinale(), true, { x: 0, z: 0 });
    const rain = root.getObjectByName('smith-finale-rain')!;
    assert.ok(rain.visible && rain.children.some(child => child.visible));
  } finally { renderer.dispose(); }
});

test('philosophical choices hold their step but allow saved weather time to flow', () => {
  for (const phase of ['approach', 'ready', 'assault_ready', 'choice', 'vision', 'understanding'] as const) {
    const beat = { ...newSmithFinale(), phase, elapsed: 0, total: 18 };
    const next = stepSmithFinale(beat, { focus: true, x: 1, z: 1 }, .05);
    assert.equal(next.total, 18.05); assert.equal(next.elapsed, 0); assert.equal(next.phase, phase);
    assert.deepEqual(stepSmithFinale(next, { focus: false, x: 0, z: 0 }, 0), next);
  }
});

test('leaving the avenue releases its reflected render target and ripple instance buffer', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  const water = root.getObjectByName('smith-finale-reflected-water') as Reflector;
  const ripples = root.getObjectByName('smith-finale-puddle-ripples') as THREE.InstancedMesh;
  let targets = 0, instances = 0;
  water.getRenderTarget().addEventListener('dispose', () => targets++);
  ripples.addEventListener('dispose', () => instances++);
  renderer.dispose();
  assert.equal(targets, 1); assert.equal(instances, 1); assert.equal(root.children.length, 0);
});

test('aerial rain spray follows both saved bodies without broad cones across the player view', () => {
  const root = new THREE.Group(), renderer = new SmithFinaleRenderer(root);
  try {
    for (const phase of ['shockwave', 'air_warning', 'building'] as const) {
      const beat = { ...newSmithFinale(), phase, elapsed: .8, total: 6.8, lane: .4 };
      renderer.update(beat, false, { x: 0, z: -25 });
      const trails = root.getObjectByName('smith-finale-air-trails')!;
      assert.ok(trails.visible, `${phase}: flight wakes must be attached during ascent as well`);
      assert.ok(trails.children.every(object => object instanceof THREE.LineSegments), 'rain wakes cannot be opaque flight cones');
      const spray = trails.children[0] as THREE.LineSegments, points = spray.geometry.getAttribute('position');
      const before = Array.from(points.array), pose = smithFinalePose(beat);
      for (let i = 0; i < points.count; i++) {
        const body = i < points.count / 2 ? pose.neo : pose.smith;
        const distance = new THREE.Vector3().fromBufferAttribute(points, i).distanceTo(new THREE.Vector3(body.x, body.y + 1.7, body.z));
        assert.ok(distance < 5, `${phase}: rain wake is ${distance} away from its fighter`);
      }
      renderer.update(beat, true, { x: 0, z: -25 });
      assert.deepEqual(Array.from(points.array), before, 'pausing or switching viewpoint cannot move the saved rain wake');
    }
  } finally { renderer.dispose(); }
});
