import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { cityTrafficPose } from '@auto_matrix/shared';
import { VoxelRenderer } from '../packages/client/src/engine/VoxelRenderer.js';

test('visible street cars use saved traffic poses rather than browser uptime', () => {
  const scene = new THREE.Scene(), renderer = new VoxelRenderer(scene);
  (renderer as unknown as { buildTraffic(): void }).buildTraffic();
  const mesh = renderer.matrix.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  const traffic = { elapsed: 12, cars: Array.from({ length: 64 }, () => ({ distance: 700, speed: 0 })) };
  const update = renderer.update.bind(renderer) as (time: number, camera: THREE.Camera | undefined, state: typeof traffic) => void;
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  try {
    update(20, undefined, traffic); mesh.getMatrixAt(0, matrix); point.setFromMatrixPosition(matrix);
    assert.equal(point.x, 1000, 'the visible car must occupy its saved world position');
    const before = matrix.clone(); update(200, undefined, traffic); mesh.getMatrixAt(0, matrix);
    assert.deepEqual(matrix.elements, before.elements, 'paused traffic cannot move when browser uptime changes');
    for (let index = 0; index < traffic.cars.length; index++) {
      mesh.getMatrixAt(index, matrix); const bounds = cityTrafficPose(index, traffic.cars[index]), vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
        assert.ok(Math.abs(point.x - bounds.position.x) <= bounds.width / 2 + .002 && Math.abs(point.z - bounds.position.z) <= bounds.depth / 2 + .002,
          `visible traffic mirror/bumper leaves its collider: ${index}/${i}`);
      }
    }
    const lamps = scene.getObjectByName('city-traffic-signals') as THREE.InstancedMesh, color = new THREE.Color();
    assert.ok(lamps.geometry.index!.count / 3 * lamps.count <= 60000, 'small traffic lenses must not consume hundreds of thousands of triangles per render pass');
    lamps.getColorAt(0, color); assert.ok(color.r > .7, 'the red axis must display a lit red signal');
    lamps.getColorAt(5, color); assert.equal(color.getHex(), 0x65d8a3, 'the perpendicular green axis must display a lit green signal');
  } finally {
    renderer.matrix.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); } });
  }
});
