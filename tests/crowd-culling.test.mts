import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { AgentState } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

test('crowd limbs are culled per camera while their bounds contain walking, seated and airborne poses', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
  }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const models = new CharacterModels();
  const rig = models.create({ id: 'citizen_1', faction: 'civilians', isInMatrix: true,
    appearance: { headColor: '#d8ae91', clothing: '#363e43' } } as AgentState);
  const scene = new THREE.Scene(); scene.add(rig.root);
  rig.root.position.set(80, 3, -120); rig.root.rotation.y = .67; rig.root.scale.set(.91, 1.08, 1.01);
  const meshes: THREE.SkinnedMesh[] = []; rig.detail.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, .1, 1000), frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const poses: MotionInput[] = [idle, { ...idle, speed: 7, turn: .8 }, { ...idle, grounded: false, verticalVelocity: 4 },
    { ...idle, seated: true }, { ...idle, crouching: true }, { ...idle, attack: 0, windingUp: true }];
  try {
    assert.equal(meshes.length, 4, 'exercise the actual two arm and two leg meshes');
    let draws = 0; rig.detail.traverse(object => { if (object instanceof THREE.Mesh) draws++; });
    assert.ok(draws <= 30, `a detailed resident should not need ${draws} separate surface draws`);
    for (const input of poses) {
      for (let frame = 0; frame < 12; frame++) models.animate(rig, 1 / 30, input, 20);
      scene.updateMatrixWorld(true);
      camera.position.set(80, 6, -150); camera.lookAt(80, 6, -180); camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      assert.equal(meshes.filter(mesh => !mesh.frustumCulled || frustum.intersectsObject(mesh)).length, 0, 'limbs behind the view must not issue color or normal draws');
      for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point);
        assert.ok(mesh.boundingSphere!.distanceToPoint(point) < 1e-5, `posed vertex ${i} escapes its bound`);
      }
      camera.lookAt(80, 5, -120); camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      assert.ok(meshes.every(mesh => mesh.visible && frustum.intersectsObject(mesh)), 'the same limbs remain available to a facing camera, mirror or shadow view');
    }
    models.animate(rig, 1 / 30, idle, 150); scene.updateMatrixWorld(true);
    assert.equal(rig.detail.visible, false); assert.equal(rig.distant.visible, true);
    rig.root.position.x += 70;
    models.animate(rig, 1 / 30, poses[1], 20); scene.updateMatrixWorld(true);
    for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point);
      assert.ok(mesh.boundingSphere!.distanceToPoint(point) < 1e-5, 'returning from distant LOD restores current bounds on the first frame');
    }
  } finally { models.dispose(); globalThis.document = document; }
});
