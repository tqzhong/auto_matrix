import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchStaticGeometry } from '../packages/client/src/engine/StaticGeometry.js';

test('fixed siblings share draws without changing textured surfaces, animated parents, or moving parts', () => {
  const root = new THREE.Group(), joint = new THREE.Group(); root.add(joint);
  const material = new THREE.MeshStandardMaterial({ color: 0x45504e, roughness: .72 });
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: .5 });
  const box = new THREE.BoxGeometry(), sphere = new THREE.SphereGeometry(1, 8, 6);
  const meshes = [box, sphere, box, box].map((geometry, i) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * 3, i * .3, .7); mesh.rotation.y = i * .19;
    mesh.scale.set(1 + i * .1, .6, .8); mesh.castShadow = mesh.receiveShadow = true; joint.add(mesh); return mesh;
  });
  const moving = meshes[3]; const named = new THREE.Mesh(box, material); named.name = 'button'; joint.add(named);
  const hidden = new THREE.Mesh(box, material); hidden.visible = false; joint.add(hidden);
  const transparent = new THREE.Mesh(box, glass); joint.add(transparent);
  const reflected = new THREE.Mesh(box, material); reflected.scale.x = -1; joint.add(reflected);
  const reference = root.clone(true); const referenceJoint = reference.children[0]; const referenceMoving = referenceJoint.children[3];
  const geometry = batchStaticGeometry(root, new Set([moving]));
  const surfaces = (group: THREE.Object3D) => {
    const result: { material: THREE.Material | THREE.Material[]; position: THREE.Vector3; normal: THREE.Vector3; uv: THREE.Vector2 }[] = [];
    group.updateMatrixWorld(true);
    group.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const { position, normal, uv } = object.geometry.attributes; const normals = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
      for (let i = 0; i < position.count; i++) result.push({ material: object.material,
        position: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld),
        normal: new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(normals).normalize(), uv: new THREE.Vector2().fromBufferAttribute(uv, i) });
    });
    return result;
  };
  try {
    assert.equal(geometry.length, 1);
    assert.equal(joint.children.length, referenceJoint.children.length - 2, 'three fixed pieces use one draw');
    for (const object of [moving, named, hidden, transparent, reflected]) assert.equal(object.parent, joint);
    for (const rotation of [0, .8]) {
      joint.rotation.x = referenceJoint.rotation.x = rotation; root.position.set(4, 2, -6); reference.position.copy(root.position);
      moving.position.y = referenceMoving.position.y = 2 + rotation;
      const expected = surfaces(reference), actual = surfaces(root);
      assert.equal(actual.length, expected.length, 'no vertices are simplified or dropped');
      for (const vertex of expected) assert.ok(actual.some(candidate => candidate.material === vertex.material
        && candidate.position.distanceTo(vertex.position) < 1e-5 && candidate.normal.distanceTo(vertex.normal) < 1e-5
        && candidate.uv.distanceTo(vertex.uv) < 1e-6), 'world positions, surface normals and texture coordinates survive batching');
    }
    const batch = joint.children.find(object => object instanceof THREE.Mesh && geometry.includes(object.geometry)) as THREE.Mesh;
    assert.equal(batch.castShadow, true); assert.equal(batch.receiveShadow, true);
  } finally { geometry.forEach(value => value.dispose()); box.dispose(); sphere.dispose(); material.dispose(); glass.dispose(); }
});
