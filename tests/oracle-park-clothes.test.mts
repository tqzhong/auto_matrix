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
  for (const name of ['oracle-revolutions-head', 'oracle-park-hands']) {
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

function crossings(outer: THREE.Mesh, inner: THREE.Object3D) {
  const vertices = Array.from({ length: outer.geometry.attributes.position.count }, (_, i) => outer.localToWorld(outer.getVertexPosition(i, new THREE.Vector3())));
  const index = outer.geometry.index!, seen = new Set<string>(), hits: number[][] = [];
  for (let i = 0; i < index.count; i += 3) for (let edge = 0; edge < 3; edge++) {
    const a = index.getX(i + edge), b = index.getX(i + (edge + 1) % 3), key = [Math.min(a, b), Math.max(a, b)].join(':');
    if (seen.has(key)) continue; seen.add(key);
    const delta = vertices[b].clone().sub(vertices[a]), length = delta.length();
    if (length < .006) continue;
    delta.normalize();
    const hit = new THREE.Raycaster(vertices[a], delta, .003, length - .003).intersectObject(inner, true).find(hit =>
      hit.face && Math.abs(hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).dot(delta)) > 1e-4);
    if (hit) hits.push(hit.point.toArray());
  }
  return hits;
}

test('the Oracle’s outer coat does not cross through her dress while she turns, lowers and holds the bag', async t => {
  const h = await fixture(t), coat = h.rig.root.getObjectByName('oracle-park-coat') as THREE.Mesh;
  const dress = h.rig.root.getObjectByName('oracle-park-skirt')!;
  const failures: { elapsed: number; intersections: number; first: number[][] }[] = [];
  for (const elapsed of [0, .45, .75, 1.05, 1.45, 1.9, 2.4]) {
    h.step(elapsed);
    const hits = crossings(coat, dress);
    if (hits.length) failures.push({ elapsed, intersections: hits.length, first: hits.slice(0, 3) });
  }
  assert.deepEqual(failures, [], 'the two visible garment layers cut across each other');
});

test('the seated dress keeps its front and back panels from folding through each other', async t => {
  const h = await fixture(t), dress = h.rig.root.getObjectByName('oracle-park-skirt') as THREE.Mesh;
  h.step(2.4);
  const hits = crossings(dress, dress);
  assert.equal(hits.length, 0, `the dress intersects itself at ${JSON.stringify(hits.slice(0, 4))}`);
});

test('the park collar and lapels lie outside the chest instead of disappearing into the coat', async t => {
  const h = await fixture(t), upper = h.rig.root.getObjectByName('oracle-park-upper')!;
  const panels = upper.children.filter(object => object instanceof THREE.Mesh
    && (object.name.startsWith('oracle-park-collar-') || object.name.startsWith('oracle-park-lapel-') || (object.geometry.type === 'BufferGeometry' && !object.geometry.attributes.uv))) as THREE.Mesh[];
  assert.ok(panels.length >= 2, 'both collar and lapel surfaces must be present, including their batched form');
  const body = upper.children.filter(object => object instanceof THREE.Mesh && !panels.includes(object));
  const front = new THREE.Vector3(0, 0, -1).transformDirection(h.rig.torso.matrixWorld), embedded: string[] = [];
  for (const panel of panels) {
    const positions = panel.geometry.attributes.position, index = panel.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const point = new THREE.Vector3();
      for (let k = 0; k < 3; k++) point.add(new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + k)));
      panel.localToWorld(point.divideScalar(3));
      const hit = new THREE.Raycaster(point.clone().addScaledVector(front, -1), front, 0, 2).intersectObjects(body, false)[0];
      if (hit && hit.distance < .997) embedded.push(`${panel.name || 'flat panel'} triangle ${i / 3}: ${1 - hit.distance}`);
    }
  }
  assert.deepEqual(embedded, [], 'the chest hides parts of the visible collar/lapels');
});

test('an unchanged saved pose does not rebuild or upload the same park clothing every rendered frame', async t => {
  const h = await fixture(t); h.step(2.4);
  const meshes = ['oracle-park-skirt', 'oracle-park-coat', 'oracle-park-dress-upper', 'oracle-park-coat-upper']
    .map(name => h.rig.root.getObjectByName(name) as THREE.Mesh);
  const versions = meshes.map(mesh => mesh.geometry.attributes.position.version);
  for (let frame = 0; frame < 4; frame++) h.step(2.4);
  assert.deepEqual(meshes.map(mesh => mesh.geometry.attributes.position.version), versions, 'paused cloth resends unchanged vertex buffers');
  h.step(1.45);
  assert.ok(meshes.every((mesh, i) => mesh.geometry.attributes.position.version > versions[i]), 'the moving pose must still update all four surfaces');
});

test('standing park clothing and a saved seated pose restore after a daily outfit without retaining the old folds', async t => {
  const h = await fixture(t), cold = h.models.create(h.agent);
  const snapshot = (rig: typeof cold) => ['oracle-park-skirt', 'oracle-park-coat', 'oracle-park-dress-upper', 'oracle-park-coat-upper']
    .flatMap(name => Array.from((rig.root.getObjectByName(name) as THREE.Mesh).geometry.attributes.position.array));
  h.step(2.4); const seated = snapshot(h.rig);
  const idle = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0 };
  h.models.animate(h.rig, .1, idle, 1);
  cold.root.position.copy(h.rig.root.position); cold.root.quaternion.copy(h.rig.root.quaternion);
  for (const rig of [h.rig, cold]) h.models.animate(rig, 0, { ...idle, parkOutfit: true }, 1);
  const fresh = snapshot(cold), warm = snapshot(h.rig);
  assert.equal(warm.length, fresh.length);
  assert.ok(warm.every((value, i) => Math.abs(value - fresh[i]) < 1e-5), 'standing retains the enlarged seated bodice or lap');
  h.step(2.4); const restored = snapshot(h.rig);
  assert.ok(restored.every((value, i) => Math.abs(value - seated[i]) < 1e-5), 'reentry fails to reconstruct the saved seated garment');
});
