import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ShoulderSupport } from '../packages/client/src/agents/ShoulderSupport.js';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion, type MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

function geometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 1, 1, .5, 1, 1, 0, 1.4, .8, -.5, .3, .2, 0, 2, .2], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 2, 3, 4, 0, 0, 0, 3, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([.5, .5, 0, 0, .5, .5, 0, 0, .4, .2, .2, .2, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

function fixture(support?: ShoulderSupport, source = geometry()) {
  const root = new THREE.Group();
  const chest = new THREE.Bone(), right = new THREE.Bone(), left = new THREE.Bone(), head = new THREE.Bone(), wrist = new THREE.Bone();
  chest.name = 'chest'; right.name = 'shoulder_R'; left.name = 'shoulder_L'; head.name = 'head'; wrist.name = 'wrist_R';
  right.position.set(-.5, 1, 0); left.position.set(.5, 1, 0); head.position.set(0, 2, 0); wrist.position.set(0, -.8, 0);
  root.add(chest); chest.add(right, left, head); right.add(wrist);
  const bones = new Map([chest, right, left, head, wrist].map(b => [b.name, b]));
  const rest = new Map([...bones].map(([name, b]) => [name, b.position.clone()]));
  const material = new THREE.MeshStandardMaterial(), mesh = new THREE.SkinnedMesh(source, material); root.add(mesh); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([chest, right, left, head, wrist]); mesh.bind(skeleton);
  support?.attach(root, bones, rest);
  function point(i: number) { root.updateMatrixWorld(true); return mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld); }
  return { root, bones, right, left, mesh, point, dispose() { skeleton.dispose(); source.dispose(); material.dispose(); } };
}

test('raised shoulders retain the radial section rather than the linear-blend collapse', t => {
  const support = new ShoulderSupport(), h = fixture(support); t.after(() => { support.dispose(); h.dispose(); });
  for (const angle of [0, 45, 90, 126, 157]) {
    h.right.rotation.x = -THREE.MathUtils.degToRad(angle); h.left.rotation.x = -THREE.MathUtils.degToRad(angle);
    for (const [i, bone] of [[0, h.right], [1, h.left]] as const) {
      const centre = bone.getWorldPosition(new THREE.Vector3());
      const radius = h.point(i).distanceTo(centre);
      assert.ok(Math.abs(radius - 1) < 2e-6, `arm ${i} at ${angle} degrees: radius ${radius}`);
    }
  }
});

test('shared chest weights stay positive within the four-influence binding limit', t => {
  const support = new ShoulderSupport(), h = fixture(support); t.after(() => { support.dispose(); h.dispose(); });
  for (let i = 0; i < h.mesh.geometry.attributes.position.count; i++) {
    const index = h.mesh.geometry.attributes.skinIndex, weight = h.mesh.geometry.attributes.skinWeight;
    let total = 0;
    for (let k = 0; k < 4; k++) { const w = weight.getComponent(i, k); assert.ok(w >= 0 && Number.isFinite(w)); assert.ok(index.getComponent(i, k) < h.mesh.skeleton.bones.length); total += w; }
    assert.ok(Math.abs(total - 1) < 2e-6);
  }
  const bind = h.point(2); assert.ok(bind.distanceTo(new THREE.Vector3(0, 1.4, .8)) < 2e-6);
});

test('late shoulder pose updates reach the supports without changing hand and head binding', t => {
  const support = new ShoulderSupport(), h = fixture(support), control = fixture(); t.after(() => { support.dispose(); h.dispose(); control.dispose(); });
  for (const angle of [157, 35, -25, 0]) {
    h.right.rotation.set(-THREE.MathUtils.degToRad(angle), .2, -.1); control.right.quaternion.copy(h.right.quaternion);
    h.right.updateWorldMatrix(true, true); control.right.updateWorldMatrix(true, true);
    const expected = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().slerp(h.right.quaternion, .5)).add(h.right.getWorldPosition(new THREE.Vector3()));
    assert.ok(h.point(0).distanceTo(expected) < 2e-6);
    assert.ok(h.point(3).distanceTo(control.point(3)) < 2e-6, 'the wrist vertex follows its existing hand bone');
    assert.ok(h.point(4).distanceTo(control.point(4)) < 2e-6, 'the rigid head vertex keeps its original binding');
  }
});

test('two instances sharing an input geometry keep independent shoulder poses', t => {
  const support = new ShoulderSupport(), source = geometry();
  const originalIndices = Array.from(source.attributes.skinIndex.array), originalWeights = Array.from(source.attributes.skinWeight.array);
  const a = fixture(support, source), b = fixture(support, source); t.after(() => { support.dispose(); a.dispose(); b.dispose(); });
  a.right.rotation.x = -2.2; a.point(0);
  assert.ok(b.point(0).distanceTo(new THREE.Vector3(-.5, 1, 1)) < 2e-6);
  assert.deepEqual(Array.from(source.attributes.skinIndex.array), originalIndices); assert.deepEqual(Array.from(source.attributes.skinWeight.array), originalWeights);
});

test('HeroModels opts only the marked Trinity rig into supports before caching skin and hands', async t => {
  const h = await actor('trinity'); t.after(() => h.models.dispose());
  const count = (rig: typeof h.rig) => [...rig.bones.keys()].filter(name => name.startsWith('shoulder_support_')).length;
  const originalJacket = h.rig.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
  assert.equal(count(h.rig), 0, 'existing assets retain their rig');
  const asset = await (h.models as any).load('trinity');
  asset.parser.json.extras.trinityShoulderSupport = { version: 2 };
  assert.equal(count((await h.models.create('trinity'))!), 0, 'unknown versions do not change the rig');
  asset.parser.json.extras.trinityShoulderSupport.version = 1;
  assert.equal(count((await h.models.create('trinity', undefined, 'switch'))!), 0, 'supporting cast keeps its authored deformation');
  const first = (await h.models.create('trinity'))!, second = (await h.models.create('trinity'))!;
  assert.equal(count(first), 14); assert.equal(count(second), 14);
  const skin = first.trackingSkin!;
  assert.equal(skin.mesh.geometry, skin.original);
  assert.equal(skin.original.attributes.skinIndex, skin.firstPerson.attributes.skinIndex);
  const jacket = first.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
  const otherJacket = second.root.getObjectByName('Fitted_leather_jacket') as THREE.SkinnedMesh;
  assert.equal(jacket.skeleton.bones.length, originalJacket.skeleton.bones.length + 14);
  assert.notEqual(jacket.skeleton, otherJacket.skeleton);
  const inputs: MotionInput[] = [
    { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, climbing: .5 },
    { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson: true, armed: true, weaponStyle: 'hel_pistol' },
    { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, clubClothes: true },
    { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 },
  ];
  for (const [i, input] of inputs.entries()) {
    const state = newMotion(); h.models.animate(first, advanceMotion(state, input, 0), state, input, 0);
    first.root.updateMatrixWorld(true);
    assert.equal(skin.mesh.geometry, i === 1 ? skin.firstPerson : skin.original);
    assert.equal(jacket.visible, i !== 2);
    const p = jacket.getVertexPosition(0, new THREE.Vector3()); assert.ok(p.toArray().every(Number.isFinite));
  }
  const prepared = new Set<THREE.BufferGeometry>(), skeletons = new Set<THREE.Skeleton>();
  for (const rig of [first, second]) rig.root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh) { prepared.add(object.geometry); skeletons.add(object.skeleton); }
  });
  let disposedGeometry = 0, disposedSkeletons = 0;
  prepared.forEach(g => g.addEventListener('dispose', () => { disposedGeometry++; }));
  skeletons.forEach(s => { const dispose = s.dispose.bind(s); s.dispose = () => { disposedSkeletons++; dispose(); }; });
  h.models.dispose();
  assert.equal(disposedGeometry, prepared.size); assert.equal(disposedSkeletons, skeletons.size);
});
