import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FilmJourney } from '@auto_matrix/shared';
import { ZionHomecomingRenderer } from '../packages/client/src/engine/ZionHomecomingRenderer.js';
import { ZionCrowdRenderer } from '../packages/client/src/engine/ZionCrowdRenderer.js';

const announcement = { scene: 'm3_ceasefire', actor: 'kid', step: 2, completed: [], epilogue: { kind: 'ceasefire', phase: 'announcement', elapsed: 1.5, total: 6.75 } } as FilmJourney;
function instances(root: THREE.Object3D) {
  const meshes: THREE.InstancedMesh[] = [];
  root.traverse(object => { if (object instanceof THREE.InstancedMesh) meshes.push(object); });
  return meshes.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAsset(sex: string) {
  const bytes = await readFile(new URL(`../packages/client/public/assets/characters/zion-crowd-${sex}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString()), original = structuredClone(document);
  for (const material of document.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  document.images = []; document.textures = [];
  const json = Buffer.from(JSON.stringify(document)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const binary = bytes.subarray(20 + length), buffer = Buffer.alloc(20 + padded.length + binary.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20); binary.copy(buffer, 20 + padded.length);
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  return { asset, original, bytes: bytes.length };
}
function mockAssets(t: test.TestContext) {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url: string) => (await loadAsset(url.includes('-female.') ? 'female' : 'male')).asset);
}

test('the temple audience uses complete human surfaces rather than cones with floating sphere heads', async t => {
  mockAssets(t);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  try {
    await (renderer as unknown as { crowd: ZionCrowdRenderer }).crowd.ready;
    assert.equal(instances(root.getObjectByName('zion-temple-crowd')!).length, 12, 'two complete bodies share six surfaces each');
    const placeholders = instances(root).filter(mesh => mesh.geometry instanceof THREE.SphereGeometry
      || mesh.geometry instanceof THREE.CylinderGeometry && mesh.geometry.parameters.radiusTop === .43);
    assert.equal(placeholders.length, 0, 'replace the visibly headless/footless crowd bodies with actual anatomical meshes');
  } finally { renderer.dispose(); }
});

test('a paused or cold-loaded ceasefire audience cannot change pose when the same save has a different renderer clock', async t => {
  mockAssets(t);
  const root = new THREE.Group(), renderer = new ZionHomecomingRenderer(root, 'film_zion_temple');
  try {
    renderer.update(announcement, 0);
    await (renderer as unknown as { crowd: ZionCrowdRenderer }).crowd.ready;
    const audience = root.getObjectByName('zion-temple-crowd')!;
    const before = instances(audience).map(mesh => Array.from(mesh.instanceMatrix.array));
    const gestures = instances(audience).map(mesh => Array.from(mesh.morphTexture!.source.data.data));
    renderer.update(announcement, 70);
    assert.deepEqual(instances(audience).map(mesh => Array.from(mesh.instanceMatrix.array)), before,
      'the saved report clock, not browser uptime, must drive resident gestures');
    assert.deepEqual(instances(audience).map(mesh => Array.from(mesh.morphTexture!.source.data.data)), gestures);
    const cold = new ZionCrowdRenderer(new THREE.Group());
    try {
      cold.update(structuredClone(announcement), 700); await cold.ready;
      assert.deepEqual(instances(cold.group).map(mesh => Array.from(mesh.instanceMatrix.array)), before);
      assert.deepEqual(instances(cold.group).map(mesh => Array.from(mesh.morphTexture!.source.data.data)), gestures);
    } finally { cold.dispose(); }
  } finally { renderer.dispose(); }
});

test('the shipped crowd assets retain textured faces, anatomical hands, separate legs, soles and matching arm morph topology within budget', async () => {
  for (const sex of ['male', 'female']) {
    const { asset, original, bytes } = await loadAsset(sex);
    const source = await readFile(new URL(`../packages/client/public/assets/characters/club-${sex}.glb`, import.meta.url));
    assert.equal(original.extras.sourceSha256, createHash('sha256').update(source).digest('hex'));
    assert.ok(!original.skins && !original.animations, 'background bodies do not need individual skeleton updates');
    assert.ok(bytes < 800000); let triangles = 0;
    for (const mesh of asset.scene.children as THREE.Mesh[]) {
      const geometry = mesh.geometry; triangles += geometry.index!.count / 3;
      assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
      assert.equal(geometry.morphAttributes.position.length, 4); assert.equal(geometry.morphAttributes.normal.length, 4);
      assert.ok(geometry.morphTargetsRelative); assert.ok(!geometry.attributes.skinIndex && !geometry.attributes.skinWeight && !geometry.attributes.color);
      for (const attribute of [geometry.attributes.position, geometry.attributes.normal, ...geometry.morphAttributes.position, ...geometry.morphAttributes.normal]) {
        assert.equal(attribute.count, geometry.attributes.position.count); assert.ok(attribute.array.every(Number.isFinite));
      }
    }
    assert.ok(triangles > 5000 && triangles < 7500, `${sex}: ${triangles} triangles`);
    const shoes = asset.scene.getObjectByName('Zion_soles') as THREE.Mesh, skin = asset.scene.getObjectByName('Zion_skin') as THREE.Mesh;
    for (const side of [-1, 1]) {
      const feet = Array.from({ length: shoes.geometry.attributes.position.count }, (_, i) => i)
        .filter(i => shoes.geometry.attributes.position.getX(i) * side > .08 && shoes.geometry.attributes.position.getY(i) < .025);
      assert.ok(feet.length >= 3, `${sex}: retain both foot contacts`);
      for (const morph of shoes.geometry.morphAttributes.position) for (const vertex of feet) assert.ok(new THREE.Vector3().fromBufferAttribute(morph, vertex).length() < 1e-6);
    }
    for (const side of [0, 1]) {
      const wrist = new THREE.Vector3(...original.extras.wrists.neutral[side] as [number, number, number]);
      const hands = Array.from({ length: skin.geometry.attributes.position.count }, (_, i) => i)
        .filter(i => new THREE.Vector3().fromBufferAttribute(skin.geometry.attributes.position, i).distanceTo(wrist) < .3);
      assert.ok(hands.length >= 8, `${sex}: keep the actual articulated hand surface`);
      const meanLift = hands.reduce((lift, i) => lift + skin.geometry.morphAttributes.position[side * 2 + 1].getY(i), 0) / hands.length;
      assert.ok(meanLift > 1.5, `${sex}: the cheering hand must actually rise, ${meanLift}`);
    }
    for (const image of original.images) await readFile(new URL(`../packages/client/public/assets/characters/${image.uri}`, import.meta.url));
  }
});

test('cotton tops meet the trousers through the cheering poses instead of leaving an empty waist', async () => {
  for (const sex of ['male', 'female']) {
    const { asset } = await loadAsset(sex), shirt = asset.scene.getObjectByName('Zion_shirt') as THREE.Mesh;
    const trousers = asset.scene.getObjectByName('Zion_trousers') as THREE.Mesh;
    const waist = new THREE.Box3().setFromBufferAttribute(trousers.geometry.attributes.position as THREE.BufferAttribute).max.y;
    const hem = new THREE.Box3().setFromBufferAttribute(shirt.geometry.attributes.position as THREE.BufferAttribute).min.y;
    assert.ok(hem < waist - .07, `${sex}: shirt hem ${hem} must overlap trouser waist ${waist}`);
    for (const amount of [0, .5, 1]) {
      for (const mesh of asset.scene.children as THREE.Mesh[]) mesh.morphTargetInfluences!.fill(0);
      if (amount) for (const mesh of asset.scene.children as THREE.Mesh[]) {
        mesh.morphTargetInfluences![amount === .5 ? 0 : 1] = 1; mesh.morphTargetInfluences![amount === .5 ? 2 : 3] = 1;
      }
      asset.scene.updateMatrixWorld(true);
      for (const x of [-.16, 0, .16]) for (const y of [waist - .05, waist + .08, waist + .17]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1), 0, 3);
        assert.ok(ray.intersectObject(asset.scene, true).length > 0, `${sex}: visible waist hole at ${x}, ${y}, arms ${amount}`);
      }
    }
  }
});

test('residents turn and raise hands after the report at different times, with planted soles and clear space for players and reunions', async t => {
  mockAssets(t); const crowd = new ZionCrowdRenderer(new THREE.Group()); await crowd.ready;
  const batches = instances(crowd.group), skins = batches.filter(mesh => mesh.name.endsWith('-Zion_skin'));
  const spectators = skins.reduce((n, mesh) => n + mesh.count, 0);
  assert.ok(spectators >= 70 && spectators <= 90); assert.equal(batches.length, 12);
  assert.ok(batches.every(mesh => !mesh.castShadow && mesh.receiveShadow && mesh.frustumCulled));
  const triangleBudget = batches.reduce((n, mesh) => n + mesh.geometry.index!.count / 3 * mesh.count, 0);
  assert.ok(triangleBudget < 600000, `${triangleBudget} instanced triangles`);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  const update = (elapsed: number) => crowd.update({ ...announcement, epilogue: { ...announcement.epilogue!, elapsed, total: 5.2 + elapsed } }, 123);
  try {
    update(0); const quiet = skins.map(mesh => Array.from(mesh.morphTexture!.source.data.data));
    update(1); const responding = skins.map(mesh => Array.from(mesh.morphTexture!.source.data.data)); assert.notDeepEqual(responding, quiet);
    const influences = responding.flat().filter((_, i) => i % 5 !== 0); assert.ok(influences.some(value => value === 0) && influences.some(value => value > .5));
    for (const elapsed of [0, .6, 1.3, 2.1, 3.1]) {
      update(elapsed); crowd.group.updateMatrixWorld(true);
      for (const batch of batches) {
        const posed = new THREE.Mesh(batch.geometry); assert.ok(batch.boundingBox && batch.boundingSphere);
        for (let instance = 0; instance < batch.count; instance++) {
          batch.getMatrixAt(instance, matrix); batch.getMorphAt(instance, posed);
          for (let vertex = 0; vertex < batch.geometry.attributes.position.count; vertex++) {
            posed.getVertexPosition(vertex, point).applyMatrix4(matrix);
            assert.ok(Math.abs(point.x) > 3.7, 'raised hands cannot enter the player passage');
            assert.ok(point.y > -.001, 'no foot or body below the walking floor');
            for (const [x, z] of [[-6, 17], [-2.2, 17], [3, 19], [6.5, 19]]) assert.ok(Math.hypot(point.x - x, point.z - z) > 1.5, 'keep the named actors clear');
            assert.ok(batch.boundingBox!.containsPoint(point), 'animated surfaces stay within culling bounds');
          }
        }
      }
    }
  } finally { crowd.dispose(); }
});

test('leaving before either crowd asset loads cannot reattach figures and releases late resources and morph textures exactly once', async t => {
  const male = await loadAsset('male'), female = await loadAsset('female');
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>(), releases = new Map<object, number>();
  for (const { asset } of [male, female]) asset.scene.traverse(object => { if (object instanceof THREE.Mesh) { resources.add(object.geometry); resources.add(object.material as THREE.Material); } });
  for (const resource of resources) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1));
  let finishMale!: () => void, finishFemale!: () => void;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', (url: string) => new Promise(resolve => {
    if (url.includes('-female.')) finishFemale = () => resolve(female.asset); else finishMale = () => resolve(male.asset);
  }));
  const root = new THREE.Group(), crowd = new ZionCrowdRenderer(root);
  crowd.update(announcement); finishMale(); await new Promise(resolve => setImmediate(resolve));
  const batches = instances(crowd.group); assert.equal(batches.length, 6, 'one asset is visible without waiting for the other');
  let instanceReleases = 0, morphReleases = 0;
  for (const mesh of batches) {
    mesh.addEventListener('dispose', () => instanceReleases++); mesh.morphTexture!.addEventListener('dispose', () => morphReleases++);
  }
  crowd.dispose(); finishFemale(); await crowd.ready;
  assert.equal(root.children.length, 0); assert.equal(crowd.group.children.length, 0);
  assert.equal(instanceReleases, 6); assert.equal(morphReleases, 6);
  assert.equal(releases.size, resources.size); assert.ok([...releases.values()].every(count => count === 1));
});
