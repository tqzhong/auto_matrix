import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { newTrilogyEpilogue, type TrilogyEpilogueEncounter } from '@auto_matrix/shared';
import { TrilogyEpilogueRenderer } from '../packages/client/src/engine/TrilogyEpilogueRenderer.js';

test('the walking black cat keeps its supporting paws fixed on the pavement while its body advances', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), renderer = new TrilogyEpilogueRenderer(root, 'reset');
  const paws = (elapsed: number) => {
    renderer.update({ ...newTrilogyEpilogue('reset'), phase: 'cat', elapsed, total: elapsed }, 99);
    root.updateMatrixWorld(true);
    const positions: THREE.Vector3[] = [];
    root.getObjectByName('matrix-reset-black-cat')!.traverse(object => {
      if (object.name === 'reset-cat-paw') positions.push(object.getWorldPosition(new THREE.Vector3()));
    });
    return positions;
  };
  try {
    for (const elapsed of [1.3, 2.4, 3.5, 4.5, 5.7, 6.8, 7.7]) {
      const before = paws(elapsed), after = paws(elapsed + .02);
      const supports = before.flatMap((p, index) => p.y < .051 && after[index].y < .051 ? [index] : []);
      assert.ok(supports.length >= 2, `${elapsed}: the walking cat needs at least two supported paws`);
      for (const index of supports) assert.ok(before[index].distanceTo(after[index]) < .004,
        `${elapsed}: planted paw ${index} slides ${before[index].distanceTo(after[index]).toFixed(4)} along the street`);
    }
  } finally { renderer.dispose(); }
});

test('the cat remains grounded around the child and restores the same complete pose without renderer time', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const root = new THREE.Group(), cold = new THREE.Group();
  root.position.set(4416, 0, 5056); cold.position.copy(root.position);
  const renderer = new TrilogyEpilogueRenderer(root, 'reset'), restored = new TrilogyEpilogueRenderer(cold, 'reset');
  const matrices = (scene: THREE.Group) => {
    scene.updateMatrixWorld(true); const result: number[][] = [];
    scene.getObjectByName('matrix-reset-black-cat')!.traverse(object => result.push(object.matrixWorld.toArray()));
    return result;
  };
  const states: TrilogyEpilogueEncounter[] = [
    ...Array.from({ length: 89 }, (_, i) => ({ ...newTrilogyEpilogue('reset'), phase: 'cat' as const, elapsed: i * .1, total: i * .1 })),
    ...Array.from({ length: 73 }, (_, i) => ({ ...newTrilogyEpilogue('reset'), phase: 'waking' as const, elapsed: i * .1, total: 8.8 + i * .1 })),
    { ...newTrilogyEpilogue('reset'), phase: 'done', elapsed: 0, total: 16 },
  ];
  try {
    for (const state of states) {
      renderer.update(state, 777); root.updateMatrixWorld(true);
      const heights: number[] = [];
      root.getObjectByName('matrix-reset-black-cat')!.traverse(object => {
        if (object.name !== 'reset-cat-paw') return;
        const paw = object as THREE.Mesh; let min = Infinity;
        for (let i = 0; i < paw.geometry.attributes.position.count; i++)
          min = Math.min(min, paw.localToWorld(paw.getVertexPosition(i, new THREE.Vector3())).y);
        heights.push(min);
      });
      assert.ok(Math.min(...heights) > -.003, `${state.phase}/${state.elapsed}: a paw penetrates the street`);
      assert.ok(heights.filter(y => y < .012).length >= 2, `${state.phase}/${state.elapsed}: the cat has insufficient support`);
    }
    for (const state of [states[45], states[107], states[150], states.at(-1)!, states[22]]) {
      renderer.update(state, 10); restored.update(structuredClone(state), 900);
      const before = matrices(root), after = matrices(cold);
      assert.equal(before.length, after.length);
      before.forEach((matrix, index) => matrix.forEach((value, entry) => assert.ok(Math.abs(value - after[index][entry]) < 1e-7)));
      renderer.update(state, 3000);
      const paused = matrices(root);
      before.forEach((matrix, index) => matrix.forEach((value, entry) => assert.ok(Math.abs(value - paused[index][entry]) < 1e-7,
        'a paused pose must not drift after a second update')));
    }
    const geometry = new Set<THREE.BufferGeometry>(), material = new Set<THREE.Material>();
    root.traverse(object => { if (object instanceof THREE.Mesh) {
      geometry.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(value => material.add(value));
    } });
    const counts = new Map<object, number>();
    for (const resource of [...geometry, ...material]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
    renderer.dispose();
    for (const resource of [...geometry, ...material]) assert.equal(counts.get(resource), 1, 'all visible cat/street resources must be released once');
  } finally { if (root.children.length) renderer.dispose(); restored.dispose(); }
});
