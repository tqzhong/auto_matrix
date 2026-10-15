import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { CharacterModels, type CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function fixture(t: TestContext, deferHands = false) {
  const assets = new Map();
  for (const name of ['oracle-revolutions-head', 'oracle-first-head', 'oracle-park-hands']) {
    const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
    const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
    for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
    doc.images = []; doc.textures = [];
    const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
    const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
    output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
    const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
    if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
    assets.set(name, asset);
  }
  const deliveries: (() => void)[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const name = String(url).split('/').pop()!.replace('.glb', ''), asset = assets.get(name); assert.ok(asset, name);
    if (deferHands && name === 'oracle-park-hands') await new Promise<void>(resolve => deliveries.push(resolve));
    return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const create = async () => {
    const rig = models.create(world.agents.get('oracle')!);
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true }, 1);
    await new Promise(resolve => setImmediate(resolve)); return rig;
  };
  const step = (rig: CharacterRig, elapsed: number) => {
    const epilogue = { ...newTrilogyEpilogue('dawn'), phase: 'sitting' as const, elapsed, total: elapsed, role: 'oracle' as const };
    const pose = gardenPose(epilogue, 'oracle'); rig.root.position.set(pose.x, 0, pose.z); rig.root.rotation.y = pose.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true, epilogue }, 1);
    rig.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const deliverHands = async () => { deliveries.splice(0).forEach(deliver => deliver()); await new Promise(resolve => setImmediate(resolve)); };
  return { models, create, step, assets, deliverHands };
}

function digitPoints(rig: CharacterRig, side: number, digit: number) {
  const suffix = side ? 'L' : 'R', skin = rig.root.getObjectByName(`oracle-hand-skin-${suffix}`) as THREE.SkinnedMesh | undefined;
  const points: THREE.Vector3[] = [];
  if (skin?.visible) {
    skin.skeleton.update();
    const { position, skinWeight, skinIndex } = skin.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (skin.skeleton.bones[skinIndex.getComponent(i, j)].name.startsWith(`finger${digit}-`)) weight += skinWeight.getComponent(i, j);
      if (weight > .7) points.push(skin.localToWorld(skin.getVertexPosition(i, new THREE.Vector3())));
    }
  } else {
    const hand = rig.root.getObjectByName(`oracle-hand-${suffix}`)!;
    const root = digit === 1 ? hand.children.find(object => object instanceof THREE.Mesh && !object.name)! : rig.fingers[side][digit - 2];
    root.traverseVisible(object => {
      if (object instanceof THREE.Mesh) for (let i = 0; i < object.geometry.attributes.position.count; i++) points.push(object.localToWorld(object.getVertexPosition(i, new THREE.Vector3())));
    });
  }
  assert.ok(points.length > 0, `hand ${suffix} digit ${digit} has no visible skin`);
  return points;
}

test('the Oracle grips the real park handle with fingers and an opposed thumb, without putting skin through the leather', async t => {
  const h = await fixture(t), rig = await h.create();
  for (const elapsed of [0, .45, 1.05, 1.7, 2.4]) {
    h.step(rig, elapsed);
    const bag = rig.root.getObjectByName('oracle-park-handbag')!, handle = bag.getObjectByName('oracle-handbag-handle--0.11') as THREE.Mesh<THREE.TubeGeometry>;
    const path = handle.geometry.parameters.path, segments = Array.from({ length: 192 }, (_, i) => new THREE.Line3(path.getPoint(i / 192), path.getPoint((i + 1) / 192)));
    for (const side of elapsed < 1.05 ? [0] : [0, 1]) for (const digit of [1, 2, 3, 4, 5]) {
      const skin = digitPoints(rig, side, digit).map(point => bag.worldToLocal(point));
      const distances = skin.map(point => Math.min(...segments.map(segment => segment.closestPointToPoint(point, true, new THREE.Vector3()).distanceTo(point))));
      const minimum = Math.min(...distances), gap = minimum - .023;
      t.diagnostic(`${elapsed} hand ${side} digit ${digit}: handle gap ${gap}`);
      assert.ok(gap < .025, `${elapsed} hand ${side} digit ${digit}: the finger floats ${gap} from the handle`);
      assert.ok(gap > -.003, `${elapsed} hand ${side} digit ${digit}: skin penetrates the handle ${-gap}`);
    }
  }
});

test('park hands reconstruct the same actual skin after pause, unrelated motion and a fresh rig, and restore daily hands on leaving', async t => {
  const h = await fixture(t), warm = await h.create(), cold = await h.create();
  for (const elapsed of [0, .45, 1.05, 1.7, 2.4]) {
    h.step(warm, elapsed);
    const skin = [0, 1].flatMap(side => [1, 2, 3, 4, 5].flatMap(digit => digitPoints(warm, side, digit)));
    h.models.animate(warm, .13, { speed: 7, grounded: false, verticalVelocity: 2, turn: .4 }, 1);
    h.step(warm, elapsed); h.step(cold, elapsed);
    for (const rig of [warm, cold]) {
      const restored = [0, 1].flatMap(side => [1, 2, 3, 4, 5].flatMap(digit => digitPoints(rig, side, digit)));
      assert.equal(restored.length, skin.length);
      assert.ok(skin.every((point, i) => point.distanceTo(restored[i]) < 1e-5), `${elapsed}: saved finger skin differs after restoring`);
    }
  }
  h.models.animate(warm, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 1);
  for (const side of [-1, 1]) assert.ok(warm.root.getObjectByName(`oracle-palm-${side}`)!.visible, 'daily performances keep their existing hand contacts');
  for (const side of ['R', 'L']) {
    const park = warm.root.getObjectByName(`oracle-anatomical-hand-${side}`); if (park) assert.equal(park.visible, false);
  }
});

test('the saved bag lift does not fold the wrists back or drive the actual palm and finger surfaces through either handle', async t => {
  const h = await fixture(t), rig = await h.create();
  let lowest = 1;
  for (let frame = 0; frame <= 48; frame++) {
    h.step(rig, frame / 20);
    for (const [i, hand] of rig.parkHands!.entries()) {
      const arm = hand.wrist.getWorldPosition(new THREE.Vector3()).sub(rig.elbows[i].getWorldPosition(new THREE.Vector3())).normalize();
      const axis = new THREE.Vector3(0, -1, 0).transformDirection(hand.wrist.matrixWorld);
      lowest = Math.min(lowest, axis.dot(arm));
      assert.ok(axis.dot(arm) > .5, `frame ${frame} hand ${i}: wrist folds more than 60 degrees: ${axis.dot(arm)}`);
    }
  }
  t.diagnostic(`minimum wrist alignment: ${lowest}`);
  for (const elapsed of [0, .45, 1.05, 2.4]) {
    h.step(rig, elapsed);
    const bag = rig.root.getObjectByName('oracle-park-handbag')!;
    const paths = [-.11, .11].map(z => (bag.getObjectByName(`oracle-handbag-handle-${z}`) as THREE.Mesh<THREE.TubeGeometry>).geometry.parameters.path);
    const lines = paths.flatMap(path => Array.from({ length: 192 }, (_, i) => new THREE.Line3(path.getPoint(i / 192), path.getPoint((i + 1) / 192))));
    for (const hand of rig.parkHands!) {
      hand.skin.skeleton.update(); let deepest = 0;
      const vertices = Array.from({ length: hand.skin.geometry.attributes.position.count }, (_, i) =>
        bag.worldToLocal(hand.skin.localToWorld(hand.skin.getVertexPosition(i, new THREE.Vector3()))));
      const indices = hand.skin.geometry.index!;
      // Triangles can cut leather even if all three corner vertices clear it.
      const samples = [...vertices];
      for (let i = 0; i < indices.count; i += 3) samples.push(vertices[indices.getX(i)].clone().add(vertices[indices.getX(i + 1)]).add(vertices[indices.getX(i + 2)]).divideScalar(3));
      for (const point of samples) {
        if (point.z < -.15 || point.z > .15) continue;
        const gap = Math.min(...lines.map(line => line.closestPointToPoint(point, true, new THREE.Vector3()).distanceTo(point))) - .023;
        deepest = Math.min(deepest, gap);
      }
      assert.ok(deepest > -.003, `${elapsed} ${hand.root.name}: actual hand surface penetrates leather by ${-deepest}`);
    }
  }
});

test('lifting the handbag keeps the forearms outside the Oracle’s actual bodice', async t => {
  const h = await fixture(t), rig = await h.create(), upper = rig.root.getObjectByName('oracle-park-upper')!;
  const violations: string[] = [];
  for (const elapsed of [.45, .75, 1.05, 1.7, 2.4]) {
    h.step(rig, elapsed);
    const across = new THREE.Vector3(1, 0, 0).transformDirection(rig.root.matrixWorld);
    for (let side = 0; side < 2; side++) for (const fraction of [.2, .5, .8]) {
      const elbow = rig.elbows[side].getWorldPosition(new THREE.Vector3());
      const point = elbow.lerp(rig.parkHands![side].wrist.getWorldPosition(new THREE.Vector3()), fraction);
      const left = new THREE.Raycaster(point, across, 0, 1.4).intersectObject(upper, true);
      const right = new THREE.Raycaster(point, across.clone().negate(), 0, 1.4).intersectObject(upper, true);
      if (left.length && right.length) violations.push(`${elapsed} hand ${side} fraction ${fraction}`);
    }
  }
  assert.deepEqual(violations, [], 'the forearm passes inside the torso');
});

test('hands arriving after the Oracle leaves the park stay hidden until her next saved park pose', async t => {
  const h = await fixture(t, true), rig = await h.create();
  h.step(rig, 2.4);
  assert.equal(rig.parkHands, undefined);
  h.models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 1);
  await h.deliverHands();
  assert.equal(rig.parkHands!.length, 2);
  for (const hand of rig.parkHands!) assert.equal(hand.root.visible, false);
  for (const side of [-1, 1]) assert.equal(rig.root.getObjectByName(`oracle-palm-${side}`)!.visible, true);
  h.step(rig, 2.4);
  for (const hand of rig.parkHands!) assert.equal(hand.root.visible, true);
  for (const side of [-1, 1]) assert.equal(rig.root.getObjectByName(`oracle-palm-${side}`)!.visible, false);
});

test('a hand asset arriving after renderer disposal releases its geometry and material without attaching to the old actor', async t => {
  const h = await fixture(t, true), rig = await h.create();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  h.assets.get('oracle-park-hands').scene.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material as THREE.Material); }
  });
  let releasedGeometry = 0, releasedMaterial = 0;
  geometries.forEach(value => value.addEventListener('dispose', () => releasedGeometry++));
  materials.forEach(value => value.addEventListener('dispose', () => releasedMaterial++));
  h.models.dispose(); await h.deliverHands();
  assert.equal(rig.parkHands, undefined);
  assert.equal(releasedGeometry, geometries.size);
  assert.equal(releasedMaterial, materials.size);
  for (const side of ['R', 'L']) assert.equal(rig.root.getObjectByName(`oracle-anatomical-hand-${side}`), undefined);
});
