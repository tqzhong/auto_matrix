import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterModels } from '../packages/client/src/agents/CharacterModel.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';

async function asset(name: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${name}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
}

const neutral = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
test('first-film Oracle has continuous anatomy, a waist apron, and all five articulated fingers in the kitchen', async t => {
  const body = await asset('oracle-first-body'), hands = await asset('oracle-park-hands');
  const headBytes = await readFile(new URL('../packages/client/public/assets/characters/oracle-first-head.glb', import.meta.url));
  assert.equal(body.parser.json.extras.headSha256, createHash('sha256').update(headBytes).digest('hex'),
    'rebuild the fitted body when publishing a changed first-film head');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => {
    const source = url.endsWith('oracle-first-body.glb') ? body : url.endsWith('oracle-park-hands.glb') ? hands : undefined;
    return source ? Promise.resolve({ ...source, scene: clone(source.scene) }) : new Promise(() => {});
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('oracle')!);
  try {
    const input = { ...neutral, oracleKitchen: true };
    models.animate(rig, 0, input, 4); await new Promise(resolve => setImmediate(resolve));
    models.animate(rig, 0, input, 4); rig.root.updateMatrixWorld(true);
    const anatomy = rig.root.getObjectByName('oracle-first-anatomical-body') as THREE.SkinnedMesh;
    const apron = rig.root.getObjectByName('oracle-first-waist-apron') as THREE.SkinnedMesh;
    const blouse = rig.root.getObjectByName('oracle-first-floral-blouse') as THREE.SkinnedMesh;
    assert.ok(anatomy?.isSkinnedMesh && apron?.isSkinnedMesh && blouse?.isSkinnedMesh);
    const apronBox = new THREE.Box3().setFromObject(apron, true);
    assert.ok(apronBox.max.y < 2.7 && apronBox.min.y < 1.2, `waist apron must not cover the chest: ${apronBox.min.y}..${apronBox.max.y}`);
    assert.equal(rig.root.getObjectByName('oracle-apron-group')!.visible, false);
    const visible = (object: THREE.Object3D): boolean => {
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
      return true;
    };
    for (const y of [1.3, 1.75, 2.2, 2.9, 3.15]) for (const x of [-.18, 0, .18]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1.3), new THREE.Vector3(0, 0, -1), 0, 2);
      const hit = ray.intersectObject(rig.root, true).find(hit => visible(hit.object));
      assert.ok(hit, `continuous clothing required at ${x},${y}`);
      assert.ok(y < 2.4 ? hit.object.name === 'oracle-first-waist-apron' : hit.object.name === 'oracle-first-floral-blouse',
        `the waist apron and torso blouse must cover their own regions: ${x},${y}: ${hit.object.name}`);
    }
    for (const y of [1.85, 1.95, 2.05]) for (const x of [-.38, .38]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1), 0, 2);
      const hit = ray.intersectObject(rig.root, true).find(hit => visible(hit.object));
      assert.ok(hit?.object.name.includes('blouse') || hit?.object.name.includes('emerald-panels'), `trousers cut through blouse hem at ${x},${y}: ${hit?.object.name}`);
    }
    for (const sign of [-1, 1]) for (const y of [3.58, 3.60]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(sign, y, .02), new THREE.Vector3(-sign, 0, 0), 0, 2);
      const hit = ray.intersectObject(rig.oracleFirstBody!, true)[0];
      assert.ok(hit?.object.name.includes('blouse') || hit?.object.name.includes('collar'), `kitchen neckline leaves a bare shoulder flange at ${sign},${y}: ${hit?.object.name}`);
    }
    assert.equal(rig.parkHands?.length, 2);
    for (const hand of rig.parkHands!) {
      assert.equal(hand.bones.length, 5); assert.ok(hand.bones.every(chain => chain.length === 3));
      assert.equal(hand.root.visible, true); assert.equal(hand.connection.forearm?.skin, anatomy);
      assert.ok(hand.connection.forearm!.edge.length > 8, 'wrists must join an actual anatomical open forearm rim');
    }
    const head = rig.head.getWorldPosition(new THREE.Vector3()).toArray();
    assert.deepEqual(head, [0, 4.109999999999999, 0]);
    // The cookie offer leans the torso while both hips counter-rotate to keep
    // the soles planted. The separate waist layers must remain in that order.
    rig.torso.rotation.x = .3;
    rig.hips.forEach(hip => { hip.rotation.x = -.10205294039572996; });
    rig.root.updateMatrixWorld(true);
    for (const y of [1.9, 2, 2.1, 2.2, 2.3]) for (const x of [-.25, -.12, 0, .12, .25]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1.3), new THREE.Vector3(0, 0, -1), 0, 2);
      const hit = ray.intersectObject(rig.oracleFirstBody!, true)[0];
      assert.equal(hit?.object.name, 'oracle-first-waist-apron', `cookie-offer lean exposes blouse through apron at ${x},${y}: ${hit?.object.name}`);
    }
    models.animate(rig, 0, { ...neutral, oracleRevolutions: true, parkOutfit: true }, 4);
    assert.equal(rig.root.getObjectByName('oracle-first-detailed-body')!.visible, false, 'Mary Alice keeps the original third-film costume');
    assert.equal(rig.root.getObjectByName('oracle-park-outfit')!.visible, true);
    models.animate(rig, 0, input, 4); rig.root.updateMatrixWorld(true);
    assert.equal(rig.root.getObjectByName('oracle-first-detailed-body')!.visible, true);
    assert.equal(rig.root.getObjectByName('oracle-park-outfit')!.visible, false);
    for (const hand of rig.parkHands!) assert.equal(hand.connection.forearm?.skin, anatomy);
    // Oracle steps toward Neo and returns before offering the cookie. Updating
    // a parent root must not leave the wrist bridge in the previous world pose.
    rig.root.position.x += 1.3;
    models.animate(rig, 0, input, 4); rig.root.updateMatrixWorld(true);
    for (const hand of rig.parkHands!) {
      const forearm = hand.connection.forearm!, edge = forearm.edge;
      const center = edge.reduce((sum, i) => sum.add(forearm.skin.localToWorld(forearm.skin.getVertexPosition(i, new THREE.Vector3()))), new THREE.Vector3()).divideScalar(edge.length);
      const mesh = hand.connection.mesh, columns = hand.connection.edge.length + 1;
      const joined = Array.from({ length: columns }, (_, i) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, columns * 6 + i)))
        .reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(columns);
      assert.ok(joined.distanceTo(center) < .012, `moving Oracle detached the wrist from her actual forearm: ${joined.distanceTo(center)}`);
    }
  } finally { models.dispose(); globalThis.document = previous; }
});

test('a kitchen body arriving after a third-film switch cannot replace the later costume', async t => {
  const body = await asset('oracle-first-body'); let deliver!: (value: typeof body) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => url.endsWith('oracle-first-body.glb')
    ? new Promise(resolve => { deliver = resolve; }) : new Promise(() => {}));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const world = new WorldState(); new AgentManager(world).initializeAllAgents(); const models = new CharacterModels();
  const rig = models.create(world.agents.get('oracle')!);
  try {
    models.animate(rig, 0, { ...neutral, oracleKitchen: true }, 4);
    models.animate(rig, 0, { ...neutral, oracleRevolutions: true, parkOutfit: true }, 4);
    const before = rig.root.getObjectByName('oracle-park-outfit')!.visible;
    deliver(body); await new Promise(resolve => setImmediate(resolve));
    assert.equal(rig.oracleFirstBody!.visible, false);
    assert.equal(rig.root.getObjectByName('oracle-park-outfit')!.visible, before);
    models.animate(rig, 0, { ...neutral, oracleKitchen: true }, 4);
    assert.equal(rig.oracleFirstBody!.visible, true);
    assert.equal(rig.root.getObjectByName('oracle-apron-group')!.visible, false);
  } finally { models.dispose(); globalThis.document = previous; }
});
