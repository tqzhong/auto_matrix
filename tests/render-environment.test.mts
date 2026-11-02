import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createRenderEnvironment } from '../packages/client/src/engine/RenderEnvironment.js';

test('the environment capture can see the real sky surface in all six cube directions', t => {
  const target = new THREE.WebGLRenderTarget(1, 1); let captures = 0;
  t.mock.method(THREE.PMREMGenerator.prototype, 'fromScene', (scene: THREE.Scene, _sigma = 0, near = .1, far = 100) => {
    captures++;
    const sky = scene.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
    sky.updateWorldMatrix(true, false);
    const positions = sky.geometry.attributes.position, point = new THREE.Vector3(), sample = new THREE.Vector3();
    for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      let maximum = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(sky.matrixWorld);
        if (point.dot(axis) > maximum) { maximum = point.dot(axis); sample.copy(point); }
      }
      const camera = new THREE.PerspectiveCamera(90, 1, near, far); camera.up.set(0, 0, 1); camera.lookAt(axis); camera.updateMatrixWorld();
      const projected = sample.clone().project(camera);
      assert.ok(projected.z >= -1 && projected.z <= 1, `sky at ${sample.length()} is clipped by near/far ${near}/${far}`);
    }
    return target;
  });
  try {
    assert.equal(createRenderEnvironment({ compile() {} } as unknown as THREE.WebGLRenderer), target);
    assert.equal(captures, 1);
  } finally { target.dispose(); }
});
