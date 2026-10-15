import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EpilogueHeads } from '../packages/client/src/agents/EpilogueHeads.js';
import type { CharacterRig } from '../packages/client/src/agents/CharacterModel.js';
import type { MotionInput } from '../packages/client/src/agents/CharacterMotion.js';

const idle: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
const flush = () => new Promise(resolve => setImmediate(resolve));

function rig() {
  const root = new THREE.Group(), head = new THREE.Group(), neck = new THREE.Group();
  head.position.set(0, 4.11, 0); neck.name = 'oracle-neck'; root.add(head, neck);
  head.add(new THREE.Group());
  return { root, head } as CharacterRig;
}

async function asset(role: 'oracle-first' | 'oracle-revolutions') {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/${role}-head.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length).toString());
  for (const material of doc.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  doc.images = []; doc.textures = [];
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), output = Buffer.alloc(20 + padded.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12); output.writeUInt32LE(0x4e4f534a, 16); padded.copy(output, 20); binary.copy(output, 20 + padded.length);
  const loaded = await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength), '');
  loaded.scene.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).map = new THREE.Texture(); });
  return loaded;
}

test('first-film kitchen and Reloaded request Gloria; explicit Revolutions and saved sunrise request Mary', t => {
  const requested: string[] = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => { requested.push(String(url)); return new Promise(() => {}); });
  const heads = new EpilogueHeads(), body = rig(); heads.track(body, 'oracle');
  try {
    heads.update(body, idle);
    assert.deepEqual(requested, ['/assets/characters/oracle-first-head.glb']);
    heads.update(body, { ...idle, reloaded: { role: 'oracle', phase: 'oracle', elapsed: 2 } } as MotionInput);
    assert.equal(requested.length, 1, 'Reloaded must retain first-cast identity');
    heads.update(body, { ...idle, parkOutfit: true });
    assert.equal(requested.at(-1), '/assets/characters/oracle-revolutions-head.glb', 'parkOutfit is produced only for saved film_sunrise_garden');
    heads.update(body, idle); heads.update(body, { ...idle, oracleRevolutions: true });
    assert.equal(requested.length, 2, 'each identity should load once, including pending requests');
  } finally { heads.dispose(); }
});

test('out-of-order first/third loads never expose the wrong identity and first→third→first restores the same head', async t => {
  const first = await asset('oracle-first'), third = await asset('oracle-revolutions');
  const pending = new Map<string, (value: typeof first) => void>();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => new Promise(resolve => pending.set(String(url), resolve)));
  const heads = new EpilogueHeads(), body = rig(); heads.track(body, 'oracle');
  const visible = () => { const names: string[] = []; body.head.traverseVisible(object => { if (object.name.endsWith('-detailed-head')) names.push(object.name); }); return names; };
  try {
    heads.update(body, idle);
    heads.update(body, { ...idle, oracleRestored: true });
    pending.get('/assets/characters/oracle-first-head.glb')!(first); await flush();
    assert.deepEqual(visible(), [], 'late Gloria load must remain hidden during third-film restoration');
    pending.get('/assets/characters/oracle-revolutions-head.glb')!(third); await flush();
    assert.deepEqual(visible(), ['oracle-revolutions-detailed-head']);
    assert.equal(body.head.getObjectByName('oracle-revolutions-eyes')!.visible, false);
    const saved = body.head.matrix.clone();
    heads.update(body, idle);
    assert.deepEqual(visible(), ['oracle-first-detailed-head']);
    assert.equal(body.head.getObjectByName('oracle-fallback-head')!.visible, false);
    assert.equal(body.head.getObjectByName('oracle-first-eyes')!.visible, true);
    heads.update(body, { ...idle, oracleRevolutions: true });
    heads.update(body, idle);
    assert.equal(body.head.getObjectByName('oracle-first-detailed-head'), first.scene);
    assert.deepEqual(body.head.matrix.elements, saved.elements, 'identity swaps cannot alter the saved head driver');
  } finally { heads.dispose(); }
});

test('a late third-film head stays hidden after returning to a saved first-film visit', async t => {
  const first = await asset('oracle-first'), third = await asset('oracle-revolutions');
  let finishThird!: (value: typeof third) => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => String(url).includes('oracle-first')
    ? Promise.resolve(first) : new Promise(resolve => { finishThird = resolve; }));
  const heads = new EpilogueHeads(), body = rig(); heads.track(body, 'oracle');
  try {
    heads.update(body, { ...idle, oracleRevolutions: true });
    heads.update(body, idle); await flush();
    finishThird(third); await flush();
    assert.equal(body.head.getObjectByName('oracle-first-detailed-head')!.visible, true);
    assert.equal(body.head.getObjectByName('oracle-revolutions-detailed-head')!.visible, false);
    assert.equal(body.head.getObjectByName('oracle-fallback-head')!.visible, false);
  } finally { heads.dispose(); }
});

test('Gloria has independent anatomical depth, continuous neck, real eyes and volumetric jaw-length hair', async t => {
  const first = await asset('oracle-first'), third = await asset('oracle-revolutions');
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => first);
  const heads = new EpilogueHeads(), body = rig(); heads.track(body, 'oracle');
  try {
    heads.update(body, idle); await flush(); body.root.updateMatrixWorld(true);
    const face = body.head.getObjectByName('oracle-first-anatomical-head') as THREE.Mesh;
    const positions = face.geometry.attributes.position, other = (third.scene.getObjectByName('oracle-revolutions-anatomical-head') as THREE.Mesh).geometry.attributes.position;
    assert.ok(positions.count > 5000 && face.geometry.index!.count > 15000, 'anatomical surface cannot be replaced by a portrait plane');
    assert.notDeepEqual(Array.from(positions.array), Array.from(other.array), 'Gloria and Mary need distinct geometry, not a texture swap');
    face.geometry.computeBoundingBox(); const bounds = face.geometry.boundingBox!;
    assert.ok(bounds.min.y <= -.515 && bounds.max.z - bounds.min.z > .4, 'neck and full skull must exist');
    const nose = new THREE.Raycaster(face.localToWorld(new THREE.Vector3(0, -.10, 1)), new THREE.Vector3(0, 0, -1)).intersectObject(face)[0];
    assert.ok(nose && face.worldToLocal(nose.point.clone()).z > .27, 'nose needs actual forward geometry');
    const eyes = body.head.getObjectByName('oracle-first-eyes')!;
    assert.equal(eyes.children.length, 6, 'two sclera, iris and pupil surfaces');
    for (const eye of eyes.children) assert.ok(eye instanceof THREE.Mesh && eye.geometry.attributes.position.count > 100);
    const hair = body.head.getObjectByName('oracle-first-bob') as THREE.Mesh;
    assert.ok(hair); hair.geometry.computeBoundingBox(); const silhouette = hair.geometry.boundingBox!;
    assert.ok(silhouette.min.y < -.16 && silhouette.max.x - silhouette.min.x > .55, 'bob must wrap jaw-level side volume instead of a scalp afro');
    const hairline = new THREE.Raycaster(face.localToWorld(new THREE.Vector3(0, .23, 1)), new THREE.Vector3(0, 0, -1));
    const forehead = hairline.intersectObject(face)[0], wave = hairline.intersectObject(hair)[0];
    assert.ok(forehead && wave && wave.distance < forehead.distance, 'front wave must sit over the forehead surface, not penetrate the skull');
    assert.equal(first.parser.json.extras.actor, 'Gloria Foster');
  } finally { heads.dispose(); }
});

test('front registration fades before the first Oracle’s asymmetric waved hair reaches her temple and cheek', async () => {
  const first = await asset('oracle-first');
  const face = first.scene.getObjectByName('oracle-first-anatomical-head') as THREE.Mesh;
  const uv = face.geometry.attributes.uv, weights = face.geometry.attributes._face_weight;
  let hairSamples = 0, coreSamples = 0;
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i) * 1254, y = uv.getY(i) * 1254;
    if (x < 155 && y > 510 && y < 680) {
      hairSamples++; assert.ok(weights.getX(i) < .025, `front hair pixel (${x.toFixed(1)}, ${y.toFixed(1)}) leaks onto cheek: ${weights.getX(i)}`);
    }
    if (x > 280 && x < 370 && y > 570 && y < 680 && weights.getX(i) > .9) coreSamples++;
  }
  assert.ok(hairSamples > 20 && coreSamples > 20, 'check real outer cheek and retained central facial detail');
});
