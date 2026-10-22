import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { type AwakeningBeat } from '@auto_matrix/shared';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';
import { podPatient } from './helpers/pod-patient.mjs';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { patientNormal, patientSkin, skinJoins } from './helpers/patient-skin.mjs';

test('the exposed patient keeps continuous hand/body lighting through actual saved pod poses', async t => {
  const h = await podPatient(t), s = patientSkin(h.rig), results: unknown[] = [];
  assert.ok(s.pairs.length >= 200, 'inspect both wrist rings, the neck and UV duplicates');
  const poses: AwakeningBeat[] = [
    ...[0, 1.8, 3.6, 5.2].map(elapsed => ({ kind: 'emerge' as const, elapsed })),
    ...[0, 1.2, 2.05, 2.648, 3.6, 4.55, 5.5].map(elapsed => ({ kind: 'breather' as const, elapsed, emerged: true })),
    ...[2.5, 4.3, 6.85, 9].map(elapsed => ({ kind: 'disconnect' as const, elapsed, emerged: true, breatherRemoved: true })),
    ...[0, 7, 12].map(elapsed => ({ kind: 'rescue' as const, elapsed })),
  ];
  for (const beat of poses) {
    h.at(beat.elapsed, 100, false, beat); s.hand.skeleton.update(); s.body.skeleton.update();
    let maximumAngle = 0, maximumGap = 0;
    for (const [hand, body] of s.pairs) {
      maximumAngle = Math.max(maximumAngle, patientNormal(s.hand, hand).angleTo(patientNormal(s.body, body)));
      maximumGap = Math.max(maximumGap, s.hand.localToWorld(s.hand.getVertexPosition(hand, new THREE.Vector3())).distanceTo(s.body.localToWorld(s.body.getVertexPosition(body, new THREE.Vector3()))));
    }
    results.push({ beat, pairs: s.pairs.length, maximumAngleDegrees: THREE.MathUtils.radToDeg(maximumAngle), maximumGap });
    assert.ok(maximumGap < 2e-5, 'lighting corrections must preserve the coincident skin');
    assert.ok(maximumAngle < .002, `${beat.kind}/${beat.elapsed}: skin lighting breaks by ${THREE.MathUtils.radToDeg(maximumAngle)} degrees at its join`);
  }
  t.diagnostic(JSON.stringify(results));
});

test('one patient has the same specular response on its hands and exposed body', async t => {
  const textures: THREE.Texture[] = [];
  const h = await actor('neo', scene => scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    if (!['Skin', 'Tracking skin'].includes(material.name)) return;
    const texture = new THREE.Texture(); texture.name = material.name === 'Skin' ? 'registered-hand-atlas' : 'registered-body-atlas';
    material.map = texture; textures.push(texture);
  }));
  t.after(() => { h.models.dispose(); textures.forEach(texture => texture.dispose()); });
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: 'pod', podBreather: 2.648, podEmergence: 5.2 };
  h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  const s = patientSkin(h.rig), hand = s.hand.material as THREE.MeshPhysicalMaterial, body = s.body.material as THREE.MeshPhysicalMaterial;
  assert.ok(hand.isMeshPhysicalMaterial && body.isMeshPhysicalMaterial, 'a single patient cannot mix physical skin and default standard highlights across the same wrist');
  assert.equal(body.specularIntensity, hand.specularIntensity); assert.equal(body.ior, hand.ior);
  assert.equal(body.roughness, hand.roughness); assert.equal(body.metalness, hand.metalness);
  assert.ok(body.color.equals(hand.color));
  assert.equal(body.map?.name, 'registered-body-atlas', 'preserve the separate correctly registered body atlas');
  assert.equal(hand.map?.name, 'registered-hand-atlas');
});

test('patient seam shading is actor-owned, stable while paused and restores outside the exposed costume', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const other = (await h.models.create('neo'))!, s = patientSkin(h.rig), cold = patientSkin(other);
  const normal = s.body.geometry.attributes.normal, otherBefore = cold.body.geometry.attributes.normal.array.slice();
  const untouched = ['position', 'uv', 'skinIndex', 'skinWeight'].map(name => ({ name, values: s.body.geometry.attributes[name].array.slice() }));
  assert.ok(normal.array !== cold.body.geometry.attributes.normal.array, 'patient normals must not overwrite a second actor sharing the source asset');
  const state = newMotion(), input: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, performance: 'pod', podBreather: 2.648, podEmergence: 5.2 };
  const draw = () => h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
  draw(); const expected = normal.array.slice(), version = normal.version;
  assert.ok(expected.some((value, i) => value !== otherBefore[i]), 'the join correction must actually change the normal field');
  for (const { name, values } of untouched) assert.ok(s.body.geometry.attributes[name].array.every((value, i) => value === values[i]), `${name}: shading must preserve the delivered body surface and skin binding`);
  for (let i = 0; i < 12; i++) { draw(); assert.ok(normal.array.every((v, j) => v === expected[j])); assert.equal(normal.version, version, 'paused skin cannot upload a fresh normal buffer each frame'); }
  assert.ok(cold.body.geometry.attributes.normal.array.every((v, i) => v === otherBefore[i]), 'the other actor retains its untouched normal field');
  const ordinary = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  h.models.animate(h.rig, advanceMotion(state, ordinary, 0), state, ordinary, 0);
  assert.ok(normal.array.every((v, i) => v === otherBefore[i]), 'leaving the exposed costume restores the original body normal field');
  draw(); assert.ok(normal.array.every((v, i) => v === expected[i]), 'returning to the same saved pose cannot accumulate shading drift');
  let disposed = 0; s.body.geometry.addEventListener('dispose', () => disposed++);
  h.models.dispose(); assert.equal(disposed, 1, 'the patient-owned geometry must be released once');
});

for (const id of ['neo', 'trinity', 'smith', 'morpheus'] as const) test(`${id}: the actual wrist skin shares the rendered hand normal through open and closed grips`, async t => {
  const h = await actor(id); t.after(() => h.models.dispose());
  const hand = h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
  const body = h.rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Wrist skin')!.mesh as THREE.SkinnedMesh;
  const s = skinJoins(hand, body); assert.ok(s.pairs.length >= 96, 'inspect both UV-split wrist boundaries');
  let maximumAngle = 0;
  for (const amount of [0, .25, .6, 1]) {
    h.draw(amount); hand.skeleton.update(); body.skeleton.update();
    for (const [a, b] of s.pairs) maximumAngle = Math.max(maximumAngle, patientNormal(hand, a).angleTo(patientNormal(body, b)));
  }
  t.diagnostic(JSON.stringify({ id, pairs: s.pairs.length, maximumAngleDegrees: THREE.MathUtils.radToDeg(maximumAngle) }));
  assert.ok(maximumAngle < .002, `the actual wrist lighting breaks by ${THREE.MathUtils.radToDeg(maximumAngle)} degrees`);
});

test('skin shading preserves the live mirror liquid shader on every corrected Neo surface', async t => {
  const h = await actor('neo'); t.after(() => h.models.dispose());
  const surfaces = h.rig.wardrobe.filter(part => /^(Wrist skin|Office skin|Tracking skin)$/.test((part.mesh.material as THREE.Material).name));
  assert.ok(surfaces.length >= 4, 'cover the wrist, office neck, tracking arms and patient body');
  for (const { mesh } of surfaces) {
    const material = mesh.material as THREE.Material;
    const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} } as Parameters<THREE.Material['onBeforeCompile']>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.equal(shader.uniforms.matrixSilver, h.rig.silver, `${mesh.name}: replacement dropped the live saved mirror amount`);
    assert.ok(shader.vertexShader.includes('liquidFront') && shader.fragmentShader.includes('liquidMask'));
    assert.ok(mesh.geometry.getAttribute('_mirrorArrival'), 'retain the registered liquid-front attribute');
    assert.ok(material.customProgramCacheKey().includes('liquid-mirror-v4'));
    h.rig.silver.value = .87; assert.equal(shader.uniforms.matrixSilver.value, .87);
  }
});
