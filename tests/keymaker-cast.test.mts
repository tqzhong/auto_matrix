import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';

test('Keymaker requests his own continuous body and older face instead of the anonymous suited character', async t => {
  const requests: string[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    requests.push(String(url));
    // This test covers runtime routing, including a recoverable asset error.
    throw new Error('deliberately unavailable asset');
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(console, 'warn', () => {});
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('keymaker')!);
  t.after(() => { models.dispose(); globalThis.document = previous; });
  models.animate(rig, 0, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 }, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests.sort(), ['/assets/characters/keymaker-body.glb', '/assets/characters/keymaker-head.glb']);
  assert.equal(rig.detail.visible, true, 'a missing detailed asset must retain a visible fallback');
});

async function shipped(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString());
  // Retain the shipped geometry, weights and UVs. Pixel appearance is checked
  // in the native browser; Node does not decode the projection atlas.
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  if (name.endsWith('-head')) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return asset;
}

async function fixture(t: TestContext) {
  const assets = new Map(await Promise.all(['keymaker-head', 'keymaker-body'].map(async name => [name, await shipped(name)] as const)));
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => assets.get(String(url).split('/').pop()!.replace('.glb', ''))!);
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const models = new CharacterModels(), rig = models.create(world.agents.get('keymaker')!);
  t.after(() => { models.dispose(); globalThis.document = previous; });
  const pose = (clock = 1, speed = 0) => {
    models.animate(rig, 0, { speed, grounded: true, verticalVelocity: 0, turn: 0, poseClock: clock }, 1);
    rig.root.updateMatrixWorld(true);
    rig.root.traverseVisible(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  };
  pose(); await new Promise(resolve => setImmediate(resolve)); pose();
  assert.ok(rig.root.getObjectByName('keymaker-detailed-body'), 'the delivered body must actually load');
  assert.ok(rig.head.getObjectByName('keymaker-detailed-head'), 'the delivered head must actually load');
  return { rig, pose };
}

test('Keymaker wears a fitted apron, shirt and low shoes, and his glasses preserve visible eyes', async t => {
  const { rig } = await fixture(t);
  for (const name of ['work-jacket', 'shirt', 'apron-bib', 'apron-skirt', 'apron-pocket', 'keys', 'work-boots'])
    assert.ok(rig.root.getObjectByName('keymaker-' + name), `missing authored costume part ${name}`);
  assert.equal(rig.head.getObjectByName('keymaker-fallback-head')!.visible, false);
  assert.ok(rig.head.getObjectByName('keymaker-eyes')!.visible);
  for (const side of [-1, 1]) {
    const lens = rig.head.getObjectByName(`keymaker-clear-lens-${side}`) as THREE.Mesh;
    const material = lens.material as THREE.MeshPhysicalMaterial;
    assert.ok(material.transparent && material.opacity < .15 && !material.depthWrite, 'reading lenses must not obscure the face like agent sunglasses');
  }
  const keys = rig.root.getObjectByName('keymaker-keys') as THREE.SkinnedMesh;
  assert.ok(keys.geometry.index!.count < 1000, 'tiny keys must not add tens of thousands of triangles');
});

test('the Keymaker apron stays in front of his shirt and coat through saved walking poses', async t => {
  const { rig, pose } = await fixture(t); let comparisons = 0;
  for (const clock of [0, .3, .6, 1.1]) for (const speed of [0, 5]) {
    pose(clock, speed);
    for (const [outerName, innerName, heights] of [
      ['apron-bib', 'shirt', [2.4, 2.6, 2.8]],
      ['apron-skirt', 'jacket-hem', [1.65, 1.8, 2.03]],
    ] as const) for (const x of [-.23, 0, .23]) for (const y of heights) {
      const outer = rig.root.getObjectByName('keymaker-' + outerName) as THREE.Mesh;
      const inner = rig.root.getObjectByName('keymaker-' + innerName) as THREE.Mesh;
      const ray = new THREE.Raycaster(rig.detail.localToWorld(new THREE.Vector3(x, y, 2)), new THREE.Vector3(0, 0, -1).transformDirection(rig.detail.matrixWorld));
      const a = ray.intersectObject(outer, false)[0], b = ray.intersectObject(inner, false)[0];
      if (!a || !b) continue;
      comparisons++;
      assert.ok(a.distance <= b.distance + .001, `${outerName} is pierced by ${innerName} at ${clock}, ${speed}, ${x}, ${y}: ${a.distance - b.distance}`);
    }
  }
  assert.ok(comparisons >= 90, 'sample actual overlapping garment surfaces, including moving hips');
});

test('the fitted Keymaker neck stays closed while turning and paused meshes remain stable', async t => {
  const { rig, pose } = await fixture(t);
  const head = rig.head.getObjectByName('keymaker-anatomical-head') as THREE.Mesh;
  const body = rig.root.getObjectByName('keymaker-anatomical-body') as THREE.SkinnedMesh;
  const surfaces: THREE.Mesh[] = [head];
  rig.root.getObjectByName('keymaker-detailed-body')!.traverseVisible(object => { if (object instanceof THREE.Mesh) surfaces.push(object); });
  for (const yaw of [-.6, 0, .6]) for (const pitch of [-.18, .15]) {
    pose(); rig.head.rotation.set(pitch, yaw, 0); rig.root.updateMatrixWorld(true); body.skeleton.update();
    for (const z of [-.13, -.07]) for (const y of [-.56, -.53, -.50, -.46]) {
      const ray = new THREE.Raycaster(rig.head.localToWorld(new THREE.Vector3(1, y, z)), new THREE.Vector3(-1, 0, 0).transformDirection(rig.head.matrixWorld));
      assert.ok(ray.intersectObjects(surfaces, false).length, `neck opening at ${yaw}, ${pitch}, ${y}, ${z}`);
    }
  }
  pose(.7, 5);
  const points: THREE.Vector3[] = [];
  for (let vertex = 0; vertex < body.geometry.attributes.position.count; vertex += 97) points.push(body.getVertexPosition(vertex, new THREE.Vector3()));
  pose(.7, 5);
  for (const [index, point] of points.entries()) assert.ok(point.distanceTo(body.getVertexPosition(index * 97, new THREE.Vector3())) < 1e-7, 'reconstructing the same saved pose must not drift');
});
