import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { SkinContinuity } from '../packages/client/src/agents/SkinContinuity.js';
import { patientNormal } from './helpers/patient-skin.mjs';

function wrists() {
  const root = new THREE.Group(), bones: THREE.Bone[] = [], arms: { shoulder: THREE.Bone; wrist: THREE.Bone }[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Bone(), wrist = new THREE.Bone();
    shoulder.position.x = side * .5; wrist.position.y = .2;
    root.add(shoulder); shoulder.add(wrist); bones.push(shoulder, wrist); arms.push({ shoulder, wrist });
  }
  const points: number[] = [], normals: number[] = [], handWeights: number[] = [], bodyWeights: number[] = [];
  for (let side = 0; side < 2; side++) {
    const x = side ? .5 : -.5;
    points.push(x - .02, .2, 0, x, .2, 0, x + .02, .2, 0, x - .009, .16, 0, x + .009, .16, 0);
    normals.push(-.6, 0, .8, 0, 0, 1, .6, 0, .8, 0, 0, 1, 0, 0, 1);
    handWeights.push(...Array(5).fill(side * 2 + 1));
    bodyWeights.push(side * 2 + 1, side * 2 + 1, side * 2 + 1, side * 2, side * 2);
  }
  const geometry = (hand: boolean) => {
    const g = new THREE.BufferGeometry(), p = points.slice();
    // Only the three wrist-ring vertices coincide with the hand surface.
    if (hand) for (const i of [3, 4, 8, 9]) p[i * 3 + 1] = .24;
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(hand ? normals : Array(10).fill([0, 0, 1]).flat(), 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute((hand ? handWeights : bodyWeights).flatMap(bone => [bone, 0, 0, 0]), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array(10).fill([1, 0, 0, 0]).flat(), 4));
    return g;
  };
  const handGeometry = geometry(true), bodyGeometry = geometry(false), handMaterial = new THREE.MeshPhysicalMaterial(), bodyMaterial = new THREE.MeshStandardMaterial();
  const hand = new THREE.SkinnedMesh(handGeometry, handMaterial), body = new THREE.SkinnedMesh(bodyGeometry, bodyMaterial);
  hand.name = 'Anatomical_head_and_hands'; root.add(hand, body); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); hand.bind(skeleton); body.bind(skeleton);
  const surface = new SkinContinuity({ root, bones: new Map(bones.map((bone, i) => [String(i), bone])) } as unknown as HeroRig, body);
  const normal = body.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const reference = () => {
    const cached = new Float32Array(normal.array);
    surface['active'] = false; surface.update();
    for (let i = 0; i < cached.length; i++) assert.ok(Math.abs(cached[i] - normal.array[i]) < 2e-6, `cached shading differs from a fresh field at component ${i}`);
  };
  const seams = () => {
    hand.skeleton.update(); body.skeleton.update();
    for (const i of [0, 1, 2, 5, 6, 7]) assert.ok(patientNormal(hand, i).angleTo(patientNormal(body, i)) < .002);
  };
  return { root, arms, hand, body, surface, normal, reference, seams, dispose() {
    surface.dispose(); handGeometry.dispose(); bodyGeometry.dispose(); handMaterial.dispose(); bodyMaterial.dispose(); skeleton.dispose();
  } };
}

test('moving intact arms reuses wrist lighting while keeping their world matrices current', t => {
  const h = wrists(); t.after(() => h.dispose()); h.surface.update();
  const version = h.normal.version, before = h.arms[0].wrist.matrixWorld.clone();
  for (let frame = 1; frame <= 30; frame++) {
    h.arms[0].shoulder.rotation.set(frame * .03, frame * .02, -.3);
    h.arms[1].shoulder.rotation.set(-frame * .02, .2, frame * .04);
    h.root.rotation.y = frame * .01; h.root.scale.setScalar(1 + frame * .01);
    h.surface.update(); h.seams();
    assert.equal(h.normal.version, version, 'rigid arm motion must not upload unchanged wrist normals');
  }
  assert.ok(!before.equals(h.arms[0].wrist.matrixWorld), 'the optimisation must not freeze the bones used by reflection and contact solvers');
  h.reference();
});

test('relative wrist motion and a changed delivered hand normal invalidate the field', t => {
  const h = wrists(); t.after(() => h.dispose()); h.surface.update();
  const before = new Float32Array(h.normal.array), version = h.normal.version;
  h.arms[0].wrist.rotation.y = .7; h.surface.update();
  assert.ok(h.normal.version > version);
  assert.ok(h.normal.array.some((value, i) => Math.abs(value - before[i]) > .01));
  h.reference(); h.seams();
  const handNormal = h.hand.geometry.getAttribute('normal') as THREE.BufferAttribute;
  handNormal.setXYZ(1, .4, 0, Math.sqrt(.84)); handNormal.needsUpdate = true;
  h.surface.update(); h.reference(); h.seams();
  const replacement = handNormal.clone(); replacement.setXYZ(1, -.4, 0, Math.sqrt(.84));
  h.hand.geometry.setAttribute('normal', replacement);
  h.surface.update(); h.reference(); h.seams();
});

test('nonuniform parent transforms still recompute the complete world-space correction', t => {
  const h = wrists(); t.after(() => h.dispose()); h.surface.update();
  const parent = new THREE.Group(); parent.add(h.root); parent.scale.set(1.7, .8, 1.2);
  for (let frame = 0; frame < 5; frame++) {
    h.root.rotation.y = .2 + frame * .12; h.arms[0].shoulder.rotation.z = frame * .08;
    h.surface.update(); h.reference(); h.seams();
  }
  parent.scale.setScalar(1);
  h.surface.update(); h.reference(); h.seams();
});

test('changed skin bindings cannot reuse a field from an unrelated arm', t => {
  const h = wrists(); t.after(() => h.dispose()); h.surface.update();
  const index = h.hand.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  index.setX(1, 3); index.needsUpdate = true;
  h.arms[1].shoulder.rotation.y = .65; h.surface.update(); h.reference(); h.seams();
  h.arms[1].shoulder.rotation.y = -.4; h.surface.update(); h.reference(); h.seams();
});
