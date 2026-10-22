import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchStaticGeometry } from '../packages/client/src/engine/StaticGeometry.js';
import { NebDeckRenderer } from '../packages/client/src/engine/NebDeckRenderer.js';

test('batching only fixed siblings leaves independently animated child assemblies intact', () => {
  const root = new THREE.Group(), moving = new THREE.Group(); root.add(moving);
  const material = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
  for (const parent of [root, moving]) for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.x = i * 2; parent.add(mesh);
  }
  const children = [...moving.children];
  const merged = batchStaticGeometry(root, new Set(), false);
  try {
    assert.equal(merged.length, 1, 'only the requested parent is batched');
    assert.deepEqual(moving.children, children, 'child renderers retain their own per-piece motion and lifetime');
    assert.equal(root.children.filter(child => child instanceof THREE.Mesh).length, 1);
  } finally { merged.forEach(value => value.dispose()); geometry.dispose(); material.dispose(); }
});

test('the delivered ship batches fixed deck pieces while retaining every oriented triangle, UV and shading flag', t => {
  const batches: THREE.Mesh[][] = [], remove = THREE.Object3D.prototype.remove;
  t.mock.method(THREE.Object3D.prototype, 'remove', function (this: THREE.Object3D, ...objects: THREE.Object3D[]) {
    if (this.name === 'neb-interior-deck' && objects.length > 1 && objects.every(object => object instanceof THREE.Mesh)) batches.push(objects as THREE.Mesh[]);
    return remove.apply(this, objects);
  });
  const root = new THREE.Group(), renderer = new NebDeckRenderer(root);
  try {
    const deck = root.getObjectByName('neb-interior-deck')!;
    assert.ok(batches.length >= 3, 'the ship must actually combine its repeated opaque fixed fixtures');
    let sourceMeshes = 0, vertices = 0, triangles = 0;
    const seen = new Set<THREE.Mesh>();
    for (const sources of batches) {
      const count = sources.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0), first = sources[0];
      const result = deck.children.find(child => child instanceof THREE.Mesh && !seen.has(child) && child.material === first.material
        && child.geometry.attributes.position.count === count && child.castShadow === first.castShadow && child.receiveShadow === first.receiveShadow) as THREE.Mesh;
      assert.ok(result, 'each original batch has one corresponding delivered draw'); seen.add(result);
      assert.equal(result.renderOrder, first.renderOrder); assert.equal(result.layers.mask, first.layers.mask);
      let vertexOffset = 0, indexOffset = 0;
      for (const source of sources) {
        assert.equal(source.name, '', 'named doors, controls, cables and contact fixtures stay independent');
        assert.equal(source.children.length, 0);
        assert.ok(!(source instanceof THREE.SkinnedMesh) && !(source instanceof THREE.InstancedMesh));
        const from = source.geometry.attributes, to = result.geometry.attributes, normals = new THREE.Matrix3().getNormalMatrix(source.matrix);
        for (let i = 0; i < from.position.count; i++) {
          const position = new THREE.Vector3().fromBufferAttribute(from.position, i).applyMatrix4(source.matrix);
          const normal = new THREE.Vector3().fromBufferAttribute(from.normal, i).applyMatrix3(normals).normalize();
          assert.ok(position.distanceTo(new THREE.Vector3().fromBufferAttribute(to.position, vertexOffset + i)) < 1e-5, 'a fixed surface moved during batching');
          assert.ok(normal.distanceTo(new THREE.Vector3().fromBufferAttribute(to.normal, vertexOffset + i)) < 1e-6, 'preserve the original surface direction');
          assert.ok(new THREE.Vector2().fromBufferAttribute(from.uv, i).distanceTo(new THREE.Vector2().fromBufferAttribute(to.uv, vertexOffset + i)) < 1e-6, 'preserve the atlas coordinates');
        }
        const index = source.geometry.index!;
        for (let i = 0; i < index.count; i++) assert.equal(result.geometry.index!.getX(indexOffset + i), index.getX(i) + vertexOffset, 'every oriented source triangle survives, including its winding');
        vertexOffset += from.position.count; indexOffset += index.count;
      }
      assert.equal(result.geometry.index!.count, indexOffset);
      sourceMeshes += sources.length; vertices += count; triangles += indexOffset / 3;
      let disposed = 0; result.geometry.addEventListener('dispose', () => disposed++);
      t.after(() => assert.equal(disposed, 1, 'the added combined geometry is released once'));
    }
    for (const name of ['neb-medical-control-knob', 'neb-cabin-door', 'neb-first-core-cable', 'neb-cargo-hatch', 'neb-medical-needle-0', 'neb-neo-metal-mug', 'neb-training-disk']) assert.ok(root.getObjectByName(name), `${name} must remain addressable`);
    t.diagnostic(JSON.stringify({ sourceMeshes, combinedDraws: batches.length, vertices, triangles }));
  } finally { renderer.dispose(); }
});
