import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { enableSkinnedCulling } from '../packages/client/src/agents/SkinnedBounds.js';

test('a detached garment keeps its new skeleton bounds and restores the original owner on return', () => {
  const scene = new THREE.Scene(), actor = new THREE.Group(), garment = new THREE.Group();
  const bodyBone = new THREE.Bone(), clothBone = new THREE.Bone();
  actor.add(bodyBone); garment.add(clothBone); scene.add(actor, garment); scene.updateMatrixWorld(true);
  const bodySkeleton = new THREE.Skeleton([bodyBone]), clothSkeleton = new THREE.Skeleton([clothBone]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.SkinnedMesh(geometry, material);
  actor.add(mesh); mesh.bind(bodySkeleton, new THREE.Matrix4()); enableSkinnedCulling(actor);
  garment.add(mesh); mesh.bind(clothSkeleton, new THREE.Matrix4()); enableSkinnedCulling(garment);
  const containsActualVertices = () => {
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3());
      assert.ok(mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), 'the actual cloth surface remains available to colour, shadow and reflection cameras');
    }
  };
  try {
    garment.position.set(20, 3, -4); clothBone.position.set(8, -1, 2); garment.updateMatrixWorld(true);
    containsActualVertices(); const clothBox = mesh.boundingBox!.clone(), clothSphere = mesh.boundingSphere!.clone();
    actor.updateMatrixWorld(true);
    assert.deepEqual(mesh.boundingBox, clothBox, 'the former body skeleton must not overwrite detached-cloth bounds');
    assert.deepEqual(mesh.boundingSphere, clothSphere); containsActualVertices();
    actor.add(mesh); mesh.bind(bodySkeleton, new THREE.Matrix4()); bodyBone.position.set(-3, 1, 0);
    actor.updateMatrixWorld(true); containsActualVertices(); const bodyBox = mesh.boundingBox!.clone();
    garment.updateMatrixWorld(true);
    assert.deepEqual(mesh.boundingBox, bodyBox, 'the garment owner releases bounds when the original body binding returns');
    containsActualVertices();
  } finally { bodySkeleton.dispose(); clothSkeleton.dispose(); geometry.dispose(); material.dispose(); }
});

test('construction bounds include garment morph extrema through rotated and blended bones', () => {
  for (const relative of [true, false]) {
    const root = new THREE.Group(), first = new THREE.Bone(), second = new THREE.Bone();
    root.add(first, second); root.updateMatrixWorld(true);
    const geometry = new THREE.BufferGeometry(), base = [0, 0, 0, 1, 0, 0, 0, 2, 0], offsets = [-.8, .7, 2, .4, -.9, -1.6, .3, 1.2, 1.4];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([.25, .75, 0, 0, .5, .5, 0, 0, .75, .25, 0, 0], 4));
    geometry.morphTargetsRelative = relative;
    geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(relative ? offsets : base.map((v, i) => v + offsets[i]), 3)];
    const material = new THREE.MeshStandardMaterial(), mesh = new THREE.SkinnedMesh(geometry, material), skeleton = new THREE.Skeleton([first, second]);
    root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4()); enableSkinnedCulling(root);
    try {
      root.position.set(31, -2, 8); root.rotation.set(.2, .5, .1); root.scale.set(1.3, .8, .9);
      first.rotation.set(.3, -.5, .2); second.rotation.set(-.25, .6, -.1);
      for (const amount of [0, .2, .6, 1, .4]) {
        mesh.morphTargetInfluences![0] = amount; root.updateMatrixWorld(true);
        for (let i = 0; i < base.length / 3; i++) {
          const point = mesh.getVertexPosition(i, new THREE.Vector3());
          assert.ok(mesh.boundingBox!.containsPoint(point) && mesh.boundingSphere!.containsPoint(point), `${relative ? 'relative' : 'absolute'} morph ${amount}/${i}: deformed cloth escapes its production bone bounds`);
        }
      }
    } finally { skeleton.dispose(); geometry.dispose(); material.dispose(); }
  }
});
