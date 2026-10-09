import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newTrilogyEpilogue } from '@auto_matrix/shared';
import { TrilogyEpilogueRenderer } from '../packages/client/src/engine/TrilogyEpilogueRenderer.js';

function matrices(root: THREE.Group): number[][] {
  root.updateMatrixWorld(true);
  const result: number[][] = [];
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    result.push(object.matrixWorld.toArray());
    if (object instanceof THREE.InstancedMesh) result.push(Array.from(object.instanceMatrix.array));
  });
  return result;
}

test('the withdrawing sentinels use the saved clock across pause, reload and reverse seeking', () => {
  const root = new THREE.Group(), restored = new THREE.Group();
  const renderer = new TrilogyEpilogueRenderer(root, 'ceasefire'), cold = new TrilogyEpilogueRenderer(restored, 'ceasefire');
  try {
    for (const elapsed of [0, .8, 2.6, 4.9, 2.6, 0]) {
      const state = { ...newTrilogyEpilogue('ceasefire'), phase: 'retreat' as const, elapsed, total: elapsed };
      renderer.update(state, 1); const before = matrices(root);
      renderer.update(state, 10000);
      assert.deepEqual(matrices(root), before, 'paused tentacles and bodies cannot animate from browser time');
      cold.update(structuredClone(state), 0);
      assert.deepEqual(matrices(restored), before, 'a cold load must render the same saved withdrawal');
    }
  } finally { renderer.dispose(); cold.dispose(); }
});

test('a full withdrawal swarm shares geometry and releases its instance buffers after leaving', () => {
  const root = new THREE.Group(), renderer = new TrilogyEpilogueRenderer(root, 'ceasefire');
  try {
    renderer.update({ ...newTrilogyEpilogue('ceasefire'), phase: 'retreat', elapsed: 1, total: 1 }, 1);
    const draws: THREE.Mesh[] = []; root.traverseVisible(object => { if (object instanceof THREE.Mesh) draws.push(object); });
    assert.ok(draws.length <= 6, `18 complete sentinels must not produce ${draws.length} separate surface draws`);
    assert.ok(draws.every(mesh => mesh instanceof THREE.InstancedMesh), 'the whole swarm shares its mechanical surfaces');
    const disposed = new Set<THREE.Object3D>();
    draws.forEach(mesh => mesh.addEventListener('dispose', () => disposed.add(mesh)));
    renderer.dispose();
    assert.equal(disposed.size, draws.length, 'leaving the temple must release every instance buffer');
    assert.equal(root.children.length, 0);
  } finally { renderer.dispose(); }
});
