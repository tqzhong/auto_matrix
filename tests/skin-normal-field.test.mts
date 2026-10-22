import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { SkinContinuity } from '../packages/client/src/agents/SkinContinuity.js';

test('a skin extension interpolates its neighbouring boundary normals instead of creating nearest-point lighting plateaus', () => {
  const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
  const geometry = (points: number[], normals: number[], index: number[]) => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(points.length / 3 * 4), 4));
    result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: points.length / 3 }, () => [1, 0, 0, 0]).flat(), 4));
    result.setIndex(index); return result;
  };
  const boundary = [-.02, 0, 0, 0, 0, 0, .02, 0, 0], normals = [-.6, 0, .8, 0, 0, 1, .6, 0, .8];
  const handGeometry = geometry([...boundary, -.02, .04, 0, 0, .04, 0, .02, .04, 0], [...normals, ...normals], [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);
  const bodyGeometry = geometry([...boundary, -.009, -.04, 0, .009, -.04, 0], Array.from({ length: 5 }, () => [0, 0, 1]).flat(), [0, 3, 1, 1, 3, 4, 1, 4, 2]);
  const handMaterial = new THREE.MeshPhysicalMaterial(), bodyMaterial = new THREE.MeshStandardMaterial();
  const hand = new THREE.SkinnedMesh(handGeometry, handMaterial), body = new THREE.SkinnedMesh(bodyGeometry, bodyMaterial);
  hand.name = 'Anatomical_head_and_hands'; root.add(hand, body); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([bone]); hand.bind(skeleton); body.bind(skeleton);
  const surface = new SkinContinuity({ root, bones: new Map([['wrist_R', bone]]) } as unknown as HeroRig, body);
  try {
    surface.update();
    const normal = body.geometry.attributes.normal, left = new THREE.Vector3().fromBufferAttribute(normal, 3), right = new THREE.Vector3().fromBufferAttribute(normal, 4);
    assert.ok(left.x < -.015 && right.x > .015, `both interior vertices inherited a flat nearest-point normal: ${left.toArray()} / ${right.toArray()}`);
    assert.ok(Math.abs(left.x + right.x) < 1e-6 && Math.abs(left.z - right.z) < 1e-6, 'the transition must preserve the symmetric surface');
    for (let i = 0; i < 3; i++) assert.ok(new THREE.Vector3().fromBufferAttribute(normal, i).distanceTo(new THREE.Vector3().fromArray(normals, i * 3)) < 1e-6, 'the exact seam must retain its original boundary direction');
  } finally { surface.dispose(); handGeometry.dispose(); bodyGeometry.dispose(); handMaterial.dispose(); bodyMaterial.dispose(); skeleton.dispose(); }
});
