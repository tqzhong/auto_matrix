import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PhoneModel } from '../packages/client/src/agents/PhoneModel.js';

function setup(t: test.TestContext) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) } as unknown as Document;
  t.after(() => { globalThis.document = previous; });
}

test('the handset groups static opaque surfaces while retaining its independent display and slider', t => {
  setup(t); const phone = new PhoneModel(); t.after(() => phone.dispose());
  const meshes: THREE.Mesh[] = []; phone.root.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  assert.ok(meshes.length <= 7, `one held phone should not add ${meshes.length} draws to each color, normal and shadow pass`);
  assert.ok(phone.root.getObjectByName('phone-lcd') instanceof THREE.Mesh);
  assert.ok(phone.root.getObjectByName('phone-keypad') instanceof THREE.Mesh);
  assert.ok(meshes.every(mesh => mesh.castShadow && mesh.receiveShadow));
});

test('batching preserves every handset triangle, normal and UV through the complete sliding motion', t => {
  setup(t);
  const prototype = PhoneModel.prototype as unknown as { batch?: (parent: THREE.Group) => void };
  const batch = prototype.batch; prototype.batch = () => {};
  let reference: PhoneModel;
  try { reference = new PhoneModel(); }
  finally { if (batch) prototype.batch = batch; else delete prototype.batch; }
  const actual = new PhoneModel(); t.after(() => { reference.dispose(); actual.dispose(); });
  const surfaces = (phone: PhoneModel) => {
    const materials = (phone as unknown as { materials: THREE.Material[] }).materials;
    const result = new Map<string, { position: number[]; normal: number[]; uv: number[] }>();
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), matrix = new THREE.Matrix3();
    phone.root.updateMatrixWorld(true);
    phone.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const key = `${object.parent === phone.root ? 'body' : 'slider'}/${materials.indexOf(object.material as THREE.Material)}`;
      const row = result.get(key) ?? { position: [], normal: [], uv: [] }; result.set(key, row);
      const geometry = object.geometry, index = geometry.index, p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
      matrix.getNormalMatrix(object.matrixWorld);
      for (let i = 0; i < (index?.count ?? p.count); i++) {
        const v = index ? index.getX(i) : i;
        point.fromBufferAttribute(p, v).applyMatrix4(object.matrixWorld); row.position.push(...point.toArray());
        normal.fromBufferAttribute(n, v).applyMatrix3(matrix).normalize(); row.normal.push(...normal.toArray());
        row.uv.push(uv.getX(v), uv.getY(v));
      }
    });
    return result;
  };
  for (const phone of [reference, actual]) {
    phone.root.position.set(1100, 61.5, 850); phone.root.rotation.set(.27, -.65, .31); phone.root.scale.set(.95, 1.1, .83);
  }
  for (const slide of [0, .25, .5, .75, 1]) {
    reference.update(slide); actual.update(slide);
    const before = surfaces(reference), after = surfaces(actual);
    assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
    for (const [key, row] of before) for (const attribute of ['position', 'normal', 'uv'] as const) {
      const output = after.get(key)![attribute]; assert.equal(output.length, row[attribute].length, `${key}: no surface vertices may disappear`);
      for (let i = 0; i < output.length; i++) assert.ok(Math.abs(output[i] - row[attribute][i]) < 1e-6, `${key}/${attribute}/${i}: merged surface changed`);
    }
    const lcd = (phone: PhoneModel) => (phone.root.getObjectByName('phone-lcd') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.map;
    assert.equal(lcd(actual)?.image, (actual as unknown as { screens: THREE.Texture[] }).screens[slide > .5 ? 1 : 0].image);
  }
});
