import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { EyelidCorrectives } from '../packages/client/src/agents/EyelidCorrectives.js';

test('the tear-line midpoint clears the eye while original endpoints and the other eye stay fixed', () => {
  const root = new THREE.Group(), face = new THREE.Mesh(new THREE.BufferGeometry()); face.name = 'face';
  face.morphTargetDictionary = { eyeWideLeft: 0, eyeWideRight: 1 }; face.morphTargetInfluences = [0, 0];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -.6, .8, 2, -.6, .8], 3));
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, .225], 3),
    new THREE.Float32BufferAttribute([0, 0, .225, 0, 0, 0], 3),
    new THREE.Float32BufferAttribute([0, 1.2, 0, 0, 0, 0], 3),
  ]; geometry.morphTargetsRelative = true;
  const lining = new THREE.Mesh(geometry); lining.name = 'lining';
  lining.morphTargetDictionary = { rightClearance: 0, leftClearance: 1, eyeWideLeft: 2 }; lining.morphTargetInfluences = [0, 0, 0]; root.add(face, lining);
  const driver = new EyelidCorrectives({ root }, { sourceMesh: 'face', mesh: 'lining', shapes: [{ control: 'eyeWideLeft', target: 'leftClearance' }, { control: 'eyeWideRight', target: 'rightClearance' }] });
  const point = new THREE.Vector3(), other = lining.getVertexPosition(1, new THREE.Vector3());
  for (const amount of [0, .25, .5, .75, 1, .5, 0]) {
    face.morphTargetInfluences[0] = amount; lining.morphTargetInfluences[2] = amount; driver.update();
    lining.getVertexPosition(0, point); assert.ok(point.length() >= 1 - 1e-7, 'the uncorrected midpoint enters the unit eyeball');
    assert.ok(lining.getVertexPosition(1, new THREE.Vector3()).distanceTo(other) < 1e-12, 'independent opposite eye');
    const expected = point.clone(); driver.update(); assert.ok(lining.getVertexPosition(0, point).distanceTo(expected) < 1e-12, 'repeated paused frames do not accumulate');
  }
  assert.equal(lining.morphTargetInfluences[1], 0, 'release clears the corrective');
  face.morphTargetInfluences[1] = .5; driver.update(); assert.equal(lining.morphTargetInfluences[0], 1);
  face.morphTargetInfluences.fill(0); driver.update(); assert.deepEqual(lining.morphTargetInfluences.slice(0, 2), [0, 0]);
});

test('the posterior lid seal follows corrected lining shapes by name and returns to neutral', () => {
  const root = new THREE.Group(), face = new THREE.Mesh(), lining = new THREE.Mesh(), seal = new THREE.Mesh();
  face.name = 'face'; lining.name = 'lining'; seal.name = 'seal'; root.add(face, lining, seal);
  face.morphTargetDictionary = { eyeWideLeft: 0 }; face.morphTargetInfluences = [.5];
  lining.morphTargetDictionary = { eyeBlinkRight: 0, clearance: 1 }; lining.morphTargetInfluences = [.7, 0];
  seal.morphTargetDictionary = { clearance: 0, eyeBlinkRight: 1 }; seal.morphTargetInfluences = [0, 0];
  const driver = new EyelidCorrectives({ root }, { sourceMesh: 'face', mesh: 'lining', sealMesh: 'seal', shapes: [{ control: 'eyeWideLeft', target: 'clearance' }] });
  driver.update(); assert.deepEqual(seal.morphTargetInfluences, [1, .7], 'copy after applying the lining clearance');
  driver.update(); assert.deepEqual(seal.morphTargetInfluences, [1, .7], 'paused frames do not accumulate');
  face.morphTargetInfluences[0] = 0; lining.morphTargetInfluences[0] = 0; driver.update();
  assert.deepEqual(seal.morphTargetInfluences, [0, 0], 'ending a clip removes the seal pose too');
});

test('blink skin and its lining follow the same eye-clearing arc and reset independently', () => {
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, .6, .8, 2, .6, .8], 3));
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute([0, -1.2, 0, 0, 0, 0], 3),
    new THREE.Float32BufferAttribute([0, 0, 0, 0, -1.2, 0], 3),
    new THREE.Float32BufferAttribute([0, 0, .225, 0, 0, 0], 3),
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, .225], 3),
  ]; geometry.morphTargetsRelative = true;
  const face = new THREE.Mesh(geometry), lining = new THREE.Mesh(geometry.clone()), seal = new THREE.Mesh(geometry.clone());
  face.name = 'face'; lining.name = 'lining'; seal.name = 'seal'; root.add(face, lining, seal);
  const dictionary = { eyeBlinkLeft: 0, eyeBlinkRight: 1, blinkArcLeft: 2, blinkArcRight: 3 };
  for (const mesh of [face, lining, seal]) { mesh.morphTargetDictionary = { ...dictionary }; mesh.morphTargetInfluences = [0, 0, 0, 0]; }
  const shapes = [{ control: 'eyeBlinkLeft', target: 'blinkArcLeft' }, { control: 'eyeBlinkRight', target: 'blinkArcRight' }];
  const driver = new EyelidCorrectives({ root }, { sourceMesh: 'face', mesh: 'lining', sealMesh: 'seal', shapes, faceShapes: shapes });
  const other = face.getVertexPosition(1, new THREE.Vector3());
  for (const amount of [0, .25, .5, .75, 1, .5, 0]) {
    face.morphTargetInfluences[0] = amount; lining.morphTargetInfluences[0] = amount; driver.update();
    const point = face.getVertexPosition(0, new THREE.Vector3());
    assert.ok(point.length() >= 1 - 1e-7, 'linear skin closure cuts through the eyeball between endpoints');
    assert.ok(lining.getVertexPosition(0, new THREE.Vector3()).distanceTo(point) < 1e-12, 'skin and lining use the same path');
    assert.ok(face.getVertexPosition(1, new THREE.Vector3()).distanceTo(other) < 1e-12, 'other eye remains independent');
    assert.deepEqual(seal.morphTargetInfluences, lining.morphTargetInfluences, 'posterior seal follows the corrected lining');
    driver.update(); assert.ok(face.getVertexPosition(0, new THREE.Vector3()).distanceTo(point) < 1e-12, 'paused updates do not accumulate');
  }
  assert.deepEqual(face.morphTargetInfluences, [0, 0, 0, 0], 'releasing the control clears the skin arc');
  face.morphTargetInfluences[1] = .5; driver.update();
  assert.equal(face.morphTargetInfluences[2], 0); assert.equal(face.morphTargetInfluences[3], 1);
  face.morphTargetInfluences[1] = 0; driver.update(); assert.equal(face.morphTargetInfluences[3], 0);
});

test('overlapping upper-lid controls share their physical range without losing input values', () => {
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1, 2, 0, 1], 3));
  geometry.morphTargetsRelative = true;
  const left = [0, 1, 0, 0, 0, 0], right = [0, 0, 0, 0, 1, 0];
  geometry.morphAttributes.position = [left, left, right, right, left.map(x => -x), left.map(x => -x), right.map(x => -x), right.map(x => -x)]
    .map(points => new THREE.Float32BufferAttribute(points, 3));
  const dictionary = { eyeWideLeft: 0, eyeLookUpLeft: 1, eyeWideRight: 2, eyeLookUpRight: 3, limitWideLeft: 4, limitUpLeft: 5, limitWideRight: 6, limitUpRight: 7 };
  const face = new THREE.Mesh(geometry), lining = new THREE.Mesh(geometry.clone()), seal = new THREE.Mesh(geometry.clone());
  for (const [mesh, name] of [[face, 'face'], [lining, 'lining'], [seal, 'seal']] as const) {
    mesh.name = name; mesh.morphTargetDictionary = { ...dictionary }; mesh.morphTargetInfluences = Array(8).fill(0); root.add(mesh);
  }
  const driver = new EyelidCorrectives({ root }, { sourceMesh: 'face', mesh: 'lining', sealMesh: 'seal', shapes: [], limits: [
    { controls: ['eyeWideLeft', 'eyeLookUpLeft'], targets: ['limitWideLeft', 'limitUpLeft'] },
    { controls: ['eyeWideRight', 'eyeLookUpRight'], targets: ['limitWideRight', 'limitUpRight'] },
  ] });
  const cases = [0, .25, .5, .75, 1].flatMap(a => [0, .25, .5, .75, 1].map(b => [a, b]));
  cases.push([1, 1], [1, 0], [0, 0]);
  for (const [a, b] of cases) {
    for (const mesh of [face, lining]) { mesh.morphTargetInfluences![0] = a; mesh.morphTargetInfluences![1] = b; }
    driver.update();
    for (const mesh of [face, lining, seal]) {
      assert.ok(Math.abs(mesh.getVertexPosition(0, new THREE.Vector3()).y - Math.min(1, a + b)) < 1e-7, 'the physical lid does not exceed its authored range');
      assert.equal(mesh.getVertexPosition(1, new THREE.Vector3()).y, 0, 'the opposite eye is independent');
    }
    assert.equal(face.morphTargetInfluences![0], a, 'the source wide control survives limiting');
    assert.equal(face.morphTargetInfluences![1], b, 'the source look-up control survives limiting');
    const point = face.getVertexPosition(0, new THREE.Vector3()); driver.update();
    assert.ok(face.getVertexPosition(0, new THREE.Vector3()).distanceTo(point) < 1e-12, 'paused updates do not accumulate');
  }
  assert.deepEqual(face.morphTargetInfluences, Array(8).fill(0), 'release clears all limit corrections');
  for (const mesh of [face, lining]) { mesh.morphTargetInfluences![2] = .8; mesh.morphTargetInfluences![3] = .6; }
  driver.update();
  for (const mesh of [face, lining, seal]) {
    assert.ok(Math.abs(mesh.getVertexPosition(1, new THREE.Vector3()).y - 1) < 1e-7);
    assert.equal(mesh.getVertexPosition(0, new THREE.Vector3()).y, 0);
  }
});
