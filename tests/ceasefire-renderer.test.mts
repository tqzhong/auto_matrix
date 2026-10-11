import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ceasefireSentinelPose, newTrilogyEpilogue } from '@auto_matrix/shared';
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

test('the retreat formation keeps separate hulls while converging into the roof opening', () => {
  for (let frame = 0; frame <= 260; frame++) {
    const state = { ...newTrilogyEpilogue('ceasefire'), phase: 'retreat' as const, elapsed: frame * .02, total: frame * .02 };
    const bodies = Array.from({ length: 18 }, (_, i) => ceasefireSentinelPose(state, i));
    for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
      const distance = Math.hypot(bodies[a].x - bodies[b].x, bodies[a].y - bodies[b].y, bodies[a].z - bodies[b].z);
      assert.ok(distance > 3, `${state.elapsed}/${a}/${b}: hull centers approach within ${distance}`);
    }
  }
});

test('the converged machines ascend nose first with their arms trailing below the hull', () => {
  const root = new THREE.Group(), renderer = new TrilogyEpilogueRenderer(root, 'ceasefire');
  try {
    for (const elapsed of [1.8, 2.6, 4.9]) {
      renderer.update({ ...newTrilogyEpilogue('ceasefire'), phase: 'retreat', elapsed, total: elapsed }, 0);
      root.updateMatrixWorld(true);
      for (let i = 1; i <= 18; i++) {
        const body = root.getObjectByName(`ceasefire-retreating-sentinel-${i}`)!;
        const center = body.getWorldPosition(new THREE.Vector3());
        const nose = body.localToWorld(new THREE.Vector3(0, 0, 1.5));
        const tail = body.localToWorld(new THREE.Vector3(0, 0, -6));
        assert.ok(nose.y > center.y + 1.49, `${elapsed}/${i}: the ascending machine is facing downward`);
        assert.ok(tail.y < center.y - 5.99, `${elapsed}/${i}: trailing arms must remain below the body`);
      }
    }
  } finally { renderer.dispose(); }
});

test('the rendered hulls and trailing arms remain inside the clear bore while crossing the roof slab', () => {
  const root = new THREE.Group(), renderer = new TrilogyEpilogueRenderer(root, 'ceasefire');
  const matrix = new THREE.Matrix4(), vertex = new THREE.Vector3();
  let crossings = 0;
  try {
    for (let frame = 0; frame < 100; frame++) {
      const elapsed = frame * .052;
      renderer.update({ ...newTrilogyEpilogue('ceasefire'), phase: 'retreat', elapsed, total: elapsed }, 0);
      root.traverseVisible(object => {
        if (!(object instanceof THREE.InstancedMesh)) return;
        const positions = object.geometry.attributes.position;
        for (let instance = 0; instance < object.count; instance++) {
          object.getMatrixAt(instance, matrix);
          for (let index = 0; index < positions.count; index++) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(matrix);
            if (vertex.y < 30.45 || vertex.y > 31.55) continue;
            crossings++;
            assert.ok(Math.hypot(vertex.x, vertex.z + 105) < 6.8,
              `${elapsed}/${object.name}/${instance}: surface intersects the roof outside its bore`);
          }
        }
      });
    }
    assert.ok(crossings > 1000, 'the test must sample actual surfaces crossing the roof');
  } finally { renderer.dispose(); }
});

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
