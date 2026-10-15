import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gardenPose, newTrilogyEpilogue } from '@auto_matrix/shared';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function fixture(t: TestContext) {
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
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const asset = assets.get(String(url).split('/').pop()!.replace('.glb', '')); assert.ok(asset);
    return { ...asset, scene: clone(asset.scene) };
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('oracle')!);
  const step = (elapsed: number) => {
    const epilogue = { ...newTrilogyEpilogue('dawn'), phase: 'sitting' as const, elapsed, total: elapsed, role: 'oracle' as const };
    const pose = gardenPose(epilogue, 'oracle'); rig.root.position.set(pose.x, 0, pose.z); rig.root.rotation.y = pose.yaw;
    models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, parkOutfit: true, epilogue }, 1);
    rig.root.updateMatrixWorld(true);
  };
  t.after(() => { models.dispose(); globalThis.document = previous; });
  step(0); await new Promise(resolve => setImmediate(resolve)); step(0);
  return { models, rig, step, agent: world.agents.get('oracle')! };
}

test('both park wrists remain visibly connected to their sleeves while the bag is lifted', async t => {
  const h = await fixture(t), misses: string[] = [];
  for (const elapsed of [0, .25, .45, .75, 1.05, 1.45, 1.9, 2.4]) {
    h.step(elapsed);
    for (const [side, hand] of h.rig.parkHands!.entries()) {
      const surfaces: THREE.Mesh[] = [];
      h.rig.shoulders[side].traverseVisible(object => {
        if (object instanceof THREE.Mesh) {
          if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
          surfaces.push(object);
        }
      });
      for (const y of [0, .015]) for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const center = hand.wrist.localToWorld(new THREE.Vector3(0, y, 0));
        const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).transformDirection(hand.wrist.matrixWorld);
        const hit = new THREE.Raycaster(center.clone().addScaledVector(direction, .2), direction.negate(), .025, .205)
          .intersectObjects(surfaces, false)[0];
        if (!hit) misses.push(`${elapsed} hand ${side}, wrist ${y}, direction ${angle}`);
      }
    }
  }
  assert.deepEqual(misses, [], 'the open wrist is visible between the anatomical hand and sleeve');
});

test('the sleeve caps meet the coat instead of ending above a detached shoulder seam', async t => {
  const h = await fixture(t), coat = h.rig.root.getObjectByName('oracle-park-coat-upper') as THREE.Mesh;
  const misses: string[] = [];
  for (const elapsed of [0, .45, 1.05, 1.7, 2.4]) {
    h.step(elapsed);
    for (const [side, shoulder] of h.rig.shoulders.entries()) {
      const sleeve = shoulder.children.find(object => object instanceof THREE.SkinnedMesh) as THREE.SkinnedMesh;
      sleeve.skeleton.update();
      const position = sleeve.geometry.attributes.position, cap = new THREE.Vector3(); let count = 0;
      for (let i = 0; i < position.count; i++) if (position.getY(i) > .175) {
        cap.add(sleeve.localToWorld(sleeve.getVertexPosition(i, new THREE.Vector3()))); count++;
      }
      assert.ok(count > 0, 'the sleeve cap has no sampled vertices');
      cap.divideScalar(count);
      const across = new THREE.Vector3(1, 0, 0).transformDirection(h.rig.torso.matrixWorld);
      const enclosed = [across, across.clone().negate()].every(direction => new THREE.Raycaster(cap, direction, 0, 1.5).intersectObject(coat).length);
      if (enclosed) continue;
      const point = coat.worldToLocal(cap.clone()), triangle = new THREE.Triangle(), index = coat.geometry.index!, vertices = coat.geometry.attributes.position;
      let distance = Infinity;
      for (let i = 0; i < index.count; i += 3) {
        triangle.a.fromBufferAttribute(vertices, index.getX(i)); triangle.b.fromBufferAttribute(vertices, index.getX(i + 1)); triangle.c.fromBufferAttribute(vertices, index.getX(i + 2));
        distance = Math.min(distance, coat.localToWorld(triangle.closestPointToPoint(point, new THREE.Vector3())).distanceTo(cap));
      }
      if (distance > .018) misses.push(`${elapsed} shoulder ${side}: open seam ${distance}`);
    }
  }
  assert.deepEqual(misses, [], 'the top of the sleeve leaves an open gap at the coat shoulder');
});

test('the wrist skin meets every anatomical rim vertex and returns to the saved pose after an outfit change or cold load', async t => {
  const h = await fixture(t), idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  const cold = h.models.create(h.agent);
  h.models.animate(cold, 0, { ...idle, parkOutfit: true }, 1); await new Promise(resolve => setImmediate(resolve));
  const points = (rig: typeof cold) => rig.parkHands!.flatMap(hand => {
    const mesh = hand.connection.mesh;
    return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
  });
  for (const elapsed of [0, .45, 1.05, 1.7, 2.4]) {
    h.step(elapsed);
    const expected = points(h.rig);
    for (const hand of h.rig.parkHands!) {
      hand.skin.skeleton.update(); const { mesh, edge } = hand.connection;
      for (let column = 0; column < edge.length; column++) {
        const a = hand.skin.localToWorld(hand.skin.getVertexPosition(edge[column], new THREE.Vector3()));
        const b = mesh.localToWorld(mesh.getVertexPosition(column, new THREE.Vector3()));
        assert.ok(a.distanceTo(b) < 1e-5, `${elapsed}: the anatomical hand separates from the wrist surface`);
      }
    }
    const versions = h.rig.parkHands!.map(hand => hand.connection.mesh.geometry.attributes.position.version);
    h.step(elapsed);
    assert.deepEqual(h.rig.parkHands!.map(hand => hand.connection.mesh.geometry.attributes.position.version), versions, 'an unchanged wrist uploads the same vertices again');
    h.models.animate(h.rig, .15, { ...idle, speed: 6, grounded: false, verticalVelocity: 2 }, 1);
    assert.ok(h.rig.parkHands!.every(hand => !hand.connection.mesh.visible), 'daily performances retain the park wrist');
    h.step(elapsed);
    cold.root.position.copy(h.rig.root.position); cold.root.quaternion.copy(h.rig.root.quaternion);
    const epilogue = { ...newTrilogyEpilogue('dawn'), phase: 'sitting' as const, elapsed, total: elapsed, role: 'oracle' as const };
    h.models.animate(cold, 0, { ...idle, parkOutfit: true, epilogue }, 1); cold.root.updateMatrixWorld(true);
    for (const rig of [h.rig, cold]) {
      const actual = points(rig);
      assert.equal(actual.length, expected.length);
      assert.ok(actual.every((point, i) => point.distanceTo(expected[i]) < 1e-5), `${elapsed}: the saved wrist retains a previous pose`);
    }
  }
});
