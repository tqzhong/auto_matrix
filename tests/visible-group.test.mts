import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { VisibleGroup } from '../packages/client/src/engine/VisibleGroup.js';

test('hidden world and detail branches skip render transforms and catch up when shown', t => {
  const scene = new THREE.Scene(); const group = new VisibleGroup(); const bone = new THREE.Bone();
  const mesh = new THREE.Object3D(); group.add(bone); bone.add(mesh); scene.add(group);
  group.position.x = 10; bone.position.y = 2; mesh.position.z = 3; scene.updateMatrixWorld();
  const update = t.mock.method(bone, 'updateMatrixWorld');
  group.visible = false; group.position.x = 20; bone.position.y = 4;
  for (let frame = 0; frame < 4; frame++) scene.updateMatrixWorld();
  assert.equal(update.mock.callCount(), 0, 'invisible bones must not run in the render traversal');
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray(), [10, 2, 3]);
  group.visible = true; scene.updateMatrixWorld();
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray(), [20, 4, 3], 'the first visible frame must use all current transforms');
  group.visible = false; group.position.x = 30;
  assert.deepEqual(mesh.getWorldPosition(new THREE.Vector3()).toArray(), [30, 4, 3], 'explicit gameplay queries must still update a hidden hierarchy');
});
